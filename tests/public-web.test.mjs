import test from "node:test";
import assert from "node:assert/strict";
import { runCheck } from "../api/osint/osint.mjs";
const body = {
  service: "email",
  input: { email: "email@example.com" },
  consent: {
    selfOwned: true,
    version: "1",
    providers: ["serpapi_google", "serpapi_bing", "serpapi_duckduckgo"],
  },
};
const options = {
  env: { SERPAPI_API_KEY: "fixture-not-a-key" },
  fetcher: async (url) => {
    assert.equal(url.hostname, "serpapi.com");
    assert.equal(url.searchParams.get("q"), '"email@example.com"');
    return new Response(
      JSON.stringify({
        search_metadata: { status: "Success" },
        organic_results: [
          {
            link: "https://example.org/reference",
            title: "email@example.com",
            snippet: "password=secretvalue",
          },
          { link: "https://example.org/unrelated", title: "unrelated" },
          { link: "javascript:alert(1)", title: "email@example.com" },
        ],
      }),
    );
  },
};
test("three web engines deduplicate with all source attribution and redact snippets", async () => {
  const result = await runCheck(body, options);
  assert.equal(result.status, "completed");
  assert.equal(result.checks.length, 3);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].severity, "medium");
  assert.ok(result.findings[0].priorityReason);
  assert.deepEqual(result.findings[0].providers, body.consent.providers);
  assert.ok(!JSON.stringify(result).includes("secretvalue"));
  assert.ok(result.coverage.every((x) => x.scope.includes("public web index")));
});
test("one engine failing preserves other findings and reports incomplete", async () => {
  const result = await runCheck(body, {
    ...options,
    fetcher: async (url) =>
      url.searchParams.get("engine") === "bing"
        ? new Response("{}", { status: 429 })
        : options.fetcher(url),
  });
  assert.equal(result.status, "incomplete");
  assert.equal(result.findings.length, 1);
  assert.equal(
    result.checks.find((x) => x.provider === "serpapi_bing").status,
    "provider_error",
  );
});
test("no unapproved engine receives the identifier", async () => {
  const result = await runCheck(
    { ...body, consent: { ...body.consent, providers: ["serpapi_google"] } },
    {
      ...options,
      fetcher: async (url) => {
        assert.equal(url.searchParams.get("engine"), "google");
        return options.fetcher(url);
      },
    },
  );
  assert.equal(result.checks.length, 1);
});
test("no provider request before ownership consent or valid input", async () => {
  const noFetch = {
    fetcher: () => {
      throw Error("must not call");
    },
  };
  await assert.rejects(
    runCheck(
      { ...body, consent: { ...body.consent, selfOwned: false } },
      noFetch,
    ),
    { status: 400 },
  );
  await assert.rejects(
    runCheck({ ...body, input: { email: "bad\nquery" } }, noFetch),
    { status: 400 },
  );
});
