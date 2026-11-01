# Free authenticator verification for exposure checks

The exposure gate uses standard six-digit TOTP codes from an authenticator app, with no SMS provider or per-message fees. It reuses STRIKEOUT's existing encrypted MFA enrollment, replay prevention, recovery flow and five-failure lockout. Recovery codes remain available for account sign-in; exposure step-up requires a fresh six-digit authenticator code.

## Setup

The operator must configure the existing server-only `MFA_ENCRYPTION_KEY`: a stable base64-encoded 32-byte random secret. Generate it locally with `openssl rand -base64 32`, put it in Vercel's environment settings and redeploy. Never commit it or rotate an existing key casually: existing enrolled MFA secrets require that same key to decrypt. No Twilio account, API token or phone number is required.

Users sign in with a permanent account, open Check Exposure and set up their authenticator using the embedded Account security panel. Scan the QR code or enter the private setup key in a TOTP app, confirm setup and save the one-use recovery codes. After enabling MFA, save the recovery codes and click “I saved them”; the verification form opens automatically. “Check setup progress” explains unfinished enrollment instead of silently refreshing. Enter a fresh code to unlock checks. A code already consumed for setup/sign-in cannot be reused; wait for the next 30-second code.

## Enforcement

`GET /api/osint/auth/status` reports configuration, enrollment and current-session verification. `POST /api/osint/auth/verify` checks a six-digit code through the existing account MFA verifier and grants up to 30 minutes of access. All exposure POST endpoints require that grant on the server before provider calls. Grants are bound to account, login cookie and MFA security version, and become unusable after logout, expiry or MFA disable/reset. Missing encryption configuration fails closed. Verification is rate limited; the underlying MFA verifier persists attempts and uses conditional writes to reject replay races.

SMS endpoints, Twilio credentials, phone challenge code and old phone UI have been removed. Old SMS verification records do not grant access. Phone/Instagram searches are blocked because authenticator possession does not verify ownership of those targets. Other names, email addresses, LinkedIn URLs, domains, images and supplied documents still use the stated self-ownership consent; this is account authentication, not proof of ownership of every search target.

Tests include actual encrypted enrollment and TOTP verification through HTTP, code replay, session/account isolation, expiry, security-version changes, missing configuration, and enforcement before provider work.
