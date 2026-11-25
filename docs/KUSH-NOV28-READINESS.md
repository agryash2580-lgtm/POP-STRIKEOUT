# Kush's November 28 delivery register

Updated November 25, 2026. This register follows the requested swap: Kush owns
backend/exposure checks and consent/safety technical scope; Swarit coordinates
hosting and the release; Yash owns the visitor experience and event materials.
It records evidence, not a claim that the entire website is deployed or ready.

## Assignments and evidence

| Requirement under Kush's name | Status | Evidence / deliverable | Next action and owner | Due |
|---|---|---|---|---|
| Existing data-retrieval handoff | Existing branch checked; any unpublished work unverified | GitHub comparison `feature/retrieval-priority...main` on Nov 25 showed main ahead by 92 commits, behind by 0. Existing prioritization tests run; no separate new crawler/export parser added. | Swarit identifies any unpublished work before Kush edits it. | Nov 25 |
| Supported exposure checks and backend/API integration | Repaired and locally verified; GitHub review pending | Shared consent validation rejects malformed provider selections before requests; Brave/HIBP attribution survives deduplication; Brave title/snippet masking; password prefix type check; Google successful-empty response normalized narrowly. | Kush ships the checked branch; Swarit verifies the chosen host. | Nov 25 |
| Authenticator and target-ownership gates | Locally verified | API tests enforce session, fresh grant, exact verified email, and explicit provider consent. Unsupported profile/phone/ID searches remain locked. Existing domain-proof tests cover scope, expiry and revocation. | Repeat on the selected host with operator-owned data after configuration. | Nov 26 |
| Backend tests and failure reporting | Local checks passed | Full syntax/type/test/build check; browser exposure journey passed 44 checks with fictional accounts. Regression fixtures cover invalid consent, unapproved targets, masked evidence and genuine versus empty-result errors. | Require Node 22/24 and self-host CI before merging. | Nov 25 |
| Live provider smoke checks | Partial capability verified, with explicit limits | GitHub and Pwned Passwords requests completed. SerpApi Bing and DuckDuckGo completed. Google initially exposed an empty-result parsing bug; after repair, a real `example.org` scoped Google check completed with zero findings. | These are reserved-example integration checks, not production-account verification or whole-web coverage. | Nov 25 |
| Consent/safety parental-controls technical scope | Proposal delivered; reviewer decision open | [Scope and acceptance criteria](CONSENT-SAFETY-SCOPE.md). Existing safeguards are specified precisely; no guardian dashboard or age rule is falsely claimed. | Swarit reviews privacy; Yash reviews usability. | Nov 26 |
| Hosting/runtime compatibility review | Existing single-instance design reviewed; host-specific review blocked | Node 22 Docker app, Caddy, persistent `.data` volume, stable MFA key, internal app port, encrypted offline backup/restore. No new dependency, migration, API path or deployment configuration required by these fixes. | Swarit supplies chosen host/architecture and configures persistent storage, DNS and TLS. | Nov 26 |
| Technical claims for landing page, video and publications | Technical wording supplied; final-artifact review blocked | Claim checklist below; existing fictional demo/playbook distinguish fixtures from live scans. No new landing/video/press/post artifact was found in this checkout or open PRs. | Yash supplies drafts; Kush verifies technical statements before use. | Nov 26 |
| Kush's domain evidence | Outstanding | User clarified Nov 25: “we dont have a domain yet.” No hostname/control evidence exists to inspect. | Team chooses/acquires domain; registrant provides hostname and completes proof without sharing credentials. | Nov 26 |
| Personal contact information for GDG | Human action if required | Existing checklist says organizer asked for Kush's contact details. No details were disclosed or messages sent. | Kush replies directly through the existing official channel if still needed; Swarit coordinates. | Before event |

## Local verification record

- Full check on Node 26.7: **183 tests passed**, syntax check, TypeScript check and
  production build passed. See the same named tests in GitHub CI for supported
  Node 22/24 results once the branch is reviewed.
- Exposure browser journey: **44 checks passed**, including real local MFA
  enrollment and replay-aware verification, ownership locks, supplied-content
  masking/export and 390px layout. Email-send/confirm UI responses are synthetic;
  the backend email proof is separately tested with a captured test mailer.
- Regression files: `tests/exposure-consent-provenance.test.mjs`,
  `tests/public-web.test.mjs`, `tests/provider-readiness.test.mjs`. Existing
  `tests/domain-ownership.test.mjs`, `tests/osint-authenticator-auth.test.mjs` and
  `tests/email-exposure-proof.test.mjs` remain part of the full check.
- Reserved-example provider smoke on Nov 25: GitHub, Pwned Passwords, Bing and
  DuckDuckGo completed. After the Google repair, the scoped Google check completed
  at 15:38 UTC with zero findings. Only counts/statuses were recorded; no result
  bodies, keys or personal searches were printed.
- Brave, HIBP email breach search, and verification-email delivery are not
  configured in the checked local environment. Their fixture tests do not prove
  live delivery. Lens needs an explicitly approved owned image URL; the smoke
  command now leaves it untested by default instead of contacting the old host.

The Google repair follows the documented combination of successful metadata,
fully empty organic state and the engine-specific empty-response message.
Unrecognized errors or missing result sections remain incomplete.
See [SerpApi's response documentation](https://serpapi.com/api-status-and-error-codes).

## Consent and provider behavior to preserve

Valid version-1 request shapes and API paths are unchanged. Malformed consent
lists now return HTTP 400 before any provider or image-host resolution. Local
document/link review still allows omission of the provider list because it makes
no external lookup. Provider configuration is not proof of availability. Free
search handoffs require a separate user click and are not imported results.

The current server is a single-instance app. A free static-only host or an
ephemeral filesystem cannot replace its persistent backend. Keep the stable MFA
key and encrypted backup key private and separate; restore procedures are in
`deploy/README.md`. Public DNS, TLS, email delivery, live domain/image proof and
actual-host recovery must be verified on the selected host, not inferred from CI.

## Technical wording for Yash's materials

Supported statements, subject to the configuration shown in the demo:

- “StrikeOut helps review references to your own verified email and supplied
  document text, with source coverage and practical next steps.”
- “Public-reference checks use bounded search-provider responses; matches need
  review and no search covers the whole web.”
- “An authenticator protects the StrikeOut session. Separate proof is required
  for an email or domain being searched.”
- “Password checks send only the first five SHA-1 characters; matching happens
  in the browser.”
- “The exhibition example is fictional and works locally without an account,
  provider key or internet connection.”

Do not describe the system as a private-chat reader, a way to follow and scan
private accounts, a whole-web crawler, a threat-intelligence reputation feed, a
guarantee of safety, or a deployed parental-monitoring product. Domain control
does not identify who appears in an image. Supplying an export/source label does
not independently verify that content. Recognition/adoption/partner claims need
their own evidence, and final promotional drafts still need review.

## What remains externally blocked

The domain and host are not selected/configured; verification mail is unavailable
locally; an owned public image is not supplied; unpublished retrieval changes and
final promotional artifacts are not available for review. The team still needs
physical-device/booth rehearsal. These items remain open; no purchase, public
deployment, DNS edit, email, publication or real personal-data scan was performed.
