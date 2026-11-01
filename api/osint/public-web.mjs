import { serpSearch } from "./search-provider.mjs";
import { redactEvidence } from "./redact.mjs";
export const publicWebEngines = ["google", "bing", "duckduckgo"];
// Fixed engines and bounded queries: never crawl arbitrary destinations.
export async function publicWebReferences(
  engine,
  queries,
  needles,
  options = {},
) {
  if (!publicWebEngines.includes(engine)) throw Error("Unsupported engine");
  const provider = "serpapi_" + engine;
  const findings = [],
    checks = [];
  for (const query of [...new Set(queries)].slice(0, 2)) {
    try {
      const data = await serpSearch(
        {
          engine,
          q: query,
          ...(engine === "google"
            ? { num: "10" }
            : engine === "bing"
              ? { count: "10" }
              : { m: "10" }),
        },
        options,
      );
      if (
        data.organic_results !== undefined &&
        !Array.isArray(data.organic_results)
      )
        throw Error("Unexpected results");
      const rows = (data.organic_results || []).slice(0, 10);
      let accepted = 0;
      for (const row of rows) {
        let url;
        try {
          url = new URL(row.link);
        } catch {
          continue;
        }
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          continue;
        const text = String(row.title || "") + " " + String(row.snippet || "");
        const needle = needles.find(
          (n) =>
            text.toLowerCase().includes(n.value.toLowerCase()) &&
            (!n.cardContext ||
              /id card|identity card|employee badge/i.test(text)),
        );
        if (!needle) continue;
        accepted++;
        findings.push({
          provider,
          category: needle.category,
          reviewPriority: needle.cardContext ? "high" : "review",
          confidence:
            "exact_occurrence_in_provider_snippet_not_source_verified",
          url: url.href,
          title: redactEvidence(row.title || "Public reference"),
          snippet: redactEvidence(row.snippet || ""),
        });
      }
      checks.push({
        provider,
        status: "completed",
        returnedCandidates: rows.length,
        accepted,
        coverage:
          engine +
          " public web index; up to 10 candidates per query, at most two queries. Exact identifier occurrences in snippets only; source pages not retrieved.",
      });
    } catch {
      checks.push({
        provider,
        status: "provider_error",
        coverage:
          engine +
          " search failed; no negative exposure conclusion is possible.",
      });
      break;
    }
  }
  return { findings, checks };
}
