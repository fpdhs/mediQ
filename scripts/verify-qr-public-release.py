"""No-auth HTTPS boundary and delivered-code verification; no ticket credentials."""
import hashlib,json,pathlib,urllib.request,urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
FOLDER=ROOT/'artifacts/azure/qr-public-20261013'
ORIGIN='https://highpass-demo.japaneast.cloudapp.azure.com'
def main():
    results=[]
    for file in ['public/app.js','public/ui/patient.js','public/ui/demo-tools.js','public/mobile/sw.js']:
        with urllib.request.urlopen(ORIGIN+'/'+file.removeprefix('public/'),timeout=12) as response:data=response.read()
        expected=(FOLDER/file).read_bytes()
        results.append({'test':file,'result':'PASS' if data==expected else 'FAIL','sha256':hashlib.sha256(data).hexdigest()})
    for method,path,expected in [('GET','/hipass/',200),('GET','/mobile/',200),
        ('POST','/api/consents/nonexistent/handoff-ticket',401),
        ('GET','/api/consents/nonexistent/handoff-tickets/nonexistent',401),
        ('POST','/api/demo/qr/redeem',401),
        ('POST','/api/transfers/tickets/redeem-viewer',403),
        ('POST','/api/transfers/tickets/redeem',403),('GET','/dicomweb/studies',403)]:
        request=urllib.request.Request(ORIGIN+path,method=method,headers={'Origin':ORIGIN,'Content-Type':'application/json'},data=b'{}' if method=='POST' else None)
        try:response=urllib.request.urlopen(request,timeout=12)
        except urllib.error.HTTPError as error:response=error
        with response:
            results.append({'test':method+' '+path,'status':response.status,'result':'PASS' if response.status==expected else 'FAIL'})
    (FOLDER/'public-verification.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2))
    return int(any(r['result']=='FAIL' for r in results))
if __name__=='__main__':raise SystemExit(main())
