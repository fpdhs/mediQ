# Patient Wallet Continuity

The patient web keeps the approved sharing form and appends one in-flow wallet
after each non-home menu's task content. The existing leather WebP is reused.
Four cards remain in fixed order: sharing review, health records, imaging sharing,
and health helper. Home and downstream menus share the same card factory,
leather artwork, card widths, tilt, overlap, visible CTA and responsive rules.
The active card is outlined and marked `aria-current="page"` without changing
its geometry. Clicking that card does not re-enter the task.

`mountPatientWalletDock` replaces nested docks and removes duplicates introduced
by record redraws, without moving or replacing forms. Navigation maps records to
`phr` and sharing review to `activity`. Consent/visit pages select the sharing
card. Auxiliary menus keep all four links without falsely selecting a primary
card. Home retains its existing primary wallet rather than adding a second one.
Wallet navigation focuses the destination heading and scrolls to the task start.

No consent, token, API, database, clinical data or server policy contract changes.
Related regressions: FR-001 through FR-005, FR-006 through FR-009. This is UI only.

Validation (2026-10-13 KST):

Latest home-parity revision: 30 focused Node tests PASS. Actual local app browser
checks at 1440px and 390px PASS for home/dock card styles, artwork loading,
four menu routes, current-page markers, no horizontal overflow and no page
errors. Run `node scripts/check-patient-wallet-parity.js <playwright/index.mjs>`.
Screenshots: `output/playwright/patient-wallet-unified/`. This revision is served
by the local app; remote VM activation remains NOT VERIFIED. The table below
records the earlier fixture validation, not remote deployment evidence.

| Check | Result | Evidence |
| --- | --- | --- |
| Focused automated regressions | PASS | 27 tests including draft preservation, card routing and redraw deduplication |
| App syntax | PASS | node --check public/app.js |
| Desktop and 390px layout | PASS | Synthetic loopback browser fixture; artwork loaded, four cards visible, no horizontal overflow |
| Menu changes and sharing draft | PASS | Fixture moves sharing -> records -> sharing; HOSP-B selection retained; helper/activity selections verified |
| Real authenticated host rollout | NOT VERIFIED | Server image not activated by this change |

Screenshots: `artifacts/ui/patient-wallet-dock-20261013/desktop.png` and
`narrow-web.png`. Fixture: `http://127.0.0.1:11450/preview`; no approvals, patient
API, credentials or PACS are used. Helper fixture is a navigation placeholder,
not evidence of helper API success. All serving hosts must receive a new unified
web release before claiming cross-server parity; the previous captured bundle
does not contain this change.
