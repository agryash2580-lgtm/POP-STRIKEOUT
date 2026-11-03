# Technical architecture and data handling

See [CODE-GUIDE.md](../CODE-GUIDE.md) for the broader code walkthrough.
This document describes the readiness branch; deployment is a separate step.

## Entry points

| Layer | Source | Responsibility |
|---|---|---|
| Desktop | `frontend/src/main.tsx`, `app/App.tsx` | React desktop and application windows |
| Recovery | `components/RecoveryApp.tsx` | Cases, evidence, reviewed reports and account screens |
| Exposure | `ExposureApp.tsx`, `AdvancedExposure.tsx`, `LinkRisk.tsx` | Consent, checks, source status, confidence and recommendations |
| MFA gate | `ExposureAuthenticatorGate.tsx`, `AccountSecurity.tsx` | Setup and step-up; does not establish target ownership |
| HTTP helper | `shared/http-client.js` | Same-origin exposure JSON requests, deadlines and safe failures |
| Full server | `server.mjs`, `api/index.mjs` | Local Vite or production assets; shared Express API |
| Assessment router | `api/osint.mjs` | Authenticated capabilities and MFA-gated POST endpoints |
| Search | `api/osint/osint.mjs`, `providers.mjs`, `public-web.mjs`, `search-provider.mjs` | Bounded provider requests and exact-match filtering |
| Local review | `documents.mjs`, `link-risk.mjs`, `redact.mjs` | Supplied text and URL rules, pattern masking; no page crawl |
| Interpretation | `prioritize.mjs`, `recommendations.mjs` | Provisional impact/evidence order and deterministic guidance |
| Storage | `api/store.mjs` | Conditional private JSON records, local files or Vercel Blob |
| Reports | `api/reports.mjs`, `report-ai.mjs`, `report-pdf.mjs`, `report-mail.mjs` | Reviewed, resumable report stages and optional delivery |
| Extension | `extension/` | Separate browser permissions, local watchlist and evidence tools |
| Offline demo | `frontend/public/devfest*`, `scripts/serve-demo.mjs` | Bundled fictional scenarios, no application API or provider calls |

## Live assessment sequence

```mermaid
sequenceDiagram
  participant U as Authorized user
  participant B as Browser
  participant A as Express API
  participant S as Private storage
  participant P as Approved provider
  U->>B: Sign in and verify fresh TOTP
  B->>A: Session cookie / authenticator code
  A->>S: Check account version and consume code atomically
  A-->>B: Session-bound exposure grant (up to 30 minutes)
  U->>B: Review scope and provider disclosure, approve
  B->>A: Validated assessment input plus consent
  A->>S: Recheck identity / grant / current MFA version
  alt Supplied document
    A->>A: Review supplied text only
  else Public-reference search
    A->>P: Bounded exact queries, approved data only
    P-->>A: Candidate snippets or explicit failure
    A->>A: Filter / mask / deduplicate / prioritize
  end
  A-->>B: Findings, source status, limits, guidance
  B-->>U: Review results; optional private JSON export
```

The browser request deadline is 20 seconds for capabilities/local link checks and
100 seconds for assessments. Public-reference provider calls share an 80-second
budget, including retries; adapters retain shorter per-request limits. This does
not make providers reliable, guarantee CPU bounds for arbitrary input, or replace
deployment/load testing. No automatic retry is added to frontend POST requests.

PDF text extraction loads lazily in the browser when a document is selected. The
server receives text only when the user submits. File size, page count and text
limits apply; OCR is absent. Password-range checks send only a hash prefix, not
the password or full hash. Do not enter real passwords in a booth presentation.

## Storage model and ownership

JSON key families include `users`, `workspaces`, hashed `sessions`,
`account_security`, `mfa_enrollment`, `mfa_challenges`, `osint_authenticator`,
`analysis_jobs`, report indexes, mail receipts, Pop evidence/indexes and conversations.
This is not a SQL schema. Keys and authorization checks live in the owning modules.
Storage reads attach non-enumerable version tags; conditional writes reject stale
updates rather than overwriting them. Account routes and reporting/library APIs
derive ownership from authenticated identities, not a user ID supplied by the client.

Production must configure private Blob. Local `.data/` is not a production database
backup or a safe shared folder. Vercel filesystem writes are not used as a durable
fallback when Blob is unconfigured. The current data model has no generalized
migration or expiry sweep; those remain operational limitations.

## Privacy and retention inventory

| Data | Handling / retention / deletion |
|---|---|
| Fictional demo choices | Memory in the current tab only; reset or reload clears them. No account, localStorage, analytics or backend writes |
| Fictional exports | Explicit download/copy only; browser/user controls local copies |
| Live exposure results | Returned to current UI; no automatic exposure-history database in this flow; explicit exports can contain identifying URLs/text |
| Supplied documents | Browser extracts text; approved text goes to local backend review; not automatically added to a case |
| Password-prefix request | Five SHA-1 characters sent to range provider; suffix match stays in browser |
| Account/cases/evidence | Private records; explicit account/evidence/report deletion endpoints exist; do not promise automatic age-based deletion |
| Sessions and MFA challenges | Expiry enforced on access; historical expired record cleanup is not a comprehensive implemented retention policy |
| MFA secret | AES-256-GCM encrypted under stable server environment key; recovery codes stored as hashes |
| Provider queries | Sent only to selected disclosed providers; their independent retention policies apply |
| Logs | Guarded server failures log request ID/type/route/code rather than raw incident content; infrastructure logging still needs deployment review |

The demo intentionally avoids a visitor contact database. Public GitHub feedback is
optional and clearly labeled as public; users should not post incident evidence.

## Security boundaries and unresolved work

- Authenticated consent does not prove ownership of every identifier. Phone and
  Instagram target searches remain locked. A supported authorization/verification
  policy for broader personal searches remains a release decision, not solved by TOTP.
- Local URL flags inspect URL structure only. No threat-feed reputation guarantee.
- Snippets and supplied evidence are untrusted. React uses text rendering; the
  demonstration constructs DOM with textContent rather than HTML injection.
- Reverse-image input rejects local/private/signed URLs before provider disclosure;
  visual matches do not identify people or establish location.
- Existing process-local rate limiting is not shared across serverless instances.
  Deployment abuse protection, quota budgets and retention maintenance need review.
- Optional Google sign-in, Gemini, email, search keys and Blob need independent
  operational checks; missing configuration must never become fabricated output.

Do not delete preserved teammate code or old extension packages until their users
and compatibility are checked. The integrated API is the only backend required to
run the full current website; the isolated demo needs neither backend.
