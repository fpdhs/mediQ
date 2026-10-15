"""Masked B session: read/stage/apply/restore a narrow GET-only TLS route."""
import importlib.util,json,pathlib,queue,sys,threading
ROOT=pathlib.Path(__file__).resolve().parents[1]
FOLDER=ROOT/'artifacts/azure/clinician-image-entry-20261014'
PROGRAM=r'''
import json,pathlib,subprocess,hashlib
entry=pathlib.Path('/opt/highpass/patient-public-entry');folder=pathlib.Path('/opt/highpass/clinician-image-entry-20261014')
original=(entry/'Caddyfile').read_text()
if phase=='read':
 print(json.dumps({'config':original,'tlsServiceActive':subprocess.run(['systemctl','is-active','--quiet','hp-patient-public-tls.service']).returncode==0}))
elif phase=='stage':
 folder.mkdir(mode=0o700,exist_ok=False)
 (folder/'before.Caddyfile').write_text(original)
 candidate=original
 old='^/patient-dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances(/[0-9.]{1,64}/rendered)?$'
 new='^/(patient-dicomweb/studies/[0-9.]{1,64}/series/[0-9.]{1,64}/instances(/[0-9.]{1,64}/rendered)?|dicomweb/studies(/[0-9.]{1,64}/series(/[0-9.]{1,64}/instances(/[0-9.]{1,64}/rendered)?)?)?)$'
 assert candidate.count(old)==2,'TLS_BASELINE_CHANGED'
 candidate=candidate.replace(old,new)
 (folder/'after.Caddyfile').write_text(candidate)
 config=json.loads((entry/'compose.json').read_text());image=config['services']['tls']['image']
 ca=entry/'b-upstream-ca.crt';assert ca.is_file()
 command=['docker','run','--rm','--network=none','--read-only','--tmpfs','/tmp','-v',str(folder/'after.Caddyfile')+':/etc/caddy/Caddyfile:ro','-v',str(ca)+':/etc/caddy/b-ca.crt:ro',image,'caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']
 check=subprocess.run(command,capture_output=True,timeout=30)
 assert check.returncode==0,'TLS_VALIDATION_FAILED'
 print(json.dumps({'status':'PASS','candidate':candidate,'sha256':hashlib.sha256(candidate.encode()).hexdigest()}))
elif phase in ['apply','restore']:
 assert original==(folder/('before.Caddyfile' if phase=='apply' else 'after.Caddyfile')).read_text(),'TLS_CONCURRENT_CHANGE'
 (entry/'Caddyfile').write_text((folder/('after.Caddyfile' if phase=='apply' else 'before.Caddyfile')).read_text())
 check=subprocess.run(['systemctl','restart','hp-patient-public-tls.service'],capture_output=True,timeout=30)
 if check.returncode:
  (entry/'Caddyfile').write_text(original);subprocess.run(['systemctl','restart','hp-patient-public-tls.service'],capture_output=True,timeout=30);raise RuntimeError('TLS_ROLLED_BACK')
 assert subprocess.run(['systemctl','is-active','--quiet','hp-patient-public-tls.service']).returncode==0
 print(json.dumps({'status':'PASS','phase':phase}))
'''
def main():
 spec=importlib.util.spec_from_file_location('auth',ROOT/'scripts/deployment-auth-preflight.py');auth=importlib.util.module_from_spec(spec);spec.loader.exec_module(auth)
 password=auth.ask_password_gui()
 if not password:return
 client=auth.runtime.connect('B',password);FOLDER.mkdir(parents=True,exist_ok=True)
 try:
  print('{"status":"B_SESSION_READY"}',flush=True)
  for line in sys.stdin:
   phase=line.strip()
   if phase=='close':break
   if phase not in ['read','stage','apply','restore']:continue
   try:
    result=auth.runtime.remote(client,'B',password,'phase='+repr(phase)+'\n'+PROGRAM,45)
    (FOLDER/(phase+'.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(result),flush=True)
   except Exception as e:print(json.dumps({'status':'FAIL','kind':type(e).__name__}),flush=True)
 finally:client.close();password=None
if __name__=='__main__':main()
