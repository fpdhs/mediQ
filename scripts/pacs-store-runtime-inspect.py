"""Read-only pinned runtime check; no credentials or tokens in evidence."""
import importlib.util,json,pathlib,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pacs_deploy',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
PROGRAM=r'''
import json,subprocess,pathlib,hashlib
names=['hp-public-web-web-1','hp-capstone-control-control-1']
items=json.loads(subprocess.check_output(['docker','inspect',*names]));result=[]
for c in items:
 env=dict(v.split('=',1) for v in c['Config']['Env'])
 entry=[m for m in c['Mounts'] if m['Destination'].endswith('/start-public-web.js')]
 files={}
 for file in (['public/app.js'] if 'web-web' in c['Name'] else ['src/pacs-transfer-jobs.js','src/pacs-transfer-job-http.js']):
  p=subprocess.run(['docker','exec',c['Id'],'/nodejs/bin/node','-e',"const f=require('fs');try{process.stdout.write(f.readFileSync(process.argv[1]))}catch{process.exit(3)}",'/app/'+file],capture_output=True,timeout=8)
  files[file]={'exists':p.returncode==0,'sha256':hashlib.sha256(p.stdout).hexdigest() if p.returncode==0 else None}
 result.append({'name':c['Name'],'imageId':c['Image'],'healthy':c['State'].get('Health',{}).get('Status'),
  'jobsEnabled':env.get('HIPASS_CAPSTONE_PACS_TRANSFER_JOBS')=='1','jobsDatabaseConfigured':bool(env.get('HIPASS_PACS_TRANSFER_DATABASE_URL') or env.get('HIPASS_PACS_TRANSFER_DATABASE_URL_FILE')),
  'startupBind':entry[0]['Source'] if entry else None,'files':files})
print(json.dumps({'runtimes':result}))
'''
def main():
 client=deploy.rollout.inventory.check.connect('CLOUD',None)
 try:result=deploy.rollout.inventory.check.remote(client,'CLOUD',None,PROGRAM)
 finally:client.close()
 folder=ROOT/'artifacts/workstation'/('pacs-store-inspect-'+uuid.uuid4().hex);folder.mkdir(parents=True)
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
 print(json.dumps({**result,'evidence':str(folder/'result.json')}))
if __name__=='__main__':main()
