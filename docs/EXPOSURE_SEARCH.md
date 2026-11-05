# Google dorks and reverse-image lookup

The active website adds these tools inside Check Exposure. Existing GitHub references, supplied-document review and password-prefix checks remain separate. This change adds no public-page retrieval, account-export parser or crawling; those belong to Swarit's work.

## What works without keys

Google searches are prepared from a public domain the signed-in user has verified with either a DNS TXT record or a plain-text file at `https://DOMAIN/.well-known/strikeout-verify.txt`, an exact identifier and one of six fixed templates. A fresh authenticator grant is required before creating the challenge or searching. The backend checks the selected proof, then stores it for seven days tied to the account's MFA security version. HTTPS proof rejects redirects and private/reserved addresses, pins the resolved public IP during TLS, and caps response size and time. A different domain, another account, an expired proof or a changed MFA security version cannot reuse it. The user can revoke proof in Check Exposure. This proves control of the domain, not ownership of every person named on its pages.

Without a SerpApi key, the backend validates scope and returns a Google search link. The user opens the link to run the search. Results remain on Google. A prepared link is returned as `requires_user_search`, never `completed` with invented findings.

Templates: exact references; PDF references; DOCX references; contact-page URLs; resume/CV page titles; possible ID-card/employee-badge references. Every query includes `site:domain` and a quoted identifier. No raw dork query, global credential search, camera discovery or access-control bypass is accepted. `site:` includes subdomains and is not complete coverage of the site's content.

Reverse-image handoff accepts an authorized **public HTTPS image URL on an exactly verified host** and returns a Google Lens link. Host proof does not establish image copyright, who appears in it, or location. It does not upload local files. The UI also links to Lens for a user-selected manual local-file upload. Opening the external link shares the URL/image with Google, subject to its policies. Results are not automatically imported from the free handoff.

## Automatic results

Set `SERPAPI_API_KEY` privately on the application server to enable the SerpApi Google and Google Lens adapters. Never use a frontend `VITE_` setting. The backend sends the disclosed query/image URL, checks bounded responses, masks sensitive-looking text and returns source-linked results. Provider failures are explicit. Auto mode offers a free handoff only when that separate provider disclosure was approved.

Google Lens provider matches are labelled exact, visually similar or ordinary web reference as supplied by the provider. Neither label identifies a person or establishes where/when a picture was taken. The system has no face-identification or person-location feature. It does not fetch returned images/pages.

Automatic Google dork results are restricted to the selected domain/subdomains and exact identifier occurrences in returned titles/snippets. They remain provider-text leads, not verified source-page evidence. Limit: three templates per request, five candidates per template. Image limit: twenty deduplicated exact/visual links and ten web links. Provider response limit: 2 MB; timeout: 25 seconds. The image URL check rejects literal IPs, non-HTTPS URLs, credentials, signed-token query parameters and hostnames that resolve to private/reserved addresses. DNS checks cannot control a third party's later fetch/redirect behaviour; use only public images you are authorized to disclose.

## API

All routes use the existing website session and OSINT rate limiter. Capabilities expose template IDs, whether SerpApi is configured and the public-image-URL restriction. They never return a key.

Domain proof routes require a signed-in account and a fresh authenticator grant:

1. `POST /api/osint/domains/challenge` with `{ "domain": "your-domain.example" }` returns a short-lived TXT record name and value.
2. Publish that exact record in your DNS settings. `POST /api/osint/domains/verify` with the same domain checks public DNS. An absent or mismatched record returns an explicit error, not a successful proof.
3. `GET /api/osint/domains/status?domain=your-domain.example` refreshes the state. `POST /api/osint/domains/revoke` removes it.
4. Only while proof is valid can `POST /api/osint/dorks` run for that exact domain, or `POST /api/osint/images/reverse` use a public HTTPS image URL on that exact hostname. Both checks still require disclosed provider consent.

Challenges expire after 30 minutes. Proofs expire after seven days. At most five active domains are retained per account. The expired-record cleanup script can remove empty/expired proof records after its 24-hour grace period; it is not yet a scheduled production job.

`POST /api/osint/dorks`:

```json
{
  "domain": "example.org",
  "identifier": "me@example.org",
  "templates": ["references", "pdf"],
  "mode": "handoff",
  "consent": {
    "selfOwned": true,
    "version": "1",
    "providers": ["google_search"]
  }
}
```

`POST /api/osint/images/reverse`:

```json
{
  "imageUrl": "https://example.org/my-public-photo.jpg",
  "mode": "auto",
  "consent": {
    "selfOwned": true,
    "version": "1",
    "providers": ["serpapi", "google_lens"]
  }
}
```

Modes: `handoff` never calls SerpApi; `api` requires its key and explicit provider consent; `auto` selects the configured API or the separately consented Google handoff. For automatic dorks, approve `serpapi`; add `google_search` to permit handoff links. For images approve `serpapi` and, if fallback is wanted, `google_lens`.

Source files: `api/osint/dorks.mjs`, `images.mjs`, `image-url.mjs`, `search-provider.mjs`, router `api/osint.mjs`, and `frontend/src/app/components/AdvancedExposure.tsx`. The older standalone `OSINT BACKEND/` is unchanged.

## Verification and limits

`node tests/image-dork.test.mjs` covers consent, internal/signed URL rejection, mixed DNS results, provider parsing/redaction, deduplication, failures, bounded responses, dork operator injection/scope, and authenticated Express router dispatch. `node tests/domain-ownership.test.mjs` covers DNS and HTTPS challenge matching, account/domain scoping, expiry, revocation and both route gates. Provider results in automated tests are fixtures, not a claim that a production SerpApi account is configured or has quota. On November 5, a synthetic local-account challenge was published briefly on StrikeOut's production HTTPS host, verified by the real pinned-TLS reader and revoked. The temporary file was then removed. A real domain DNS record, authenticated production-account proof and production Google/SerpApi request still need authorized live tests.

The free Google Lens URL handoff was exercised against the public production Pop artwork and returned actual visual-search results. The new website controls must be deployed before production users can see them. Browser rendering/bundle compilation is separate from a successful deployment.

Google's documented operators: https://support.google.com/websearch/answer/2466433
Google site scope: https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site
Google image search: https://support.google.com/websearch/answer/1325808
SerpApi Google Lens: https://serpapi.com/google-lens-api

Google's Custom Search JSON API is closed to new customers and is scheduled to end on 1 January 2027 according to its current overview; this implementation does not require a new Custom Search account: https://developers.google.com/custom-search/v1/overview
