"""Runs as root on the approved Cloud VM; metadata-only public deployment."""
import hashlib,json,os,pathlib,subprocess,sys,time
folder=pathlib.Path(sys.argv[1]).resolve();phase=sys.argv[2]
assert str(folder).startswith('/home/highpassadmin/.highpass-public-')
def run(args,seconds=60,env=None):
 r=subprocess.run(args,capture_output=True,timeout=seconds,env=env)
 if r.returncode:
  (folder/('error-'+phase+'.log')).write_bytes(r.stdout+r.stderr)
  raise RuntimeError('COMMAND_FAILED_'+args[0])
 return r.stdout
def save(name,obj):
 p=folder/name;p.write_text(json.dumps(obj,indent=2));p.chmod(0o600)
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
manifest=json.loads((folder/'candidate.json').read_text());control=manifest['roles']['control'];portal=manifest['roles']['portal']
if phase=='stage':
 archive=folder/'images.tar';expected=json.loads((folder/'archive.json').read_text())['sha256']
 with archive.open('rb') as f:assert hashlib.file_digest(f,'sha256').hexdigest()==expected
 run(['docker','load','-i',str(archive)],180)
 for item in [control,portal]:assert inspect(item['image'])['Id']==item['image']
 run(['docker','pull','ghcr.io/coreruleset/coraza-crs:caddy-alpine'],240)
 waf=inspect('ghcr.io/coreruleset/coraza-crs:caddy-alpine')
 save('waf.json',{'image':waf['Id'],'digests':waf.get('RepoDigests',[])})
 for name in ['actors.json','runtime.json']:
  p=folder/name;os.chown(p,0,65532);p.chmod(0o440)
 for name in ['start-public-web.js','Caddyfile']: (folder/name).chmod(0o444)
 folder.chmod(0o755)
 run(['docker','run','--rm','--network=none','--read-only','--tmpfs','/tmp:rw,nosuid,nodev,size=32m',
      '-v',str(folder/'Caddyfile')+':/etc/caddy/Caddyfile:ro','--entrypoint','/usr/bin/caddy',waf['Id'],
      'validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],60)
 print(json.dumps({'staged':True,'waf':waf['Id']}))
elif phase=='activate':
 old=inspect('hp-capstone-control-control-1');assert old['Image']==control['base']
 protected=[inspect(n) for n in ['hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']]
 labels=old['Config']['Labels'];files=labels['com.docker.compose.project.config_files'].split(',');work=labels['com.docker.compose.project.working_dir']
 runtime=dict(v.split('=',1) for v in old['Config']['Env'])
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':control['base'],'HIPASS_POSTGRES_IMAGE':protected[1]['Image'],
      'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
 for k in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:env[k]=runtime[k]
 cmd=['docker','compose','--project-directory',work,'-p','hp-capstone-control']
 for f in files:cmd+=['-f',f]
 baseline=json.loads(run(cmd+['config','--format','json'],env=env));save('baseline-compose.json',baseline)
 save('rollback-state.json',{'cmd':cmd,'env':env,'beforeImage':old['Image'],'protected':[{k:i[k] for k in ['Id','Image','Name']} for i in protected]})
 entra=json.loads((folder/'runtime.json').read_text());entra['HIPASS_ENTRA_ACTOR_MAP_FILE']='/run/config/entra-actors.json';entra['HIPASS_ENTRA_METADATA_ORIGIN']='http://entra-metadata:8080'
 overlay={'services':{'control':{'image':control['image'],'environment':entra,'volumes':[str(folder/'actors.json')+':/run/config/entra-actors.json:ro'],'networks':['entra_metadata_private']},
  'entra-metadata':{'image':control['image'],'command':['scripts/start-entra-metadata.js'],'environment':{'ENTRA_TENANT_ID':entra['ENTRA_TENANT_ID']},'networks':['entra_metadata_private','entra_egress'],'read_only':True,'cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],'mem_limit':'128m','pids_limit':64,'restart':'unless-stopped'}},
  'networks':{'entra_metadata_private':{'internal':True},'entra_egress':{}}}
 save('entra-compose.json',overlay);selected=cmd+['-f',str(folder/'entra-compose.json')]
 merged=json.loads(run(selected+['config','--format','json'],env=env))
 assert not merged['services']['control'].get('ports')
 assert set(baseline['services']['control']['networks']).issubset(merged['services']['control']['networks'])
 try:
  run(selected+['up','-d','--no-deps','--pull','never','entra-metadata','control'],120,env)
  for _ in range(55):
   time.sleep(1);current=inspect('hp-capstone-control-control-1')
   if current['State'].get('Health',{}).get('Status')=='healthy':break
  assert current['Image']==control['image'] and current['State'].get('Health',{}).get('Status')=='healthy'
 except Exception:
  try:
   save('failed-control-state.json',current['State'])
   logs=subprocess.run(['docker','logs','--tail','30','hp-capstone-control-control-1'],capture_output=True,timeout=10)
   (folder/'failed-control.log').write_bytes(logs.stdout+logs.stderr)
  finally:run(cmd+['up','-d','--no-deps','--pull','never','control'],120,env)
  raise
 for old_item in protected:assert inspect(old_item['Id'])['Id']==old_item['Id']
 ingress_mount=next(m['Source'] for m in old['Mounts'] if m['Destination']==runtime['HIPASS_INGRESS_SECRET_FILE'])
 for dirname in ['tls-data','tls-config']:
  d=folder/dirname;d.mkdir(exist_ok=False);os.chown(d,1000,1000);d.chmod(0o700)
 waf=json.loads((folder/'waf.json').read_text())['image']
 web={'services':{
  'web':{'image':portal['image'],'command':['scripts/start-public-web.js'],'environment':{'HIPASS_INGRESS_SECRET_FILE':'/run/edge/ingress'},
   'volumes':[str(folder/'start-public-web.js')+':/app/scripts/start-public-web.js:ro',ingress_mount+':/run/edge/ingress:ro'],
   'networks':['web_private','api_private'],'read_only':True,'cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],'mem_limit':'256m','pids_limit':64,'restart':'unless-stopped'},
  'waf':{'image':waf,'entrypoint':['/usr/bin/caddy'],'command':['run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],
   'ports':['10.89.0.4:443:8443/tcp'],'volumes':[str(folder/'Caddyfile')+':/etc/caddy/Caddyfile:ro',str(folder/'tls-data')+':/data',str(folder/'tls-config')+':/config'],
   'networks':['web_private','edge_out'],'read_only':True,'tmpfs':['/tmp:rw,nosuid,nodev,size=32m'],'security_opt':['no-new-privileges:true'],'mem_limit':'384m','pids_limit':128,'restart':'unless-stopped',
   'logging':{'driver':'json-file','options':{'max-size':'5m','max-file':'3'}}}},
  'networks':{'api_private':{'external':True,'name':'hp-capstone-control_api_private'},'web_private':{'internal':True},'edge_out':{}}}
 save('web-compose.json',web)
 try:
  run(['docker','compose','-p','hp-public-web','-f',str(folder/'web-compose.json'),'up','-d','--pull','never'],120)
  time.sleep(3)
  w=inspect('hp-public-web-waf-1');assert w['State']['Running'] and w['RestartCount']==0
 except Exception:
  run(['docker','compose','-p','hp-public-web','-f',str(folder/'web-compose.json'),'stop'],60)
  run(cmd+['up','-d','--no-deps','--pull','never','control'],120,env)
  raise
 print(json.dumps({'controlImage':current['Image'],'webStarted':True,'wafImage':waf,'publicNSGOpened':False}))
elif phase=='status':
 out=[]
 for name in ['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1']:
  i=inspect(name);out.append({'name':name,'image':i['Image'],'running':i['State']['Running'],'restarts':i['RestartCount'],'health':i['State'].get('Health',{}).get('Status')})
 print(json.dumps(out))
elif phase=='rollback':
 state=json.loads((folder/'rollback-state.json').read_text())
 if (folder/'web-compose.json').exists():run(['docker','compose','-p','hp-public-web','-f',str(folder/'web-compose.json'),'stop'],60)
 run(state['cmd']+['up','-d','--no-deps','--pull','never','control'],120,state['env'])
 print(json.dumps({'restoredImage':inspect('hp-capstone-control-control-1')['Image']}))
else:raise RuntimeError('UNKNOWN_PHASE')
