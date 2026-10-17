"""Deploy isolated Entra-authenticated synthetic single-import verification page."""
import base64
import json
import pathlib
import re
import shlex
import uuid
import importlib.util
import argparse

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('single_rollout',ROOT/'scripts/a-b-import-rollout.py')
rollout=importlib.util.module_from_spec(spec);spec.loader.exec_module(rollout)

B_CONFIG=r'''
import json,pathlib,subprocess,time
release=pathlib.Path('/opt/highpass/single-import-e0ce3b14a8364ec98a25f5890d695e33-b')
config=json.loads((release/'after.json').read_text())
c=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1']))[0]
if c['Image']!='sha256:22a59a3af6b117fb20d48b96dcfa9bbcfc39c3bed8df892fe3ceb3c7a0019699':raise RuntimeError('B_IMPORT_BASELINE_CHANGED')
config['services']['portal']['environment']['CAPSTONE_B_IMPORT_BROWSER_ORIGIN']='https://highpass-demo.japaneast.cloudapp.azure.com'
target=release/('browser-origin-'+request['operation']+'.json')
with target.open('x') as f:json.dump(config,f)
target.chmod(0o600)
cmd=['docker','compose','-p','hp-capstone-b-portal','-f']
try:
 subprocess.run(cmd+[str(target),'up','-d','--no-deps','--pull','never','portal'],capture_output=True,check=True,timeout=90)
 deadline=time.monotonic()+60
 while True:
  live=json.loads(subprocess.check_output(['docker','inspect',c['Name']]))[0]
  if live['State'].get('Health',{}).get('Status')=='healthy':break
  if time.monotonic()>deadline:raise RuntimeError('B_IMPORT_ORIGIN_HEALTH_FAILED')
  time.sleep(2)
 if live['Image']!=c['Image'] or live['HostConfig']['PortBindings']!=c['HostConfig']['PortBindings']:raise RuntimeError('B_IMPORT_ORIGIN_SECURITY_DRIFT')
except Exception:
 subprocess.run(cmd+[str(release/'after.json'),'up','-d','--no-deps','--pull','never','portal'],capture_output=True,check=True,timeout=90);raise
print(json.dumps({'status':'PASS','configuration':str(target),'imageUnchanged':True,'health':'healthy'}))
'''

def execute(client,password,guest,request,program):
    with rollout.gateway.root_sftp(client,password) as sftp:
        with sftp.open(guest,'wx') as stream:stream.write('import sys,json\nrequest=json.load(sys.stdin)\n'+program)
        sftp.chown(guest,0,0);sftp.chmod(guest,0o600)
    stdin,stdout,stderr=client.exec_command(("sudo -S -p '' " if password else 'sudo -n ')+'timeout 240s python3 '+shlex.quote(guest),timeout=10)
    stdout.channel.settimeout(250)
    if password:stdin.write(password+'\n');stdin.flush()
    stdin.write(json.dumps(request));stdin.flush();stdin.channel.shutdown_write()
    body=stdout.read(65537);code=stdout.channel.recv_exit_status()
    if code:
        reasons=re.findall(r'RuntimeError: ([A-Z0-9_]+)',stderr.read(8192).decode('utf8','replace'))
        raise RuntimeError(reasons[-1] if reasons else 'CHECK_PAGE_DEPLOY_FAILED')
    return json.loads(body)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--cloud-only',action='store_true');parser.add_argument('--page-only',action='store_true');args=parser.parse_args()
    operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('single-import-check-deploy-'+operation);folder.mkdir(parents=True)
    result={'status':'NOT VERIFIED','operation':operation,'checks':[]};password=None
    try:
        if not args.cloud_only and not args.page_only:
            password=rollout.inventory.check.read_vm_credential(gui=True)
            client=rollout.inventory.check.connect('B',password)
            try:result['checks'].append(execute(client,password,'/opt/highpass/import-browser-origin-'+operation+'.py',{'operation':operation},B_CONFIG))
            finally:client.close();password=None
        client=rollout.inventory.check.connect('CLOUD',None)
        try:
            snapshot=rollout.inventory.check.remote(client,'CLOUD',None,"import json,subprocess;c=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-control-control-1']))[0];print(json.dumps({'name':c['Name'],'imageId':c['Image']}))")
            request={'role':'CLOUD','operation':operation,'name':snapshot['name'],'baselineImage':snapshot['imageId'],'baselineHashes':{},
                     'release':'/opt/highpass/single-import-origin-'+operation,
                     'files':{'src/patient-public-origins.js':base64.b64encode((ROOT/'src/patient-public-origins.js').read_bytes()).decode()}}
            if not args.page_only:result['checks'].append(execute(client,None,request['release']+'-guest.py',request,rollout.GUEST))
            snapshot=rollout.inventory.check.remote(client,'CLOUD',None,"import json,subprocess;c=json.loads(subprocess.check_output(['docker','inspect','hp-public-web-web-1']))[0];print(json.dumps({'name':c['Name'],'imageId':c['Image']}))")
            request={'role':'WEB','operation':operation,'name':snapshot['name'],'baselineImage':snapshot['imageId'],'baselineHashes':{},
                     'release':'/opt/highpass/single-import-check-'+operation,
                     'files':{file:base64.b64encode((ROOT/file).read_bytes()).decode() for file in ['public/single-import-check.html','public/single-import-check.js','public/login-navigation.js']}}
            # Reuse the current public image and readonly startup-script bind. No auth/ingress changes.
            program=rollout.GUEST.replace("!scripts/**\\n')","!scripts/**\\n!public/\\n!public/**\\n')")
            result['checks'].append(execute(client,None,request['release']+'-guest.py',request,program))
        finally:client.close()
        result['status']='PASS'
    except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__)
    finally:password=None
    result['url']='https://highpass-demo.japaneast.cloudapp.azure.com/single-import-check.html'
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
