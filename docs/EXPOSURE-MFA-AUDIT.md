# Check exposure and MFA audit — 1 November 2026

Baseline: main 28cb7a8 (free authenticator exposure gate and Pop 2.3.1). No SMS/Twilio bypass was introduced. The audit uses fictional accounts, a temporary local encryption key, real TOTP enrolment and local persistence.

## Results

- 50 focused automated cases passed, listed below.
- 25 browser checks passed, listed below. The separate MFA browser suite also passed real enrolment, recovery-code login, private-data gating and disable flow.
- Full backend suite: 117/117 passed. Production build and whitespace checks passed.
- No test message, complaint, recovery secret or verification code was sent to a third party. Search handoffs were validated without opening external search results. Provider behavior in automated cases is simulated where keys are unavailable.

## Fixes

1. MFA status now validates the actual 32-byte encryption key, matching exposure status, instead of treating any nonempty string as configured.
2. Saving recovery codes closes the exposure setup panel and refreshes the gate automatically.
3. Enabling/disabling MFA emits a security-change event so the exposure gate updates promptly rather than waiting for periodic polling.
4. Verification panels are excluded from the silent-note suppression rule, preventing a hidden/blank gate in unavailable or completed states. Error banners remain suppressed as requested.
5. Changing check type/account or unmounting invalidates pending searches; stale responses cannot populate the new screen. File extraction also avoids applying text after a superseding check/account change.
6. Empty-body MFA submissions no longer crash the handler; existing validation rejects them.
7. Advanced search selects have explicit accessible labels. The legacy exposure browser selector now scopes its consent checkbox to the intended form.

## Focused automated cases

1. MFA and exposure agree on configuration: missing encryption key
2. MFA and exposure agree on configuration: invalid base64 key
3. MFA and exposure agree on configuration: short encryption key
4. MFA and exposure agree on configuration: oversized encryption key
5. MFA and exposure agree on configuration: valid 32-byte encryption key
6. Google login is configuration-gated; configured starts bind state, nonce and PKCE without trusting Host
7. verified Google callback creates a private account and delivery address; unverified identity is rejected
8. free image handoff does not contact API or claim a completed search
9. provider-specific consent is checked before DNS/provider calls
10. rejects internal, credential, signed and unsupported image URLs
11. address checks exclude private/reserved/mixed DNS
12. image API parses source-linked results, distinguishes exact/visual and redacts
13. provider failures/malformed data are explicit, with consented auto fallback
14. dorks enforce mandatory scope and reject operator injection and unsafe templates
15. keyless Google queries are handoffs, never fabricated backend findings
16. automatic dorks filter off-domain and nonexact snippets; partial failures stay incomplete
17. Express router enforces account auth and dispatches real dork/image handlers
18. mail, social and payment typos resolve to the exact intended warning suggestion
19. correct official names and unrelated sites are not blocked by substring resemblance
20. ordinary HTTPS is unverified, never labelled safe or reputation-checked
21. blocks nonweb, malformed, credentials and private-network destinations
22. HTTP and shortened URLs get explained caution flags
23. encoded domains warn without assuming all international names are phishing
24. download and signed-access links require review, including encoded extensions
25. displayed-domain mismatch is high concern with a real destination explanation
26. brand domain warnings do not flag official subdomains or mentions only in paths
27. exposure severity is independent from link structure and preserved in JSON
28. link assessment validates authorization, bounds input and makes no requests
29. authenticator MFA gates login, rejects replay, consumes recovery codes and invalidates old sessions and Pop tokens
30. Google SSO callback produces only an MFA challenge for an enrolled account
31. authenticator grants are scoped to account/session, expire, and contain no codes
32. disabling MFA, changing security version or losing encryption config revokes grants
33. code verification reuses replay-protected account MFA and rejects recovery/SMS-style input
34. free authenticator is not treated as proof of phone or Instagram ownership, including route variants
35. every mounted exposure endpoint enforces authenticator before provider work
36. real encrypted TOTP setup unlocks exposure, rejects replay, and disabling MFA revokes access
37. provider transient failures retry once and never invent a result
38. GitHub rate limits keep GitHub coverage and a useful retry message
39. new keyless GitHub integration confirms exact public text and masks sensitive snippets
40. document review is mounted behind existing authentication and self-ownership consent
41. three web engines deduplicate with all source attribution and redact snippets
42. one engine failing preserves other findings and reports incomplete
43. no unapproved engine receives the identifier
44. no provider request before ownership consent or valid input
45. urgency precedes evidence; ties preserve input order without mutation or lost results
46. live check path ranks exact evidence before search leads and keeps strongest duplicate
47. supplied document path puts sensitive patterns ahead of ordinary identifiers and retains masking
48. severity policy distinguishes credentials, identity/payment, contact, and profile references
49. breach severity uses returned data classes, not provider confidence alone
50. generic web leads use checked service and unknown findings stay provisional

## Browser checks

1. registration
2. gate visible
3. search hidden before verification
4. QR rendered
5. eight recovery codes
6. setup closes after saved
7. manual refresh no longer required
8. verified tools appear
9. Instagram locked
10. phone locked
11. request captured for stale-response regression
12. old response discarded
13. four document findings
14. critical first
15. high next
16. medium last
17. secret masked
18. card masked
19. export ordered
20. export redacted
21. Google handoff safe hostname
22. Lens handoff safe hostname
23. private link has no open action
24. mobile has no page overflow
25. no runtime errors

## Scope and remaining environment checks

The browser checks use a generated next-window TOTP for the separate exposure verification after consuming the enrolment code, exercising the permitted clock-skew window without waiting for a full code interval. Replay/expiry/recovery behavior is tested separately. They authenticate normally; they do not bypass the server gate.

Phone and Instagram public-reference searches remain blocked until target ownership can be verified. The account authenticator does not prove ownership of those targets. This is intentional enforcement, not an authenticator failure.

This audit does not certify every possible bug absent. Live provider credentials, a real Google account callback and hosted deployment of these new fixes remain separate checks. The existing no-text-error interface is preserved; rejected operations stay rejected even though their banners are hidden. No keys or session state are committed.
