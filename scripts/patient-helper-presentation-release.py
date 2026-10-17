"""Patch patient copy on the latest live images; preserve all other live files."""
import base64,importlib.util,json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rag_release',ROOT/'scripts/patient-rag-azure-release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

def stage():
 folder=release.config.protected_folder();client=release.runtime.connect('CLOUD',None)
 try:
  baseline=release.runtime.remote(client,'CLOUD',None,"""import subprocess,json,base64
names=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15));out=[]
for item in items:
 assert item['State']['Running'];out.append(dict(name=item['Name'],id=item['Id'],image=item['Image']))
files={}
for role,item,paths in [('control',items[0],['src/health-helper-patient-translation.js']),('web',items[1],['public/ui/patient-helper.js','public/mobile/sw.js'])]:
 code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
 files[role]=json.loads(subprocess.check_output(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code,json.dumps(paths)],timeout=15))
print(json.dumps(dict(containers=out,files=files)))""",40)
  (folder/'baseline.json').write_text(json.dumps(baseline))
  def live(role,path):return base64.b64decode(baseline['files'][role][path]).decode().replace('\r\n','\n')
  module_path='src/health-helper-patient-translation.js'
  module=(ROOT/module_path).read_text(encoding='utf-8')
  # Recover the pre-change module and require exact equality with the live baseline.
  helper=module[module.index('// Patient copy is separate'):module.index('// Existing private SSH-forwarded')]
  before=module.replace(helper,'',1).replace('try{return patientPresentation({','try{return {',1)
  before=before.replace("questionOrigin:'LOCAL_QWEN'});}","questionOrigin:'LOCAL_QWEN'};}",1)
  before=before.replace('return patientPresentation({...guidance','return {...guidance',1)
  before=before.replace("questionOrigin:'PROJECT_TEMPLATE'});","questionOrigin:'PROJECT_TEMPLATE'};",1)
  assert before==live('control',module_path),'PATIENT_MODULE_BASELINE_CHANGED'
  ui_path='public/ui/patient-helper.js';ui=live('web',ui_path)
  ui=release.once(ui,": result.status === 'SOURCE_GUIDANCE' ? '원문 링크 안내 · AI 생성 답변 아님 · 질문은 프로젝트 예시입니다.'",
   ": result.status === 'SOURCE_GUIDANCE' ? (result.profile === 'SCHOOL_DEMO_TRANSLATION_RAG' ? '관련 원문 자료 안내 · 학교 발표용 건강 정보' : '원문 링크 안내 · AI 생성 답변 아님 · 질문은 프로젝트 예시입니다.')")
  sw,count=re.subn(r'const CACHE_NAME = "hipass-mediq-shell-[^"]+";', 'const CACHE_NAME = "hipass-mediq-shell-helper-copy-'+folder.name+'";',live('web','public/mobile/sw.js'))
  assert count==1
  patches={'control':{module_path:module.encode()},'web':{ui_path:ui.encode(),'public/mobile/sw.js':sw.encode()}}
  remote_stage='/home/highpassadmin/.highpass-records-'+folder.name
  manifest={'stage':remote_stage,'baseline':baseline['containers'],'roles':{},'scope':'PATIENT_HELPER_PRESENTATION_ONLY'}
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
    manifest['roles'][role]={'base':baseline['containers'][0 if role=='control' else 1]['image'],'hashes':{p:release.sha(data) for p,data in files.items()}}
   for name in ['health-helper-patient-translation.test.js','health-helper-http.test.js','patient-helper.test.js']:
    upload('tests/'+name,(ROOT/'test'/name).read_bytes())
   upload('tests/helpers/health-helper-corpus.js',(ROOT/'test/helpers/health-helper-corpus.js').read_bytes())
  (folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
  return {'folder':str(folder),'stage':remote_stage}
 finally:client.close()

if __name__=='__main__':print(json.dumps(stage()))
