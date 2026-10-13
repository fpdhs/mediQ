"""Strict-CA public static byte attestation; no credentials or clinical data read."""
import argparse,hashlib,json,pathlib,ssl,urllib.request
from datetime import datetime,timezone
ROOT=pathlib.Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--folder',required=True);a=p.parse_args()
folder=(ROOT/a.folder).resolve();assert folder.is_relative_to((ROOT/'artifacts/workstation').resolve())
ctx=ssl.create_default_context(cafile=str(ROOT/'tmp/certs/mtls/ca.crt'))
checks=[]
for file in ['public/index.html','public/ui/clinician-preparation.css']:
    expected=((folder/'index.html') if file=='public/index.html' else ROOT/file).read_bytes()
    path='/hipass/' if file=='public/index.html' else '/'+file.removeprefix('public/')
    if file=='public/index.html':expected=expected.replace(b'<html lang="ko">',b'<html lang="ko" data-capstone="1">')
    with urllib.request.urlopen('https://192.168.111.149:9443'+path,context=ctx,timeout=10) as response:
        actual=response.read(4194305);assert len(actual)<=4194304
        checks.append({'path':path,'status':'PASS' if response.status==200 and actual==expected else 'FAIL','sha256':hashlib.sha256(actual).hexdigest()})
out={'scope':'PUBLIC_STATIC_BYTES_ONLY','status':'PASS' if all(x['status']=='PASS' for x in checks) else 'FAIL','checks':checks,'review':'DRAFT / UNASSIGNED','observedAt':datetime.now(timezone.utc).isoformat()}
(folder/'served-assets.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out))
if out['status']!='PASS':raise SystemExit(2)
