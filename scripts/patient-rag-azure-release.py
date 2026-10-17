"""Attach translated demo RAG to the existing Azure patient API; preserve live unrelated code and runtime settings."""
import argparse,base64,hashlib,importlib.util,json,pathlib,re,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com'
def load(name,path):
 s=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
runtime=load('rag_runtime','scripts/health-helper-runtime-check.py')
config=load('rag_config','scripts/entra-web-config.py')
def sha(data):return hashlib.sha256(data).hexdigest()
def once(text,old,new):
 assert text.count(old)==1,'PATCH_ANCHOR_CHANGED';return text.replace(old,new,1)
def stage():
 folder=config.protected_folder();client=runtime.connect('CLOUD',None)
 try:
  baseline=runtime.remote(client,'CLOUD',None,"""import subprocess,json,base64
names=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15));out=[]
for i in items:
 assert i['State']['Running'];out.append(dict(name=i['Name'],id=i['Id'],image=i['Image']))
files={}
for role,item,paths in [('control',items[0],['src/server.js']),('web',items[1],['public/mobile/sw.js'])]:
 code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
 files[role]=json.loads(subprocess.check_output(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code,json.dumps(paths)],timeout=15))
print(json.dumps(dict(containers=out,files=files)))""",40)
  (folder/'baseline.json').write_text(json.dumps(baseline))
  server=base64.b64decode(baseline['files']['control']['src/server.js']).decode().replace('\r\n','\n')
  server=once(server,'const localHelperModel = createOllamaHelperModel();',"const localHelperModel = createOllamaHelperModel();\nconst translationRag = process.env.HIPASS_CAPSTONE_MAIN_SCENARIO==='HCC' ? await (await import('./health-helper-patient-translation.js')).createPatientTranslationRag({env:{...process.env,HIPASS_HEALTH_HELPER_TRANSLATION_RAG:'school-demo'}}) : null;")
  server=once(server,"mode: localHelperModel ? 'VISIT_PREPARATION' : 'SOURCE_GUIDANCE', timeoutMs: localHelperModel ? 60000 : 15000","translationRag, mode: localHelperModel ? 'VISIT_PREPARATION' : 'SOURCE_GUIDANCE', timeoutMs: translationRag ? 40000 : localHelperModel ? 60000 : 15000")
  if 'createSyntheticHccProvenanceAnswer' not in server:
   server=once(server,"import { HealthHelperRag } from './health-helper-rag.js';","import { HealthHelperRag } from './health-helper-rag.js';\nimport {createSyntheticHccProvenanceAnswer} from './health-helper-synthetic-hcc-provenance.js';")
   server=once(server,'timeoutMs: translationRag ? 40000 : localHelperModel ? 60000 : 15000',"timeoutMs: translationRag ? 40000 : localHelperModel ? 60000 : 15000,\n  syntheticScenario: ({principal,question})=>createSyntheticHccProvenanceAnswer({principal,question,enabled:process.env.HIPASS_CAPSTONE_MAIN_SCENARIO==='HCC',catalogCommitted:isHccCatalogCommitted(store)})")
  patches={'control':{'src/server.js':server.encode()},'web':{}}
  source=['src/health-helper-rag.js','src/health-helper-http.js','src/health-helper-corpus.js','src/health-helper-visit.js',
   'src/health-helper-patient-translation.js','src/health-helper-translation-relay.js','src/health-helper-medlineplus.js',
   'src/medlineplus-upload-corpus.js','src/health-helper-school-demo-medical-tests.js','src/health-helper-candidate-generation.js',
   'src/health-helper-synthetic-hcc-provenance.js','src/scenario-health-standard.js',
   'data/medlineplus-upload-ko-20261012-v3/corpus.json','data/medlineplus-upload-ko-20261012-v3/manifest.json',
   'fixtures/health-helper-school-demo-medical-tests-2026-10-13.json']
  for name in source:patches['control'][name]=(ROOT/name).read_bytes()
  for name in ['public/ui/patient-helper.js','public/ui/patient-helper.css','public/ui/health-comparison.js']:patches['web'][name]=(ROOT/name).read_bytes()
  sw=base64.b64decode(baseline['files']['web']['public/mobile/sw.js']).decode()
  sw,count=re.subn(r'const CACHE_NAME = "hipass-mediq-shell-[^"]+";', 'const CACHE_NAME = "hipass-mediq-shell-patient-rag-20261014";',sw)
  assert count==1;patches['web']['public/mobile/sw.js']=sw.encode()
  remote_stage='/home/highpassadmin/.highpass-records-'+folder.name
  manifest={'stage':remote_stage,'baseline':baseline['containers'],'roles':{},'scope':'AUTHENTICATED_PATIENT_SCHOOL_DEMO_TRANSLATION_RAG'}
  with client.open_sftp() as ftp:
   ftp.mkdir(remote_stage,0o755)
   def upload(name,data):
    local=folder/name;local.parent.mkdir(parents=True,exist_ok=True);local.write_bytes(data)
    for parent in reversed(pathlib.PurePosixPath(name).parents):
     if str(parent)=='.':continue
     try:ftp.mkdir(remote_stage+'/'+parent.as_posix(),0o755)
     except OSError:pass
    ftp.put(str(local),remote_stage+'/'+name);ftp.chmod(remote_stage+'/'+name,0o444)
   for role,files in patches.items():
    for name,data in files.items():upload(role+'/'+name,data)
    manifest['roles'][role]={'base':baseline['containers'][0 if role=='control' else 1]['image'],'hashes':{p:sha(data) for p,data in files.items()}}
   for name in ['health-helper-patient-translation.test.js','health-helper-rag.test.js','health-helper-http.test.js','patient-helper.test.js']:
    upload('tests/'+name,(ROOT/'test'/name).read_bytes())
   upload('tests/helpers/health-helper-corpus.js',(ROOT/'test/helpers/health-helper-corpus.js').read_bytes())
  (folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
  return {'folder':str(folder),'stage':remote_stage}
 finally:client.close()
def operation(folder,phase):
 folder=folder.resolve();assert folder.is_relative_to(ROOT/'artifacts/azure')
 manifest=json.loads((folder/'manifest.json').read_text());client=runtime.connect('CLOUD',None)
 try:
  operator=(ROOT/'scripts/scenario-health-remote.py').read_text()
  if manifest['scope']!='PATIENT_HELPER_PRESENTATION_ONLY':
   operator=operator.replace("+'\\n')", "+('\\nCOPY --chmod=755 data/ /app/data/\\nCOPY --chmod=755 fixtures/ /app/fixtures/\\n' if role=='control' else '\\n'))",1)
   assert 'COPY --chmod=755 data/' in operator
  operator=operator.replace("image['RootFS']['Layers'][:-1]==base['RootFS']['Layers']", "image['RootFS']['Layers'][:len(base['RootFS']['Layers'])]==base['RootFS']['Layers']")
  operator=operator.replace("    test_cmd=['docker'", "    test_container=run(['docker','create',candidates['web']]).decode().strip()\n    try:run(['docker','cp',test_container+':/app/public/index.html',str(folder/'web-index.html')])\n    finally:run(['docker','rm',test_container])\n    run(['chmod','444',str(folder/'web-index.html')])\n    test_cmd=['docker'",1)
  operator=operator.replace("    test_cmd+=['-v',str(folder/'tests')", "    test_cmd+=['-v',str(folder/'web-index.html')+':/app/public/index.html:ro']\n    test_cmd+=['-v',str(folder/'tests')",1)
  if manifest['scope']=='PATIENT_HELPER_PRESENTATION_ONLY':
   operator=operator.replace("try:run(['docker','cp',test_container+':/app/public/index.html',str(folder/'web-index.html')])", "try:run(['docker','cp',test_container+':/app/public',str(folder/'test-web-public')])")
   operator=operator.replace("run(['chmod','444',str(folder/'web-index.html')])", "run(['chmod','-R','a+rX',str(folder/'test-web-public')])")
   operator=operator.replace("str(folder/'web-index.html')+':/app/public/index.html:ro'", "str(folder/'test-web-public')+':/app/public:ro'")
  operator=operator.replace("'--test','/app/test/scenario-health-standard.test.js'","'--test','/app/test/health-helper-patient-translation.test.js','/app/test/health-helper-http.test.js','/app/test/patient-helper.test.js'")
  # Corpus JSON is data, not an executable client asset.
  program='MANIFEST='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+operator
  result=runtime.remote(client,'CLOUD',None,program,540 if phase=='build' else 300)
  if phase=='build':manifest['candidates']=result;(folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
  (folder/(phase+'.json')).write_text(json.dumps(result,indent=2));return result
 finally:client.close()
def refresh(folder):
 folder=folder.resolve();assert folder.is_relative_to(ROOT/'artifacts/azure')
 manifest=json.loads((folder/'manifest.json').read_text());client=runtime.connect('CLOUD',None);changed=[]
 try:
  with client.open_sftp() as ftp:
   staged_server=folder/'control/src/server.js';server=staged_server.read_bytes().replace(b'translationRag ? 45000',b'translationRag ? 40000')
   if server!=staged_server.read_bytes():
    staged_server.write_bytes(server);remote_path=manifest['stage']+'/control/src/server.js'
    ftp.chmod(remote_path,0o644);ftp.put(str(staged_server),remote_path);ftp.chmod(remote_path,0o444)
    manifest['roles']['control']['hashes']['src/server.js']=sha(server);changed.append('src/server.js timeout')
   for role,item in manifest['roles'].items():
    for path,digest in list(item['hashes'].items()):
     if path in ['src/server.js','public/mobile/sw.js']:continue
     data=(ROOT/path).read_bytes()
     if sha(data)==digest:continue
     destination=folder/role/path;destination.write_bytes(data);remote_path=manifest['stage']+'/'+role+'/'+path
     ftp.chmod(remote_path,0o644);ftp.put(str(destination),remote_path);ftp.chmod(remote_path,0o444)
     item['hashes'][path]=sha(data);changed.append(path)
   for path in ['health-helper-patient-translation.test.js','health-helper-http.test.js','patient-helper.test.js']:
    destination=folder/'tests'/path;destination.write_bytes((ROOT/'test'/path).read_bytes());remote_path=manifest['stage']+'/tests/'+path
    ftp.chmod(remote_path,0o644);ftp.put(str(destination),remote_path);ftp.chmod(remote_path,0o444)
  manifest.pop('candidates',None);(folder/'manifest.json').write_text(json.dumps(manifest,indent=2));return {'changed':changed}
 finally:client.close()
def verify(folder):
 manifest=json.loads((folder/'manifest.json').read_text());checks=[]
 for path,digest in manifest['roles']['web']['hashes'].items():
  with urllib.request.urlopen(urllib.request.Request(ORIGIN+'/'+path.removeprefix('public/'),headers={'Cache-Control':'no-cache'}),timeout=25) as r:assert sha(r.read())==digest
  checks.append({'path':path,'result':'PASS'})
 for token in [None,'invalid.token.signature']:
  headers={'Content-Type':'application/json','Origin':ORIGIN}
  if token:headers['Authorization']='Bearer '+token
  try:r=urllib.request.urlopen(urllib.request.Request(ORIGIN+'/api/v1/me/health-helper/questions',data=b'{"question":"AFP"}',headers=headers),timeout=25)
  except urllib.error.HTTPError as e:r=e
  assert r.status==401;checks.append({'test':'tampered' if token else 'no-auth','result':'PASS','status':r.status})
 result={'checks':checks};(folder/'verify.json').write_text(json.dumps(result,indent=2));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('phase',choices=['stage','refresh','build','deploy','verify','rollback']);p.add_argument('--folder',type=pathlib.Path);a=p.parse_args()
 print(json.dumps(stage() if a.phase=='stage' else refresh(a.folder) if a.phase=='refresh' else verify(a.folder) if a.phase=='verify' else operation(a.folder,a.phase)))
