"""Rehearse the metadata-only network on Cloud using owned temporary resources."""
import base64, hashlib, importlib.util, json, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def main():
    runtime=load('entra_cloud_runtime',ROOT/'scripts/health-helper-runtime-check.py')
    config=load('entra_cloud_config',ROOT/'scripts/entra-web-config.py')
    folder=config.protected_folder()
    files={p:base64.b64encode((ROOT/p).read_bytes()).decode() for p in ['src/entra-metadata.js','scripts/start-entra-metadata.js']}
    program='FILES='+repr(files)+'\nTENANT='+repr(config.TENANT)+'\n'+r'''
import subprocess,json,pathlib,tempfile,base64,uuid,time,hashlib
def run(args,timeout=20):return subprocess.check_output(args,stderr=subprocess.PIPE,timeout=timeout)
before=json.loads(run(['docker','inspect','hp-capstone-control-control-1']))[0]
base=before['Image'];stamp=uuid.uuid4().hex[:10];prefix='hp-entra-check-'+stamp
folder=pathlib.Path(tempfile.mkdtemp(prefix=prefix+'-',dir='/tmp'));folder.chmod(0o755)
net_private=prefix+'-private';net_out=prefix+'-out';name=prefix+'-relay';owned=[];out={}
try:
 for rel,value in FILES.items():
  target=folder/rel;target.parent.mkdir(exist_ok=True);target.write_bytes(base64.b64decode(value));target.chmod(0o644)
 for name_net,internal in [(net_private,True),(net_out,False)]:
  run(['docker','network','create','--label','highpass.entra-check='+stamp]+(['--internal'] if internal else [])+[name_net]);owned.append(('network',name_net))
 run(['docker','run','-d','--name',name,'--label','highpass.entra-check='+stamp,'--network',net_private,'--network-alias','entra-metadata','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=128m','--pids-limit=64','--mount','type=bind,source='+str(folder)+',target=/validation,readonly','-e','ENTRA_TENANT_ID='+TENANT,'--entrypoint=/nodejs/bin/node',base,'/validation/scripts/start-entra-metadata.js']);owned.append(('container',name))
 run(['docker','network','connect',net_out,name])
 probe="const out={};for(const p of ['/discovery','/tenant-keys','/common-keys','/token','/common-keys?url=http://169.254.169.254']){try{const r=await fetch('http://entra-metadata:8080'+p,{signal:AbortSignal.timeout(7000)});const b=await r.json();out[p]={status:r.status,keys:Array.isArray(b.keys)?b.keys.length:undefined,issuerMatches:b.issuer===('https://login.microsoftonline.com/"+TENANT+"/v2.0')}}catch{out[p]={error:'FETCH_FAILED'}}}try{await fetch('https://login.microsoftonline.com/',{signal:AbortSignal.timeout(2000)});out.directInternet='REACHABLE'}catch{out.directInternet='BLOCKED'}console.log(JSON.stringify(out))"
 out['checks']=json.loads(run(['docker','run','--rm','--network',net_private,'--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',base,'--input-type=module','-e',probe],40))
 relay=json.loads(run(['docker','inspect',name]))[0]
 out['relayPorts']=relay['HostConfig']['PortBindings'];out['relayBaseImage']=base
 out['sourceHashes']={k:hashlib.sha256(base64.b64decode(v)).hexdigest() for k,v in FILES.items()}
 out['status']='PASS' if all(out['checks'].get(p,{}).get('status')==200 for p in ['/discovery','/tenant-keys','/common-keys']) and all(out['checks'].get(p,{}).get('status')==403 for p in ['/token','/common-keys?url=http://169.254.169.254']) and out['checks']['directInternet']=='BLOCKED' and not out['relayPorts'] else 'FAIL'
finally:
 for kind,resource in reversed(owned):
  data=json.loads(run(['docker',kind,'inspect',resource]))[0]
  labels=data['Config']['Labels'] if kind=='container' else data['Labels']
  assert labels.get('highpass.entra-check')==stamp
  run(['docker','rm','-f',resource] if kind=='container' else ['docker','network','rm',resource])
 for rel in FILES:(folder/rel).unlink()
 for child in [folder/'src',folder/'scripts']:child.rmdir()
 folder.rmdir()
 after=json.loads(run(['docker','inspect','hp-capstone-control-control-1']))[0]
 out['liveContainerUnchanged']=before['Id']==after['Id'] and before['Image']==after['Image'] and before['NetworkSettings']['Networks']==after['NetworkSettings']['Networks']
 out['cleanup']='PASS'
print(json.dumps(out))
'''
    client=runtime.connect('CLOUD',None)
    try:result=runtime.remote(client,'CLOUD',None,program,100)
    finally:client.close()
    result.update(review='DRAFT / UNASSIGNED',scope='ISOLATED_CLOUD_METADATA_REHEARSAL_NOT_LIVE_DEPLOYMENT')
    (folder/'metadata-cloud.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({'status':result['status'],'liveContainerUnchanged':result['liveContainerUnchanged'],'cleanup':result['cleanup'],'evidence':str(folder/'metadata-cloud.json')}))
    return 0 if result['status']=='PASS' and result['liveContainerUnchanged'] else 2
if __name__=='__main__':raise SystemExit(main())
