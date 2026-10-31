# Pop by STRIKEOUT

Latest extension: **v2.1.1**. This repository contains the current extension source and current Chromium/Firefox packages only.

## Download

- [Chromium v2.1.1](downloads/pop-chromium-2.1.1.zip)
- [Firefox v2.1.1](downloads/pop-firefox-2.1.1.zip)

Open a ZIP link and choose **Download raw file** on GitHub.

## Install

**Chrome / Edge / Chromium:** extract the Chromium ZIP. Open chrome://extensions (or edge://extensions), enable Developer mode, choose Load unpacked and select the extracted folder. You can also load this repository root directly.

**Firefox / Zen:** extract the Firefox ZIP. Open about:debugging#/runtime/this-firefox, choose Load Temporary Add-on, then select its manifest.json. Use a Firefox-based browser version supporting Firefox 142+ APIs. Temporary Firefox add-ons are removed when the browser closes.

When updating, reload the extension and refresh open webpages. The toolbar title bar should show **2.1.1**. The repository-root manifest is for Chromium; the Firefox ZIP contains the Firefox manifest.

## What it does

- A minimal 220px Windows 98-style toolbar, with extra controls under More.
- A draggable 48px companion. Click him for head pats, hearts and sarcastic replies.
- Minimise hides speech without moving the cat.
- A local watchlist for your emails, phone numbers and usernames.
- Page checks highlight watched identifiers in rendered text.
- Paste warnings offer explicit removal from supported editable fields. Password fields are ignored.
- Capture the visible tab, review/redact the screenshot, group local evidence into incidents and export it.
- Optional AI chat through the STRIKEOUT backend. No API keys belong in this repository or the browser extension.

Click the browser extension icon for the tools. Choose Show to bring Pop to the current website. Under More, allow this site or enable following across websites if you want him to return after navigation. Browser-internal pages and protected extension-store pages cannot host Pop.

The three core safety tools work locally without AI. Page checks do not establish public visibility or prove safety. Paste warnings cannot recall text a site already received. Evidence capture is not authenticated forensic proof.

## Source map

- shared.js: browser API compatibility and identifier/link matching.
- pet.js: companion, petting, dragging, speech, snooze and position handling.
- page-scan.js: rendered text checks and highlighting.
- sharing-guard.js: supported editor/paste checks and approved removal.
- panel.html / panel.js / panel.css: compact toolbar and Windows 98 theme.
- evidence.js: local evidence database and exports.
- workspace.html / workspace.js: watchlist, evidence review, chat and settings.
- background.js: permissions, persistent page injection, capture and backend requests.
- manifest.json / manifest.firefox.json: current platform manifests.

## Optional AI

Local tools need no backend. Chat requires a compatible STRIKEOUT backend with the Pop pairing/chat endpoints and a server-side Gemini key. The updated backend is not included in this extension-only repository; hosted chat depends on deployment/configuration. Enable chat and pair through Settings only when that backend is available. Never put a Gemini key into extension files.

Watchlists and evidence are not automatically attached to chat. Reviewed text handoffs create website drafts; they do not file official complaints or upload screenshots automatically.
