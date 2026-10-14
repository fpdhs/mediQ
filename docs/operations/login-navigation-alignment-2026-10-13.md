# Public login navigation alignment

Review: DRAFT / UNASSIGNED. Synthetic demonstration only.

## Scope and decision

Keep the existing landing/wallet design. Web returns to `/hipass/`; mobile
returns to `/mobile/`. Login brands use the same surface. MSAL receives an
explicit same-origin `redirectStartPage`; query parameters, arbitrary hosts,
and fragments are not accepted as return targets. Server identity mapping,
not the selected entry button, determines the role.

Legacy controls stay hidden while auth-config loads. On the public Azure host,
404 or invalid auth-config is fail-closed, never presenter/password fallback.
Errors are visible on both landing and login. Private/local legacy environments
retain their existing behavior. PWA shell version increases to v41.
The browser exposed a second flash: initial mobile HTML contained the old
development-auth overlay before modules ran. A render-blocking `auth-boot.css`
hides background UI until authentication completes; it does not grant access.
Release HTML is taken from the pinned deployed image and only this stylesheet
link is inserted, avoiding unrelated local HTML changes.

Related FR: FR-001~025 (preserve authentication, consent and scope),
FR-037~041 (preserve server audit path). No API/DB/security policy change and
no new overall NFR compliance claim.

## Files

- `public/login-navigation.js`: fixed surface routes (new)
- `public/capstone-auth.js`: loading/error states and public Entra-only guard
- `public/entra-auth.js`: explicit redirect start page
- `public/ui/demo-entry.js`: surface-aware home link
- `public/mobile/sw.js`: shell v41
- `public/auth-boot.css`, web/mobile HTML: pre-module visibility guard
- `test/login-navigation.test.js`, `test/entra-redirect-login.test.js`
- `scripts/public-login-release.py`: pinned previous image, five-file overlay

## Verification

Command: `node --test test/login-navigation.test.js test/entra-redirect-login.test.js test/entra-browser-auth.test.js test/capstone-login-preflight.test.js test/mobile-capstone-auth.test.js`

PASS: 25/25, exit 0, runner duration 346.3462 ms. Includes surface return paths,
untrusted return destinations, server identity refusal, existing auth and PWA rules.

NOT VERIFIED: real account authentication through callback to authenticated home;
installed iOS/Android PWA callback behavior; private B portal alignment.
Unit tests are not browser authentication evidence.

## Deployment and recovery

Release uses the existing VM Compose web-only path; Control is not recreated.
First release: `artifacts/azure/entra-web-20261013T064113Z-edcad5/result.json`, exit 0,
Control unchanged. Browser verified mobile logo stays at `/mobile/` and wallet
login shows Microsoft only. Follow-up fixes the observed initial HTML flash.
Follow-up receipt: `artifacts/azure/entra-web-20261013T065139Z-82a3c1/result.json` once completed.
Previous image: `sha256:78684358cbf48b9745d424887c46c7c57c3e53b9962f8f2e4e07d89390839606`.
Recovery on the approved Cloud host:

```sh
sudo docker compose -p hp-public-web -f /home/highpassadmin/.highpass-login-entra-web-20261013T065139Z-82a3c1/before.json up -d --no-deps --pull never web
```

Rollback command not executed in this change. Existing unrelated working-tree
changes are preserved. No commit/push, private B deployment, or MVP completion.
