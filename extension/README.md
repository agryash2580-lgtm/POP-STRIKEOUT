# Pop: install, demonstrate, explain

Pop 2.2.0 is STRIKEOUT's browser companion. He finds information you asked him to watch,
warns after you paste it, and helps capture reviewed evidence. Petting him is a
fully supported business operation.

## Install for the hackathon

Chromium means desktop Chrome, Edge, Brave and other compatible Chromium browsers.

1. Extract `pop-extension.zip` to a folder you will keep.
2. Open `chrome://extensions` (or `edge://extensions`). Enable Developer mode.
3. Choose **Load unpacked** and select the folder containing `manifest.json`.
4. Pin Pop's extension icon. Open an ordinary website, click the icon, and choose
   **Show Pop**. Click the cat for head pats. Open the extension icon for all tools.
5. Expand **More**, then choose **Always appear here** or **Follow across websites** if you
   want him to return after navigation. These options ask for website access.

The toolbar is a compact 220px-wide window, with extra controls under **More**.
The companion is a fixed 48px square. Speech is a small, temporary overlay and
cannot change the cat's position. Minimise hides speech and leaves Pop where you
placed him. Left-click the cat to pet him; right-click for tools. The browser extension icon also opens the toolbar. The popup,
settings, chat and evidence screens share a Windows 98 theme: teal desktop, gray
bevelled controls, navy title bars and square windows.

When updating, replace the extracted files and reload the extension in your browser's
extension manager, then refresh already-open websites. The popup title bar should say
`2.2.0`. The hosted website may still offer an older ZIP until it is deployed.

Firefox:

1. Extract `pop-firefox.zip`. Use a current desktop Firefox (142 or later).
2. Open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on** and select the extracted `manifest.json`.
4. Open a normal website and use Pop's toolbar icon as above.

The Firefox development installation is removed when Firefox closes. A permanent
installation needs Mozilla signing; this package is not a signed store release.
Protected pages, extension stores and built-in PDF viewers cannot host the cat.

## A three-minute demonstration

Run STRIKEOUT locally with `npm ci` and `npm run dev` if dependencies are not yet
installed. Open `http://localhost:3002/pop-demo.html`. This page contains fictional
information and never submits the draft fields.

1. Open Pop's **My watchlist**. Add:
   - email: `alex@example.com`
   - phone: `+1 202 555 0147`
   - username: `@alex_demo`
2. In the toolbar's **More** menu, choose **Always appear here**, then **Scan**.
   Pop highlights three identifiers. Use Next in the toolbar. Hidden text and editors are
   excluded. Say "found on this page", not "publicly leaked".
3. Paste `Contact alex@example.com. Keep the rest.` into the draft bio. Pop offers
   Keep or Remove matched information. Choose Remove. The rest remains.
4. Click the formatted editor and choose **Draft** in the toolbar. Removing the email
   preserves the surrounding HTML formatting. The password field is ignored.
5. Click Pop for head pats, or use the toolbar's **Pet Pop** button. Pet him seven
   times quickly. He has opinions about your tabs. Drag him and minimise speech;
   he must remain exactly where you placed him.
6. Click the toolbar icon and **Capture**. Draw a redaction, review the
   address/title/selected text, name the incident and save it. Add another capture
   with the same incident name to group them.
7. Export the incident. The downloaded HTML contains a readable summary and the
   reviewed PNG images. Open it offline. Download individual screenshots if needed.
8. Refresh the demo page. Pop returns after the site permission was granted.

Do not demonstrate on real accounts or real personal information. A capture time
comes from the device clock; a screenshot is not authenticated forensic proof.

## AI setup

The three core tools and petting work without AI, a login or a server connection.

For AI, the STRIKEOUT server needs `GEMINI_API_KEY` in its environment. An optional
`GEMINI_MODEL` selects a different provider-supported model. The key belongs on
the server, never inside an extension file. Provider access and quotas are not
bundled with this ZIP.

1. In Pop Settings, keep the hosted STRIKEOUT address or save
   `http://localhost:3002` for development. Approve access to that server.
2. Choose **Open STRIKEOUT to get a pairing code**. Generate the code. This uses
   your website session or creates a guest workspace.
3. Paste the one-use code into Pop Settings and choose **Connect Pop**. Codes
   expire in five minutes. Chat access expires in seven days.
4. Enable AI chat after reading its disclosure. Firefox may also show its native
   data-transmission permission request.
5. Chat opens in an extension-owned window, outside the website's own page.

Each request includes your typed message, up to eight recent conversation messages,
and an address only if you deliberately supplied one. The watchlist, screenshots,
page body and other open tabs are not attached. Address queries, fragments and
credentials are stripped; review paths because they can contain personal data.
The server does not persist chat bodies; the AI provider has its own data policies.

Limits are six requests per minute per connection and 100 attempts per UTC day.
Failed provider attempts consume the daily allowance too. Errors are shown plainly.
Clear conversation deletes this browser's session history, not provider copies.
Disconnect revokes the server token. If the server is unreachable, revocation must
be retried later; the UI does not falsely claim it succeeded.

## Where data lives

- Watchlist/preferences/token: local extension storage, not browser sync.
- Chat and pending captures: browser-session extension storage.
- Saved reviewed screenshots and notes: extension-owned IndexedDB on this device.
- Evidence exports: wherever you download them.

The `downloads` permission saves only exports you explicitly request, through the
browser's download manager. Pop does not inspect your other downloads.

Evidence is limited to 50 records / 80 MB. Browser storage quotas can be lower.
Export before uninstalling, deleting a profile or clearing extension storage.
There is no encryption or cloud backup. Use the Delete controls to clear local
records. Exported copies and information already sent elsewhere remain elsewhere.

During screenshot review the original exists only in that review window after the
pending capture is consumed. Saving creates a new PNG from the redacted canvas;
only that flattened PNG is stored. Review text fields separately: drawing on an
image does not redact its selected-text field. Leaving the review window without
saving loses that capture. A pending capture never opened remains until the browser
session ends or local data is cleared.

The STRIKEOUT handoff asks for confirmation and opens an editable draft containing
the saved address, time, selected text and note. It does not upload the image.
Download and attach the reviewed screenshot yourself if needed. No official report
is submitted by the extension.

## Learn the code without memorising it

JavaScript is the language running inside the browser. Your Python knowledge still
helps: a JavaScript object is much like a dictionary, an array is much like a list,
and an `if` statement still makes a decision.

`function findMatches(text, watchlist)` means "take these two inputs and give me a
result". `async` / `await` means "wait for the browser or network operation without
freezing the interface". An event listener is a function the browser calls when
something happens, such as a paste or a button click.

### Read these files in this order

1. `manifest.json`: the browser's instruction sheet. Names the popup, permissions
   and background entry point. Firefox's version changes the background type and
   adds Mozilla-specific metadata. The package script selects the right one.
2. `shared.js`: selects Firefox's `browser` API or Chromium's `chrome` API as
   `PopAPI`, then defines pure rules. `findMatches` compares text with your watchlist and
   returns positions; `removeMatches` removes those positions from end to start
   so earlier positions do not shift. `cleanAddress` strips URL secrets. No AI.
3. `page-scan.js`: walks rendered text nodes, skipping editors and hidden content.
   It calls `findMatches`, wraps matches in marks, and can clear or jump between
   them. It limits work on very large pages. It cannot find text in images, closed
   page components, PDFs, other frames, or matches split across text nodes.
4. `sharing-guard.js`: remembers the most recently focused editable field. After
   a paste it checks that field. It never prevents the paste. Removal happens only
   after approval and sends an input event so websites can notice the edit.
5. `pet.js`: builds the small cat and temporary speech, handles dragging,
   keyboard movement, petting, snooze and site disable. Shadow DOM keeps website
   CSS out. It is not a security boundary against a malicious website.
6. `background.js`: handles browser-only actions such as registering page scripts,
   taking screenshots and calling the server. Page companions have only narrow
   message actions; privileged tools run from extension-owned pages.
7. `panel.html` / `panel.js`: all full controls live in this toolbar popup. Its click gives temporary access to
   the active tab; optional website permission lets Pop return on later pages.
8. `evidence.js`: simple database wrappers and offline HTML export. Exported text is
   escaped so a captured message cannot become executable markup in the export.
9. `workspace.html` / `workspace.js`: settings, watchlist, chat, evidence review and
   orchestration. Functions are grouped by feature; IDs connect HTML controls to
   their handlers. Canvas draws black rectangles over the captured image before
   creating the saved PNG.
10. `../api/pop.mjs`: pairing and AI on the server. Pairing codes are stored hashed,
    consumed with a conditional write and exchanged for a chat-only token. The
    provider's secret stays here. The AI has no tool that can perform actions.

### Three chains you should be able to explain

**Check page:** click → load local watchlist → walk text nodes → match identifiers →
highlight results. No network request and no AI judgement.

**Sharing guard:** paste event → read supported field → find watched matches → show
choices → explicit removal → tell the website an edit occurred. This cannot recall
text already transmitted by the website.

**Evidence:** toolbar click → screenshot + metadata → review/redact → canvas creates
flattened PNG → save locally → export or deliberately open a website draft.

For AI: question → background message → authenticated server request → Gemini →
reply. AI provides wording; the other functions perform the actual browser work.

## Checks and packaging

From the repository root:

```text
npm run test:pop
npx playwright install chromium firefox
npm run test:pop:browser
npm run package:pop
```

The browser tests install the real extension into temporary profiles. Test manifests
grant website access, including screenshot access, without a native permission prompt.
The test browses only its local fictional fixture. Native permission prompts and store signing are
separate manual checks; a small popup test also exercises the denial branch.
No personal browser profile is touched.

Versioned packages are written to `public/pop-chromium-2.2.0.zip`,
`public/pop-firefox-2.2.0.zip`, and
extracted development folders under `dist/pop/`. The packaging helper currently
uses Windows PowerShell's Compress-Archive. The extension itself has no framework,
remote executable code or runtime npm dependency.

The older unversioned download aliases are also updated when they are not locked
by an open archive window. Use the versioned ZIPs to make sure you have this build.
