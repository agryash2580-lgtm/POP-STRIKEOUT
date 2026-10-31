# StrikeOut OSINT Backend

Standalone, backend-only proof of concept for reviewing a user's **own** public footprint. No frontend, passwords, saved-user records, browser profiles, exports, or deployment credentials are included.

## What works without paid keys

- **Public references:** exact email, phone, LinkedIn-profile URL and own-name/ID-document references in public **GitHub issues and pull requests**. Uses the official unauthenticated search API, checks for an exact occurrence in returned text, and includes source links. This is limited GitHub coverage, not whole-web search or email breach membership.
- **Supplied documents:** offline review of text and text-based PDFs for your identifiers, credential-like assignments, payment-card patterns and possible identity-card/badge references. Evidence is masked and classified; findings are candidates, not proof of active credentials or identity.
- **Saved passwords:** local CSV reuse analysis and the free Pwned Passwords prefix API. Complete passwords and hashes stay local.
- **Payment-card validation:** local length/Luhn checks and masked last four digits. This is hygiene, not an internet exposure search; document review separately detects card-like occurrences.
- **Private Instagram:** the existing operator-controlled consented follow workflow, restricted to private accounts. It does not import posts or messages.

Brave whole-web references and HIBP email breach metadata remain optional integrations. They require their own keys. Missing keys and provider failures are reported explicitly; findings are never invented. No result does not establish safety. Providers receive only the identifiers you approve.

### Run a public-reference check directly

After installing dependencies, no server, account or provider key is needed:

```bash
node check.mjs --service email --value me@example.org --output reports/email.json --consented
```

Services: `email`, `phone` (international format), `linkedin` (profile URL), `identity_cards` (your full name). `--consented` attests that the supplied information is yours. This command explicitly selects GitHub disclosure. Reports include coverage, source URLs, classification and provider status. GitHub limits unauthenticated search; errors or truncated results produce incomplete reports.

### Review your own document locally

Create a private identifiers JSON file:

```json
{"emails":["me@example.org"],"phones":["+12025550123"],"linkedinProfiles":["https://www.linkedin.com/in/your-profile"],"names":["Your Name"]}
```

```bash
node document-audit.mjs --input /private/resume.pdf --identifiers /private/identifiers.json --output reports/document.json --consented
```

No network calls are made for document review. Input is limited to 5 MB, PDF extraction to 40 pages, and extracted text to 100,000 characters. Scanned images need OCR, which is not implemented. Output refuses overwrite and uses private file permissions. Keep source documents and identifier files outside Git.

Authenticated clients can also call `POST /api/osint/review-documents`:

```json
{"documents":[{"text":"Your own document text"}],"identifiers":{"emails":["me@example.org"]},"consent":{"selfOwned":true,"version":"1"}}
```

Up to three documents of 100,000 characters each are accepted within the 512 KB request limit. Optional `sourceUrl` values are caller-provided labels, never fetched or independently verified. Reports use document indexes, line numbers and redacted evidence. Original text is not retained by the server.

## Run

Node.js 22+ is required.

```bash
cd "OSINT BACKEND"
npm ci
cp .env.example .env.local
npm start
```

Default address: `http://localhost:3010`. It binds to loopback only. Set `ALLOWED_ORIGINS` to the exact frontend origins allowed to use this service. Cookies are HTTP-only and SameSite Strict; the frontend must use `credentials: 'include'`. For HTTPS deployments set `COOKIE_SECURE=true`. This local, single-process PoC has no production deployment claim.

Configure optional provider keys in ignored `.env.local`:

- `BRAVE_SEARCH_API_KEY`: official Brave web search; up to two queries and five results per query per check.
- `HIBP_API_KEY`: official email breach search. This requires eligible HIBP access; Pwned Passwords does not require this key.
- `INSTAGRAM_OPERATOR_USERNAMES`: comma-separated existing **Strikeout backend** usernames allowed to control the service browser. Empty denies operator access. Ordinary registration never grants the role.

No keys are supplied. Live GitHub search and the free Pwned Passwords prefix endpoint were verified with public synthetic test inputs. Brave and email-breach integrations were tested with simulated responses; live checks need configured keys.

## Authentication

`POST /api/auth/register` and `POST /api/auth/login` accept a Strikeout username and **new Strikeout password**, not an Instagram password:

```json
{"username":"your_strikeout_name","password":"your_new_unique_password"}
```

Usernames accept 3–32 letters, digits, `_` and `-`; passwords accept 10–128 characters. Passwords are salted and hashed with scrypt. Registration/login set an `osint_session` cookie. Sessions expire after seven days. `POST /api/auth/logout` invalidates the current session. `DELETE /api/account` deletes the user and their Instagram request records; other session tokens cease working because the user no longer exists.

This backend has independent accounts/storage. It does not read or migrate the existing website's accounts or cookie. The frontend must authenticate against this API or use a deliberately implemented trusted auth bridge. Never copy the old website's users, sessions or `.env` into Git.

Every write requires an approved `Origin`. CLI clients must supply that header as well as their authenticated cookie. Rate limits are local/in-memory, not distributed. General OSINT requests are capped at six per minute per client IP and accept at most 512 KB of JSON.

## Check API

`GET /api/osint/capabilities` lists services and whether keys are configured. It never returns keys.

`POST /api/osint/check` accepts one service at a time. Consent is required and provider disclosure is opt-in:

```json
{
  "service": "email",
  "input": {"email": "me@example.org"},
  "consent": {
    "selfOwned": true,
    "version": "1",
    "providers": ["github_public"]
  }
}
```

Other `service` / `input` combinations:

```json
{"service":"linkedin","input":{"profileUrl":"https://www.linkedin.com/in/your-profile","fullName":"Your Name"},"consent":{"selfOwned":true,"version":"1","providers":["github_public"]}}
```

```json
{"service":"phone","input":{"phone":"+12025550123"},"consent":{"selfOwned":true,"version":"1","providers":["github_public"]}}
```

```json
{"service":"identity_cards","input":{"fullName":"Your Name","employer":"Your Employer"},"consent":{"selfOwned":true,"version":"1","providers":["github_public"]}}
```

```json
{"service":"payment_cards","input":{"number":"4111111111111111"},"consent":{"selfOwned":true,"version":"1","providers":[]}}
```

The payment number above is a synthetic test value. Real card numbers should be checked only on a trusted local process; never put one in a shell argument/history or public example. Payment input is handled transiently, never sent to a provider, and never stored or returned verbatim. This is local card hygiene, not “find this card on the internet.” The service does not scan browser autofill, banking accounts, stolen-card databases or other people's cards.

Reports contain `schemaVersion`, `service`, `checkedAt`, `status`, individual `checks`, classified `findings`, and limitations. `completed` means the selected bounded checks finished, not that the person is safe. `incomplete` means at least one provider was unavailable or unconfigured. Breach findings contain breach metadata, not leaked credential values. Search leads contain source URLs and bounded snippets; clients must render them as untrusted text. Reports are returned as JSON and are **not retained by the server**; download them explicitly in the calling client if desired.

## Saved passwords

For a password manager CSV export with a `password` column, run locally:

```bash
node password-audit.mjs --input /private/your-export.csv --output reports/password-audit.json --consented
```

The CLI supports quoted CSV, at most 2 MB / 500 rows / 100 unique prefix queries. It does not automate export or read browser password vaults. The plaintext export remains on your computer; protect and remove it yourself when finished. Output uses CSV row numbers, breach counts and reuse counts, never passwords, full hashes, account names or URLs. The CLI refuses to overwrite output and creates private files on POSIX systems.

For an integrating frontend, `POST /api/osint/passwords/range` accepts only a five-character uppercase SHA-1 prefix and consent:

```json
{"prefix":"5BAA6","consent":{"selfOwned":true,"version":"1","providers":["pwned_passwords"]}}
```

Hash the complete password **locally**, send the prefix only, and compare the returned suffixes locally. `Add-Padding: true` is sent to HIBP. Never submit a raw password, full hash, hash suffix, password export, account name or URL to this endpoint. A corpus match is about the password string, not proof that the particular account was breached. No match is not a password-strength guarantee.

## Private Instagram only

A frontend should ask account privacy **before** showing Pop-follow. Public accounts do not get that option. The server independently rejects a missing/public declaration:

```json
{"username":"your_private_handle","accountPrivacy":"private","consent":true}
```

Send to `POST /api/instagram/follow`. The sender is fixed to `popyourproblemsaway`. Before a new click, the bot verifies the signed-in sender and a visible “This profile/account is private” marker. If privacy cannot be confirmed, the outcome is `privacy_unconfirmed` and no follow is clicked. This is conservative: layout changes may prevent a legitimate private account from being followed. Self-declaration is not independent ownership verification.

- `GET /api/instagram/follow`: only the current user's request records.
- `POST /api/instagram/follow/:id/withdraw`: withdraw the current user's permission; it does not remove a follower in Instagram.
- `GET /api/instagram/operator`: allowlisted operator's queue and service status.
- `POST /api/instagram/bot/connect`, `/signup`, `/view`, `/input`, `/process`, `/close`: operator-only controls. `process` takes `{ "requestId": "..." }`.

The screenshot/input endpoints support a frontend live browser view; no frontend is bundled here. They are protected server-side, use transient input, and do not persist passwords. Install the browser separately if using Instagram:

```bash
PLAYWRIGHT_BROWSERS_PATH=.data/browsers npx playwright install chromium --no-shell
```

The operator signs into Instagram directly and completes verification. Login cookies stay in memory; restart requires reconnecting. A connected service attempts a new queued submission immediately. A disconnected service saves `queued`; an operator must reconnect and manually process it. There is no background queue worker, captcha bypass, bulk follow loop or automatic retry. A write-ahead `needs_check` record prevents uncertain clicks from being retried. Existing Requested/Following state is reported without toggling it.

Accepting a follow does not import posts, old comments or DMs, detect acceptance automatically, or start a scan. Consent expires after 24 hours for sending. Repeated user/target submissions are idempotent; they do not renew expired/withdrawn consent. Renewing such permission is a future workflow, not automatic authorization.

## Storage / boundaries

Private JSON files are created in ignored `.data` (0700 directory / 0600 files on POSIX). Windows permissions depend on folder ACLs. The folder contains app users, hashed session tokens and Instagram request/queue metadata; treat it as sensitive. It is not an encrypted vault. OSINT/card/password report bodies are not persisted or logged. Cookie/session hashing does not make the user dataset anonymous. HTTPS, deployment hardening, distributed locks, backup/retention policy and independent auditing remain deployment work.

The backend never fetches arbitrary result pages, downloads exposed documents, scrapes private accounts, collects plaintext credentials, reverse-tracks a person's movements, or claims a match establishes identity. Search checks are bounded, provider-based, and require self-owned-information attestation.

## Tests and integration

```bash
npm test
npm run smoke:live
```

Tests use temporary private storage and mock external providers; they cover auth/CORS, operator denial, private-only follow requests, no-click without private evidence, queue idempotency, query validation, missing-provider status, result deduplication, masked local cards, prefix-only password calls, CSV reuse/corpus analysis, and credential suppression. Provider tests are not a substitute for live testing with configured keys.

Existing website changes are intentionally outside this folder. This commit adds only `OSINT BACKEND`; integrate the endpoints with the website/extension separately.

Provider references: [GitHub issue/PR search](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests), [Brave web-search API](https://api-dashboard.search.brave.com/api-reference/web/search/get), [HIBP API and Pwned Passwords](https://haveibeenpwned.com/API/V3), [Playwright browser contexts](https://playwright.dev/docs/api/class-browser).
