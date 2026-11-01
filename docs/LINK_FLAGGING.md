# Exposure-result link and privacy flags

Check Exposure annotates returned source links and offers a standalone URL check. It uses local, deterministic URL rules. No extra API key is required, no destination is visited, no shortener is expanded, and no URL is submitted to a third-party threat service. This is not a malware/phishing reputation feed.

Link labels:

- **Do not open from this result:** malformed/non-HTTP URLs, embedded credentials and obvious local/private/reserved destinations. The interface offers no destination link.
- **High concern — review before opening:** stronger or combined signals, including executable-looking downloads, credential-like query parameters and displayed-domain mismatch. The destination link is behind a deliberate reveal control.
- **Caution — inspect this link:** signals such as HTTP, shortened addresses, encoded international domains, IP destinations, unusual ports and brand words on unrelated domains.
- **No obvious URL warnings:** no implemented structural rule matched. It does not mean safe. Reputation remains `not_checked`.

Rules produce reason codes/messages, an actual hostname, decoded international hostname, a query-free display address, a timestamp, method and limitations. Scores are deterministic rule weights, not probabilities or model confidence. Ordinary international domains, shorteners and sites mentioning a brand may be legitimate. Hostname checks do not resolve DNS; unfamiliar domains can still resolve to private IPs or host malicious content. Page content, redirects, domain age and real-time threat intelligence are not checked.

A separate **exposure assessment** labels breach records and credential/card/identity-document patterns as potentially sensitive. Contact/profile references require visibility review. Image similarity does not establish harm, ownership, identity or a person's location. Exposure priority does not imply that its source URL is malicious.

The existing authenticated `/api/osint/*` report handlers now include `linkAssessment` and `exposureAssessment` on findings, plus `riskSummary`. These annotations are included in JSON downloads. Search handoff links remain clearly labelled provider actions.

`POST /api/osint/links/assess` accepts up to 20 links and the existing consent version. It uses the website session and OSINT rate limiter:

```json
{
  "links": [{"url":"https://example.org/page", "label":"example.org"}],
  "consent":{"selfOwned":true,"version":"1"}
}
```

The response includes `networkRequests:false` and assessments, without retaining the submitted URLs. This feature does not modify Pop's installed extension package; it adds flags to the website exposure results.

Implementation: `api/osint/link-risk.mjs`, router `api/osint.mjs`, and `frontend/src/app/components/LinkRisk.tsx`. The component is used by both exposure result views.

Verification: 67 regression tests passed and the production frontend build succeeded. Local browser testing used fictional `paypal.com.login.example/update.exe` with displayed address `paypal.com`: high concern, three explained signals, no destination link exposed until reveal. A loopback URL was blocked with no open link. Neither test destination was visited.
