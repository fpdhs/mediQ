"""Attach a fixed-query Unix-socket audit reader without opening Control egress."""
import argparse
import base64
import json
import pathlib
from importlib.util import module_from_spec, spec_from_file_location

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = spec_from_file_location('security_release', ROOT / 'scripts/security-observatory-release.py')
release = module_from_spec(spec)
spec.loader.exec_module(release)

EXTENSION = r'''
assert control['Image']==MANIFEST['candidates']['control'] and web['Image']==MANIFEST['candidates']['web'], 'AUDIT_EXTENSION_BASELINE_CHANGED'
extension=folder/'audit-extension';extension.mkdir(mode=0o711)
before={'control':control,'web':web};images={}
for role,files in FILES.items():
 source=extension/role;source.mkdir(mode=0o755)
 for path,encoded in files.items():
  target=source/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(base64.b64decode(encoded));target.chmod(0o755)
  for parent in target.parents:
   if parent==source:break
   parent.chmod(0o755)
 base='highpass-audit-base:'+before[role]['Image'][7:23];run(['docker','tag',before[role]['Image'],base])
 (source/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY --chmod=755 '+p+' /app/'+p+'\n' for p in files))
 tag='highpass-audit-'+role+':'+MANIFEST['operation']
 run(['docker','build','--network=none','--pull=false','-t',tag,str(source)],180)
 candidate=inspect(tag);assert candidate['Config']==inspect(before[role]['Image'])['Config']
 images[role]=candidate['Id']
 for path in files:
  if path.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',candidate['Id'],'--check','/app/'+path])
test=extension/'azure-keyvault-audit.test.js';test.write_bytes(base64.b64decode(TEST));test.chmod(0o444)
test_output=run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','-v',str(test)+':/app/test/azure-keyvault-audit.test.js:ro','--entrypoint=/nodejs/bin/node',images['control'],'--test','/app/test/azure-keyvault-audit.test.js'])
(extension/'tests.log').write_bytes(test_output);(extension/'tests.log').chmod(0o600)
socket_dir=extension/'socket';socket_dir.mkdir(mode=0o770);os.chown(socket_dir,65532,65532);socket_dir.chmod(0o770)
probe="const h=require('http');const r=h.get({socketPath:'/run/security-audit/audit.sock',path:'/health'},s=>process.exit(s.statusCode===200?0:1));r.setTimeout(2000,()=>r.destroy());r.on('error',()=>process.exit(2));"
relay={'services':{'reader':{'container_name':'hp-security-audit-reader','image':images['control'],
 'command':['scripts/start-security-audit-relay.js'],'user':'65532','read_only':True,'cap_drop':['ALL'],
 'security_opt':['no-new-privileges:true'],'pids_limit':64,'mem_limit':'128m','cpus':0.25,'restart':'unless-stopped',
 'environment':{'NODE_ENV':'production','HIPASS_AZURE_AUDIT_MI_ENABLED':'1','HIPASS_AUDIT_WORKSPACE_ID':MANIFEST['workspaceId']},
 'volumes':[{'type':'bind','source':str(socket_dir),'target':'/run/security-audit','read_only':False,'bind':{'create_host_path':False}}],
 'networks':['audit_out'],'healthcheck':{'test':['CMD','/nodejs/bin/node','-e',probe],'interval':'10s','timeout':'4s','retries':3,'start_period':'3s'}}},
 'networks':{'audit_out':{'internal':False}}}
save(extension/'reader.json',relay)
for role,old in before.items():
 conf=config_for(old,'hp-public-web' if role=='web' else 'hp-capstone-control');save(extension/(role+'-before.json'),conf)
 conf=copy.deepcopy(conf);service=conf['services'][role];service['image']=images[role]
 if role=='control':
  service['environment']['HIPASS_AUDIT_SOCKET']='/run/security-audit/audit.sock'
  service.setdefault('volumes',[]).append({'type':'bind','source':str(socket_dir),'target':'/run/security-audit','read_only':True,'bind':{'create_host_path':False}})
 save(extension/(role+'-after.json'),conf)
def extend_switch(role,suffix):
 run(['docker','compose','-p','hp-public-web' if role=='web' else 'hp-capstone-control','-f',str(extension/(role+'-'+suffix+'.json')),'up','-d','--no-deps','--pull','never',role])
 for attempt in range(45):
  c=inspect(names[role]);health=c['State'].get('Health',{}).get('Status')
  if c['State']['Running'] and (role=='web' or health=='healthy'):return c
  time.sleep(1)
 raise RuntimeError('AUDIT_EXTENSION_HEALTH_FAILED')
relay_cmd=['docker','compose','-p','hp-security-audit','-f',str(extension/'reader.json')]
changed=[];reader_started=False
try:
 if subprocess.run(['docker','inspect','hp-security-audit-reader'],capture_output=True).returncode==0:raise RuntimeError('AUDIT_READER_NAME_ALREADY_EXISTS')
 run(relay_cmd+['up','-d','--pull','never'],60)
 reader_started=True
 for attempt in range(30):
  reader=inspect('hp-security-audit-reader')
  if reader['State'].get('Health',{}).get('Status')=='healthy':break
  time.sleep(1)
 assert reader['State']['Health']['Status']=='healthy' and not reader['HostConfig']['PortBindings']
 query="const h=await import('node:http');const r=await new Promise((resolve,reject)=>{const q=h.get({socketPath:'/run/security-audit/audit.sock',path:'/keyvault-audit'},s=>{let b='';s.on('data',c=>b+=c);s.on('end',()=>resolve(JSON.parse(b)));});q.on('error',reject);});console.log(JSON.stringify({status:r.status,reason:r.reason,count:r.events?.length}));"
 azure=json.loads(run(['docker','exec','hp-security-audit-reader','/nodejs/bin/node','--input-type=module','-e',query],25))
 if azure['status']!='available':raise RuntimeError('AZURE_AUDIT_READER_'+str(azure.get('reason') or azure['status']))
 for role in ['control','web']:
  changed.append(role);live=extend_switch(role,'after')
  assert live['Image']==images[role]
  assert live['NetworkSettings']['Networks'].keys()==before[role]['NetworkSettings']['Networks'].keys(),'CONTROL_NETWORK_ISOLATION_CHANGED'
  for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:assert live['HostConfig'][key]==before[role]['HostConfig'][key]
  expected=env_for(before[role])
  if role=='control':expected['HIPASS_AUDIT_SOCKET']='/run/security-audit/audit.sock'
  assert env_for(live)==expected
  for mount in before[role]['Mounts']:assert mount in live['Mounts']
  assert len(live['Mounts'])==len(before[role]['Mounts'])+(1 if role=='control' else 0)
 code="const a=await import('/app/src/azure-keyvault-audit.js');const r=await a.listAzureKeyVaultAudit();console.log(JSON.stringify({status:r.status,reason:r.reason,count:r.events.length}));"
 result=json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','--input-type=module','-e',code],25));assert result['status']=='available'
 deny="const h=require('http');Promise.all(['/token','/keyvault-audit?url=http://other'].map(path=>new Promise(resolve=>h.get({socketPath:'/run/security-audit/audit.sock',path},r=>{r.resume();resolve(r.statusCode)})))).then(c=>console.log(JSON.stringify(c)));"
 assert json.loads(run(['docker','exec',names['control'],'/nodejs/bin/node','-e',deny]))==[403,403]
 for protected in MANIFEST['baseline'][2:]:assert inspect(protected['name'])['Id']==protected['id']
except Exception:
 for role in reversed(changed):extend_switch(role,'before')
 if reader_started:run(relay_cmd+['stop'],30)
 raise
print(json.dumps({'status':'PASS','images':images,'azureKeyVault':result,'controlNetworksUnchanged':True,
 'publicPortsUnchanged':True,'relayTokenAndArbitraryQueryDenied':True,'relayConfiguration':str(extension/'reader.json'),
 'rollbackConfigurations':[str(extension/(role+'-before.json')) for role in names]}))
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', required=True)
    args = parser.parse_args()
    folder = release.checked_folder(args.folder)
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf8'))
    manifest['actorMapHash'] = release.digest((folder / 'candidate/actors.json').read_bytes())
    files = {'control': {p: (ROOT / p).read_bytes() for p in ['src/azure-keyvault-audit.js', 'scripts/start-security-audit-relay.js']},
             'web': {'public/ui/capstone-login.css': (ROOT / 'public/ui/capstone-login.css').read_bytes()}}
    prefix = (ROOT / 'scripts/security-observatory-remote.py').read_text(encoding='utf8').split("if PHASE == 'build':", 1)[0]
    program = 'MANIFEST=' + repr(manifest) + "\nPHASE='audit-relay'\nFILES=" + repr({r: {p: base64.b64encode(b).decode() for p, b in fs.items()} for r, fs in files.items()})
    program += '\nTEST=' + repr(base64.b64encode((ROOT / 'test/azure-keyvault-audit.test.js').read_bytes()).decode()) + '\n' + prefix
    program += "\ncontrol=inspect(names['control']);web=inspect(names['web'])\n" + EXTENSION
    client = release.runtime.connect('CLOUD', None)
    try:
        result = release.runtime.remote(client, 'CLOUD', None, program, 400)
        (folder / 'audit-relay.json').write_text(json.dumps(result, indent=2), encoding='utf8')
        manifest['candidates'] = result['images']
        for role, fs in files.items():
            for path, body in fs.items():
                manifest['roles'][role]['hashes'][path] = release.digest(body)
                target = folder / 'candidate' / role / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(body)
        (folder / 'final-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')
        print(json.dumps(result))
    finally:
        client.close()


if __name__ == '__main__':
    main()
