# DevFest troubleshooting

| Symptom | Check / recovery |
|---|---|
| Offline page will not open | Keep its terminal running; use the printed localhost URL on the same laptop. Opening the HTML as `file://` is unsupported. |
| Port already in use | Stop the earlier demo terminal or choose another `DEMO_PORT`; use that new port in the browser. Do not terminate unrelated processes. |
| Node is not installed | Install Node 22+ before travel. The portable folder needs Node, but no npm dependencies. |
| Missing demo assets | Restore all files listed in `MANIFEST.json` from the backup. Do not copy only the HTML. |
| Download does not start | Use **Prepare fictional summary**, then copy the JSON preview or open its download link. Some embedded browsers handle downloads differently. |
| Visitor changes remain visible | Click **Reset for next visitor** or reload. Neither action deletes production account data. |
| Main site is offline | Use the isolated offline demo. Live sign-in and API searches need the main application and potentially internet. |
| Exposure tools stay locked | Live MFA is required. Check encryption configuration, recent sign-in and enrollment. Do not disable the gate for the booth. |
| Authenticator code fails | Check device time, wait for a fresh code; codes used for sign-in/setup cannot be reused. Respect lockout. Recovery codes are for account sign-in, not exposure step-up. |
| MFA enrollment requires sign-in again | Enrollment requires recent authentication. Sign out/in through the normal flow; Google users must use their configured Google sign-in. |
| Phone/Instagram searches are locked | Intentional until target ownership can be verified. TOTP does not prove ownership of those targets. |
| Email search asks for ownership proof | Use **Verify your email for this check** in Check Exposure. Approve sending a code, enter it, then approve the search separately. Existing verified report/Google addresses can be reused. |
| Email verification is unavailable | Configure SMTP or Resend on the chosen server. Existing verified addresses still work. Document/password checks and the fictional demo do not need email delivery. |
| Email code fails | Use the latest code for the address shown, within ten minutes. Five wrong attempts exhaust it. Requesting a new code replaces the previous address verification; a one-minute resend delay applies. |
| Search provider fails or is missing | Inspect the source-status result or capability configuration. Missing configuration, quota or network failure is not a negative finding. Use a supported manual handoff or demo. |
| PDF contains no readable text | Image-only PDFs require OCR, which is not implemented. Paste authorized text instead. Enforce the file/page/text limits. |
| Saving fails on Vercel | Check private Blob configuration. Do not use the function filesystem as durable account storage. Preserve the user's pending draft. |
| Google sign-in unavailable | Check the OAuth client, secret and exact callback URL. No Google credentials are bundled with the demo. |
| Report AI/email unavailable | Optional providers need their own credentials. Local report/PDF and saved evidence are separate from email. Never report email delivered without confirmation. |

## Reporting a bug safely

Record the commit, mode (fictional demo or live), browser, approximate time,
reproduction steps, expected/observed result and any safe request ID. Use synthetic
data. Never attach API keys, session cookies, authenticator QR/secrets, passwords,
recovery codes, full identity/card numbers or private evidence to a public issue.

## Deployment and rollback

Run local checks before creating a reviewable change. Review the final diff for
secrets and unrelated files. Confirm the deployed revision and health endpoint;
do not infer deployment success from a local build. Test the public demo URL, then
the authorized live account journey with its owner. If the release regresses,
use the hosting provider's rollback to the previously verified revision. Keep the
offline demo available during an outage. Do not rotate MFA encryption keys as a
routine troubleshooting step: existing encrypted secrets depend on that key.
