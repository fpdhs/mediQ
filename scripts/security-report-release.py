"""Publish the report renderer as a three-file Web overlay on the verified current Azure image."""
import argparse, base64, json, pathlib, uuid
from importlib.util import module_from_spec, spec_from_file_location
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=spec_from_file_location('report_release',ROOT/'scripts/security-observatory-release.py');release=module_from_spec(spec);spec.loader.exec_module(release)
PREVIOUS=ROOT/'artifacts/azure/entra-web-20261014T080422Z-f4fb35'
REMOTE=r'''
def guard():
 for item in MANIFEST['baseline']:
  live=inspect(item['name']);assert live['Id']==item['id'] and live['Image']==item['image'] and live['State']['Running'], 'REPORT_BASELINE_CHANGED'
 assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
if PHASE=='build':
 guard();source=folder/'web';data=MANIFEST['roles']['web']
 for path,expected in data['hashes'].items():
  target=source/path;assert hashlib.sha256(target.read_bytes()).hexdigest()==expected;target.chmod(0o755)
  for parent in target.parents:
   if parent==folder:break
   parent.chmod(0o755)
 base='highpass-report-base:'+data['base'][7:23];run(['docker','tag',data['base'],base])
 (source/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY --chmod=755 '+path+' /app/'+path+'\n' for path in data['hashes']))
 tag='highpass-report-web:'+MANIFEST['operation'];run(['docker','build','--network=none','--pull=false','-t',tag,str(source)],180)
 candidate=inspect(tag);original=inspect(data['base']);assert candidate['Config']==original['Config'];assert candidate['RootFS']['Layers'][:len(original['RootFS']['Layers'])]==original['RootFS']['Layers']
 for path in data['hashes']:
  if path.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',candidate['Id'],'--check','/app/'+path])
 folder.chmod(0o711);temp=run(['docker','create',candidate['Id']]).decode().strip();public=folder/('test-public-'+str(time.time_ns()))
 try:run(['docker','cp',temp+':/app/public',str(public)])
 finally:run(['docker','rm',temp])
 run(['chmod','-R','a+rX',str(public),str(folder/'checks')])
 cmd=['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--tmpfs=/tmp:rw,nosuid,noexec,size=32m','-v',str(public)+':/app/public:ro']
 for path in MANIFEST['tests']+['scripts/test-support/isolated-server.js']:cmd+=['-v',str(folder/'checks'/path)+':/app/'+path+':ro']
 cmd+=['--entrypoint=/nodejs/bin/node',MANIFEST['baseline'][0]['image'],'--test']+['/app/'+path for path in MANIFEST['tests']]
 output=run(cmd,90);(folder/'tests.log').write_bytes(output);(folder/'tests.log').chmod(0o600)
 result={'status':'PASS','webImage':candidate['Id'],'tests':output.decode().splitlines()[-8:]};save(folder/'build.json',result);print(json.dumps(result))
elif PHASE=='deploy':
 guard();old=inspect(names['web']);candidate=json.loads((folder/'build.json').read_text())['webImage']
 conf=config_for(old,'hp-public-web');save(folder/'web-before.json',conf);conf=copy.deepcopy(conf);conf['services']['web']['image']=candidate;save(folder/'web-after.json',conf)
 try:
  live=switch('web','after');assert live['Image']==candidate;assert env_for(live)==env_for(old);assert live['Mounts']==old['Mounts'];assert live['NetworkSettings']['Networks'].keys()==old['NetworkSettings']['Networks'].keys()
  for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert live['HostConfig'][key]==old['HostConfig'][key]
  for item in MANIFEST['baseline']:
   if item['name']!=names['web']:assert inspect(item['name'])['Id']==item['id']
  assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
 except Exception:
  switch('web','before');raise
 print(json.dumps({'status':'PASS','webImage':candidate,'controlAndReaderPreserved':True,'recoveryConfig':str(folder/'web-before.json')}))
elif PHASE=='verify':
 candidate=json.loads((folder/'build.json').read_text())['webImage'];assert inspect(names['web'])['Image']==candidate
 for path,expected in MANIFEST['roles']['web']['hashes'].items():
  code="const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))"
  assert run(['docker','exec',names['web'],'/nodejs/bin/node','-e',code,'/app/'+path]).decode().strip()==expected
 for item in MANIFEST['baseline']:
  if item['name']!=names['web']:assert inspect(item['name'])['Id']==item['id']
 assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']
 print(json.dumps({'status':'PASS','sourceHashes':'PASS','protectedContainers':'PASS','authenticatedAzurePrint':'NOT VERIFIED'}))
'''
def prepare(folder):
 baseline=json.loads((folder/'baseline.json').read_text(encoding='utf8'));previous=json.loads((PREVIOUS/'console-manifest.json').read_text(encoding='utf8'))
 path='public/ui/security-console.js';before=(PREVIOUS/'candidate/web'/path).read_bytes();assert release.digest(before)==previous['roles']['web']['hashes'][path]
 source=before.decode().replace('\r\n','\n');local=(ROOT/path).read_text(encoding='utf8').replace('\r\n','\n')
 source="import { showSecurityReport } from './security-report.js';\n"+source
 start,end='function printReport(report){','export function renderSecurityConsole('
 source=release.once(source,release.span(source,start,end),release.span(local,start,end))
 files={path:source.encode(),**{p:(ROOT/p).read_bytes() for p in ['public/ui/security-report.js','public/ui/security-report.css']}}
 operation=uuid.uuid4().hex;remote='/opt/highpass/security-release-'+operation;manifest={'stage':remote,'operation':operation,'baseline':baseline['containers'],'roles':{'web':{'base':baseline['containers'][1]['image'],'hashes':{p:release.digest(b) for p,b in files.items()}}},'tests':['test/security-report.test.js','test/security-console.test.js']}
 client=release.runtime.connect('CLOUD',None)
 try:
  code="import pathlib,subprocess,json,hashlib;p=subprocess.check_output(['docker','exec','hp-public-web-web-1','/nodejs/bin/node','-e',\"process.stdout.write(require('fs').readFileSync('/app/public/ui/security-console.js'))\"]);assert hashlib.sha256(p).hexdigest()=="+repr(release.digest(before))+";pathlib.Path("+repr(remote)+").mkdir(mode=0o700);r=json.loads(subprocess.check_output(['docker','inspect','hp-security-audit-reader']))[0];print(json.dumps({'readerId':r['Id']}))"
  manifest.update(release.runtime.remote(client,'CLOUD',None,code))
  with release.gateway.root_sftp(client,None) as sftp:
   def upload(source,target):
    for parent in reversed(pathlib.PurePosixPath(target).parents):
     if str(parent) in ['/','/opt','/opt/highpass']:continue
     try:sftp.stat(str(parent))
     except FileNotFoundError:sftp.mkdir(str(parent),0o700)
    sftp.put(str(source),target);sftp.chmod(target,0o600)
   for path,body in files.items():
    target=folder/'report-candidate'/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body);upload(target,remote+'/web/'+path)
   for path in manifest['tests']+['scripts/test-support/isolated-server.js']:upload(ROOT/path,remote+'/checks/'+path)
  (folder/'report-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8');return {'status':'PASS','folder':str(folder),'changedWebFiles':list(files)}
 finally:client.close()
def execute(folder,phase):
 manifest=json.loads((folder/'report-manifest.json').read_text(encoding='utf8'));prefix=(ROOT/'scripts/security-observatory-remote.py').read_text(encoding='utf8').split("if PHASE == 'build':",1)[0]
 program='MANIFEST='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+prefix+'\n'+REMOTE;client=release.runtime.connect('CLOUD',None)
 try:result=release.runtime.remote(client,'CLOUD',None,program,300 if phase=='build' else 150)
 finally:client.close()
 if phase=='verify':
  import urllib.request
  checks=[]
  for path,expected in manifest['roles']['web']['hashes'].items():
   with urllib.request.urlopen(release.ORIGIN+'/'+path.removeprefix('public/'),timeout=15) as response:assert release.digest(response.read())==expected
   checks.append({'path':path,'status':'PASS'})
  for path in ['/hipass/','/mobile/']:
   with urllib.request.urlopen(release.ORIGIN+path,timeout=15) as response:assert response.status==200
  result['publicHashes']=checks
 (folder/('report-'+phase+'.json')).write_text(json.dumps(result,indent=2),encoding='utf8');return result
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=['prepare','build','deploy','verify']);parser.add_argument('--folder',required=True);args=parser.parse_args();folder=release.checked_folder(args.folder)
 print(json.dumps(prepare(folder) if args.phase=='prepare' else execute(folder,args.phase)))
