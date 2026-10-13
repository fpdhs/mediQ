"""Read-only stage diagnosis of the fixed HCC source probe on Hospital A."""
import getpass
import importlib.util
import json
import pathlib
import shlex
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGE = 'sha256:2bc261db0b0e2d03aed101bc9635cbdf8061c8b60b546ce7f54acf5022315d17'
JS = r'''import {readFileSync} from 'node:fs';
import {boundedHttps,requireHttpsOrigin} from '/app/src/data-plane-gateway.js';
import {HCC_SOURCE_CONTRACT} from '/app/src/hcc-source-contract.js';
import {HCC_SOURCE_PATIENT_ID,HCC_PATIENT_NAME} from '/app/src/capstone-hcc-catalog.js';
let stage='manifest';
const transportCodes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','CERT_HAS_EXPIRED','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID','ERR_INVALID_URL','ERR_HTTP_HEADERS_SENT','HPE_INVALID_HEADER_TOKEN']);
try {
 const manifest=JSON.parse(readFileSync(process.env.HCC_SOURCE_MANIFEST_FILE,'utf8'));
 const ca=readFileSync(process.env.DATA_PLANE_ORTHANC_CA_FILE),cert=readFileSync(process.env.DATA_PLANE_ORTHANC_CERT_FILE),key=readFileSync(process.env.DATA_PLANE_ORTHANC_KEY_FILE);
 const origin=requireHttpsOrigin(process.env.DATA_PLANE_ORTHANC_ORIGIN),tls={ca,cert,key,servername:process.env.DATA_PLANE_ORTHANC_SERVERNAME};
 const get=async(path,label)=>{stage=label;const r=await boundedHttps(origin,path,{tls,timeoutMs:10000,maxBytes:16*1024*1024,headers:{accept:'application/dicom+json'}});return {status:r.status,body:r.status===200?JSON.parse(r.body.toString('utf8')):null};};
 const c=HCC_SOURCE_CONTRACT,tag=(row,id)=>row?.[id]?.Value?.[0];
 const studies=await get('/dicom-web/studies?StudyInstanceUID='+c.studyUid,'QIDO_STUDIES');
 const series=await get('/dicom-web/studies/'+c.studyUid+'/series','QIDO_SERIES');
 const instances=await get('/dicom-web/studies/'+c.studyUid+'/series/'+c.seriesUid+'/instances','QIDO_INSTANCES');
 const study=Array.isArray(studies.body)&&studies.body.length===1?studies.body[0]:null;
 const rawName=tag(study,'00100010'),sourceName=rawName&&typeof rawName==='object'?rawName.Alphabetic:rawName;
 const description=tag(study,'00081030');
 const studyChecks={studyUid:tag(study,'0020000D')===c.studyUid,sourcePatientId:tag(study,'00100020')===HCC_SOURCE_PATIENT_ID,sourcePatientName:sourceName===HCC_PATIENT_NAME,studyDate:tag(study,'00080020')==='20261010',syntheticDescription:description===undefined||description==='SYNTHETIC CT DEMO - NOT FOR CLINICAL USE'};
 const studyOk=Object.values(studyChecks).every(Boolean);
 const seriesOk=Array.isArray(series.body)&&series.body.length===1&&tag(series.body[0],'0020000D')===c.studyUid&&tag(series.body[0],'0020000E')===c.seriesUid&&tag(series.body[0],'00080060')==='CT'&&tag(series.body[0],'0008103E')==='REFERENCE-INTERPOLATED SYNTHETIC CT';
 const expected=new Set((manifest.instances??[]).map(row=>row.sopInstanceUID));
 const sopUids=Array.isArray(instances.body)?instances.body.map(row=>tag(row,'00080018')):[];
 const instancesOk=instances.status===200&&sopUids.length===700&&new Set(sopUids).size===700&&sopUids.every(uid=>expected.has(uid))&&instances.body.every(row=>tag(row,'0020000D')===c.studyUid&&tag(row,'0020000E')===c.seriesUid);
 const result={status:studyOk&&seriesOk&&instancesOk?'PASS':'FAIL',scope:'READ_ONLY_A_SOURCE_QIDO_INVENTORY_DIAGNOSIS',studyHttp:studies.status,seriesHttp:series.status,instancesHttp:instances.status,studyCount:Array.isArray(studies.body)?studies.body.length:null,seriesCount:Array.isArray(series.body)?series.body.length:null,instanceCount:sopUids.length,uniqueSopCount:new Set(sopUids).size,expectedSopMatches:sopUids.filter(uid=>expected.has(uid)).length,patientNameUsesStructuredDICOMJson:!!(rawName&&typeof rawName==='object'&&typeof rawName.Alphabetic==='string'),studyDescriptionPresent:description!==undefined,studyMetadataChecks:studyChecks,seriesMetadataMatches:seriesOk,instanceScopeAndUidSetMatches:instancesOk,reportSubmitted:false,catalogRegistered:false};
 if(result.status==='FAIL')result.failureCode=!studyOk?'QIDO_STUDY_METADATA_MISMATCH':!seriesOk?'QIDO_SERIES_METADATA_MISMATCH':'QIDO_INSTANCE_INVENTORY_MISMATCH';
 console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=2;
} catch(error) {
 const code=transportCodes.has(error?.code)?error.code:'TRANSPORT_OR_RUNTIME_ERROR';
 console.log(JSON.stringify({status:'FAIL',scope:'READ_ONLY_A_SOURCE_QIDO_INVENTORY_DIAGNOSIS',stage,failureCode:code,reportSubmitted:false,catalogRegistered:false}));
 process.exitCode=2;
}'''
REMOTE = r'''
import json,pathlib,subprocess,sys
MAC='00:0c:29:25:f6:b4'
IMAGE=''' + repr(IMAGE) + r'''
JS=''' + repr(JS) + r'''
name='hp-capstone-a-gateway-gateway-1'
def cmd(args,timeout=20):
 p=subprocess.run(args,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError('REMOTE_READ_ONLY_DIAGNOSTIC_FAILED')
 return p.stdout
try:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 before=json.loads(cmd(['docker','inspect',name]))[0]
 assert before['Image']==IMAGE and before['State']['Running'] and before['State']['Health']['Status']=='healthy'
 p=subprocess.run(['docker','exec',name,'/nodejs/bin/node','--input-type=module','-e',JS],capture_output=True,timeout=1510)
 after=json.loads(cmd(['docker','inspect',name]))[0]
 identity=lambda x:{k:x[k] for k in ['Id','Image','Config','Mounts','HostConfig']}|{'StartedAt':x['State']['StartedAt'],'Running':x['State']['Running']}
 if identity(before)!=identity(after):raise RuntimeError('GATEWAY_RUNTIME_CHANGED')
 rows=[json.loads(line) for line in p.stdout.decode('utf8').splitlines() if line.startswith('{')]
 if len(rows)!=1:raise RuntimeError('DIAGNOSTIC_OUTPUT_INVALID')
 rows[0]['gatewayRuntimeUnchanged']=True
 print(json.dumps(rows[0]))
 sys.exit(0 if p.returncode==0 and rows[0].get('status')=='PASS' else 2)
except Exception:
 print(json.dumps({'status':'NOT VERIFIED','scope':'READ_ONLY_A_SOURCE_QIDO_INVENTORY_DIAGNOSIS','failureCode':'REMOTE_RECONCILIATION_REQUIRED','reportSubmitted':False,'catalogRegistered':False}))
 sys.exit(2)
'''


def load_ops():
    spec = importlib.util.spec_from_file_location('workstation_ops', ROOT / 'scripts/workstation-automatic-ops.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    import paramiko
    ops = load_ops()
    directory = ROOT / 'artifacts/workstation' / ('hcc-source-readonly-diagnosis-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True, exist_ok=False)
    result = {'status': 'NOT VERIFIED', 'scope': 'READ_ONLY_A_SOURCE_QIDO_INVENTORY_DIAGNOSIS', 'reportSubmitted': False, 'catalogRegistered': False}
    credential = getpass.getpass('Hospital A VM credential (concealed): ')
    trust = ops.LocalVmTrust()
    client = paramiko.SSHClient()
    started = time.monotonic()
    try:
        address, _, _ = ops.ROLES['A']
        key = trust.key('A', credential, directory / 'A-public-host.key')
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        command = 'sudo -S -p \'\' timeout 1520s python3 -c ' + shlex.quote(REMOTE)
        code, output = ops.run(client, command, credential=credential, seconds=1525)
        rows = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
        if code in (0, 2) and len(rows) == 1:
            result.update(rows[0])
        else:
            result['failureCode'] = 'REMOTE_READ_ONLY_DIAGNOSTIC_NOT_CONFIRMED'
    except Exception:
        result['failureCode'] = 'PINNED_A_READ_ONLY_DIAGNOSTIC_RECONCILIATION_REQUIRED'
    finally:
        client.close()
        trust.close()
        credential = None
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': round(time.monotonic() - started, 3),
                   'review': 'DRAFT / UNASSIGNED'})
    path = directory / 'result.json'
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print(json.dumps({'evidence': str(path), **result}, ensure_ascii=False))
    return 0 if result['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
