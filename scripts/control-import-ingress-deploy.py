"""Add the exact import-authorize service path to the existing private ingress."""
import base64,json,pathlib,uuid,importlib.util
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ingress_page_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

def main():
 operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('control-import-ingress-'+operation);folder.mkdir(parents=True)
 result={'status':'NOT VERIFIED','operation':operation}
 client=deploy.rollout.inventory.check.connect('CLOUD',None)
 try:
  js="const fs=require('fs');console.log(fs.readFileSync('/app/src/key-release-http-handler.js').toString('base64'))"
  program='import subprocess,json\nc=json.loads(subprocess.check_output(["docker","inspect","hp-capstone-control-ingress-1"]))[0]\ns=subprocess.check_output('+repr(['docker','exec','hp-capstone-control-ingress-1','/nodejs/bin/node','-e',js])+').decode().strip()\nprint(json.dumps({"image":c["Image"],"source":s}))'
  current=deploy.rollout.inventory.check.remote(client,'CLOUD',None,program)
  original=base64.b64decode(current['source']).decode('utf8')
  needle='"/gateway/data-plane/package/wrap-authorize"]'
  if original.count(needle)!=1 or '/import-authorize' in original:raise RuntimeError('PRIVATE_INGRESS_SOURCE_BASELINE_REQUIRED')
  patched=original.replace(needle,'"/gateway/data-plane/package/wrap-authorize", "/gateway/data-plane/package/import-authorize"]',1)
  request={'role':'CONTROL_INGRESS','operation':operation,'name':'hp-capstone-control-ingress-1','baselineImage':current['image'],
    'baselineHashes':{'src/key-release-http-handler.js':__import__('hashlib').sha256(base64.b64decode(current['source'])).hexdigest()},
    'release':'/opt/highpass/control-import-ingress-'+operation,
    'files':{'src/key-release-http-handler.js':base64.b64encode(patched.encode()).decode()}}
  result.update(deploy.execute(client,None,request['release']+'-guest.py',request,deploy.rollout.GUEST))
 except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
 finally:client.close()
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
 return 0 if result['status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
