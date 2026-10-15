"""Exact-context Control/Web overlay. Preserve current Azure authentication and infrastructure."""
import base64,difflib,importlib.util,json,pathlib,subprocess,sys,zlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prior',ROOT/'scripts/qr-public-release.py');prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
FOLDER=ROOT/'artifacts/azure/security-period-20261015';REMOTE='/opt/highpass/security-period-20261015'
FILES={'control':['src/server.js','src/security-console.js'],'web':['public/ui/security-console.js','public/ui/security-console.css','public/ui/security-report.js','scripts/start-public-web.js']}
NEW={'control':['src/security-period-report.js'],'web':['public/ui/security-period-panel.js']}
def patch(name,old):
 if name=='scripts/start-public-web.js':return old
 before=subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT).decode().replace('\r\n','\n')
 after=(ROOT/name).read_text(encoding='utf8').replace('\r\n','\n');a,b=before.splitlines(True),after.splitlines(True)
 for group in difflib.SequenceMatcher(None,a,b,autojunk=False).get_grouped_opcodes(3):
  left=''.join(a[group[0][1]:group[-1][2]]);right=''.join(b[group[0][3]:group[-1][4]])
  if old.count(left)!=1:raise ValueError(f'CONTEXT_CHANGED: {name}:{group[0][1]+1}')
  old=prior.once(old,left,right)
 return old
def main():
 phase=sys.argv[1];FOLDER.mkdir(parents=True,exist_ok=True)
 source=(ROOT/'scripts/patient-viewer-rollout-remote.py').read_text().replace('/opt/highpass/patient-viewer-rollout-20261013',REMOTE).replace('highpass-patient-viewer:','highpass-security-period:')
 client=prior.runtime.connect('CLOUD',None)
 try:
  if phase=='capture':
   result=prior.runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD","capture",'+repr(FILES)+')))',55)
   (FOLDER/'capture-baseline.json').write_text(json.dumps(result));payload={};diff=[]
   for role,info in result.items():
    files={}
    for name,encoded in info['files'].items():
     old=base64.b64decode(encoded).decode().replace('\r\n','\n');new=patch(name,old)
     diff+=difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile=name,tofile=name)
     target=FOLDER/role/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_text(new,encoding='utf8',newline='\n');files[name]='z:'+base64.b64encode(zlib.compress(new.encode())).decode()
    for name in NEW[role]:
     data=(ROOT/name).read_bytes();target=FOLDER/role/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);files[name]='z:'+base64.b64encode(zlib.compress(data)).decode()
    payload[role]={'id':info['id'],'image':info['image'],'files':files}
   (FOLDER/'payload.json').write_text(json.dumps(payload));(FOLDER/'review.diff').write_text(''.join(diff),encoding='utf8');result={'status':'CAPTURED','files':FILES,'new':NEW}
   protected=prior.runtime.remote(client,'CLOUD',None,"import subprocess,json;print(json.dumps([{'id':x['Id'],'name':x['Name'],'image':x['Image']} for x in json.loads(subprocess.check_output(['docker','inspect']+subprocess.check_output(['docker','ps','-q']).decode().split()))]))",30)
   (FOLDER/'protected.json').write_text(json.dumps(protected))
  else:
   load='{}'
   if phase=='stage':
    with client.open_sftp() as ftp:ftp.put(str(FOLDER/'payload.json'),'/home/highpassadmin/.security-period-payload.json');ftp.chmod('/home/highpassadmin/.security-period-payload.json',0o600)
    load="json.loads(pathlib.Path('/home/highpassadmin/.security-period-payload.json').read_text())"
   result=prior.runtime.remote(client,'CLOUD',None,source+'\nprint(json.dumps(main("CLOUD",'+repr(phase)+','+load+')))',55)
   if phase=='verify':
    import hashlib
    expected={role:{name:hashlib.sha256((FOLDER/role/name).read_bytes()).hexdigest() for name in FILES[role]+NEW[role]} for role in FILES}
    code="import subprocess,json,hashlib;e="+repr(expected)+";names={'control':'hp-capstone-control-control-1','web':'hp-public-web-web-1'};checks=[]\nfor role,files in e.items():\n for path,sha in files.items():\n  raw=subprocess.check_output(['docker','exec',names[role],'/nodejs/bin/node','-e',\"process.stdout.write(require('fs').readFileSync(process.argv[1]))\",'/app/'+path]);checks.append(hashlib.sha256(raw).hexdigest()==sha)\nprint(json.dumps({'runtimeHashes':'PASS' if all(checks) else 'FAIL'}))"
    result.update(prior.runtime.remote(client,'CLOUD',None,code,30))
    baseline=json.loads((FOLDER/'protected.json').read_text());checks=prior.runtime.remote(client,'CLOUD',None,"import subprocess,json;b="+repr(baseline)+";r=[]\nfor p in b:\n if p['name'] in ['/hp-public-web-web-1','/hp-capstone-control-control-1']:continue\n v=json.loads(subprocess.check_output(['docker','inspect',p['name']]))[0];r.append(v['Id']==p['id'] and v['Image']==p['image'] and v['State']['Running'])\nprint(json.dumps({'protectedContainers':'PASS' if all(r) else 'FAIL'}))",30);result.update(checks)
  (FOLDER/(phase+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result))
 finally:client.close()
if __name__=='__main__':main()
