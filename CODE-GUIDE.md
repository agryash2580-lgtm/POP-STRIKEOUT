# STRIKEOUT: understand the code and present it honestly

Read sections 1–4 first. They explain the product and the main flow. Use the file map when someone asks where a feature is implemented.

## 1. What we built

STRIKEOUT helps someone organise the aftermath of an online incident. The website stores their case and evidence, prepares a reviewable complaint draft, generates an optional AI-assisted recovery report and PDF, and keeps a checklist of next steps. Check Exposure is a separate desktop app for consented public-reference searches, supplied-document checks and password-prefix breach checks. Pop is a real Chromium/Firefox extension with local identifier matching, sharing warnings, evidence capture and optional chat.

The Windows 98 desktop is the interface. It is still a normal website running inside a browser. The terminal and monitor cannot inspect the computer's operating system. The extension simulator demonstrates fictional data; it is separate from the installed extension.

The supplied desktop and tutorial designs came from the frontend ZIP. Integration, account storage, reporting, AI, the installed extension and the OSINT connection are separate contributions. Preserve the supplied frontend's provenance notice. Do not claim every line or visual was originally authored by the team.

## 2. The architecture in one minute

```text
Browser: React desktop / Cases / Exposure / Pop chat
                 |
        same-origin HTTP requests + private session cookie
                 |
         Express backend: api/index.mjs
           |              |                   |
    cases/evidence    report jobs         OSINT / Instagram
           |         |          |            |       |
        storage   Gemini     PDF/email    providers  local browser
           |
  .data locally, or private Vercel Blob when configured

Installed extension: local watchlist + page tools + IndexedDB screenshots
           |
   explicit website settings bridge / reviewed AI pairing
```

React draws the interface. Express receives requests and checks who is signed in. Storage keeps records across refreshes. Gemini is called by the server, so its API key never enters frontend code. Provider keys and login sessions are separate things.

In basic Python terms, a JavaScript object resembles a dictionary, an array resembles a list, `async`/`await` means wait for an operation without blocking all other requests, and `try`/`catch` resembles `try`/`except`. React's `useState` holds a screen's changing values. Changing state redraws the relevant interface. `useEffect` connects things such as loading initial data or registering browser events.

## 3. What happens when someone creates a case

1. The login form sends a username and a new STRIKEOUT password to `/api/auth/register` or `/api/auth/login`. The server hashes passwords with scrypt and a random salt. It does not store the plaintext password.
2. The server creates a random session token. The browser receives it in an HTTP-only cookie; backend storage contains its hash and expiry. Frontend JavaScript cannot read the cookie.
3. `RecoveryApp.tsx` collects title, category, platform, description, optional date, profile URL and requested help. Saving calls `/api/reporting/cases`. This save does **not** call Gemini.
4. Evidence notes and supported small files are added to that particular case. A note is not automatically proof that the incident happened. Files are validated for type and size, and hashed. The current website file limit is 500 KB per attachment.
5. The case and its evidence belong to the signed-in user. Changing a URL to another user's case ID does not grant access.
6. Updates include the last known data version. A stale write is rejected instead of silently replacing a newer save from another tab.

An unknown incident date stays unknown. Saving the case does not report it to police, contact Instagram, or recover an account.

## 4. How report generation actually works

The user opens Report & PDF, selects evidence and approves the displayed context. Sending screenshot/PDF file contents is an additional choice. Email is another explicit choice and requires a verified delivery address.

The server saves a snapshot of the selected case facts and creates a report job. A snapshot freezes exactly what that report used. A fingerprint detects whether later case edits make the report outdated.

The job advances through saved stages:

```text
research -> writing -> pdf -> optional email -> ready
```

Research receives a generic category/platform topic, rather than the user's personal incident narrative. The Gemini adapter requests Google Search grounding and checks the returned official source links. If fresh grounding is unavailable, the implementation supplies a clearly labelled set of bundled official references and states that fresh research was unavailable. A bundled reference is not a newly verified search result.

Writing receives the reviewed case snapshot and the saved research sources. Gemini returns structured JSON. The server validates required fields and source references rather than blindly treating any model text as a complete report. The result includes an incident summary, known facts, unknowns and recommended steps.

`report-pdf.mjs` converts the saved report into a PDF with pdf-lib. The PDF is generated from report data; it is not a screenshot of the website. Original evidence files are not automatically embedded in that PDF. The current standard-font renderer has limited support for non-Latin characters.

Each stage saves before the next stage starts. The frontend asks the server to advance the next stage; there is no imaginary always-running background worker. If a tab closes, reopening the case can resume the saved job. A stage lease prevents two requests from doing the same work simultaneously. Provider failure leaves an error that can be retried.

The local-report button creates a deterministic report and PDF without Gemini or new research. It is labelled accordingly. It is useful when the provider's quota is exhausted, but must not be presented as AI output.

Summary and guidance use the saved report, its sources and the user's recorded progress. They do not secretly run a new personal-data web search. Historical reports remain downloadable, but an outdated report cannot drive current guidance until the facts are brought up to date.

Email uses Resend, a configured verified sender and a delivery address verified by a short-lived code. Acceptance by Resend does not prove inbox delivery. Email retries use an idempotency key so repeated requests do not deliberately send duplicate messages. Without email configuration, PDF downloads continue to work.

## 5. Complaint drafts and next steps

The complaint draft is separate from the AI recovery report. `reporting-core.mjs` builds a factual template from information the user supplied. The user can edit it and approve that exact version. Changing facts, evidence or wording invalidates approval. The export escapes HTML so untrusted incident text cannot become executable markup.

Official portals open for the user to review and submit. The application does not file complaints automatically. A submission reference and follow-up status are manually recorded facts, not live government tracking. Technical help and emotional-support resources are guidance links; no therapist/expert appointment is booked unless an actual booking integration is later configured.

## 6. Reverse OSINT and its actual coverage

OSINT means examining information available from an identified source. A search result is a lead, not proof that a profile belongs to the person or that a person is safe.

| Tool | What it really does |
| --- | --- |
| Email | Searches public GitHub issue/PR text for the exact email. Optional configured Brave and HIBP providers add their disclosed coverage. |
| Phone | Validates international number format, then searches limited public references. It does not identify a SIM owner or track a device. |
| LinkedIn | Searches public references to the supplied personal profile URL. No private LinkedIn login. |
| Instagram | Searches public references to the supplied Instagram profile. It does not read private posts. |
| Identity-document references | Searches an own-name query with document-related terms. It does not retrieve an identity-card database or perform face recognition. |
| Document review | Checks text the user supplies for chosen identifiers and sensitive-looking patterns. PDF text extraction happens locally before the user submits. No OCR. |
| Password check | Hashes the password in the browser, sends only the first five SHA-1 characters, and compares the returned suffixes locally. A match concerns the password string, not proof that a specific account was breached. |

GitHub checks need no provider key, but cover only public issues and pull requests, with a bounded number of candidates. The backend confirms an exact identifier occurrence in returned text before calling it a match. Sensitive-looking snippets are masked. The UI displays provider coverage and incomplete results. No findings means none returned within that check, not no exposure anywhere.

Brave web search needs `BRAVE_SEARCH_API_KEY`; email breach records need `HIBP_API_KEY`. The frontend reads capabilities and does not pretend missing providers are running. Download exposure results explicitly to keep the returned JSON. An exposure result is not automatically saved as a case.

## 7. Instagram follow service

This is the teammate's consent-based local browser implementation, now connected to the website's existing accounts and storage. It is separate from public-reference searches.

The account owner declares their account private and approves a request for the fixed service account `popyourproblemsaway`. The backend records a queue entry. Repeating the same request returns that entry rather than creating repeated follow attempts.

An operator username must be listed in `INSTAGRAM_OPERATOR_USERNAMES`. The operator opens the local Instagram browser from Check Exposure and signs into the service account. Ordinary users do not become operators by registering. The browser can be controlled through its restricted preview; set `INSTAGRAM_HEADLESS=false` for a visible native browser window.

Before clicking Follow, the code checks the logged-in sender and the target profile, checks consent age, requires a visible private-profile marker and persists an attempted-action record. Ambiguous outcomes become `needs_check`; they are not automatically clicked again. Existing Requested/Following controls are left alone. Instagram can block automation or change its layout, and its CAPTCHA/verification remains manual.

Withdrawing permission stops future service actions. It does not magically remove an Instagram follow that already happened. The account owner can remove the service account inside Instagram. Account deletion removes that user's local queue records.

The bot is local-only and unavailable in Vercel's serverless runtime. A follow request does not implement private-post extraction, private-image scanning or a complete social-account audit. Those capabilities must not be claimed in the presentation.

## 8. Pop extension: how the real code works

The extension shares plain JavaScript across browsers, with separate manifests/background declarations. There is no React or build framework inside it.

| File in `extension/` | Responsibility |
| --- | --- |
| `manifest.json` | Chromium permissions, toolbar popup, background worker and website bridge. |
| `manifest.firefox.json` | Firefox background scripts, supported version and optional data-collection permissions. |
| `shared.js` | Browser API wrapper, identifier normalisation, matching and safe page-address cleaning. |
| `background.js` | Page injection, permission changes, privileged screenshot capture, pairing and backend chat requests. |
| `pet.js` | Small draggable cat, pet reactions, right-click tools, minimise/snooze/site disabling. |
| `page-scan.js` | Bounded rendered-text traversal, match highlighting and next/previous navigation. |
| `sharing-guard.js` | Supported paste/edit detection and explicit keep/remove warnings; password fields are ignored. |
| `panel.html`, `panel.js`, `panel.css` | Small browser-toolbar popup and its controls. |
| `workspace.html`, `workspace.js` | Evidence review, local incident records, chat and link inspection. Settings routes hand off to the website. |
| `evidence.js` | IndexedDB records, flattened image handling, incident export and deletion. |
| `website-bridge.js` | Restricted messages between the approved STRIKEOUT website and local extension preferences. |
| `settings.html`, `settings.js` | Browser Options entry that opens website settings. |
| `ai-permission.html`, `ai-permission.js` | Native browser permission handoff for optional AI communication, particularly Firefox. |

Clicking the cat pets it. Right-clicking opens tools. The cat's position belongs to its host, so hiding a menu does not move it to a different corner. The pet's shadow DOM keeps page styles from changing its interface. Site permissions determine where it can appear after navigation. It cannot run on browser-internal pages, extension stores or every inaccessible frame.

Page scanning compares the local watchlist against rendered text. It does not inspect images or claim that a logged-in page is public. Sharing Guard warns after supported edits or pastes; a website may already have received the text. Remove changes text only after the user asks. No feature can guarantee prevention of all accidental sharing.

Screenshot capture checks the active tab, hides Pop's visual controls, captures the visible area and opens a review. Redaction boxes are painted onto the saved image. The original screenshot is not included in a saved redacted record. This is permanent image redaction, not a removable CSS rectangle. Original pending captures use session storage; saved records use IndexedDB.

Settings are on the website under Delivery & Pop. The first connection asks permission to manage the local watchlist. The bridge accepts only same-window messages from supported website origins and exposes narrow actions; it does not return the chat token or saved evidence images. The website can see watchlist values when the user explicitly connects it, so do not claim the website can never access those values.

Pairing creates a short-lived single-use code after website login. The extension exchanges it for a scoped expiring token, stored locally. AI chat sends typed messages and deliberately included context. It never automatically appends the watchlist, page contents or screenshots. The three core tools still work without AI.

## 9. Website file map

| File | What to read there |
| --- | --- |
| `server.mjs` | Loads private local environment variables, mounts the API and serves Vite or the production build. |
| `vite.config.ts` | Uses `frontend/` as the application root and builds into `dist/`. |
| `frontend/index.html`, `frontend/src/main.tsx` | HTML entry and React startup. |
| `frontend/src/app/App.tsx` | Desktop windows, taskbar, icons, dragging, minimising, focus order and opening separate apps. |
| `components/RecoveryApp.tsx` | Login, private case forms, evidence, report stages, complaint review, services and delivery/extension settings. |
| `components/recovery.css` | Windows 98 appearance for case/exposure controls. |
| `components/ExposureApp.tsx` | Consented OSINT forms, local password hashing, coverage/results and JSON download. |
| `components/InstagramPanel.tsx` | Account-owner requests, queue status, withdrawal and restricted operator controls. |
| `frontend/src/app/document-text.ts` | Local PDF/plain-text extraction with size/page limits. |
| `components/GuideChat.tsx` | Visible Pop chatbot and optional selected-case context. Clears context on sign-out. |
| `components/PopCompanion.tsx` | Minimal website cat. This is separate from an installed browser extension. |
| `components/GuidedTour.tsx`, `TourHighlightBox.tsx` | Supplied animated tutorial and highlighted controls, connected to the real desktop. |
| `components/ExtensionDemoApp.tsx` | Fictional, interactive extension simulator. It does not install the extension or capture arbitrary real tabs. |
| `components/GetPopApp.tsx` | Current Chromium/Firefox packages and installation instructions. |
| `components/SettingsApp.tsx`, `ScreenSaver.tsx`, `CatnipApp.tsx` | Supplied desktop appearance and pet extras. |
| `components/ServiceConsole.tsx`, `ServiceStatus.tsx` | Actual service health and harmless browser commands. |
| `frontend/src/styles/` | Desktop fonts, Tailwind utilities and base theme. |
| `frontend/public/` | Local artwork, font, demonstration page, connection page and current extension ZIPs. |
| `shared/reporting-client.js` | Browser API calls for cases/evidence/drafts and stale-write handling. |
| `shared/reports-client.js` | Report API calls and advancing saved jobs until ready. |

Component paths above are relative to `frontend/src/app/` unless a longer path is shown. The repository may retain teammate source under `OSINT BACKEND/`; the running unified website uses `api/osint/`, not a second server on port 3010.

## 10. Backend file map

| File in `api/` | Responsibility |
| --- | --- |
| `index.mjs` | Express startup, authentication/session helpers, request protections and route mounting. |
| `store.mjs` | Local/private-cloud JSON storage, record hashes, conditional writes and atomic local saves. |
| `reporting-core.mjs` | Case/evidence validation, deterministic complaint drafting, source fingerprints and approval rules. |
| `reporting.mjs` | Authenticated case, evidence, complaint, submission and follow-up endpoints. |
| `reports.mjs` | Saved report versions/stages, email verification, PDF downloads, summary, guidance and progress. |
| `report-ai.mjs` | Gemini research/writing/help prompts, schemas, official references and output validation. |
| `report-pdf.mjs` | PDF layout, line wrapping, page breaks and saved-report rendering. |
| `report-mail.mjs` | Optional Resend delivery adapter and acceptance handling. |
| `pop.mjs` | Website chat, scoped extension pairing, chat token revocation and AI request limits. |
| `osint.mjs` | Authenticated OSINT endpoints and provider capabilities. |
| `osint/osint.mjs` | Supported check types, consent, validated inputs and combined coverage. |
| `osint/providers.mjs` | Bounded provider HTTP requests and GitHub/Brave/HIBP integrations. |
| `osint/documents.mjs`, `redact.mjs` | Supplied-text findings and masking sensitive evidence. |
| `osint/instagram.mjs`, `identifiers.mjs` | Local consent queue, restricted service browser, sender checks and request transitions. |
| `google-auth.mjs` | Optional Google OAuth redirect/callback, state/nonce/PKCE and verified ID-token login. |
| `core.mjs` | Earlier deterministic source/repair helpers still used by compatibility endpoints. These are not the new Exposure app's internet coverage. |

Important routes: `/api/auth/*` for login, `/api/reporting/cases/*` for case work, `/api/reports/cases/:id` to create/list report versions, `/api/reports/jobs/:id/advance` to run the next stage, `/api/reports/jobs/:id/pdf` to download, `/api/reports/jobs/:id/help` for summary/guidance, `/api/osint/*` for exposure checks, `/api/instagram/*` for local consented requests, and `/api/guide/chat` for the website chatbot.

## 11. Setup and optional external configuration

Use Node.js 22 or later. From the repository root:

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local privately. Do not replace an existing configured file.
npm run dev
```

Open `http://localhost:3002`. One server serves the frontend and backend, avoiding separate cookies/accounts and cross-origin setup. To serve a production build locally:

```powershell
npm run build
$env:NODE_ENV='production'
npm start
```

| Environment setting | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Optional Gemini reports and chat. Never put it in `VITE_*`. |
| `GEMINI_MODEL`, `GEMINI_RESEARCH_MODEL`, `GEMINI_REPORT_MODEL` | Provider model choices. Availability and quota depend on the account. |
| `RESEND_API_KEY`, `REPORT_EMAIL_FROM` | Actual email delivery using a verified sender. |
| `BRAVE_SEARCH_API_KEY`, `HIBP_API_KEY` | Optional broader web search/email breach coverage. |
| `INSTAGRAM_OPERATOR_USERNAMES` | Existing STRIKEOUT usernames permitted to control the local service browser. |
| `ALLOWED_ORIGINS` | Exact approved local Instagram frontend origins. |
| `INSTAGRAM_HEADLESS` | Set `false` for a visible native operator browser. |
| `BLOB_READ_WRITE_TOKEN`, optional `STORAGE_BACKEND=blob` | Private durable cloud storage. Vercel must have persistent storage configured. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Optional Google sign-in; deferred until project credentials are available. |

For Instagram, install the browser with `npx playwright install chromium` if absent, set an operator username, restart the server, sign into that STRIKEOUT account and open Check Exposure's operator section. The service Instagram account needs to exist and be logged in; the application does not invent credentials or bypass verification.

For Google sign-in, create a Web application OAuth client and register the exact callback, such as `http://localhost:3002/api/auth/google/callback`, in Google Cloud. Production uses the exact HTTPS website callback. Add the three server variables and restart. The UI shows the option only when configured. Google accounts get their own case ownership based on Google's stable subject ID; there is no automatic merge with an existing password account. The OAuth flow uses state, nonce, PKCE and server-side token verification following [Google's OpenID Connect documentation](https://developers.google.com/identity/openid-connect/openid-connect). No live Google login is claimed without project credentials.

## 12. Installing and demonstrating the extension

Run `npm run package:pop` after changing extension source. Current development packages are v2.1.3. Windows packaging uses PowerShell's archive command. Downloads on the website must contain those newly built packages, not an older ZIP.

Chromium: unzip the Chromium package, open `chrome://extensions`, enable Developer mode, click Load unpacked and select the folder containing `manifest.json`. Edge/Brave use their corresponding extension pages. After replacing files, reload the extension and refresh affected tabs.

Firefox/Zen: unzip the Firefox package, open `about:debugging#/runtime/this-firefox`, click Load Temporary Add-on and select `manifest.json`. Temporary installation ends when the browser closes. Firefox 142+ is required by the current manifest. Store signing/publication is separate.

Open the website, sign in, choose Delivery & Pop, connect the installed extension and approve the local settings bridge. Add a fictional identifier, save preferences, then use the extension toolbar to allow Pop on a demonstration page. Pet with left click; open tools with right click. For optional chat, pair the account and complete the browser AI permission grant.

Presentation sequence: create a fictional incident, add a note, generate a report or labelled local fallback, download the PDF, show the reviewed complaint draft, open the separate Exposure app and review fictional supplied text, then demonstrate the installed extension on `pop-demo.html`. Use the simulator only as an explicitly labelled walkthrough. Do not demonstrate an actual follow unless the consenting owner and operator are ready.

## 13. Tests and practical limits

`npm test` runs backend/data tests. `node tests/final-desktop.mjs` exercises real desktop signup, case/evidence, complaint export, report consent, exposure navigation and settings. `npm run test:pop:browser` installs temporary Chromium and Firefox extensions and verifies local tools, saved redaction pixels, export and deletion. `npm run check:reports:live` uses a fictional case to check actual Gemini research/writing and PDF generation without sending email.

Mock-provider tests verify our handling of responses and failures; they do not prove a provider account has quota or a private Instagram login works. Browser tests use temporary profiles rather than altering the user's normal installed extension.

The current storage and rate limiting suit a hackathon prototype. Limits are process-local rather than distributed. A production service would need operational monitoring, backups, stronger account recovery, delivery webhooks, reviewed retention policies and a database designed for multi-instance transactions. Those are future engineering tasks, not features to claim as completed.

## 14. A short explanation you can say aloud

“Our React frontend gives users a Windows 98 workspace. An Express backend owns the private accounts, cases and evidence. Report generation saves a snapshot, researches generic official guidance, asks Gemini to write structured content, validates it and turns it into a downloadable PDF. Work is saved between stages so it can resume. Exposure checks tell the user exactly which providers and content were examined. Pop's core browser tools run locally, and AI is optional. The Instagram feature is a consent-based local follow workflow, not private-account scraping. We used AI to help implement the code, and we can trace each feature from its interface through its request handler to storage or its external provider.”
