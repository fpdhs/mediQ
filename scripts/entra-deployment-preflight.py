"""Read-only pinned-host inventory for the Entra candidate. Never deploys."""
import argparse
import hashlib
import importlib.util
import json
import time
from datetime import datetime, timezone

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

FILES = ['scripts/start-capstone-control.js','src/capstone-control-runtime-config.js',
         'src/capstone-patient-runtime-config.js','src/server.js','src/auth.js',
         'scripts/start-capstone-b-portal.js','src/capstone-b-portal.js',
         'public/capstone-auth.js','public/entra-auth.js','public/entra-redirect.html',
         'public/vendor/msal-browser.js','public/vendor/entra-redirect.js']

def inventory(runtime, role, password):
    client = runtime.connect(role, password)
    try:
        names = ['hp-capstone-b-portal-portal-1'] if role == 'B' else ['hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
        return runtime.remote(client, role, password, '''import subprocess,json
items=json.loads(subprocess.check_output(['docker','inspect',*''' + repr(names) + '''],timeout=12));out=[]
for item in items:
 env=dict(x.split('=',1) for x in item['Config']['Env'] if '=' in x)
 hashes={}
 if not item['Name'].endswith('postgres-1'):
  code="const fs=require('node:fs'),c=require('node:crypto');const o={};for(const p of JSON.parse(process.argv[1])){try{o[p]=c.createHash('sha256').update(fs.readFileSync('/app/'+p)).digest('hex')}catch{o[p]=null}}console.log(JSON.stringify(o))"
  r=subprocess.run(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code,json.dumps(''' + repr(FILES) + ''')],capture_output=True,timeout=10)
  if r.returncode: raise RuntimeError('SOURCE_INVENTORY_FAILED')
  hashes=json.loads(r.stdout)
 entry=dict(name=item['Name'],image=item['Image'],running=item['State']['Running'],health=item['State'].get('Health',{}).get('Status'),
   sourceHashes=hashes,securityMode={k:env.get(k) for k in ['AUTH_MODE','HIPASS_CONTROL_PLANE_ONLY','HIPASS_DPOP_REQUIRED','HIPASS_CAPSTONE_MOCK_IDP','CAPSTONE_ENTRA_LOGIN_ENABLED']},
   networks=list(item['NetworkSettings']['Networks']),ports=item['HostConfig']['PortBindings'],composeFiles=item['Config']['Labels'].get('com.docker.compose.project.config_files'))
 if item['Name'].endswith('control-1'):
  code="fetch('https://login.microsoftonline.com/ad21525c-fc0f-4dbc-a403-67ce00add0e4/discovery/v2.0/keys',{signal:AbortSignal.timeout(5000)}).then(r=>{console.log(JSON.stringify({httpStatus:r.status}));process.exit(r.ok?0:2)}).catch(()=>{console.log(JSON.stringify({error:'JWKS_FETCH_FAILED'}));process.exit(2)})"
  r=subprocess.run(['docker','exec',item['Id'],'/nodejs/bin/node','-e',code],capture_output=True,timeout=8)
  entry['jwksEgress']=dict(exitCode=r.returncode,result=json.loads(r.stdout or b'{}'))
 out.append(entry)
print(json.dumps(out))''', 40)
    finally:
        client.close()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--include-b-gui', action='store_true')
    args = parser.parse_args()
    from pathlib import Path
    root = Path(__file__).resolve().parents[1]
    config = load('entra_preflight_config',root/'scripts/entra-web-config.py')
    runtime = load('entra_preflight_runtime',root/'scripts/health-helper-runtime-check.py')
    folder = config.protected_folder()
    started = time.monotonic()
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(),review='DRAFT / UNASSIGNED',scope='READ_ONLY_NO_DEPLOYMENT',hosts={})
    for role in (['CLOUD','B'] if args.include_b_gui else ['CLOUD']):
        password = None
        try:
            if role == 'B': password = runtime.read_vm_credential(gui=True)
            result['hosts'][role] = dict(status='PASS',containers=inventory(runtime,role,password))
        except (Exception,SystemExit) as error:
            result['hosts'][role] = dict(status='NOT VERIFIED',reason=type(error).__name__)
        finally:
            password = None
    result['localHashes']={p:hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else None for p in FILES}
    result['elapsedSeconds']=round(time.monotonic()-started,3)
    (folder/'preflight.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'preflight.json'),hosts={k:v['status'] for k,v in result['hosts'].items()},elapsedSeconds=result['elapsedSeconds'])))
    return 0 if all(h['status']=='PASS' for h in result['hosts'].values()) else 2

if __name__=='__main__': raise SystemExit(main())
