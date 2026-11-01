# Public search coverage

The public-reference form can search Google, Bing and DuckDuckGo through the server-side `SERPAPI_API_KEY`, in addition to GitHub public issues/PRs and optional Brave/HIBP providers. Users approve disclosure before searches. The three engines run at most two queries each, examining up to ten candidates per query. Exact identifier occurrences in returned titles/snippets are retained; source pages are not fetched. Duplicates retain provider attribution. Failed providers are reported as incomplete, not as absence of exposure.

Domain-scoped Google templates and reverse-image search retain their separate consent and free manual handoff options. Link flags explain local URL concerns without claiming a reputation check or a safety verdict. No secret is committed; configure server environment variables separately from GitHub Actions secrets.

## Framework inventory

`osint-framework-audit.json` inventories 1,171 entries from OSINT Framework's public catalog, retrieved on 2026-11-01. The source URL and SHA-256 fingerprint are included. Its upstream MIT license is preserved alongside it. This is an inventory, not 1,171 working integrations. API availability and catalog status are upstream claims, not individually verified. Each unverified catalog entry is explicitly marked `not_integrated`; existing adapters above are documented separately.

The framework includes installed software, registration-only services, manual URL searches, and categories outside self-owned public-reference checks. Each additional service needs its own access, consent, suitability and response validation. Neither this implementation nor any search index guarantees whole-web coverage. No framework targets were crawled during this audit.

## Validation before PR

- 71 tests passed and production build passed before integration with current main.
- Live public-example-address check completed for Google (9 candidates, 6 exact occurrences), Bing (10, 1) and DuckDuckGo (10, 1), yielding 8 distinct links. These counts are a point-in-time smoke test, not an exposure guarantee.
