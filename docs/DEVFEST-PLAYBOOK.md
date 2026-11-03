# StrikeOut exhibition playbook

Target date supplied by the team: November 28, 2026, DevFest Indore.
Read [the readiness register](../DEVFEST_READINESS.md) before claiming release readiness.

## Project overview

StrikeOut helps people understand possible exposure of their own public information
and choose practical privacy steps. Supported live checks review user-supplied
document text or bounded public-search responses, with consent, authentication,
source status and masked sensitive patterns. It also includes incident cases,
evidence organisation, reviewed recovery reports and the Pop browser companion.

The exhibition demonstration is separate: fixed fictional examples, no external
searches, no accounts, no visitor information. It demonstrates the experience,
not a new live scan. It does not demonstrate that every live provider is operational.

Intended impact: make exposure easier to understand without encouraging personal-data
harvesting, treating search matches as verified identities or displaying sensitive
information on a booth screen. There are no verified adoption or impact metrics.

## Start the booth laptop

Before travel, install Node.js 22+ and prepare the offline folder:

```sh
npm ci
npm run check
npm run package:demo
npm run qr:demo
```

Copy `output/devfest-offline/` to a second device or USB drive. It contains only
five runtime files, a start guide and checksums. Do not copy `.env.local`, `.data`,
browser profiles, personal exports or the whole working folder to a shared USB.

At the booth, from the offline folder:

```sh
node scripts/serve-demo.mjs
```

Open `http://localhost:3031/devfest.html`. Keep the terminal open. This server is
local to the laptop; visitors cannot reach its localhost address from their phones.
Internet may be disconnected while the local server remains running. The page
does not cache itself for use without a local server.

For development, `npm run demo` starts the same isolated server. The full app also
serves `/devfest.html`, and Check Exposure links to it before the live MFA gate.

## 30-second demonstration

“Your public information can be scattered across old pages and documents.
StrikeOut helps you review possible exposure and decide what to change.
This is a fictional example, so nobody’s private information is on screen.”

Choose **My old contact details**, acknowledge the notice and explore. Point to
the masked phone finding, source coverage and recommendation.

“Here is what was found, how strong the evidence is and the next step. A search
result is a lead—not proof that someone is unsafe.”

## 90-second demonstration

1. Introduce the problem and explicitly say the example is fictional.
2. Choose **My old contact details** and acknowledge the notice.
3. Show the three bundled sources. Open one fictional source excerpt.
4. Compare the phone and email findings. Explain that intentional public contact
   details are not automatically harmful; priority and evidence confidence differ.
5. Read the original-document removal and search-cache refresh recommendation.
6. Mark a recommendation reviewed. This does not remove anything from the web.
7. Prepare the fictional JSON summary; show its copyable preview and download link.
8. Reset for the next visitor. If asked about failure handling, run **A source is
   unavailable** and explain why no result is inferred for that source.

## Three-minute technical demonstration

**0:00–0:35 — architecture:** React/TypeScript desktop, same-origin Express API,
session-based access and private JSON records in local files or Vercel Blob.
The offline page uses plain HTML/CSS/modules and a tiny Node static server.

**0:35–1:15 — live assessment:** session and TOTP step-up, validated input, explicit
provider consent, bounded search adapters or supplied-text review. Search indexes
are incomplete. Providers receive only the data approved for that check. Returned
text is treated as untrusted; source pages are not automatically crawled.

**1:15–1:55 — results:** exact snippet/text occurrences where applicable, pattern
masking, deduplication, provisional severity and evidence confidence, per-provider
completion status, local URL warnings and deterministic remediation guidance.
URL warnings are not a malware reputation lookup. No findings is not proof of safety.

**1:55–2:30 — engineering:** encrypted MFA secrets, replay protection and conditional
storage writes; bounded external requests and responses; deadlines and readable
failures; regression tests and a real frontend compiler check. The PDF parser loads
on demand. Explain the current process-local rate-limit and retention limitations.

**2:30–3:00 — honest boundary:** the booth example is fully fictional and works
without providers. MFA protects a StrikeOut account but does not prove ownership
of every target. Phone/Instagram searches stay locked pending target verification.
Do not promise private-account scanning, whole-web coverage or automatic removals.

## Reset and privacy between visitors

Use **Reset for next visitor**. The demo stores no personal information and uses
neither localStorage nor account storage. Reload is also a reset. Downloads remain
in the browser’s downloads folder; they are fictional, but tidy them during setup.
Keep production accounts signed out on visitor-facing machines. Do not invite
visitors to type passwords, card numbers or identity documents into a public demo.

## QR and feedback

`npm run qr:demo` generates `output/devfest/strikeout-demo-qr.png` for the public
`/devfest.html` URL and verifies its matrix using an independent decoder.
The public destination now opens in a browser. **Scan the printed QR on a separate
phone before booth use.** The live page and GitHub feedback
links need internet when opened. Feedback uses a public GitHub Issue form; it
requires a GitHub account. Do not submit personal incident details there.

Current fictional screenshots: [desktop landing](assets/devfest-landing-desktop.jpg)
and [mobile results](assets/devfest-results-mobile.jpg). The QR asset is
[here](assets/devfest-demo-qr.png), pending physical-phone verification.

A dedicated visitor email/interest database is intentionally absent until contact
ownership, consent, retention and a delivery process have been agreed. No contact
details are silently collected.

## Public claims and recognition

The team reports winning ₹35,000 at MU20 and receiving recognition/support from
Uplife and Sonali Guha. Supporting evidence and exact relationship wording remain
unverified here. Before printing those claims, record evidence and approved wording.
Do not use external logos, call anyone a partner/sponsor or imply endorsement
without their permission. Do not invent user counts or performance outcomes.

## Freeze checklist: November 25–27

- Record the final commit and successful deployment, with a rollback revision.
- Run checks, inspect provider status and test the dedicated demo on the actual laptop.
- Repeat the workflow at desktop and phone sizes, by keyboard, and with internet off.
- Test reset, empty results, unavailable source and the copyable summary.
- Verify the QR from a different phone on the public URL.
- Carry the offline folder, charger, adapter and a second copy.
- Rehearse all three scripts; time them with a person unfamiliar with the project.
- Confirm who owns the booth machine and handles failures. Freeze new features.
