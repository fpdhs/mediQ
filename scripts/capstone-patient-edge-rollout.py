"""Reviewed-image A/B patient opt-in; default inventory, explicit --apply only."""
import argparse
import getpass
import hashlib
import hmac
import importlib.util
import json
import os
import pathlib
import re
import shlex
import stat
import subprocess
import time
from datetime import datetime, timezone

import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


rollout = module("cloud_rollout", "scripts/capstone-cloud-app-rollout.py")
gateway = module("gateway_ops", "scripts/capstone-a-gateway-ops.py")
permissions = module("secret_permissions", "scripts/lib/patient_secret_permissions.py")
ops = rollout.base.ops
IMAGE = "sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df"
BASELINES = {
    "A": "sha256:2c7b366483f1c22855d3a98b6079c05ff4551beb67a77ead94152d623fe542a1",
    "B": "sha256:940806f602ec282d6d03a9da6948b6a8453bb47ff9f71fdadb8aa40fa5521aea",
}


def edge_context(labels, role):
    project = "hp-capstone-a-gateway" if role == "A" else "hp-capstone-b-portal"
    if labels.get("com.docker.compose.project") != project:
        raise RuntimeError("EDGE_PROJECT_MISMATCH")
    workdir = labels.get("com.docker.compose.project.working_dir", "")
    files = labels.get("com.docker.compose.project.config_files", "").split(",")
    directory_pattern = r"/home/server/\.highpass-[A-Za-z0-9T.+_-]{1,120}"
    if not re.fullmatch(directory_pattern, workdir) or not 1 <= len(files) <= 4:
        raise RuntimeError("EDGE_CONTEXT_INVALID")
    for file in files:
        path = pathlib.PurePosixPath(file)
        if (str(path) != file or not re.fullmatch(directory_pattern, str(path.parent))
                or not re.fullmatch(r"[a-z0-9-]+\.(yml|yaml)", path.name)):
            raise RuntimeError("EDGE_CONFIG_PATH_INVALID")
    if len(set(files)) != len(files):
        raise RuntimeError("EDGE_CONFIG_DUPLICATE")
    return project, workdir, files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    directory = ROOT / "artifacts/workstation" / (
        "patient-edge-rollout-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    directory.mkdir()
    credential = getpass.getpass("VM credential (concealed): ")
    trust = None
    cloud = paramiko.SSHClient()
    clients = []
    changed = []
    archive = directory / "reviewed-app.tar"
    checks = []
    phase = "HOST_AND_RUNTIME_INVENTORY"
    status = "NOT VERIFIED"

    def command(client, value, seconds=25, vm=True):
        prefix = "sudo -S -p '' " if vm else "sudo -n "
        code, output = ops.run(client, prefix + "timeout " + str(seconds) + "s bash -c "
                               + shlex.quote("set -eu; " + value),
                               credential=credential if vm else None, seconds=seconds + 5)
        if code:
            raise RuntimeError("EDGE_COMMAND_FAILED_" + phase + "_" + str(code))
        return output.strip()

    def emit():
        ops.emit({"phase": phase, "status": "RUNNING"})

    def runtime(client, name, expected):
        deadline = time.monotonic() + 90
        while True:
            value = json.loads(command(client, "docker inspect " + name))[0]
            if (value["Image"] == expected and value["State"].get("Running")
                    and value["State"].get("Health", {}).get("Status") == "healthy"):
                return value
            if time.monotonic() >= deadline:
                raise RuntimeError("EDGE_READINESS_DEADLINE_SAME_CONTAINER")
            time.sleep(2)

    try:
        emit()
        trust = ops.LocalVmTrust()
        identity = pathlib.Path(os.environ["USERPROFILE"]) / ".ssh/highpass-capstone-cloud"
        cloud.load_host_keys(str(identity / "known_hosts"))
        cloud.set_missing_host_key_policy(paramiko.RejectPolicy())
        cloud.connect("138.91.2.60", username="highpassadmin", key_filename=str(identity / "id_ed25519"),
                      look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10,
                      auth_timeout=10, channel_timeout=15)
        assert command(cloud, "docker inspect hp-capstone-control-control-1 --format '{{.Image}}'", vm=False) == IMAGE
        assert command(cloud, "docker inspect hp-capstone-control-control-1 --format '{{.State.Health.Status}}'", vm=False) == "healthy"
        contexts = []
        for role in ("A", "B"):
            address, mac, _ = ops.ROLES[role]
            key = trust.key(role, credential, directory / (role + "-public-host.key"))
            client = paramiko.SSHClient()
            clients.append(client)
            client.get_host_keys().add(address, key.get_name(), key)
            client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect(address, username="server", password=credential, look_for_keys=False,
                           allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
            assert command(client, "test $(id -u server) = 1000; test $(cat /sys/class/net/ens33/address) = " + mac) == ""
            service = "gateway" if role == "A" else "portal"
            name = "hp-capstone-" + role.lower() + "-" + service + "-" + service + "-1"
            before = runtime(client, name, BASELINES[role])
            project, workdir, files = edge_context(before["Config"]["Labels"], role)
            pacs_ids = command(client, "docker ps -aq --filter label=com.docker.compose.project=hp-capstone-hospital-" + role.lower()).split()
            # A owns originals. The deployed B profile is a portal/viewer, not
            # a PACS import deployment. Preserve any B PACS if present; do not
            # fabricate one or claim a destination import was verified.
            if (role == "A" and not pacs_ids) or any(not re.fullmatch(r"[a-f0-9]{12,64}", value) for value in pacs_ids):
                inventory = command(client, "docker ps -a --format '{{.Names}}|{{.Label \"com.docker.compose.project\"}}|{{.Image}}|{{.Status}}'")
                checks.append({"test": role + "_CONTAINER_INVENTORY", "status": "NOT VERIFIED",
                               "containers": inventory.splitlines()})
                raise RuntimeError("EDGE_PACS_BASELINE_REQUIRED")
            pacs = json.loads(command(client, "docker inspect " + " ".join(pacs_ids))) if pacs_ids else []
            contexts.append(dict(role=role, client=client, service=service, name=name, before=before,
                                 project=project, workdir=workdir, files=files, pacs=pacs))
            checks.append({"test": role + "_STRICT_HOST_BASELINE", "status": "PASS",
                           "image": before["Image"], "directory": workdir, "files": files,
                           "preservedPacsContainers": len(pacs),
                           "destinationPacsImport": "NOT VERIFIED" if role == "B" else "N/A"})
        if not args.apply:
            status = "PASS"
        else:
            phase = "APPROVED_IMAGE_ARCHIVE"
            emit()
            assert rollout.base.local(["docker", "image", "inspect", IMAGE, "--format", "{{.Id}}"] ) == IMAGE
            scan = json.loads((ROOT / "artifacts/security/container-scan/patient-registration-cli-20261010.json").read_text())
            assert scan["Metadata"]["ImageID"] == IMAGE
            assert not [v for row in scan.get("Results", []) for v in row.get("Vulnerabilities", [])
                        if v["Severity"] in ("HIGH", "CRITICAL")]
            subprocess.run(["docker", "save", "-o", str(archive), IMAGE], cwd=ROOT,
                           capture_output=True, check=True, timeout=180)
            with archive.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            for ctx in contexts:
                role, client, service = ctx["role"], ctx["client"], ctx["service"]
                phase = role + "_OWN_CREDENTIAL_AND_IMAGE"
                emit()
                secret_name = "patient-" + role.lower() + "-service-secret"
                secret_directory = "/opt/highpass/capstone-" + role.lower() + ("-gateway-secrets" if role == "A" else "-portal-secrets")
                source_path = "/opt/highpass/capstone-control-secrets/" + secret_name
                with gateway.root_sftp(cloud) as source, gateway.root_sftp(client, credential) as target:
                    source.get_channel().settimeout(15)
                    target.get_channel().settimeout(15)
                    assert permissions.protected_secret_metadata(source.lstat(source_path), source.lstat(str(pathlib.PurePosixPath(source_path).parent)))
                    with source.open(source_path, "rb") as stream:
                        token = stream.read(257)
                    assert 32 <= len(token) <= 256 and re.fullmatch(b"[a-f0-9]{64}", token)
                    parent = target.lstat(secret_directory)
                    assert stat.S_ISDIR(parent.st_mode) and parent.st_uid == 0 and stat.S_IMODE(parent.st_mode) == 0o750 and parent.st_gid == 65532
                    target_path = secret_directory + "/" + secret_name
                    try:
                        info = target.lstat(target_path)
                    except FileNotFoundError:
                        info = None
                    if info is None:
                        with target.open(target_path, "wx") as stream:
                            stream.write(token)
                        target.chown(target_path, 0, 65532)
                        target.chmod(target_path, 0o640)
                    assert permissions.protected_secret_metadata(target.lstat(target_path), parent)
                    with target.open(target_path, "rb") as stream:
                        assert hmac.compare_digest(stream.read(257), token)
                    token = None
                remote_archive = ctx["workdir"] + "/patient-reviewed-app.tar"
                with client.open_sftp() as sftp:
                    sftp.get_channel().settimeout(15)
                    try:
                        sftp.lstat(remote_archive)
                    except FileNotFoundError:
                        pass
                    else:
                        raise RuntimeError("EXISTING_ARCHIVE_PRESERVED")
                    start = time.monotonic()
                    def deadline(done, total):
                        if time.monotonic() - start > 180:
                            raise RuntimeError("EDGE_TRANSFER_DEADLINE")
                    sftp.put(str(archive), remote_archive, callback=deadline)
                    sftp.chmod(remote_archive, 0o600)
                assert command(client, "sha256sum " + shlex.quote(remote_archive)).split()[0] == digest
                command(client, "docker load -i " + shlex.quote(remote_archive), 120)
                assert command(client, "docker image inspect " + IMAGE + " --format '{{.Id}}'") == IMAGE
                with client.open_sftp() as sftp:
                    assert stat.S_ISREG(sftp.lstat(remote_archive).st_mode)
                    sftp.remove(remote_archive)
                overlay_path = ctx["workdir"] + "/patient.yml"
                overlay = (ROOT / ("infra/workstation/hospital-" + role.lower() + "-patient.compose.yml")).read_text().replace("\r\n", "\n")
                with client.open_sftp() as sftp:
                    sftp.get_channel().settimeout(15)
                    try:
                        prior = sftp.lstat(overlay_path)
                    except FileNotFoundError:
                        prior = None
                    if prior:
                        assert stat.S_ISREG(prior.st_mode)
                        with sftp.open(overlay_path) as stream:
                            assert stream.read().decode() == overlay
                    else:
                        with sftp.open(overlay_path, "wx") as stream:
                            stream.write(overlay)
                        sftp.chmod(overlay_path, 0o600)
                values = {"HIPASS_KEY_RELEASE_VAULT_KEY_ID": rollout.KEY_ID,
                          ("HIPASS_A_GATEWAY_SECRET_DIR" if role == "A" else "HIPASS_B_PORTAL_SECRET_DIR"): secret_directory}
                def compose(image, files):
                    env = {**values, "HIPASS_APP_IMAGE": image}
                    return "env " + " ".join(k + "=" + shlex.quote(v) for k, v in env.items()) + " docker compose --project-directory " + shlex.quote(ctx["workdir"]) + " -p " + ctx["project"] + "".join(" -f " + shlex.quote(f) for f in files)
                ctx["baseline"] = compose(BASELINES[role], ctx["files"])
                ctx["candidate"] = compose(IMAGE, ctx["files"] + [overlay_path])
                baseline = json.loads(command(client, ctx["baseline"] + " config --format json"))
                candidate = json.loads(command(client, ctx["candidate"] + " config --format json"))
                expected = {"CAPSTONE_PATIENT_SELF_VIEW_GATEWAY": "1", "CAPSTONE_PATIENT_IMAGE_ENCRYPTION_REQUIRED": "1"}
                if role == "A":
                    expected.update(PATIENT_DATA_PLANE_SOURCE_HOSPITAL_ID="HOSP-A", PATIENT_DATA_PLANE_SERVICE_TOKEN_FILE="/run/secrets/" + secret_name)
                else:
                    expected["CAPSTONE_B_PATIENT_KEY_RELEASE_TOKEN_FILE"] = "/run/secrets/" + secret_name
                cfg = candidate["services"][service]
                assert cfg["image"] == IMAGE and baseline["services"][service]["image"] == BASELINES[role]
                cfg["image"] = BASELINES[role]
                for key, value in expected.items():
                    assert cfg["environment"].pop(key) == value
                added = [v for v in cfg["volumes"] if v["target"] == "/run/secrets/" + secret_name]
                assert len(added) == 1 and added[0]["source"] == target_path and added[0].get("read_only")
                cfg["volumes"] = [v for v in cfg["volumes"] if v not in added]
                assert candidate == baseline
                before_env = dict(v.split("=", 1) for v in ctx["before"]["Config"]["Env"])
                assert all(before_env.get(k) == str(v) for k, v in baseline["services"][service]["environment"].items())
                expected_binds = sorted((v["source"], v["target"], bool(v.get("read_only")))
                                        for v in baseline["services"][service].get("volumes", [])
                                        if v["type"] == "bind")
                actual_binds = sorted((v["Source"], v["Destination"], not v["RW"])
                                      for v in ctx["before"]["Mounts"] if v["Type"] == "bind")
                assert expected_binds == actual_binds
                phase = role + "_ACTIVATE_AND_ROLLBACK"
                emit()
                changed.append(ctx)
                command(client, ctx["candidate"] + " up -d --no-deps --force-recreate --pull never " + service, 90)
                runtime(client, ctx["name"], IMAGE)
                command(client, ctx["baseline"] + " up -d --no-deps --force-recreate --pull never " + service, 90)
                restored = runtime(client, ctx["name"], BASELINES[role])
                assert not rollout.runtime_differences(ctx["before"], restored)
                command(client, ctx["candidate"] + " up -d --no-deps --force-recreate --pull never " + service, 90)
                runtime(client, ctx["name"], IMAGE)
                for previous in ctx["pacs"]:
                    observed = json.loads(command(client, "docker inspect " + previous["Id"]))[0]
                    assert observed["Id"] == previous["Id"] and observed["Image"] == previous["Image"]
                    assert observed["Mounts"] == previous["Mounts"] and observed["Config"] == previous["Config"]
                    assert observed["State"].get("Running") == previous["State"].get("Running")
                checks.append({"test": role + "_EXACT_ROLE_CREDENTIAL_ACTIVATION_ROLLBACK_REACTIVATION", "status": "PASS"})
            status = "PASS"
    except Exception as error:
        checks.append({"test": phase, "status": "NOT VERIFIED",
                       "reason": str(error) if isinstance(error, RuntimeError) else type(error).__name__})
        for ctx in reversed(changed):
            try:
                command(ctx["client"], ctx["baseline"] + " up -d --no-deps --force-recreate --pull never " + ctx["service"], 90)
                restored = runtime(ctx["client"], ctx["name"], BASELINES[ctx["role"]])
                assert not rollout.runtime_differences(ctx["before"], restored)
                checks.append({"test": ctx["role"] + "_FAILURE_BASELINE_RECOVERY", "status": "PASS"})
            except Exception:
                checks.append({"test": ctx["role"] + "_FAILURE_BASELINE_RECOVERY", "status": "NOT VERIFIED"})
    finally:
        for client in clients:
            client.close()
        cloud.close()
        if trust:
            trust.close()
        credential = None
        if archive.exists():
            archive.unlink()
    result = {"status": status, "review": "DRAFT / UNASSIGNED", "applied": args.apply,
              "checks": checks, "image": IMAGE,
              "scope": "A/B role secret wiring and exact runtime readiness/rollback only; not patient public browser E2E or overall MVP",
              "evidence": str(directory / "result.json")}
    (directory / "result.json").write_text(json.dumps(result, indent=2))
    ops.emit(result)
    return 0 if status == "PASS" else 2


if __name__ == "__main__":
    raise SystemExit(main())
