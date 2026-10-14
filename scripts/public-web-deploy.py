"""Deploy the selected existing-VM public web without exposing database/PACS ports."""
import argparse,hashlib,importlib.util,json,pathlib,shlex,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,ROOT/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def main():
 p=argparse.ArgumentParser();p.add_argument('phase',choices=['stage','activate','open','status','rollback']);p.add_argument('--receipt');a=p.parse_args()
 runtime=load('runtime','scripts/health-helper-runtime-check.py');config=load('config','scripts/entra-web-config.py');identity=load('identity','scripts/capstone-key-identities.py')
 folder=pathlib.Path(a.receipt).resolve() if a.receipt else config.protected_folder()
 assert folder.is_relative_to((ROOT/'artifacts/azure').resolve())
 stage='/home/highpassadmin/.highpass-public-'+folder.name.removeprefix('entra-web-')
 client=runtime.connect('CLOUD',None)
 result={'phase':a.phase,'review':'DRAFT / UNASSIGNED','stage':stage,'status':'FAIL'}
 try:
  if a.phase=='rollback' and (folder/'nsg-before.json').exists():
   before=json.loads((folder/'nsg-before.json').read_text());rule='Allow-Highpass-Public-HTTPS'
   if not any(x['name']==rule for x in before['securityRules']):
    account=identity.azure('account','show');assert account['id']==config.SUB and account['tenantId']==config.TENANT
    nsg=identity.azure('network','nsg','show','-g','rg-highpass-capstone-20261008','-n','nsg-highpass-capstone','--subscription',config.SUB)
    matches=[x for x in nsg['securityRules'] if x['name']==rule]
    if matches:
     x=matches[0];assert x['priority']==130 and x['destinationPortRange']=='443' and x['destinationAddressPrefix']=='10.89.0.4' and x['sourceAddressPrefix']=='Internet'
     identity.azure('network','nsg','rule','delete','-g','rg-highpass-capstone-20261008','--nsg-name','nsg-highpass-capstone','-n',rule,'--subscription',config.SUB)
  if a.phase=='stage':
   source=ROOT/'artifacts/azure/entra-web-20261013T051144Z-e56d9a';manifest=json.loads((source/'candidate.json').read_text())
   archive=folder/'images.tar';subprocess.run(['docker','save','-o',str(archive),*[x['image'] for x in manifest['roles'].values()]],check=True,timeout=180)
   with archive.open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
   print(json.dumps({'phase':'UPLOAD','bytes':archive.stat().st_size,'receipt':str(folder)}),flush=True)
   started=time.monotonic()
   def progress(done,total):
    if time.monotonic()-started>600:raise RuntimeError('TRANSFER_TIMEOUT')
   with client.open_sftp() as sftp:
    sftp.get_channel().settimeout(20);sftp.mkdir(stage,0o700);sftp.put(str(archive),stage+'/images.tar',callback=progress)
    for src,dest in [(source/'candidate.json','candidate.json'),(ROOT/'scripts/start-public-web.js','start-public-web.js'),(ROOT/'infra/azure/public-web.Caddyfile','Caddyfile'),
      (ROOT/'artifacts/azure/entra-web-20261013T045424Z-130b4c/entra-actors.json','actors.json'),(ROOT/'artifacts/azure/entra-web-20261013T045424Z-130b4c/runtime-config.json','runtime.json')]:
     sftp.put(str(src),stage+'/'+dest);sftp.chmod(stage+'/'+dest,0o600)
    with sftp.open(stage+'/archive.json','w') as f:f.write(json.dumps({'sha256':digest}))
   result['archiveSha256']=digest
  if a.phase=='open':
   live=runtime.remote(client,'CLOUD',None,"import subprocess,json\nnames=['hp-capstone-control-control-1','hp-public-web-web-1','hp-public-web-waf-1']\na=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=10))\nassert all(x['State']['Running'] and x['RestartCount']==0 for x in a)\nassert a[0]['State']['Health']['Status']=='healthy'\nprint(json.dumps({'ready':True}))",20)
   account=identity.azure('account','show');assert account['id']==config.SUB and account['tenantId']==config.TENANT
   nic=identity.azure('network','nic','show','-g','rg-highpass-capstone-20261008','-n','nic-highpass-capstone','--subscription',config.SUB)
   assert nic['ipConfigurations'][0]['privateIPAddress']=='10.89.0.4'
   record=json.loads((ROOT/'artifacts/azure/entra-web-20261013T045424Z-130b4c/result.json').read_text())
   spa=record['apps']['SPA']['objectId'];url='https://graph.microsoft.com/v1.0/applications/'+spa
   app=identity.azure('rest','--method','get','--url',url);before=app['spa']['redirectUris'];target='https://highpass-demo.japaneast.cloudapp.azure.com/entra-redirect.html'
   (folder/'redirect-before.json').write_text(json.dumps(before))
   if target not in before:identity.azure('rest','--method','patch','--url',url,'--body',json.dumps({'spa':{'redirectUris':before+[target]}}))
   query=('network','nsg','show','-g','rg-highpass-capstone-20261008','-n','nsg-highpass-capstone','--subscription',config.SUB)
   nsg=identity.azure(*query);(folder/'nsg-before.json').write_text(json.dumps(nsg,indent=2))
   rule='Allow-Highpass-Public-HTTPS';existing=[r for r in nsg['securityRules'] if r['name']==rule]
   if existing:
    x=existing[0];assert x['access']=='Allow' and x['direction']=='Inbound' and x['protocol'].lower()=='tcp' and x['destinationPortRange']=='443' and x['destinationAddressPrefix']=='10.89.0.4' and x['sourceAddressPrefix']=='Internet'
   if not existing:
    assert all(r['priority']!=130 for r in nsg['securityRules'])
    identity.azure('network','nsg','rule','create','-g','rg-highpass-capstone-20261008','--nsg-name','nsg-highpass-capstone','-n',rule,
     '--priority','130','--direction','Inbound','--access','Allow','--protocol','Tcp','--source-address-prefixes','Internet','--source-port-ranges','*',
     '--destination-address-prefixes','10.89.0.4','--destination-port-ranges','443','--subscription',config.SUB)
   result['httpsOpened']=True;result['url']='https://highpass-demo.japaneast.cloudapp.azure.com'
  else:
   with client.open_sftp() as sftp:
    sftp.put(str(ROOT/'scripts/public-web-remote.py'),stage+'/operator.py');sftp.chmod(stage+'/operator.py',0o600)
   code,output=runtime.ops.run(client,'sudo -n timeout 420s python3 '+shlex.quote(stage+'/operator.py')+' '+shlex.quote(stage)+' '+a.phase,seconds=425)
   (folder/(a.phase+'-output.log')).write_text(output,encoding='utf8')
   if code:raise RuntimeError('REMOTE_'+a.phase.upper()+'_FAILED')
   result['result']=json.loads(output)
  result['status']='PASS'
 except Exception as e:result['reason']=str(e) if isinstance(e,RuntimeError) else type(e).__name__
 finally:client.close()
 (folder/(a.phase+'-result.json')).write_text(json.dumps(result,indent=2));print(json.dumps({**result,'receipt':str(folder)}),flush=True)
 return 0 if result['status']=='PASS' else 2
if __name__=='__main__':raise SystemExit(main())
