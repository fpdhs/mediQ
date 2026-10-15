"""UI-only B rollout. Reuses image-only preflight, strict TLS and rollback rehearsal."""
import argparse,getpass,hashlib,importlib.util,json,pathlib,re,subprocess,time
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('align',ROOT/'scripts/health-helper-align.py')
align=importlib.util.module_from_spec(spec);spec.loader.exec_module(align)
FILES=['public/app.js','public/index.html','public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','public/ui/wallet-home.js','public/ui/wallet-home.css','public/ui/patient-health.js','public/ui/patient-sharing.js','public/images/mediq-wallet-front-v1.webp']
FILES+=['public/ui/wallet-open.css','public/images/mediq-wallet-leather-v1.webp']
FILES+=['public/ui/wallet-bifold.css','public/images/mediq-wallet-bifold-v1.webp']
FILES+=['public/ui/wallet-record-sheet.css']
FILES+=['public/ui/sharing-wallet-v2.css']
FILES+=['public/images/mediq-wallet-model-'+name+'.webp' for name in ['back','front','mobile-back','mobile-front']]
def run(args,timeout=60):return subprocess.run(args,cwd=ROOT,capture_output=True,check=True,timeout=timeout).stdout
def main():
 p=argparse.ArgumentParser();modes=p.add_mutually_exclusive_group();modes.add_argument('--apply',action='store_true');modes.add_argument('--inventory-only',action='store_true');modes.add_argument('--verify-local-only',action='store_true');p.add_argument('--expected-base');p.add_argument('--scan-result');p.add_argument('--image');p.add_argument('--credential-gui',action='store_true',help='Local masked B VM password input');args=p.parse_args()
 if args.inventory_only:
  if args.apply:p.error('--inventory-only cannot be combined with --apply')
  password=align.check.read_vm_credential(args.credential_gui);client=align.check.connect('B',password)
  try:
   baseline=align.check.inventory(client,'B',password)
   folder=ROOT/'artifacts/workstation'/('wallet-inventory-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
   (folder/'baseline.json').write_text(json.dumps(baseline,indent=2))
   print(json.dumps({'scope':'B_READ_ONLY_INVENTORY','review':'DRAFT / UNASSIGNED','image':baseline[0]['image'],'health':baseline[0]['health'],'evidence':str(folder/'baseline.json')}))
  finally:client.close()
  return
 if not all([args.expected_base,args.scan_result,args.image]):p.error('--expected-base, --scan-result and --image are required; old defaults are not reused')
 assert re.fullmatch(r'sha256:[a-f0-9]{64}',args.expected_base)
 image=args.image;candidate=run(['docker','image','inspect',image,'--format','{{.Id}}']).decode().strip()
 assert re.fullmatch(r'sha256:[a-f0-9]{64}',candidate)
 scan_path=(ROOT/args.scan_result).resolve();assert scan_path.is_relative_to((ROOT/'artifacts/security/container-scan').resolve()),'SCAN_PATH_OUTSIDE_EVIDENCE'
 scan=json.loads(scan_path.read_text())
 assert scan['Metadata']['ImageID']==candidate and isinstance(scan.get('Results'),list)
 assert (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()<86400
 assert not any(v['Severity'] in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[]))
 js="const fs=require('node:fs'),c=require('node:crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/'+f)).digest('hex')]))))"
 actual=json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',candidate,'-e',js,json.dumps(FILES)]))
 assert actual=={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES}
 assert all((ROOT/f).stat().st_size<=2097152 for f in FILES),'STATIC_ASSET_SIZE_LIMIT'
 if args.verify_local_only:
  print(json.dumps({'scope':'LOCAL_CANDIDATE_ASSETS_AND_SCAN_ONLY','status':'PASS','candidate':candidate,'sourceHashes':actual,'review':'DRAFT / UNASSIGNED','deployed':False}))
  return
 password=align.check.read_vm_credential(args.credential_gui);client=align.check.connect('B',password)
 stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');folder=ROOT/'artifacts/workstation'/('wallet-ui-'+stamp);folder.mkdir(parents=True,exist_ok=False)
 try:
  baseline=align.check.inventory(client,'B',password)
  assert baseline[0]['image']==args.expected_base,'BASELINE_CHANGED'
  # All server and reused UI module bytes must remain exactly those in the deployed image.
  unchanged=['src/capstone-b-portal.js','src/server.js','src/data-plane-gateway.js','public/ui/patient-library.js','public/ui/patient.js','public/ui/health-record-client.js','public/ui/patient-helper.js']
  def hashes(im):return json.loads(run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',im,'-e',js,json.dumps(unchanged)]))
  # Compare the observed running container, not a local tag overwritten by a rebuild.
  observed=align.check.remote(client,'B',password,'import json,subprocess;id='+repr(baseline[0]['id'])+';assert json.loads(subprocess.check_output(["docker","inspect",id],timeout=10))[0]["Image"]=='+repr(baseline[0]['image'])+';print(subprocess.check_output(["docker","exec",id,"/nodejs/bin/node","-e",'+repr(js)+','+repr(json.dumps(unchanged))+'],timeout=15).decode())',25)
  assert observed==hashes(candidate),'NON_UI_BYTES_CHANGED'
  ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
  preflight=align.check.remote(client,'B',password,align.remote_program('B',baseline,candidate,ca,False),90)
  assert preflight['status']=='PASS'
  (folder/'baseline.json').write_text(json.dumps(baseline,indent=2));(folder/'preflight.json').write_text(json.dumps(preflight,indent=2))
  print(json.dumps({'phase':'PREFLIGHT','status':'PASS'}),flush=True)
  result=preflight
  if args.apply:
   archive=folder/'candidate.tar';run(['docker','save','-o',str(archive),image],180);digest=hashlib.sha256(archive.read_bytes()).hexdigest()
   remote='/home/server/.wallet-image-'+stamp+'.tar'
   with client.open_sftp() as sftp:
    sftp.get_channel().settimeout(20);started=time.monotonic()
    def deadline(done,total):
     if time.monotonic()-started>240:raise TimeoutError('TRANSFER_TIMEOUT')
    sftp.put(str(archive),remote,callback=deadline);sftp.chmod(remote,0o600)
   align.check.remote(client,'B',password,'import hashlib,pathlib,subprocess,json;p=pathlib.Path('+repr(remote)+');assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(digest)+';subprocess.run(["docker","load","-i",str(p)],check=True,capture_output=True,timeout=90);print(json.dumps({"status":"PASS"}))',100)
   print(json.dumps({'phase':'IMAGE_TRANSFER','status':'PASS'}),flush=True)
   result=align.check.remote(client,'B',password,align.remote_program('B',baseline,candidate,ca,True),260)
  result.update(sourceHashes=actual,observedAt=datetime.now(timezone.utc).isoformat(),scope='B_PATIENT_WALLET_UI_ONLY',review='DRAFT / UNASSIGNED')
  (folder/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps({'evidence':str(folder/'result.json'),'status':result['status'],'candidate':candidate,'rollback':result['rollback']}))
  if result['status']!='PASS':raise SystemExit(2)
 finally:client.close()
if __name__=='__main__':main()
