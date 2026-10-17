# Medi Q patient Android app

This app wraps the existing patient PWA at
`https://highpass-demo.japaneast.cloudapp.azure.com/mobile/` as an Android
Trusted Web Activity (TWA). Patient screens, Entra sign-in, QR sharing, health
records, the Qwen/RAG helper, and the scoped imaging viewer stay on the existing
authenticated web/API path.

## Current stage

- Bubblewrap 1.27.0 generated the Android TWA project from the live PWA manifest.
- The TWA application identity and PWA entry point are recorded in
  `twa-manifest.json` and `app/build.gradle`.
- Android package id: `com.highpass.mediq.patient`.
- Minimum Android version: Android 7.0 (API 24), matching the current
  Android Browser Helper dependency.
- The live PWA manifest responds successfully and provides the Medi Q app name,
  icons, portrait orientation, and `/mobile/` start scope.
- `assembleDebug` completed successfully. The local installable preview is at
  `app/build/outputs/apk/debug/app-debug.apk` and is signed with the workstation's
  Android debug certificate.
- The deployed origin currently returns 404 for `/.well-known/assetlinks.json`.
  Full-screen TWA verification therefore awaits the app signing certificate and
  publishing the corresponding Digital Asset Links file on the same HTTPS
  origin.
- Google's Android SDK terms were accepted for Bubblewrap's local SDK setup.
- No release/upload signing key was created. Keep release signing separate until
  the final certificate fingerprint can be published through the approved Azure
  deployment path. For a local installable preview, use the Gradle debug build.

## Build a local preview

From this directory, build the debug APK:

```powershell
.\gradlew.bat assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. It is signed
with Android's local debug key and is for device preview only; it is not a
Play Store or production release. Do not distribute it as a trusted full-screen
TWA until Digital Asset Links is live and verified.

## Release signing and domain verification

From this directory, before using Bubblewrap's release build, provision and back
up a release keystore through the agreed secret-management process. Keep that
key and all passwords outside Git.

```powershell
npx --yes @bubblewrap/cli@1.27.0 build --manifest=twa-manifest.json
```

Derive the Digital Asset Links fingerprint from the final signing certificate
and publish the matching file at `/.well-known/assetlinks.json` on the same HTTPS
origin. Until then, Chrome may show browser UI around the app content.

## Patient data boundary

The app uses the existing patient authorization and server-side consent checks.
The Android wrapper does not grant access by itself. Original DICOM stays behind
the hospital Gateway; the app does not add a new cloud copy or offline cache for
clinical records or image pixels. The existing PWA service worker caches only
its allowlisted static app shell.

## Requirements touched

- FR-001–005: patient authentication and consent entry points.
- FR-006–009: imaging list and metadata entry points.
- FR-010–036: scoped clinician access and viewer journey remains governed by
  existing server policy.
- FR-037–041: existing audit path remains authoritative.

Native authentication behavior, physical-device QR camera behavior, device
lock, release signing, Digital Asset Links deployment, and APK/AAB distribution
remain NOT VERIFIED until the app is exercised on a device and the release
certificate is published and verified.
