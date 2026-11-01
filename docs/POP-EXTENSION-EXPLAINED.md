# Pop 2.3: explain the extension without pretending to know magic

Start here, then use `CODE-GUIDE.md` for the website/backend map. `extension/README.md` has installation and demo steps.

## The idea

Pop is a browser extension written in ordinary JavaScript, HTML and CSS. The cat is its interface. Matching and sharing warnings run locally. Browser APIs supply screenshots and page access. The STRIKEOUT server supplies signed-in chat, an evidence library and optional email. Gemini is optional for the core browser tools.

## Follow one click

When someone clicks Show in the toolbar, `panel.js` sends a message to `background.js`. The background checks the current tab and permissions, then injects shared helpers, the page scanner, sharing guard and cat interface. They create one small element on the page. A version marker prevents duplicate pets. On STRIKEOUT itself, the extension lets the website show its own pet.

A browser extension has separate environments. A content script can inspect a permitted page. The background has browser privileges. An extension-owned workspace can show forms, previews and local records. They communicate through `runtime.sendMessage`, much like sending a dictionary with an action name between Python functions running in separate processes.

## What each file does

| File | Job |
| --- | --- |
| `manifest.json` / `manifest.firefox.json` | Browser declarations: permissions, background entry, toolbar and supported websites. Firefox has its own background scripts and blocking request API. |
| `shared.js` | `PopAPI` chooses browser APIs; identifier validation, matching and URL cleaning are shared by the tools. |
| `pet.js` | Creates the 48px draggable cat, left-click reactions, right-click menu, speech, minimising and site/snooze preferences. A closed Shadow DOM keeps website styles away from its controls. |
| `page-scan.js` | Walks supported visible page text, checks watched identifiers, highlights matches and moves between them. No image or PDF reading. |
| `sharing-guard.js` | Watches supported paste/edit events, checks the same watchlist and offers explicit Keep/Remove. Password fields are excluded. |
| `background.js` | Handles messages, permissions, page injection, active-tab screenshots, account pairing and authenticated server requests. |
| `panel.html` / `panel.js` / `panel.css` | Compact toolbar interface. Extra tools stay under More. |
| `workspace.html` / `workspace.js` | Capture review/redaction, incident records, shared chat, downloads and link inspection. |
| `evidence.js` | IndexedDB storage, local deletion and readable incident exports with embedded screenshots. |
| `website-bridge.js` | Restricted communication between the approved website and local extension preferences. It never gives the website the private pairing token. |
| `link-guard.js` | Local lookalike-domain rules and one-time bypasses. No browsing history is sent to an AI. |
| `link-warning.html` / `link-warning.js` | Shows the hostname, Back, the real site and explicit Continue once. |
| `settings.html` / `settings.js` | Redirects browser Options to website settings. |
| `ai-permission.html` / `ai-permission.js` | Explicit optional AI/data-transmission permission, including Firefox's native permission. |

## The personal-information tools

The watchlist is one array in browser `storage.local`. Each item has an ID, kind and value. Both Check this page and the sharing guard call the same matching helper with that array. Enter information once in website Delivery & Pop after connecting this browser's extension.

For an email, matching needs a complete identifier boundary so it does not find `ann@example.com` inside `joann@example.com`. Phone matching tolerates ordinary spaces and punctuation. Usernames tolerate an optional @. These rules are deterministic, not AI guesses.

Paste warnings happen after a supported edit. A website may already have received the text. Remove changes only matched text after the user chooses it; it cannot undo a network transmission.

## Evidence from browser to report

1. Quick Save evidence asks for a name and explains that confirming requests screenshot/HTML sync and email. Advanced Capture & review leaves time to redact first.
2. The background checks that the source tab is still active, clones the rendered HTML, removes scripts/frames/form values, hides Pop and captures the visible tab. It checks again that the tab did not change.
3. The workspace paints opaque redaction boxes into a new image. Those pixels are permanently changed in the saved image. HTML is reviewed separately because image boxes cannot redact text in HTML.
4. `evidence.js` saves locally in IndexedDB first. Sync sends the selected screenshot and optional inert HTML with a paired account token. Large screenshots may be JPEG-compressed; oversized HTML is omitted with a message.
5. `api/pop-library.mjs` validates files and ownership, calculates SHA-256 hashes and records server receive time. Private cloud storage keeps the account's library. It refuses replacing an existing capture ID with different evidence.
6. `PopEvidenceLibrary.tsx` lists captures on the website. Add to case copies the screenshot and source notes into that case. It then appears among Report & PDF's evidence choices.
7. Downloads include the screenshot, HTML snapshot and metadata manifest. Email uses the user's verified delivery address, never a hardcoded developer address.

The HTML is an inert rendered-page snapshot, not every external resource or the original server response. Hashes can later show whether bytes changed; they do not prove the page was genuine or guarantee legal admissibility. Capture time uses the device clock; receive time comes from the server.

## One Pop conversation

The website session and extension pairing token identify the same account. `api/pop-conversation.mjs` stores one message list and approved case context. Both interfaces read it and send new messages through the same Pop generation function. The server supplies the history; it does not trust a client to invent previous messages. A short conditional-write lease prevents concurrent answers overwriting one another. History refreshes on opening/focus and roughly every five seconds while visible.

The user deliberately chooses case context. Watchlist values, page contents and evidence are not automatically added. Clearing the thread clears it across both interfaces; it does not delete provider-retained data. Unpaired or offline use still leaves scanning, paste warnings and local evidence available.

## Link protection

The guard creates a bounded set of duplicated, removed, transposed and digit-substituted .com spellings for selected brands. `instaagram.com` is one example. Chromium uses declarative network blocking; Firefox uses synchronous request interception with website permission. The warning appears before the destination loads. Continue once applies only to that tab. This is not a malware database and cannot identify every unsafe link.

## Storage and credentials

Local preferences/watchlist: browser storage. Pending capture: session storage. Saved local evidence: IndexedDB. Shared chat and synced evidence: private account records in Vercel Blob, or ignored `.data` files during local development. Gemini, Google OAuth and delivery secrets stay in server environment variables.

Email is implemented but needs credentials: a verified-domain Resend sender, or Gmail `SMTP_USER` and generated `SMTP_APP_PASSWORD`. The ordinary Google password is not accepted. Missing email setup does not block local saving, website syncing or downloads. Provider acceptance is not proof of inbox delivery.

## How to verify and explain it

`npm test` runs backend/matching tests. `node tests/pop-browser.mjs chromium` and `firefox` install the actual extension in temporary profiles and exercise its tools. `node tests/pop-sync-browser.mjs` exercises a real screenshot and account sync against the website using fictional data. No real lookalike website is contacted by the link test.

Say: "The extension runs predictable matching locally, uses browser permissions for page tools and screenshots, and pairs with our server for one shared Pop conversation and evidence library. AI did not implement the matching rules at runtime. We used AI to help write code, then tested the actual browser behaviour."
