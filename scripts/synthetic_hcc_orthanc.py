#!/usr/bin/env python3
"""Bounded DICOMweb probe/seed/verify utility for synthetic HCC test Orthanc only.

Credentials are read from one JSON object on stdin, never command arguments or output.
TLS verification is mandatory. `seed` is restricted to the Hospital A test endpoint.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.client
import json
import re
import ssl
import sys
import time
from email import policy
from email.parser import BytesParser
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlsplit


MAX_STUDY_BYTES = 2 * 1024 * 1024 * 1024
MAX_DICOM_INSTANCE_BYTES = 64 * 1024 * 1024
TRANSFER_SYNTAX = "1.2.840.10008.1.2.1"
UID_RE = re.compile(r"^(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*))*$")


def canonical_manifest_sha256(manifest: dict[str, Any]) -> str:
    payload = dict(manifest)
    payload.pop("canonicalManifestSha256", None)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_endpoint(candidate: str, mode: str) -> tuple[str, int]:
    parsed = urlsplit(candidate)
    if (parsed.scheme != "https" or parsed.username or parsed.password or parsed.path not in ("", "/") or
            parsed.query or parsed.fragment or parsed.port != 8042 or parsed.hostname not in ("orthanc-a", "orthanc-b")):
        raise ValueError("ORTHANC_ENDPOINT_DENIED")
    if mode == "seed" and parsed.hostname != "orthanc-a":
        raise ValueError("SOURCE_SEED_HOSPITAL_A_ONLY")
    return parsed.hostname, parsed.port


def load_manifest(dataset: Path, verify_files: bool = True) -> tuple[dict[str, Any], list[tuple[dict[str, Any], Path]]]:
    root = dataset.resolve()
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if (manifest.get("datasetType") != "SYNTHETIC" or manifest.get("clinicalUse") is not False or
            manifest.get("validationStatus") != "PASS" or
            manifest.get("canonicalManifestSha256") != canonical_manifest_sha256(manifest) or
            manifest.get("transferSyntaxUID") != TRANSFER_SYNTAX or manifest.get("modality") != "CT"):
        raise ValueError("SYNTHETIC_MANIFEST_INVALID")
    study_uid = manifest.get("studyInstanceUID")
    if not isinstance(study_uid, str) or not UID_RE.fullmatch(study_uid) or len(study_uid) > 64:
        raise ValueError("SYNTHETIC_MANIFEST_INVALID")
    inventory: list[tuple[dict[str, Any], Path]] = []
    seen: set[str] = set()
    total_bytes = 0
    for series in manifest.get("series", []):
        series_uid = series.get("seriesInstanceUID")
        if not isinstance(series_uid, str) or not UID_RE.fullmatch(series_uid):
            raise ValueError("SYNTHETIC_MANIFEST_INVALID")
        for record in series.get("instances", []):
            relative = Path(record.get("file", ""))
            if relative.is_absolute() or ".." in relative.parts or relative.suffix.lower() != ".dcm":
                raise ValueError("SYNTHETIC_MANIFEST_PATH_INVALID")
            file_path = (root / relative).resolve()
            if root not in file_path.parents or not file_path.is_file():
                raise ValueError("SYNTHETIC_MANIFEST_PATH_INVALID")
            sop = record.get("sopInstanceUID")
            size = file_path.stat().st_size
            if (not isinstance(sop, str) or not UID_RE.fullmatch(sop) or sop in seen or
                    not isinstance(record.get("sha256"), str) or not re.fullmatch(r"[0-9a-f]{64}", record["sha256"]) or
                    record.get("bytes") != size or size > MAX_DICOM_INSTANCE_BYTES or
                    (verify_files and sha256_file(file_path) != record["sha256"])):
                raise ValueError("SYNTHETIC_INSTANCE_MANIFEST_INVALID")
            seen.add(sop)
            total_bytes += size
            inventory.append((record | {"seriesInstanceUID": series_uid}, file_path))
            if total_bytes > MAX_STUDY_BYTES:
                raise ValueError("SYNTHETIC_STUDY_SIZE_LIMIT")
    if len(inventory) != manifest.get("totalInstances") or total_bytes != manifest.get("totalDicomBytes"):
        raise ValueError("SYNTHETIC_MANIFEST_COUNT_MISMATCH")
    return manifest, inventory


def read_credentials() -> tuple[str, str]:
    try:
        value = json.loads(sys.stdin.readline())
    except Exception as error:
        raise ValueError("ORTHANC_CREDENTIAL_INPUT_INVALID") from error
    if not isinstance(value, dict) or set(value) != {"username", "password"}:
        raise ValueError("ORTHANC_CREDENTIAL_INPUT_INVALID")
    username, password = value["username"], value["password"]
    if not isinstance(username, str) or not username or not isinstance(password, str) or not password:
        raise ValueError("ORTHANC_CREDENTIAL_INPUT_INVALID")
    return username, password


class OrthancDicomWeb:
    def __init__(self, host: str, port: int, ca_cert: Path, username: str, password: str):
        self.host = host
        self.port = port
        self.context = ssl.create_default_context(cafile=str(ca_cert))
        token = base64.b64encode(f"{username}:{password}".encode("utf-8")).decode("ascii")
        self.authorization = "Basic " + token
        self.connection = http.client.HTTPSConnection(host, port, context=self.context, timeout=30)

    def close(self) -> None:
        self.connection.close()

    def request(self, method: str, path: str, *, headers: dict[str, str] | None = None,
                body: bytes | None = None, timeout: float = 30) -> tuple[int, str, bytes]:
        self.connection.timeout = timeout
        request_headers = {"Authorization": self.authorization, "Accept": "application/dicom+json", "Connection": "keep-alive"}
        if headers:
            request_headers.update(headers)
        self.connection.request(method, path, body=body, headers=request_headers)
        response = self.connection.getresponse()
        response_body = response.read()
        return response.status, response.getheader("Content-Type", ""), response_body

    def qido(self, path: str) -> list[dict[str, Any]]:
        status, content_type, body = self.request("GET", path)
        if status != 200 or "application/dicom+json" not in content_type.lower():
            raise RuntimeError("ORTHANC_QIDO_UNAVAILABLE")
        value = json.loads(body)
        if not isinstance(value, list):
            raise RuntimeError("ORTHANC_QIDO_RESPONSE_INVALID")
        return value

    def qido_study(self, study_uid: str) -> list[dict[str, Any]]:
        return self.qido("/dicom-web/studies?StudyInstanceUID=" + quote(study_uid, safe="."))


def dicom_json_value(dataset: dict[str, Any], tag: str) -> str | None:
    item = dataset.get(tag)
    if not isinstance(item, dict):
        return None
    values = item.get("Value")
    if not isinstance(values, list) or not values:
        return None
    return str(values[0])


def target_inventory(client: OrthancDicomWeb, study_uid: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    studies = client.qido_study(study_uid)
    studies = [item for item in studies if dicom_json_value(item, "0020000D") == study_uid]
    if not studies:
        return [], []
    if len(studies) != 1:
        raise RuntimeError("TARGET_STUDY_QUERY_NOT_UNIQUE")
    qido_base = "/dicom-web/studies/" + quote(study_uid, safe=".")
    series = client.qido(qido_base + "/series")
    instances = client.qido(qido_base + "/instances")
    series = [item for item in series if dicom_json_value(item, "0020000D") == study_uid]
    instances = [item for item in instances if dicom_json_value(item, "0020000D") == study_uid]
    return series, instances


def multipart_part(content_type: str, body: bytes) -> bytes:
    header = BytesParser(policy=policy.default).parsebytes(
        f"Content-Type: {content_type}\r\nMIME-Version: 1.0\r\n\r\n".encode("ascii") + body
    )
    if not header.is_multipart():
        if content_type.split(";", 1)[0].strip().lower() == "application/dicom":
            return body
        raise RuntimeError("ORTHANC_WADO_MEDIA_TYPE_INVALID")
    parts = header.get_payload()
    if not isinstance(parts, list) or len(parts) != 1:
        raise RuntimeError("ORTHANC_WADO_INSTANCE_COUNT_INVALID")
    value = parts[0].get_payload(decode=True)
    if not isinstance(value, bytes):
        raise RuntimeError("ORTHANC_WADO_BODY_INVALID")
    return value


def verify_inventory(client: OrthancDicomWeb, manifest: dict[str, Any], expected: list[tuple[dict[str, Any], Path]],
                     fetch_bytes: bool) -> dict[str, Any]:
    study_uid = manifest["studyInstanceUID"]
    series_rows, instance_rows = target_inventory(client, study_uid)
    expected_series = {row["seriesInstanceUID"] for row in manifest["series"]}
    actual_series = {dicom_json_value(row, "0020000E") for row in series_rows}
    expected_sop = {record["sopInstanceUID"] for record, _ in expected}
    actual_sop = {dicom_json_value(row, "00080018") for row in instance_rows}
    if actual_series != expected_series or len(series_rows) != len(expected_series):
        raise RuntimeError("DESTINATION_SERIES_COUNT_OR_UID_MISMATCH")
    if actual_sop != expected_sop or len(instance_rows) != len(expected_sop):
        raise RuntimeError("DESTINATION_INSTANCE_COUNT_OR_UID_MISMATCH")

    verified_bytes = 0
    verified_instances = 0
    if fetch_bytes:
        for record, _ in expected:
            study = quote(study_uid, safe=".")
            series_uid = quote(record["seriesInstanceUID"], safe=".")
            sop_uid = quote(record["sopInstanceUID"], safe=".")
            path = f"/dicom-web/studies/{study}/series/{series_uid}/instances/{sop_uid}"
            status, content_type, body = client.request(
                "GET", path, headers={"Accept": "multipart/related; type=\"application/dicom\""}, timeout=60
            )
            if status != 200:
                raise RuntimeError("ORTHANC_WADO_INSTANCE_UNAVAILABLE")
            raw = multipart_part(content_type, body)
            digest = hashlib.sha256(raw).hexdigest()
            if len(raw) != record["bytes"] or digest != record["sha256"]:
                raise RuntimeError("DESTINATION_RAW_DICOM_SHA256_MISMATCH")
            verified_bytes += len(raw)
            verified_instances += 1
            if verified_instances % 100 == 0:
                print(json.dumps({"wadoVerifiedInstances": verified_instances}, sort_keys=True), flush=True)
    return {
        "qidoStudyCount": 1,
        "seriesCount": len(series_rows),
        "instanceCount": len(instance_rows),
        "rawWadoVerifiedInstances": verified_instances,
        "rawWadoVerifiedBytes": verified_bytes,
    }


def stream_stow_batch(client: OrthancDicomWeb, study_uid: str,
                      batch: list[tuple[dict[str, Any], Path]], batch_number: int) -> None:
    boundary = f"highpasssynthetichcc{batch_number:06d}{hashlib.sha256(str(time.time_ns()).encode()).hexdigest()[:12]}"
    headers: list[bytes] = []
    content_length = 0
    for _, file_path in batch:
        prefix = (f"--{boundary}\r\nContent-Type: application/dicom; transfer-syntax={TRANSFER_SYNTAX}\r\n"
                  "Content-Transfer-Encoding: binary\r\n\r\n").encode("ascii")
        headers.append(prefix)
        content_length += len(prefix) + file_path.stat().st_size + 2
    closing = f"--{boundary}--\r\n".encode("ascii")
    content_length += len(closing)
    target = "/dicom-web/studies/" + quote(study_uid, safe=".")
    request_headers = {
        "Authorization": client.authorization,
        "Accept": "application/dicom+json, application/dicom+xml",
        "Content-Type": f'multipart/related; type="application/dicom"; boundary="{boundary}"',
        "Content-Length": str(content_length),
        "Connection": "keep-alive",
    }
    client.connection.timeout = 120
    client.connection.putrequest("POST", target)
    for name, value in request_headers.items():
        client.connection.putheader(name, value)
    client.connection.endheaders()
    for (_, file_path), prefix in zip(batch, headers, strict=True):
        client.connection.send(prefix)
        with file_path.open("rb") as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b""):
                client.connection.send(chunk)
        client.connection.send(b"\r\n")
    client.connection.send(closing)
    response = client.connection.getresponse()
    body = response.read()
    if response.status not in (200, 202):
        raise RuntimeError("ORTHANC_STOW_REJECTED")
    content_type = response.getheader("Content-Type", "").lower()
    if "application/dicom+json" in content_type:
        result = json.loads(body)
        failed = result.get("00081198", {}).get("Value", []) if isinstance(result, dict) else []
        if failed:
            raise RuntimeError("ORTHANC_STOW_REPORTED_FAILURES")


def execute(mode: str, endpoint: str, ca_cert: Path, dataset: Path, batch_size: int) -> dict[str, Any]:
    host, port = validate_endpoint(endpoint, mode)
    manifest, inventory = load_manifest(dataset, verify_files=(mode != "preflight"))
    username, password = read_credentials()
    if not ca_cert.is_file():
        raise ValueError("ORTHANC_TEST_CA_MISSING")
    client = OrthancDicomWeb(host, port, ca_cert, username, password)
    try:
        study_uid = manifest["studyInstanceUID"]
        series_before, instances_before = target_inventory(client, study_uid)
        if mode == "preflight":
            return {
                "status": "PASS" if not series_before and not instances_before else "CONFLICT",
                "operation": "PRE-SEED-QIDO",
                "targetStudyPresent": bool(series_before or instances_before),
                "seriesCount": len(series_before),
                "instanceCount": len(instances_before),
                "hospital": "A" if host == "orthanc-a" else "B",
                "datasetReview": "DRAFT / UNASSIGNED",
            }
        if mode == "seed":
            if series_before or instances_before:
                raise RuntimeError("SOURCE_STUDY_ALREADY_PRESENT_NO_OVERWRITE")
            for batch_number, start in enumerate(range(0, len(inventory), batch_size), start=1):
                stream_stow_batch(client, study_uid, inventory[start:start + batch_size], batch_number)
                if batch_number % 10 == 0:
                    print(json.dumps({"stowBatchesCompleted": batch_number}, sort_keys=True), flush=True)
            verified = verify_inventory(client, manifest, inventory, fetch_bytes=True)
            return {
                "status": "PASS",
                "operation": "HOSPITAL_A_SOURCE_SEED_AND_READBACK",
                "hospital": "A",
                "datasetReview": "DRAFT / UNASSIGNED",
                "manifestSha256": manifest["canonicalManifestSha256"],
                **verified,
            }
        verified = verify_inventory(client, manifest, inventory, fetch_bytes=True)
        return {
            "status": "PASS",
            "operation": "DICOMWEB_READBACK_VERIFICATION",
            "hospital": "A" if host == "orthanc-a" else "B",
            "datasetReview": "DRAFT / UNASSIGNED",
            "manifestSha256": manifest["canonicalManifestSha256"],
            **verified,
        }
    finally:
        password = ""
        username = ""
        client.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=("preflight", "seed", "verify"), required=True)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--ca-cert", type=Path, required=True)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--apply", action="store_true", help="required because seed writes to the named Hospital A test PACS")
    args = parser.parse_args()
    if args.batch_size < 1 or args.batch_size > 20:
        parser.error("--batch-size must be between 1 and 20")
    if args.mode == "seed" and not args.apply:
        parser.error("--apply is required for source seed mode")
    try:
        result = execute(args.mode, args.base_url, args.ca_cert, args.dataset, args.batch_size)
        print(json.dumps(result, sort_keys=True))
        return 0 if result.get("status") == "PASS" else 1
    except Exception as error:
        safe_codes = {
            "ORTHANC_ENDPOINT_DENIED", "SOURCE_SEED_HOSPITAL_A_ONLY", "SYNTHETIC_MANIFEST_INVALID",
            "SYNTHETIC_MANIFEST_PATH_INVALID", "SYNTHETIC_INSTANCE_MANIFEST_INVALID",
            "SYNTHETIC_STUDY_SIZE_LIMIT", "SYNTHETIC_MANIFEST_COUNT_MISMATCH",
            "ORTHANC_CREDENTIAL_INPUT_INVALID", "ORTHANC_TEST_CA_MISSING", "SOURCE_STUDY_ALREADY_PRESENT_NO_OVERWRITE",
            "TARGET_STUDY_QUERY_NOT_UNIQUE", "ORTHANC_QIDO_UNAVAILABLE", "ORTHANC_QIDO_RESPONSE_INVALID",
            "DESTINATION_SERIES_COUNT_OR_UID_MISMATCH", "DESTINATION_INSTANCE_COUNT_OR_UID_MISMATCH",
            "ORTHANC_WADO_MEDIA_TYPE_INVALID", "ORTHANC_WADO_INSTANCE_COUNT_INVALID", "ORTHANC_WADO_BODY_INVALID",
            "ORTHANC_WADO_INSTANCE_UNAVAILABLE", "DESTINATION_RAW_DICOM_SHA256_MISMATCH",
            "ORTHANC_STOW_REJECTED", "ORTHANC_STOW_REPORTED_FAILURES",
        }
        code = str(error) if str(error) in safe_codes else "ORTHANC_TLS_NETWORK_OR_RESPONSE_FAILURE"
        print(json.dumps({"status": "NOT VERIFIED", "error": code,
                          "errorType": type(error).__name__, "review": "DRAFT / UNASSIGNED"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
