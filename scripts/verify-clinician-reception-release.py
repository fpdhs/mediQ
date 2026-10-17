"""Verify exact served overlay and unauthenticated rejection; no patient ticket consumed."""
import pathlib,json,urllib.request,urllib.error,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[1];FOLDER=ROOT/'artifacts/azure/clinician-reception-20261013'
ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com'
results=[]
for name in ['public/app.js','public/ui/clinician-reception.js','public/ui/clinician-reception.css']:
 with urllib.request.urlopen(ORIGIN+'/'+name.removeprefix('public/'),timeout=15) as r:data=r.read()
 results.append({'test':name,'result':'PASS' if data==(FOLDER/name).read_bytes() else 'FAIL','sha256':hashlib.sha256(data).hexdigest()})
with urllib.request.urlopen(ORIGIN+'/hipass/',timeout=15) as r:html=r.read().decode()
results.append({'test':'home and desk routes served','result':'PASS' if 'class="mq-screen share-reception" data-screen="dashboard"' in html and 'id="clinical-home" data-screen="qr" hidden' in html and '/ui/clinician-reception.css' in html else 'FAIL'})
for method,path,expected in [('POST','/api/demo/qr/redeem',401),('GET','/dicomweb/studies',403)]:
 req=urllib.request.Request(ORIGIN+path,method=method,headers={'Origin':ORIGIN,'Content-Type':'application/json'},data=b'{}' if method=='POST' else None)
 try:r=urllib.request.urlopen(req,timeout=15)
 except urllib.error.HTTPError as e:r=e
 with r:results.append({'test':method+' '+path,'status':r.status,'result':'PASS' if r.status==expected else 'FAIL'})
(FOLDER/'public-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
raise SystemExit(int(any(r['result']=='FAIL' for r in results)))
