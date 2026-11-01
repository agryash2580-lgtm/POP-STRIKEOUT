import test from "node:test";
import assert from "node:assert/strict";
import {
  assessLink,
  flagReport,
  assessLinks,
} from "../api/osint/link-risk.mjs";
test("ordinary HTTPS is unverified, never labelled safe or reputation-checked", () => {
  const r = assessLink("https://github.com/example/repo");
  assert.equal(r.level, "unverified");
  assert.equal(r.reputation.status, "not_checked");
  assert.equal(r.openAllowed, true);
  assert.ok(!/safe/i.test(r.label));
});
test("blocks nonweb, malformed, credentials and private-network destinations", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///tmp/a",
    "not a url",
    "https://user:pass@example.org/",
    "http://localhost/",
    "https://127.0.0.1/",
    "https://[::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://10.0.0.1/",
    "https://169.254.169.254/",
  ]) {
    const r = assessLink(url);
    assert.equal(r.level, "blocked", url);
    assert.equal(r.openAllowed, false, url);
  }
});
test("HTTP and shortened URLs get explained caution flags", () => {
  assert.equal(assessLink("http://example.org").level, "caution");
  const r = assessLink("https://bit.ly/abc");
  assert.equal(r.level, "caution");
  assert.ok(r.signals.some((x) => x.code === "shortened_url"));
  assert.equal(assessLink("https://notbit.ly/abc").signals.length, 0);
});
test("encoded domains warn without assuming all international names are phishing", () => {
  const r = assessLink("https://xn--bcher-kva.de/");
  assert.equal(r.level, "caution");
  assert.equal(r.unicodeHostname, "bücher.de");
  assert.equal(r.openAllowed, true);
});
test("download and signed-access links require review, including encoded extensions", () => {
  assert.equal(assessLink("https://example.org/update%2Eexe").level, "high");
  const r = assessLink("https://example.org/report?token=fictional");
  assert.equal(r.level, "high");
  assert.ok(!r.displayURL.includes("fictional"));
});
test("displayed-domain mismatch is high concern with a real destination explanation", () => {
  const r = assessLink("https://other.example/login", "https://paypal.com");
  assert.equal(r.level, "high");
  assert.ok(r.signals.some((x) => x.code === "label_mismatch"));
  assert.equal(
    assessLink("https://www.paypal.com/login", "paypal.com").level,
    "unverified",
  );
});
test("brand domain warnings do not flag official subdomains or mentions only in paths", () => {
  assert.equal(
    assessLink("https://paypal.com.login.example/").level,
    "caution",
  );
  assert.equal(assessLink("http://paypal.com.login.example/").level, "high");
  assert.equal(assessLink("https://accounts.google.com/").level, "unverified");
  assert.equal(
    assessLink("https://github.com/example/google-guide").level,
    "unverified",
  );
});
test("exposure severity is independent from link structure and preserved in JSON", () => {
  const r = flagReport({
    findings: [
      {
        category: "credential_like_assignment",
        url: "https://example.org/doc",
        evidence: "password=[REDACTED]",
      },
      { category: "image_reference", url: "http://bit.ly/demo" },
    ],
  });
  assert.equal(r.findings[0].exposureAssessment.level, "high");
  assert.equal(r.findings[0].linkAssessment.level, "unverified");
  assert.equal(r.findings[1].linkAssessment.level, "high");
  assert.equal(r.findings[1].exposureAssessment.level, "informational");
  assert.equal(r.riskSummary.potentialSensitiveFindings, 1);
  assert.equal(r.riskSummary.highConcernLinks, 1);
  assert.equal(r.riskSummary.reputationChecked, false);
});
test("link assessment validates authorization, bounds input and makes no requests", () => {
  assert.throws(
    () => assessLinks({ links: [{ url: "https://example.org" }] }),
    { status: 400 },
  );
  assert.throws(
    () =>
      assessLinks({
        consent: { selfOwned: true, version: "1" },
        links: Array(21).fill({ url: "https://example.org" }),
      }),
    { status: 400 },
  );
  const r = assessLinks({
    consent: { selfOwned: true, version: "1" },
    links: [{ url: "https://example.org" }],
  });
  assert.equal(r.networkRequests, false);
  assert.equal(r.results.length, 1);
});
