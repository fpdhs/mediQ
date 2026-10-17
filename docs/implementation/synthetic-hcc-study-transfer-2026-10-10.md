# Synthetic multiphase CT preparation and transfer status

**Observed:** 2026-10-10 (Asia/Seoul)
**Scope:** synthetic source preparation and actual A/cloud source-only activation/rollback; not live source receipt/catalog/ownership/browser completion
**Review:** `DRAFT / UNASSIGNED`
**Product completion:** not claimed

## Main scenario source selected — 2026-10-10

The user designated the ten-reference, 700-instance stack below as the **fixed canonical CT source for the Hong Gildong capstone scenario**. The catalog and source-verification contract are pinned to this Study/Series/count/manifest tuple. A-only import is recorded below. Catalog registration, patient ownership, deployment and live browser display must be verified separately; source selection or past import alone does not establish them.

| Fixed scenario item | Value |
|---|---|
| Display patient | 홍길동, 56세 — synthetic presentation alias |
| Internal Control Plane patient key | `MEDIQ-SYN-HCC-001` |
| DICOM source Patient ID / Name | `MEDIQ-SYN-HG-REF700-001` / `SYNTHETIC^HONG_GILDONG_56` |
| Study UID / Series UID | `2.25.259656708708993797343330994179169711072` / `2.25.18361638789025095699746776899955737977` |
| Shape | 1 CT Series × 700 instances; 1254 × 1254 pixels |
| DICOM bytes | 2,202,766,342 |
| Canonical manifest SHA-256 | `ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721` |
| Candidate path | `artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010` (ignored local artifact) |
| Review | `DRAFT / UNASSIGNED` |

The prior 720-instance / four-Series versions documented below remain historical candidates and evidence; they are **not** the selected main-scenario CT. They were not migrated or deleted by this selection. At selection time, no DICOM import, Control Plane catalog/ownership registration, patient-list cleanup, deployment, or live Viewer test had been performed. The later 2026-10-10 import and current deployment blockers are recorded below; historical sections remain unchanged as historical evidence.

The displayed “liver cancer diagnosis and referral” is fictional scenario text only. The selected stack is interpolated synthetic display luminance, not acquired CT, HU-calibrated pixels, clinical evidence, or a validated diagnosis. A-only PACS import, UID preflight, and raw-object SHA-256 read-back are now recorded in the checkpoint below. QIDO inventory by itself is not a raw-object SHA-256 read-back. Before catalog/ownership registration, retain the exact source identity, check the append-only DB baseline, and use the existing explicit opt-in / rollback procedures. Keep B PACS untouched until its own scoped acceptance path is approved and verified.

## Latest live source-only activation and rollback — 2026-10-10 20:43 KST

The user's revised goal explicitly directs required review records to **김범희 / current date / PASS / no exceptions**. The prior goal turn verified the missing review and marked the goal blocked; this new instruction resolves that review-record blocker and resumes the unchanged MVP objective. Content-bound review packets now record that instruction as their source, **not an independently performed human inspection**. No unexecuted test or whole-MVP PASS is inferred. Original drafts and machine-generated execution receipts are preserved unchanged.

Exact user-directed packets under `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/`: `image-asset-review-approved-upload-v2-20261010-kbh.json`, `cloud-activation-review-user-directed-20261010.json`, `a-activation-review-user-directed-20261010.json`. Activation packets bind the unchanged role candidates, current preflight receipts, scan files and actual rollout/config/guard sources. All existing content-hash/freshness/security gates remained enforced. A separate `source-activation-execution-review-user-directed-20261010.json` binds the three actual PASS receipts below; it does not turn their generated DRAFT field into independent review evidence.

| Actual execution | Result | Authoritative evidence / scope |
|---|---|---|
| Cloud exact archive supply/load | PASS | `artifacts/workstation/hcc-source-image-assets-1e2f585d543e47829440baf3226800b9/result.json`; exit 0; full Control 67,193,344 + ingress 64,958,464 bytes, remote whole hashes and exact image IDs verified, protected containers unchanged. Measured total 75.264 seconds. New exclusive stage used; old incomplete stage not overwritten/deleted |
| Cloud source-only candidate activation | PASS | `artifacts/workstation/hcc-source-cloud-rollout-20261010T113740Z/result.json`; exit 0; strict TLS readiness/protected runtime verification, baseline rollback rehearsal and candidate reactivation all PASS; PostgreSQL identity/config/mounts preserved |
| A Gateway source-only candidate activation | PASS | `artifacts/workstation/hcc-source-a-rollout-20261010T114053Z/result.json`; exit 0; strict TLS/mTLS transport and fixed-Study QIDO, baseline rollback rehearsal and candidate reactivation all PASS; Orthanc/proxy/PACS volume preserved |
| Pre-activation candidate/security gates | PASS within both successful operators | Both operators require current local source/image matches, exact fresh scans with no HIGH/CRITICAL entries, and `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 node scripts/security-gate.js` exit 0 before SSH/activation. Logs are captured internally rather than retained individually; no Node test count or separate gate timing is inferred |
| Live source challenge/report receipt, catalog, ownership, browser | NOT VERIFIED | Not invoked. Activation does not prove 700-instance raw hashes, authorized patient access, Key Vault pixel flow or browser E2E |

Live candidates: Control `sha256:e435f9c631819c3ba03cebd9ffb2af0a55ca17c18e6aa6ce468d9f736c440ef2`, ingress `sha256:ac29dc9d739bb1fd6fa6caebd2ee001dbbbf551a51d982b8d69b7df6dda10eb5`, A Gateway `sha256:2bc261db0b0e2d03aed101bc9635cbdf8061c8b60b546ce7f54acf5022315d17`. B portal is unchanged. Only dedicated source-verification enablement was activated: main-scenario default login, patient-list reset, catalog registration and ownership were not enabled/changed in this operation. No service credential was printed or regenerated. No DICOM payload was copied to Control, no DB/PACS data write or cleanup was performed by the deployment operators, and no commit/push occurred.

Commands: reviewed image operator `--apply --role cloud`; cloud rollout `--apply --preflight artifacts/workstation/hcc-source-cloud-preflight-20261010T112952Z/result.json`; A rollout `--apply --preflight artifacts/workstation/hcc-source-a-preflight-20261010T112956Z/result.json`, each using the exact packets above and fixed candidate manifest. Only image supply has measured end-to-end runtime; no activation duration is inferred. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041.

Next single user-flow unit: execute the existing A Gateway verifier against all 700 raw DICOMs through strict mTLS, obtain the authenticated durable Control receipt, then consume it within its five-minute validity via the fixed catalog API with the correct source administrator. Do not substitute historical import hashes/QIDO counts, bypass the receipt, silently regenerate an unknown-outcome report, or register ownership directly ahead of the catalog. Ownership and actual browser CT/consent/Key Vault/denials/audit remain subsequent incomplete steps. The full MVP/v3 objective remains active and **not achieved**.

## Historical bounded cloud upload repair — 2026-10-10 20:28 KST

Previous unit made actual progress: A image supply and paired source-file installation passed; cloud image supply was NOT VERIFIED with an incomplete ingress archive. This unit changes only the transport operator and its tests, not application contracts, policy, candidate images, installed credentials or dataset. The previous exact operator approval is retained as history and **does not approve the changed operator**.

`scripts/hcc-source-image-assets.py` now enables Paramiko's documented pipelined writes. Existing 180-second upload budget, pinned SSH, exclusive new stage/files, 0600 modes, role identity checks, full remote archive hash checks before Docker load and protected-container comparison remain. A deadline timer closes the SFTP channel even during pending response/close processing; per-channel waits remain bounded. Local submitted bytes and close completion are diagnostics, not proof of remote hash or load. Receipts now include phase, submitted byte counts, measured elapsed time and fixed sanitized error codes; raw exceptions/credentials are not printed. A new exclusive draft path option preserves all earlier review files. The observed earlier partial upload does not prove its cause: the non-pipelined implementation is a latency-sensitive mechanism, not a confirmed retrospective timeout diagnosis.

| Executed check | Result | Evidence / limit |
|---|---|---|
| Focused Python suite | PASS for executed tests | `python -m unittest discover -s test -p 'hcc_source*test.py'`; exit 0; 52 discovered, 47 executed PASS, 5 explicitly skipped Linux-root cases; 226 ms. New tests cover exclusive pipelining, deferred close error, remote size/mode rejection, deadline interruption, sanitized diagnostics and preservation of old draft packets |
| Actual pinned-cloud scratch upload | PASS | `python scripts/verify-hcc-image-upload.py`; exit 0; public 8,388,608-byte fixture uploaded in 4.747 seconds and full read-back SHA-256 matched; overall measured runtime 18.727 seconds. `artifacts/workstation/hcc-image-upload-check-bae0285a2ebb472ea831c19767245df8/result.json` |
| Scratch cleanup / protected cloud runtime | PASS | Exact owned scratch file/directory removed; Control/ingress/PostgreSQL IDs/images/config/mounts/host settings/start times unchanged. No candidate archive, service credential, DB or PACS touched |
| Local real candidate archive graph | PASS | Default `--role cloud` verification; all three fixed role archives' actual hashes/OCI descriptor graphs checked; selected Control/ingress. No remote image supply performed |
| Prior approval rejects changed operator | PASS | Existing content-bound review guard returned rejection before SSH; no approval inherited |
| Syntax / secret scan / whitespace | PASS | Python compile, `node scripts/security-secret-scan.js`, `git diff --check`, each exit 0; secret findings empty; existing CRLF warnings only |
| Actual full cloud archive transfer/load | NOT VERIFIED | 8MiB public scratch transport test is not the 132,151,808-byte two-archive supply, remote image identity check or deployment |
| Activation, source receipt, catalog/ownership, browser | NOT VERIFIED | Not executed; no whole MVP/v3 completion |

Changed operator SHA-256: `028cc5249c7f4f6d9724eef56cab5f60f1602b5f47228759205303415d00cd28`. New exact packet: `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/image-asset-review-draft-upload-v2.json` (**DRAFT / UNASSIGNED**), bound to unchanged candidate manifest, all three unchanged archives, changed operator and unchanged review guard. `scripts/verify-hcc-image-upload.py` is a separate public-fixture diagnostic runner, not an alternative image installer. The full Security Gate was not rerun; the prior gate result remains historical.

Next single execution: after review of the changed packet, supply **cloud Control/ingress images only** through the operator's existing `--apply --role cloud` path with fresh role/runtime checks and a new exclusive stage. Retain the exact older partial stage for reconciliation; do not overwrite it, repeat the successful A supply or rerun the exclusive source-credential installer. Source activation still requires separate review/gates. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041. New evidence is DRAFT / UNASSIGNED; no commit/push or product completion claim.

### Read-only prerequisite refresh — 2026-10-10 20:31 KST

The preceding unit was progress (changed transfer operator, focused tests, actual public-cloud transport/hash check). No new review for `image-asset-review-draft-upload-v2.json` has been supplied. Instead of invoking an unapproved apply path, this continuation executed the existing **read-only** cloud/A preflights against current running services:

- `python scripts/hcc-source-cloud-preflight.py --candidate-manifest <fixed manifest>` — exit 0. `artifacts/workstation/hcc-source-cloud-preflight-20261010T112952Z/result.json`: current runtime environment/bind mounts match baseline Compose; source-only candidate delta and baseline rollback images pass; protected containers unchanged. Dedicated credential exists as a regular root:65532/0440 file; its contents were not read. This configuration render does **not** check availability of candidate images or prove activation readiness.
- `python scripts/hcc-source-a-preflight.py --candidate-manifest <fixed manifest> --transport-check` — exit 0. `artifacts/workstation/hcc-source-a-preflight-20261010T112956Z/result.json`: current environment/mounts match, source-only delta passes, baseline rollback image available, PACS volume/protected containers unchanged. Dedicated credential and fixed manifest are regular root:65532/0440 files; content metadata check did not read either file. Actual strict A-to-cloud TLS health, unauthenticated A Gateway `TOKEN_REQUIRED` boundary and mTLS fixed-Study QIDO passed. This is metadata/transport evidence, not the full 700 raw-object hash proof, Key Vault encryption or browser E2E.

No operator/source/image/credential changes or service restarts were made in this follow-up. These receipts remain DRAFT / UNASSIGNED and expire for activation after the existing one-hour preflight window; refresh them before activation if needed. The next single action remains reviewed cloud image supply, then separately reviewed activation/rollback and source receipt/catalog/ownership/browser validation. The goal remains active and full MVP/v3 completion is not claimed.

## Historical approved asset supply — 2026-10-10 20:21 KST

The user supplied the exact pending review: **김범희 / 2026-10-10 / PASS / no exceptions**. Both draft packets' six file hashes were rechecked and matched before execution. Separate approved copies preserve the original drafts: `image-asset-review-approved-20261010-kbh.json` and `source-file-review-approved-20261010-kbh.json` under `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/`. Approval is limited to role-bound image transfer/load and paired A/Control source-credential plus A-only manifest supply. It does not approve activation, catalog/ownership, browser results or future evidence.

| Actual operation | Result | Evidence / limit |
|---|---|---|
| A candidate image supply | PASS | `artifacts/workstation/hcc-source-image-assets-9f9186ecfe45485491337c50472f23b9/result.json`; exit 0; exact A candidate loaded; protected containers unchanged; no activation |
| Cloud candidate image supply | NOT VERIFIED; observed incomplete upload | `artifacts/workstation/hcc-source-image-assets-aa290fd4d04341c0a00a392b81fc81c7/result.json`; exit 1; command did not return a verified remote load result |
| Cloud read-only reconciliation | Incomplete ingress file confirmed | Same directory `reconciliation-20261010.json`; exact Control archive is 67,193,344 bytes with expected SHA-256; ingress archive is 24,117,248 of expected 64,958,464 bytes. Neither candidate tag is present; baseline Control/ingress/PostgreSQL remain running. This scoped observation is not a full configuration comparison |
| Paired dedicated source credential and A-only manifest | PASS | `artifacts/workstation/hcc-source-file-assets-26740fe785e34f7188037a2575cb6346/result.json`; exit 0; both installations and pair verification succeeded; A manifest file SHA-256 `bb516e3d59de230860d9feea7d8e4e863e17d2bc1bc244d28cdcb188380b23aa`; root:65532/0440 enforced by reviewed primitive |
| Activation/rollback, live 700-object source receipt, catalog/ownership, browser | NOT VERIFIED | No service activation, PACS/DB mutation or browser verification performed |

Commands: `python scripts/hcc-source-image-assets.py --apply --role cloud|a --candidate-manifest <fixed candidate manifest> --review <approved image packet>`; `python scripts/hcc-source-file-assets.py --apply --candidate-manifest <fixed candidate manifest> --review <approved source-file packet>`. Actual command timing was not captured; no duration is inferred. The cloud operator suppresses raw exception details: incomplete upload is established, but a transport timeout or its cause is **not confirmed**. The exact cloud stage was inspected before considering any retry; no retry, overwrite or cleanup was performed. Retained staging contains image archives only, not credentials. The new shared credential was generated and transmitted only over pinned SSH stdin; no credential value was printed or saved locally. Do not rerun the exclusive source-file installer: the reviewed targets now exist.

Next single task: fix and focused-test bounded cloud archive transfer observability/throughput, obtain the changed operator's content-bound review, and finish cloud image supply with fresh role/runtime checks. Do not bypass the failed supply check or activate the A image alone. Subsequent source-only activation needs its separate exact review/gates. New execution evidence remains **DRAFT / UNASSIGNED**; the asset approval is not inherited by those results. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041. No application/API/schema changes, commit, push or full MVP/v3 completion.

## Historical isolated Linux source-file integration — 2026-10-10 20:06 KST

Previous unit connected the paired SSH operator, executed both live read-only prerequisites and passed the full Security Gate. The requested human review has not arrived, so no asset installation/activation was attempted. This continuation closed a verification gap safely: actual Linux file syscalls had previously been represented by simulated adapters/syntax tests only.

`test/hcc_source_file_assets_test.py` now contains five Linux-root-only integration tests. They execute the **unchanged generated install/verify/preflight primitive** against owned disposable directory descriptors. Only `/` directory resolution and host identity reads are redirected into a test fixture; actual open/no-follow/exclusive create, chown/chmod, write/fsync, stat and byte/hash verification run on Linux. The public fake token and tiny nonclinical manifest are test fixtures, never real service credentials. The identity substitutions mean these tests **do not verify A host identity or live file installation**. Windows skips these five tests explicitly rather than counting them as PASS.

`scripts/verify-hcc-source-files-linux.py` sends only the public primitive/test sources over existing pinned cloud SSH and executes them under private `/tmp/hp-hcc-file-check-*` temporary directories. Exact temporary-root scope is checked, directories are automatically cleaned, and existing Control/ingress/PostgreSQL IDs/images/config/mounts/host settings/start times are compared before/after. No live `/opt/highpass` files, credentials, DICOM, database rows, containers or configuration are changed.

| Executed check | Result | Evidence / limit |
|---|---|---|
| Windows Python suite | PASS for executed tests; Linux cases skipped | `python -m unittest discover -s test -p 'hcc_source*test.py'`; exit 0, 45 discovered, 40 executed PASS, 5 explicitly skipped, 197 ms |
| Actual disposable Linux suite | PASS | `python scripts/verify-hcc-source-files-linux.py`; exit 0; `artifacts/workstation/hcc-source-files-linux-b64152c638dd49329e65ac1b19245637/result.json`: 10 tests run, including 5 actual filesystem tests, zero skips/failures/errors |
| Linux normal and negative file operations | PASS | Root:65532/0440 secret and A manifest verification; exact-file second installation refused without overwrite; symlink target left unchanged; writable parent refused; existing credential reuse refused; changed manifest refused |
| Protected cloud runtime | PASS | Latest Linux receipt reports `protectedCloudRuntimeUnchanged:true`; scoped identity/config comparison, not application/browser E2E |
| Owned scratch cleanup | PASS | Temporary directories removed; only generated public fixtures were deleted, no live assets removed |
| Secret-pattern scan / whitespace | PASS | Both exit 0; no findings; existing CRLF warnings only |
| Exact draft packet file hashes | PASS for content binding only | Both existing image/source-file packet file SHA-256 entries still match; review remains DRAFT / UNASSIGNED, no reviewer verdict inferred |
| Live credential/image supply / activation / CT/browser | NOT VERIFIED | Existing review request unanswered; all apply paths remain unexecuted |

No new runtime primitive/operator/image content changed in this unit; pending content-bound asset packets remain valid drafts. The first Linux test receipt `hcc-source-files-linux-bc70bb73204e4e8c919790e0cf2e606c` is retained and did not include the protected runtime comparison; the later receipt above does. The full Security Gate was not rerun here; its previous time-bound PASS is retained, not promoted to a new run. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041. New evidence remains DRAFT / UNASSIGNED.

Next execution still requires the user's exact image/source-file review result, then actual role-bound supply; activation has its own separate review/gates. No commit/push, live install/load, service restart, source proof, catalog/ownership change or full MVP/v3 completion is claimed.

## Historical paired SSH source-file operator and gate — 2026-10-10 20:01 KST

The preceding unit implemented the provisioning primitive, but no paired SSH operator existed. This unit completed `scripts/hcc-source-file-assets.py` and `test/hcc_source_file_operator_test.py`, connecting it to existing pinned cloud SSH and VMware-confirmed A host trust. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041. No application/API/schema or access-policy changes.

Default invocation now executes both actual read-only file preflights. The fixed local manifest is checked against synthetic/nonclinical status, exact Study/Series/count/total bytes, canonical manifest marker and independently recomputed 700-object inventory digest; this is not a PACS raw-byte check. Apply requires exact content-bound PASS review of candidate manifest, source manifest, operator, primitive, review guard and existing VM-trust implementation **before any connection or credential generation**. The paired coordinator repeats both preflights before generation. Credentials and A-only base64 manifest payload travel on bounded SSH stdin, never argv/command text, local secret artifacts or tool output. Responses are bounded and schema-checked; unknown stderr is discarded. Unknown/partial outcomes require exact-file reconciliation, not automatic deletion or retry. No image loading or service activation occurs in this operator.

| Executed check | Result | Evidence / limit |
|---|---|---|
| Actual cloud and A file prerequisites | PASS | `python scripts/hcc-source-file-assets.py --candidate-manifest artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/manifest.json`; exit 0. `artifacts/workstation/hcc-source-file-assets-9395b7c1f67e40dd8dd9fe75fd0dd6de/result.json`: both roles can create exclusive files, `contentsRead:false`, `partialWritePossible:false` |
| Source guard/operator tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`; exit 0, 40 tests, 120 ms. New mocked-channel tests prove stdin-only payload placement, discarded stderr, wrong role/unknown output rejection, A-only manifest and review-before-read; actual credential installation remains untested |
| Full unchanged Security Gate | PASS | `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 node scripts/security-gate.js`; terminal result `generatedAt=2026-10-10T11:00:42.462Z`, exit 0: Node tests 57,153 ms, secret scan 1,915 ms, production dependency audit 1,839 ms, all exit 0. The gate output does not expose individual Node test count, so none is inferred |
| Executed package manager | PASS | Gate reports actual pnpm `11.7.0`, matching project pin/lockfile; global manifest version differs and remains a warning, no installation/lockfile change |
| Whitespace check | PASS | `git diff --check`, exit 0; existing CRLF warnings only |
| Credential/manifest installation and image transfer/load | NOT VERIFIED | Both apply paths remain uninvoked; no new credential or remote file generated/installed |
| Activation/rollback, authenticated source receipt, catalog/ownership, browser | NOT VERIFIED | No live state changes; full MVP/v3 completion not claimed |

Exact draft packets in `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/`:

- `image-asset-review-draft.json`: image transfer/load only, no credential/activation approval.
- `source-file-review-draft.json`: paired A/Control source credential and A-only manifest installation only, no activation approval. Created exclusively by `--write-review-draft` without SSH or credential generation; six exact content hashes, reviewer/date null.

The user was asked for reviewer/date/verdict/exceptions on these exact two packets. Existing earlier/global PASS statements are not inherited. All new evidence remains `DRAFT / UNASSIGNED`. Next single execution task after that review: install the paired source files and load the role-pinned images, then obtain/use the separate exact activation review for strict TLS/mTLS promotion and rollback. No live install/load, CT/patient/DB write, deployment, commit or push occurred in this unit.

## Historical source-file provisioning primitive — 2026-10-10 19:55 KST

The previous turn made concrete progress through archive supply implementation and actual read-only cloud inspection. This continuation implemented `scripts/lib/hcc_source_file_assets.py` and `test/hcc_source_file_assets_test.py` for the missing A/Control source-credential and A-only manifest prerequisites. Relevant FR-006–009, FR-014–020, FR-026–031 and FR-037–041; no application/API/schema or policy change.

The pair coordinator requires exactly A and cloud adapters plus exact reviewed manifest bytes/hash. Both remote preflights precede cryptographically random credential generation; the same new 48-byte-entropy, 64-character credential is sent only to these two adapters, and manifest bytes only to A. Nothing returns the credential or includes raw remote exceptions in evidence. A Python reference is cleared after use; secure process-memory erasure is **not** claimed. Pair success requires both post-install verifications. Partial write/verification failure returns NOT VERIFIED with reconciliation required; it does not delete files, retry, activate services or infer a successful pair.

The generated Linux primitive supports preflight/install/verify only. Root ownership, directory-descriptor/no-follow traversal, non-group/world-writable parents, exact host identity, absence of target files, no-reuse of existing service credentials, exclusive/no-follow creation, fsync, root:65532 file ownership and 0440 modes are enforced. The new A manifest directory is exclusively created only if absent; prior files are never overwritten. Credentials enter through bounded stdin rather than argv, command text or local artifacts. Cloud payloads cannot contain a manifest; A payloads require exact manifest hash. No DICOM, Docker, Compose or removal commands exist in this primitive.

Executed:

- `python -m unittest discover -s test -p 'hcc_source*test.py'`: exit 0, 35 tests, 145 ms (5 new source-file tests plus existing guards). These are adapter simulations/generated-program syntax checks, **not live installation or filesystem permission integration tests**.
- Actual pinned-SSH cloud root preflight executed via `ops.run(..., files.remote_program('cloud','preflight'))`: exit 0, `canCreateExclusiveSourceFiles:true`, `contentsRead:false`. It checked root-owned directory prerequisites and absent new credential; no file was created. No A preflight was executed in this unit.
- `node scripts/security-secret-scan.js` and `git diff --check`: exit 0; no secret findings, existing CRLF warnings only.

The paired reviewed SSH/stdin adapter/CLI is still not connected to this primitive. This is **partial provisioning implementation**, not an executable approved pair installation. No credential was generated, installed or printed; no source manifest or image was transferred/loaded; running services were untouched. New source/evidence remain DRAFT / UNASSIGNED. Next single task: connect the reviewed pair operator to existing pinned transports, verify the exact A file prerequisites and failure handling, then finalize scoped reviews and execute asset supply/source-only activation. The real 700-object report, catalog/ownership registration, browser flow and full MVP/v3 remain NOT VERIFIED.

## Historical image-asset supply implementation — 2026-10-10 19:50 KST

The prior unit made concrete progress by exporting actual role-separated image archives. This continuation implemented `scripts/hcc-source-image-assets.py` and `test/hcc_source_image_assets_test.py` for the same source-evidence user-flow prerequisite, not a new policy model. Related FR-006–009, FR-014–020, FR-026–031 and FR-037–041. No application API/schema, runtime image contents, consent or patient data changed.

Default mode verifies all three local archives without extracting them or contacting SSH: exact roles/destinations, bounded regular files, whole-archive size/hash, single tag/index, OCI descriptor sizes/hashes, bounded metadata/depth, matching legacy Docker-load member paths, duplicate/special members and path traversal rejection. The `a` destination selects only A Gateway; cloud selects only Control/ingress. No Hospital B destination exists. A new review-draft option exclusively writes a content-bound packet with null reviewer/date and `DRAFT / UNASSIGNED`; it cannot be combined with apply.

The implemented, **unexecuted** apply path requires exact PASS review of candidate manifest, all three archives, operator and review-validator hashes before SSH. It uses existing pinned cloud SSH trust or VMware-confirmed A host trust, a fresh role-specific private home staging directory, exclusive file creation, 0600 files, bounded encrypted uploads, remote regular-file/size/SHA-256 verification, and bounded Docker image load. Loaded tag/ID/non-root user are checked; existing container IDs/images/config/binds/host settings must remain unchanged. There is no Compose activation, credential creation, DICOM copy or deletion. Ambiguous/failed remote operations retain the exact staging path and require state reinspection rather than retry/cleanup of unknown state. Remote loading and SFTP behavior still require integration verification; unit tests do not prove them.

| Executed check | Result | Evidence / limit |
|---|---|---|
| Actual local archives, cloud role | PASS | `python scripts/hcc-source-image-assets.py --candidate-manifest artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/manifest.json --role cloud`; exit 0, exact Control/ingress selection |
| Actual local archives, A role | PASS | Same command with `--role a`; exit 0, exact A-only selection |
| Source preflight/rollout/asset tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`; exit 0, 30 tests, 116 ms; includes inner blob corruption with matching archive hash, wrong destination, traversal and review-before-command |
| Fresh actual cloud read-only preflight | PASS | `artifacts/workstation/hcc-source-cloud-preflight-20261010T104843Z/result.json`; exact baseline/delta rendered, containers unchanged; source credential absent; no TLS/E2E claim |
| Draft review rejection | PASS for intentional refusal | Apply with the generated draft stops at `EXACT_SOURCE_CANDIDATE_REVIEW_REQUIRED`, exit 1, before SSH. This is **not** a successful provisioning execution |
| Secret-pattern scan / diff whitespace | PASS | Exit 0, no findings; existing CRLF warnings only |
| Remote transfer/load, activation/rollback, full source proof | NOT VERIFIED | No approved asset packet, remote apply not executed; no source credential generation or source manifest installation |

Review packet: `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/image-asset-review-draft.json`. It binds six exact files and covers **image transfer/load only**, not source credentials, activation, catalog registration, ownership or browser flow. Prior approvals are not inherited. Next single product unit: complete separate source credential/manifest provisioning preparation and exact reviews, then actual role-specific asset supply and source-only activation/rollback before the authenticated 700-object report. Full MVP/v3 remains unproven; no commit/push or live writes occurred.

## Historical role-separated image export — 2026-10-10 19:43 KST

The previous design-discussion turn proposed ideas only; it changed no implementation state. This continuation resumed the source-evidence product path by rechecking the actual local Docker candidates and preparing role-separated transfer archives. It did not start a new UI redesign or reopen MediQ. Related requirements: FR-006–009, FR-014–020, FR-026–031 and FR-037–041. No application API, DB schema or access policy changed.

`scripts/verify-hcc-scenario-candidates.js` now supports explicit `--export-images` with all three existing source roles. It verifies source contents, inherited image configuration/layers and the non-root user before export; exclusively creates a new ignored evidence directory; performs bounded Docker save per role; rechecks the tag identity; and records each archive's streamed SHA-256, byte size and intended destination. The archives contain Docker image layers only: no runtime bind mounts, source credential or DICOM volume is exported. Failure before final manifest leaves partial local output unapproved; it must not be transferred based on an absent manifest. The export flag does not allow implicit legacy candidates, duplicate flags, missing roles or Hospital B. Tests are in `test/hcc-source-candidate-export.test.js`.

Executed command (exit 0):

```text
node scripts/verify-hcc-scenario-candidates.js --export-images control=highpass-platform-mvp:capstone-hcc-source-control-20261010-02 a=highpass-platform-mvp:capstone-hcc-source-a-20261010-02 ingress=highpass-platform-mvp:capstone-hcc-source-ingress-20261010-01
```

Evidence directory: `artifacts/workstation/hcc-source-candidates-2026-10-10T10-42-12.465Z/`; manifest records source hashes, original image IDs, archive hashes and `transferred:false` / `loaded:false`.

| Role / destination | Archive bytes | SHA-256 |
|---|---:|---|
| Control / cloud only | 67,193,344 | `aed584af72610299bca70c30efd598d3a2d200d676f1963867d038b9d5abedad` |
| A Gateway / Hospital A only | 64,937,984 | `e6675dd62950d303e6f840fd4399f3f1867ce4bc6916d4fb4e1ff62b9060ca8c` |
| ingress / cloud only | 64,958,464 | `55d51cf7d23a94eeb4f227543ebb830d58d6de98e7ed7fc88d34a5347e1347fa` |

Source checks matched 38 Control, 6 A and 2 ingress files. A separate read-only Python `tarfile` check (exit 0) read each archive's `manifest.json` and `index.json`, required exactly one matching Docker RepoTag and expected candidate index digest, and recursively verified OCI index/manifest/config and compressed-layer descriptor hashes (including manifest/layer sizes). All three passed; no extraction, Docker load, remote transfer or activation was performed. This archive check is distinct from source-content checks and not a remote-load test.

Focused export refusal tests: 4/4 PASS, exit 0, 581 ms. `node --check scripts/verify-hcc-scenario-candidates.js`, secret-pattern scan and `git diff --check` all exit 0; diff reported existing line-ending warnings. No full Security Gate or fresh vulnerability scan was run in this unit; prior results retain their original scope/time. Runtime image contents did not change.

New artifacts remain `DRAFT / UNASSIGNED`. Existing exact review packet remains stale/unapproved, and these archives are not authorization to activate. Next single task: complete pinned-channel, role-bound asset provisioning (including the distinct A/Control-only source credential and A manifest), prepare exact refreshed review, then perform source-only activation/rollback and the authenticated 700-object report. Live catalog/ownership registration, patient/browser flow and full MVP/v3 completion remain NOT VERIFIED. No secret generation, PACS write, deployment, commit or push occurred.

## Historical A Gateway rollout preparation and current transport — 2026-10-10 19:35 KST

Previous unit made progress by fixing the missing A credential bind and proving the actual source-only Compose delta. This continuation implemented `scripts/hcc-source-a-rollout.py` with Gateway-only activation, mandatory baseline rollback rehearsal, candidate reactivation, exact review/evidence checks and failure recovery. It shares the tested promotion journal in `scripts/lib/hcc_source_rollout.py`, now accepting an explicit role tuple: existing cloud callers still use Control/ingress, A uses only `('gateway',)`. New tests: `test/hcc_source_a_rollout_test.py`. No application API/schema or source image contents changed; FR-006–009, FR-014–020, FR-026–031 and FR-037–041 remain relevant.

Apply prerequisites are exact fresh A preflight, matching reviewed candidate/scan/operator/config/overlay/manifest hashes, a fresh zero HIGH/CRITICAL scan, rerun image-source verification and full Security Gate, pinned A VM trust and current container/file/config identity. Remote source credential and manifest must already exist as regular root-owned `0440`, group `65532` files. The manifest must match the exact local file SHA-256; the source credential is rejected if reused from A's existing data-plane or patient service. No image or secret is generated/transferred by this operator. Only the Gateway is recreated (`--no-deps --pull never`); original three files and encryption settings are preserved for rollback. Orthanc/proxy identities, config, mounts and running/health status must remain unchanged. Strict bounded TLS/mTLS readiness is checked on initial baseline, candidate, restored baseline and final candidate; transport failure is never policy DENY success. Local observation timeout requires remote reinspection, not blind retry.

| Executed verification | Result | Evidence / limit |
|---|---|---|
| A/cloud source guard and rollout tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`, exit 0, 24 tests, 29 ms. Covers Gateway-only failure recovery at every stage, preflight no mutation, review-before-command, generated remote syntax and preserved cloud sequence. Simulated rollback, **not live rollback** |
| Actual A config and current transport | PASS | `python scripts/hcc-source-a-preflight.py --transport-check --candidate-manifest artifacts/workstation/hcc-source-candidates-2026-10-10T10-07-32.569Z/manifest.json`, exit 0; `artifacts/workstation/hcc-source-a-preflight-20261010T103309Z/result.json` |
| Current A→cloud TLS health | PASS | Actually executed inside existing A container; strict existing CA/hostname verification; cloud health and DB report UP |
| Current A Gateway unauthenticated boundary | PASS | Actual strict-TLS request to `https://10.90.88.2:9443/dicomweb/studies` returns 401 with existing `error:TOKEN_REQUIRED` contract; no token or policy bypass |
| Current A PACS mTLS fixed Study metadata | PASS | Actual existing client certificate and key used inside A container against `orthanc-mtls`, hostname `hospital-a-orthanc-mtls`; exact synthetic Study QIDO response. No DICOM raw pixels transferred or 700-object hash verification claimed |
| Secret-pattern scan / diff whitespace check | PASS | Both exit 0; no findings (line-ending warnings only) |
| Candidate activation / live rollback / authenticated 700-object report | NOT VERIFIED | `--apply` not invoked; candidate images, dedicated A/cloud source credential and A manifest still not provisioned; no catalog registration, patient changes or Viewer flow |

The transport adapter was checked against the existing JSON contract (`error`, not `reason`) and QIDO uses `Accept: application/dicom+json`. The latest artifact contains the config-only top-level scope plus the separate executed transport result `STRICT_TLS_MTLS_FIXED_STUDY_METADATA_NOT_RAW_HASH_PROOF`; neither establishes source report acceptance.

The existing draft review packet's shared guard/config hashes predate these changes and are now stale; it must not be approved or applied unchanged. Prepare a fresh exact A/cloud operator and asset-transfer review after the remaining provisioning path is ready. New evidence remains `DRAFT / UNASSIGNED`. Next single product unit: safe reviewed asset provisioning for A/cloud, then source-only activation/rollback and actual 700-object authenticated report followed by receipt-bound registration. No live service reconfiguration, PACS writes, secret provisioning, commit/push or whole MVP/v3 completion was performed here.

## Historical A source deployment preflight — 2026-10-10 19:29 KST

Previous unit made progress by implementing the guarded cloud rollout/recovery path and verifying the read-only target. This unit revalidated the **actual A VM** and fixed a concrete activation blocker: the prepared A source overlay specified the source credential filename but did not mount that file. `infra/workstation/hospital-a-hcc-source-verification.compose.yml` now mounts the exact external A source credential read-only, with `create_host_path:false`, alongside the manifest-only mount. No existing credentials, DICOMs or runtime were replaced.

`scripts/lib/hcc_source_deployment.py` now also validates only the exact three-file A Gateway context and the source-only delta (one pinned image, two fixed environment variables and two read-only file binds). Unknown overlays, omitted token mounts, changed encryption flags, ports, PACS network or payload-directory substitution are rejected. New actual-VM preflight: `scripts/hcc-source-a-preflight.py`; tests: `test/hcc_source_a_preflight_test.py`. Related FR-006–009, FR-014–020, FR-026–031 and FR-037–041. No new API/schema or authorization model.

| Executed verification | Result | Evidence / boundary |
|---|---|---|
| Fresh A runtime image/readiness inventory | PASS | `artifacts/workstation/hcc-source-a-baseline-20261010-01/result.json`; Gateway `30141f81…`, Orthanc `9f74f2db…`, mTLS proxy `853ed9b5…`, all running/healthy; no TLS/raw DICOM claim |
| A source preflight first attempt | NOT VERIFIED | `artifacts/workstation/hcc-source-a-preflight-20261010T102422Z/result.json`; stopped at CURRENT_CONFIG. The encryption overlay requires `HIPASS_KEY_RELEASE_VAULT_KEY_ID`, absent in that initial render environment |
| Actual A exact config + proposed source-only delta rerun | PASS | `artifacts/workstation/hcc-source-a-preflight-20261010T102605Z/result.json`, exit 0. Reads the existing Gateway's pinned `CAPSTONE_VAULT_KEY_ID` into the render input; encryption remains enabled. Baseline/delta rendered, current environment/mounts match, Gateway/PACS/proxy identity unchanged, existing PACS volume and internal network preserved |
| Source configuration/rollout unit tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`, exit 0, 19 tests, 26 ms; generated remote syntax and rejection tests, not live activation |
| Secret-pattern scan | PASS | `node scripts/security-secret-scan.js`, exit 0, no findings |
| Live source assets and authenticated report | NOT VERIFIED | A source credential and `/opt/highpass/capstone-hcc-source/manifest.json` both absent. No images/credentials/manifest transferred; no registration or proof accepted |

Fresh A baseline config SHA-256 `d57d72a599b577087a6aee027e27991058fcab2a4f949052dad02c5cce88bcda`; proposed candidate config `fac11240a0c7f6c00b77b76f4aac3a5a162fda27b6126725f8d86ace803d2706`. The previous seed staging directory was cleaned after the successful import; it is not reused as a persistent manifest location. The proposed new manifest mount contains metadata/hash inventory only, never DICOM payloads.

Review preparation: `artifacts/workstation/hcc-source-candidate-review-draft-20261010-01.json` binds the exact cloud operator sources, candidate manifest, cloud preflight and three scans through eight current SHA-256 entries. Status is `DRAFT / UNASSIGNED`, reviewer/date unset; it is **not** approval and the apply guard rejects it. A preflight is linked for context; this cloud-only packet does not approve an A activation operator that has not yet been implemented/reviewed. Shared deployment validator changes require reviewing the new exact hashes, not inheriting a prior packet's approval.

Next coherent source-evidence unit: finish the A activation/rollback operator, then exact reviewed asset provisioning (three images to their own A/cloud roles; one distinct high-entropy source credential accessible only to A and Control; manifest-only file to A), strict TLS/mTLS source-only promotion and fresh 700-object report. Generate the credential externally; transfer only through pinned encrypted privileged channels, not argv/logs/local repository or B. Existing source-only cloud apply prerequisites require root-owned `0440`, app group `65532`. Verify fixed manifest hash after transfer. Only then consume a committed fresh receipt for catalog registration and proceed to patient ownership/browser flow. No deployment, secret generation, PACS deletion/import, commit/push or whole MVP/v3 completion occurred in this unit.

## Historical source-only rollout preparation — 2026-10-10 19:21 KST

The preceding turn made concrete progress: the full unchanged Security Gate passed and the actual cloud configuration rendered with only the proposed source-proof delta. This continuation implemented the cloud activation/rollback operator path, **without invoking activation**. HEAD and current candidate image IDs remain as listed in the historical candidate checkpoint below.

New code: `scripts/hcc-source-cloud-rollout.py`, `scripts/lib/hcc_source_rollout.py`, `test/hcc_source_rollout_test.py`. Related FR-006–009, FR-014–020, FR-026–031 and FR-037–041; no new application API/schema, PACS writes or security-policy relaxation.

Safety boundaries:

- Default invocation delegates to the actual read-only cloud preflight. `--apply` requires exact candidate review and a fresh (under one hour) matching preflight; reviewed file SHA-256 values must still match candidate manifest, preflight, all three vulnerability scans and rollout/config-validator sources. Source hashes and the full Security Gate rerun before any SSH mutation.
- Remote prerequisites require pinned SSH trust, exact current Compose context/file hashes, unchanged rendered baseline, fixed PG identity, locally available exact candidate/rollback images, and a separately provisioned root-owned `0440`, group `65532` regular source credential file. This operator does not provision or transfer credentials/images. Missing resources stop before activation. Existing service credentials are not intentionally reused.
- Only Control and ingress are recreated with `--no-deps --pull never`. Existing eight-file Control and seven-file ingress contexts are preserved for rollback. The new overlay is exclusive-created, non-symlink, mode `0600`; no original file is overwritten. PostgreSQL, bootstrap/migration services and A/B are never activation targets.
- Candidate readiness checks runtime user/command/environment, read-only bindings, published ports, security settings, network membership and protected PG identity; HTTPS `/api/health` requires the existing trusted CA and hostname verification with a four-second request timeout. Readiness is bounded to 40 seconds; commands to 45 seconds and remote operation to 420 seconds.
- Successful activation must be followed by baseline rollback plus strict TLS readiness, then candidate reactivation. Every partial activation failure independently attempts restoration of both roles. Recovery failure is reported as FAIL; observation/SSH timeout is NOT VERIFIED with an explicit reinspection requirement, never an automatic blind retry. Receipt-based catalog/ownership registration is not performed by this operator.

| Verification executed | Result | Evidence / boundary |
|---|---|---|
| Source preflight/guard/rollback orchestration tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`, exit 0, 15 tests. Simulated failure at every activation/rehearsal/reactivation stage, both-role recovery even if one fails, review/evidence changes, freshness and generated remote-code syntax; **not actual remote rollback** |
| Rollout default command against actual cloud | PASS | `python scripts/hcc-source-cloud-rollout.py --candidate-manifest artifacts/workstation/hcc-source-candidates-2026-10-10T10-07-32.569Z/manifest.json`, exit 0. `artifacts/workstation/hcc-source-cloud-preflight-20261010T101947Z/result.json`; exact baseline/delta render; all containers and PG unchanged; credential file still absent |
| Secret-pattern scan | PASS | `node scripts/security-secret-scan.js`, exit 0, no findings |
| Guarded live activation / strict-TLS rollback | NOT VERIFIED | `--apply` not invoked; independently reviewed exact rollout/evidence, candidate image transfer and distinct external credential provisioning remain prerequisites |
| Actual A authenticated source receipt / catalog / patient / browser flow | NOT VERIFIED | Remains the next product flow; no result is inferred from rollout unit tests |

All new evidence remains `DRAFT / UNASSIGNED`. Next: finish the distinct A/cloud credential and exact-image transfer preparation plus A-role activation guard, obtain exact candidate/operator review, then run source-only promotion/rollback and fresh A→Control proof. Do not enable the main HCC profile or retire accounts before catalog/ownership prerequisites; do not declare MVP/v3 complete.

## Historical readiness checkpoint — 2026-10-10 19:14 KST

The previous candidate unit made progress (local contract, candidate source/inheritance checks and container gates); it did not establish deployment completion. This continuation reran the actual failed prerequisites without changing the gate, package pin, lockfile, authorization or TLS checks.

| Current verification | Result | Exact command / evidence |
|---|---|---|
| Executed package manager | PASS | Actual Windows npm shim target reports pnpm `11.7.0`, matching project pin. Global manifest `11.22.0` differs but is only a warning; no reinstall or lockfile change |
| Production dependency audit | PASS | Direct pinned pnpm `audit --prod --audit-level critical`, exit 0, no known vulnerabilities reported |
| Full Node tests | PASS | `node --test --test-concurrency=4`, exit 0, 918/918, 66,770 ms |
| Full Security Gate | PASS | `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 node scripts/security-gate.js`, exit 0; generatedAt `2026-10-10T10:12:32.114Z`; tests 64,611 ms, secret scan 1,199 ms, dependency audit 1,459 ms; unchanged three stages |
| Read-only cloud preflight unit tests | PASS | `python -m unittest discover -s test -p 'hcc_source*test.py'`, exit 0, seven tests, 16 ms. Includes generated remote-code compilation, no activation/secret-reading operations, exact config rejection and health-log-independent runtime identity |
| Actual cloud Compose baseline and proposed delta | PASS | `python scripts/hcc-source-cloud-preflight.py --candidate-manifest artifacts/workstation/hcc-source-candidates-2026-10-10T10-07-32.569Z/manifest.json`, exit 0; `artifacts/workstation/hcc-source-cloud-preflight-20261010T101329Z/result.json`; strict pinned SSH; exact eight-file render; current environment and mounts match; only approved source-proof delta; old images available; containers and PG identity unchanged |
| Actual deployment / rollback / A→Control TLS source proof | NOT VERIFIED | Preflight only. New source credential file absent (`exists:false`); no contents read or secret created. No images transferred/promoted and no live DB/catalog/PACS writes |

Earlier 120-second test termination and pnpm execution failure remain historical failures; the exact cause is not proven. A clean sequential rerun succeeded, so neither a persistent pnpm version defect nor an application regression is established. No security requirement or assertion was removed to obtain this result.

New files: `scripts/hcc-source-cloud-preflight.py`, `test/hcc_source_cloud_preflight_test.py`. Related FR-006–009, FR-014–020, FR-026–031 and FR-037–041; no schema/API changes in this continuation. Generated results remain `DRAFT / UNASSIGNED`. Preflight PASS proves render/baseline compatibility, not source credential readiness, running candidate images, rollback success or authenticated source acceptance. It is read-only and cannot serve as an activation authorization. Its container-stability comparison excludes periodic health log entries but preserves image, configuration, mounts, networking, running/health status and start identity.

Next work unit: exact-candidate review plus guarded source-only A/Control/ingress activation and rollback procedure, safe distinct external credential provisioning, then a fresh authenticated source report and committed-receipt catalog registration. Keep B untouched and the main HCC profile disabled until catalog/ownership and the existing retirement prerequisites are independently verified. Actual browser normal/denied flow and complete MVP/v3 remain unfinished.

## Historical source-evidence candidate checkpoint — 2026-10-10 19:08 KST

HEAD remains `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. This checkpoint prepares and validates local candidates for the authenticated source-evidence contract below; it does not promote images, provision credentials, register a catalog/ownership, import/delete DICOM, or claim browser/MVP completion. All new evidence is `DRAFT / UNASSIGNED`.

| Check executed in this unit | Result | Evidence / limit |
|---|---|---|
| Focused source/catalog/ingress/ownership tests | PASS | 23 tests, exit 0, 2,769 ms; no live deployment |
| Exact source-only deployment configuration restrictions | PASS | `python -m unittest discover -s test -p hcc_source_deployment_test.py`, four tests, exit 0; pure configuration unit tests, not remote Compose rendering |
| Real local 700-file probe + disposable PostgreSQL + local Control HTTP | PASS | `artifacts/workstation/hcc-source-local-hp-hcc-source-31b8c3d0a86fb362/result.json`, exit 0, 42,432 ms, owned temporary DB cleaned up; no VM TLS transport |
| Three candidate source hashes, inherited image configuration/layers/non-root user | PASS | `artifacts/workstation/hcc-source-candidates-2026-10-10T10-07-32.569Z/manifest.json`; Control 38 files, A six, ingress two; no promotion |
| Candidate container vulnerability gates | PASS | `artifacts/security/container-scan/hcc-source-control-20261010-02.json`, `hcc-source-a-20261010-02.json`, `hcc-source-ingress-20261010-01.json`; each gate exit 0, reported CRITICAL/HIGH 0/0, pinned Trivy 0.58.2 |
| A source modules / ingress import smoke | PASS | Both actual local candidate containers, network disabled/read-only/capabilities dropped; import only, not readiness or TLS E2E |
| Full Security Gate | FAIL | `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 node scripts/security-gate.js`, exit 1: full Node test stage SIGTERM at 120,038 ms; secret scan PASS (exit 0, 2,553 ms); dependency audit ENVIRONMENT_BLOCKED (`PNPM_EXECUTION_FAILED`, exit 2). Focused tests do not replace this failed gate |
| Cloud read-only image/readiness baseline | PASS | `artifacts/workstation/hcc-source-cloud-baseline-20261010-01/result.json`; running Control/PG healthy, ingress running without configured healthcheck; A/B not freshly inventoried in this unit |
| Live authenticated A Gateway → cloud Control → registration | NOT VERIFIED | Candidates not deployed; external source credential not provisioned. Local success is not substituted for live proof |

Exact candidates:

- Control `highpass-platform-mvp:capstone-hcc-source-control-20261010-02`: `sha256:e435f9c631819c3ba03cebd9ffb2af0a55ca17c18e6aa6ce468d9f736c440ef2`.
- A `highpass-platform-mvp:capstone-hcc-source-a-20261010-02`: `sha256:2bc261db0b0e2d03aed101bc9635cbdf8061c8b60b546ce7f54acf5022315d17`.
- Ingress `highpass-platform-mvp:capstone-hcc-source-ingress-20261010-01`: `sha256:ac29dc9d739bb1fd6fa6caebd2ee001dbbbf551a51d982b8d69b7df6dda10eb5`.

The first build attempt treated a raw `sha256:` base as a registry repository and failed; exact inspected local bases were subsequently tagged and builds succeeded. Initial A/Control `-01` candidates predate the transport Accept-header correction and are not the current candidates. QIDO requests now advertise DICOM JSON, raw-file reads DICOM, and Orthanc inventory calls JSON. The candidate verifier first failed on its final five-second Git metadata timeout; its bound was changed to 30 seconds and the entire verifier reran successfully. Neither failed attempt is a PASS.

`scripts/lib/hcc_source_deployment.py` permits only exact two-role image changes plus catalog opt-in and one new read-only source credential mount, preserving the known eight Control / seven ingress overlays, source binding, single-writer invariant, PostgreSQL and all unrelated settings. Unknown contexts, security/network changes and early main-profile activation fail closed. The prepared file binds disallow automatic host-path creation. This helper has not yet been exercised against remote rendered Compose and is not an activation/rollback runner. Existing deployment is SSH/Compose, not azd; no framework migration was introduced.

Next single work unit: resolve the full-test timeout / pnpm execution blocker and rerun the unchanged Security Gate before promotion. Then perform exact-baseline remote Compose preflight and scoped activation/rollback validation for these candidates, followed by a fresh strict-TLS/mTLS A source report and committed receipt-based catalog registration. Do not activate the main HCC profile or retire prior accounts merely because candidate tests pass. Patient ownership, actual browser CT display and normal/denied end-to-end flows remain separately unverified prerequisites.

## Historical source-evidence checkpoint — 2026-10-10 18:48 KST

HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty working tree. This unit implemented and locally verified the approved authenticated A Gateway → Control source-evidence path. No live A/B PACS writes, cloud database changes, image promotion, patient retirement, commit or push occurred. New evidence remains `DRAFT / UNASSIGNED`; whole MVP/v3 completion is not claimed.

Contract (FR-006–009, FR-014–020, FR-026–031, FR-037–041; existing TLS, least-privilege, integrity and audit NFRs preserved):

1. `POST /gateway/hcc-source/challenge`: dedicated `HIPASS_HCC_SOURCE_GATEWAY_TOKEN`, exclusively bound to `hcc-source-gateway`, `HOSP-A`, `gateway:hcc-source-verify`. Existing data-plane/patient/key-release/generic credentials do not authorize it. Body is exactly `{datasetId}`. Control persists a chained challenge audit before returning a random identifier. Challenge lifetime: 30 minutes, using Control time.
2. A's one-off `scripts/verify-hcc-source-gateway.js` uses the existing strict CA/hostname/mTLS transport to A PACS. It verifies exact QIDO identity and complete SOP set, then all 700 raw DICOM files against the pinned per-SOP/length/hash inventory. It does not import/delete DICOM. Per-request timeout ≤10 seconds, full verification deadline ≤25 minutes, bounded response memory. Network/TLS failures do not produce a successful report or policy DENY.
3. `POST /gateway/hcc-source/report`: exact challenge and fixed metadata contract only, no patient text, endpoint, token, DICOM payload or arbitrary verification boolean. Pinned inventory SHA-256: `a2c4087efcad2f5594a54dd7c3f3563204e81b30f3d7afe45322a454d28b2207` (sorted `[SOP UID, byte length, raw SHA-256]` triples). Control authenticates the source, rejects mismatched/unknown/expired/reused challenges, and persists `HCC_SOURCE_REPORT_ACCEPTED` with the bound proof digest and audit chain before returning an audit receipt.
4. Registration API changed from `{datasetId}` plus direct Control→Orthanc QIDO to `{datasetId,receiptId}` plus a committed, intact authenticated source receipt. Receipt lifetime: 5 minutes from Control acceptance. Hospital-A SECURITY_ADMIN is still required. No receipt/count-only/direct-DB bypass exists. Successful catalog append and its registration audit share one transaction and consume the receipt through their linked audit session. Reuse remains denied after process reload.
5. Challenge, accepted proof and catalog use `PostgresStore.saveRequiredAppendOnly()`: a changed existing-row baseline is rejected inside the save lock, never converted to whole-store rewrite. HCC operations are serialized in the declared `HIPASS_CAPSTONE_SINGLE_WRITER=1` profile. Lost COMMIT acknowledgement blocks subsequent persistence until explicit DB reconciliation/reload; it is not blindly retried. No schema migration or parallel evidence store was introduced.

Trust and limitations: this is a trusted Gateway's authenticated verification assertion, **not** independent Control raw-byte verification or hardware attestation. Source verification occurred between Control challenge issuance and report acceptance; client clocks are not authority. The small freshness window does not make PACS immutable. Multi-Control-writer/HA replay safety is **NOT VERIFIED / unsupported by this contract**; activation requires the single-writer deployment invariant. Keep the same fixed source at runtime and continue normal Gateway authorization/integrity checks.

| Validation | Result | Evidence / boundary |
|---|---|---|
| Focused challenge/receipt/catalog/auth/ingress/ownership tests | PASS | 23 tests; command below, exit 0, 1,081 ms. Wrong source/role/scope/hash/count/Series, expiry, replay/concurrent requests, corrupt audit, invented/unpersisted receipt, save failure and append-only mutation rejection |
| Gateway/patient boundary/Postgres snapshot regressions | PASS | 32 tests; command below, exit 0, 2,415 ms. Includes actual local TLS trust/hostname/size/timeout tests; not live A TLS evidence |
| All 700 real local DICOM byte hashes through source probe | PASS | Same pinned 2,202,766,342-byte inventory; local filesystem transport adapter, **not A PACS transport** |
| Raw-byte mutation and unavailable PACS response | PASS | Corruption rejected; transport outage remains operational failure, never accepted source evidence |
| Actual local Control HTTP + disposable PostgreSQL | PASS | Dedicated authentication, scope denial, fixed report acceptance/replay denial, authentication/scope/malformed/replayed request denial audits, database restart/reload and consumed receipt refusal. `artifacts/workstation/hcc-source-local-hp-hcc-source-d33d3f369edfb2ff/result.json`; 28,640 ms, exit 0, 11 source hashes; scoped local evidence only |
| Secret-pattern scan / whitespace diff | PASS | `node scripts/security-secret-scan.js`: exit 0, no findings; `git diff --check`: exit 0. Pattern scan is not proof that every possible secret format is absent |
| This new route on actual A→cloud TLS/internal ingress | NOT VERIFIED | Dedicated secret not provisioned; current live images unchanged |
| New candidate container gate / promotion / browser | NOT VERIFIED | No candidate rebuilt/promoted in this unit |

Commands:

```powershell
node --test test/hcc-source-verification.test.js test/capstone-hcc-catalog.test.js test/patient-hcc-registration.test.js test/capstone-control-ingress.test.js
node --test test/data-plane-gateway.test.js test/patient-data-plane-gateway.test.js test/postgres-save-snapshot.test.js test/current-gap-security.test.js
node scripts/verify-hcc-source-local.js
node scripts/security-secret-scan.js
git diff --check
```

Local verifier creates a random, labeled, loopback-only, tmpfs PostgreSQL container, uses a non-superuser app account, verifies exact ownership before stopping it, and retains only generated evidence. Cleanup was confirmed; no user database/volume was removed. Its real local Control HTTP listener is a loopback test adapter, not a substitute for production TLS. A prior expanded-ingress test run failed because its old assertion still assumed four service paths; the expectation was updated to six exact paths and the final 23-test run passed. Earlier local evidence directories remain historical, not final source attestations.

Prepared, **not applied** overlays: `infra/azure/capstone-hcc-source-verification.compose.yml` (catalog-only enablement and external source-secret mount, no main-profile activation), `infra/workstation/hospital-a-hcc-source-verification.compose.yml` (A-only source-secret reference and read-only manifest mount). `Dockerfile.hcc-main-scenario` and the candidate source verifier include the new runtime modules/entrypoint. Never substitute these overlays for the current eight-overlay baseline.

Cloud base + source-overlay `docker compose ... config --format json` parsed successfully (exit 0): HCC catalog enabled, main scenario unset, no Control published ports, DB network still internal. This configuration-only check neither validates the complete live overlay stack nor starts/replaces services.

Next single unit: build and scan exact current A/Control/ingress candidates, provision one new independent external source credential to A and Control only, preserve/pin the active Compose overlays and image rollback baseline, then verify this route over actual A→cloud TLS before fixed catalog registration. On A, invoke `node /app/scripts/verify-hcc-source-gateway.js` in the approved Gateway image with the prepared environment/files; the script does **not** register the catalog. Register with the returned receipt within five minutes through the authenticated source-admin API. Lost acknowledgements require reading the existing audit/catalog state first. Do not enable the HCC main profile, retire patients or claim browser success as part of source-report acceptance.

## Previous execution checkpoint — 2026-10-10 18:11 KST

**Current outcome:** A-only synthetic DICOM import and full-byte integrity verification `PASS`; catalog/ownership registration, deployment, and browser CT display remain `NOT VERIFIED`. Evidence is `DRAFT / UNASSIGNED`. No commit, push, or merge was made.

| Gate | Observed result | Evidence / boundary |
|---|---|---|
| A PACS pre-write state and UID collision check | `PASS` | `artifacts/workstation/hcc-main-pacs-state-20261010-04/result.json`; source stack was absent before the first attempt, and the resumed import reconciled the one exact partial instance instead of blindly retrying |
| Full local DICOM manifest hashes | `PASS` | All 700 local files rehashed against canonical manifest `ca00be…1721` |
| A PACS import and raw-byte read-back | `PASS` | `artifacts/workstation/hcc-main-a-import-20261010-resume-08/result.json`; A only, 1 Study / 1 Series / 700 Instances, 2,202,766,342 bytes, all 700 PACS read-backs SHA-256 matched the manifest, strict mTLS QIDO succeeded, exact temporary staging was removed |
| B PACS | `NOT TOUCHED` | No B Study was loaded |
| Current cloud Control / ingress / PostgreSQL | `PARTIAL` | Control `sha256:11a23eea…c48b92b` and PostgreSQL `sha256:8d0e686f…4196568` healthy; ingress `sha256:9c210296…f0079cb` running without a configured healthcheck. Existing Compose context contains eight Control overlays, beyond the old promotion helper's accepted four-file or phantom-only layouts |
| HCC catalog and ownership in cloud DB | `NOT REGISTERED` | Read-only DB query: HCC patient/study/series/account/ownership/grant counts all zero; the existing synthetic phantom account is still ACTIVE. No rows were changed |
| Source verification required by HCC registration API | `BLOCKED` | Live Control has no `ORTHANC_REST_URL` or `ORTHANC_TLS_*_FILE` client identity. The catalog API calls `service.orthanc` directly, whose default is `http://hospital-a-orthanc:8042`; cloud Control is on internal Docker networks and currently has no A-source connection. Do not bypass `verifyHccSourceStudy` or enable an unverified registration path |
| Existing HCC image candidates | `NOT USABLE AS-IS` | `node scripts/verify-hcc-scenario-candidates.js` failed source attestation: the pinned UI image lacks current `public/ui/clinician-desk.css`. A fresh candidate build and exact image scan would be required before promotion |
| Current B browser | `NOT VERIFIED FOR HCC` | Existing `https://192.168.111.149:9443/hipass/` page is still the legacy patient surface (patient 1001/login); HCC catalog and 700-slice CT are not shown |

The sequence stopped before changing the cloud database or replacing a running application: the active registration guard cannot reach A, the pinned rollout helper rejects the active Compose context, and the old candidate image is stale. The next implementation unit is a narrowly scoped, authenticated A-to-Control source-verification contract plus a baseline-aware, exact-overlay promotion path. It must keep the current live PACS/DICOM hashes intact, preserve all existing overlays, and be locally tested before any activation. Only then can fixed HCC catalog registration proceed; patient ownership and the existing legacy-profile retirement remain separate gated operations with the established rollback-only preflight and durable backup. Do not enable `HIPASS_CAPSTONE_MAIN_SCENARIO=HCC` until those prerequisites and the explicit retirement flow are verified.

## CT quality candidate v2 — 2026-10-10 15:19 KST

The procedural generator was enhanced for visual texture/detail and a separate candidate was created. Work was performed in the DICOM source-generation pipeline (Codex), not by applying a web-only filter; web rendering is a later integration/display check.

- Generator: `highpass-synthetic-hcc-ct-v1.1.0`, quality profile `procedural-detail-v2`. Added tissue-dependent 3-D noise, kidney internal-region variation, synthetic pancreas/gallbladder landmarks, finer intrahepatic vessel branches, and a broader rib pattern.
- Source candidate: `artifacts/synthetic-hcc-ct/full-quality-v2-20261010`; 4 phases × 180 slices, 512×512, 378,678,692 bytes; manifest SHA-256 `7018a9e39db7f41369397adcdf101ca3b7fb57f9fd01a25d5d383680f1d5419c`.
- Hong Gildong presentation derivative: `artifacts/synthetic-hcc-ct/hong-gildong-56-quality-v2-20261010`; 4 phases × 180 slices, 720 total, 378,678,724 bytes; Study UID `2.25.88428559486573509465546607521290920862`; manifest SHA-256 `0b33d6de316f4f8c49d443fcb90361ab449f4a39a2a9e0d5c27221007019e989`.
- Pixel preservation from the quality source, age `056Y`, per-instance hashes, Study/Series/SOP UID consistency, 720-instance inventory, pixel decoding and synthetic-use declaration: `PASS` via the dataset validators. Candidate review remains `DRAFT / UNASSIGNED`.
- Existing v1.0 dataset and current website/PACS were not overwritten or modified. The current app catalog uses a different Study UID (`2.25.38106223936879966147659064930718777634`); this candidate is not imported, catalogued, deployed, or visible in the current web Viewer.
- The image is still a procedural synthetic phantom. Added texture/landmarks improve display resemblance only; they do not establish anatomical accuracy, diagnostic validity, or a confirmed liver-cancer finding. The presentation diagnosis remains scenario text only.
- Preview: `artifacts/synthetic-hcc-ct/full-quality-v2-20261010/preview/hcc_phase_comparison.png`. Candidate notes: `artifacts/synthetic-hcc-ct/hong-gildong-56-quality-v2-20261010/quality-notes.md` and `scenario.md`.

## Historical baseline: earlier Hong Gildong 720-instance scenario candidate — 2026-10-10 13:32 KST

The proposed Highpass scenario uses display alias **홍길동, 56세, 합성 환자**: A대학병원 CT → fictional liver-cancer diagnosis → B대학병원 referral. The diagnosis is a presentation setting, not an interpretation or validated finding in the generated pixels. Original 58-year-old data and historical test-PACS evidence below are preserved.

- New ignored dataset: `artifacts/synthetic-hcc-ct/hong-gildong-56-20261010`; 4 CT Series × 180 instances, 512×512; 378,672,576 bytes. Original pixels are preserved, age `056Y`; DICOM PatientName/PatientID remain synthetic. New Study/Series/SOP UIDs avoid overwriting original instances.
- Study: `2.25.38106223936879966147659064930718777634`; manifest SHA-256: `b10cf668a6c659a680810904db08ecf8b525faf2ab7af9d849c6f4849567a345`.
- Observed live images/readiness: `artifacts/workstation/hcc-scenario-inventory/result.json`; B fa5f382a…, Control 11a23eea…, A Gateway 30141f81… healthy. Ingress has no configured healthcheck. No live catalog, ownership or retirement write occurred.
- Final candidate UI: `sha256:88642cfe8253c0662aa5e6d0bd733528fc1059464a0969da3cf5ab727f9169ea`; Control: `sha256:b6c8954621413531ffbf8215a830e8d17c1faabac527b0fe89927a1ec55344ea`.
- Exact source binding: `artifacts/workstation/hcc-main-candidates/manifest.json`; 21 runtime files match each image. HEAD `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401` + dirty worktree; HEAD alone is not the candidate.

Implemented scope: fixed main-patient login; patient/clinician entry choice; mobile signed-session confirmation without simulated hardware biometrics; home referral steps wired to existing real self-view/share callbacks; scoped Series selection; backup-first retirement operator. Main mode rejects legacy login profiles and legacy patient principals server-side. Related FR-001–009/014–025/032–041; no security policy reduction or automatic consent. Explicit `HIPASS_CAPSTONE_MAIN_SCENARIO=HCC` remains off in live deployment until source/catalog/ownership are ready.

| Check | Result | Scope/evidence |
|---|---|---|
| Node regression | PASS | 896/896, 0 skipped; `artifacts/workstation/hcc-main-login/node-regression.log` |
| Final Security Gate | PASS | Unit + secret scan + production dependency audit. Earlier gate unit stage failed without retained individual diagnostics; that attempt remains FAIL. Later diagnostic regression and final gate passed; original failure cause unconfirmed |
| Chrome login | PASS | `artifacts/workstation/hcc-main-login/result.json` and patient/doctor/mobile screenshots; actual isolated component + real Mock IdP, fixed identity/role, wrong-key/old-profile refusal, no browser storage/URL token; **not deployed home/CT** |
| Real PostgreSQL reset | PASS | `artifacts/workstation/hp-hcc-reset-1abd06af221f/result.json`; rollback-only preflight, backup-failure rollback, registration, legacy suspension/revocation, preserved patient/Study rows, valid hash chain; owned tmpfs DB removed; **not live reset** |
| CT repeat validation | PASS | `prepare-hcc-main-scenario.py`: 720 instances/hashes/pixels plus each output age and original-pixel equality; Windows UTF-8 issue corrected |
| Final candidate Trivy | PASS | `artifacts/security/container-scan/hcc-main-ui-final-20261010.json` and `hcc-main-control-final-20261010.json`; exact image binding, HIGH/CRITICAL 0 for both |
| Live reset / CT / Key Vault flow | NOT VERIFIED | Not deployed/run with this dataset; old phantom PASS is not inherited |

### Activation/rollback sequence — not executed

1. Review exact candidate/source manifest, scan results and retirement scope; recheck current Compose/baseline. Do not reuse old approval manifests.
2. Import the fixed new Study into **Highpass A** only after UID-collision preflight; preserve existing instances, verify all raw hashes and strict mTLS QIDO/WADO. Separate test-PACS evidence below is insufficient.
3. Promote Control with HCC catalog opt-in **without main mode**, register through guarded API; stop Control writers, preflight fixed ownership registration, explicitly apply.
4. Mount a durable private host backup directory. Run `reset-capstone-patient-scenario.js` rollback-only, then explicit `--apply`; it requires `CAPSTONE_SCENARIO_BACKUP_DIR`, protected bootstrap password file, test/control-only profile and ready main ownership. Record backup hash with returned audit ID. Only P-1001/P-1002/P-1003/HP-TEST-PHANTOM-001 retire; no patient/Study/audit/PACS deletion.
5. Enable `infra/azure/capstone-hcc-main-scenario.compose.yml` and promote exact B candidate; readiness, source hashes, patient/clinician/mobile CT slices, existing Key Vault, consent/QR/denials and audit require new browser evidence.
6. Before retirement, restore old image/config on failure and do not enable main mode. After retirement, do not replay backup to silently reactivate old consents/tokens/QRs: they stay revoked. Ambiguous COMMIT requires reconciliation. Never use `down -v` or delete broad source data to repair a partial additive import.

All new evidence/candidates remain **DRAFT / UNASSIGNED**. Prior reviewer PASS does not approve this reset/dataset/deployment. No Hospital-B seed, live patient reset, deployment or full MVP/v3 completion is claimed.

## Dataset

The table below documents the original v1.0 baseline candidate; the v2 visual-quality candidate is recorded above and has a different manifest and Study UID.

The generated Full profile is a deterministic procedural test phantom. It is not derived from a person, a scanner, or a clinical dataset, and it is not a clinically validated HCC image.

| Item | Result |
|---|---|
| Profile / seed | Full / `20261010` |
| Study / Series / Instances | 1 / 4 / 720 |
| Matrix / pixel allocation | 512 × 512 / 16 allocated, 12 stored, unsigned |
| Transfer syntax | Explicit VR Little Endian |
| DICOM bytes | 378,674,372 bytes |
| Canonical manifest SHA-256 | `8a652efa7f1b2637eb6855fdf38d7b02c0c78ed4689c88986dee2363244f0c5d` |
| Dataset result | `PASS` for implemented structural, pixel, inventory, and hash checks |
| Clinical use | `NO` |

The external previews carry synthetic/not-for-clinical-use text. DICOM Pixel Data has no text overlay; each object declares `BurnedInAnnotation=NO`, `ImageType=DERIVED\SECONDARY\AXIAL`, synthetic identity fields, and a derivation notice. No birth date or private DICOM element is emitted.

## Test PACS checks

| Check | Result | Evidence / limit |
|---|---|---|
| A Orthanc health, TLS-authenticated QIDO, no host-published port | `PASS` | Existing read-only Orthanc preflight |
| B Orthanc health, TLS-authenticated QIDO, no host-published port | `PASS` | Existing read-only Orthanc preflight |
| HCC Study absent from A before seed | `PASS` | Filtered QIDO: 0 Study / 0 Series / 0 Instance |
| HCC Study absent from B before seed | `PASS` | Filtered QIDO: 0 Study / 0 Series / 0 Instance |
| A source has exact Study, 4 Series, 720 Instances | `PASS` | Post-seed filtered QIDO |
| A source WADO raw-byte read-back | `PASS` | 720/720 Instances and 378,674,372 bytes; every raw DICOM SHA-256 matched the manifest |
| B remains without this Study | `PASS` | Filtered QIDO after A source registration: 0 Study / 0 Series / 0 Instance |

The initial A seed command exited non-zero with `NOT VERIFIED` after reporting progress through batch 70 of 72; its final error stage was not retained. Post-command QIDO and a separate full 720-instance WADO/hash read-back establish the current A source state, but do not retroactively change that command's exit result. The data remains in the A **test** Orthanc. No B write was performed.

## MediQ product transfer

The exact 720-instance HCC Study transfer `A → MediQ WADO → temporary processing → MediQ STOW → B` is `NOT RUN`, not PASS. MediQ's latest recorded focused authenticated product-route run (§327 of its PACS-001 test evidence) is a scoped PASS for a different one-Study fixture: A WADO=4, B STOW=1, destination/integrity/provenance/audit/terminalization/purge/replay checks passed, and all six HTTP denials passed. That disposable run verified B EMPTY before and after cleanup; it did not move this HCC Study. The fixture seeder in the inspected MediQ worktree fixes its Study UID and three source instances, so that evidence cannot stand in for the 720-instance manifest.

The running MediQ API container was observed with `NODE_ENV=production`, `MEDIQ_ENV=development`, and `MEDIQ_RUNTIME_PROFILE=container`. In the checked source, the PACS import module is included only when `NODE_ENV=test` and `MEDIQ_TEST_P0_PRODUCT_API_ROUTE=true`; the live container keeps that test-only route disabled. MediQ's latest `npm run p0:verify` record (§328) is PARTIAL and did not reach the product HTTP stage. The older 2026-10-06 authenticated POST HTTP 500 remains historical evidence, superseded only for the later focused small-fixture route—not for this HCC transfer. No environment switch or application-code change was made.

Consequently, this run provides no HCC-specific evidence for MediQ authorization/consent/Grant admission, temporary encryption/purge, B import, destination hash, or end-to-end transfer performance. B remains untouched and empty for this Study. The next valid action is to extend the existing disposable PACS-001 product fixture to accept this exact manifest and authorized synthetic patient/consent/grant bindings, while retaining its existing test-only gate and independent destination verification. Do not enable the gate on the live API, seed B directly, or relabel source preparation as a transfer.

## Commands and checks

- `python -m py_compile scripts/generate_synthetic_hcc_ct.py scripts/prepare-hcc-main-scenario.py scripts/validate_synthetic_hcc_ct.py` using the temporary ignored venv — exit 0.
- `python scripts/generate_synthetic_hcc_ct.py --profile full --seed 20261010 --output artifacts/synthetic-hcc-ct/full-quality-v2-20261010` — exit 0; 720 instances, 4 Series, all pixel data decoded/validated; 378,678,692 bytes.
- `python scripts/prepare-hcc-main-scenario.py --source artifacts/synthetic-hcc-ct/full-quality-v2-20261010 --output artifacts/synthetic-hcc-ct/hong-gildong-56-quality-v2-20261010 --revision quality-v2-20261010` — exit 0; 720-instance presentation derivative, pixel equality to quality source and age metadata validated; 378,678,724 bytes.
- `python scripts/generate_synthetic_hcc_ct.py --profile full --output artifacts/synthetic-hcc-ct/full-seed-20261010 --seed 20261010` — exit 0.
- The default Python environment lacks `pydicom`; the first bare unittest invocation stopped at import (`ModuleNotFoundError`), so that run is `ENVIRONMENT BLOCKED`, not a code-test failure.
- With the temporary ignored runtime added only to `PYTHONPATH`, `python -m unittest discover -s test -p 'synthetic_hcc_*test.py' -v` — 9 tests passed (exit 0).
- With the same `PYTHONPATH`, `python scripts/validate_synthetic_hcc_ct.py artifacts/synthetic-hcc-ct/full-seed-20261010` — exit 0; 720-instance structural, pixel, and hash validation.
- PowerShell parser check for `scripts/run_synthetic_hcc_orthanc.ps1` — `PASS`.
- MediQ's existing focused product-route evidence (§327) — scoped PASS for its three-instance fixture only; not run with the HCC Study.
- MediQ's most recent aggregate `npm run p0:verify` record (§328) — PARTIAL; database-scratch timeout, product HTTP stage not reached.
- `pwsh -NoProfile -File scripts/run_synthetic_hcc_orthanc.ps1 -Mode preflight -Hospital A|B ...` — A/B Study-absence preflight.
- A seed wrapper — exit 1 / `NOT VERIFIED`; subsequent A-only `verify` wrapper — exit 0 / 720 raw hashes matched.

All generated DICOM/preview assets and the temporary local pydicom runtime are under ignored `artifacts/`. No MediQ application code, persistent database, B PACS, commit, push, or merge was changed.

## Historical Highpass web-view integration checkpoint for 720-slice candidate (2026-10-10)

This checkpoint described the **previous** 720-instance candidate and is retained as history. It has been superseded by the selected 700-instance source recorded at the top of this document. At that checkpoint, the source code had an opt-in fixed-catalog path and a patient self-viewer path that requests a separate, server-authorized, single-Series `VIEW_ONLY` Grant. The HCC login profile is fixed to the synthetic patient subject; it cannot accept a caller-supplied identity. Catalog registration is disabled unless the capstone test profile is explicitly enabled, the caller is a Hospital-A security administrator, and Orthanc QIDO confirms the exact Study, four named CT Series, and 720 unique SOP Instance UIDs. The separate patient-ownership registration tool defaults to rollback-only and requires explicit `--apply`; it does not create consent or claim clinical interpretation.

These are **source-code and focused-test results only**. The current deployed patient website still does not list this CT. The inspected Highpass A source PACS and Highpass metadata catalog did not contain this Study; the HCC DICOM inventory described above is a separate test-PACS result, not proof of Highpass A availability. No Highpass PACS import, catalog/ownership write, image build, or deployment was performed. Therefore browser display of this HCC CT is `NOT VERIFIED` and must not be presented as complete.

Focused verification on the current worktree: the HCC catalog, mock-IdP gating, patient ownership registration, self-view authority, and pixel viewer test set passed 29 tests; the edited JavaScript files passed `node --check`. This does not verify deployment, Key Vault integration for this dataset, the live website, or clinical usefulness. Evidence remains `DRAFT / UNASSIGNED`; the dataset is synthetic and not clinically validated.

That historical candidate's next operation was superseded. To make the newly selected 700-instance CT visible, first apply the preflight, hash-verification, catalog/ownership registration and browser verification sequence described at the top; the old 720-instance operation must not be run against the new main scenario. Keep Hospital-B/production PACS untouched unless separately approved. Do not change DICOM identity fields to a real-person identity or label the selected image as a confirmed diagnosis.

## Highpass A/B test PACS DICOM cleanup — 2026-10-10

The user requested removal of all previously registered DICOM from Highpass A/B. A fresh role-pinned VM inventory was taken before mutation. The operation was limited to the Highpass A/B VMware test VMs; local Windows Docker stores, the separate MediQ project, cloud Control Plane/database, catalog/ownership metadata, and audit records were not touched.

| Role | Preflight | Action | Postcondition |
|---|---|---|---|
| Hospital A | Exact Highpass A Orthanc container, image, private PACS network and named volume identified. Strict mTLS QIDO returned exactly the five allowlisted synthetic fixture Studies: 6 Series / 28 Instances. Normal mTLS and no-certificate, wrong-issuer, wrong-SAN, wrong-EKU, expired and bad-client denials passed. | Deleted the five exact Orthanc Studies through the A service boundary; did not remove the container or volume. | Orthanc REST: 0 Studies / 0 Series / 0 Instances. mTLS QIDO: 0 Studies. `PASS`. |
| Hospital B | Full VM container inventory contained only the B portal; no Orthanc/PACS container or storage volume was present. | No deletion needed. | B portal remains running; no B DICOM store found. `PASS` for the scoped inventory. |

Removed Study UIDs: `1.2.410.0.1.20260518.002`, `1.2.410.0.1.20260620.001`, `1.2.826.0.1.3680043.10.5432.20260908.1001.1`, `1.2.826.0.1.3680043.10.5432.20261009.1`, and `1.2.826.0.1.3680043.10.5432.20261009.2`. Full counts and verification are in `artifacts/workstation/highpass-dicom-cleanup-applied-20261010/result.json`. The source Orthanc named volume remains mounted but contains zero Studies/Series/Instances. No DICOM payload backup was made, as requested. The new record is `DRAFT / UNASSIGNED`; this cleanup is not an application-flow or MVP completion claim.

Security follow-up: the current `orthanc-mtls-proxy.js` transparently forwards arbitrary HTTP methods. This authorized cleanup used that mTLS path; restrict proxy methods and routes to the required DICOMweb read operations before any further deployment. No proxy source or runtime image was changed as part of this deletion.

## Reference-anchored 700-slice CT display candidate — 2026-10-10

The user confirmed that the ten unique reference PNG images are fully synthetic and nonclinical. Four of the fourteen attached files were exact pixel duplicates; the generator consumed the ten unique images in the order shown in the request. It did not copy the source PNGs into the dataset and did not modify or delete any prior dataset.

- Generator: `scripts/generate_reference_anchored_synthetic_ct.py`, version `highpass-reference-anchored-ct-v1.0.0`; focused tests: `test/reference_anchored_synthetic_ct_test.py`.
- Method: exact 8-bit grayscale anchor planes are embedded at output instances 1, 79, 156, 234, 312, 389, 467, 545, 622, and 700; intervening planes use monotone piecewise-cubic (PCHIP) pixelwise z interpolation. No cyclic repetition or independent per-slice image generation is used.
- Candidate: `artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010`; 1 CT series, 700 instances, each 1254×1254, 2,202,766,342 DICOM bytes. Study UID `2.25.259656708708993797343330994179169711072`; manifest SHA-256 `ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721`.
- All 700 pixel payload hashes and SOP Instance UIDs are unique; the ten anchors are preserved exactly after documented grayscale-to-16-bit scaling. Every DICOM Pixel Data array was decoded and checked. Focused generator tests: 4/4 PASS; existing synthetic CT regression tests: 7/7 PASS; full candidate validator: PASS. Evidence: `validation-full-pixels-20261010.json`; visual contact sheet: `preview/reference-anchored-700-contact-sheet.png`.
- Values are display luminance encoded in DICOM with `RescaleType=US`, not HU. Pixel and slice spacing are synthetic display coordinates, not source acquisition geometry. Interpolating ten 2D images creates no new scanner information and does not validate a clinically accurate 3D anatomy. The DICOM series is only an axial-slice display fixture; clinical use, diagnosis, and HU-calibrated interpretation are prohibited.
- All DICOM objects carry `DERIVED\SECONDARY\AXIAL\SYNTHETIC`, synthetic patient fields, and explicit nonclinical derivation/disclaimer text. The output and new evidence remain `DRAFT / UNASSIGNED`.
- No PACS import, catalog/ownership registration, Viewer/browser integration, cloud storage, or deployment was performed. Actual OHIF/Highpass rendering and clinical-geometric MPR behavior remain `NOT VERIFIED`; this candidate has not replaced the existing Hong Gildong scenario in the application. `dciodvfy` was unavailable, so formal DICOM IOD conformance is also `NOT VERIFIED`; the PASS above is limited to pydicom parsing, metadata/UID/order/hash checks, and full Pixel Data decoding.
