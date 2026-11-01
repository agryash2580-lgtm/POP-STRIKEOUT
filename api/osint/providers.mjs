export class ProviderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    Object.assign(this, details);
  }
}
export async function request(
  url,
  {
    headers = {},
    json = true,
    missingIsEmpty = false,
    fetcher = fetch,
    attempt = 0,
  } = {},
) {
  try {
    const response = await fetcher(url, {
      headers: {
        "User-Agent": "StrikeOut-Consented-Exposure-Review/0.1",
        ...headers,
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404 && missingIsEmpty) return [];
    if (!response.ok) {
      if (attempt === 0 && [502, 503, 504].includes(response.status))
        return request(url, {
          headers,
          json,
          missingIsEmpty,
          fetcher,
          attempt: 1,
        });
      const limited =
        response.status === 429 ||
        (response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0");
      const reset = Number(response.headers.get("x-ratelimit-reset"));
      const retryAfter = Math.max(
        1,
        Number(response.headers.get("retry-after")) ||
          (reset ? Math.ceil(reset - Date.now() / 1000) : 60),
      );
      throw new ProviderError(
        limited ? "rate_limited" : "provider_error",
        limited
          ? "The provider's request limit was reached. Try again after " +
              retryAfter +
              " seconds."
          : "Provider returned HTTP " +
              response.status +
              ". No exposure conclusion is available.",
        { httpStatus: response.status, ...(limited ? { retryAfter } : {}) },
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw Error("Empty response");
    let size = 0;
    const chunks = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2000000) {
        await reader.cancel();
        throw Error("Response limit");
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    return json ? JSON.parse(raw) : raw;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if (attempt === 0)
      return request(url, {
        headers,
        json,
        missingIsEmpty,
        fetcher,
        attempt: 1,
      });
    throw new ProviderError(
      e.name === "TimeoutError" || e.name === "AbortError"
        ? "timeout"
        : "network_error",
      "Provider network, response or timeout failure. No conclusion available.",
    );
  }
}
export async function webSearch(
  query,
  { env = process.env, fetcher = fetch } = {},
) {
  if (!env.BRAVE_SEARCH_API_KEY)
    throw new ProviderError(
      "not_configured",
      "Brave Search API key is not configured.",
    );
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.search = new URLSearchParams({
    q: query,
    count: "5",
    result_filter: "web",
    text_decorations: "false",
    spellcheck: "false",
  });
  const data = await request(url, {
    headers: {
      "X-Subscription-Token": env.BRAVE_SEARCH_API_KEY,
      Accept: "application/json",
    },
    fetcher,
  });
  if (
    !data ||
    typeof data !== "object" ||
    !data.web ||
    !Array.isArray(data.web.results)
  ) {
    if (data?.type === "search" && !data.web) return [];
    throw new ProviderError(
      "provider_error",
      "Search provider returned an unexpected response.",
    );
  }
  return data.web.results
    .slice(0, 5)
    .filter((x) => {
      try {
        const u = new URL(x.url);
        return (
          ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
        );
      } catch {
        return false;
      }
    })
    .map((x) => ({
      url: x.url,
      title: String(x.title || "").slice(0, 300),
      snippet: String(x.description || "")
        .replace(/<[^>]*>/g, "")
        .slice(0, 1000),
    }));
}
export async function emailBreaches(
  email,
  { env = process.env, fetcher = fetch } = {},
) {
  if (!env.HIBP_API_KEY)
    throw new ProviderError(
      "not_configured",
      "HIBP email-breach API key is not configured.",
    );
  const data = await request(
    "https://haveibeenpwned.com/api/v3/breachedaccount/" +
      encodeURIComponent(email) +
      "?truncateResponse=false",
    {
      headers: { "hibp-api-key": env.HIBP_API_KEY },
      missingIsEmpty: true,
      fetcher,
    },
  );
  if (!Array.isArray(data))
    throw new ProviderError(
      "provider_error",
      "Breach provider returned an unexpected response.",
    );
  return data.map((x) => ({
    name: x.Name,
    domain: x.Domain,
    breachDate: x.BreachDate,
    dataClasses: x.DataClasses,
    isVerified: x.IsVerified,
    source: "https://haveibeenpwned.com/",
  }));
}
export async function passwordRange(prefix, { fetcher = fetch } = {}) {
  if (!/^[A-F0-9]{5}$/.test(prefix))
    throw Object.assign(
      Error(
        "Provide exactly five uppercase SHA-1 prefix characters, never a password or full hash.",
      ),
      { status: 400 },
    );
  const text = await request("https://api.pwnedpasswords.com/range/" + prefix, {
    json: false,
    headers: { "Add-Padding": "true" },
    fetcher,
  });
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length || lines.some((x) => !/^[A-F0-9]{35}:\d+$/.test(x)))
    throw new ProviderError(
      "provider_error",
      "Password provider returned an unexpected response.",
    );
  return text;
}

// Official, keyless GitHub issue/PR search. This is explicitly not whole-web coverage.
export async function githubReferences(needles, { fetcher = fetch } = {}) {
  const { redactEvidence } = await import("./redact.mjs");
  const findings = [],
    checks = [];
  for (const needle of needles.slice(0, 2)) {
    const url = new URL("https://api.github.com/search/issues");
    url.search = new URLSearchParams({
      q:
        '"' +
        needle.value +
        '" in:body' +
        (needle.cardContext ? ' "ID card"' : ""),
      per_page: "5",
    });
    const data = await request(url, {
      headers: {
        Accept: "application/vnd.github.text-match+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      fetcher,
    });
    if (
      !data ||
      !Array.isArray(data.items) ||
      typeof data.incomplete_results !== "boolean"
    )
      throw new ProviderError(
        "provider_error",
        "GitHub returned an unexpected search response.",
      );
    let confirmed = 0;
    for (const item of data.items) {
      let source;
      try {
        source = new URL(item.html_url);
      } catch {
        continue;
      }
      if (
        source.protocol !== "https:" ||
        source.hostname !== "github.com" ||
        source.username ||
        source.password ||
        !/^\/[^/]+\/[^/]+\/(issues|pull)\/\d+/.test(source.pathname)
      )
        continue;
      const candidates = [
        item.body,
        ...(item.text_matches || []).map((x) => x.fragment),
      ].filter((x) => typeof x === "string");
      const text = candidates.find((x) =>
        x.toLowerCase().includes(needle.value.toLowerCase()),
      );
      if (!text) continue; // Search stemming alone is not evidence of an exact occurrence.
      if (
        needle.cardContext &&
        !/(?:id card|identity card|employee badge)/i.test(text)
      )
        continue;
      const at = text.toLowerCase().indexOf(needle.value.toLowerCase());
      findings.push({
        category: needle.category,
        reviewPriority: needle.cardContext ? "high" : "review",
        confidence: "exact_occurrence_in_public_provider_text",
        url: source.href,
        title: redactEvidence(item.title || "Public GitHub reference"),
        snippet: redactEvidence(
          text.slice(Math.max(0, at - 70), at + needle.value.length + 100),
        ),
        provider: "github_public",
      });
      confirmed++;
    }
    checks.push({
      provider: "github_public",
      status: data.incomplete_results ? "partial" : "completed",
      returnedCandidates: data.items.length,
      confirmedOccurrences: confirmed,
      coverage:
        "Public GitHub issue and pull-request search only; up to five candidates per query.",
    });
  }
  const seen = new Set();
  return {
    checks,
    findings: findings.filter((x) => {
      if (seen.has(x.url)) return false;
      seen.add(x.url);
      return true;
    }),
  };
}
