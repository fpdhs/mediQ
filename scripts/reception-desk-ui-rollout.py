"""Overlay only reception UI assets on the current Azure/B portal images."""
import argparse
import base64
import hashlib
import importlib.util
import json
import pathlib
import re
import uuid

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('reception_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
FILES=['public/ui/clinician-reception-desk.js','public/ui/clinician-reception.css','public/assets/reception/medical-share-card-v1.webp']

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cloud-only',action='store_true')
    parser.add_argument('--b-only',action='store_true')
    parser.add_argument('--viewer-focus',action='store_true',help='Deploy only the existing viewer/preparation presentation modules')
    args=parser.parse_args()
    files_to_deploy=['public/ui/viewer-studio.js','public/ui/viewer-studio.css','public/ui/clinician-preparation.css'] if args.viewer_focus else FILES
    if args.cloud_only and args.b_only:parser.error('Choose one target flag')
    operation=uuid.uuid4().hex
    folder=ROOT/'artifacts/workstation'/('reception-desk-ui-'+operation);folder.mkdir(parents=True)
    result={'status':'NOT VERIFIED','operation':operation,'checks':[],'newAzureResources':False}
    password=None
    try:
        targets=[]
        if not args.b_only:targets.append(('CLOUD','WEB','hp-public-web-web-1'))
        if not args.cloud_only:targets.append(('B','B_UI','hp-capstone-b-portal-portal-1'))
        for host,role,name in targets:
            if host=='B':password=deploy.rollout.inventory.check.read_vm_credential(gui=True)
            client=deploy.rollout.inventory.check.connect(host,password)
            try:
                program="import json,subprocess,hashlib; c=json.loads(subprocess.check_output(['docker','inspect',"+repr(name)+"]))[0]; hashes={}\n"
                program+="for file in "+repr(files_to_deploy if args.viewer_focus else FILES[:2])+":\n body=subprocess.check_output(['docker','exec',c['Id'],'/nodejs/bin/node','-e',\"process.stdout.write(require('fs').readFileSync(process.argv[1]))\",'/app/'+file]);hashes[file]=hashlib.sha256(body).hexdigest()\n"
                program+="print(json.dumps({'name':c['Name'],'imageId':c['Image'],'hashes':hashes}))"
                snapshot=deploy.rollout.inventory.check.remote(client,host,password,program)
                request={'role':role,'operation':operation,'name':snapshot['name'],'baselineImage':snapshot['imageId'],'baselineHashes':snapshot['hashes'],
                    'release':'/opt/highpass/reception-ui-'+operation+'-'+role.lower(),
                    'files':{file:base64.b64encode((ROOT/file).read_bytes()).decode() for file in files_to_deploy}}
                guest=deploy.rollout.GUEST.replace("!scripts/**\\n')","!scripts/**\\n!public/\\n!public/**\\n')")
                check=deploy.execute(client,password,request['release']+'-guest.py',request,guest)
                verify="import json,subprocess,hashlib; hashes={}\n"
                verify+="for file in "+repr(files_to_deploy)+":\n body=subprocess.check_output(['docker','exec',"+repr(name)+",'/nodejs/bin/node','-e',\"process.stdout.write(require('fs').readFileSync(process.argv[1]))\",'/app/'+file]);hashes[file]=hashlib.sha256(body).hexdigest()\n"
                verify+="print(json.dumps({'hashes':hashes}))"
                actual=deploy.rollout.inventory.check.remote(client,host,password,verify)
                expected={file:hashlib.sha256((ROOT/file).read_bytes()).hexdigest() for file in files_to_deploy}
                if actual['hashes']!=expected:raise RuntimeError('RECEPTION_ASSET_HASH_MISMATCH')
                result['checks'].append({**check,'assetHashes':expected,'assetsMatchLocal':True})
                print(json.dumps({'role':role,'status':'PASS','assetsMatchLocal':True}),flush=True)
            finally:client.close();password=None
        result['status']='PASS'
    except BaseException as error:
        result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__)
    finally:password=None
    result['url']='https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR'
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
