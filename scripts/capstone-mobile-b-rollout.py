"""B-only mobile promotion. Password comes from stdin; no A/cloud/DB writes."""
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import pathlib
import re
import shlex
import subprocess
import sys
import tarfile
import time
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("vm_ops", ROOT / "scripts/workstation-automatic-ops.py")
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)
NAME = "hp-capstone-b-portal-portal-1"
FILES = ["src/capstone-b-portal.js", "public/mobile/app.js", "public/mobile/index.html", "public/mobile/sw.js"]

def local(args, timeout=60):
    result = subprocess.run(args, cwd=ROOT, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError("LOCAL_COMMAND_FAILED")
    return result.stdout.decode().strip()

def archived_file_bytes(blob):
    # Never extract archive paths to the host filesystem.
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:*") as archive:
        members = archive.getmembers()
        if len(members) != 1 or not members[0].isfile() or members[0].size > 2_000_000:
            raise RuntimeError("CANDIDATE_ARCHIVE_INVALID")
        return archive.extractfile(members[0]).read()

def candidate_hashes(image_id):
    container = local(["docker", "create", "--network=none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges", image_id], 30)
    if not re.fullmatch(r"[a-f0-9]{64}", container):
        raise RuntimeError("INSPECTION_CONTAINER_ID_INVALID")
    try:
        actual = {}
        for name in FILES:
            result = subprocess.run(["docker", "cp", container + ":/app/" + name, "-"], cwd=ROOT, capture_output=True, timeout=20)
            if result.returncode:
                raise RuntimeError("CANDIDATE_FILE_READ_FAILED")
            actual[name] = hashlib.sha256(archived_file_bytes(result.stdout)).hexdigest()
        return actual
    finally:
        # Only the exact container created here is removed; it is never started.
        local(["docker", "rm", container], 20)

def attest_candidate(image_id):
    expected = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in FILES}
    actual = candidate_hashes(image_id)
    if actual != expected:
        raise RuntimeError("CANDIDATE_SOURCE_MISMATCH")
    return expected

def presentation_files(manifest):
    assets = manifest.get("assets", [])
    names = [row.get("file") for row in assets]
    required = {"public/index.html", "public/app.js", "public/ui/workspace.css", "public/ui/tokens.css", "public/ui/clinician.js", "public/ui/patient.js", "public/mobile/index.html", "public/mobile/app.js", "public/mobile/sw.js", "public/mobile/manifest.json", "public/brand/mediq-source.png"}
    if (manifest.get("scope") != "PRESENTATION_STATIC_ASSETS_ONLY" or not names or
        any(not isinstance(name, str) or not re.fullmatch(r"public/[A-Za-z0-9_./-]+", name) or ".." in name or name.startswith(("public/assets/clinical/", "public/mockups/")) for name in names) or
        len(set(names)) != len(names) or not required.issubset(names)):
        raise RuntimeError("PRESENTATION_MANIFEST_INVALID")
    return ["src/capstone-b-portal.js"] + names

def validated_context(labels, active_presentation=False, current_image=None):
    stage = labels.get("com.docker.compose.project.working_dir", "")
    configs = labels.get("com.docker.compose.project.config_files", "").split(",")
    if labels.get("com.docker.compose.project") != "hp-capstone-b-portal" or not re.fullmatch(r"/home/server/\.highpass-app-[0-9T.+-]{20,60}", stage):
        raise RuntimeError("ORIGINAL_COMPOSE_PATH_INVALID")
    names = ["portal.yml", "encryption.yml"]
    if active_presentation:
        names += ["patient.yml", "faq-expiry-reviewed-20261010.yml", "session-expiry-reviewed-20261010.yml"]
        if len(configs) == 6 and re.fullmatch(r"sha256:[a-f0-9]{64}", current_image or ""):
            names += ["landing-" + current_image[7:23] + ".yml"]
        elif len(configs) == 7 and current_image == "sha256:16f08909fbda67fcb6a6066f965778234f61a4c230e0a8be5ccfe0b19ca9d52f":
            # Exact recorded v1 -> v2 presentation context; no wildcard overlays.
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml"]
        elif len(configs) == 8 and current_image == "sha256:0b384d41e87a5d621238ae6d9dc74159197aef2f8804d331414325d6df868d9b":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml"]
        elif len(configs) == 9 and current_image == "sha256:d506464be529e2d71ad0b192d4824936d8c98fdd413a779beea940cebc35d88d":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml"]
        elif len(configs) == 10 and current_image == "sha256:39c90099f9b9d9803e79218700a1e3fc0cf596a44b607e0605c4286a62bddf4f":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml"]
        elif len(configs) == 11 and current_image == "sha256:281def9e6c73768e68400da84bfea15a80468ba312b643c21f231f08fdd69681":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml"]
        elif len(configs) == 12 and current_image == "sha256:083ac58576c206e1c37611c88eb299c02e4e017ddf35db75319e6911495641e2":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml"]
        elif len(configs) == 13 and current_image == "sha256:d19c3f3aef605e6daa8840d7e5f70787c7a95a29558949502e5b3dcbf22189e5":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml"]
        elif len(configs) == 14 and current_image == "sha256:274828c4024b9e3d7260d04591607702fda8a3688fa251099627a0ffa4da8427":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml"]
        elif len(configs) == 15 and current_image == "sha256:c15f391556ea23fc5c410a9d94f10923ee59919509a71a38a4bda04f7acdbb2f":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml"]
        elif len(configs) == 16 and current_image == "sha256:575ac324f495cc2d69d4dd67efd761ad73ee76794b446d5559ffe72a0e243058":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml"]
        elif len(configs) == 17 and current_image == "sha256:5b86a9d33d74a7a4d273922f7b46dd24a1025b7e04954a61eb74838b7be5bde2":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml", "landing-5b86a9d33d74a7a4.yml"]
        elif len(configs) == 18 and current_image == "sha256:7031ff65358cb3c09889e6f4484ff05680420755d213a23e1f2b33f032591c22":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml", "landing-5b86a9d33d74a7a4.yml", "landing-7031ff65358cb3c0.yml"]
        elif len(configs) == 19 and current_image == "sha256:1542825d8ce5fba651c8af1cc18885003a54bb753a758af04f567d4797751de0":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml", "landing-5b86a9d33d74a7a4.yml", "landing-7031ff65358cb3c0.yml", "landing-1542825d8ce5fba6.yml"]
        elif len(configs) == 20 and current_image == "sha256:2e56b6d1043e4761576b16f7826f01e27c63f65920e1ce71148dcdb47557f155":
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml", "landing-5b86a9d33d74a7a4.yml", "landing-7031ff65358cb3c0.yml", "landing-1542825d8ce5fba6.yml", "landing-2e56b6d1043e4761.yml"]
        elif len(configs) == 21 and current_image == "sha256:62396d56ab6d53db2a570b014575c8601a7666ae55c14cceda8b941c0d3d0b0c":
            # Exact B context observed read-only on 2026-10-11; preserve all overlays.
            names += ["landing-2f816a95229a6d6b.yml", "landing-16f08909fbda67fc.yml", "landing-0b384d41e87a5d62.yml", "landing-d506464be529e2d7.yml", "landing-39c90099f9b9d980.yml", "landing-281def9e6c73768e.yml", "landing-083ac58576c206e1.yml", "landing-d19c3f3aef605e6d.yml", "landing-274828c4024b9e3d.yml", "landing-c15f391556ea23fc.yml", "landing-575ac324f495cc2d.yml", "landing-5b86a9d33d74a7a4.yml", "landing-7031ff65358cb3c0.yml", "landing-1542825d8ce5fba6.yml", "landing-2e56b6d1043e4761.yml", "landing-62396d56ab6d53db.yml"]
        elif len(configs) == 22 and current_image == "sha256:1a62fa81c7a91953f9b86ce040f05c93610c57a5b59e2366d02f8a3d93ee6141":
            # Exact 22-overlay context observed read-only on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:62396d56ab6d53db2a570b014575c8601a7666ae55c14cceda8b941c0d3d0b0c")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-1a62fa81c7a91953.yml"]
        elif len(configs) == 23 and current_image == "sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905":
            # Exact 23-overlay context re-observed read-only on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:1a62fa81c7a91953f9b86ce040f05c93610c57a5b59e2366d02f8a3d93ee6141")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-7015bff17490ea62.yml"]
        elif len(configs) == 24 and current_image == "sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a":
            # Exact 24-overlay context re-observed through pinned SSH on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-f1fdd1bd635b15f5.yml"]
        elif len(configs) == 25 and current_image == "sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce":
            # Exact 25-file chain observed via pinned SSH on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-fd703f2097189470.yml"]
        elif len(configs) == 26 and current_image == "sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a":
            # Exact 26-file chain re-observed through pinned SSH on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-0c6a5d45fe59889b.yml"]
        elif len(configs) == 27 and current_image == "sha256:ae7365a62702ff13d352c1f1ed9be12ab7a37c7858b970f1ffeebe543c822ce6":
            # Exact 27-file chain re-observed via pinned SSH on 2026-10-11.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-ae7365a62702ff13.yml"]
        elif len(configs) == 28 and current_image == "sha256:b1994ea392d79b952bbbe5f044362643199a864ea079f14bb3836b79b189c3aa":
            # Exact post-sage image-only chain from the verified promotion receipt.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:ae7365a62702ff13d352c1f1ed9be12ab7a37c7858b970f1ffeebe543c822ce6")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-b1994ea392d79b95.yml"]
        elif len(configs) == 29 and current_image == "sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685":
            # Pinned SSH read-only inventory on 2026-10-11, not a wildcard chain.
            prior_labels = dict(labels)
            prior_labels["com.docker.compose.project.config_files"] = ",".join(configs[:-1])
            _, prior_configs = validated_context(prior_labels, True, "sha256:b1994ea392d79b952bbbe5f044362643199a864ea079f14bb3836b79b189c3aa")
            names += [pathlib.PurePosixPath(p).name for p in prior_configs[5:]] + ["landing-792b4e3b82b8cd3e.yml"]
    if configs != [stage + "/" + name for name in names]:
        raise RuntimeError("ORIGINAL_COMPOSE_FILES_INVALID")
    return stage, configs

def runtime_differences(before, after):
    def environment(values):
        parsed = dict(value.split("=", 1) for value in values)
        if len(parsed) != len(values):
            raise RuntimeError("DUPLICATE_RUNTIME_ENVIRONMENT")
        return parsed
    # Order in Docker inspection arrays is not a runtime permission or value.
    differences = []
    if environment(before["Config"]["Env"]) != environment(after["Config"]["Env"]):
        differences.append("ENVIRONMENT_VALUES")
    if sorted(before["HostConfig"].get("Binds") or []) != sorted(after["HostConfig"].get("Binds") or []):
        differences.append("MOUNT_BINDINGS")
    for group, keys in [("Config", ["Cmd", "Entrypoint", "User", "WorkingDir"]), ("HostConfig", ["PortBindings", "ReadonlyRootfs", "Privileged", "CapAdd", "CapDrop", "SecurityOpt", "NetworkMode"])]:
        for key in keys:
            if before[group].get(key) != after[group].get(key):
                differences.append(group + "." + key)
    return differences

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--image")
    parser.add_argument("--image-id")
    parser.add_argument("--expected-current-id")
    parser.add_argument("--scan")
    parser.add_argument("--trusted-baseline", help="Previously verified B host pin, beneath artifacts/workstation")
    parser.add_argument("--presentation-ui", action="store_true", help="Attest the complete presentation static assets in addition to the B portal source")
    parser.add_argument("--rehearse-rollback", action="store_true", help="After candidate readiness, restore the baseline and then repromote the candidate")
    parser.add_argument("--active-presentation", action="store_true", help="Use the observed five-file B presentation context and add an image-only overlay")
    args = parser.parse_args()
    if args.active_presentation and not args.presentation_ui:
        raise SystemExit("ACTIVE_PRESENTATION_REQUIRES_FULL_UI_ATTESTATION")
    if args.rehearse_rollback and not args.apply:
        raise SystemExit("ROLLBACK_REHEARSAL_REQUIRES_APPLY")
    if args.presentation_ui:
        # Match the UI overlay's source inventory instead of checking only four
        # mobile files. A missing shared stylesheet must block promotion.
        manifest = json.loads(local(["node", "scripts/presentation-ui-manifest.js"], 15))
        FILES[:] = presentation_files(manifest)
    if args.apply and (not args.scan or not re.fullmatch(r"highpass-platform-mvp:capstone-mobile-[a-z0-9-]{1,50}", args.image or "") or
                       not all(re.fullmatch(r"sha256:[a-f0-9]{64}", value or "") for value in [args.image_id, args.expected_current_id])):
        raise SystemExit("INVALID_IMAGE_ARGUMENTS")
    credential = sys.stdin.readline().rstrip("\r\n")
    if not credential or len(credential) > 128:
        raise SystemExit("CONCEALED_STDIN_CREDENTIAL_REQUIRED")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    directory = ROOT / "artifacts/workstation" / ("mobile-b-rollout-" + stamp)
    directory.mkdir(parents=True, exist_ok=False)
    client = paramiko.SSHClient()
    trust = None
    checks = []
    rollback = "NOT REQUIRED"
    promotion_attempted = False
    current = None
    try:
        address, mac, _ = ops.ROLES["B"]
        if args.trusted_baseline:
            baseline = (ROOT / args.trusted_baseline).resolve()
            if not baseline.is_relative_to(ROOT / "artifacts/workstation"):
                raise RuntimeError("TRUST_BASELINE_PATH_INVALID")
            receipt = json.loads((baseline / "result.json").read_text(encoding="utf8"))
            if receipt.get("status") != "PASS" or receipt.get("scope") != "A_B_APP_ONLY_PROMOTION" or not any(check.get("test") == "B_PINNED_RUNTIME_BASELINE" and check.get("status") == "PASS" for check in receipt.get("checks", [])):
                raise RuntimeError("TRUST_BASELINE_NOT_VERIFIED")
            parts = (baseline / "B-public-host.key").read_text(encoding="utf8").strip().split()
            if len(parts) < 2 or parts[0] != "ssh-ed25519":
                raise RuntimeError("TRUST_PIN_INVALID")
            public = paramiko.Ed25519Key(data=base64.b64decode(parts[1], validate=True))
        else:
            trust = ops.LocalVmTrust()
            public = trust.key("B", credential, directory / "B-public-host.key")
        client.get_host_keys().add(address, public.get_name(), public)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username="server", password=credential, look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        def run(command, seconds=25):
            code, output = ops.run(client, "sudo -S -p '' timeout " + str(seconds) + "s bash -c " + shlex.quote("set -eu; " + command), credential=credential, seconds=seconds+5)
            if code:
                raise RuntimeError("REMOTE_COMMAND_FAILED_" + str(code))
            return output.strip()
        run("test $(cat /sys/class/net/ens33/address) = " + mac + "; systemctl is-active --quiet docker; systemctl is-active --quiet wg-quick@hp-capstone")
        current = json.loads(run("docker inspect " + NAME))[0]
        if not current["State"].get("Running") or current["State"].get("Health", {}).get("Status") != "healthy":
            raise RuntimeError("CURRENT_B_NOT_HEALTHY")
        env = dict(value.split("=", 1) for value in current["Config"]["Env"])
        for marker in ["CAPSTONE_IMAGE_ENCRYPTION_REQUIRED", "CAPSTONE_RUNTIME_DIAGNOSTICS"]:
            if env.get(marker) != "1":
                raise RuntimeError("REQUIRED_SECURITY_MODE_MISSING")
        checks.append({"test": "B_BASELINE_HEALTH_ENCRYPTION_DIAGNOSTICS", "status": "PASS"})
        if args.apply:
            if current["Image"] != args.expected_current_id:
                raise RuntimeError("B_BASELINE_IMAGE_CHANGED")
            scan_path = (ROOT / args.scan).resolve()
            if not scan_path.is_relative_to(ROOT / "artifacts/security/container-scan"):
                raise RuntimeError("SCAN_PATH_INVALID")
            scan = json.loads(scan_path.read_text(encoding="utf8"))
            if scan.get("Metadata", {}).get("ImageID") != args.image_id or not scan.get("Results") or any(v.get("Severity") in ["HIGH", "CRITICAL"] for r in scan.get("Results", []) for v in r.get("Vulnerabilities", [])):
                raise RuntimeError("EXACT_ZERO_HIGH_CRITICAL_SCAN_REQUIRED")
            if local(["docker", "image", "inspect", args.image, "--format", "{{.Id}}"], 15) != args.image_id:
                raise RuntimeError("CANDIDATE_CHANGED")
            checks.append({"test": "EXACT_SCANNED_CANDIDATE", "status": "PASS"})
            source_hashes = attest_candidate(args.image_id)
            checks.append({"test": "CURRENT_PRESENTATION_SOURCE_BYTES" if args.presentation_ui else "CURRENT_MOBILE_SOURCE_BYTES", "status": "PASS", "sha256": source_hashes})
            labels = current["Config"]["Labels"]
            workdir, configs = validated_context(labels, args.active_presentation, current["Image"])
            candidate_configs = configs
            if args.active_presentation:
                overlay = workdir + "/landing-" + args.image_id[7:23] + ".yml"
                content = json.dumps({"services": {"portal": {"image": args.image_id}}})
                # The original Compose directory is root-owned. Create only the
                # named image overlay through the already-authorized sudo path.
                program = "import os,pathlib; p=pathlib.Path(" + repr(overlay) + "); content=" + repr(content) + "; "
                program += "assert not p.is_symlink(); "
                program += "empty=p.exists() and p.is_file() and p.stat().st_size==0 and p.stat().st_uid==1000 and p.stat().st_nlink==1; "
                program += "assert not p.exists() or empty or (p.is_file() and p.read_text()==content); "
                program += "fd=os.open(p,os.O_WRONLY|os.O_NOFOLLOW,0o600) if empty else (os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600) if not p.exists() else None); "
                program += "os.write(fd,content.encode()) if fd is not None else None; os.fsync(fd) if fd is not None else None; os.close(fd) if fd is not None else None; os.chmod(p,0o600); assert p.read_text()==content"
                run("python3 -c " + shlex.quote(program))
                candidate_configs = configs + [overlay]
            prefix = "env HIPASS_B_PORTAL_SECRET_DIR=/opt/highpass/capstone-b-portal-secrets HIPASS_KEY_RELEASE_VAULT_KEY_ID=" + shlex.quote(env["CAPSTONE_VAULT_KEY_ID"])
            def compose(image):
                selected = candidate_configs if image != current["Image"] else configs
                return prefix + " HIPASS_APP_IMAGE=" + shlex.quote(image) + " docker compose --project-directory " + shlex.quote(workdir) + " -p hp-capstone-b-portal" + "".join(" -f " + shlex.quote(p) for p in selected)
            baseline_config = json.loads(run(compose(current["Image"]) + " config --format json"))
            candidate_config = json.loads(run(compose(args.image) + " config --format json"))
            if baseline_config["services"]["portal"]["image"] != current["Image"]:
                raise RuntimeError("ROLLBACK_IMAGE_NOT_RESOLVED")
            candidate_config["services"]["portal"]["image"] = current["Image"]
            if candidate_config != baseline_config:
                raise RuntimeError("NON_IMAGE_COMPOSE_CHANGE")
            if run("docker image inspect " + current["Image"] + " --format '{{.Id}}'") != current["Image"]:
                raise RuntimeError("ROLLBACK_IMAGE_MISSING")
            checks.append({"test": "ORIGINAL_COMPOSE_ROLLBACK_IMAGE_PRESERVED", "status": "PASS"})
            archive = directory / "candidate.tar"
            local(["docker", "save", "-o", str(archive), args.image], 180)
            with archive.open("rb") as stream:
                digest = hashlib.file_digest(stream, "sha256").hexdigest()
            stage = "/home/server/.highpass-mobile-" + stamp
            with client.open_sftp() as sftp:
                sftp.get_channel().settimeout(15)
                sftp.mkdir(stage, mode=0o700)
                start = time.monotonic()
                def deadline(done, total):
                    if time.monotonic()-start > 300:
                        raise RuntimeError("TRANSFER_DEADLINE")
                sftp.put(str(archive), stage + "/candidate.tar", callback=deadline)
            if run("sha256sum " + stage + "/candidate.tar").split()[0] != digest:
                raise RuntimeError("TRANSFER_HASH_MISMATCH")
            run("docker load -i " + stage + "/candidate.tar", 180)
            if run("docker image inspect " + args.image + " --format '{{.Id}}'") != args.image_id:
                raise RuntimeError("LOADED_IMAGE_CHANGED")
            # No image drift may occur between initial inventory and promotion.
            if run("docker inspect " + NAME + " --format '{{.Image}}'") != current["Image"]:
                raise RuntimeError("B_CHANGED_BEFORE_PROMOTION")
            if attest_candidate(args.image_id) != source_hashes:
                raise RuntimeError("SOURCE_CHANGED_BEFORE_PROMOTION")
            promotion_attempted = True
            run(compose(args.image) + " up -d --no-deps --force-recreate --pull never portal", 90)
            end = time.monotonic() + 90
            while True:
                observed = json.loads(run("docker inspect " + NAME))[0]
                if observed["Image"] == args.image_id and observed["State"].get("Health", {}).get("Status") == "healthy":
                    break
                if time.monotonic() >= end:
                    raise RuntimeError("READINESS_DEADLINE")
                time.sleep(2)
            differences = runtime_differences(current, observed)
            if differences:
                checks.append({"test": "RUNTIME_CONFIGURATION_PRESERVED", "status": "FAIL", "changedFields": differences})
                raise RuntimeError("RUNTIME_CONFIGURATION_CHANGED")
            checks.append({"test": "RUNTIME_CONFIGURATION_PRESERVED", "status": "PASS"})
            if args.rehearse_rollback:
                for image, expected, label in [(current["Image"], current["Image"], "ROLLBACK_REHEARSAL"), (args.image, args.image_id, "CANDIDATE_REPROMOTION")]:
                    run(compose(image) + " up -d --no-deps --force-recreate --pull never portal", 90)
                    end = time.monotonic() + 90
                    while True:
                        restored = json.loads(run("docker inspect " + NAME))[0]
                        if restored["Image"] == expected and restored["State"].get("Health", {}).get("Status") == "healthy":
                            break
                        if time.monotonic() >= end:
                            raise RuntimeError(label + "_READINESS_DEADLINE")
                        time.sleep(2)
                    if runtime_differences(current, restored):
                        raise RuntimeError(label + "_RUNTIME_CHANGED")
                    if run("curl --cacert /opt/highpass/capstone-b-portal-secrets/ca.crt --max-time 10 -s -o /dev/null -w '%{http_code}' https://192.168.111.149:9443/api/health", 12) != "200":
                        raise RuntimeError(label + "_HEALTH_ROUTE_FAILED")
                    checks.append({"test": label, "status": "PASS"})
                rollback = "EXECUTED_AND_VERIFIED"
            routes = ["/api/health", "/hipass/", "/mobile/", "/mobile/manifest.json", "/mobile/app.js", "/mobile/sw.js"]
            if args.presentation_ui:
                routes += ["/ui/workspace.css", "/ui/tokens.css", "/ui/clinician.js", "/ui/patient.js", "/brand/mediq-source.png", "/capstone-auth.js", "/ui/demo-entry.js", "/ui/demo-entry.css", "/images/mediq-hong-gildong-landing.png", "/images/mediq-synthetic-abdominal-ct.png", "/api/capstone-demo/scenario"]
            if args.presentation_ui:
                routes += ["/images/mediq-login-wallet.webp"]
                routes += ["/ui/patient-visit-pass.css"]
                routes += ["/ui/patient-share-review.css", "/ui/patient-share-review.js"]
                routes += ["/ui/patient-library.css", "/ui/patient-library.js"]
                routes += ["/ui/patient-sharing.css", "/ui/patient-sharing.js"]
                routes += ["/ui/patient-history.css", "/ui/patient-history.js"]
                routes += ["/ui/patient-health.css", "/ui/patient-health.js"]
                routes += ["/images/mediq-synthetic-liver-ultrasound-v1.png"]
                routes += ["/ui/patient-helper.css", "/ui/patient-helper.js"]
            for route in routes:
                status = run("curl --cacert /opt/highpass/capstone-b-portal-secrets/ca.crt --max-time 10 -s -o /dev/null -w '%{http_code}' https://192.168.111.149:9443" + route, 12)
                if status != "200":
                    raise RuntimeError("STRICT_TLS_ROUTE_FAILED")
                checks.append({"test": "B_STRICT_TLS_ROUTE", "path": route, "status": "PASS"})
        scope = "B_PRESENTATION_UI_PROMOTION" if args.apply and args.presentation_ui else "B_MOBILE_PROMOTION" if args.apply else "B_READ_ONLY_INVENTORY"
        result = {"status": "PASS", "scope": scope, "review": "DRAFT / UNASSIGNED", "baselineImageId": current["Image"], "baselineImage": current["Config"]["Image"], "imageId": args.image_id, "checks": checks, "rollbackExecution": rollback, "cloudModified": False, "hospitalAModified": False, "browserE2E": "NOT VERIFIED"}
    except Exception as error:
        if promotion_attempted:
            try:
                run(compose(current["Image"]) + " up -d --no-deps --force-recreate --pull never portal", 90)
                end = time.monotonic() + 90
                while True:
                    old = json.loads(run("docker inspect " + NAME))[0]
                    if old["Image"] == current["Image"] and old["State"].get("Health", {}).get("Status") == "healthy":
                        break
                    if time.monotonic() >= end:
                        raise RuntimeError("ROLLBACK_READINESS_DEADLINE")
                    time.sleep(2)
                rollback = "PASS"
            except Exception:
                rollback = "OUTCOME UNKNOWN — RECONCILE BEFORE RETRY"
        result = {"status": "NOT VERIFIED", "scope": "B_MOBILE_PROMOTION", "review": "DRAFT / UNASSIGNED", "reason": str(error) if isinstance(error, RuntimeError) else type(error).__name__, "checks": checks, "rollbackExecution": rollback}
    finally:
        client.close()
        if trust:
            trust.close()
        credential = None
    (directory / "result.json").write_text(json.dumps(result, indent=2), encoding="utf8")
    print(json.dumps({**result, "evidence": str(directory / "result.json")}), flush=True)
    return 0 if result["status"] == "PASS" else 1

if __name__ == "__main__":
    raise SystemExit(main())
