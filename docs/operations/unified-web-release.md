# Unified Web Release

## Policy

Patient web, clinician web, and mobile PWA are one static frontend release.
Serving roles may have different backend images, but may not independently rebuild
or edit the approved frontend. Promote the exact same captured `public/` bytes.
Dates, Git HEAD, Docker tags, and a displayed version label alone are not proof of parity.

`scripts/web-release.js` captures browser assets and hashes their contents. The
content-derived release ID also identifies the mobile shell cache. Clinical files
under `assets/clinical/` are not included or exposed. Existing authentication,
consent, DPoP, gateway, and TLS policies remain unchanged.

## Capture Once

```powershell
node scripts/web-release.js stage public artifacts/workstation/web-release-20261013
node scripts/web-release.js validate artifacts/workstation/web-release-20261013
```

The destination must not exist; reruns never overwrite a prior capture. The capture
contains a `manifest.json`, a full browser asset tree under `public/`, and a generated
`public/web-release.js` version module. This is a static candidate, not an approved
or deployed image. Review the included frontend changes before image construction;
unrelated dirty backend changes must not enter the release by accident.

## Deployment Contract

1. Build each role candidate from its exact observed backend image, replacing the
   entire public tree with the SAME captured frontend. Do not merge with old public
   files. Keep clinical storage separate and preserve its existing access controls.
2. Verify image contents against this manifest. Run authenticated patient sharing,
   clinician access, denial, revoke, and gateway regressions. Complete the existing
   image security/SBOM gates and capture each host rollback point.
3. Activate using the existing host-specific credential, TLS, preflight and rollback
   procedures. This tool intentionally does not provision infrastructure or bypass
   those procedures. Never run the clinician-only staging path for a whole-web release:
   it deliberately retains host patient HTML and cannot establish whole-web parity.
4. Check EVERY serving origin against the one manifest. A missing asset, stale HTML,
   stale stylesheet, redirect, TLS failure or single mismatching host fails the check.
   Do not announce completion until this and authenticated regressions pass.

```powershell
node scripts/web-release.js verify artifacts/workstation/web-release-20261013 https://192.168.111.149:9443 --ca tmp/certs/mtls/ca.crt --report artifacts/workstation/web-release-20261013/served-parity.json
# Add the actual public HTTPS origin to the SAME command once DNS/TLS is configured.
```

Origins must be root HTTPS origins (not `/hipass/#PATIENT`). Root static assets are
checked independently of the patient route. The known B HTML `data-capstone` marker
is normalized; all other application content must match. Redirects are not followed.
Exit code 1 means release validation or parity failed. Keep the JSON output as evidence.
Use the project CA only for internal origins; do not disable certificate verification.

## Browser Caches

Existing servers use `Cache-Control: no-store`. Each captured PWA service worker uses
the release ID in its cache name, so activation removes prior shell caches. The PWA
currently supports an offline fallback; offline devices can display their last cached
release until they reconnect. Static server parity does not prove an already-open
browser has reloaded or the mobile shell install completed. Verify both in regression.
Do not cache APIs, tokens, consent data or DICOM images.

## Current Limitations

The internal `192.168.111.149` address is not an internet endpoint. Public DNS, valid
TLS, actual Edge/network configuration and real identity setup still need verification.
This tooling neither opens firewall ports nor exposes PACS/Orthanc/admin services.
Whole-web host activation is NOT VERIFIED until deployment receipts exist.

On 2026-10-13 the candidate `web-release-20261013-unified-candidate` captured 110
assets with release ID `4d01e7ef9b8a6b1ba25ce373096d893535b56c220e019fc1dd328835bceda448`.
The trusted-CA HTTPS check of B returned FAIL: 37 assets differed or were unavailable,
including patient sharing JS/CSS and typography. This confirms real version drift,
not merely different viewport layouts. No host activation or public networking change
was made by this work. The candidate includes current frontend work and is not yet
an approved production release. Secrets and server credential inputs are not included.

Related requirements: FR-001 through FR-005 (patient sharing regressions), FR-010
through FR-013 (clinician access regressions), FR-032 through FR-036 (viewer regression).
No API contract, consent model, database or token policy changes are made here.
