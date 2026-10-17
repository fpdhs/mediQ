"""Public release hashes and negative route/CORS checks, no auth bypass."""
import pathlib,json,hashlib,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1];origin='https://highpass-demo.japaneast.cloudapp.azure.com';image='https://highpass-images-b.japaneast.cloudapp.azure.com'
results=[]
def get(url,method='GET',headers=None):
 req=urllib.request.Request(url,method=method,headers=headers or {})
 try:r=urllib.request.urlopen(req,timeout=50)
 except urllib.error.HTTPError as e:r=e
 return r.status,r.headers,r.read(2097152)
for name in ['public/app.js','public/ui/clinician-reception.js','public/ui/clinician-reception.css']:
 status,_,body=get(origin+'/'+name.removeprefix('public/'));candidate='clinician-connected-style-20261014' if name.endswith('.css') else ('clinician-connected-final-20261014' if name=='public/app.js' else 'clinician-connected-20261014');expected=(ROOT/'artifacts/azure'/candidate/name).read_bytes()
 results.append({'test':name,'status':'PASS' if status==200 and body==expected else 'FAIL'})
for name,url,method,headers,expected in [
 ('health_auth_required',origin+'/api/v1/clinician/health-records','GET',{},401),
 ('token_auth_required',origin+'/api/dicom-access/request','POST',{'Origin':origin},401),
 ('control_images_closed',origin+'/dicomweb/studies','GET',{},403),
 ('image_auth_required',image+'/dicomweb/studies','GET',{'Origin':origin},401),
 ('image_preflight',image+'/dicomweb/studies','OPTIONS',{'Origin':origin,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,dpop'},204),
 ('import_preflight',image+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import','OPTIONS',{'Origin':origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,dpop'},204),
 ('import_foreign_origin',image+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import','OPTIONS',{'Origin':'https://evil.test','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,dpop'},403),
 ('import_wrong_method',image+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import','GET',{'Origin':origin},403),
 ('image_foreign_origin',image+'/dicomweb/studies','GET',{'Origin':'https://evil.test'},403),
 ('raw_image_closed',image+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4','GET',{'Origin':origin},403),
 ('download_closed',image+'/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/download','GET',{'Origin':origin},403),
 ('query_closed',image+'/dicomweb/studies?token=x','GET',{'Origin':origin},403),
 ('admin_closed',origin+'/api/audit-logs','GET',{},403)]:
 status,headers,body=get(url,method,headers);results.append({'test':name,'status':'PASS' if status==expected else 'FAIL','http':status,'expected':expected})
folder=ROOT/'artifacts/azure/clinician-connected-20261014';(folder/'public-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
raise SystemExit(any(r['status']=='FAIL' for r in results))
