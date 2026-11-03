# DevFest readiness QA — November 3, 2026

Current branch: `devfest/readiness-2026`. These are **local** observations; the
readiness branch has not been deployed at the time of this report. Use
[DEVFEST_READINESS.md](../DEVFEST_READINESS.md) for release gates.

| Check | Observed result | Status |
|---|---|---|
| Root automated suite | 137 tests passed, 0 failed | Verified with loopback access; restricted sandbox cannot start test servers |
| JavaScript syntax check | Active server/shared/extension/scripts parse | Verified |
| TypeScript check | `tsc --noEmit` passed; legacy JS is not fully typed | Verified |
| Production build | Vite built 59 modules | Verified |
| Initial bundle | 858.16 kB / 256.98 kB gzip before; 424.76 kB / 126.48 kB gzip after lazy PDF loading | Verified build measurements; no real-user performance claim |
| Offline demo isolated server | Assets served, CSP `connect-src 'none'`, API routes inaccessible | Verified |
| Copied portable folder | All five runtime files matched SHA-256 manifest; copied server returned HTTP 200 | Verified |
| QR matrix | QR generated and decoded back to exact intended URL | Verified locally; public destination currently HTTP 404 |
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
| Public `/devfest.html` | HTTP 404 on currently deployed site | Verified; QR must not be printed yet |
| Source scans | Limited tracked-text high-confidence secret pattern scan found no matches | Verified limited scan; history and broad entropy not covered |
| Dependency audit | Current `npm audit --audit-level=moderate` reports 0 known advisories across 314 dependencies | Verified against current advisory registry; not a security guarantee |

Screenshots are fictional and safe to share:
[desktop landing](assets/devfest-landing-desktop.jpg),
[mobile results](assets/devfest-results-mobile.jpg).
The decoded but **not yet deployable** QR asset is
[here](assets/devfest-demo-qr.png); check the live destination before distribution.

Remaining acceptance work: production deployment and version check; phone-sized
full app journey; keyboard and screen-reader review across all core controls;
provider failure/timeout under hosting limits; independent live OAuth, Blob and
MFA configuration checks with authorized operator accounts; distributed quota and
retention decisions; actual booth laptop rehearsal and disconnected-network trial.
An old desktop browser script was updated to current MFA gate/extension selectors
but was **not run** in this batch. Do not count it as passing.
