# Patient Imaging Focus Workspace - 2026-10-14

## Work Purpose

Apply the approved dark/teal clinician imaging concept to the existing Azure web
without replacing the medical imaging engine or changing authorization.

## Related Requirements

FR-010 through FR-013: clinician access workflow.
FR-014 through FR-020: consent and server authorization remain authoritative.
FR-032 through FR-036: viewer, series selection, protected pixels and navigation.
No API contracts, database models, token lifetime or Gateway policies changed.

## Existing Structure

`public/app.js` relocates the same `.mq-viewer-shell` between preparation and
fullscreen viewer. `initializeViewerStudio` binds presentation controls and calls
the existing authorized `openViewer` callback. Preparation contains study filters,
dossier, health-record guidance, selected-study activity and consent details.

## Created Files

- `test/imaging-focus.test.js`: node relocation, idempotence and presentation contracts.
- `scripts/imaging-focus-preview-server.js`: loopback-only, no-API synthetic layout fixture.
- `docs/design/imaging-focus/approved-concept-v1.png`: approved design reference only.
- This report and QA screenshots.

## Modified Files

- `public/ui/viewer-studio.js`: rearrange already-bound preparation nodes and
  collapse the inspector automatically when the viewport becomes narrow.
- `public/ui/viewer-studio.css`: teal tools, selected series, dark glass topbar,
  readable inspector, focus outlines and responsive controls.
- `public/ui/clinician-preparation.css`: dark preparation workspace, large central
  viewport, left study list, right dossier and collapsible supporting records.
- `scripts/reception-desk-ui-rollout.py`: optional scoped viewer-focus file set.

## Implemented Behavior

Existing menu/workflow, filters, consent dialog and viewer callbacks are retained.
Patient details and access actions stay explicit. Supporting health/sequence/
activity sections use native details/summary. Desktop inspector starts open;
narrow screens close it automatically, while the information button can reopen it.
Long study names wrap without widening the list. Compact tool geometry is stable.

Only actual available series and existing tools are shown. The mock CT image,
fictional MPR planes, measurements and mock authorization states are not used as
runtime content. No synthetic scan is injected to disguise an access failure.

## Security Review

The protected viewport and controls are moved, not cloned. New code has no fetch,
token generation, secret storage, HTML interpolation or permission decisions.
The existing openViewer callback, server checks, download restrictions, watermark,
audit flow and encrypted A/B storage are unchanged. No new Azure resources or
public ports were created. Only the three public presentation files were deployed.

## Test Results

| Test | Result | Evidence |
|---|---|---|
| Focus/viewer/navigation/preparation/preview/public-connection/reception tests | PASS | 29 tests passed, including denied/revoked synthetic token coverage |
| Synthetic desktop layout | PASS | 1536px viewport, three tracks, document width equals scroll width |
| Synthetic mobile layout | PASS | 390px viewport, no document horizontal overflow |
| Narrow-screen inspector | PASS | Inspector closes on resize; viewport remains visible |
| Azure current-image overlay and health | PASS | HTTP 200; existing image base and security/port configuration preserved |
| Azure external asset hashes | PASS | Final local JS/CSS match HTTPS-served files |
| Azure authenticated selection, preparation and supporting details | PASS | Normal synthetic DOCTOR login, selected approved CT, health section expands |
| Final Azure desktop and mobile layout | PASS | At configured 1536px/390px: document client/scroll widths match (1521/1521 and 375/375); study list widths match (186/186 and 326/326); exactly one protected image node |
| Azure token and series retrieval | PASS | Time-limited token countdown and one real returned series shown |
| Azure CT instance/pixel retrieval | FAIL | Access failure displayed after series retrieval; retry did not show pixels |
| Real-patient or clinical validation | NOT VERIFIED | Out of MVP scope; no real patient data used |
| Live Azure MRI pixels | NOT VERIFIED | No live Azure MRI retrieval performed in this task |

## Remaining Risks

The actual Azure CT instance request failed during this visual task. Its cause is
not established. No claim is made that it predates this change. No access-control
bypass or backend change was used to make the design appear successful. Dedicated
Gateway/token/scope diagnostics are needed before claiming successful live pixels.

## Deployment and Evidence

Azure: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR
Choose Patient Imaging after clinician login, or choose the reception's study.

Final release:
`artifacts/workstation/reception-desk-ui-a42f5b958f8a490d81427faa57451085/result.json`.
The root-owned release contains before/after Compose snapshots for rollback.
B portal and other backend services were not redeployed by this task.
Temporary synthetic preview server was stopped after QA.

Final screen evidence: `azure-preparation-desktop.jpg` and
`azure-preparation-mobile.jpg`. `azure-viewer-access-state.jpg` records the
observed access failure rather than successful scan rendering.
