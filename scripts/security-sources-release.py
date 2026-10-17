"""WAF-only additive source deployment over the captured current Azure images."""
import argparse, base64, json, pathlib, uuid
from importlib.util import module_from_spec, spec_from_file_location
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
 spec=spec_from_file_location(name,ROOT/path);module=module_from_spec(spec);spec.loader.exec_module(module);return module
console=load('source_console','scripts/security-console-release.py');release=console.release

READER=r'''
def build_reader():
 data=MANIFEST['reader'];source=folder/'reader'
 for path,expected in data['hashes'].items():
  target=source/path;assert hashlib.sha256(target.read_bytes()).hexdigest()==expected;target.chmod(0o755)
  for parent in target.parents:
   if parent==folder:break
   parent.chmod(0o755)
 base='highpass-sources-reader-base:'+data['base'][7:23];run(['docker','tag',data['base'],base])
 (source/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY --chmod=755 '+path+' /app/'+path+'\n' for path in data['hashes']))
 tag='highpass-sources-reader:'+MANIFEST['operation'];run(['docker','build','--network=none','--pull=false','-t',tag,str(source)],180)
 candidate=inspect(tag);original=inspect(data['base']);assert candidate['Config']==original['Config']
 for path in data['hashes']:run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',candidate['Id'],'--check','/app/'+path])
 return candidate['Id']
def reader_config():
 old=inspect('hp-security-audit-reader');labels=old['Config']['Labels']
 command=['docker','compose','-p','hp-security-audit','--project-directory',labels['com.docker.compose.project.working_dir']]
 for file in labels['com.docker.compose.project.config_files'].split(','):command+=['-f',file]
 conf=json.loads(run(command+['config','--format','json']));assert conf['services']['reader']['image']==MANIFEST['reader']['base']
 save(folder/'reader-before.json',conf);conf=copy.deepcopy(conf);conf['services']['reader']['image']=json.loads((folder/'build.json').read_text())['candidates']['reader'];save(folder/'reader-after.json',conf)
def reader_switch(suffix):
 run(['docker','compose','-p','hp-security-audit','-f',str(folder/('reader-'+suffix+'.json')),'up','-d','--no-deps','--pull','never','reader'])
 for attempt in range(40):
  c=inspect('hp-security-audit-reader')
  if c['State'].get('Health',{}).get('Status')=='healthy':return c
  time.sleep(1)
 raise RuntimeError('READER_HEALTH_FAILED')
'''

INSTALL=r'''
assert_baseline()
socket=inspect(names['control'])['Mounts']
mount=next(m for m in socket if m['Destination']=='/run/security-audit')
assert not mount['RW'] and mount['Source']=='/opt/highpass/security-release-e4888f02b2dd4a8295a7f0426025b6e0/audit-extension/socket'
assert not pathlib.Path('/etc/systemd/system/highpass-waf-audit.service').exists(), 'COLLECTOR_ALREADY_EXISTS'
collector=folder/'collect-waf-audit.py';assert hashlib.sha256(collector.read_bytes()).hexdigest()==MANIFEST['collectorHash'];collector.chmod(0o700)
service='[Unit]\nDescription=Highpass bounded sanitized WAF audit snapshot\nAfter=docker.service\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 '+str(collector)+'\nTimeoutStartSec=20\nUMask=0027\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nProtectHome=true\nReadWritePaths='+mount['Source']+'\nStandardOutput=null\nStandardError=null\n'
timer='[Unit]\nDescription=Refresh Highpass sanitized WAF audit\n[Timer]\nOnBootSec=30s\nOnUnitActiveSec=60s\nAccuracySec=5s\n[Install]\nWantedBy=timers.target\n'
for name,body in [('service',service),('timer',timer)]:
 target=pathlib.Path('/etc/systemd/system/highpass-waf-audit.'+name);target.write_text(body);target.chmod(0o644)
run(['systemctl','daemon-reload']);run(['systemctl','enable','--now','highpass-waf-audit.timer']);run(['systemctl','start','highpass-waf-audit.service'])
snapshot=json.loads((pathlib.Path(mount['Source'])/'waf-events.json').read_text());assert snapshot['status']=='available'
print(json.dumps({'status':'PASS','count':len(snapshot['events']),'collectorEnabled':True,'rawLogsPersisted':False,'newPorts':False}))
'''

def prepare(folder):
 baseline=json.loads((folder/'baseline.json').read_text(encoding='utf8'))
 server=(folder/'capture/control/src/server.js').read_text(encoding='utf8').replace('\r\n','\n')
 anchor="import { buildEventIndex, parseEventQuery, createSecurityReport } from './security-console.js';"
 server=release.once(server,anchor,anchor+"\nimport { listWafAudit } from './waf-audit.js';\nimport { listEntraAudit } from './entra-audit.js';")
 server=release.once(server,"    const index = buildEventIndex(store.get('auditLogs'), await listAzureKeyVaultAudit(), reviews, query);", "    const [azure, waf, entra] = await Promise.all([listAzureKeyVaultAudit(), listWafAudit(), listEntraAudit()]);\n    const index = buildEventIndex(store.get('auditLogs'), azure, reviews, query, waf, entra);")
 server=release.once(server,"    } else {\n      const target = await findAzureKeyVaultAuditEvent(review.eventRef);", "    } else if (['WAF','ENTRA'].includes(review.source)) {\n      const source = await (review.source === 'WAF' ? listWafAudit() : listEntraAudit());\n      if (source.status !== 'available') return sendError(response, 503, 'WAF_AUDIT_SOURCE_UNAVAILABLE');\n      if (!source.events.some(event => event.eventRef === review.eventRef)) return sendError(response, 404, 'SECURITY_REVIEW_EVENT_NOT_FOUND');\n    } else {\n      const target = await findAzureKeyVaultAuditEvent(review.eventRef);")
 server=release.once(server,"  if (!['APP', 'AZURE_KEYVAULT'].includes(body.source)","  if (!['APP', 'AZURE_KEYVAULT', 'WAF', 'ENTRA'].includes(body.source)")
 patches={'control':{'src/server.js':server.encode()},'web':{}}
 expected={'control':{},'web':{}}
 original_console=ROOT/'artifacts/azure/entra-web-20261014T080422Z-f4fb35/candidate'
 original_report=ROOT/'artifacts/azure/entra-web-20261014T083920Z-c8ab92/report-candidate'
 for path in ['src/security-console.js','src/waf-audit.js','src/entra-audit.js']:patches['control'][path]=(ROOT/path).read_bytes()
 expected['control']['src/security-console.js']=release.digest((original_console/'control/src/security-console.js').read_bytes())
 for path in ['public/ui/security-console.js','public/ui/security-report.js']:
  patches['web'][path]=(ROOT/path).read_bytes();expected['web'][path]=release.digest((original_report/path).read_bytes())
 operation=uuid.uuid4().hex;remote='/opt/highpass/security-release-'+operation
 manifest={'operation':operation,'stage':remote,'baseline':baseline['containers'],'roles':{},'startupPath':baseline['startupPath'],
  'startupBeforeHash':release.digest(base64.b64decode(baseline['startup'])),'startupAfter':baseline['startup'],'startupAfterHash':release.digest(base64.b64decode(baseline['startup'])),
  'expectedSourceHashes':expected,'collectorHash':release.digest((ROOT/'scripts/collect-waf-audit.py').read_bytes()),
  'tests':['test/entra-audit.test.js','test/waf-audit.test.js','test/security-console.test.js','test/security-report.test.js','test/security-observatory-http.test.js','test/azure-keyvault-audit.test.js']}
 client=release.runtime.connect('CLOUD',None)
 try:
  meta=release.runtime.remote(client,'CLOUD',None,"import pathlib,subprocess,json;pathlib.Path("+repr(remote)+").mkdir(mode=0o700);r=json.loads(subprocess.check_output(['docker','inspect','hp-security-audit-reader']))[0];print(json.dumps({'readerId':r['Id'],'readerBase':r['Image']}))")
  manifest.update(meta)
  manifest['reader']={'base':meta['readerBase'],'hashes':{path:release.digest((ROOT/path).read_bytes()) for path in ['src/entra-audit.js','scripts/start-security-audit-relay.js']}}
  with release.gateway.root_sftp(client,None) as sftp:
   def upload(source,destination):
    for parent in reversed(pathlib.PurePosixPath(destination).parents):
     if str(parent) in ['/','/opt','/opt/highpass']:continue
     try:sftp.stat(str(parent))
     except FileNotFoundError:sftp.mkdir(str(parent),0o700)
    sftp.put(str(source),destination);sftp.chmod(destination,0o600)
   for role,files in patches.items():
    manifest['roles'][role]={'base':baseline['containers'][0 if role=='control' else 1]['image'],'hashes':{path:release.digest(body) for path,body in files.items()}}
    for path,body in files.items():
     target=folder/'source-candidate'/role/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body);upload(target,remote+'/'+role+'/'+path)
   for path in manifest['tests']+['scripts/test-support/isolated-server.js']:upload(ROOT/path,remote+'/checks/'+path)
   upload(ROOT/'scripts/collect-waf-audit.py',remote+'/collect-waf-audit.py')
   for path in manifest['reader']['hashes']:upload(ROOT/path,remote+'/reader/'+path)
  (folder/'sources-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
  return {'status':'PASS','stage':remote}
 finally:client.close()

def execute(folder,phase):
 manifest=json.loads((folder/'sources-manifest.json').read_text(encoding='utf8'));manifest['startupBefore']=json.loads((folder/'baseline.json').read_text(encoding='utf8'))['startup']
 prefix=(ROOT/'scripts/security-observatory-remote.py').read_text(encoding='utf8').split("if PHASE == 'build':",1)[0]
 guard_extra="\n for role,files in MANIFEST['expectedSourceHashes'].items():\n  for path,expected in files.items():\n   code=\"const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))\"\n   assert run(['docker','exec',names[role],'/nodejs/bin/node','-e',code,'/app/'+path]).decode().strip()==expected, 'LIVE_MODULE_CHANGED'\n"
 remote=console.REMOTE.replace("if PHASE=='build':",guard_extra+"if PHASE=='build':",1)
 remote=READER+remote
 remote=remote.replace("result={'status':'PASS','candidates':candidates", "candidates['reader']=build_reader()\n result={'status':'PASS','candidates':candidates",1)
 remote=remote.replace("changed=[];startup=", "reader_config()\n changed=[];startup=",1)
 remote=remote.replace("  changed.append('control');switch('control','after')", "  reader_switch('after')\n  changed.append('control');switch('control','after')",1)
 remote=remote.replace("  changed.append('web');switch('web','after')", "  changed.append('web');switch('web','after')\n  code=\"const a=await import('/app/src/entra-audit.js');const b=await import('/app/src/waf-audit.js');const c=await import('/app/src/azure-keyvault-audit.js');const v=await Promise.all([a.listEntraAudit(),b.listWafAudit(),c.listAzureKeyVaultAudit()]);console.log(JSON.stringify(v.map(r=>r.status)));\"\n  assert json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','--input-type=module','-e',code],25))==['available','available','available'], 'SOURCE_CONNECTION_FAILED'",1)
 remote=remote.replace("  assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']", "  assert inspect('hp-security-audit-reader')['Image']==candidates['reader']",1)
 remote=remote.replace("  for role in reversed(changed):switch(role,'before')", "  for role in reversed(changed):switch(role,'before')\n  reader_switch('before')",1)
 # Verification expects the updated private reader; its ports and mounts remain unchanged.
 remote=remote.replace(" assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']\n print(json.dumps({'status':'PASS','sourceHashesVerified'", " assert inspect('hp-security-audit-reader')['Image']==images['reader']\n print(json.dumps({'status':'PASS','sourceHashesVerified'",1)
 if phase=='recover':
  remote=remote.replace("elif PHASE=='recover':\n", "elif PHASE=='recover':\n run(['systemctl','disable','--now','highpass-waf-audit.timer'])\n reader_switch('before')\n",1)
  remote=remote.replace(" assert inspect('hp-security-audit-reader')['Id']==MANIFEST['readerId']\n containers=[]", " assert inspect('hp-security-audit-reader')['Image']==MANIFEST['reader']['base']\n containers=[]",1)
 # Modules are checked only within guard(), before build/deploy; verify checks candidate hashes.
 if phase=='collector':remote=INSTALL
 if phase=='verify':
  remote=remote.replace("assert azure['status']=='available'", "assert azure['status']=='available'\n waf=json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','--input-type=module','-e',\"const m=await import('/app/src/waf-audit.js');const r=await m.listWafAudit();console.log(JSON.stringify({status:r.status,count:r.events.length,denied:r.events.filter(e=>e.result==='DENIED').length}));\"]))\n assert waf['status']=='available'\n assert run(['systemctl','is-enabled','highpass-waf-audit.timer']).decode().strip()=='enabled'")
  remote=remote.replace("'azureKeyVault':azure", "'azureKeyVault':azure,'waf':waf,'entra':entra")
  remote=remote.replace(" assert waf['status']=='available'", " assert waf['status']=='available'\n entra=json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','--input-type=module','-e',\"const m=await import('/app/src/entra-audit.js');const r=await m.listEntraAudit();console.log(JSON.stringify({status:r.status,count:r.events.length,reason:r.reason}));\"]))\n assert entra['status']=='available'")
  remote=remote.replace(" print(json.dumps({'status':'PASS','sourceHashesVerified'", " reader=inspect('hp-security-audit-reader');assert not reader['HostConfig']['PortBindings']\n for path,expected in MANIFEST['reader']['hashes'].items():\n  code=\"const f=require('fs'),c=require('crypto');console.log(c.createHash('sha256').update(f.readFileSync(process.argv[1])).digest('hex'))\"\n  assert run(['docker','exec','hp-security-audit-reader','/nodejs/bin/node','-e',code,'/app/'+path]).decode().strip()==expected\n print(json.dumps({'status':'PASS','sourceHashesVerified'",1)
 program='MANIFEST='+repr(manifest)+'\nPHASE='+repr(phase)+'\n'+prefix+'\n'+remote
 client=release.runtime.connect('CLOUD',None)
 try:result=release.runtime.remote(client,'CLOUD',None,program,400 if phase=='build' else 240)
 finally:client.close()
 if phase=='verify':
  import urllib.request,urllib.error
  checks=[]
  for path,expected in manifest['roles']['web']['hashes'].items():
   with urllib.request.urlopen(release.ORIGIN+'/'+path.removeprefix('public/'),timeout=15) as response:assert release.digest(response.read())==expected
   checks.append({'path':path,'result':'PASS'})
  for source in ['WAF','ENTRA']:
   request=urllib.request.Request(release.ORIGIN+'/api/security/events?source='+source,headers={'Origin':release.ORIGIN,'x-hipass-role':'SECURITY_ADMIN'})
   try:response=urllib.request.urlopen(request,timeout=15)
   except urllib.error.HTTPError as error:response=error
   with response:assert response.status==401
   checks.append({'source':source,'anonymousAndSpoofedRole':'DENIED','result':'PASS'})
  result['publicChecks']=checks
 if phase=='deploy':
  result.pop('runtimeAndReaderPreserved',None);result['runtimeConfigurationPreserved']=True;result['readerUpdated']=True
 (folder/('sources-'+phase+'.json')).write_text(json.dumps(result,indent=2),encoding='utf8')
 return result

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('phase',choices=['prepare','build','collector','deploy','verify','recover']);parser.add_argument('--folder',required=True);args=parser.parse_args();folder=release.checked_folder(args.folder)
 print(json.dumps(prepare(folder) if args.phase=='prepare' else execute(folder,args.phase)))
