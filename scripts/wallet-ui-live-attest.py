"""Read-only served-asset attestation with project CA and finite requests."""
import hashlib,json,pathlib,ssl,urllib.request
ROOT=pathlib.Path(__file__).resolve().parent.parent
FILES=['public/app.js','public/index.html','public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','public/ui/wallet-home.js','public/ui/wallet-home.css','public/ui/patient-health.js','public/ui/patient-sharing.js','public/images/mediq-wallet-front-v1.webp']
FILES+=['public/ui/wallet-open.css','public/images/mediq-wallet-leather-v1.webp']
FILES+=['public/ui/wallet-bifold.css','public/images/mediq-wallet-bifold-v1.webp']
FILES+=['public/ui/wallet-record-sheet.css']
ctx=ssl.create_default_context(cafile=str(ROOT/'tmp/certs/mtls/ca.crt'));checks=[]
for file in FILES:
 path='/hipass/' if file=='public/index.html' else '/mobile/' if file=='public/mobile/index.html' else '/'+file.removeprefix('public/')
 expected=(ROOT/file).read_bytes()
 if file.endswith('index.html'):expected=expected.replace(b'<html lang="ko">',b'<html lang="ko" data-capstone="1">')
 with urllib.request.urlopen('https://192.168.111.149:9443'+path,context=ctx,timeout=10) as response:
  actual=response.read(4194305);assert len(actual)<=4194304
  checks.append({'path':path,'status':'PASS' if response.status==200 and actual==expected else 'FAIL','sha256':hashlib.sha256(actual).hexdigest()})
result={'scope':'LIVE_PUBLIC_UI_BYTES_AND_AUTH_MARKER','review':'DRAFT / UNASSIGNED','status':'PASS' if all(c['status']=='PASS' for c in checks) else 'FAIL','checks':checks}
(ROOT/'artifacts/ui/wallet-home-20261011/served-assets.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
if result['status']!='PASS':raise SystemExit(2)
