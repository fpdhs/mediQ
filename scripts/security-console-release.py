"""Overlay the audit console on the captured Azure release, preserving runtime configuration."""
import argparse
import base64
import json
import pathlib
import uuid
from importlib.util import module_from_spec, spec_from_file_location
ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = spec_from_file_location('console_release', ROOT/'scripts/security-observatory-release.py')
release = module_from_spec(spec); spec.loader.exec_module(release)

REMOTE = r'''
def guard():
 for expected in MANIFEST['baseline']:
  actual=inspect(expected['name'])
  assert actual['Id']==expected['id'] and actual['Image']==expected['image'] and actual['State']['Running'], 'CONSOLE_BASELINE_CHANGED'
 assert hashlib.sha256(pathlib.Path(MANIFEST['startupPath']).read_bytes()).hexdigest()==MANIFEST['startupBeforeHash'], 'WEB_STARTUP_CHANGED'
 assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId'], 'AUDIT_READER_CHANGED'
if PHASE=='build':
 guard();candidates={}
 for role,data in MANIFEST['roles'].items():
  source=folder/role
  for path,expected in data['hashes'].items():
   target=source/path;assert hashlib.sha256(target.read_bytes()).hexdigest()==expected;target.chmod(0o755)
   for parent in target.parents:
    if parent==folder:break
    parent.chmod(0o755)
  base='highpass-console-base:'+data['base'][7:23];run(['docker','tag',data['base'],base])
  (source/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY --chmod=755 '+p+' /app/'+p+'\n' for p in data['hashes']))
  tag='highpass-console-'+role+':'+MANIFEST['operation'];run(['docker','build','--network=none','--pull=false','-t',tag,str(source)],180)
  candidate=inspect(tag);original=inspect(data['base']);assert candidate['Config']==original['Config'];assert candidate['RootFS']['Layers'][:len(original['RootFS']['Layers'])]==original['RootFS']['Layers']
  candidates[role]=candidate['Id']
  for path in data['hashes']:
   if path.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',candidate['Id'],'--check','/app/'+path])
 folder.chmod(0o711)
 temp=run(['docker','create',candidates['web']]).decode().strip();public=folder/'test-public'
 try:run(['docker','cp',temp+':/app/public',str(public)])
 finally:run(['docker','rm',temp])
 run(['chmod','-R','a+rX',str(public),str(folder/'checks')])
 cmd=['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--tmpfs=/tmp:rw,nosuid,noexec,size=32m','-v',str(public)+':/app/public:ro']
 for path in MANIFEST['tests']+['scripts/test-support/isolated-server.js']:
  cmd+=['-v',str(folder/'checks'/path)+':/app/'+path+':ro']
 cmd+=['--entrypoint=/nodejs/bin/node',candidates['control'],'--test']+['/app/'+path for path in MANIFEST['tests']]
 output=run(cmd,120);(folder/'console-tests.log').write_bytes(output);(folder/'console-tests.log').chmod(0o600)
 result={'status':'PASS','candidates':candidates,'testsPassed':output.decode().splitlines()[-9:]};save(folder/'build.json',result);print(json.dumps(result))
elif PHASE=='deploy':
 guard();candidates=json.loads((folder/'build.json').read_text())['candidates'];before={role:inspect(name) for role,name in names.items()}
 for role,old in before.items():
  conf=config_for(old,'hp-public-web' if role=='web' else 'hp-capstone-control');save(folder/(role+'-before.json'),conf)
  conf=copy.deepcopy(conf);conf['services'][role]['image']=candidates[role];save(folder/(role+'-after.json'),conf)
 changed=[];startup=pathlib.Path(MANIFEST['startupPath']);startup_before=startup.read_bytes()
 try:
  changed.append('control');switch('control','after')
  startup.write_bytes(base64.b64decode(MANIFEST['startupAfter']))
  changed.append('web');switch('web','after')
  for role,old in before.items():
   live=inspect(names[role]);assert live['Image']==candidates[role];assert env_for(live)==env_for(old);assert live['Mounts']==old['Mounts'];assert live['NetworkSettings']['Networks'].keys()==old['NetworkSettings']['Networks'].keys()
   for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert live['HostConfig'][key]==old['HostConfig'][key]
  for expected in MANIFEST['baseline'][2:]:assert inspect(expected['name'])['Id']==expected['id']
  assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
 except Exception:
  startup.write_bytes(startup_before)
  for role in reversed(changed):switch(role,'before')
  raise
 print(json.dumps({'status':'PASS','images':candidates,'runtimeAndReaderPreserved':True,'recoveryConfigs':[str(folder/(role+'-before.json')) for role in names]}))
elif PHASE=='recover':
 startup=pathlib.Path(MANIFEST['startupPath'])
 assert hashlib.sha256(startup.read_bytes()).hexdigest() in [MANIFEST['startupBeforeHash'],MANIFEST['startupAfterHash']]
 startup.write_bytes(base64.b64decode(MANIFEST['startupBefore']));startup.chmod(0o644)
 expected={item['name']:item for item in MANIFEST['baseline']}
 for role in ['web','control']:
  restored=switch(role,'before');assert restored['Image']==expected[names[role]]['image']
 for item in MANIFEST['baseline'][2:]:assert inspect(item['name'])['Id']==item['id']
 assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
 containers=[]
 for item in MANIFEST['baseline']:
  live=inspect(item['name']);containers.append({'name':item['name'],'id':live['Id'],'image':live['Image'],'health':live['State'].get('Health',{}).get('Status')})
 print(json.dumps({'status':'PASS','containers':containers,'previousImagesRestored':True,'startupReadable':True}))
elif PHASE=='verify':
 images=json.loads((folder/'build.json').read_text())['candidates']
 for role,data in MANIFEST['roles'].items():
  assert inspect(names[role])['Image']==images[role]
  for path,expected in data['hashes'].items():
   code="const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))"
   assert run(['docker','exec',names[role],'/nodejs/bin/node','-e',code,'/app/'+path]).decode().strip()==expected
 assert hashlib.sha256(pathlib.Path(MANIFEST['startupPath']).read_bytes()).hexdigest()==MANIFEST['startupAfterHash']
 code="const a=await import('/app/src/azure-keyvault-audit.js');const r=await a.listAzureKeyVaultAudit();console.log(JSON.stringify({status:r.status,count:r.events.length,reason:r.reason}));"
 azure=json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','--input-type=module','-e',code],25))
 assert azure['status']=='available'
 for expected in MANIFEST['baseline'][2:]:assert inspect(expected['name'])['Id']==expected['id']
 assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
 print(json.dumps({'status':'PASS','sourceHashesVerified':True,'azureKeyVault':azure,'browserAuthorizedFlow':'NOT VERIFIED','rollbackRehearsal':'NOT VERIFIED'}))
'''

def prepare(folder):
    baseline=json.loads((folder/'baseline.json').read_text(encoding='utf8'))
    def captured(role,path): return (folder/'capture'/role/path).read_text(encoding='utf8').replace('\r\n','\n')
    def local(path): return (ROOT/path).read_text(encoding='utf8').replace('\r\n','\n')
    patches={'control':{},'web':{}}
    server=captured('control','src/server.js')
    anchor="import { toSecurityAuditView } from './security-observatory-view.js';"
    server=release.once(server,anchor,anchor+"\nimport { buildEventIndex, parseEventQuery, createSecurityReport } from './security-console.js';")
    start="  if ((method === 'GET' && url.pathname === '/api/security/events')"
    end='  if (method === "POST" && url.pathname === "/api/security/reviews") {'
    server=release.once(server,end,release.span(local('src/server.js'),start,end)+end)
    anchor='    const details = JSON.parse(String(log.reasonCode).slice(prefix.length));'
    server=release.once(server,anchor,anchor+'\n    if (!validateSecurityReviewInput(details)) return null;')
    patches['control']['src/server.js']=server.encode()
    patches['control']['src/security-console.js']=(ROOT/'src/security-console.js').read_bytes()
    app=captured('web','public/app.js');anchor="import {renderSecurityTimeline} from '/ui/security-timeline.js';"
    app=release.once(app,anchor,anchor+"\nimport {renderSecurityConsole} from '/ui/security-console.js';")
    start="  if (capstoneAuth?.roles?.some(role => ['SECURITY_ADMIN','PLATFORM_ADMIN'].includes(role))) {"
    end='  const setSource=(name,label,count,stateName)=>{'
    app=release.once(app,end,release.span(local('public/app.js'),start,end)+end)
    patches['web']['public/app.js']=app.encode()
    html=captured('web','public/index.html');html=release.once(html,'</head>','  <link rel="stylesheet" href="/ui/security-console.css">\n</head>')
    patches['web']['public/index.html']=html.encode()
    for path in ['public/ui/security-console.js','public/ui/security-console.css']:patches['web'][path]=(ROOT/path).read_bytes()
    startup=base64.b64decode(baseline['startup']).decode().replace('\r\n','\n')
    anchor="['GET',/^\\/api\\/security\\/overview$/],"
    startup=release.once(startup,anchor,anchor+"\n  ['GET',/^\\/api\\/security\\/events$/],\n  ['POST',/^\\/api\\/security\\/reports$/],")
    operation=uuid.uuid4().hex;remote='/opt/highpass/security-release-'+operation
    manifest={'operation':operation,'stage':remote,'baseline':baseline['containers'],'roles':{},'startupPath':baseline['startupPath'],
              'startupBeforeHash':release.digest(base64.b64decode(baseline['startup'])),'startupAfter':base64.b64encode(startup.encode()).decode(),'startupAfterHash':release.digest(startup.encode()),
              'tests':['test/security-console.test.js','test/security-observatory-http.test.js','test/security-observatory-view.test.js','test/azure-keyvault-audit.test.js']}
    client=release.runtime.connect('CLOUD',None)
    try:
        meta=release.runtime.remote(client,'CLOUD',None,"import pathlib,subprocess,json;pathlib.Path("+repr(remote)+").mkdir(mode=0o700);r=json.loads(subprocess.check_output(['docker','inspect','hp-security-audit-reader']))[0];print(json.dumps({'readerId':r['Id']}))")
        manifest.update(meta)
        with release.gateway.root_sftp(client,None) as sftp:
            def upload(source, destination):
                for parent in reversed(pathlib.PurePosixPath(destination).parents):
                    if str(parent) in ['/', '/opt', '/opt/highpass']: continue
                    try: sftp.stat(str(parent))
                    except FileNotFoundError: sftp.mkdir(str(parent), 0o700)
                sftp.put(str(source), destination); sftp.chmod(destination, 0o600)
            for role,files in patches.items():
                manifest['roles'][role]={'base':baseline['containers'][0 if role=='control' else 1]['image'],'hashes':{path:release.digest(body) for path,body in files.items()}}
                for path,body in files.items():
                    target=folder/'candidate'/role/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
                    upload(target,remote+'/'+role+'/'+path)
            for path in manifest['tests']+['scripts/test-support/isolated-server.js']:
                upload(ROOT/path,remote+'/checks/'+path)
        (folder/'console-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
        return {'status':'PASS','folder':str(folder),'stage':remote}
    finally:client.close()

def execute(folder,phase):
    manifest=json.loads((folder/'console-manifest.json').read_text(encoding='utf8'))
    manifest['startupBefore']=json.loads((folder/'baseline.json').read_text(encoding='utf8'))['startup']
    prefix=(ROOT/'scripts/security-observatory-remote.py').read_text(encoding='utf8').split("if PHASE == 'build':",1)[0]
    program='MANIFEST='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+prefix+'\n'+REMOTE
    client=release.runtime.connect('CLOUD',None)
    try:result=release.runtime.remote(client,'CLOUD',None,program,400 if phase=='build' else 240)
    finally:client.close()
    if phase=='recover':
        manifest['baseline']=result['containers']
        (folder/'console-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    if phase=='verify':
        checks=[]
        for path in ['public/ui/security-console.js','public/ui/security-console.css','public/app.js']:
            import urllib.request
            with urllib.request.urlopen(release.ORIGIN+'/'+path.removeprefix('public/'),timeout=20) as response:body=response.read()
            assert release.digest(body)==manifest['roles']['web']['hashes'][path]
            checks.append({'path':path,'status':'PASS'})
        import urllib.error
        for path,method in [('/api/security/events','GET'),('/api/security/reports','POST')]:
            for token in [None,'invalid.token.signature']:
                headers={'Origin':release.ORIGIN,'Content-Type':'application/json','x-hipass-role':'SECURITY_ADMIN'}
                if token:headers['Authorization']='Bearer '+token
                request=urllib.request.Request(release.ORIGIN+path,headers=headers,method=method,data=b'{}' if method=='POST' else None)
                try:response=urllib.request.urlopen(request,timeout=15)
                except urllib.error.HTTPError as error:response=error
                with response:
                    body=json.loads(response.read(16384));assert response.status==401 and body.get('error')!='PUBLIC_ROUTE_NOT_ENABLED'
                checks.append({'path':path,'auth':'invalid' if token else 'anonymous+spoofed-role','status':'PASS'})
        for path in ['/hipass/','/mobile/']:
            with urllib.request.urlopen(release.ORIGIN+path,timeout=15) as response:assert response.status==200
            checks.append({'path':path,'status':'PASS'})
        result['publicChecks']=checks
    (folder/('console-'+phase+'.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
    return result

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','build','deploy','verify','recover']);parser.add_argument('--folder',required=True);args=parser.parse_args()
    folder=release.checked_folder(args.folder)
    print(json.dumps(prepare(folder) if args.phase=='prepare' else execute(folder,args.phase)))
