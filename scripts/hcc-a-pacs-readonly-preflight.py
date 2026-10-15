"""Read-only, role-pinned preflight for the fixed synthetic HCC Study on Highpass A."""
import argparse
import base64
import getpass
import importlib.util
import json
import pathlib
import re
import shlex
import sys
from datetime import datetime, timezone

import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("hcc_preflight_vm_ops", ROOT / "scripts/workstation-automatic-ops.py")
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)

EXPECTED = {
    "gateway": "hp-capstone-a-gateway-gateway-1",
    "gatewayImage": "sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df",
    "orthanc": "hp-capstone-hospital-a-orthanc-1",
    "orthancImage": "sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a",
    "proxy": "hp-capstone-hospital-a-orthanc-mtls-1",
    "proxyImage": "sha256:853ed9b5269a6781eff54b29942f6368c9d14f6a36add88ebdb5dcc1b0744802",
    "volume": "hp-capstone-hospital-a_hospital-a-data",
    "network": "hp-capstone-hospital-a_pacs_private",
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=pathlib.Path, default=ROOT / "artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010")
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    allowed = (ROOT / "artifacts/workstation").resolve()
    if not output.is_relative_to(allowed) or output == allowed:
        raise RuntimeError("OUTPUT_PATH_OUTSIDE_WORKSTATION_ARTIFACTS")
    output.mkdir(parents=True, exist_ok=False)
    manifest_path = args.dataset.resolve() / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    study_uid = manifest.get("studyInstanceUID")
    if manifest.get("canonicalManifestSha256") != "ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721" or not isinstance(study_uid, str):
        raise RuntimeError("FIXED_DATASET_MANIFEST_MISMATCH")
    catalog = (ROOT / "src/capstone-hcc-catalog.js").read_text(encoding="utf8")
    fixed_uid = re.search(r"HCC_STUDY_UID\s*=\s*'([^']+)'", catalog)
    fixed_sha = re.search(r"HCC_MANIFEST_SHA256\s*=\s*'([^']+)'", catalog)
    if not fixed_uid or not fixed_sha or fixed_uid.group(1) != study_uid or fixed_sha.group(1) != manifest["canonicalManifestSha256"]:
        raise RuntimeError("APPLICATION_CATALOG_BINDING_MISMATCH")

    stamp = datetime.now(timezone.utc).isoformat().replace(":", "-")
    credential = getpass.getpass("VM credential (concealed): ")
    client = paramiko.SSHClient()
    trust = ops.LocalVmTrust()
    checks = []
    result = {"status": "NOT VERIFIED", "scope": "READ_ONLY_A_TEST_PACS_IDENTITY_AND_MTLS_QIDO", "review": "DRAFT / UNASSIGNED", "observedAt": datetime.now(timezone.utc).isoformat(),
              "dataset": {"studyUid": study_uid, "instances": manifest.get("totalInstances"), "manifestSha256": manifest.get("canonicalManifestSha256")}}
    try:
        address, mac, _ = ops.ROLES["A"]
        public_key_path = output / "A-public-host.key"
        key = trust.key("A", credential, public_key_path)
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username="server", password=credential, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)

        code, identity = ops.run(client, "test $(id -un) = server && test $(cat /sys/class/net/ens33/address) = " + shlex.quote(mac) + " && hostname", seconds=10)
        if code:
            raise RuntimeError("A_VM_ROLE_IDENTITY_MISMATCH")
        checks.append({"test": "A_VM_ROLE_PIN", "status": "PASS", "hostname": identity.strip()})

        command = "sudo -S -p '' timeout 15s python3 -c " + shlex.quote(r'''
import json,subprocess
expected=json.loads(''' + repr(json.dumps(EXPECTED)) + r''')
names=set(subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],timeout=5).decode().splitlines())
if names != {expected['gateway'],expected['orthanc'],expected['proxy']}: raise SystemExit('CONTAINER_SET_MISMATCH')
items=json.loads(subprocess.check_output(['docker','inspect',expected['gateway'],expected['orthanc'],expected['proxy']],timeout=5))
by={item['Name'].lstrip('/'):item for item in items}
for name,image in [(expected['gateway'],expected['gatewayImage']),(expected['orthanc'],expected['orthancImage']),(expected['proxy'],expected['proxyImage'])]:
 item=by[name]
 if not item['State']['Running'] or item['Image']!=image: raise SystemExit('PINNED_CONTAINER_MISMATCH')
 if name!=expected['gateway'] and any(bindings for bindings in item['NetworkSettings']['Ports'].values() if bindings): raise SystemExit('PACS_HOST_PORT_PUBLISHED')
 if item['State'].get('Health',{}).get('Status')!='healthy': raise SystemExit('PINNED_CONTAINER_NOT_HEALTHY')
orth=by[expected['orthanc']]
if not any(m.get('Name')==expected['volume'] and m.get('Destination')=='/var/lib/orthanc/db' for m in orth['Mounts']): raise SystemExit('PACS_VOLUME_MISMATCH')
network=json.loads(subprocess.check_output(['docker','network','inspect',expected['network']],timeout=5))[0]
if network.get('Internal') is not True: raise SystemExit('PACS_NETWORK_NOT_INTERNAL')
gateway_networks=by[expected['gateway']]['NetworkSettings']['Networks']
if expected['network'] not in gateway_networks: raise SystemExit('GATEWAY_NOT_ON_PACS_NETWORK')
mounts={m['Destination'] for m in by[expected['gateway']]['Mounts']}
if not {'/run/secrets/ca.crt','/run/secrets/gateway-client.crt','/run/secrets/gateway-client.key'}.issubset(mounts): raise SystemExit('GATEWAY_MTLS_MATERIAL_MISSING')
print(json.dumps({'status':'PASS','pacsPublishedPorts':False,'volume':expected['volume'],'networkInternal':True,'images':{'gateway':by[expected['gateway']]['Image'],'orthanc':orth['Image'],'proxy':by[expected['proxy']]['Image']}}))
''')
        code, details = ops.run(client, command, credential=credential, seconds=20)
        if code:
            raise RuntimeError("A_PINNED_PACS_PREFLIGHT_FAILED")
        checks.append({"test": "A_PACS_CONTAINER_NETWORK_VOLUME_BASELINE", **json.loads(details.strip().splitlines()[-1])})

        js = r'''import https from 'node:https';import {readFileSync} from 'node:fs';
const tls={hostname:'orthanc-mtls',servername:'hospital-a-orthanc-mtls',port:8443,rejectUnauthorized:true,ca:readFileSync('/run/secrets/ca.crt'),cert:readFileSync('/run/secrets/gateway-client.crt'),key:readFileSync('/run/secrets/gateway-client.key'),headers:{accept:'application/dicom+json'}};
function getJson(pathname){return new Promise((resolve,reject)=>{const req=https.get({...tls,path:pathname,timeout:8000},res=>{let b='';res.setEncoding('utf8');res.on('data',x=>{b+=x;if(b.length>4194304)req.destroy(Object.assign(Error('limit'),{code:'RESPONSE_LIMIT'}))});res.on('end',()=>{try{if(res.statusCode!==200)throw Error('QIDO_STATUS_'+res.statusCode);const v=JSON.parse(b);if(!Array.isArray(v))throw Error('QIDO_NOT_ARRAY');resolve(v)}catch(e){reject(e)}})});req.on('error',reject);req.on('timeout',()=>req.destroy(Object.assign(Error('timeout'),{code:'ETIMEDOUT'})))})}
try{const studies=await getJson('/dicom-web/studies?includefield=0020000D');const studyUids=studies.map(x=>x['0020000D']?.Value?.[0]);if(studyUids.some(x=>typeof x!=='string')||new Set(studyUids).size!==studyUids.length)throw Error('STUDY_UID_INVENTORY_INVALID');const target=process.env.HCC_TARGET_UID;const targetPresent=studyUids.includes(target);let targetSeriesCount=0,targetInstanceCount=0,targetUniqueSopCount=0;if(targetPresent){const series=await getJson('/dicom-web/studies/'+encodeURIComponent(target)+'/series');const instances=await getJson('/dicom-web/studies/'+encodeURIComponent(target)+'/instances');const sops=instances.map(x=>x['00080018']?.Value?.[0]);if(sops.some(x=>typeof x!=='string'))throw Error('SOP_UID_INVENTORY_INVALID');targetSeriesCount=series.length;targetInstanceCount=instances.length;targetUniqueSopCount=new Set(sops).size}console.log(JSON.stringify({statusCode:200,studyCount:studyUids.length,targetPresent,targetSeriesCount,targetInstanceCount,targetUniqueSopCount,studyUids}));}catch(e){console.log(JSON.stringify({error:e.code||'QIDO_INVENTORY_FAILED',reason:String(e.message||e)}));process.exitCode=1}'''
        encoded = base64.b64encode(js.encode("utf8")).decode("ascii")
        remote = "sudo -S -p '' timeout 15s docker exec --env HCC_TARGET_UID=" + shlex.quote(study_uid) + " " + EXPECTED["gateway"] + " /nodejs/bin/node --input-type=module -e " + shlex.quote("await import('data:text/javascript;base64," + encoded + "')")
        code, qido = ops.run(client, remote, credential=credential, seconds=20)
        if code:
            raise RuntimeError("A_MTLS_QIDO_NOT_VERIFIED")
        qido_result = json.loads(qido.strip().splitlines()[-1])
        if qido_result.get("statusCode") != 200:
            raise RuntimeError("A_MTLS_QIDO_NOT_VERIFIED")
        qido_result["status"] = "PASS" if qido_result.get("studyCount") == 0 and not qido_result.get("targetPresent") else "CONFLICT"
        checks.append({"test": "STRICT_MTLS_QIDO_UID_COLLISION_PREFLIGHT", **qido_result})
        result["status"] = "PASS" if qido_result["status"] == "PASS" else "CONFLICT"
    except Exception as error:
        result["status"] = "NOT VERIFIED"
        result["failureCode"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    finally:
        client.close()
        trust.close()
        credential = None

    result["checks"] = checks
    result["nextWriteAllowed"] = result["status"] == "PASS"
    (output / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=True) + "\n", encoding="utf8")
    print(json.dumps({**result, "evidence": str(output / "result.json")}, ensure_ascii=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"status": "NOT VERIFIED", "failureCode": str(error) if isinstance(error, RuntimeError) else type(error).__name__}, ensure_ascii=True))
        sys.exit(1)
