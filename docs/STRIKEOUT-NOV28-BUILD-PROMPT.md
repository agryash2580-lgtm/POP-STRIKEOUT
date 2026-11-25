# StrikeOut Nov 28 build prompt

Copy the prompt below into Codex with the StrikeOut repository open. It is written for the current project and the team’s November 28, 2026 target.

---

## Prompt

You are working in the existing StrikeOut repository. Help the team prepare a truthful, safe, demo-ready release for **November 28, 2026**. This plan was drafted November 17 and updated November 25. The feature freeze has arrived: prioritize verified release-blocking fixes and rehearsal over new features. See [Kush's current delivery register](KUSH-NOV28-READINESS.md) for evidence and outstanding dependencies.

### How to work

1. Inspect the repository, current GitHub state, tests, deployment files, and existing readiness documentation before changing code. Preserve working features and the current visual identity. Do not treat this as a greenfield rewrite.
2. Treat this checklist as team-provided status, not proof. Verify each checked item where possible. Mark an item complete only with concrete evidence, such as a merged change, a working URL, a receipt, a finished artifact, or confirmation from its owner. Label unverified claims as “reported, not verified.” Never invent progress, provider results, publication, tickets, or endorsements.
3. Create or update one progress ledger covering every checklist line. Each row must include status (`done`, `in progress`, `blocked`, or `not started`), owner (use `unassigned` if unknown), due date, evidence, and blocker/next action. Keep engineering tasks distinct from tasks that require a person, event organizer, printer, publisher, or account owner.
4. Start useful repository work without waiting for choices that can be safely resolved from the code. Ask the team only when a decision, credential, physical action, or external authorization is genuinely required. Do not expose secrets in logs, reports, commits, screenshots, or test output.
5. Make small, reviewable changes. Keep existing API contracts unless a change is necessary; document any changed contract and update its consumers. Run the relevant checks after each meaningful change and report the actual result.

### Team checklist to reconcile

Use the following as the initial ledger. Preserve the notes and current checkmarks, then verify them:

| Item | Reported status / note | Primary owner |
|---|---|---|
| GDG tickets | In progress. Kush reports contacting Shubham Sharma on Nov 5 around 7:00 AM; an email was sent and has no response. The organizer asked for Kush’s phone number. | Swarit coordinates through the official channel; Kush provides his own contact details directly |
| Landing advertisement page | Not started | Yash; Kush reviews claims and CTA |
| Website domain | Outstanding: the team corrected the earlier checkmark on Nov 25 and confirmed it does not have a domain yet. No purchase or DNS change has been made. | Swarit coordinates; each registrant provides their own evidence |
| Website hosting | Not started | Swarit; Kush checks app/storage compatibility, Yash checks demo usability |
| Working reverse OSINT | Not complete until supported, authorized flows pass with honest source and error reporting. Kush takes backend/OSINT ownership and coordinates a handoff of Swarit’s existing data-retrieval work before changing it. | Kush; Swarit integrates and verifies the release path |
| SaaS product explainer video | Not started | Yash; Swarit supplies an accurate feature walkthrough, Kush checks claims |
| Newspaper publication | Not started; publication timing depends on the publisher | Yash coordinates; Kush reviews factual claims |
| Instagram publication | Not started | Yash coordinates; Kush reviews factual claims |
| NFC tags | Arrived, per team update; verify quantity and that the tags can be programmed | Swarit |
| NFC receivers/readers | Not yet received; record order/ETA and keep setup testing blocked until available | Swarit |
| NFC tags 3D printed | Not started | Yash |
| Fully working website | Not complete until the release checks below pass | Swarit accountable for release; Yash owns landing/UI and visitor journey; Kush owns backend/API integration |
| Parental controls | Not started; define as consent and safety protections | Kush proposes the technical scope; Swarit reviews privacy; Yash reviews usability |
| Kush domain | Unverified; no domain was supplied. The Nov 25 correction supersedes assuming the project domain is complete. | Kush |
| Swarit domain | Earlier personal-domain checkmark is unverified; do not infer that a shared StrikeOut domain exists. | Swarit |
| Yash domain | Not started | Yash |

### Work split and handoffs

- **Kush — backend and exposure checks:** take ownership of supported exposure checks, authorization gates, source/error reporting, and backend tests; propose only consent-and-safety parental controls. Coordinate a handoff of Swarit’s existing data-retrieval work before editing it, preserve useful work, and avoid duplicate implementation.
- **Swarit — hosting and release coordination:** track the outstanding NFC receivers and their ETA, verify tag quantity/programming, and coordinate the GDG follow-up through the official channel; compare free-first hosting and prepare the self-host checklist without purchasing, changing DNS, or deploying; coordinate integration and final rehearsal. Swarit is the release owner for the complete website. Kush supplies any personal contact details directly if the organizer needs them.
- **Yash — visitor experience and event materials:** build the landing/ad page and own front-end visitor-flow and phone-size review; coordinate the explainer video, Instagram and newspaper items, NFC 3D printing, and Yash’s domain evidence. Once the receivers arrive, verify a tag can be read by the intended setup and record the result. Get feature and claim details from Swarit and Kush before describing them publicly.
- **Cross-review:** Kush reviews hosting/runtime compatibility; Swarit reviews OSINT scope, privacy claims, and external-facing claims; Yash reviews whether the app and runbook are understandable to a first-time visitor. Each owner records evidence and blockers in the shared ledger. Each person remains responsible for confirming their own domain details; do not transfer another person’s account or DNS changes between owners.

Use the existing Nov 18/21/24/25/26–28 milestones for these assignments. Where a milestone does not fit an external publisher, printer, or event organizer’s timeline, record the dependency and a proposed next date; do not silently mark it done or move the event deadline.

For the GDG phone-number request, do not search for or infer a person’s private phone number. Swarit may coordinate the follow-up through the organizer’s official channel; Kush must provide any of his own contact details directly. Do not email, call, message, post, or publish on anyone’s behalf.

### Product and safety requirements

- Keep the exposure checker consent-based and limited to capabilities that already exist or can be implemented safely in this project. Require the target-ownership proof already designed for each personal search. Account sign-in, a checkbox, or TOTP alone is not proof that the searched Instagram, phone, profile, image, or domain belongs to the user.
- Keep unsupported target types locked. Do not add private-account access, credential discovery, password collection, stalking/location inference, scraping of private chats, mass harvesting, or bypasses of platform controls.
- Show which sources were checked, which were unavailable, and what a result can and cannot establish. An empty result is not proof that a person has no exposure. Keep synthetic demo data clearly fictional and separate from live results.
- Define parental controls as privacy-preserving consent and safety protections, not a parent surveillance dashboard. Do not claim legal compliance. If an age threshold, jurisdiction-specific rule, or guardian-verification method is needed, document it as a team/legal decision and keep the affected feature gated until decided.
- Preserve the offline fictional demo and make it easy to start, reset, and use without an account, API key, or internet connection. Do not replace real failures with synthetic success.
- Do not add collection or analytics that are unnecessary for the demo. Do not put real people’s identifiers or live findings on a booth screen.

### Engineering work and order

1. **Audit and triage:** map the current architecture and existing checks; verify the checklist; list P0 release blockers and dependencies; add the progress ledger to the repo’s readiness documentation.
2. **Landing/ad page:** add a clear, responsive public introduction that explains StrikeOut in plain language, links to the existing app and fictional demo, and makes no unsupported “whole web,” safety, partner, or endorsement claims. Preserve existing app entry points and deep links.
3. **Website and exposure reliability:** inspect the actual user journeys, fix reproducible high-priority defects, retain authorization gates, and make loading, empty, partial, and failed-provider states understandable. Do not claim external providers work unless the relevant authorized smoke check succeeds.
4. **Consent and safety:** review the consent and age-related experience. Add only the minimum safety behavior that can be implemented from known requirements; document decisions that need team or qualified review instead of guessing.
5. **Hosting decision:** compare currently available free options first against the project’s actual runtime, persistent-storage, HTTPS, backup, and operational needs. Verify current limits from official documentation and provide the cheapest viable fallback. The repo already has a Docker Compose/Caddy single-server setup; assess whether the free option can run it safely. Do not create accounts, buy hosting, alter DNS, upload secrets, or deploy publicly. Leave a clear setup checklist for the team’s chosen host.
6. **Demo readiness:** verify the offline demo, app startup, supported authentication and exposure flows, provider failure handling, data reset, and hosting runbook. Prepare a short rehearsal checklist and list any action requiring the actual booth device or another person.

### Non-code work and schedule

Keep publication, promotion, tickets, domains owned by individuals, hardware arrival/programming, ordering, and 3D printing visible in the same progress ledger, but do not perform external actions. Use `unassigned` rather than guessing an owner. Give each open task a proposed deadline early enough for the team to act before Nov 28, and label proposed dates as proposals. Flag newspaper lead time, ticket availability, receiver shipping, and print-shop timing as external dependencies. Prepare no posts, press copy, or messages unless the team separately requests drafts.

Use these project milestones unless the team provides a better schedule:

- **Nov 18:** repo audit, evidence-based ledger, release blockers, and human owners identified.
- **Nov 21:** landing page and agreed high-priority product fixes ready for review; external production tasks confirmed with their owners.
- **Nov 24:** production-style local hosting check, accessibility pass, and booth-material status reviewed.
- **Nov 25:** feature freeze. After this, change only release-blocking defects.
- **Nov 26–27:** rehearse on the intended laptop and at least one phone-sized screen; verify the offline fallback and reset between visitors.
- **Nov 28:** show only the tested frozen version and state any remaining limitations clearly.

### Verification and definition of ready

Use the repository’s documented checks (including its full `npm run check` and self-host Docker/Compose CI path where available). Add no tests that merely restate implementation; add or update meaningful tests for changed behavior. Perform or document manual checks for:

- keyboard navigation, visible focus, labels and announcements, contrast, and phone-sized layout;
- the landing page, existing app entry, and offline fictional demo, including reset;
- authorized exposure journeys, locked unsupported targets, and honest partial, timeout, and provider-error states;
- startup and health checks in the production-style self-host setup, persistent storage, and recovery instructions;
- no-network operation of the fictional demo and clean reset before the next visitor.

Do not call the whole release ready just because unit tests pass. “Ready to show” requires a working landing page and app, a repeatable offline demo, clear consent and limitations, successful relevant automated checks, and a real team rehearsal. Physical tasks count as done only with real evidence. If a dependency cannot be verified without a team member, credential, DNS change, purchase, external publication, or physical device, leave it blocked with the exact owner action needed.

### Final report

At the end, report:

1. What changed and where, with links to the relevant files or PRs.
2. The progress ledger and evidence for every completed item.
3. Checks run and their actual outcomes.
4. Remaining blockers, each with owner, next action, and deadline.
5. The hosting recommendation with current official-source links and any cost or reliability caveat.
6. A short demo runbook and the exact claims the team can safely make on Nov 28.

Never mark a task done merely to make the checklist look complete. Keep the team’s release goal moving, but report the truth when a deadline, provider, or external party prevents completion.

---
