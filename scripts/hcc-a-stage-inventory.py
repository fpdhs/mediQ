"""Read-only inventory of one exact, operator-created A seed staging directory."""
import argparse
import hashlib
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
DATASET = ROOT / "artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010"
PROBE = ROOT / "scripts/hcc-a-study-seed-probe.mjs"
SPEC = importlib.util.spec_from_file_location("hcc_stage_vm_ops", ROOT / "scripts/workstation-automatic-ops.py")
ops = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ops)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stage", required=True)
    parser.add_argument("--output", type=pathlib.Path)
    args = parser.parse_args()
    if not re.fullmatch(r"/home/server/\.highpass-hcc-main-\d{8}T\d{6}Z", args.stage):
        raise RuntimeError("EXACT_OPERATOR_STAGE_PATH_REQUIRED")
    output = (args.output or ROOT / "artifacts/workstation" / ("hcc-stage-inventory-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))).resolve()
    allowed = (ROOT / "artifacts/workstation").resolve()
    if not output.is_relative_to(allowed) or output == allowed:
        raise RuntimeError("OUTPUT_PATH_OUTSIDE_WORKSTATION_ARTIFACTS")
    output.mkdir(parents=True, exist_ok=False)
    credential = getpass.getpass("VM credential (concealed): ")
    trust = ops.LocalVmTrust()
    client = paramiko.SSHClient()
    result = {"status": "NOT VERIFIED", "scope": "READ_ONLY_EXACT_A_SEED_STAGE_INVENTORY", "review": "DRAFT / UNASSIGNED", "stage": args.stage}
    try:
        address, mac, _ = ops.ROLES["A"]
        key = trust.key("A", credential, output / "A-public-host.key")
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username="server", password=credential, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        expected_metadata = json.dumps({
            "manifest.json": hashlib.sha256((DATASET / "manifest.json").read_bytes()).hexdigest(),
            "seed.mjs": hashlib.sha256(PROBE.read_bytes()).hexdigest(),
        }, separators=(",", ":"))
        remote_program = """import json,os,pathlib,subprocess,hashlib
p=pathlib.Path(""" + repr(args.stage) + """)
metadata_expected=json.loads(""" + repr(expected_metadata) + """)
exists=p.exists(); links=[]; files=[]
if exists:
 for base,dirs,names in os.walk(p,followlinks=False):
  for name in list(dirs)+names:
   item=pathlib.Path(base)/name
   if item.is_symlink(): links.append(str(item.relative_to(p)))
  files.extend(pathlib.Path(base)/name for name in names)
dicom=[f for f in files if f.suffix=='.dcm']
server_uid=int(subprocess.check_output(['id','-u','server']).decode().strip())
metadata={}
for name,digest in metadata_expected.items():
 item=p/name
 if item.is_file():
  with item.open('rb') as source: metadata[name]=hashlib.file_digest(source,'sha256').hexdigest()
auxiliary={str(item.relative_to(p)):hashlib.file_digest(item.open('rb'),'sha256').hexdigest() for item in files if item.suffix!='.dcm'}
print(json.dumps({'status':'READ_ONLY','user':subprocess.check_output(['id','-un']).decode().strip(),'mac':pathlib.Path('/sys/class/net/ens33/address').read_text().strip(),'exists':exists,'rootSymlink':p.is_symlink(),'fileCount':len(files),'dicomCount':len(dicom),'dicomBytes':sum(f.stat().st_size for f in dicom),'symlinkCount':len(links),'manifestExists':(p/'manifest.json').is_file(),'probeExists':(p/'seed.mjs').is_file(),'metadataSha256':metadata,'auxiliarySha256':auxiliary,'expectedMetadataSha256':metadata_expected,'serverUid':server_uid,'stageUid':p.stat().st_uid if exists else None,'studyUid':(p/'study').stat().st_uid if (p/'study').exists() else None,'dataDirUid':(p/'study/01_reference_interpolated').stat().st_uid if (p/'study/01_reference_interpolated').exists() else None,'stageMode':oct(p.stat().st_mode & 0o777) if exists else None,'studyMode':oct((p/'study').stat().st_mode & 0o777) if (p/'study').exists() else None,'dataDirMode':oct((p/'study/01_reference_interpolated').stat().st_mode & 0o777) if (p/'study/01_reference_interpolated').exists() else None}))"""
        compile(remote_program, "remote_hcc_inventory", "exec")
        command = "sudo -S -p '' timeout 20s python3 -c " + shlex.quote(remote_program)
        code, details = ops.run(client, command, credential=credential, seconds=20)
        if code:
            result["remoteExitCode"] = code
            result["remoteDiagnostic"] = details[-1000:]
            raise RuntimeError("A_EXACT_STAGE_INSPECTION_FAILED")
        stage_data = json.loads(details.strip().splitlines()[-1])
        result["stageInventory"] = stage_data
        result["status"] = "PASS" if (stage_data.get("user") == "root" and stage_data.get("mac") == mac
            and stage_data.get("exists") is True and stage_data.get("rootSymlink") is False
            and stage_data.get("fileCount") == 702 and stage_data.get("dicomCount") == 700
            and stage_data.get("dicomBytes") == 2202766342 and stage_data.get("symlinkCount") == 0
            and stage_data.get("stageUid") == stage_data.get("serverUid")
            and stage_data.get("studyUid") == stage_data.get("serverUid")
            and stage_data.get("dataDirUid") == stage_data.get("serverUid")
            and stage_data.get("manifestExists") and stage_data.get("probeExists")
            and stage_data.get("metadataSha256") == stage_data.get("expectedMetadataSha256")) else "CONFLICT"
    except Exception as error:
        result["failureCode"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    finally:
        client.close(); trust.close(); credential = None
    result["evidence"] = str(output / "result.json")
    (output / "result.json").write_text(json.dumps(result, indent=2, ensure_ascii=True) + "\n", encoding="utf8")
    ops.emit(result)
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({"status": "NOT VERIFIED", "failureCode": str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
