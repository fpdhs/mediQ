"""Verify public denial boundaries and deployed hashes without reading user tokens."""
import hashlib,importlib.util,json,pathlib,urllib.request,urllib.error,uuid
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('store_verify',ROOT/'scripts/single-import-check-deploy.py')
deploy=importlib.util.module_from_spec(spec);spec.loader.exec_module(deploy)
PROGRAM=r'''
import json,subprocess,urllib.parse,pathlib
pg=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-control-postgres-1']))[0]
env=dict(value.split('=',1) for value in pg['Config']['Env'])
def sql(statement):
 p=subprocess.run(['docker','exec','-i','-u','postgres',pg['Id'],'psql','-U',env['POSTGRES_USER'],'-d',env['POSTGRES_DB'],'-v','ON_ERROR_STOP=1','-At'],input=statement,text=True,capture_output=True,timeout=15)
 if p.returncode:raise RuntimeError('PACS_VERIFY_DATABASE_FAILED')
 return p.stdout.strip()
control=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-control-control-1']))[0]
uri_mount=next(m for m in control['Mounts'] if m['Destination']=='/run/pacs-jobs/database-url')
active=urllib.parse.urlsplit(pathlib.Path(uri_mount['Source']).read_text()).username
orphan='hp_pacs_jobs_f575d41cc3c5'
if active==orphan:raise RuntimeError('PACS_ORPHAN_ROLE_IS_ACTIVE')
if sql("SELECT count(*) FROM pg_roles WHERE rolname='"+orphan+"'")=='1':sql('ALTER ROLE '+orphan+' NOLOGIN;')
jobs=sql("SELECT json_build_object('jobs',count(*),'verifiedJobs',count(*) FILTER(WHERE state='COMPLETED' AND succeeded_items=total_items AND failed_items=0),'failedJobs',count(*) FILTER(WHERE state='FAILED')) FROM capstone_pacs_transfer_jobs;")
audit=sql("SELECT coalesce(json_agg(x),'[]') FROM (SELECT action,result,CASE WHEN reason_code ~ '^[A-Z][A-Z0-9_]{0,63}$' THEN reason_code ELSE NULL END AS reason_code,count(*) FROM audit_logs WHERE created_at > now()-interval '30 minutes' AND (action LIKE 'PACS_%' OR action LIKE 'KEY_RELEASE_%') GROUP BY action,result,reason_code) x;")
print(json.dumps({'orphanRoleDisabled':sql("SELECT count(*) FROM pg_roles WHERE rolname='"+orphan+"' AND rolcanlogin")=='0','jobCounts':json.loads(jobs),'auditCounts':json.loads(audit),'jobSecretReadonly':uri_mount['RW']==False,'activeRolePrivileged':sql("SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname='"+active+"'")=='t'}))
'''
def request(url,method='GET',headers=None):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,method=method,headers=headers or {}),timeout=30) as response:return response.status,response.read(1048577)
 except urllib.error.HTTPError as error:return error.code,b''
 except (urllib.error.URLError,TimeoutError):return 0,b''
def main():
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('candidate');args=parser.parse_args()
 candidate=ROOT/args.candidate;checks=[]
 web='https://highpass-demo.japaneast.cloudapp.azure.com'
 for file in ['public/app.js','public/ui/transfer-actions.js','public/ui/transfer-actions.css','public/ui/import-preflight.js']:
  status,body=request(web+'/'+file.removeprefix('public/'));checks.append({'test':file,'status':'PASS' if status==200 and hashlib.sha256(body).digest()==hashlib.sha256((candidate/file).read_bytes()).digest() else 'FAIL'})
 for route in ['/api/pacs-transfer-jobs/history','/api/pacs-transfer-jobs/active']:
  status,_=request(web+route);checks.append({'test':'unauthenticated '+route,'httpStatus':status,'status':'PASS' if status==401 else 'FAIL'})
 image='https://highpass-images-b.japaneast.cloudapp.azure.com'
 path='/dicomweb/studies/2.25.259656708708993797343330994179169711072/series/2.25.18361638789025095699746776899955737977/instances/2.25.41201726628454317744442406717668675255'
 for method,suffix,headers,expected in [('GET','/download',{'Origin':web},403),('GET','',{'Origin':web},403),('POST','/import',{'Origin':'https://example.invalid'},403),('POST','/import',{'Origin':web},401),('OPTIONS','/import',{'Origin':web,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,dpop,x-hipass-transfer-item-id,x-hipass-transfer-job-id,x-hipass-transfer-lease-id'},204)]:
  status,_=request(image+path+suffix,method,headers);checks.append({'test':method+' '+suffix+' expected '+str(expected),'httpStatus':status,'status':'PASS' if status==expected else 'FAIL'})
 client=deploy.rollout.inventory.check.connect('CLOUD',None)
 try:database=deploy.rollout.inventory.check.remote(client,'CLOUD',None,PROGRAM)
 finally:client.close()
 folder=ROOT/'artifacts/workstation'/('pacs-store-verify-'+uuid.uuid4().hex);folder.mkdir(parents=True)
 result={'checks':checks,'database':database,'status':'PASS' if all(c['status']=='PASS' for c in checks) and not database['activeRolePrivileged'] and database['jobSecretReadonly'] else 'FAIL'}
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
if __name__=='__main__':main()
