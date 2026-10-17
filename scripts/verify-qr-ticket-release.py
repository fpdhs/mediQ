"""Verify delivered QR-ticket code and unchanged public authorization boundaries."""
import importlib.util,pathlib,json,urllib.request,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('verify',ROOT/'scripts/verify-qr-public-release.py');verify=importlib.util.module_from_spec(spec);spec.loader.exec_module(verify)
verify.FOLDER=ROOT/'artifacts/azure/qr-ticket-20261013'
results=[]
for name in ['public/app.js','public/ui/wallet-home.js','public/ui/patient-qr-ticket.js','public/ui/patient-qr-ticket.css','public/mobile/app.js','public/mobile/sw.js']:
 with urllib.request.urlopen(verify.ORIGIN+'/'+name.removeprefix('public/'),timeout=15) as r:data=r.read()
 results.append({'test':name,'result':'PASS' if data==(verify.FOLDER/name).read_bytes() else 'FAIL','sha256':hashlib.sha256(data).hexdigest()})
for route in ['/hipass/','/mobile/']:
 with urllib.request.urlopen(verify.ORIGIN+route,timeout=15) as r:html=r.read().decode()
 results.append({'test':route+' stylesheet','result':'PASS' if '/ui/patient-qr-ticket.css' in html else 'FAIL'})
for method,path,expected in [('POST','/api/consents/nonexistent/handoff-ticket',401),('GET','/api/consents/nonexistent/handoff-tickets/nonexistent',401),('POST','/api/demo/qr/redeem',401),('GET','/dicomweb/studies',403)]:
 request=urllib.request.Request(verify.ORIGIN+path,method=method,headers={'Origin':verify.ORIGIN,'Content-Type':'application/json'},data=b'{"replaceExisting":true}' if method=='POST' else None)
 try:r=urllib.request.urlopen(request,timeout=15)
 except verify.urllib.error.HTTPError as e:r=e
 with r:results.append({'test':method+' '+path,'status':r.status,'result':'PASS' if r.status==expected else 'FAIL'})
(verify.FOLDER/'public-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
raise SystemExit(int(any(r['result']=='FAIL' for r in results)))
