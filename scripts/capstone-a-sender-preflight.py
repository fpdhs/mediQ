"""Read-only A sender and B-to-A TLS preflight; never deploys or requests DICOM."""
import argparse
import getpass
import importlib.util
import json
import pathlib
import re
import shlex
import sys
from datetime import datetime, timezone

import paramiko

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("workstation_ops", ROOT / "scripts/workstation-automatic-ops.py")
ops_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops_module)

A_INVENTORY = r'''import json,re,subprocess
names=['hp-capstone-a-gateway-gateway-1','hp-capstone-hospital-a-orthanc-1','hp-capstone-hospital-a-orthanc-mtls-1']
p=subprocess.run(['docker','inspect',*names],capture_output=True,text=True,timeout=12)
if p.returncode: raise SystemExit(3)
items=json.loads(p.stdout); out=[]
for c in items:
 env={x.split('=',1)[0]:x.split('=',1)[1] for x in c['Config'].get('Env',[]) if '=' in x}
 labels=c['Config'].get('Labels') or {}
 ports={k:[{'hostIp':b.get('HostIp'),'hostPort':b.get('HostPort')} for b in v or []] for k,v in (c['HostConfig'].get('PortBindings') or {}).items()}
 mounts=[{'source':m.get('Source'),'destination':m.get('Destination'),'readOnly':not m.get('RW',True)} for m in c.get('Mounts',[])]
 networks=sorted((c.get('NetworkSettings',{}).get('Networks') or {}).keys())
 out.append({'name':c['Name'].lstrip('/'),'imageId':c['Image'],'running':c['State'].get('Running',False),
   'health':c['State'].get('Health',{}).get('Status','NO_HEALTHCHECK'),'publishedPorts':ports,'mounts':mounts,'networks':networks,
   'composeProject':labels.get('com.docker.compose.project'),'composeFilesPresent':bool(labels.get('com.docker.compose.project.config_files')),
   'policy':{'imageEncryptionRequired':env.get('CAPSTONE_IMAGE_ENCRYPTION_REQUIRED')=='1',
     'runtimeDiagnostics':env.get('CAPSTONE_RUNTIME_DIAGNOSTICS')=='1',
     'orthancHttps':env.get('DATA_PLANE_ORTHANC_ORIGIN')=='https://orthanc-mtls:8443',
     'orthancServerName':env.get('DATA_PLANE_ORTHANC_SERVERNAME')=='hospital-a-orthanc-mtls',
     'versionPinnedKeyId':bool(re.fullmatch(r'https://[^/]+/keys/[^/]+/[0-9a-fA-F]{32}',env.get('CAPSTONE_VAULT_KEY_ID','')))}})
print(json.dumps(out))
'''

B_TLS_PROBE = r'''import json,socket,ssl,pathlib
ca=pathlib.Path('/opt/highpass/capstone-b-portal-secrets/ca.crt')
if not ca.is_file(): raise SystemExit(4)
ctx=ssl.create_default_context(cafile=str(ca)); ctx.check_hostname=True; ctx.verify_mode=ssl.CERT_REQUIRED
with socket.create_connection(('10.90.88.2',9443),timeout=5) as raw:
 with ctx.wrap_socket(raw,server_hostname='10.90.88.2') as peer:
  print(json.dumps({'tlsVersion':peer.version(),'cipher':peer.cipher()[0] if peer.cipher() else None,'peerIpSanVerified':True}))
'''


def connect_vm(role, credential, trust, evidence_dir):
    address, mac, _ = ops_module.ROLES[role]
    key = trust.key(role, credential, evidence_dir / (role + "-public-host.key"))
    client = paramiko.SSHClient()
    client.get_host_keys().add(address, key.get_name(), key)
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(address, username="server", password=credential, look_for_keys=False, allow_agent=False,
                   timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
    command = "timeout 10s bash -c " + shlex.quote(
        "set -eu; test $(id -un) = server; test $(cat /sys/class/net/ens33/address) = " + mac +
        "; systemctl is-active --quiet docker; systemctl is-active --quiet wg-quick@hp-capstone")
    code, _ = ops_module.run(client, command, seconds=12)
    if code:
        client.close()
        raise RuntimeError("PINNED_VM_ROLE_OR_OVERLAY_FAILED_" + role)
    return client


def classify_inventory(items):
    by_name = {row.get("name"): row for row in items}
    required = ["hp-capstone-a-gateway-gateway-1", "hp-capstone-hospital-a-orthanc-1",
                "hp-capstone-hospital-a-orthanc-mtls-1"]
    if any(name not in by_name for name in required):
        return {"status": "NOT VERIFIED", "reason": "REQUIRED_A_CONTAINER_MISSING", "containers": items}
    gateway = by_name[required[0]]
    orthanc = by_name[required[1]]
    boundary = by_name[required[2]]
    gateway_published = gateway.get("publishedPorts", {}).get("8443/tcp", [])
    pacs_published = boundary.get("publishedPorts", {}).get("8443/tcp", [])
    expected_gateway_port = [{"hostIp": "10.90.88.2", "hostPort": "9443"}]
    expected_boundary_port = [{"hostIp": "127.0.0.1", "hostPort": "18443"}]
    checks = [
        {"test": "A_GATEWAY_RUNNING_HEALTHY", "status": "PASS" if gateway.get("running") and gateway.get("health") == "healthy" else "FAIL"},
        {"test": "A_GATEWAY_ENCRYPTION_AND_UPSTREAM_MTLS_CONFIG", "status": "PASS" if all(gateway.get("policy", {}).get(k) for k in ["imageEncryptionRequired", "orthancHttps", "orthancServerName"]) else "FAIL"},
        {"test": "A_GATEWAY_VERSION_PINNED_KEY_REFERENCE", "status": "PASS" if gateway.get("policy", {}).get("versionPinnedKeyId") else "FAIL"},
        {"test": "A_GATEWAY_BOUND_ONLY_TO_PRIVATE_TRANSPORT", "status": "PASS" if gateway_published == expected_gateway_port else "FAIL"},
        {"test": "A_ORTHANC_AND_MTLS_BOUNDARY_HEALTHY", "status": "PASS" if orthanc.get("running") and orthanc.get("health") == "healthy" and boundary.get("running") and boundary.get("health") == "healthy" else "FAIL"},
        {"test": "A_RAW_ORTHANC_HAS_NO_PUBLISHED_PORT", "status": "PASS" if not any(orthanc.get("publishedPorts", {}).values()) else "FAIL"},
        {"test": "A_PACS_BOUNDARY_NOT_PUBLICLY_PUBLISHED", "status": "PASS" if pacs_published in ([], expected_boundary_port) else "FAIL"},
        {"test": "A_GATEWAY_AND_PACS_BOUNDARY_SHARE_PRIVATE_NETWORK", "status": "PASS" if "hp-capstone-hospital-a_pacs_private" in gateway.get("networks", []) and "hp-capstone-hospital-a_pacs_private" in boundary.get("networks", []) else "FAIL"},
        {"test": "A_GATEWAY_AND_MTLS_SECRET_MOUNTS_READ_ONLY", "status": "PASS" if all(m.get("readOnly") for m in gateway.get("mounts", []) + boundary.get("mounts", [])) else "FAIL"},
    ]
    return {"status": "PASS" if all(row["status"] == "PASS" for row in checks) else "FAIL", "checks": checks,
            "containers": items, "authorizedImportRuntime": "NOT VERIFIED", "keyVaultWrap": "NOT VERIFIED",
            "sourcePacsMtlsRequest": "NOT VERIFIED"}


def remote_json(client, command, credential, seconds=25):
    code, output = ops_module.run(client, command, credential=credential, seconds=seconds)
    if code:
        raise RuntimeError("REMOTE_READ_ONLY_PROBE_FAILED")
    return json.loads(output)


def collect_vm_credentials(gui=False, input_fn=None, gui_prompt=None):
    if gui and gui_prompt is None:
        prompt_spec = importlib.util.spec_from_file_location("credential_prompt", ROOT / "scripts/deployment-auth-preflight.py")
        prompt = importlib.util.module_from_spec(prompt_spec)
        prompt_spec.loader.exec_module(prompt)
        gui_prompt = prompt.ask_password_gui
    if not gui:
        input_fn = input_fn or getpass.getpass

    credentials = {}
    try:
        for role in ["A", "B"]:
            value = gui_prompt(role) if gui else input_fn(f"{role} VM credential (concealed; not saved): ")
            if not value:
                raise SystemExit(role + "_CREDENTIAL_INPUT_CANCELLED")
            credentials[role] = value
        return credentials
    except BaseException:
        credentials.clear()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gui", action="store_true", help="Use separate masked local dialogs for A and B VM credentials")
    args = parser.parse_args()
    credentials = collect_vm_credentials(gui=args.gui)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    evidence_dir = ROOT / "artifacts/workstation" / ("capstone-a-sender-preflight-" + stamp)
    trust = None
    clients = {}
    result = {"observedAt": datetime.now(timezone.utc).isoformat(), "scope": "A_B_HOST_READ_ONLY_AND_B_TO_A_TLS_HANDSHAKE",
              "readOnly": True, "review": "DRAFT / UNASSIGNED", "checks": [],
              "authorizedImportRuntime": "NOT VERIFIED", "keyVaultWrap": "NOT VERIFIED", "authorizedA_TO_BTransfer": "NOT VERIFIED"}
    try:
        evidence_dir.mkdir(parents=True, exist_ok=False)
        trust = ops_module.LocalVmTrust()
        for role in ["A", "B"]:
            clients[role] = connect_vm(role, credentials[role], trust, evidence_dir)
            result["checks"].append({"test": "PINNED_" + role + "_VM_DOCKER_AND_WIREGUARD", "status": "PASS"})
        a_command = "sudo -S -p '' timeout 18s python3 -c " + shlex.quote(A_INVENTORY)
        inventory = remote_json(clients["A"], a_command, credentials["A"], seconds=23)
        result["aRuntime"] = classify_inventory(inventory)
        result["checks"].extend(result["aRuntime"].get("checks", []))
        b_command = "sudo -S -p '' timeout 8s python3 -c " + shlex.quote(B_TLS_PROBE)
        tls = remote_json(clients["B"], b_command, credentials["B"], seconds=12)
        result["bToAGatewayTls"] = {"status": "PASS", **tls}
        result["checks"].append({"test": "B_TO_A_GATEWAY_TLS_CHAIN_AND_IP_SAN", "status": "PASS", "tlsVersion": tls.get("tlsVersion")})
    except Exception as error:
        reason = str(error) if isinstance(error, RuntimeError) and re.fullmatch(r"[A-Z0-9_]+", str(error)) else type(error).__name__
        result["checks"].append({"test": "READ_ONLY_PREFLIGHT", "status": "NOT VERIFIED", "reason": reason})
    finally:
        try:
            for client in clients.values():
                client.close()
            if trust is not None:
                trust.close()
        finally:
            credentials.clear()

    result["status"] = "PASS" if result["checks"] and all(row["status"] == "PASS" for row in result["checks"]) else "NOT VERIFIED"
    result["authorizedImportRuntime"] = "NOT VERIFIED"
    result["keyVaultWrap"] = "NOT VERIFIED"
    result["authorizedA_TO_BTransfer"] = "NOT VERIFIED"
    (evidence_dir / "result.json").write_text(json.dumps(result, indent=2), encoding="utf8")
    print(json.dumps({"evidence": str(evidence_dir / "result.json"), "status": result["status"],
                      "checks": result["checks"], "authorizedImportRuntime": result["authorizedImportRuntime"],
                      "keyVaultWrap": result["keyVaultWrap"], "authorizedA_TO_BTransfer": result["authorizedA_TO_BTransfer"]}, ensure_ascii=True))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
