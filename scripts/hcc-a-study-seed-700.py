"""Import the fixed 700-instance synthetic CT into Highpass A test PACS only."""
import argparse
import getpass
import hashlib
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
PROBE_TARGET = "seed-resume-v5.mjs"
LEGACY_PROBE_SHA256 = "85d31661369c9e200ec80c06c359a216922071bcb03928ce203705bbc54fcaab"
PRIOR_RESUME_PROBE_SHA256 = "d5fe881cf6536d446642aad50ea6f490c0da8685bb7fc521cad0fb9122c39b01"
PRIOR_RESUME_V2_SHA256 = "8ee9132417d856368c1d86f4768b504879ea72afc84503aca6e26c35c4c0bf0f"
PRIOR_RESUME_V3_SHA256 = "c2ec4f66b0891a93535e7e78ebd8224e44ddce966f2520e757e33f3f76012ec7"
PRIOR_RESUME_V4_SHA256 = "6a40b46f2cd90c0edbdbc25e9c4a78bb5c5e9121ab4f9ec0d163d0474a715c20"
IMAGE_ID = "sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df"
NETWORK = "hp-capstone-hospital-a_pacs_private"
SPEC = importlib.util.spec_from_file_location("hcc_seed_vm_ops", ROOT / "scripts/workstation-automatic-ops.py")
ops = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ops)


def remote_run(client, command, credential=None, seconds=30, root=False):
    wrapped = ("sudo -S -p '' " if root else "") + "timeout " + str(seconds) + "s bash -c " + shlex.quote("set -eu; " + command)
    return ops.run(client, wrapped, credential=credential if root else None, seconds=seconds + 5)


def verify_local_dataset(preflight_path, allow_partial_resume=False):
    preflight = json.loads(preflight_path.read_text(encoding="utf8"))
    observed_at = datetime.fromisoformat(preflight.get("observedAt", "").replace("Z", "+00:00"))
    age_seconds = (datetime.now(timezone.utc) - observed_at.astimezone(timezone.utc)).total_seconds()
    manifest = json.loads((DATASET / "manifest.json").read_text(encoding="utf8"))
    qido = next((item for item in preflight.get("checks", [])
                 if item.get("test") == "STRICT_MTLS_QIDO_UID_COLLISION_PREFLIGHT"), {})
    normal_empty = (preflight.get("status") == "PASS" and preflight.get("nextWriteAllowed") is True
                    and qido.get("studyCount") == 0 and qido.get("targetPresent") is False)
    exact_partial = (allow_partial_resume and preflight.get("status") == "CONFLICT"
                     and preflight.get("nextWriteAllowed") is False and qido.get("status") == "CONFLICT"
                     and qido.get("studyCount") == 1 and qido.get("targetPresent") is True
                     and qido.get("targetSeriesCount") == 1 and qido.get("targetInstanceCount") == 1
                     and qido.get("targetUniqueSopCount") == 1
                     and qido.get("studyUids") == [manifest.get("studyInstanceUID")])
    all_other_checks_pass = all(item.get("status") == "PASS" for item in preflight.get("checks", [])
                                if item.get("test") != "STRICT_MTLS_QIDO_UID_COLLISION_PREFLIGHT")
    if (not (normal_empty or exact_partial) or not all_other_checks_pass
            or age_seconds < -60 or age_seconds > 1800
            or preflight.get("dataset", {}).get("studyUid") != manifest.get("studyInstanceUID")
            or preflight.get("dataset", {}).get("manifestSha256") != manifest.get("canonicalManifestSha256")):
        raise RuntimeError("FRESH_EMPTY_A_PACS_PREFLIGHT_REQUIRED")
    if manifest.get("totalInstances") != 700 or manifest.get("totalDicomBytes") != 2202766342:
        raise RuntimeError("FIXED_700_DATASET_REQUIRED")
    for index, row in enumerate(manifest["instances"], start=1):
        relative = pathlib.PurePosixPath(row["file"])
        if relative.is_absolute() or ".." in relative.parts or relative.suffix != ".dcm":
            raise RuntimeError("DATASET_PATH_INVALID")
        file_path = (DATASET / pathlib.Path(*relative.parts)).resolve(strict=True)
        if not file_path.is_relative_to(DATASET.resolve()) or file_path.stat().st_size != row["bytes"]:
            raise RuntimeError("DATASET_FILE_INVENTORY_MISMATCH")
        with file_path.open("rb") as source:
            digest = hashlib.file_digest(source, "sha256").hexdigest()
        if digest != row["sha256"]:
            raise RuntimeError("FULL_LOCAL_DICOM_SHA256_MISMATCH_AT_" + str(index))
        if index % 100 == 0:
            ops.emit({"phase": "LOCAL_FULL_DICOM_SHA256", "verified": index, "total": 700})
    if len(manifest["instances"]) != 700 or sum(row["bytes"] for row in manifest["instances"]) != manifest["totalDicomBytes"]:
        raise RuntimeError("LOCAL_DICOM_TOTAL_MISMATCH")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=pathlib.Path)
    parser.add_argument("--preflight", type=pathlib.Path, required=True,
                        help="Fresh PASS result from hcc-a-pacs-readonly-preflight.py")
    parser.add_argument("--reuse-stage",
                        help="Resume only this exact operator-created staging directory; never overwrites existing files")
    parser.add_argument("--resume-partial", action="store_true",
                        help="Permit only the exact one-instance subset reported by a fresh QIDO preflight")
    args = parser.parse_args()
    if args.resume_partial and not args.reuse_stage:
        parser.error("--resume-partial requires --reuse-stage")
    output = (args.output or (ROOT / "artifacts/workstation" / ("hcc-main-a-import-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")))).resolve()
    allowed = (ROOT / "artifacts/workstation").resolve()
    if not output.is_relative_to(allowed) or output == allowed:
        raise RuntimeError("OUTPUT_PATH_OUTSIDE_WORKSTATION_ARTIFACTS")
    output.mkdir(parents=True, exist_ok=False)

    result = {"status": "NOT VERIFIED", "scope": "A_TEST_ORTHANC_SYNTHETIC_700_INSTANCE_IMPORT_ONLY", "review": "DRAFT / UNASSIGNED",
              "destinationB": "NOT TOUCHED", "automaticRollback": "NOT PERFORMED; partial import is preserved for reconciliation"}
    stage = None
    uploaded = []
    client = paramiko.SSHClient()
    trust = None
    credential = None
    try:
        result["phase"] = "LOCAL_FULL_HASH_VALIDATION"
        preflight_path = args.preflight.resolve(strict=True)
        if not preflight_path.is_relative_to((ROOT / "artifacts/workstation").resolve()):
            raise RuntimeError("PREFLIGHT_OUTSIDE_WORKSTATION_ARTIFACTS")
        manifest = verify_local_dataset(preflight_path, allow_partial_resume=args.resume_partial)
        result["dataset"] = {"studyUid": manifest["studyInstanceUID"], "seriesUid": manifest["seriesInstanceUID"],
                             "instanceCount": manifest["totalInstances"], "bytes": manifest["totalDicomBytes"],
                             "manifestSha256": manifest["canonicalManifestSha256"], "allLocalDICOMHashes": "PASS"}

        credential = getpass.getpass("VM credential (concealed): ")
        trust = ops.LocalVmTrust()
        address, mac, _ = ops.ROLES["A"]
        if args.reuse_stage:
            if not re.fullmatch(r"/home/server/\.highpass-hcc-main-\d{8}T\d{6}Z", args.reuse_stage):
                raise RuntimeError("EXACT_OPERATOR_STAGE_PATH_REQUIRED")
            stage = args.reuse_stage
        else:
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            stage = "/home/server/.highpass-hcc-main-" + stamp
        key = trust.key("A", credential, output / "A-public-host.key")
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username="server", password=credential, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        code, _ = remote_run(client, "test $(id -un) = server; test $(cat /sys/class/net/ens33/address) = " + shlex.quote(mac))
        if code:
            raise RuntimeError("A_VM_ROLE_PIN_FAILED")

        result["phase"] = "REMOTE_CAPACITY_AND_PINNED_CONTAINERS"
        checks = [
            ("A_GATEWAY_EXACT_IMAGE", "test \"$(docker inspect hp-capstone-a-gateway-gateway-1 --format '{{.Image}}')\" = " + IMAGE_ID),
            ("A_ORTHANC_EXACT_IMAGE_AND_HEALTH", "test \"$(docker inspect hp-capstone-hospital-a-orthanc-1 --format '{{.Image}}|{{.State.Health.Status}}')\" = 'sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a|healthy'"),
            ("A_MTLS_PROXY_EXACT_IMAGE_AND_HEALTH", "test \"$(docker inspect hp-capstone-hospital-a-orthanc-mtls-1 --format '{{.Image}}|{{.State.Health.Status}}')\" = 'sha256:853ed9b5269a6781eff54b29942f6368c9d14f6a36add88ebdb5dcc1b0744802|healthy'"),
            ("A_PACS_NETWORK_INTERNAL", "test \"$(docker network inspect hp-capstone-hospital-a_pacs_private --format '{{.Internal}}')\" = true"),
            ("A_GATEWAY_CLIENT_KEY_GROUP_MODE", "test \"$(stat -c '%g:%a' /opt/highpass/capstone-a-gateway-secrets/gateway-client.key)\" = 65532:640"),
            ("A_NO_PRIOR_SEED_CONTAINER", "test -z \"$(docker ps --filter label=highpass.hcc-main-seed-stage --format '{{.ID}}')\""),
        ]
        result["remotePreflight"] = []
        for check_name, check_command in checks:
            code, _ = remote_run(client, check_command, credential=credential, seconds=15, root=True)
            result["remotePreflight"].append({"test": check_name, "status": "PASS" if code == 0 else "FAIL"})
            if code:
                raise RuntimeError(check_name + "_FAILED")
        code, disk = remote_run(client, "df -Pk /home/server /var/lib/docker", credential=credential, seconds=15, root=True)
        values = []
        if code == 0:
            for line in disk.splitlines()[1:]:
                columns = line.split()
                if len(columns) >= 4 and columns[3].isdigit():
                    values.append(int(columns[3]))
        sufficient = bool(values) and all(value >= 6000000 for value in values)
        result["remotePreflight"].append({"test": "A_STAGE_AND_DOCKER_DISK_HEADROOM", "status": "PASS" if sufficient else "FAIL",
                                          "availableKibibytes": values, "requiredKibibytesPerFilesystem": 6000000,
                                          "checkExitCode": code})
        if not sufficient:
            raise RuntimeError("A_DISK_HEADROOM_INSUFFICIENT")

        result["phase"] = "PRIVATE_SFTP_STAGE"
        stage_result = {"metadataPresent": False}
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(30)
            if args.reuse_stage:
                relative_files = [row["file"] for row in manifest["instances"]]
                expected_json = json.dumps(relative_files, separators=(",", ":"))
                metadata_hashes = json.dumps({
                    "manifest.json": hashlib.sha256((DATASET / "manifest.json").read_bytes()).hexdigest(),
                    PROBE_TARGET: hashlib.sha256(PROBE.read_bytes()).hexdigest(),
                }, separators=(",", ":"))
                stage_check = """import json,os,pathlib,subprocess,sys
import hashlib
p=pathlib.Path(""" + repr(stage) + """)
expected=set(json.loads(""" + repr(expected_json) + """))
metadata_expected=json.loads(""" + repr(metadata_hashes) + """)
legacy_probe_sha=""" + repr(LEGACY_PROBE_SHA256) + """
prior_resume_probe_sha=""" + repr(PRIOR_RESUME_PROBE_SHA256) + """
prior_resume_v2_sha=""" + repr(PRIOR_RESUME_V2_SHA256) + """
prior_resume_v3_sha=""" + repr(PRIOR_RESUME_V3_SHA256) + """
prior_resume_v4_sha=""" + repr(PRIOR_RESUME_V4_SHA256) + """
if not p.is_dir() or p.is_symlink(): sys.exit("STAGE_ROOT_INVALID")
if p.stat().st_uid!=int(subprocess.check_output(['id','-u','server']).decode().strip()): sys.exit("STAGE_OWNER_INVALID")
if (p/'study').stat().st_uid!=p.stat().st_uid or (p/'study/01_reference_interpolated').stat().st_uid!=p.stat().st_uid: sys.exit("STAGE_DIRECTORY_OWNER_INVALID")
all_files=[]; links=[]
for base,dirs,names in os.walk(p,followlinks=False):
 for name in list(dirs)+names:
  item=pathlib.Path(base)/name
  if item.is_symlink(): links.append(str(item.relative_to(p)))
 all_files.extend(pathlib.Path(base)/name for name in names)
if links: sys.exit("STAGE_SYMLINK_PRESENT")
relative={str(item.relative_to(p)) for item in all_files}
metadata=set(metadata_expected)
preserved={'seed.mjs','seed-resume.mjs','seed-resume-v2.mjs','seed-resume-v3.mjs','seed-resume-v4.mjs'}
base=expected|preserved|{'manifest.json'}
if relative not in (base,base|{'seed-resume-v5.mjs'}): sys.exit("STAGE_FILE_SET_MISMATCH")
if any(item.suffix!='.dcm' for item in all_files if item.name not in (metadata|preserved)): sys.exit("STAGE_NON_DICOM_PRESENT")
with (p/'manifest.json').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=metadata_expected['manifest.json']: sys.exit("STAGE_MANIFEST_HASH_MISMATCH")
with (p/'seed.mjs').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=legacy_probe_sha: sys.exit("STAGE_LEGACY_PROBE_HASH_MISMATCH")
with (p/'seed-resume.mjs').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=prior_resume_probe_sha: sys.exit("STAGE_PRESERVED_PROBE_HASH_MISMATCH")
with (p/'seed-resume-v2.mjs').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=prior_resume_v2_sha: sys.exit("STAGE_PRESERVED_PROBE_HASH_MISMATCH")
with (p/'seed-resume-v3.mjs').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=prior_resume_v3_sha: sys.exit("STAGE_PRESERVED_PROBE_HASH_MISMATCH")
with (p/'seed-resume-v4.mjs').open('rb') as source:
 if hashlib.file_digest(source,'sha256').hexdigest()!=prior_resume_v4_sha: sys.exit("STAGE_PRESERVED_PROBE_HASH_MISMATCH")
metadata_present='seed-resume-v5.mjs' in relative
if metadata_present:
 with (p/'seed-resume-v5.mjs').open('rb') as source:
  if hashlib.file_digest(source,'sha256').hexdigest()!=metadata_expected['seed-resume-v5.mjs']: sys.exit("STAGE_RESUME_PROBE_HASH_MISMATCH")
print(json.dumps({'status':'PASS','fileCount':len(all_files),'dicomBytes':sum(item.stat().st_size for item in all_files if item.suffix=='.dcm'),'metadataPresent':metadata_present}))"""
                compile(stage_check, "remote_hcc_stage_check", "exec")
                command = "sudo -S -p '' timeout 20s python3 -c " + shlex.quote(stage_check)
                code, details = ops.run(client, command, credential=credential, seconds=20)
                if code:
                    result["stageCheckDiagnostic"] = details[-1000:]
                    raise RuntimeError("EXISTING_STAGE_NOT_EXACT_OR_NOT_OWNED")
                stage_result = json.loads(details.strip().splitlines()[-1])
                if stage_result.get("fileCount") not in (706, 707) or stage_result.get("dicomBytes") != manifest["totalDicomBytes"]:
                    raise RuntimeError("EXISTING_STAGE_SIZE_INVENTORY_MISMATCH")
                for row in manifest["instances"]:
                    remote_path = stage + "/" + row["file"]
                    if sftp.stat(remote_path).st_size != row["bytes"]:
                        raise RuntimeError("EXISTING_STAGE_FILE_SIZE_MISMATCH")
                    uploaded.append(remote_path)
                metadata_targets = [stage + "/manifest.json", stage + "/seed.mjs", stage + "/seed-resume.mjs", stage + "/seed-resume-v2.mjs", stage + "/seed-resume-v3.mjs", stage + "/seed-resume-v4.mjs", stage + "/" + PROBE_TARGET]
                if not stage_result.get("metadataPresent"):
                    for target in [stage + "/" + PROBE_TARGET]:
                        try:
                            sftp.stat(target)
                        except FileNotFoundError:
                            continue
                        raise RuntimeError("REFUSE_TO_OVERWRITE_EXISTING_STAGE_METADATA")
                uploaded.extend(metadata_targets)
            else:
                sftp.mkdir(stage, mode=0o700)
                sftp.mkdir(stage + "/study", mode=0o700)
                sftp.mkdir(stage + "/study/01_reference_interpolated", mode=0o700)
                for row in manifest["instances"]:
                    source = DATASET / pathlib.Path(*pathlib.PurePosixPath(row["file"]).parts)
                    target = stage + "/" + row["file"]
                    uploaded.append(target)
                    sftp.put(str(source), target, confirm=True)
                    sftp.chmod(target, 0o600)
                    if len(uploaded) % 50 == 0:
                        ops.emit({"phase": "PRIVATE_SFTP_STAGE", "transferredInstances": len(uploaded), "total": 700})
                uploaded.extend([stage + "/manifest.json", stage + "/" + PROBE_TARGET])
            if not stage_result.get("metadataPresent"):
                files_to_add = [(PROBE, stage + "/" + PROBE_TARGET)]
                if not args.reuse_stage:
                    files_to_add.insert(0, (DATASET / "manifest.json", stage + "/manifest.json"))
                for source, target in files_to_add:
                    sftp.put(str(source), target, confirm=True)
                    sftp.chmod(target, 0o600)

        code, _ = remote_run(client, "chgrp -R 65532 " + shlex.quote(stage)
                             + "; chmod 0770 " + shlex.quote(stage) + " " + shlex.quote(stage + "/study") + " "
                             + shlex.quote(stage + "/study/01_reference_interpolated")
                             + "; find " + shlex.quote(stage) + " -type f -exec chmod 0640 {} +", credential=credential, seconds=20, root=True)
        if code:
            raise RuntimeError("PRIVATE_STAGE_GROUP_PERMISSION_FAILED")

        result["phase"] = "A_ONLY_IMPORT_AND_FULL_RAW_READBACK"
        uid, gid = "1000", "65532"
        code, owner = remote_run(client, "id -u server", seconds=10)
        if code:
            raise RuntimeError("A_OPERATOR_UID_LOOKUP_FAILED")
        numeric = [part.strip() for part in owner.splitlines() if part.strip().isdigit()]
        if len(numeric) != 1:
            raise RuntimeError("A_OPERATOR_UID_LOOKUP_FAILED")
        uid = numeric[0]
        docker_command = ("docker run --rm --pull never --label highpass.hcc-main-seed-stage=" + shlex.quote(stage)
                          + " --network " + NETWORK + " --user " + uid + ":" + gid
                          + " --read-only --cap-drop ALL --security-opt no-new-privileges:true --pids-limit 64 --memory 512m --cpus 2"
                          + " --mount type=bind,src=" + shlex.quote(stage) + ",dst=/dataset,readonly"
                          + " --mount type=bind,src=/opt/highpass/capstone-a-gateway-secrets/ca.crt,dst=/tmp/hcc-ca.crt,readonly"
                          + " --mount type=bind,src=/opt/highpass/capstone-a-gateway-secrets/gateway-client.crt,dst=/tmp/hcc-gateway-client.crt,readonly"
                          + " --mount type=bind,src=/opt/highpass/capstone-a-gateway-secrets/gateway-client.key,dst=/tmp/hcc-gateway-client.key,readonly"
                          + " " + IMAGE_ID + " /dataset/" + PROBE_TARGET)
        code, output_text = remote_run(client, docker_command, credential=credential, seconds=1800, root=True)
        records = []
        for line in output_text.splitlines():
            try:
                value = json.loads(line)
                if isinstance(value, dict): records.append(value)
            except ValueError:
                continue
        final = next((item for item in reversed(records) if item.get("status") == "PASS"), None)
        if code or final is None:
            result["partialProgress"] = records[-40:]
            result["remoteOutputTail"] = output_text[-3000:]
            raise RuntimeError("A_IMPORT_OR_FULL_READBACK_NOT_VERIFIED")
        result["pacsImport"] = final

        result["phase"] = "EXACT_TEMPORARY_STAGE_CLEANUP"
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(20)
            for target in uploaded:
                sftp.remove(target)
            sftp.rmdir(stage + "/study/01_reference_interpolated")
            sftp.rmdir(stage + "/study")
            sftp.rmdir(stage)
        result["stageCleanup"] = "PASS"
        result["status"] = "PASS"
    except Exception as error:
        result["failureCode"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        result["remoteStage"] = stage if stage else None
        result["remoteStageDisposition"] = ("EXISTING_OPERATOR_STAGE_PRESERVED" if args.reuse_stage
                                             else "PRESERVED_FOR_RECONCILIATION" if stage and uploaded
                                             else "NOT CREATED")
    finally:
        credential = None
        client.close()
        if trust: trust.close()

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
