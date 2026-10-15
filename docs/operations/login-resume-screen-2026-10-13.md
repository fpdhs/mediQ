# Login resume screen

Review: DRAFT / UNASSIGNED. Date: 2026-10-13 KST.

The landing screen previously mounted before auth-config and MSAL redirect
handling completed. The earlier HTML guard prevented old development markup
from appearing, but did not suppress the newly mounted landing during resume.

The shared web/mobile entry now starts in a pending state with the existing
wallet asset and “내 의료지갑을 여는 중…” text. The entry and login shell remain
hidden during auth-config and redirect response handling. A valid server-mapped
session completes authentication directly; no result shows the landing; failure
opens the wallet login with its retry message. There is no artificial delay or
user/record information on the pending screen.

Changed files: `public/ui/demo-entry.js`, `public/capstone-auth.js`,
`public/auth-boot.css`, `public/mobile/sw.js` (v42),
`scripts/public-login-release.py` (pinned previous public web image).

Related FR: FR-001~025 and FR-037~041, preserving existing server authorization
and auditing. No API or server policy changes. No overall NFR/MVP/v3 verdict.

Verification command:

```sh
node --test test/entra-redirect-login.test.js test/entra-browser-auth.test.js test/capstone-login-preflight.test.js test/mobile-capstone-auth.test.js
```

PASS: 21/21, exit 0, runner duration 367.7973 ms. Syntax checks and scoped
`git diff --check` exit 0. These checks do not substitute for a real account
round trip or installed-device PWA verification.

First attempt (`entra-web-20261013T071855Z-6a731a`) stopped on the current-image
guard before changing the web container: another public release had updated it.
The observed current image was
`sha256:93d5c6b180db652434be7dea31ac517468c107371fd84044309969042cf8cd3d`.
The retry overlays login assets on that exact image, preserving the newer site.
Release receipt: `artifacts/azure/entra-web-20261013T072443Z-fab054/result.json`.
The release changes only the existing public web container and checks that
Control remains unchanged. Its HTML is extracted from the previous image to
preserve existing deployed contents; the auth-boot link is not inserted twice.

Retry deployment PASS, exit 0. Image:
`sha256:1fba2551560f99f4afa7c1ab5ada7fdd8d7c8d8008a8fc338bb467ea2ea88e10`.
Live capstone-auth, demo-entry, auth-boot and mobile worker hashes match receipt.
Actual web and mobile reloads displayed only the wallet waiting heading during
initial authentication preparation, then the normal landing after no redirect
session was found. Web patient entry displayed the existing wallet login and
Microsoft button. Browser resume with a real authenticated account remains
NOT VERIFIED; this is not a completed authentication round trip.

Recovery command on the approved Cloud host:

```sh
sudo docker compose -p hp-public-web -f /home/highpassadmin/.highpass-login-entra-web-20261013T072443Z-fab054/before.json up -d --no-deps --pull never web
```

Rollback not executed. Real account login → authenticated home, actual phone
PWA behavior, and private B portal deployment remain NOT VERIFIED.
