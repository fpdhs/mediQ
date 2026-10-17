# Mobile Entra home transition

Review: DRAFT / UNASSIGNED. Date: 2026-10-13 KST.

## Purpose and confirmed cause

The mobile app used the shared Entra login, then invoked the legacy
`/api/v1/mobile/auth/login` simulation API. The public web proxy does not expose
that API. Failure restored the obsolete PASS/Kakao/PIN/session-confirmation UI.
The shared login also released the background before mobile initialization.

## Implementation

- Shared Entra session retains its wallet waiting screen and inert background on
  mobile until the app explicitly reveals its initialized home.
- Mobile uses the server-mapped Entra PATIENT session, checks patient identity,
  role and token expiry, and does not call the development login endpoint.
- The obsolete overlay is removed synchronously before reveal, not faded, to
  prevent its existing opacity transition from producing a brief old-screen flash.
- Initialization failure keeps protected content hidden and offers a reload in
  the existing wallet waiting screen. No artificial authentication delay.
- Entra app lock reloads and discards the in-memory session rather than restoring
  simulation buttons. Public Entra startup skips native vault/device simulators.
- Legacy private development authentication still requires its server receipt.
- PWA shell cache version is v43. Clinical/API/auth responses remain uncached.

## Related requirements and security

FR-001~005 (authenticated patient consent UI), FR-010~025 (roles, policies and
tokens), FR-037~041 (existing server audit path preserved). This change introduces
no API contract, server authorization or audit-policy changes. Frontend unlock
is a display state, never an authorization grant. No secrets or clinical data
are added to persistent browser storage. No overall MVP/v3 completion verdict.

Modified files: `public/capstone-auth.js`, `public/mobile/app.js`,
`public/mobile/sw.js`, `test/mobile-capstone-auth.test.js`,
`scripts/public-login-release.py`.

## Verification

Command:
`node --test test/entra-redirect-login.test.js test/entra-browser-auth.test.js test/capstone-login-preflight.test.js test/mobile-capstone-auth.test.js test/login-navigation.test.js`

| Check | Result | Evidence |
|---|---|---|
| Targeted auth/navigation/PWA regression tests | PASS | 28/28, exit 0 |
| Mapped patient/role, expiry after load, initialization failure | PASS | VM behavior tests; rejected paths never reveal home |
| Shared mobile deferred reveal and failure lock | PASS | Background stays inert until explicit reveal |
| Existing private simulator receipt requirement | PASS | Patient-bound server receipt tests unchanged |
| JS syntax | PASS | `node --check` on app.js and capstone-auth.js |
| Azure public web deployment | PASS | Final image `718fcb21ce7328d4a660647bacf56c5c0a7257be1daf042ae16ec30df9dc6bfb`; Control container unchanged |
| Public web/mobile HTTP and deployed JS hashes | PASS | Both pages HTTP 200; app/auth/worker match receipt; no-store |
| Live mobile wallet login | PASS | 375×812 browser: waiting → landing → wallet login; saved screenshot |
| Landscape login layout | PASS | 812×375: no horizontal overflow; old auth hidden; same unchanged login CSS |
| Real Microsoft callback through mobile home | NOT VERIFIED | Requires account interaction; fixtures are not live authentication |

## Deployment boundary

Only public web login assets and mobile app are overlaid on the pinned existing
image. Deployed HTML and all other screens are preserved. The original deployed
mobile app SHA-256 equals HEAD before this change:
`bcfb02098aa82f56ea538305b32309757cfcae24ee2e3f25ec6c7e74619590cd`.
Control, gateways and PACS are not redeployed. The release script checks the
current image before replacement and retains a rollback Compose file.

Final release receipt: `artifacts/azure/entra-web-20261013T075352Z-3264a5/result.json`.
The first attempt stopped on the pinned-image conflict guard without deployment.
The newer clinician release was preserved as the next baseline. An intermediate
release (`entra-web-20261013T074710Z-17e41d`) applied deferred reveal; the final
release additionally removes the overlay without an opacity transition.
Screenshot: `output/playwright/mobile-entra-wallet-login-20261013.jpg`.
Existing wallet typography, imagery and motion preference are retained; targeted
UI/UX skill guidance informed stable loading feedback and retry behavior. Dark
mode, largest system text size and physical-device callback behavior were not
tested in this change. No commit or push was performed.
