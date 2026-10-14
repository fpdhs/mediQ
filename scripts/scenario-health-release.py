"""Scoped existing-VM release. Preserve live code outside this feature and all runtime policy.

No new cloud resources, credentials, ingress rules, PACS writes or data migration.
Evidence is DRAFT / UNASSIGNED. Capture/build never promotes automatically.
"""
import argparse,base64,hashlib,importlib.util,json,pathlib,subprocess,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com'
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
runtime=load('scenario_runtime','scripts/health-helper-runtime-check.py')
config=load('scenario_config','scripts/entra-web-config.py')
def sha(data):return hashlib.sha256(data).hexdigest()
def once(text,old,new):
    assert text.count(old)==1,'PATCH_ANCHOR_CHANGED'
    return text.replace(old,new,1)
def local(name):return (ROOT/name).read_text(encoding='utf8')
def extract(text,start,end):
    a=text.index(start);b=text.index(end,a);return text[a:b]
def stage():
    folder=config.protected_folder();client=runtime.connect('CLOUD',None)
    try:
        baseline=runtime.remote(client,'CLOUD',None,r'''
import subprocess,json,base64
names=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1','hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15));out=[]
for i in items:
 assert i['State']['Running']
 out.append(dict(name=i['Name'],id=i['Id'],image=i['Image']))
files={}
for role,item,paths in [('control',items[0],['src/server.js','src/synthetic-health-http.js','src/synthetic-health-records.js']),('web',items[1],['public/index.html','public/app.js','public/ui/health-record-client.js'])]:
 code="const fs=require('fs');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(p=>[p,fs.readFileSync('/app/'+p).toString('base64')]))))"
 files[role]=json.loads(subprocess.check_output(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code,json.dumps(paths)],timeout=15))
print(json.dumps(dict(containers=out,files=files)))
''',50)
        (folder/'baseline.json').write_text(json.dumps(baseline))
        captured={role:{p:base64.b64decode(v).decode().replace('\r\n','\n') for p,v in files.items()} for role,files in baseline['files'].items()}
        patches={'control':{},'web':{}}
        for name in ['src/synthetic-health-http.js','src/synthetic-health-records.js','public/ui/health-record-client.js']:
            role='control' if name.startswith('src/') else 'web'
            original=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT).decode().replace('\r\n','\n')
            deployed=captured[role][name]
            if name=='src/synthetic-health-http.js':
                # The live pre-Entra handler did not await its now-async authenticator.
                deployed=deployed.replace('principal=authenticate(request);','principal=await authenticate(request);')
            assert deployed==original,'BASELINE_FEATURE_DRIFT_'+name
            patches[role][name]=local(name)
        server=captured['control']['src/server.js']
        server=once(server,"import {createSyntheticHealthHandler} from './synthetic-health-http.js';","import {createSyntheticHealthHandler} from './synthetic-health-http.js';\nimport {isScenarioHealthPatient} from './scenario-health-standard.js';")
        server=once(server,"const routeSyntheticHealth=createSyntheticHealthHandler({authenticate:authenticateRequest,requestMeta,audit:helperAudit,","const routeSyntheticHealth=createSyntheticHealthHandler({authenticate:authenticateRequest,requestMeta,audit:helperAudit,\n  studies:principal=>service.listStudies(principal.patientId,{includeSeries:true}),")
        server=once(server,'&& principal.patientId===HCC_PATIENT_ID && principal.subject===HCC_PATIENT_SUBJECT && isHccCatalogCommitted(store)', '&& isScenarioHealthPatient(principal) && isHccCatalogCommitted(store)')
        patches['control']['src/server.js']=server
        patches['control']['src/scenario-health-standard.js']=local('src/scenario-health-standard.js')
        app=captured['web']['public/app.js']
        app=once(app,"import {createHealthRecordClient} from '/ui/health-record-client.js';","import {createHealthRecordClient} from '/ui/health-record-client.js';\nimport {createScenarioHealthStandard} from '/ui/scenario-health-standard.js';\nlet scenarioHealthStandard=null;")
        app=once(app,'  syntheticHealthClient?.reset();','  syntheticHealthClient?.reset();\n  scenarioHealthStandard?.reset();')
        app=once(app,"window.addEventListener('pagehide', () => patientHealth?.setActive(false));","window.addEventListener('pagehide', () => patientHealth?.setActive(false));\nwindow.addEventListener('pagehide', () => scenarioHealthStandard?.reset());")
        branch=extract(local('public/app.js'),'async function loadPhrDashboard() {','  setPhrState("합성 PHR 데이터를 불러오는 중입니다.", "loading");')
        app=once(app,'async function loadPhrDashboard() {\n',branch)
        patches['web']['public/app.js']=app
        html=captured['web']['public/index.html']
        old=extract(html,'            <details class="health-standard">','          </section>')
        new=extract(local('public/index.html'),'            <details class="health-standard">','          </section>')
        html=once(html,old,new)
        html=once(html,'  <link rel="stylesheet" href="/ui/patient-health.css">','  <link rel="stylesheet" href="/ui/patient-health.css">\n  <link rel="stylesheet" href="/ui/scenario-health-standard.css">')
        patches['web']['public/index.html']=html
        for name in ['public/ui/scenario-health-standard.js','public/ui/scenario-health-standard.css']:patches['web'][name]=local(name)
        stage='/home/highpassadmin/.highpass-records-'+folder.name
        manifest={'stage':stage,'baseline':baseline['containers'],'roles':{},'review':'DRAFT / UNASSIGNED'}
        with client.open_sftp() as ftp:
            ftp.mkdir(stage,0o700)
            for role in patches:
                ftp.mkdir(stage+'/'+role,0o700)
                for name,content in patches[role].items():
                    destination=folder/role/name;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(content,encoding='utf8',newline='\n')
                    relative=role+'/'+name
                    for parent in [role+'/'+p.as_posix() for p in reversed(pathlib.PurePosixPath(name).parents) if str(p)!='.']:
                        try:ftp.mkdir(stage+'/'+parent,0o700)
                        except OSError:pass
                    ftp.put(str(destination),stage+'/'+relative)
                base=baseline['containers'][0 if role=='control' else 1]['image']
                dockerfile=folder/role/'Dockerfile';dockerfile.write_text('FROM '+base+'\nCOPY '+('src/ /app/src/' if role=='control' else 'public/ /app/public/')+'\n')
                ftp.put(str(dockerfile),stage+'/'+role+'/Dockerfile')
                manifest['roles'][role]={'base':base,'hashes':{p:sha((folder/role/p).read_bytes()) for p in patches[role]}}
            # Isolated tests exercise candidate modules with no live credentials.
            ftp.mkdir(stage+'/tests',0o755)
            for name in ['scenario-health-standard.test.js','synthetic-health.test.js','entra-oidc-auth.test.js']:
                ftp.put(str(ROOT/'test'/name),stage+'/tests/'+name);ftp.chmod(stage+'/tests/'+name,0o444)
            # Node test imports ../src and ../public from /app/test.
            ftp.chmod(stage,0o755)
        (folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
        return {'folder':str(folder),'stage':stage,'baseline':baseline['containers'][:2]}
    finally:client.close()

def operation(folder,phase):
    folder=folder.resolve();assert folder.is_relative_to(ROOT/'artifacts/azure')
    manifest=json.loads((folder/'manifest.json').read_text());client=runtime.connect('CLOUD',None)
    try:
        program='MANIFEST='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+(ROOT/'scripts/scenario-health-remote.py').read_text()
        result=runtime.remote(client,'CLOUD',None,program,540 if phase=='build' else 300)
        if phase=='build':manifest['candidates']=result;(folder/'manifest.json').write_text(json.dumps(manifest,indent=2))
        (folder/(phase+'.json')).write_text(json.dumps(result,indent=2))
        return result
    finally:client.close()

def verify(folder):
    manifest=json.loads((folder/'manifest.json').read_text());checks=[]
    for name,digest in manifest['roles']['web']['hashes'].items():
        url=ORIGIN+('/hipass/' if name=='public/index.html' else '/'+name.removeprefix('public/'))
        with urllib.request.urlopen(urllib.request.Request(url,headers={'Cache-Control':'no-cache'}),timeout=25) as response:data=response.read()
        if name=='public/index.html':
            text=data.decode();assert '<summary>내 건강기록 확인</summary>' in text and 'PHR 새로고침' not in text
        else:assert sha(data)==digest,'SERVED_ASSET_MISMATCH'
        checks.append({'path':name,'status':'PASS'})
    for token in [None,'invalid.token.signature']:
        headers={} if token is None else {'Authorization':'Bearer '+token}
        try:response=urllib.request.urlopen(urllib.request.Request(ORIGIN+'/api/v1/me/health-records/standard',headers=headers),timeout=30)
        except urllib.error.HTTPError as error:response=error
        assert response.status==401,'UNAUTHENTICATED_RESPONSE';checks.append({'test':'missing' if token is None else 'tampered','status':'PASS','httpStatus':response.status})
    result={'checks':checks,'authenticatedBrowser':'NOT VERIFIED','review':'DRAFT / UNASSIGNED'}
    (folder/'verify.json').write_text(json.dumps(result,indent=2));return result
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['stage','build','deploy','rollback','verify']);parser.add_argument('--folder',type=pathlib.Path);args=parser.parse_args()
    print(json.dumps(stage() if args.phase=='stage' else verify(args.folder) if args.phase=='verify' else operation(args.folder,args.phase),ensure_ascii=True),flush=True)
