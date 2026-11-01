# STRIKEOUT + Pop

Live website: https://strikeout-mu20.vercel.app

A Windows 98 style recovery workspace with private incident cases, evidence, reviewed complaint drafts, optional Gemini reports/PDFs, guided next steps, a separate Check Exposure app and a Chromium/Firefox companion extension.

**Start with [CODE-GUIDE.md](CODE-GUIDE.md).** It explains the actual code, file locations, data flow, setup, demo and limitations for a beginner presenting this project.

## Run

Node.js 22+:

```powershell
npm ci
# Only if .env.local does not exist:
Copy-Item .env.example .env.local
# Add private provider settings to .env.local, then:
npm run dev
```

Open [localhost:3002](http://localhost:3002). The root server serves both frontend and backend. Do not start the separate teammate service to use this integrated version.

## What works independently of AI

- Private username/password accounts, cases, evidence and reviewed complaint exports.
- Local report/PDF fallback clearly labelled as non-AI.
- GitHub public-reference checks, supplied-text/PDF review and prefix-only password breach checks, subject to provider/network availability.
- Real extension page matching, supported sharing warnings, petting, screenshot review, flattened redaction, local incident export and deletion.

Gemini enables report writing, summaries and chat. Fresh research grounding has separate provider quota; the UI/PDF disclose when bundled official references are used. Resend email, Brave/HIBP and Google sign-in require their own configuration. Missing keys are not simulated successes.

Instagram public-reference checks are available. Consented follow requests use the teammate's local browser workflow, a configured STRIKEOUT operator and a signed-in `popyourproblemsaway` service account. This is not private-post scanning and does not run on Vercel.

## Extension development packages

- [Chromium v2.3.0](frontend/public/pop-chromium-2.3.0.zip)
- [Firefox/Zen v2.3.0](frontend/public/pop-firefox-2.3.0.zip)

Unzip, then load the Chromium folder at `chrome://extensions` with Developer mode, or load the Firefox `manifest.json` through `about:debugging#/runtime/this-firefox`. Firefox installation is temporary and requires version 142+. Website Delivery & Pop manages the installed extension's preferences after approval. Left-click Pop to pet; right-click for tools.

## Check and build

```powershell
npm test
node tests/final-desktop.mjs
node tests/exposure-browser.mjs
node tests/website-pop.mjs
npm run test:pop:browser
npm run build
npm run package:pop
```

Live checks using fictional inputs: `node scripts/check-osint-live.mjs` and `npm run check:reports:live`. They call real providers; the report check does not send email.

## Source map

- `frontend/`: active React desktop and local static assets.
- `api/`: unified Express API, authentication, storage, report jobs and integrated OSINT.
- `shared/`: browser clients and shared data helpers.
- `extension/`: readable plain JavaScript extension source and browser manifests.
- `tests/`: backend and real-browser verification.
- `OSINT BACKEND/`: preserved teammate source. The integrated application uses `api/osint/`.

The supplied shell/tutorial originated in the frontend ZIP; see [frontend provenance](frontend/THIRD-PARTY-NOTICE.md). The extension simulator uses fictional demonstration content. No complaints are automatically submitted, no appointments are booked, and no no-findings result proves absence of exposure.

Never commit `.env.local`, `.data`, browser profiles, provider credentials or personal incident exports. See `.env.example` and the guide for the exact optional settings and deployment requirements.

Pop 2.3 adds local lookalike-link blocking, shared account chat/context, a synced evidence library and case/report attachment. See [extension installation and demo](extension/README.md) and [code guide](CODE-GUIDE.md). Gmail email needs an app password; missing email configuration never prevents saving/syncing/downloading evidence.
