# Team handoff: STRIKEOUT

Canonical repository: https://github.com/agryash2580-lgtm/POP-STRIKEOUT
Live website: https://strikeout-mu20.vercel.app
Current extension: Pop 2.3.0. Use the versioned Chromium/Firefox ZIPs linked from the website's Pop app.

## Read this before editing

Work in POP-STRIKEOUT, not the older Strikeout repository. Pull the current main branch before starting a new change. Do not overwrite the whole project with a ZIP or force-push main. Existing teammate OSINT and report-grounding changes are preserved.

The OSINT teammate owns `api/osint/`, `OSINT BACKEND/` and `frontend/src/app/components/ExposureApp.tsx`. Coordinate edits to shared files such as `api/index.mjs`, `api/pop.mjs`, `RecoveryApp.tsx`, `package.json` and `package-lock.json` because authentication, reports and the extension all depend on them.

## What is implemented

- Google OpenID Connect sign-in provides SSO. The Google project remains in testing mode; add presenters under Google Auth Platform > Audience > Test users. Callback: `https://strikeout-mu20.vercel.app/api/auth/google/callback`.
- Authenticator MFA is optional per account under Cases & Reports > Account security. It applies after either password or Google authentication. It uses six-digit TOTP codes and eight one-use recovery codes. Enabling/disabling it invalidates old website sessions and Pop pairings; pair the extension again afterwards.
- Pop has a shared local watchlist, page scanning, paste warnings, left-click petting, right-click tools, a local lookalike-link guard and website settings. Contextual website and paired extension chat share one account history and reviewed case context.
- Named screenshot + inert HTML captures save locally and can sync to the website library. Add to case makes them selectable for reports. Gmail delivery is configured on production; recipients must be verified. Do not replace it with a developer's hardcoded recipient.
- Cases, report jobs, shared chat and synced evidence use private Vercel Blob JSON records. Local development uses ignored `.data/` files. There is no SQL migration or Firebase dependency.

## New authentication files

`api/mfa.mjs` implements encrypted TOTP enrolment, recovery hashes, expiring login challenges, retry limits and replay prevention. `api/index.mjs` issues a full session only after MFA succeeds and checks the account security version. `api/google-auth.mjs` uses that same login completion path after Google. `api/pop.mjs` checks the security version on pairing codes and extension tokens. `AccountSecurity.tsx` supplies setup/QR/recovery controls and the second-factor screen inside `RecoveryApp.tsx`.

Google sign-in alone is not proof that STRIKEOUT MFA is enabled. We enforce our own configured second factor. TOTP is not phishing-resistant WebAuthn, and this is not enterprise SAML.

## Local setup

Use Node 22 or newer. From the repository folder:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Fill private environment values only when needed. Google OAuth needs its three variables. MFA setup needs a stable 32-byte base64 `MFA_ENCRYPTION_KEY`. Production already has a private key; do not replace it or paste it in a chat/commit. Gmail needs `SMTP_USER` plus the generated `SMTP_APP_PASSWORD`, not the account's login password. Gemini is optional for local browser tools. Never commit `.env.local`, `.vercel` or `.data`.

## Safe collaboration

If you already have edits, commit only your intended files on your own branch before rebasing. Example workflow:

```powershell
git switch -c teammate/your-feature
git add <your-files>
git commit -m "Describe the change"
git fetch origin
git rebase origin/main
git push -u origin teammate/your-feature
```

Open a PR into main. Resolve overlapping shared-file edits rather than replacing the other person's file. Repo access and Vercel deployment access are separate; the project owner must grant access through each service. Do not share API keys through issues, source files or screenshots.

## Checks before presenting

```powershell
npm test
npm run build
node tests/desktop-navigation.mjs
node tests/pop-browser.mjs chromium
node tests/pop-browser.mjs firefox
```

Browser tests default to localhost unless their documented environment variables select a hosted URL. `tests/mfa.test.mjs` checks challenge gating, invalid/replayed codes, one-use recovery codes, session invalidation and stale Pop tokens. Use fictional accounts and evidence in demonstrations.

For a security demo: sign in, open Account security, scan the QR in an authenticator, enter its code, save recovery codes, sign out, sign in again and show that private data stays unavailable until the second factor. Wait for a new authenticator code if the setup code was just consumed. Then demonstrate Google SSO separately, or enable MFA on that Google-owned account too.

## Boundaries to explain honestly

A search engine cannot cover the entire internet. The OSINT teammate is responsible for the provider coverage shown in their UI. Private-account access is not implied. Provider failures are not successful checks. Screenshots capture the visible area; inert HTML excludes scripts/frames/form values. Hashes help compare bytes, not prove authenticity. AI can make mistakes. Email acceptance is not inbox-delivery confirmation. Firefox ZIPs are development add-ons, not signed store releases.

For the complete code map read CODE-GUIDE.md. For the extension read docs/POP-EXTENSION-EXPLAINED.md and extension/README.md. Report-grounding behavior is explained separately in AI-GROUNDING.md.

For local MFA key generation, run `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and put the result only in your own .env.local. For local Google sign-in, register `http://localhost:3002/api/auth/google/callback` in the Google client and use it as your local redirect. These local values must not replace the deployed project settings.

## GitHub deployment

The existing Vercel project is connected to agryash2580-lgtm/POP-STRIKEOUT. The production branch is main and the live address remains https://strikeout-mu20.vercel.app. Vercel builds the repository source; extension ZIPs are downloadable assets, not the source of the website. Keep project secrets in Vercel Environment Variables. Merge reviewed changes into main and check the Vercel deployment result before presenting.
