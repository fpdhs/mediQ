"""Connect exactly one synthetic import URL through the existing B HTTPS entry."""
import importlib.util
import json
import pathlib
import uuid
import argparse
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('edge_check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)

PROGRAM=r"""
import json,pathlib,subprocess,time
entry=pathlib.Path('/opt/highpass/patient-public-entry')
ids=subprocess.check_output(['docker','ps','-q'],timeout=10).decode().splitlines()
containers=json.loads(subprocess.check_output(['docker','inspect',*ids],timeout=10))
peers=[(c,m) for c in containers for m in c['Mounts'] if m['Destination']=='/etc/caddy/Caddyfile' and pathlib.Path(m['Source']).resolve()==entry/'Caddyfile']
if len(peers)!=1:raise RuntimeError('ONE_PINNED_B_PUBLIC_ENTRY_REQUIRED')
container,mount=peers[0];path=pathlib.Path(mount['Source']);original=path.read_text()
if original.count('respond @query ')!=1 or ('@single_import_' in original and not request.get('corsFix')):raise RuntimeError('ENTRY_ROUTE_BASELINE_REQUIRED')
route='/dicomweb/studies/2.25.259656708708993797343330994179169711072/series/2.25.18361638789025095699746776899955737977/instances/2.25.41201726628454317744442406717668675255/import'
addition='''
  @single_import_preflight {
   method OPTIONS
   path ROUTE
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
   header Access-Control-Request-Method POST
   header_regexp Access-Control-Request-Headers ^(?i:authorization,\\s*dpop|dpop,\\s*authorization)$
  }
  handle @single_import_preflight {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   header Access-Control-Allow-Methods "POST"
   header Access-Control-Allow-Headers "authorization, dpop"
   header Access-Control-Max-Age "60"
   respond "" 204
  }
  @single_import_post {
   method POST
   path ROUTE
   header Origin https://highpass-demo.japaneast.cloudapp.azure.com
  }
  handle @single_import_post {
   header Access-Control-Allow-Origin "https://highpass-demo.japaneast.cloudapp.azure.com"
   reverse_proxy https://192.168.111.149:9443 {
    header_up -Cookie
    header_up -X-Hipass-Service-Token
    header_up -X-Hipass-Ingress-Signature
    header_up -X-Hipass-Ingress-Time
    header_down -Set-Cookie
    transport http {
     tls_trust_pool file /etc/caddy/b-ca.crt
     dial_timeout 5s
     response_header_timeout 60s
    }
   }
  }
'''.replace('ROUTE',route)
lines=original.splitlines(keepends=True);index=next(i for i,line in enumerate(lines) if 'respond @query ' in line)
candidate=''.join(lines[:index+1])+addition+''.join(lines[index+1:])
if request.get('corsFix'):
 start=original.index('  handle @single_import_post {')
 needle='    header_down -Set-Cookie\n';index=original.index(needle,start)+len(needle)
 if 'header_down -Access-Control-Allow-Origin' in original[start:index+100]:raise RuntimeError('EXISTING_SINGLE_IMPORT_CORS_FIX_PRESERVED')
 candidate=original[:index]+'    header_down -Access-Control-Allow-Origin\n'+original[index:]
backup=entry/('Caddyfile.before-single-import-'+request['operation'])
with backup.open('x') as stream:stream.write(original)
backup.chmod(0o600)
def caddy(action):
 p=subprocess.run(['docker','exec',container['Id'],'caddy',action,'--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],capture_output=True,timeout=20)
 if p.returncode:
  diagnostic=entry/('single-import-error-'+request['operation']+'.json')
  diagnostic.write_text(json.dumps({'action':action,'diagnostic':p.stderr.decode('utf8','replace')[-4096:]}));diagnostic.chmod(0o600)
  raise RuntimeError('B_ENTRY_CADDY_'+action.upper()+'_FAILED')
def restart():
 subprocess.run(['docker','stop','--time','10',container['Id']],capture_output=True,check=True,timeout=30)
 time.sleep(2)
 p=subprocess.run(['docker','start',container['Id']],capture_output=True,timeout=15)
 if p.returncode:raise RuntimeError('B_ENTRY_RESTART_FAILED')
 time.sleep(3)
 current=json.loads(subprocess.check_output(['docker','inspect',container['Id']],timeout=10))[0]
 if not current['State']['Running'] or current['HostConfig']['PortBindings']!=container['HostConfig']['PortBindings']:raise RuntimeError('B_ENTRY_RUNTIME_CHANGED')
try:
 path.write_text(candidate);caddy('validate');restart()
except Exception as error:
 path.write_text(original);restart()
 print(json.dumps({'status':'FAIL','reason':str(error),'originalRestored':True}));raise SystemExit(0)
print(json.dumps({'status':'PASS','exactImportPath':route,'backup':str(backup),'containerId':container['Id'],'newPublishedPorts':False,'authenticationUnchanged':True}))
"""

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--diagnose',action='store_true');parser.add_argument('--cors-fix',action='store_true');args=parser.parse_args()
    operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('single-import-edge-'+operation);folder.mkdir(parents=True)
    result={'status':'NOT VERIFIED','operation':operation};password=None
    try:
        password=check.read_vm_credential(gui=True);client=check.connect('B',password)
        try:
            program="""import pathlib,json,subprocess
entry=pathlib.Path('/opt/highpass/patient-public-entry')
files=sorted(entry.glob('single-import-error-*.json'),key=lambda p:p.stat().st_mtime)[-4:]
ids=subprocess.check_output(['docker','ps','-a','-q']).decode().splitlines()
items=json.loads(subprocess.check_output(['docker','inspect',*ids]))
peers=[c for c in items if any(m['Destination']=='/etc/caddy/Caddyfile' and pathlib.Path(m['Source']).resolve()==entry/'Caddyfile' for m in c['Mounts'])]
startup={}
for c in peers:
 if not c['State']['Running']:
  try:
   p=subprocess.run(['docker','start','-a',c['Id']],capture_output=True,text=True,timeout=12)
   startup[c['Id']]={'exitCode':p.returncode,'diagnostic':(p.stdout+p.stderr)[-12000:]}
  except subprocess.TimeoutExpired:startup[c['Id']]={'attachedTimeout':True,'running':json.loads(subprocess.check_output(['docker','inspect',c['Id']]))[0]['State']['Running']}
print(json.dumps({'status':'PASS','errors':[json.loads(p.read_text()) for p in files],
'entry':[{'id':c['Id'],'state':c['State'],'user':c['Config']['User'],'command':c['Config']['Cmd'],'entrypoint':c['Config']['Entrypoint'],'startup':startup.get(c['Id']), 'logDriver':c['HostConfig']['LogConfig']['Type'],'pidsLimit':c['HostConfig'].get('PidsLimit')} for c in peers]}))
""" if args.diagnose else 'request='+repr({'operation':operation,'corsFix':args.cors_fix})+'\n'+PROGRAM
            result.update(check.remote(client,'B',password,program,65))
        finally:client.close()
    except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:password=None
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
