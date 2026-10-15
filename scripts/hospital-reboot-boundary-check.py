"""Strict-TLS public recovery checks; no account, tokens, pixels or mutations."""
import json
import pathlib
import urllib.error
import urllib.request
from datetime import datetime, timezone

APP='https://highpass-demo.japaneast.cloudapp.azure.com'
IMAGE='https://highpass-images-b.japaneast.cloudapp.azure.com'
PATH='/patient-dicomweb/studies/2.25.259656708708993797343330994179169711072/series/2.25.18361638789025095699746776899955737977/instances'


def main():
    checks=[]
    cases=[
        ('PATIENT_WEB',APP+'/hipass/','GET',{},[200]),
        ('PATIENT_MOBILE',APP+'/mobile/','GET',{},[200]),
        ('IMAGE_ROOT_DENIED',IMAGE+'/','GET',{},[403]),
        ('IMAGE_NO_PROOF_DENIED',IMAGE+PATH,'GET',{'Origin':APP},[401]),
        ('IMAGE_INVALID_PROOF_DENIED',IMAGE+PATH,'GET',{'Origin':APP,'Authorization':'DPoP invalid','DPoP':'invalid'},[403]),
        ('UNTRUSTED_ORIGIN_DENIED',IMAGE+PATH,'GET',{'Origin':'https://example.invalid'},[403]),
        ('QUERY_TOKEN_DENIED',IMAGE+PATH+'?token=invalid','GET',{'Origin':APP},[403]),
        ('RAW_ROUTE_DENIED',IMAGE+'/dicomweb/studies','GET',{},[403]),
        ('ADMIN_ROUTE_DENIED',IMAGE+'/api/auth/me','GET',{},[403]),
        ('APPROVED_PREFLIGHT',IMAGE+PATH,'OPTIONS',{'Origin':APP,'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'authorization,dpop'},[204]),
        ('CLINICIAN_NO_TOKEN_DENIED',IMAGE+'/dicomweb/studies','GET',{'Origin':APP},[401,403]),
    ]
    for name,url,method,headers,allowed in cases:
        try:
            try:response=urllib.request.urlopen(urllib.request.Request(url,method=method,headers=headers),timeout=12)
            except urllib.error.HTTPError as error:response=error
            with response:
                status=response.status
                origin=response.headers.get('Access-Control-Allow-Origin')
                code=None
                if status>=400:
                    try:code=json.loads(response.read(2048)).get('error')
                    except (ValueError,AttributeError):pass
            good=status in allowed and (name!='APPROVED_PREFLIGHT' or origin==APP)
            checks.append(dict(test=name,status='PASS' if good else 'FAIL',httpStatus=status,reasonCode=code))
        except (OSError,urllib.error.URLError):
            checks.append(dict(test=name,status='FAIL',reasonCode='TLS_OR_CONNECTION_FAILURE'))
    folder=pathlib.Path(__file__).resolve().parents[1]/'artifacts/workstation'/('reboot-public-check-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    folder.mkdir(parents=True,exist_ok=False)
    result=dict(observedAt=datetime.now(timezone.utc).isoformat(),review='DRAFT / UNASSIGNED',checks=checks,
        status='PASS' if all(row['status']=='PASS' for row in checks) else 'FAIL',
        authenticatedPatientViewer='NOT VERIFIED',authenticatedClinicianViewer='NOT VERIFIED')
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))
    return 0 if result['status']=='PASS' else 1


if __name__=='__main__':
    raise SystemExit(main())
