"""Masked pinned B session: inspect safely, then deploy job-bound PACS receiving."""
import argparse,base64,hashlib,importlib.util,json,pathlib,re,sys,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_store_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
READ=r'''
import json,subprocess,pathlib,base64,hashlib
c=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1']))[0]
files={}
for file in ['src/capstone-b-portal.js','src/capstone-encrypted-transfer.js']:
 p=subprocess.run(['docker','exec',c['Id'],'/nodejs/bin/node','-e',"process.stdout.write(require('fs').readFileSync(process.argv[1]))",'/app/'+file],capture_output=True,timeout=10)
 if p.returncode:raise RuntimeError('B_PACS_SOURCE_UNAVAILABLE')
 files[file]={'sha256':hashlib.sha256(p.stdout).hexdigest(),'source':base64.b64encode(p.stdout).decode()}
entry=pathlib.Path('/opt/highpass/patient-public-entry');config=(entry/'Caddyfile').read_bytes()
log=subprocess.run(['docker','logs','--since','90m','--tail','200',c['Id']],capture_output=True,text=True,timeout=10)
metrics=[]
for line in (log.stdout+'\n'+log.stderr).splitlines():
 try:value=json.loads(line)
 except:continue
 if value.get('event')=='CAPSTONE_RUNTIME_DIAGNOSTIC':metrics.append({key:value.get(key) for key in ['stage','httpStatus','code','elapsedMs']})
print(json.dumps({'name':c['Name'],'imageId':c['Image'],'files':files,'caddy':base64.b64encode(config).decode(),'caddyHash':hashlib.sha256(config).hexdigest(),'metrics':metrics[-20:]}))
'''
def main():
 args=argparse.ArgumentParser();args.add_argument('--candidate');options=args.parse_args()
 operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('pacs-store-b-'+operation);folder.mkdir(parents=True)
 password=deploy.rollout.inventory.check.read_vm_credential(gui=True);client=deploy.rollout.inventory.check.connect('B',password)
 snapshot=None
 try:
  print(json.dumps({'status':'B_SESSION_READY','operation':operation}),flush=True)
  for command in sys.stdin:
   command=command.strip()
   if command=='close':break
   try:
    if command=='read':
     snapshot=deploy.rollout.inventory.check.remote(client,'B',password,READ,45)
     (folder/'snapshot.json').write_text(json.dumps(snapshot,indent=2),encoding='utf8')
     (folder/'Caddyfile.before').write_bytes(base64.b64decode(snapshot['caddy']))
     print(json.dumps({'status':'PASS','phase':'read','imageId':snapshot['imageId'],'metrics':snapshot['metrics'],'evidence':str(folder)}),flush=True)
    elif command=='portal':
     if not snapshot:raise RuntimeError('B_SNAPSHOT_REQUIRED')
     files={file:base64.b64encode((ROOT/file).read_bytes()).decode() for file in snapshot['files']}
     request={'role':'B_UI','operation':operation,'name':snapshot['name'],'baselineImage':snapshot['imageId'],
      'baselineHashes':{file:info['sha256'] for file,info in snapshot['files'].items()},
      'release':'/opt/highpass/pacs-job-receiver-'+operation,'files':files}
     result=deploy.execute(client,password,request['release']+'-guest.py',request,deploy.rollout.GUEST)
     (folder/'portal.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result),flush=True)
    elif command=='edge':
     if not snapshot:raise RuntimeError('B_SNAPSHOT_REQUIRED')
     candidate=(pathlib.Path(options.candidate) if options.candidate else folder/'Caddyfile.after').read_bytes()
     program=(ROOT/'scripts/pacs-store-b-edge-guest.py').read_text(encoding='utf8')
     result=deploy.execute(client,password,'/opt/highpass/pacs-job-edge-'+uuid.uuid4().hex+'.py',{'operation':operation,'baselineHash':snapshot['caddyHash'],'candidate':base64.b64encode(candidate).decode()},program)
     (folder/'edge.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps(result),flush=True)
    else:raise RuntimeError('B_SESSION_COMMAND_INVALID')
   except Exception as error:print(json.dumps({'status':'FAIL','reason':str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__}),flush=True)
 finally:client.close();password=None
if __name__=='__main__':main()
