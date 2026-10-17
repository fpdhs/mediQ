# Patient account menu — 2026-10-13

Status: DRAFT / UNASSIGNED. Patient-facing account details only.

The desktop patient header profile is now a keyboard-operable disclosure button. Its panel shows the synthetic patient name and age, patient account type, sign-in provider, and a synthetic-demo label. Selecting “로그아웃” hides the protected app and replaces the current route with the fixed same-origin entry route. Escape closes the panel and returns focus to its trigger; pointer interaction outside closes it.

Mobile keeps its existing “내 정보” tab and sign-out flow. Account copy is populated from the authenticated patient context and provider; the old generic development-auth line is replaced with the active account type/provider. The action is labelled “로그아웃”.

The menu uses textContent-created DOM nodes for identity values, does not show patient identifiers or email, and does not alter server authorization or consent behavior. Current logout returns this browser to the sign-in entry and drops the page's in-memory session during navigation; it does not claim to revoke an already issued server token.

Related requirements: UI for patient portal; auth roles and server authorization invariants unchanged. No API or database contract changed. No test suite run for this UI change.

## Deployment and evidence

Guarded UI-only deployment receipt: artifacts/azure/entra-web-20261013T090200Z-498bad/result.json. Image: sha256:73c0717c219d6e97bcab359cb166be3aeb3aa94e3c415e962b7c090bcb04b4a4. The receipt confirms the Control container remained unchanged and preserves a rollback compose configuration. Both modified assets returned HTTP 200 and matched the receipt SHA-256.

The signed-in profile panel was not exercised in a browser because the available Azure tab was at the unauthenticated wallet login. This implementation does not claim the profile interaction was live-session tested. No automated test suite was run for this UI change.
