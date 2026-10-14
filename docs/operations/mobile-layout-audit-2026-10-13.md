# Public mobile layout audit — 2026-10-13

Status: DRAFT / UNASSIGNED. Scope: public mobile entry and wallet login, not a full MVP acceptance.

Target: https://highpass-demo.japaneast.cloudapp.azure.com/mobile/

## Findings and implementation

- Inspected live entry/login at 360×740, 375×812, 390×844, 430×932 and 812×375. No horizontal overflow observed.
- Existing later content padding overrides discarded the earlier safe-area bottom allowance. Added final safe-area overrides for content, header, navigation and profile.
- Entry motion control and login back control were 44px; raised their minimum height to 48px. Local rendered login back control measured 48px at 375px with scroll width 375px.
- Preserved wallet artwork, Microsoft authentication, patient authorization, consent and QR contracts. No authentication bypass or clinical API change.
- Updated public-shell service worker cache version to v44; private clinical routes remain excluded.
- Used UI/UX mobile guidance for safe areas and touch targets; did not introduce a new design system.

Changed UI files: public/ui/mobile.css, public/ui/capstone-login.css, public/ui/demo-entry.css, public/mobile/sw.js. Regression test: test/mobile-wallet-design.test.js. Deployment helper supports an allowlisted UI-only overlay, preserving deployed HTML and existing application JS.

## Verification

| Check | Result | Evidence |
|---|---|---|
| Entry/login horizontal layout, five sizes | PASS | Live browser DOM dimensions and visual inspection |
| Microsoft sign-in navigation | PASS | Microsoft tenant sign-in page reached from mobile wallet |
| Targeted regression tests | PASS | node --test test/mobile-wallet-design.test.js test/mobile-capstone-auth.test.js test/login-navigation.test.js: 24/24 |
| Published UI assets | PASS | All three CSS assets and sw.js returned HTTP 200 and matched receipt SHA-256 |
| Post-deployment wallet login, five sizes | PASS | scrollWidth equaled viewport width in every size; back control measured 48px |
| Physical phone notch, browser chrome, software keyboard | NOT VERIFIED | Browser viewport checks do not simulate hardware |
| Authenticated home, sharing, QR and health helper | NOT VERIFIED | Awaiting user-completed patient Microsoft sign-in |
| Full clinical flow / MVP acceptance | NOT VERIFIED | Outside this partial layout audit |

Relevant requirements: existing patient UI and responsive NFR; FR-001–005 consent and FR-032–036 viewer behavior preserved, not reaccepted by this audit. No API contract changes or secret additions. No commit/push.

## Deployment

First attempt timed out reading the local Docker base HTML before any remote mutation. Next attempt (entra-web-20261013T081804Z-de6c31) was safely rejected because another deployment changed the live base image. Neither attempt replaced the server web.

Rebased the allowlisted UI-only overlay on the latest pinned image. Successful receipt: artifacts/azure/entra-web-20261013T082328Z-30f029/result.json. Deployed image: sha256:603b463e405d4a8c8a83e5dc64dc588b8318ac20c6c400612d97cc0569b22e7a. Receipt confirms Control container unchanged and records rollback configuration. Live CSS/worker hashes matched. HTML was preserved from the base image; HTTP HTML hashes were not asserted because responses may be transformed.

Screenshot: output/playwright/mobile-layout-audit-20261013.jpg (375×812). Login-after-auth and physical mobile testing remain NOT VERIFIED.
