# Patient Wallet Experience Release

## Scope

Retain the home wallet artwork and the exact four-card geometry across patient
home, records, sharing review, image sharing and health helper. Paper task
surfaces use the corresponding blue, ivory, lavender and green card colors.
Typography, controls, focus outlines and responsive spacing are shared. Home
suggests one next action from loaded records and currently valid consents; it
does not claim that a hospital received or viewed an image.

Related requirements: FR-001 through FR-005 (consent workflow preservation),
FR-006 through FR-009 (record navigation). No API, database, access-policy,
token or audit contract changes. No new overall NFR compliance claim.

## Files

- New: `public/ui/patient-wallet-experience.css`.
- Updated: `public/ui/wallet-home.js`, `public/index.html`.
- Tests: `test/wallet-home.test.js`, `test/patient-sharing.test.js`.
- The sharing cache assertion now checks the versioned/content-addressed cache
  naming contract instead of requiring the obsolete literal version v39.
- Existing concurrent Entra login and health-helper changes remain intact.

## Verification

PASS: 75 tests across wallet-home, patient-wallet-dock, patient-sharing,
patient-helper, patient-share-review, mobile-wallet-design, wallet-open,
login-navigation, entra-redirect-login, entra-browser-auth,
capstone-login-preflight, mobile-capstone-auth and web-release test files.

PASS: Chrome screenshots and navigation at 1440px and 390px; four task routes,
matching home/dock card styles and artwork, current-page indicator, no horizontal
page overflow and no JavaScript page exceptions. Screenshots use local synthetic
data, not an authenticated Azure account.

PASS: candidate image configuration equals the observed public-web baseline;
115 captured static assets match image contents. Trivy High 0, Critical 0 for
the exact candidate image. The initial Docker build exceeded 180 seconds;
retry completed using the unchanged captured asset tree.

## Azure Deployment

Status: DEPLOYED; static release verification PASS. Authenticated acceptance
remains NOT VERIFIED, with the user explicitly deferring login verification.

Web: https://highpass-demo.japaneast.cloudapp.azure.com/

Mobile: https://highpass-demo.japaneast.cloudapp.azure.com/mobile/

Release ID: `0ae54daecb9b376b70f31167f016e73a84072981e726b6feee742cf74d1b12cf`.

Candidate image: `sha256:93d5c6b180db652434be7dea31ac517468c107371fd84044309969042cf8cd3d`.

Rollback image: `sha256:842b1248e41eb1969e63f92ef15dec30992337fded19c2a9363de70617063efd`.

Evidence directory: `artifacts/workstation/wallet-experience-20261013/`.
This uses the existing pinned-SSH VM/Compose image-only release procedure,
not azd provisioning. Only the public web container is eligible for recreation;
Control, WAF, network membership, TLS, secrets and mount paths must be preserved.
Web and mobile are captured together with a content-derived PWA cache version.
The standalone mobile PWA keeps its existing layout; the new task-surface CSS is
scoped to the responsive patient web portal.

PASS: candidate activation, rollback to the observed baseline and reactivation.
Control and WAF container identities remained unchanged. Runtime environment,
mounts, user, entrypoint, network membership and security flags were preserved.

PASS: public HTTPS comparison of all 115 files, zero differences, including the
known public server HTML marker/banner. Web patient, web doctor and mobile login
entry screens return 200 with no page exceptions or horizontal overflow. Each
uses the existing Microsoft login button without a visible password field;
brand links retain `/hipass/` and `/mobile/` respectively.

PASS: unauthenticated imaging API returns 401; public DICOMweb and access-token
request routes return 403. No public clinical route was enabled by this release.

The first public UI assertion failed because it expected a superseded one-step
Entra button. Inspection confirmed the preserved two-step role entry followed by
Microsoft login. The verifier now exercises that flow for patient and doctor;
the rerun passed. Both initial and final receipts are retained. This correction
does not count as evidence of successful account authentication.

Recovery uses the original Compose file from
`public-baseline.json` and the image-only overlay
`/home/highpassadmin/.highpass-wallet-experience-20261013/rollback.json`.
The actual candidate-to-baseline-to-candidate rehearsal is recorded in
`deployment-result.json`; served assets and denial checks are in
`public-verification.json`.

## Limitations

NOT VERIFIED: real Entra patient/doctor login through callback and authenticated
public sharing/revoke/viewer regression; installed-device PWA upgrade behavior;
private hospital B deployment. No authenticated public success is inferred from
local synthetic UI tests. Public DICOM/pixel routes remain intentionally blocked.
This is a UI release, not production qualification or a new backend deployment.
The complete repository test suite was not rerun for this scoped change.
