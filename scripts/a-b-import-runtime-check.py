"""Read-only deployed A/B/Control import contract inventory; never prints secrets."""
import argparse
import importlib.util
import json
import pathlib
import re
import shlex
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]

def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

check = load('import_runtime', 'health-helper-runtime-check.py')
preflight = load('import_preflight', 'capstone-a-sender-preflight.py')

PROGRAM = r'''
import base64,hashlib,json,subprocess
name=request['name']
c=json.loads(subprocess.check_output(['docker','inspect',name],timeout=12))[0]
env=dict(item.split('=',1) for item in c['Config'].get('Env',[]) if '=' in item)
files=['src/server.js','src/consent-bound-key-release.js','src/data-plane-authorization.js',
       'src/data-plane-gateway.js','src/capstone-encrypted-transfer.js','src/capstone-b-portal.js',
       'src/b-pacs-receiver.js','src/pacs-transfer-job-service.js','scripts/start-capstone-b-portal.js',
       'src/key-release-http-handler.js','src/hcc-source-contract.js','src/patient-public-origins.js']
rows=[]
for file in files:
 p=subprocess.run(['docker','exec',name,'/nodejs/bin/node','--input-type=module','-e',
  "import fs from 'node:fs';import{createHash}from'node:crypto';let p="+json.dumps('/app/'+file)+";if(!fs.existsSync(p)){console.log(JSON.stringify({exists:false}));process.exit(0)}let b=fs.readFileSync(p);console.log(JSON.stringify({exists:true,sha256:createHash('sha256').update(b).digest('hex'),hasImportRoute:b.includes(Buffer.from('import-authorize')),hasWrapRoute:b.includes(Buffer.from('wrap-authorize')),hasPacsReceiver:b.includes(Buffer.from('createBPacsReceiver')),hasJobRepository:b.includes(Buffer.from('transferJobRepository'))}));"],capture_output=True,text=True,timeout=12)
 rows.append({'path':file,'probeExitCode':p.returncode,**(json.loads(p.stdout) if p.returncode==0 else {})})
 if request.get('capture') and rows[-1].get('exists'):
  capture=subprocess.run(['docker','exec',name,'/nodejs/bin/node','-e',"console.log(require('fs').readFileSync(process.argv[1]).toString('base64'))",'/app/'+file],capture_output=True,text=True,timeout=12)
  if capture.returncode:raise RuntimeError('SOURCE_CAPTURE_FAILED')
  rows[-1]['sourceBase64']=capture.stdout.strip()
print(json.dumps({'name':name,'imageId':c['Image'],'running':c['State']['Running'],
 'health':c['State'].get('Health',{}).get('Status'),
 'flags':{key:env.get(key) for key in ['HIPASS_B_PACS_IMPORT_ENABLED','CAPSTONE_B_PACS_IMPORT_ENABLED','HIPASS_CONTROL_PLANE_ONLY','CAPSTONE_IMAGE_ENCRYPTION_REQUIRED']},
 'mounts':[{'source':m['Source'],'destination':m['Destination'],'readOnly':not m['RW']} for m in c['Mounts']],
 'networks':list(c['NetworkSettings']['Networks']), 'composeFiles':c['Config']['Labels'].get('com.docker.compose.project.config_files'),
 'files':rows}))
'''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gui',action='store_true')
    parser.add_argument('--capture',action='store_true')
    args=parser.parse_args()
    folder=ROOT/'artifacts/workstation'/('a-b-import-runtime-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False)
    credentials={};result={'status':'NOT VERIFIED','readOnly':True,'consentCreated':False,'importExecuted':False,'runtimes':{}}
    try:
        credentials=preflight.collect_vm_credentials(gui=args.gui)
        for role,name in [('A','hp-capstone-a-gateway-gateway-1'),('B','hp-capstone-b-portal-portal-1'),('CLOUD','hp-capstone-control-control-1')]:
            credential=credentials.get(role)
            result['phase']=role+'_READ_ONLY_INVENTORY'
            trust=preflight.ops_module.LocalVmTrust() if role=='A' else None
            client=preflight.connect_vm(role,credential,trust,folder) if role=='A' else check.connect(role,credential)
            try:
                program='request='+repr({'name':name,'capture':args.capture})+'\n'+PROGRAM
                if role=='A':
                    value=preflight.remote_json(client,"sudo -S -p '' timeout 145s python3 -c "+shlex.quote(program),credential,150)
                else:value=check.remote(client,role,credential,program,145)
                result['runtimes'][role]=value
            finally:
                client.close()
                if trust is not None:trust.close()
        result['status']='PASS'
    except BaseException as error:
        result['reason']=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Za-z0-9_,]+',str(error)) else type(error).__name__
    finally:credentials.clear()
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({'status':result['status'],'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
