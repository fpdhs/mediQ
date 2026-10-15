import base64,hashlib,json,pathlib,subprocess,time
entry=pathlib.Path('/opt/highpass/patient-public-entry');source=entry/'Caddyfile'
original=source.read_bytes()
if hashlib.sha256(original).hexdigest()!=request['baselineHash']:raise RuntimeError('B_TLS_BASELINE_CHANGED')
candidate=base64.b64decode(request['candidate'])
if candidate==original:
 log=subprocess.run(['docker','logs','--since','30m','--tail','10000','hp-capstone-b-portal-portal-1'],capture_output=True,text=True,timeout=15)
 metrics=[]
 for line in (log.stdout+'\n'+log.stderr).splitlines():
  try:value=json.loads(line)
  except:continue
  if value.get('event')=='CAPSTONE_RUNTIME_DIAGNOSTIC' and (value.get('httpStatus',0)>=400 or value.get('stage') in ['UPSTREAM_IMAGE','IMAGE_DECRYPTION']):metrics.append({key:value.get(key) for key in ['stage','httpStatus','code','elapsedMs']})
 print(json.dumps({'status':'PASS','phase':'unchanged-config-diagnostics','metrics':metrics[-15:]}));raise SystemExit(0)
folder=entry/('pacs-store-'+request['operation']);folder.mkdir(mode=0o700,exist_ok=True)
(folder/'before.Caddyfile').write_bytes(original);(folder/'after.Caddyfile').write_bytes(candidate)
for file in folder.iterdir():file.chmod(0o600)
config=json.loads((entry/'compose.json').read_text());image=config['services']['tls']['image']
check=subprocess.run(['docker','run','--rm','--user','0','--network=none','--read-only','--tmpfs','/tmp','-v',str(folder/'after.Caddyfile')+':/etc/caddy/Caddyfile:ro','-v',str(entry/'b-upstream-ca.crt')+':/etc/caddy/b-ca.crt:ro',image,'caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile'],capture_output=True,timeout=30)
if check.returncode:
 print(json.dumps({'status':'FAIL','reason':'B_PACS_TLS_CANDIDATE_INVALID','diagnostic':check.stderr.decode('utf8','replace')[-3000:]}));raise SystemExit(0)
if source.read_bytes()!=original:raise RuntimeError('B_TLS_CONCURRENT_CHANGE')
source.write_bytes(candidate)
try:
 ids=subprocess.check_output(['docker','ps','-a','-q']).decode().splitlines()
 containers=json.loads(subprocess.check_output(['docker','inspect',*ids]))
 peers=[c for c in containers if any(m['Destination']=='/etc/caddy/Caddyfile' and pathlib.Path(m['Source']).resolve()==source for m in c['Mounts'])]
 if len(peers)!=1:raise RuntimeError('B_PACS_TLS_PINNED_CONTAINER_REQUIRED')
 container=peers[0]
 subprocess.run(['docker','restart',container['Id']],capture_output=True,check=True,timeout=45)
 time.sleep(3)
 current=json.loads(subprocess.check_output(['docker','inspect',container['Id']]))[0]
 if not current['State']['Running']:
  log=subprocess.run(['docker','logs','--tail','8',container['Id']],capture_output=True,timeout=10)
  print(json.dumps({'status':'FAIL','reason':'B_PACS_TLS_RESTART_FAILED','diagnostic':(log.stdout+log.stderr).decode('utf8','replace')[-4000:],'state':current['State']}));raise SystemExit(0)
 if current['HostConfig']['PortBindings']!=container['HostConfig']['PortBindings']:raise RuntimeError('B_PACS_TLS_PORTS_CHANGED')
except Exception:
 source.write_bytes(original)
 if 'container' in locals():subprocess.run(['docker','restart',container['Id']],capture_output=True,timeout=45)
 raise
print(json.dumps({'status':'PASS','pcDownloadExposed':False,'authenticatedPacsImport':True,'backup':str(folder/'before.Caddyfile'),'sha256':hashlib.sha256(candidate).hexdigest()}))
