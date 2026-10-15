"""Read source readiness without printing user identities, request payloads, or raw logs."""
import json, pathlib, subprocess, re
from importlib.util import module_from_spec, spec_from_file_location
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=spec_from_file_location('sources_release',ROOT/'scripts/security-observatory-release.py');release=module_from_spec(spec);spec.loader.exec_module(release)
result={}
try:
 skus=release.graph('subscribedSkus?$select=skuPartNumber,capabilityStatus,servicePlans')['value']
 result['licenses']=[{'sku':sku['skuPartNumber'],'state':sku.get('capabilityStatus'),'entraPlans':[p.get('servicePlanName') for p in sku.get('servicePlans',[]) if 'AAD_' in p.get('servicePlanName','') or 'ENTRA' in p.get('servicePlanName','')]} for sku in skus]
except Exception:result['licenses']={'status':'NOT VERIFIED'}
try:
 diagnostics=release.identity.azure('rest','--method','get','--url','https://management.azure.com/providers/microsoft.aadiam/diagnosticSettings?api-version=2017-04-01-preview')
 result['entraDiagnostics']=[{'name':item.get('name'),'workspace':item.get('properties',{}).get('workspaceId'),'enabledCategories':[log.get('category') for log in item.get('properties',{}).get('logs',[]) if log.get('enabled')]} for item in diagnostics.get('value',[])]
except Exception:
 attempt=subprocess.run(['C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe','-IBm','azure.cli','rest','--method','get','--url','https://management.azure.com/providers/microsoft.aadiam/diagnosticSettings?api-version=2017-04-01-preview','--only-show-errors','-o','json'],capture_output=True,timeout=30)
 result['entraDiagnostics']={'status':'NOT VERIFIED','failureClasses':sorted(set(re.findall(r'AuthorizationFailed|Forbidden|AuthenticationFailed|InvalidApiVersionParameter|InvalidAuthenticationToken|Premium|License|Unauthorized',attempt.stderr.decode(errors='replace'))))}
client=release.runtime.connect('CLOUD',None)
try:
 result['waf']=release.runtime.remote(client,'CLOUD',None,r'''
import subprocess,json,re,hashlib
name='hp-public-web-waf-1'
c=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
p=subprocess.run(['docker','logs','--since','24h','--tail','1500',name],capture_output=True,timeout=10)
raw=(p.stdout+p.stderr).decode(errors='replace')[:2097152]
parts=re.findall(r'--[A-Za-z0-9_-]+-([A-Z])--',raw)
keys=set();errors=0
for line in raw.splitlines():
 try:
  item=json.loads(line)
  if isinstance(item,dict):keys.update(item.keys());errors+=str(item.get('level','')).lower()=='error'
 except (ValueError,TypeError):pass
mounts=[{'source':m['Source'],'target':m['Destination']} for m in c['Mounts'] if 'Caddyfile' in m['Destination']]
message_shapes={'ruleIds':set(),'deniedMessages':0,'warnings':0,'loggerNames':set()}
for line in raw.splitlines():
 try:
  entry=json.loads(line)
  if not isinstance(entry,dict):continue
  message=str(entry.get('msg',''))
  message_shapes['loggerNames'].add(str(entry.get('logger',''))[:80])
  message_shapes['ruleIds'].update(re.findall(r'\[id "(\d{4,8})"\]',message))
  message_shapes['deniedMessages']+=bool(re.search(r'Access denied|intervention|disruptive',message,re.I))
  message_shapes['warnings']+=bool(re.search(r'Warning',message,re.I))
 except (ValueError,TypeError):pass
message_shapes['ruleIds']=sorted(message_shapes['ruleIds']);message_shapes['loggerNames']=sorted(message_shapes['loggerNames'])
print(json.dumps({'running':c['State']['Running'],'image':c['Image'],'auditTransactions':parts.count('A'),'nativeParts':sorted(set(parts)),'jsonTopLevelKeys':sorted(keys),'errorRecords':errors,'boundedLogBytes':len(raw.encode()),'configMounts':mounts,'logDriver':c['HostConfig']['LogConfig']['Type'],'safeMessageShape':message_shapes}))
''',25)
finally:client.close()
client=release.runtime.connect('CLOUD',None)
try:
 result['entraWorkspace']=release.runtime.remote(client,'CLOUD',None,r'''
import subprocess,json
code="""
try {
 const u=new URL('http://169.254.169.254/metadata/identity/oauth2/token');u.searchParams.set('api-version','2018-02-01');u.searchParams.set('resource','https://api.loganalytics.io');
 const mr=await fetch(u,{headers:{Metadata:'true'},signal:AbortSignal.timeout(2500)});if(!mr.ok)throw new Error('IDENTITY_UNAVAILABLE');const token=(await mr.json()).access_token;
 const query=`SigninLogs | where TimeGenerated > ago(24h) | where AppId in ('3f8bd8d2-4a43-4ec4-849b-788c5f49ba74','e6893ab6-fb6a-4a1c-8390-df1698dae05e') | summarize count()`;
 const r=await fetch('https://api.loganalytics.azure.com/v1/workspaces/'+process.env.HIPASS_AUDIT_WORKSPACE_ID+'/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query,timespan:'PT24H'}),signal:AbortSignal.timeout(7000)});
 const data=await r.json();console.log(JSON.stringify({status:r.ok?'available':'unavailable',httpStatus:r.status,count:r.ok?data.tables?.[0]?.rows?.[0]?.[0]:null,errorClass:r.ok?null:(['BadArgumentError','InsufficientAccessError','PathNotFoundError'].includes(data.error?.code)?data.error.code:'QUERY_FAILED')}));
}catch{console.log(JSON.stringify({status:'NOT VERIFIED'}));}
"""
p=subprocess.run(['docker','exec','hp-security-audit-reader','/nodejs/bin/node','--input-type=module','-e',code],capture_output=True,timeout=15)
assert p.returncode==0
print(p.stdout.decode())
''',25)
finally:client.close()
print(json.dumps(result,ensure_ascii=False))
