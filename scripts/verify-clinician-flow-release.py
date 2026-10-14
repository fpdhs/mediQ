import json,pathlib,urllib.request,urllib.error,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1];FOLDER=ROOT/'artifacts/azure/clinician-flow-20261014';ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com';results=[]
for name in ['public/app.js','public/ui/clinician-reception.js','public/ui/clinician-reception.css','public/ui/clinician-reception-desk.js','public/ui/clinician-health.js']:
 with urllib.request.urlopen(ORIGIN+'/'+name.removeprefix('public/'),timeout=15) as r:data=r.read()
 expected=ROOT/'artifacts/azure/clinician-flow-context-20261014'/name if name in ['public/app.js','public/ui/clinician-health.js'] else FOLDER/name
 results.append({'test':name,'result':'PASS' if data==expected.read_bytes() else 'FAIL','sha256':hashlib.sha256(data).hexdigest()})
with urllib.request.urlopen(ORIGIN+'/hipass/',timeout=15) as r:html=r.read().decode()
results.append({'test':'workflow route mapping','result':'PASS' if 'data-view-jump="dashboard"><span aria-hidden="true">01</span>QR 접수' in html and 'data-view-jump="studies"><span aria-hidden="true">04</span>검사 선택·영상 열기' in html else 'FAIL'})
for method,path,expected in [('GET','/api/clinician/receptions',401),('POST','/api/demo/qr/redeem',401),('GET','/dicomweb/studies',403)]:
 req=urllib.request.Request(ORIGIN+path,method=method,headers={'Origin':ORIGIN,'Content-Type':'application/json'},data=b'{}' if method=='POST' else None)
 try:r=urllib.request.urlopen(req,timeout=15)
 except urllib.error.HTTPError as e:r=e
 with r:results.append({'test':method+' '+path,'status':r.status,'result':'PASS' if r.status==expected else 'FAIL'})
(FOLDER/'public-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
raise SystemExit(int(any(r['result']=='FAIL' for r in results)))
