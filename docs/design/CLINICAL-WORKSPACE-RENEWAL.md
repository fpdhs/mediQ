# Clinical Workspace Renewal

Date: 2026-10-13 KST. Scope: all clinician menus plus existing Azure public-web deployment.

The shared design uses the patient portal's Pretendard typeface and blue primary
actions, with a clinical list/detail workspace. Folder tabs and short transitions
provide visual continuity. CT and MR badges retain text labels as well as distinct
colors. Existing consent, token, gateway, audit and server authorization contracts
are unchanged. Workflow navigation opens screens; it does not grant access or
automatically submit a transfer.

| Screen | Treatment |
| --- | --- |
| Clinical home | Searchable request queue and blue-tab selected dossier |
| Patient records | Green-tab list/detail layout and explicit unavailable states |
| Study selection | Shared headings, compact inspection panels and existing protected preview |
| Viewer | Full-width dark viewport, readable light context bar, original protected controls |
| Sharing reception | Cyan workflow strip, aligned input and server-result columns |
| Hospital storage | Amber conditions/result sections and consistent inventory filters |
| PACS reception | Shared typography, receipt and tracking layout |
| Exchange journey | Existing eight illustration assets, common headings and restrained framing |
| Audit | Aligned filters, event list/detail and integrity disclosure |
| Platform/security | Consistent operational sections, status labels and controls |

Implementation: `public/ui/clinical-workspace.css`, stylesheet reference and
clinician root in `public/index.html`, modality badge data in
`public/ui/clinician-home.js`, and screen titles in `public/app.js`.

Related requirements: FR-010 through FR-013, FR-014 through FR-025, FR-032 through
FR-041. No API contract or NFR identifier has been added or changed.

Validation: 33 focused clinician, denial, reception, storage, audit presentation,
and multi-slice tests passed. Another 18-test run included patient sharing
regressions (overlaps the clinician tests). Local synthetic browser checks covered
all ten screens at desktop and 390px with no document horizontal overflow. No
browser console errors were observed. Patient records in the full local app used
the login-required state, not an authenticated record retrieval. Actual public
Entra login and public CT transmission are not implied by these checks.

Screenshots and geometry observations are under
`artifacts/ui/clinical-workspace-20261013/`. The isolated local test server uses
its own synthetic JSON database under that directory, listening on loopback only.

Azure promotion is performed with `scripts/clinical-workspace-release.py` using
the observed existing web image as its base. It preserves patient HTML and all
unrelated image layers, checks that shared-controller changes are limited to
screen metadata, requires a matching fresh vulnerability scan, changes only the
web service, verifies served clinician files over HTTPS, and rolls back on parity
failure. Each captured candidate has a manifest and deployment receipt under
`artifacts/azure/clinical-workspace-*`; a built candidate alone is not a deployment.
Public networking, identity configuration, Control, PostgreSQL, WAF and PACS are
not modified by this release process.

## Azure Release Result

Deployment: PASS. Public entry:
https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR

Promoted image:
`sha256:189ba42b9dfb0e8c76dee6719f192751bc6031f43473cd526d97b84ea602d17b`.
Receipt: `artifacts/azure/clinical-workspace-20261013T073344389456Z/deployment.json`.
Trivy evidence: `artifacts/security/container-scan/clinical-workspace-release-20261013.json`.
The exact promoted image reported zero HIGH and zero CRITICAL vulnerabilities.

Two earlier promotion attempts stopped before replacement because another
deployment changed the baseline web image. The successful candidate was rebuilt
on the latest image, preserving those concurrent changes. No baseline guard was
bypassed. HTTPS verification passed for the clinician HTML region and all three
modified assets. Existing web environment, mounts, ports and read-only setting
were preserved; Control, PostgreSQL and WAF container IDs were unchanged.

Authenticated public record retrieval and end-to-end CT/MRI transmission remain
NOT VERIFIED in this UI release. No account, authorization policy, network
exposure or public DICOM capability was added to make a UI test pass.

Post-deployment browser check: PASS for HTTPS entry, clinician role navigation
and the Microsoft sign-in entry screen. No browser console errors were observed.
Screenshot: `artifacts/ui/clinical-workspace-20261013/azure-login.png`.
The authenticated Microsoft account flow was not completed.
