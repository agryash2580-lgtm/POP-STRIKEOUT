# Exposure phone verification

All POST exposure endpoints now require a signed-in session with a recent successful SMS verification. Authentication and the phone gate are checked on the server, before running providers. The browser hides search controls until verification succeeds. Account changes clear the gate and pending UI data. Existing account authenticator MFA is independent and is preserved.

## Deployment

Set these server-side Vercel environment variables before rollout:

- `TWILIO_ACCOUNT_SID`: Twilio account SID.
- `TWILIO_AUTH_TOKEN`: private account auth token.
- `TWILIO_VERIFY_SERVICE_SID`: SMS-enabled Twilio Verify service SID.
- `OSINT_PHONE_HASH_KEY`: stable random secret, at least 32 characters, for phone HMACs.

Use Twilio Verify's SMS geographic permissions, fraud protection, account spending controls and an appropriate verified sender/service configuration for your region. Trial accounts restrict recipient numbers. No SMS credentials or real code should be committed or posted in a chat. Missing settings or provider failures never enable a test-code bypass: checks remain locked. No live SMS has been tested without these credentials.

Official provider contracts: https://www.twilio.com/docs/verify/api/verification and https://www.twilio.com/docs/verify/api/verification-check .

## Flow and enforcement

1. Sign in to STRIKEOUT, enter your own international phone number and approve the SMS.
2. Server starts a Twilio Verify SMS challenge. The pending challenge is tied to the account and current session, expires after ten minutes, and allows at most five code attempts.
3. Server checks the submitted code against the stored provider verification SID. Only an approved response with the matching SID, SMS channel and phone HMAC grants a 30-minute verification for this session. An atomic consumed-SID record prevents reusing an approval.
4. Phone public-reference searches must use this same verified number. All other exposure endpoints require the recent verification too; changing the client UI cannot skip the backend gate.

Persistent atomic rate-limit slots apply across instances: one send per account per fixed minute, five per account and per phone per fixed hour, and ten per IP per fixed hour. Boundary bursts remain possible with fixed windows. OTPs and raw phone numbers are not saved by the app; the private store retains a keyed phone digest, masked suffix and verification metadata. Twilio necessarily receives the phone/code. Expired budget/consumption records are inert; operators should prune expired records according to their retention policy.

## Ownership limitation

SMS proves control of a phone, not ownership of an Instagram account, email address, LinkedIn profile, name, domain or photo. Instagram public-reference requests are blocked until an actual Instagram ownership verification mechanism exists. They cannot be unlocked by OTP alone. Other input types still rely on the stated self-ownership consent; phone verification must not be represented as proof of their ownership. This implementation does not claim to make all misuse impossible.

Tests cover missing configuration, session/account binding, expiry, wrong-code limits, replay rejection, phone mismatch, Instagram denial and enforcement across all exposure endpoints. Provider calls in OTP tests are mocked; a real SMS delivery smoke test remains required once credentials are configured.
