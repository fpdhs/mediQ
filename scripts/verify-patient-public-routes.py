"""TLS-verified, unauthenticated boundary checks; never retrieves a CT frame."""
import json, sys, urllib.request, urllib.error, pathlib, hashlib, base64, zlib
APP='https://highpass-demo.japaneast.cloudapp.azure.com'
IMAGE='https://highpass-images-b.japaneast.cloudapp.azure.com'
PATH='/patient-dicomweb/studies/2.25.259656708708993797343330994179169711072/series/2.25.18361638789025095699746776899955737977/instances'
def request(url,method='GET',headers=None):
    try:r=urllib.request.urlopen(urllib.request.Request(url,method=method,headers=headers or {}),timeout=12)
    except urllib.error.HTTPError as e:r=e
    with r:return r.status,dict(r.headers),r.read(2048)
def main():
    opened='--open' in sys.argv; results=[]
    cases=[('app',APP+'/hipass/',{},[200]),('mobile',APP+'/mobile/',{},[200]),
        ('root',IMAGE+'/',{},[403]),('raw-dicom',IMAGE+'/dicomweb/studies',{},[403]),
        ('admin',IMAGE+'/api/auth/me',{},[403]),('missing-origin',IMAGE+PATH,{},[403]),
        ('wrong-origin',IMAGE+PATH,{'Origin':'https://untrusted.invalid'},[403]),
        ('query-token',IMAGE+PATH+'?token=invalid',{'Origin':APP},[403]),
        ('missing-proof',IMAGE+PATH,{'Origin':APP},[401,403] if opened else [403]),
        ('invalid-proof',IMAGE+PATH,{'Origin':APP,'Authorization':'DPoP invalid','DPoP':'invalid'},[401,403] if opened else [403])]
    for name,url,headers,expected in cases:
        status,h,body=request(url,headers=headers)
        results.append({'test':name,'status':status,'result':'PASS' if status in expected else 'FAIL',
            'reason':body.decode(errors='replace')[:180] if name not in ['app','mobile'] else None})
    status,h,body=request(IMAGE+PATH,'OPTIONS',{'Origin':APP,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,dpop'})
    ok=status==(204 if opened else 403) and (not opened or h.get('Access-Control-Allow-Origin')==APP)
    results.append({'test':'preflight','status':status,'result':'PASS' if ok else 'FAIL'})
    if opened:
        folder=pathlib.Path(__file__).resolve().parents[1]/'artifacts/azure/patient-viewer-20261013T125850Z'
        payload=json.loads((folder/'payload.json').read_text())['web']['files']
        for name in ['public/patient-pixel-viewer.js','public/mobile/sw.js']:
            with urllib.request.urlopen(APP+'/'+name.removeprefix('public/'),timeout=12) as r:data=r.read(2*1024*1024)
            expected=zlib.decompress(base64.b64decode(payload[name][2:]))
            results.append({'test':'deployed-hash-'+name,'result':'PASS' if data==expected else 'FAIL','sha256':hashlib.sha256(data).hexdigest()})
    if '--save' in sys.argv:
        target=pathlib.Path(__file__).resolve().parents[1]/'artifacts/azure/patient-viewer-20261013T125850Z'/('routes-open.json' if opened else 'routes-closed.json')
        target.write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2));return int(any(r['result']=='FAIL' for r in results))
if __name__=='__main__':raise SystemExit(main())
