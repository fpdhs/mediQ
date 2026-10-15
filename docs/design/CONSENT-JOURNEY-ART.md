# Consent Journey Illustration

## Purpose
Replace the photorealistic patient in the consent step with an object-based 3D
medical wallet, selected exam card, recipient hospital and duration. Match the
existing glass, silver and blue illustrations without claiming successful server
authorization. Built-in image_gen was used; no external API key was used.

## Requirements
FR-001 through FR-005: consent explanation only. No consent behavior or API
contract changes. No new NFR identifier is asserted.

## Existing Structure
`security-gates.js` provides the image and accessible description used by both
the overview gallery and the detail image in `image-journey.js`. Both viewing
and storage explanation modes use the same gate model.

## Created Files
- `public/assets/security-journey/consent-v2.png`: 1536 x 1024 illustration.
- `public/assets/security-journey/consent-v2.json`: exact prompt, tool and SHA256.
- This document.

## Modified Files
- `public/ui/security-gates.js`: consent image reference and alt text only.
- `test/image-journey.test.js`: both modes, PNG dimensions and unchanged neighbors.
- `scripts/clinician-bundle-stage.py`: include the new asset in future bundles.
- `scripts/clinical-workspace-release.py`: bounded illustration-only release mode.

## Implementation
The old image remains available for recovery, but neither gallery nor detail uses
it for the consent step. All other seven illustrations are unchanged. The new
picture contains no people, hands, personal data, padlock or access-granted badge.

## Security
No authentication, consent policy, token, Gateway or audit behavior changes. The
illustration-only release verifies that the gate code differs solely in the image
reference and alt text, preserves all host HTML, and reuses the existing immutable
image promotion, vulnerability scan, baseline drift check and rollback guards.

## Tests
| Check | Result | Evidence |
| --- | --- | --- |
| Journey regressions | PASS | node --test test/image-journey.test.js: 5 tests |
| Clinician bundle management | PASS | python -m unittest test.clinician_ui_management_test: 8 tests |
| Local detail image | PASS | Browser natural size 1536 x 1024, complete=true |
| Mobile 390px | PASS | Image width 321px; no document horizontal overflow |

Browser screenshots: `artifacts/ui/consent-art-20261013/desktop.png` and `mobile.png`.

## Remaining Risk / Unverified
This is an educational image, not a clinical image or proof of security controls.
Authenticated Azure clinical workflows are not tested by this artwork change.
PNG is approximately 1.82 MB; the gallery continues to use its existing lazy loading.

## Azure Result
PASS: the immutable image was promoted to the existing public web service.
Receipt: `artifacts/azure/clinical-workspace-20261013T080842049946Z/deployment.json`.
Image: `sha256:0f99f3de4651fddad2e4248f1ef5310c874c852089ef0387d05c58ed180cf665`.
Scan: `artifacts/security/container-scan/consent-art-20261013.json`, zero HIGH and
zero CRITICAL vulnerabilities. Earlier build and scan attempts timed out; retries
passed without weakening the validation gates.

HTTPS byte parity passed for the new PNG and `security-gates.js`. The clinician
HTML, web runtime settings, Control, PostgreSQL and WAF remained unchanged.
The user-supplied clipboard image dated 2026-10-13 has the same 1536 x 1024 RGB
pixels as the deployed asset, despite different PNG file encoding.

Direct browser render PASS:
https://highpass-demo.japaneast.cloudapp.azure.com/assets/security-journey/consent-v2.png

Screenshot: `artifacts/ui/consent-art-20261013/azure-image.png`.
Azure authenticated in-page interaction remains NOT VERIFIED; local in-page
gallery/detail and the actual public asset were verified separately.

The subsequent request for a bolder, more visual explanation area is a design
discussion only. No explanation layout or security flow behavior was modified.
