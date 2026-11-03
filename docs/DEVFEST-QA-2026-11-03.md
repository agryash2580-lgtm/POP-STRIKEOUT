# DevFest readiness QA — November 3, 2026

PR #11 was merged on November 3, 2026. Follow-up work is on
`devfest/release-hardening`. The table distinguishes local, CI and public-site
observations. Use
[DEVFEST_READINESS.md](../DEVFEST_READINESS.md) for release gates.

| Check | Observed result | Status |
|---|---|---|
| Root automated suite | 147 tests passed, 0 failed after retention/visitor QA follow-up | Verified with loopback access; restricted sandbox cannot start test servers |
| JavaScript syntax check | Active server/shared/extension/scripts parse | Verified |
| TypeScript check | `tsc --noEmit` passed; legacy JS is not fully typed | Verified |
| Production build | Vite built 59 modules | Verified |
| Draft PR CI | GitHub Readiness checks passed on Node 22 and 24; Vercel deployment check passed | Verified for PR #11; protected preview was not visitor-tested |
| Initial bundle | 858.16 kB / 256.98 kB gzip before; 424.76 kB / 126.48 kB gzip after lazy PDF loading | Verified build measurements; no real-user performance claim |
| Offline demo isolated server | Assets served, CSP `connect-src 'none'`, API routes inaccessible | Verified |
| Copied portable folder | All five runtime files matched SHA-256 manifest; copied server returned HTTP 200 | Verified |
| QR matrix | QR generated and decoded back to exact intended URL; destination opens publicly | Verified in browser; separate physical phone scan pending |
| Demo visitor journey | Consent requirement, fictional sources and findings, recommendation review, summary JSON preview and reset in real local browser | Verified |
| Demo edge cases | Unavailable source and empty completed sample presented distinct, honest states | Verified |
| Mobile layout | 390 px browser viewport, content width 375 = document client width 375; no horizontal overflow | Verified for demo screen tested |
| Keyboard | Space checked fictional acknowledgement, Enter ran document scenario | Verified for these controls; full keyboard audit pending |
| Browser console | No error-level entries observed in demo browser | Verified for tested journey only |
| Local full app | Synthetic MFA enrolled account signed in with a one-use test recovery code; fresh six-digit TOTP unlocked exposure | Verified in browser; no physical authenticator app or production TOTP test in this batch |
| Protected document review | Synthetic document text returned masked credential pattern, email occurrence, source scope and deterministic guidance | Verified in browser |
| PDF text extraction | Synthetic PDF loaded through file chooser; extracted text appeared locally in document field | Verified in browser; no OCR claim |
| GitHub public reference | One reserved-example smoke request completed | Verified local provider request; no coverage guarantee |
| Password prefix | One public prefix smoke request completed | Verified local provider request; no password sent |
| SerpApi Google / Bing | One reserved-example request per engine completed | Verified local configuration only |
| SerpApi DuckDuckGo | Returned provider HTTP 502 | Verified failure; retry/production health pending |
| Brave, HIBP, Gemini, Google OAuth, email, private Blob | Not configured in this local setup | Verified local configuration status; production state Not Yet Tested |
| Public `/devfest.html` | Public page loaded; consent, fictional results, JSON preview and reset worked in browser | Verified after PR #11 merge |
| Public deployment check | `/api/health` reports revision `6770565e9572` and private durable Blob; all four demo assets return expected types and the fictional marker | Verified by `EXPECTED_SHA=6770565e... npm run check:deployment` after PR #12 merged |
| GitHub feedback form | Direct link renders the DevFest template and required privacy checkbox | Verified after PR #12 merge; no issue was submitted |
| Personal target proof | Unverified or mismatched email rejected; exact verified email passes ownership gate; other personal/domain/image searches rejected before provider use | Verified in focused local unit and integration tests; production operator verification pending |
| Production protected exposure | Signed-in account reached an Open sign-in prompt for fresh authentication | Verified gate; no production TOTP or provider request executed |
| Follow-up rate limiter | Forwarded-header spoof is ignored; active local identities are bounded | Verified in unit tests; process-local only |
| Source scans | Limited tracked-text high-confidence secret pattern scan found no matches | Verified limited scan; history and broad entropy not covered |
| Dependency audit | Current `npm audit --audit-level=moderate` reports 0 known advisories across 314 dependencies | Verified against current advisory registry; not a security guarantee |
| Expired-auth cleanup | Dry run scanned 248 local auth records; 34 eligible after grace, 0 deleted. Focused cleanup tests pass, including deletion of a synthetic fixture | Verified locally; production Blob sweep not executed |
| Current local visitor check | Local page showed MFA gate; fictional contact scenario rendered 2 findings and 3 simulated sources; JSON summary opened and reset cleared results/consent | Verified in in-app browser; not full desktop/mobile accessibility QA |
| Desktop Playwright runner | Official browser binary installed; `npm run test:browser` passed signup, case, evidence, reviewed complaint, report consent, exposure gate and Pop settings after stale selector correction | Verified locally; browser output is not a production account test |
| Protected exposure browser | 25 checks passed: MFA enrollment/step-up, unverified email blocked, supplied-document findings masked, export redacted, domain/image locked, private link blocked, 390px layout without horizontal overflow, missing-MFA configuration gated | Verified locally with synthetic account; physical authenticator and screen reader not tested |
| Public deployment | Release checker returned revision `71e66413f65e`, private durable Blob, four public demo assets, visitor access | Verified for already-deployed `main`; this follow-up branch is not deployed |

Screenshots are fictional and safe to share:
[desktop landing](assets/devfest-landing-desktop.jpg),
[mobile results](assets/devfest-results-mobile.jpg).
The decoded QR asset is [here](assets/devfest-demo-qr.png). Its destination
works publicly, but scan the printed version with a separate phone before use.

Remaining acceptance work: verify the ownership follow-up deployment; phone-sized
full app journey; keyboard and screen-reader review across all core controls;
provider failure/timeout under hosting limits; independent live OAuth, Blob and
MFA configuration checks with authorized operator accounts; distributed quota and
retention decisions; actual booth laptop rehearsal and disconnected-network trial.
The current desktop and protected-exposure browser scripts were run locally. A
complete keyboard and screen-reader pass, production account/provider exercise,
and physical booth-device rehearsal remain open.
