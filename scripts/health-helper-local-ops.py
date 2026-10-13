"""Pinned SSH preparation and safe inventory for local visit helper."""
import argparse,getpass,importlib.util,json,pathlib
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
p=argparse.ArgumentParser();p.add_argument('--prepare',action='store_true');p.add_argument('--socket-ready',action='store_true');p.add_argument('--inventory',action='store_true');p.add_argument('--audit',action='store_true');args=p.parse_args()
c=check.connect('CLOUD',None)
try:
 if args.prepare:
  print(check.remote(c,'CLOUD',None,"""import pathlib,os,pwd,json
p=pathlib.Path('/home/highpassadmin/.highpass-helper');assert not p.is_symlink()
p.mkdir(mode=0o750,exist_ok=True);os.chown(p,pwd.getpwnam('highpassadmin').pw_uid,65532);os.chmod(p,0o750)
assert not (p/'ollama.sock').exists();print(json.dumps({'status':'PASS','directory':str(p)}))"""))
 if args.socket_ready:
  print(check.remote(c,'CLOUD',None,"""import pathlib,os,stat,json
p=pathlib.Path('/home/highpassadmin/.highpass-helper/ollama.sock');assert stat.S_ISSOCK(p.stat().st_mode);assert not p.is_symlink()
os.chown(p,p.stat().st_uid,65532);os.chmod(p,0o660);print(json.dumps({'status':'PASS','mode':oct(p.stat().st_mode & 0o777)}))"""))
 if args.inventory:
  out={'CLOUD':check.inventory(c,'CLOUD',None),'review':'DRAFT / UNASSIGNED','observedAt':datetime.now(timezone.utc).isoformat()}
 if args.audit:
  sql="BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(json_agg(t),'[]') FROM (SELECT audit_session_id,action,result,reason_code,created_at,(record_hash IS NOT NULL) AS hashed FROM audit_logs WHERE action='HEALTH_HELPER_REQUEST' ORDER BY created_at DESC LIMIT 20) t; ROLLBACK;"
  result=check.remote(c,'CLOUD',None,'import subprocess,json; r=subprocess.run(["docker","exec","hp-capstone-control-postgres-1","psql","-X","-qAt","-U","hipass_bootstrap","-d","hipass","-c",'+repr(sql)+'],capture_output=True,check=True,timeout=10); print(r.stdout.decode())')
  folder=ROOT/'artifacts/workstation'/('helper-qwen-audit-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
  (folder/'result.json').write_text(json.dumps({'observedAt':datetime.now(timezone.utc).isoformat(),'review':'DRAFT / UNASSIGNED','audit':result},indent=2));print(str(folder/'result.json'))
finally:c.close()
if args.inventory:
 password=getpass.getpass('VM credential (concealed): ');c=check.connect('B',password)
 try:out['B']=check.inventory(c,'B',password)
 finally:c.close()
 folder=ROOT/'artifacts/workstation'/('helper-qwen-baseline-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));folder.mkdir(parents=True,exist_ok=False)
 (folder/'result.json').write_text(json.dumps(out,indent=2));print(str(folder/'result.json'))
