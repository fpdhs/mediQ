# Release and Rollback Runbook

## Clinician UI: One Source and One Bundle

Follow [의료진 화면 단일 소스 관리](clinician-ui-management.md) for every clinician UI change. `public/index.html#hospital-saas-app` and its dependency closure are the canonical source for local and hosted screens. Use `clinician-bundle-stage.py` and `clinician-ui.py` for staging, source/served parity, building and releasing the same image. The previous clinician-home-only and security-journey-only release entry points are retired. Historical PASS evidence below does not attest the unified bundle or its hosted API behavior.

## Pre-Release

1. Confirm no real patient data or real hospital PACS/network integration.
2. Verify risk exception validity.
3. Run secret scan, unit tests, E2E, security gate, network gate, readiness, container gate, and SBOM.
4. Confirm local SHA, remote SHA, and hosted workflow `headSha` match.
5. Preserve Hosted CI run URL and release SHA.

## Current State and Patient Activation Boundary

The authoritative current status is [presentation integration status](../implementation/mediq-presentation-integration-status-2026-10-09.md). The baseline and rollback result below are historical scoped evidence, not approval or verification of the latest patient candidate.

2026-10-10 10:45 KST current B Portal is `sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e`; Cloud Control remains11a23. B-only activation/actual dcc15 rollback/fa5f reactivation passed5 checks, strict TLS and runtime config difference0: `artifacts/workstation/session-expiry-ui-rollout-20261010T014346Z/result.json`. Active B context contains the previous four files **plus session-expiry-reviewed-20261010.yml**. Recovery excludes only this fifth file and preserves patient/FAQ overlays, secrets, DB/PACS. The reviewed-candidate operator is pinned to the pre-activation target and is not a general redeploy command. Real auth-expiry+QR-expiry run25011 at CDP9352 is in progress; do not duplicate or restart services before its terminal receipt/cleanup. Earlier dcc15 CT/MR/packet results below are not new-fa5f regression evidence.

### Previous dcc15/11a23 validation — historical image combination

2026-10-10 latest FAQ/expiry activation: B Portal now runs `dcc15c29…`, Cloud Control runs `11a23eea…`; ingress9c210/PG8d0e/A Gateway30141/PACS remain unchanged. Exact full IDs and receipts are in authoritative status. `faq-expiry-rollout.py --apply` actually exercised candidate→old image/active baseline file list→candidate for each role, strict TLS readiness and unchanged runtime configuration. Active B context is the previous three files plus `faq-expiry-reviewed-20261010.yml`; active Control context is the seven-file ingress-preserving context plus its role-specific `faq-expiry-reviewed-20261010.yml`. On recovery, exclude only that FAQ/expiry overlay (B3/Cloud7), preserve patient/ingress overlays and secrets/volumes, and force-recreate **only portal or control**. No writer/migration/PACS/PG/ingress restart is needed. The old target/preflight ID pins intentionally reject rerunning against these already-active candidates; do not weaken them or restore a whole project with old HIPASS_APP_IMAGE values.

Current public normal+FAQ reproduction: `python scripts/patient-public-browser-ops.py --modality CT --surface web --faq`, then MR/web, CT/mobile, MR/mobile. `--faq` pins the new Control image; omitting it retains the historical30141 pin, not a current generic probe. Keys stay in anonymous stdin; screenshots contain only synthetic data. Audit the exact four successful receipt paths with `python scripts/patient-browser-audit-check.py <CT-web> <MR-web> <CT-mobile> <MR-mobile>`. These normal self-view/FAQ results do not replace shared-consent denial E2E; that separate re-run is recorded below. New runtime evidence is DRAFT / UNASSIGNED.

Latest shared CT/MR re-run on dcc15/11a23 passed: each real clinician/mobile workflow7 checks plus9 serialized API negative cases with read-only reason/counter windows; exact receipt audits6 each. Use the existing `run-browser-authorization-trace.ps1 -Capstone -MobileQr -VerticalFlow -PhantomModality CT` (then MR) with the approved B URL and a free debug port; audit the exact successful `b-browser-…/result.json` with `capstone-phantom-audit-check.py`. The latest10-minute expiry run61057 **terminated exit0/PASS/632.986s**, with exact server EXPIRED and authenticated TICKET_EXPIRED denial, owned consent cleanup PASS. Receipt: `artifacts/workstation/b-browser-2026-10-10T01-23-00.606051+00-00/result.json`; its `capstone-phantom-audit-check.py --ticket-expiry <exact-result.json>` passed5 checks, token/key release/forbidden success zero, persisted chain7374. Generic status-unavailable UI during the wait remains a separate unresolved session-expiry UX issue; do not extend TTL or auto-login to hide it. New evidence remains DRAFT / UNASSIGNED.

Current packet pins must be explicit: `python scripts/capstone-cloud-packet-check.py --expected-control-image sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b` and `python scripts/capstone-hospital-packet-check.py --expected-portal-image sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1` (concealed VM input). Defaults intentionally retain historical pins and reject the new runtime rather than silently accepting any image. Latest normal control/negative SYN capture/loss-free/cleanup gates passed for these exact images. mTLS unchanged A30141 also passed8 checks. These bounded probes do not change services/firewall/DB or capture payloads.

## Historical Activation Notes — Not Current Runtime Instructions

The following dated notes preserve the state observed at each earlier activation. Claims such as “local only”, “not yet deployed”, previous active image IDs and pending checks apply to those earlier observations only. Use the current section above and its authoritative status link for today's runtime and next action. These baseline-pinned operators are not general restart or recovery commands.

2026-10-10 FAQ/expiry candidates were **local only at this earlier observation**: B UI `sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1` derives from then-active B27e1; Control `sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b` derives from then-active Control30141. 김범희 / 2026-10-10 / PASS / no exceptions applies only to these exact two candidates and six preexisting evidence hashes in `artifacts/workstation/faq-expiry-candidate-review-20261010.json`; new host code and later execution remain DRAFT / UNASSIGNED. Do not use the baseline-pinned old rollout operators as general deployment commands or weaken their old review/source pins. Candidate scans/config/delta/isolated service smoke do not establish deployed browser success. At that stage, candidate deployment and rollback had not occurred; subsequent actual results are recorded in the current section above.

Read-only current candidate prerequisites: `python scripts/faq-expiry-deployment-preflight.py --role CLOUD` and `python scripts/faq-expiry-deployment-preflight.py --role B` (concealed VM input, not command arguments). Both rendered role-specific stdin image overlays with no non-image config difference. Cloud Control creation labels still contain six files, while active ingress contains seven including `patient-ingress-reviewed-20261010.yml`: render/apply/recover using the seven-file context to preserve ingress, change **control only**, and preserve ingress/PG identities. B uses its exact three-file context and changes **portal only**. Capture receipt file/config hashes and target identities again just before applying; abort on drift. Old rollout operators are not authorized substitutes. Preflight confirms baseline image availability, not actual rollback, TLS readiness or deployed browser behavior.

2026-10-10 KST B focus update: **B Portal only** now runs `sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a`. Cloud ingress stays9c210, Control/A Gateway30141. Receipt `artifacts/workstation/patient-focus-b-rollout-20261009T234957Z/result.json` proves strict TLS readiness, original30141 rollback and27e1 reactivation with the same three B files (`portal.yml`, `encryption.yml`, `patient.yml`) and no other runtime differences. `python scripts/patient-focus-b-rollout.py` is read-only; `--apply` requires an exact reviewed source/image/evidence baseline and is **not a general redeploy command for the already-active candidate**. Preserve protected secret/key identity mounts and the patient overlay on recovery. Restore the original image with those exact three captured files and public environment values; do not use old pre-patient two-file context, down-v, migration or secret output. The host mTLS tool was changed after the image snapshot, so old source-review checks must not be weakened to ignore that change.

Reproduce the latest shared CT/MRI flow: `./scripts/run-browser-authorization-trace.ps1 -Port 9227 -Capstone -MobileQr -VerticalFlow -BrowserUrl 'https://192.168.111.149:9443/hipass/' -PhantomModality CT` (then MR). It drives actual clinician/mobile browser pages and records nine separate API denial checks with per-request read-only PG reason/counter snapshots; it does not test camera scan or actual expiry. Run `python scripts/capstone-phantom-audit-check.py <exact-successful-b-browser-result.json>` after each successful run. Owned synthetic consents are revoked, not deleted. Secret input is fetched only into memory/anonymous stdin.

For the actual A mTLS component, the current A Gateway image is untagged. Use `python scripts/capstone-mtls-check.py --image sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df --image-id sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df`. The concealed VM prompt is local only; do not send credentials in arguments. This tests normal/negative client certificates and exact owned fixture cleanup, not Orthanc direct-port or full network-boundary verification. Latest mTLS8 PASS does not erase the original tag-baseline NOT VERIFIED.

2026-10-10 KST latest ingress-only rollout: human-reviewed image `sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb` is active **only on Cloud ingress**. Control/A Gateway/B Portal remain `30141f81…`, PostgreSQL remains `8d0e686f…`. Actual ingress candidate→captured original image/6-file context→candidate rollback rehearsal passed; Control/PG container identities and runtime configuration remained unchanged. Receipt: `artifacts/workstation/patient-ingress-rollout-20261009T231956Z/result.json`. Active ingress context adds `patient-ingress-reviewed-20261010.yml`; rollback excludes that overlay and uses the original six files and original image. Do not roll back the patient activation itself or remove its patient.yml/DB/secret configuration for this ingress-only recovery.

`scripts/patient-ingress-rollout.py` now defaults to read-only; mutation requires `--apply`. It is pinned to the pre-ingress-change six-file baseline and rejects the already-active seven-file context. Do not rerun it as a general recovery command or weaken its pins. Exact captured image/file-list/environment must be used for a reviewed subsequent recovery. Operator host scripts added after the image build are not automatically part of its source attestation. No `down -v`, writer restart, schema migration or secret output is required for this ingress image change.

Public patient normal probes (credential memory/stdin only): `python scripts/patient-public-browser-ops.py --modality CT --surface web` and the analogous MR/web, CT/mobile, MR/mobile commands. Normal-only receipts are not denial tests. Read-only audit command accepts the four exact successful receipt paths: `python scripts/patient-browser-audit-check.py <web-CT-result.json> <web-MR-result.json> <mobile-CT-result.json> <mobile-MR-result.json>`. Latest normal flow passed, but first mobile CT timed out and left an owned tmp profile; its cleanup remains unresolved and recorded in current status. New execution evidence remains DRAFT / UNASSIGNED.

For the patient self-view candidate, follow [the patient deployment contract](../api/MEDI-Q-PATIENT-SELF-VIEW-GRANT-CONTRACT.md). Independent review of the exact current commit, image and evidence is required before actual activation. `scripts/capstone-cloud-app-rollout.py` performs image-only (or explicit phantom catalog) promotion; it does **not** prepare patient authority tables/role, register ownership, install patient secret mounts or activate the patient overlay. Do not report this tool's image/readiness PASS as completion of patient deployment.

Before an approved patient change, record and preserve the existing Compose project directory/config-file list, images, mounts, enabled features and PostgreSQL container/volume identity. Stop Control and authority writers for the reviewed preparation/registration maintenance interval; preflight is rollback-only, `--apply` is explicit, and existing account/ref state must never be silently overwritten. New secrets must remain protected files and must not appear in logs or command arguments. After activation, verify actual public browser normal/denial flows and audit integrity, not health alone.

Recovery must use the captured baseline image **and captured baseline Compose file list**, excluding newly enabled patient configuration. Restoring only the image while leaving a new activation overlay enabled is not a validated rollback. Preserve database tables, account/ref state, audit records and existing volumes; do not use `down -v`, schema downgrade or account/ref deletion.

2026-10-10 KST: exact-image/config recovery was actually exercised for Cloud Control/ingress and A Gateway/B Portal, followed by candidate reactivation. See `patient-cloud-activation-20261009T222250Z/result.json` and `patient-edge-rollout-20261009T223222Z/result.json` under ignored `artifacts/workstation/`. These scoped runtime results are DRAFT / UNASSIGNED, not database downgrade, production DR or full MVP completion. A originals/PACS were preserved; B is Portal/Viewer-only, not a verified PACS import destination. The current candidate is `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df` with explicit patient overlays. The edge rollout operator is baseline-pinned, not a general redeploy/rollback command for an already-active candidate; do not rerun it assuming its baseline inventory supports candidate-active inspection.

## Historical Validated Baseline

```text
Release SHA:
1b22eae81b64a70149cd2c86b2cc6fb2c3ce4933

Hosted Run:
https://github.com/sureasdufo1-hue/Highpass-Project/actions/runs/32620142659

Status:
LEVEL 4 - TECHNICAL PRODUCTION CANDIDATE ONLY
```

## Rollback

Rollback is a controlled test-environment action, not a production DR claim.

1. Select previous known-good SHA or image digest.
2. Rebuild or pull the matching images.
3. Restore matching configuration and cert mounts.
4. Start compose stack.
5. Run health, security, network, container, and E2E checks.

Rollback validation is `PASS` for the controlled PoC runtime. An isolated rollback image was built from `1b22eae81b64a70149cd2c86b2cc6fb2c3ce4933`, started with the current security configuration, and returned `/api/health` `200` with `status=UP` and `database=UP`. Final roll-forward health also returned `UP`.

Database downgrade was not performed because destructive schema rollback requires an approved migration rollback plan.
