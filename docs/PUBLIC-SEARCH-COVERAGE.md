# Public search coverage

The public-reference form can search Google, Bing and DuckDuckGo through the server-side `SERPAPI_API_KEY`, in addition to GitHub public issues/PRs and optional Brave/HIBP providers. Users approve disclosure before searches. The three engines run at most two queries each, examining up to ten candidates per query. Exact identifier occurrences in returned titles/snippets are retained; source pages are not fetched. Duplicates retain provider attribution. Failed providers are reported as incomplete, not as absence of exposure.

SerpApi can return a successful DuckDuckGo response with `organic_results_state: "Fully empty"` and a no-results message. The adapter counts that exact response as a completed check with zero candidates; other provider errors remain incomplete. Zero candidates never establishes that the identifier is absent from the web.

For an email verified to the signed-in account, the no-key route also prepares exact-match links to Google, Bing and DuckDuckGo. It does not call those engines or import results. Opening a link shares the email query with that engine; the report labels the links `requires_user_action` and does not count them as completed checks. This works alongside GitHub checks even when the SerpApi key is absent.

Check Exposure reads the existing report-email verification status after the authenticator step. It shows the verified address, can fill it into the check, opens Cases → Delivery & Pop for verification when needed, and refreshes the status on return. The backend still checks the exact verified address independently before any personal search.

Domain-scoped Google templates and reverse-image search retain their separate consent and free manual handoff options. Link flags explain local URL concerns without claiming a reputation check or a safety verdict. No secret is committed; configure server environment variables separately from GitHub Actions secrets.

## Framework inventory

`osint-framework-audit.json` inventories 1,171 entries from OSINT Framework's public catalog, retrieved on 2026-11-01. The source URL and SHA-256 fingerprint are included. Its upstream MIT license is preserved alongside it. This is an inventory, not 1,171 working integrations. API availability and catalog status are upstream claims, not individually verified. Each unverified catalog entry is explicitly marked `not_integrated`; existing adapters above are documented separately.

The framework includes installed software, registration-only services, manual URL searches, and categories outside self-owned public-reference checks. Each additional service needs its own access, consent, suitability and response validation. Neither this implementation nor any search index guarantees whole-web coverage. No framework targets were crawled during this audit.

## Validation before PR

- 71 tests passed and production build passed before integration with current main.
- Live public-example-address check completed for Google (9 candidates, 6 exact occurrences), Bing (10, 1) and DuckDuckGo (10, 1), yielding 8 distinct links. These counts are a point-in-time smoke test, not an exposure guarantee.

- After merging current main, all 100 tests passed and the production build passed. Swarit’s severity/evidence prioritisation and strongest-duplicate selection are preserved, with provider attribution merged onto retained findings.
