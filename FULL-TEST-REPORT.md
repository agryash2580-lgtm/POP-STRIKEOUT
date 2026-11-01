# Full test pass — 1 November 2026

## Code and local build

Main a4fce08 was the baseline. All 77 automated tests pass. Production build passes. Real browser suites passed for MFA setup/recovery/disable, cases/evidence/reviewed complaints, local PDFs, exposure/redaction/export, desktop navigation and both live Gemini specialist chats. Additional severity fixture verified critical/high/high/medium/low at the API and matching critical/high/high/medium display/export order. Keyless GitHub and password-prefix services passed live calls. Brave and HIBP provider behavior was tested with simulated responses only; keys are absent.

## Public deployment

Tested https://strikeout-mu20.vercel.app with fictional accounts and cases. Test accounts used solely for these checks were deleted after use, except the temporary email/report test session retained until final cleanup.

- Health: reachable; private cloud Blob storage reported.
- MFA: real browser enrolment, recovery-code login, access gating and disable passed.
- Google: configured; start redirects to Google's actual sign-in page without invalid-client or redirect-mismatch errors. Account login/callback was not completed with a real Google account. Callback and Google-to-MFA integration tests pass with simulated Google responses.
- Case/evidence/reviewed draft/local PDF browser suites passed.
- Mobile: 390px viewport, 390px document width, support screen renders without runtime errors.
- Live Pop chat returned a response.
- Live AI report completed research, writing and valid PDF generation.
- User-authorized report inbox verification succeeded. A second fictional AI report completed the opt-in email stage; the mailer reported accepted. Repeating advance retained accepted state. Inbox receipt was not independently confirmed. No complaint/test email was sent to CyberDost.
- Both extension downloads returned HTTP 200 with ZIP signatures.
- Both specialist chat endpoints return HTTP 503: their separate server keys are not configured in production. Local live calls with the supplied keys pass. The Vercel connection exposes no matching project, so deployment environment variables could not be configured from this connection.
- Production OSINT external check returns HTTP 403 requiring phone/SMS verification. This gate is absent from the tested main source. Live external OSINT from this deployed account therefore could not be completed; the gate was not bypassed. Production also reports Brave and HIBP unconfigured.

## Installed-extension test limits

Downloaded current Chromium and Firefox. Full-browser launches both fail on this Windows environment with spawn UNKNOWN. Headless-shell website tests work. Installed-extension and website-to-extension sync suites remain blocked by the browser launch failure; download validity and extension unit tests are separate evidence, not substitutes for installed-extension passes.

## Subsequent interface cleanup

Removed duplicate Emotional support and Digital footprint cards and the expert-booking note. Added the supplied UpLife destination using HTTPS beside Therabot. Shortened specialist copy. Suppressed visible error/success/working/status banners and explanatory notes; removed report-unknowns and finding-confidence/limitation display. Severity ordering, response statuses, redaction, checks and exported results are preserved. No failed action is relabelled successful. With silent errors, failed requests preserve input but no explanatory error is displayed, as requested.

Build, 77 backend tests, case/exposure/specialist browser checks, desktop/mobile cleanup assertions and a synthetic silent-error/retry-state check passed. These UI changes require merging and deployment before the public site changes.
