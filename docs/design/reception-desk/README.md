# Reception Desk Renewal - 2026-10-14

## Purpose and Requirements

Apply the approved reception-desk concept without changing the clinician sidebar,
four-step workflow, caller-scoped reception API, consent policy, token issuance,
audit logic, or PACS transport.

Related groups: FR-010 through FR-013 (clinician access workflow), FR-014 through
FR-020 (accurate consent/access state presentation), FR-032 through FR-036
(existing viewer entry). No API contract or database changes.

## Design and Assets

- Approved reference: `approved-concept-v1.png`. Reference numbers are not live data.
- Original illustration: `public/assets/reception/medical-share-card-v1.png`.
- Web-optimized derivative: `public/assets/reception/medical-share-card-v1.webp`.
  480x320, transparent WebP, 22,270 bytes instead of the 1,775,456-byte original.
- Summary: actual returned QR reception count, valid consent count, recheck count.
- Glass effect is restricted to the summary strip. Patient data remains readable.
- Search filters the list without silently selecting another patient's context.
- Selected rows use a teal rule and pressed state; status also has text and symbols.
- Detail separates consent validity from image receipt. Receipt remains unconfirmed
  because this API does not return verified PACS import evidence.
- Decorative acrylic cards contain no patient scans, QR credentials, or real people.
- No automatic token issuance, image download, consent creation, or new permissions.

## Changed Files

- `public/ui/clinician-reception-desk.js`
- `public/ui/clinician-reception.css` (desk styles only; QR scanner styles preserved)
- `public/assets/reception/medical-share-card-v1.png`
- `public/assets/reception/medical-share-card-v1.webp`
- `test/clinician-reception-desk.test.js`
- `scripts/reception-desk-ui-rollout.py`
- `scripts/reception-desk-preview-server.js` and `scripts/fixtures/reception-desk-preview.*`

Preview fixtures are synthetic and are not included in the Azure deployment.

## Security Review

DOM content uses textContent, not HTML interpolation. Missing, revoked, expired,
future or invalid-date consent hides study actions; action clicks recheck validity.
Identity reset invalidates pending UI requests and prevents delayed navigation.
Server authorization remains authoritative. No secrets, real patient data, network
policy, TLS configuration, encryption paths, or paid resource provisioning changed.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Focused desk/reception/preparation/public-connection tests | PASS | 19 tests passed |
| Existing synthetic CT/MR viewer preview tests | PASS | 5 additional tests passed |
| Additional legacy share-reception tests | FAIL | 3 tests still assume older QR flow; fixture lacks current dependencies and expects direct Viewer navigation. No app.js changes in this task. |
| Synthetic browser search, row selection, unavailable consent | PASS | Local synthetic fixture, same runtime desk module |
| Synthetic mobile horizontal overflow | PASS | 390px viewport; document scrollWidth equals clientWidth |
| Azure current-image overlay and health | PASS | Existing web container returns HTTP 200; ports/security settings preserved |
| Azure externally served JS/CSS/WebP bytes | PASS | SHA-256 matches local final files over HTTPS |
| Azure optimized image decode | PASS | Inside the actual reception desk: complete=true, natural dimensions 480x320; visible acrylic folder/shield |
| Azure normal clinician login and new desk mount | PASS | Normal Microsoft synthetic DOCTOR login; reception menu mounts new UI |
| Azure reception data | PASS | Actual caller-scoped 22 rows: 3 valid, 19 requiring recheck; CT search returns 3 rows |
| Azure detail-action navigation | PASS | Selected reception opens existing authorized-study preparation screen; no auto image grant |
| Azure mobile viewport | NOT VERIFIED | Browser viewport override did not apply to the Azure tab; synthetic mobile fixture verified separately |
| B portal optional asset synchronization | NOT VERIFIED | Snapshot failed before rollout; no B runtime changed |

Azure release evidence:
`artifacts/workstation/reception-desk-ui-dbf4e5d3d5f747a18dbde7258acc369e/result.json`.
The release uses the current running image as its base and overlays exactly the
three runtime files. Root-owned before/after Compose snapshots support rollback.

Public entry: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR
Select the reception-desk menu after clinician login. New Azure resources: none.

Final Azure screenshot: `azure-reception-desktop.jpg`.
`azure-viewport-check-desktop.jpg` records the earlier viewport attempt, not a
mobile verification. The temporary local preview server was stopped after QA.

## Remaining Risks and Unverified Items

The three older share-reception tests need a separate fixture/workflow update;
their failure is not reported as a successful integration test. B portal asset
synchronization failed during the initial snapshot and was not deployed. The
Azure desktop design is verified; Azure mobile is not yet independently verified.
No claim of complete end-to-end medical workflow validation is made for this
visual change. Previously verified A-to-B import configuration was not changed.
