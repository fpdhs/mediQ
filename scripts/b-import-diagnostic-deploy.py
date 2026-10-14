"""B-only fixed-code import diagnostic overlay; no secret or policy changes."""
import base64,json,pathlib,uuid,importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('page_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

def main():
 operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('b-import-diagnostic-'+operation);folder.mkdir(parents=True)
 result={'status':'NOT VERIFIED','operation':operation};password=None
 try:
  password=deploy.rollout.inventory.check.read_vm_credential(gui=True);client=deploy.rollout.inventory.check.connect('B',password)
  try:
   current=deploy.rollout.inventory.check.remote(client,'B',password,"import subprocess,json;c=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1']))[0];print(json.dumps({'image':c['Image']}))")
   request={'role':'B_DIAGNOSTIC','operation':operation,'name':'hp-capstone-b-portal-portal-1','baselineImage':current['image'],'baselineHashes':{},
    'release':'/opt/highpass/b-import-diagnostic-'+operation,'files':{'src/capstone-runtime-diagnostics.js':base64.b64encode((ROOT/'src/capstone-runtime-diagnostics.js').read_bytes()).decode()}}
   result.update(deploy.execute(client,password,request['release']+'-guest.py',request,deploy.rollout.GUEST))
  finally:client.close()
 except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
 finally:password=None
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
 return 0 if result['status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
