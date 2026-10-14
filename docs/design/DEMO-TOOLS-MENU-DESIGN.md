# Shared Demo Tools Menu

Date: 2026-10-13 KST.

## Purpose and Scope

Refine the shared patient/clinician drawer without changing capabilities or APIs.
Related requirements: FR-001~005 (consent presentation), FR-010~025 (identity,
scope and access restrictions preserved), FR-032~036 (navigation and failure
feedback), FR-037~041 (existing administrator navigation). Accessibility and
responsive behavior are verified below; no unconfirmed NFR ID is assigned.

## Design

- Group menus into scenario progression, security explanation, administrator
  tools, navigation and execution. Administrator entries still require their
  existing role; public-only restrictions move into a collapsed section.
- Reuse the existing patient UI icon helper. No icon package or remote asset is
  introduced. Use one-column rows, dividers and an explicit current-page marker.
- Summarize the selected examination, patient reference, hospital route, consent
  and permission. Keep UID, purpose and validity inside disclosure details.
- A valid consent is never shown as proof of access approval or image receipt.
- Retain execution confirmation and state/role revalidation. No automatic QR
  ticket, token, consent, download or other mutation is introduced.
- Keep drawer geometry independent of clinician glass styling. Preserve native
  dialog behavior, focus containment, Escape, focus return and reduced motion.

## Files

Updated: `public/ui/demo-tools.js`, `public/ui/clinician-demo-tools.css`,
`test/demo-tools.test.js`, `scripts/check-demo-tools.js`.
Created: this document. Deployment receipts remain in the ignored workstation
artifact directory; no keys, credentials or clinical images are added.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Related Node regression tests | PASS | 35/35 |
| Clinician Python regression tests | PASS | 15/15 |
| JS parse | PASS | `node --check public/ui/demo-tools.js` |
| Patient and doctor drawer at 1440/390/320px | PASS | Chrome screenshots and assertions |
| Focus, Escape, current page, icons and overflow | PASS | `scripts/check-demo-tools.js` |
| Public restricted groups and disabled actions | PASS | Isolated synthetic UI fixture, not live authentication |
| Administrator menu exclusion | PASS | Role model tests and UI fixture |
| Confirmation/state-change guard | PASS | Existing tests retained |
| Image scan | PASS | Exact candidate image, Critical 0 and High 0 |
| Azure deployment and rollback rehearsal | PASS | `deployment-result.json`; WAF/Control unchanged |
| Public asset parity | PASS | 120 files, zero differences |
| Web patient/doctor and mobile login entry | PASS | HTTP 200, no page exceptions or horizontal overflow |
| Unauthenticated boundaries | PASS | Imaging studies 401; DICOMweb/access request 403 |
| Azure authenticated drawer workflow | NOT VERIFIED | No real account login; authentication not bypassed |
| Actual QR mutation/full backend E2E | NOT VERIFIED | Not executed for this visual change |

Screenshots: `output/playwright/shared-demo-tools/`. Initial visual inspection
found clinician CSS forcing two columns and narrow labels; drawer-specific
selectors restored a shared single-column layout. The smallest layout puts the
execution confirmation marker below the label. Checks were rerun after fixes.

## Azure Boundary

Evidence: `artifacts/workstation/demo-menu-design-20261013/`.
The complete public tree is captured from the pinned running Azure image; only
the shared drawer JS and CSS are replaced. This preserves concurrent login,
mobile, clinician and security-journey changes. The deployment checks baseline
identity, exact image scan, unchanged runtime settings and protected containers,
and rehearses rollback. No commit/push or private VM deployment is requested.

Deployment completed and public checks passed at
`https://highpass-demo.japaneast.cloudapp.azure.com/`.
Release ID: `934eb515458f2f8b0195f3f0ed571fc3157f77e19ea94dd2864eb25d800cfa09`.
Image: `sha256:2093989494c03fbf9a936586b63de551a28e7fe837baac02172e09c53ec31a22`.
Remote rollback overlay:
`/home/highpassadmin/.highpass-demo-menu-design-20261013/rollback.json`.
