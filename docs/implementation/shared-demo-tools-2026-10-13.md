# Shared Patient and Clinician Demo Tools

## Scope

One right-hand dialog is opened by matching patient and clinician header buttons.
The patient wallet remains unchanged. The old bottom-left role selector stays
hidden as a compatibility container; it is no longer an exposed alternate UI.
The clinician module path is a compatibility export, not a second controller.

Related requirements: FR-001~005 (existing consent actions), FR-010~025
(preserve identity, scope and token policy), FR-037~041 (admin audit navigation).
No backend authorization, API, database or deployment configuration is changed.

## Selection and Permissions

The app passes the selected Study, Series and selected consent into the panel.
No table-first-row lookup is used. Patient identity and allowed Study scope must
match before consent context is shown. A failed snapshot clears displayed context.
Consent status does not assert access authorization or transfer completion.

Patient menus link to existing records, sharing and history screens. Doctor menus
link to records, QR reception, transfer results and the security journey. Audit
and operational navigation require administrator roles in the UI model; all API
checks remain in the backend. Missing roles do not default to privileged access.
Only loopback synthetic development offers the existing dual-persona UI fallback.

Unknown and public hosts use the restricted public menu. The known private B host
retains internal demo navigation. These are conservative UI capability hints, not
network authorization or proof of runtime availability. Unsupported items include
an explanation and cannot execute through the shared action dispatcher.

QR simulation additionally requires internal environment, patient and doctor roles,
a current ACTIVE consent, and explicit confirmation. The dispatcher rechecks role,
selection and consent after confirmation. It discards cached ticket selection and
uses the existing server ticket path. Cancellation performs no mutation. Emergency
override is excluded from the shared panel; its backend implementation is unchanged.

## Accessibility

Native modal dialog, labelled triggers, expanded state, visible focus, keyboard
focus cycling, Escape dismissal and trigger focus restoration are included.
The existing reduced-motion rule remains. Long UIDs and consent details wrap in
an expandable details section instead of dominating the primary panel.

## Files

- New: `public/ui/demo-tools.js`, `test/demo-tools.test.js`,
  `scripts/check-demo-tools.js`, this document.
- Updated: `public/app.js`, `public/index.html`,
  `public/ui/clinician-demo-tools.js`, `public/ui/clinician-demo-tools.css`.
- Updated checks: `scripts/clinician-bundle-browser-check.js`,
  `scripts/clinician-preparation-release.py`,
  `test/clinician_ui_management_test.py`.
- The legacy clinician-only tools deploy path now stops before authentication:
  shared app changes require a complete frontend release, not a partial overlay.
- Concurrent login, clinician workspace and helper changes were preserved.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Related Node regression tests | PASS | 89 passed, 0 failed |
| Clinician Python regression tests | PASS | 15 passed |
| JS parse | PASS | `node --check public/app.js` |
| Shared dialog and role menus | PASS | Local Chrome, 1440/390/320px |
| Tab, Escape, focus restoration | PASS | `scripts/check-demo-tools.js` |
| Overflow and page exceptions | PASS | None at the three tested widths |
| Cancellation and changed-selection guard | PASS | Injected action/confirmation unit tests |
| Actual QR ticket mutation | NOT VERIFIED | No ticket issued by this validation |
| Azure authenticated patient/doctor workflow | NOT VERIFIED | Deployment completed; no real account login |

Screenshots and browser results: `output/playwright/shared-demo-tools/`.
An initial browser test found Tab focus escaping; explicit wrap-around fixed it.
One Python test attempted to replace obsolete heading copy, changing nothing;
it now asserts and changes the actual clinician context attribute before comparing
release identities. Both suites were rerun after these corrections.

## Release State

Deployed to `https://highpass-demo.japaneast.cloudapp.azure.com/` on 2026-10-13.
The dedicated `/mobile/` app is preserved, including its latest login and layout
changes. The shared panel is in the patient/clinician web app, not a new mobile menu.
No private B VM deployment, commit or push was performed.
The complete backend/security E2E suite was not run. Do not interpret UI menu
visibility checks as authentication, authorization or medical workflow proof.

### Azure Evidence

Evidence directory: `artifacts/workstation/shared-demo-tools-20261013-r3/`.
Release: `c7e6e24a1b9d30d7e341f610d69ef16700ff5b7a8da21810ab57f67b857962e4`.
Image: `sha256:a19a8b43e69e44e3c633cdc66c14e1f6c9b0dd74b0e878e899fcebb361a300e8`.

Two earlier attempts stopped before mutation because concurrent deployments
changed the pinned baseline. After the user requested waiting, both related
deployment tasks were confirmed complete. The latest Azure public tree was
captured and only the five shared-panel app/HTML/module/style files were overlaid.
Unrelated new local clinician styling was excluded.

The latest base contained 429 layers and BuildKit failed with `mount options is
too long`. Export/import consolidated the baseline before rebuilding. Linux
runtime settings were retained; only legacy Windows `ArgsEscaped` metadata was
omitted, as described by the [OCI image specification](https://github.com/opencontainers/image-spec/blob/main/config.md).
The 639 non-public application and Node runtime files matched the original hashes,
including tar hardlinks. The original running image remains the rollback target.

| Deployment Check | Result | Evidence |
|---|---|---|
| Targeted Node regression rerun | PASS | 39 passed |
| Clinician Python regression rerun | PASS | 15 passed |
| Runtime file preservation | PASS | `runtime-parity.json`, 639 files |
| Final image Trivy scan | PASS | Critical 0, High 0; exact image ID checked |
| Azure activation and rollback rehearsal | PASS | `deployment-result.json` |
| WAF and Control containers unchanged | PASS | Container identity checks |
| Public asset parity | PASS | 117 files, no differences |
| Web patient/doctor and mobile login entry | PASS | Chrome screenshots; HTTP 200, no page errors/overflow |
| Unauthenticated boundaries | PASS | Imaging studies 401; DICOMweb/access request 403 |
| Authenticated shared-panel workflow on Azure | NOT VERIFIED | No account interaction; authentication was not bypassed |

Public checks: `public-verification.json`. Rollback overlay on Azure:
`/home/highpassadmin/.highpass-shared-demo-tools-20261013-r3/rollback.json`.
