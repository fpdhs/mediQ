"""Preserve current runtimes; add consent-bound durable PACS jobs and public UI."""
import argparse,base64,hashlib,importlib.util,json,pathlib,re,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('store_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)

def once(source,before,after):
    if source.count(before)!=1:raise RuntimeError('PACS_SOURCE_ANCHOR_CHANGED')
    return source.replace(before,after,1)

def span(source,start,end):
    if source.count(start)!=1 or source.count(end)!=1:raise RuntimeError('PACS_SOURCE_SPAN_CHANGED')
    return source[source.index(start):source.index(end)]

def patch_app(current):
    local=(ROOT/'public/app.js').read_text(encoding='utf8')
    if "import { initializeTransferActions }" not in current:
        current=once(current,"import { initializeViewerStudio } from '/ui/viewer-studio.js';","import { initializeViewerStudio } from '/ui/viewer-studio.js';\nimport { initializeTransferActions } from '/ui/transfer-actions.js';")
    if 'let transferQueue = [];' not in current:
        current=once(current,'let pacsImportBusy = false;',span(local,'let pacsImportBusy = false;','let healthSharePicker'))
    if 'let preflightFingerprint' not in current:
        current=once(current,'let isPreflightPassed = false;','let isPreflightPassed = false;\nlet preflightFingerprint = "";')
    start='  // PACS Import Actions';end='  // QR Handoff Scanner Actions'
    current=once(current,span(current,start,end),span(local,start,end))
    start='// PACS Import (STOW-RS)';end='// Hospital B PACS Archive Workstation Module'
    current=once(current,span(current,start,end),span(local,start,end))
    if "if (screen === 'transfer') { runPreflightCheck(); loadHospitalBPacsArchive(); }" in current:
        current=once(current,"if (screen === 'transfer') { runPreflightCheck(); loadHospitalBPacsArchive(); }", "if (screen === 'transfer') { runPreflightCheck(); loadHospitalBPacsArchive(); void restorePacsTransferJob(); }")
    start='function bindEvents() {';end='  // Global & Refresh'
    current=once(current,span(current,start,end),span(local,start,end))
    old="try { if (next.action==='refresh') await loadDashboard(); else await openViewer(); }"
    if old in current:current=once(current,old,"try { if (next.action==='refresh') await loadDashboard(); else await openClinicianHomeViewer(); }")
    start='async function downloadSelectedInstance() {';end='function renderSeries(seriesRows)'
    current=once(current,span(current,start,end),span(local,start,end))
    start='function setDownloadState() {';end='function requireToken()'
    current=once(current,span(current,start,end),span(local,start,end))
    start='async function proofFetch(path, options = {}) {';end='function developmentPrincipalHeaders(path)'
    current=once(current,span(current,start,end),span(local,start,end))
    anchor='async function loadHospitalBPacsArchive() {'
    guard="\n  if(location.hostname==='highpass-demo.japaneast.cloudapp.azure.com'){\n    const legacy=document.querySelector('#hospital-vault-list');if(legacy)legacy.hidden=true;\n    updateTransferTracking('unavailable');\n    return;\n  }"
    if guard not in current:current=once(current,anchor,anchor+guard)
    return current

def patch_index(current):
    local=(ROOT/'public/index.html').read_text(encoding='utf8')
    start='          <!-- 2.5 PACS Import (STOW-RS) -->'
    end='          <!-- 2.5.1 Hospital B PACS Archive Workstation Screen -->'
    block=span(local,start,end)
    block=block.replace('병원 보관함 · 로컬 암호화 보관 시연','환자 동의 범위 안에서 B병원 PACS에 보관')
    block=block.replace('현재는 로컬 시뮬레이터입니다. VM B 저장·실제 PACS 등록 완료를 의미하지 않습니다.','B PACS 저장본의 UID와 원본 해시가 일치해야 보관 완료로 표시합니다. PC 다운로드는 제공하지 않습니다.')
    block=block.replace('동의 철회·만료 후 접근을 차단하고 삭제를 처리합니다. 삭제 실패는 별도 상태로 표시합니다.','동의 철회·만료 후 신규 전송은 차단됩니다. 기존 저장본의 접근·삭제 상태는 병원 정책에 따라 별도로 확인해야 합니다.')
    return once(current,span(current,start,end),block)

def patch_server(current):
    current=once(current,'const port = Number(process.env.PORT ?? 3000);','import { createPacsTransferJobRuntime } from "./pacs-transfer-job-runtime.js";\n\nconst port = Number(process.env.PORT ?? 3000);')
    current=once(current,'const service = new HipassService(store);','const service = new HipassService(store);\nconst pacsTransferJobRuntime = await createPacsTransferJobRuntime({ service, readJson });')
    current=once(current,'repository: new PostgresKeyReleaseRepository(pool),','repository: new PostgresKeyReleaseRepository(pool),\n    transferJobRepository: pacsTransferJobRuntime?.repository,')
    anchor='  if (await routePatientGrant(request,response,url)) return;\n  const principal = await authenticateRequest(request);'
    current=once(current,anchor,anchor+'\n  if (pacsTransferJobRuntime && await pacsTransferJobRuntime.route(request, response, url, principal, requestMeta(request, principal))) return;')
    anchor="server.on('close',()=>{patientGrantRuntime?.close().catch(()=>console.warn('PATIENT_AUTHORITY_CLOSE_FAILED'));});"
    return once(current,anchor,anchor+"\nserver.on('close',()=>{pacsTransferJobRuntime?.close().catch(()=>console.warn('PACS_TRANSFER_JOB_DATABASE_CLOSE_FAILED'));});")

SNAPSHOT=r'''
import json,subprocess,pathlib,base64,hashlib
c=json.loads(subprocess.check_output(['docker','inspect',request['name']]))[0]
capture=pathlib.Path(request['captureDir']);capture.mkdir(mode=0o700)
files={}
for file in request['files']:
 p=subprocess.run(['docker','exec',c['Id'],'/nodejs/bin/node','-e',"process.stdout.write(require('fs').readFileSync(process.argv[1]))",'/app/'+file],capture_output=True,timeout=10)
 if p.returncode:raise RuntimeError('PACS_SNAPSHOT_SOURCE_MISSING')
 target=capture/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(p.stdout);target.chmod(0o600)
 files[file]={'path':str(target),'sha256':hashlib.sha256(p.stdout).hexdigest()}
mounts=[m for m in c['Mounts'] if m['Destination'].endswith('/start-public-web.js')]
startup=pathlib.Path(mounts[0]['Source']) if mounts else None
print(json.dumps({'name':c['Name'],'imageId':c['Image'],'files':files,'startupPath':str(startup) if startup else None,'startup':base64.b64encode(startup.read_bytes()).decode() if startup else None}))
'''

DATABASE=r'''
import secrets,urllib.parse
pg=inspect('hp-capstone-control-postgres-1')
pg_env=dict(item.split('=',1) for item in pg['Config']['Env'])
def sql(text):
 p=subprocess.run(['docker','exec','-i','-u','postgres',pg['Id'],'psql','-U',pg_env['POSTGRES_USER'],'-d',pg_env['POSTGRES_DB'],'-v','ON_ERROR_STOP=1','-At'],input=text,text=True,capture_output=True,timeout=35)
 if p.returncode:raise RuntimeError('PACS_JOB_DATABASE_PREPARATION_FAILED')
 return p.stdout.strip()
present=sql("SELECT (to_regclass('public.capstone_pacs_transfer_jobs') IS NOT NULL)::int || ',' || (to_regclass('public.capstone_pacs_transfer_items') IS NOT NULL)::int;")
if present=='0,0':sql(base64.b64decode(request['migration']).decode())
elif present!='1,1':raise RuntimeError('PACS_JOB_SCHEMA_INCONSISTENT')
role='hp_pacs_jobs_'+request['operation'][:12];secret=secrets.token_urlsafe(36)
if not re.fullmatch('[a-z0-9_]+',role) or not re.fullmatch('[A-Za-z0-9_-]+',secret):raise RuntimeError('PACS_ROLE_GENERATION_FAILED')
database=pg_env['POSTGRES_DB'].replace('"','""')
sql("CREATE ROLE "+role+" LOGIN PASSWORD '"+secret+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;\nGRANT CONNECT ON DATABASE \""+database+"\" TO "+role+";\nGRANT USAGE ON SCHEMA public TO "+role+";\nGRANT SELECT,INSERT,UPDATE ON public.capstone_pacs_transfer_jobs,public.capstone_pacs_transfer_items TO "+role+";")
db=urllib.parse.urlsplit(environment.get('DATABASE_URL') or 'postgres://'+environment['POSTGRES_HOST']+':'+environment.get('POSTGRES_PORT','5432')+'/'+environment['POSTGRES_DB'])
jobs_url=urllib.parse.urlunsplit((db.scheme,role+':'+secret+'@'+db.hostname+(':'+str(db.port) if db.port else ''),db.path,db.query,''))
conf['environment']['HIPASS_CAPSTONE_PACS_TRANSFER_JOBS']='1'
credential=folder/'jobs-database-url.secret';credential.write_text(jobs_url);credential.chmod(0o440);os.chown(credential,0,65532);folder.chmod(0o711)
conf['environment'].pop('HIPASS_PACS_TRANSFER_DATABASE_URL',None)
conf['environment']['HIPASS_PACS_TRANSFER_DATABASE_URL_FILE']='/run/pacs-jobs/database-url'
conf.setdefault('volumes',[]).append({'type':'bind','source':str(credential),'target':'/run/pacs-jobs/database-url','read_only':True,'bind':{'create_host_path':False}})
secret=None
save(folder/'job-role.json',{'role':role,'newAzureResources':False,'migration':39})
'''

EDGE=r'''
import base64,json,pathlib,hashlib,subprocess,time
source=pathlib.Path(request['startupPath'])
original=source.read_bytes()
if hashlib.sha256(original).hexdigest()!=request['baselineHash']:raise RuntimeError('PACS_PUBLIC_EDGE_CHANGED')
candidate=base64.b64decode(request['candidate'])
backup=source.with_name('start-public-web.before-pacs-'+request['operation']+'.js')
with backup.open('xb') as stream:stream.write(original)
backup.chmod(0o600)
source.write_bytes(candidate)
try:
 check=subprocess.run(['docker','exec','hp-public-web-web-1','/nodejs/bin/node','--check','/app/scripts/start-public-web.js'],capture_output=True,timeout=12)
 if check.returncode:raise RuntimeError('PACS_PUBLIC_EDGE_SYNTAX_FAILED')
 subprocess.run(['docker','restart','hp-public-web-web-1'],capture_output=True,check=True,timeout=40)
 for attempt in range(20):
  check=subprocess.run(['docker','exec','hp-public-web-web-1','/nodejs/bin/node','-e',"fetch('http://127.0.0.1:8080/').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(2))"],capture_output=True,timeout=5)
  if check.returncode==0:break
  time.sleep(1)
 else:raise RuntimeError('PACS_PUBLIC_EDGE_HEALTH_FAILED')
except Exception:
 source.write_bytes(original);subprocess.run(['docker','restart','hp-public-web-web-1'],capture_output=True,timeout=40);raise
print(json.dumps({'status':'PASS','pcDownloadExposed':False,'backup':str(backup),'sha256':hashlib.sha256(candidate).hexdigest()}))
'''

def main():
 args=argparse.ArgumentParser();args.add_argument('--web-only',action='store_true');options=args.parse_args()
 operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('pacs-store-cloud-'+operation);folder.mkdir(parents=True)
 result={'status':'NOT VERIFIED','operation':operation,'checks':[],'pcDownloadEnabled':False,'newAzureResources':False}
 client=deploy.rollout.inventory.check.connect('CLOUD',None)
 try:
  roles=[('hp-public-web-web-1','WEB')] if options.web_only else [('hp-capstone-control-control-1','CONTROL_PACS'),('hp-public-web-web-1','WEB')]
  for name,role in roles:
   wanted=['src/server.js'] if role=='CONTROL_PACS' else ['public/app.js','public/index.html']
   snapshot=deploy.execute(client,None,'/opt/highpass/pacs-source-'+operation+'-'+role.lower()+'.py',{'name':name,'files':wanted,'captureDir':'/opt/highpass/pacs-capture-'+operation+'-'+role.lower()},SNAPSHOT)
   source={}
   with deploy.rollout.gateway.root_sftp(client,None) as sftp:
    for file,info in snapshot['files'].items():
     with sftp.open(info['path'],'rb') as stream:body=stream.read(1048577)
     if len(body)>1048576 or hashlib.sha256(body).hexdigest()!=info['sha256']:raise RuntimeError('PACS_CAPTURE_HASH_CHANGED')
     source[file]=body
   files={}
   if role=='CONTROL_PACS':
    files={file:(ROOT/file).read_bytes() for file in ['src/pacs-transfer-jobs.js','src/pacs-transfer-job-http.js','src/pacs-transfer-job-runtime.js','src/consent-bound-key-release.js','src/key-release-http-handler.js']}
    files['src/server.js']=patch_server(source['src/server.js'].decode()).encode()
   else:
    files={file:(ROOT/file).read_bytes() for file in ['public/ui/transfer-actions.js','public/ui/transfer-actions.css','public/ui/import-preflight.js']}
    files['public/app.js']=patch_app(source['public/app.js'].decode()).encode()
    files['public/index.html']=patch_index(source['public/index.html'].decode()).encode()
   for file,body in files.items():
    target=folder/file;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
   request={'role':role,'operation':operation,'name':snapshot['name'],'baselineImage':snapshot['imageId'],
    'baselineHashes':{file:hashlib.sha256(body).hexdigest() for file,body in source.items()},
    'release':'/opt/highpass/pacs-store-'+operation+'-'+role.lower(),'files':{file:base64.b64encode(body).decode() for file,body in files.items()}}
   program=deploy.rollout.GUEST.replace("!scripts/**\\n')","!scripts/**\\n!public/\\n!public/**\\n')")
   if role=='CONTROL_PACS':
    request['migration']=base64.b64encode((ROOT/'db/migrations/039_capstone_pacs_transfer_jobs.sql').read_bytes()).decode()
    program=once(program,"if request['role']=='CLOUD':conf['environment']['HIPASS_B_PACS_IMPORT_ENABLED']='1'",DATABASE+"\nif request['role']=='CLOUD':conf['environment']['HIPASS_B_PACS_IMPORT_ENABLED']='1'")
   result['checks'].append(deploy.execute(client,None,request['release']+'-guest.py',request,program))
   if role=='WEB':
    edge=base64.b64decode(snapshot['startup']).decode()
    additions="const routes=[\n ['POST',/^\\/api\\/pacs-transfer-jobs$/],\n ['GET',/^\\/api\\/pacs-transfer-jobs\\/(active|history)$/],\n ['GET',/^\\/api\\/pacs-transfer-jobs\\/[0-9a-f-]{36}$/i],\n ['POST',/^\\/api\\/pacs-transfer-jobs\\/[0-9a-f-]{36}\\/claim$/i],"
    if "pacs-transfer-jobs" not in edge:
     edge=once(edge,'const routes=[',additions)
     edge=once(edge,'if(size>32768)return reply(413',"if(size>(req.method==='POST'&&url.pathname==='/api/pacs-transfer-jobs'?4194304:32768))return reply(413")
     result['checks'].append(deploy.execute(client,None,'/opt/highpass/pacs-edge-'+operation+'.py',{'operation':operation,'startupPath':snapshot['startupPath'],'baselineHash':hashlib.sha256(base64.b64decode(snapshot['startup'])).hexdigest(),'candidate':base64.b64encode(edge.encode()).decode()},EDGE))
    (folder/'start-public-web.js').write_text(edge,encoding='utf8')
  result['status']='PASS'
 except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__)
 finally:client.close()
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
 return 0 if result['status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
