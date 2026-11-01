# Bug-testing pass — 1 November 2026

Base: main at 34cbc5d. Tested in an isolated local checkout with fictional accounts, local storage and a temporary MFA encryption key.

## Fixes

1. Show assistant could leave the guided tutorial active and keep the pet hidden. Explicitly exit the tutorial when showing the assistant. Existing desktop navigation test failed before and passes after.
2. Report fallback step IDs could collide with model-supplied IDs, conflating progress. Allocate an unused fallback ID. New regression test reproduced four unique IDs for five steps before the fix and passes after.
3. The legacy AI endpoint returned different errors for missing consent depending on API-key availability. Validate consent first; update the stale test expectation to HTTP 400. No provider request is made for unapproved input.

## Results

- 69/69 automated backend tests pass, including report grounding, storage conflicts, case isolation, exposure checks, Google authentication adapter and MFA challenge/recovery/replay/session tests.
- Production build passes; diff whitespace check passes.
- tests/mfa-browser.mjs: passes real UI setup/QR, recovery-code login, access gating and disable flow.
- tests/exposure-browser.mjs: passes document scanning, masked JSON export, local follow-request queue/withdrawal and PDF generation/download.
- tests/final-desktop.mjs: passes signup, case creation, evidence, reviewed complaint export, report consent and extension settings.
- tests/desktop-navigation.mjs: passes menu, tutorial and assistant interactions after the fix.

## Limits

Installed Chromium extension and sync browser tests could not launch the downloaded full browser (spawn UNKNOWN); these are not recorded as passes. Firefox was not exercised. Google SSO used mocked provider responses, not a live Google account. Live Gemini, external search, email delivery, production deployment and mobile layouts were not validated. This is a broad regression pass, not proof the entire application is bug-free. No production settings or MFA implementation were changed.
