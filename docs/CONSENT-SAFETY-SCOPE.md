# Consent and safety: parental-controls technical proposal

Owner: Kush. Privacy reviewer: Swarit. Usability reviewer: Yash.
Proposed for review November 25, 2026; this is not a deployed family-monitoring
feature or a legal-compliance claim.

## November 28 scope

The agreed scope is consent and safety. Each person uses their own account and
reviews their own information. A parent's approval does not establish ownership
of someone else's profile, phone number, private messages or image. No linked
child account, remote guardian access, private-chat import, activity tracking,
location inference, or silent external search is included.

Do not collect a birth date, child identifier or guardian contact just to give
the appearance of parental verification. Age eligibility, jurisdiction-specific
consent rules, guardian relationship verification, access boundaries and retention
need explicit team decisions and appropriate review before child/guardian account
flows are enabled. Those flows are absent and must remain unavailable meanwhile.

## Controls implemented and checked now

| Operation | Authorization and consent | Data handling / limits |
|---|---|---|
| All exposure tools | Signed-in session plus fresh authenticator grant | Grants expire and are invalidated by relevant account security changes/logout. TOTP does not prove target ownership. |
| Public email references | Exact email verified for this account, version-1 self-owned consent, explicit provider list | Only selected providers are queried; unavailable providers and incomplete coverage are disclosed. |
| Scoped dorks | Exact host proof through DNS TXT/HTTPS challenge, plus explicit Google/SerpApi disclosure | Fixed templates; bounded results; no raw credential/camera queries or source-page crawling. |
| Reverse image | Proof for public image host plus provider disclosure | Public HTTPS only, no local-file automatic upload; no identity or location conclusion. Host proof is not image ownership proof. |
| Supplied document and URL review | Self-owned/authorized-review declaration | Local backend processing; no source page is fetched. This declaration is not independent ownership verification. |
| Password breach-prefix check | Explicit consent for Pwned Passwords | Only a five-character string prefix is accepted; full hashes, passwords and malformed inputs are rejected. |
| Instagram, phone, LinkedIn, identity-card live search | Unsupported ownership flow | Remains locked even after successful TOTP. |

All exposure operations now share consent validation. Provider choices must be a
bounded list of names, not a string that happens to contain a provider name.
Invalid entries stop the whole request before a lookup. The backend does not
silently broaden provider selection when one service fails. Sensitive-looking
text is masked; Brave/HIBP findings retain their provenance after deduplication.
This is pattern-based masking, not a guarantee that every form of personal data
will be detected.

## Review and acceptance

1. Swarit confirms the privacy boundaries above, especially the distinction
   between account protection, target proof, and supplied-content declarations.
2. Yash checks that provider disclosures, disabled unsupported services, and the
   fictional-demo label are understandable before a user approves anything.
3. Automated negative cases must show that missing/invalid consent, missing MFA,
   a different email and unsupported targets make no provider request. The
   mounted API regression covers this with a synthetic session/grant and mocked
   provider; separate existing tests exercise encrypted TOTP and email codes.
4. Do not advertise “parental controls completed” until the team has approved a
   concrete user-facing meaning. For Nov 28, describe the implemented protections
   above and the fictional demo accurately.

No new family-account schema, API, child data collection, or age threshold is
introduced by this proposal. Swarit/Yash review is a remaining human task, not
an automated check that can be marked passed by the author.
