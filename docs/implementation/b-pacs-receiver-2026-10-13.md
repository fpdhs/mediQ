# B synthetic receiving PACS — implementation candidate

Status: **DRAFT / UNASSIGNED; NOT DEPLOYED; live 700-instance flow NOT VERIFIED**.
Observed 2026-10-13 09:59–10:12 Asia/Seoul. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31, dirty. Existing unrelated changes preserved. No commit/push. Current-state authority remains [presentation integration status](mediq-presentation-integration-status-2026-10-09.md).

## Outcome and first remaining blocker

Implemented a B-local Orthanc receiver **candidate**, not a working B VM PACS deployment.
Pinned SSH checks show B has only its portal; /opt is on /dev/sda2 ext4, with no dm-crypt/LUKS mapping, no cryptsetup executable, and no dedicated PACS mount. Free space 74,991,415,296 bytes. VM-disk/hypervisor encryption was not established by this inspection. Ordinary Docker volumes are not accepted as encrypted storage.

Before persistent import, decide and approve B-only encrypted storage provisioning and key recovery/protection. Proposed scope: a NEW 8 GiB backing file and dedicated highpass-b-pacs LUKS mapping, never format /dev/sda or existing partitions. Decide how the storage key is wrapped, retained and recovered; a plaintext key saved beside the encrypted file on the same unencrypted VM is not adequate evidence of offline VM-disk protection. Existing A/B Key Vault image-transfer credentials do not automatically authorize a new disk-key lifecycle. No package installation, filesystem formatting, mount, certificate issuance or VM deployment was executed in this turn.

## Candidate contract

Before: public /api/transfers/pacs-import goes to metadata-only Control and is blocked; the old engine is a local encrypted archive simulator.

After (candidate only): POST /dicomweb/studies/{study}/series/{series}/instances/{sop}/import, empty body, exact B Origin, DPoP access token and a fresh method/path/token-bound proof. Only a selected instance is fetched from A. GET /import and POST /download are rejected. Control default-off HIPASS_B_PACS_IMPORT_ENABLED; B default-off CAPSTONE_B_PACS_IMPORT_ENABLED.

1. Control revalidates current DOWNLOAD_ALLOWED consent, institution, clinician, purpose, Study/Series, token and DPoP. Import is a bounded Capstone DOWNLOAD workflow explicitly requested by POST; it is **not evidence of independent full v3 import Grants**. Those acceptance conditions remain pending.
2. A reads only the selected WADO-RS instance, wraps a DEK through the existing Key Vault adapter, encrypts the object and obtains the existing durable release binding. Receipt additionally binds HTTP method, preserving older GET receipts.
3. B unwraps through existing BEFORE/AFTER_UNWRAP authority, verifies object scope/hash, and retains raw bytes only transiently in memory.
4. B extracts exactly one DICOM from WADO multipart. The fixed 700-entry inventory hash pins SOP, byte count and raw SHA-256; raw SHA-256 binds the original header UIDs and pixels. The manifest contract is canonical/inventory-based, NOT the hash of the formatted manifest file.
5. B checks PACS readiness and encrypted backing mount; Control revalidates consumed release/current consent and audits BEFORE_IMPORT before any destination mutation.
6. B authenticates with a dedicated mTLS SAN to its local PACS boundary. The boundary permits only system check, SOP lookup, instance registration, instance metadata/file reads. No delete, modify, arbitrary query, DICOM TCP listener, public PACS ports or Control image storage.
7. Orthanc OverwriteInstances=false. Existing matching files are reverified, conflicting bytes/UIDs are preserved and fail. New instance is registered with Orthanc POST /instances, not mislabeled as STOW-RS/C-STORE.
8. Re-query destination SOP and raw file, verify expected SHA-256, then submit PACS_VERIFIED evidence through B's authenticated internal credential. Control audits **AUTHENTICATED_B_REPORT**, not a claim that Control independently inspected pixels.

The mTLS service checks /proc/self/mountinfo and actual /sys/dev/block/{major:minor}/dm/uuid for the dedicated LUKS2 mapping on EVERY request, and requires its UUID to equal the UUID pinned from the root-only storage manifest by the launch gate. An old JSON PASS receipt/config boolean cannot substitute for this check. The launch gate also validates the rendered Compose network, published-port, exact storage-bind, readiness-dependency and image-digest constraints before an optional manual start. Deployment must verify Orthanc and the boundary bind the same encrypted filesystem. The updated candidate gate is locally tested but has NOT been deployed. Certificates, SAN/EKU/chain, actual Docker visibility of dm sysfs, volume recovery, reboot and B VM runtime remain NOT VERIFIED.

If registration succeeds but re-query, consent recheck or final audit fails, response is not success. Preserve the possibly inserted instance and reconcile explicitly; do not delete user data or invent rollback. Durable quarantine/recovery and post-write revoke races still require integration validation. This candidate is single-instance; it does not yet implement durable 700-item job state, retention cleanup, destination Viewer, or the public hospital-storage UI.

## 2026-10-14 Local receiver image candidate

Added `Dockerfile.b-pacs-receiver` and its Dockerfile-specific ignore file. The image uses the already pinned Distroless Node 24 Debian 13 nonroot base, copies only the mTLS listener and storage-boundary module, and runs as UID/GID 65532. Local build digest: `sha256:9240121590bf034c916e4d1d9196aa87d240631518e312398b230a82263f69e4`; image size 214,340,520 bytes. A network-none/read-only/capability-dropped Node syntax check passed. The pinned Trivy 0.58.2 scan and repository vulnerability policy passed with 0 Critical / 0 High.

This is a workstation candidate only. It has not been pushed to a registry, transferred to B, started with B certificates, or exercised against the live encrypted mount. B mTLS certificate issuance/permissions and exact B VM deployment remain NOT VERIFIED.

## 2026-10-14 Orthanc receiver candidate

The previous local Orthanc image reported an unapproved High `CVE-2026-103111` in `libpcre2-8-0`. A separate candidate was rebuilt from the same pinned base with current Debian security packages; the existing `newproject-orthanc-secured:latest` tag and running containers were not changed. Candidate tag: `newproject-orthanc-secured:b-pacs-candidate-20261014`; digest `sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368`.

Pinned Trivy 0.58.2 scan: `artifacts/security/b-pacs-orthanc-candidate-20261014.json`; policy gate PASS. Scanner reports one Critical (`zlib1g`) reconciled by the existing package-not-in-runtime technical review, zero High, zero confirmed runtime Critical. The PCRE2 fixed package `10.42-1+deb12u2` was fetched during the image build.

Added `infra/workstation/orthanc/hospital-b-receiver.json` and hardened the receiver Compose candidate. Orthanc writes only to the encrypted filesystem's `orthanc-db` directory owned by UID/GID `10001:10001`, mode `0700`; root filesystem is read-only, all capabilities are dropped, and no-new-privileges is enabled. Storage create/recovery prepares the directory only after verifying the LUKS mount. Existing wrong-owner, symlink, mode, or filesystem state is rejected without recursive repair. The launch gate validates this directory and the exact B config before Compose startup.

The B Orthanc config disables DICOM TCP and filesystem export, prevents instance overwrite, and labels the PACS synthetic-only. Storage is capped at 6144 MiB with `MaximumStorageMode: Reject`, leaving capacity for index/filesystem overhead and preventing automatic recycling. Orthanc REST authentication is disabled only because the service is connected solely to the internal, unpublished `b_pacs_private` network with the authenticated B mTLS boundary as its only peer. The Orthanc log still warns that remote access without HTTP authentication is “POSSIBLY INSECURE”; Docker network membership and the absence of published ports are therefore enforced by the launch gate and are residual host-admin/trust-boundary risks.

| Check | Result | Evidence |
|---|---|---|
| Candidate startup as UID 10001, read-only rootfs, dropped capabilities | PASS | Isolated `--network none`, tmpfs storage, no host port |
| DICOMweb plugin load and DICOM SCP disabled | PASS | Orthanc 1.12.11 / DICOMweb 1.23 startup log |
| B `/system` health endpoint | PASS | HTTP 200 with the B-only receiver config; generic default config correctly returned 401 |
| Synthetic DICOM store/re-query and duplicate handling | PASS 1 instance | `artifacts/workstation/hp-b-pacs-local-smoke-49f48d71/result.json`; UID and raw SHA-256 match, duplicate preserved; test-double consent/audit and disposable tmpfs |
| B VM image transfer, config/certificate install, LUKS subdirectory ownership, mTLS | NOT VERIFIED | No remote credential entry or deployment occurred |

## Requirements and affected files

Legacy groups FR-001–005, FR-010–031, FR-037–041; v3 V3-SR-GRT-001/003, V3-SR-NET-001–003, V3-SR-AUD-001–003. These are impact mappings, not full requirement PASS. AUD-002 post-write recovery and independent v3 import Grant acceptance remain incomplete.

New: `Dockerfile.b-pacs-receiver`, `Dockerfile.b-pacs-receiver.dockerignore`, `src/b-pacs-receiver.js`, `src/b-pacs-storage-boundary.js`, `scripts/start-b-pacs-mtls.js`, `infra/workstation/orthanc/hospital-b-receiver.json`, `infra/workstation/hospital-b-pacs-{receiver,portal}.compose.yml`; focused B pipeline/storage tests; local smoke, VM storage preflight and candidate verifier scripts.

Updated: data-plane authorization/gateway, capstone encrypted transfer, consent-bound key release, B Portal, storage guest/runtime checker, receiver launch gate/Compose and local Orthanc smoke. No DB schema/migration change. Existing release ledger is reused. New import authorization accepts bounded metadata only; no raw image, secret, key or token enters a new database field.

## Executed verification

| Check | Result | Scope/evidence |
|---|---|---|
| A/B/Cloud image/readiness inventory | PASS | artifacts/workstation/b-pacs-implementation-20261013-inventory/result.json; pinned SSH, no mutation |
| B encrypted-storage readiness | NOT VERIFIED / prerequisite absent | artifacts/workstation/b-pacs-storage-20261013T005931Z/result.json; ext4, no cryptsetup/mapping |
| Focused policy/crypto/receiver/portal/storage and patient regression | PASS 97/97 | artifacts/workstation/b-pacs-candidate-2026-10-13T01-10-20-165Z/{result.json,tests.txt}; exit 0, 18,843 ms |
| Local source raw file hashes | PASS 700/700 | same result; 2,202,766,342 bytes, 68,473 ms. NOT a current A PACS hash rerun |
| Actual local Orthanc registration/re-query | PASS 1 instance | artifacts/workstation/hp-b-pacs-local-smoke-e345cdef/result.json; raw hash and SOP match, duplicate no overwrite; exit 0, 32,301 ms |
| Real B mTLS, storage, consent, Key Vault, audit | NOT VERIFIED | local Orthanc smoke uses authorization/audit doubles, tmpfs and loopback HTTP |
| Actual B 700 transfer + complete UID/hash inventory | NOT VERIFIED | no B receiver deployed, no new consent created |
| Actual browser flow and public button wiring | NOT VERIFIED | not performed in this work unit |
| New receiver image build/scan | PASS, workstation candidate | `Dockerfile.b-pacs-receiver`; Trivy Critical 0 / High 0, digest `sha256:9240121590bf034c916e4d1d9196aa87d240631518e312398b230a82263f69e4` |
| Receiver image transfer, B VM deployment/rollback | NOT VERIFIED | no registry push, image transfer, certificate issuance or VM service change |

Initial candidate test failed because the canonical manifest hash was mistaken for a raw manifest-file hash. Corrected to the established pinned inventory contract and reran. New authority test fixture initially failed due to fixture variable shadowing and incomplete fixed-study metadata; both corrected. These initial failures are not hidden by the final focused PASS. Full repository regression was not run.

Source image observations: A Gateway sha256:50b1db9e1cdfdf71ac706cff09c3b11b0a0df1fd1b0ef1c66a1305c39aab43b8; B Portal sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3; Control sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436. Historical Orthanc image sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a; current workstation candidate Orthanc image sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368. Neither is deployed to B.

## Reproduce / recover

Run from repository root:

```powershell
python scripts/b-pacs-storage-preflight.py
node scripts/b-pacs-verify-candidate.js
node scripts/b-pacs-local-smoke.js
```

Passwords are entered concealed through stdin, not saved/committed. All remote/HTTP operations are bounded. Smoke creates exactly one labeled local container with a tmpfs database, then removes only that owned container and its ephemeral single-image database; original source DICOM remains untouched. VM A/B PACS, Control DB and existing containers were not deleted or rolled back.

Do NOT apply candidate Compose yet. After encrypted-storage/key-recovery decision, verify current image/source baselines and generate reviewed **server-only** overlays from those baselines; do not copy unrelated dirty server/UI files wholesale or deploy the pending clinician static bundle. Provision private B receiver and dedicated mTLS, scan images, verify missing/wrong cert and non-LUKS denial, then align A/B/Control. Retain previous Compose/image settings for rollback; rollback must retain the B data filesystem and keys, never down -v.

Only then run browser-created download consent and a finite, resumable 700-instance transfer with fresh proof per POST. Renew tokens only through current consent; no token/receipt TTL extension or policy-denial retry. At completion compare the WHOLE destination SOP set/count and each raw hash, re-query destination PACS and audit correlation. One successful instance cannot promote the job to completion. The pending job must handle interruption, duplicate/conflict, revoked/expired consent, final audit failure, retention and recovery before claiming the requested flow complete.

Protocol references: [Orthanc REST API](https://orthanc.uclouvain.be/book/users/rest.html), [Orthanc duplicate/overwrite behavior](https://orthanc.uclouvain.be/book/users/anonymization.html), [Orthanc storage architecture](https://orthanc.uclouvain.be/book/faq/orthanc-storage.html). The implemented test re-query, rather than documentation alone, establishes the one-instance raw-byte result.
