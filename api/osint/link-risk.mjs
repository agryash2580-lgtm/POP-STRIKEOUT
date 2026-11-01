import { isIP } from "node:net";
import { domainToUnicode } from "node:url";
import { publicAddress } from "./image-url.mjs";
const shorteners = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "shorturl.at",
  "is.gd",
  "cutt.ly",
  "rb.gy",
  "ow.ly",
  "buff.ly",
]);
const brands = {
  paypal: "paypal.com",
  google: "google.com",
  microsoft: "microsoft.com",
  apple: "apple.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  linkedin: "linkedin.com",
  github: "github.com",
  amazon: "amazon.com",
};
const within = (host, domain) => host === domain || host.endsWith("." + domain);
export function assessLink(value, label = "") {
  const signals = [];
  let score = 0,
    blocked = false,
    url;
  const add = (code, message, weight) => {
    signals.push({ code, message });
    score += weight;
  };
  if (
    typeof value !== "string" ||
    value.length > 4000 ||
    /[\u0000-\u0020\u007f]/.test(value)
  ) {
    blocked = true;
    add("invalid_url", "Invalid, oversized or whitespace-containing URL.", 10);
  } else
    try {
      url = new URL(value);
    } catch {
      blocked = true;
      add("invalid_url", "This is not a complete URL.", 10);
    }
  if (url) {
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!["http:", "https:"].includes(url.protocol)) {
      blocked = true;
      add(
        "unsupported_scheme",
        "Only HTTP/HTTPS destinations can be opened from these results.",
        10,
      );
    }
    if (url.username || url.password) {
      blocked = true;
      add(
        "embedded_credentials",
        "Credentials or misleading text appear before @ in the address.",
        5,
      );
    }
    const ip = host.replace(/^\[|\]$/g, "");
    if (
      host === "localhost" ||
      (!host.includes(".") && !isIP(ip)) ||
      /(?:^|\.)(local|internal|lan|localhost)$/.test(host) ||
      (isIP(ip) && !publicAddress(ip))
    ) {
      blocked = true;
      add(
        "non_public_destination",
        "This destination is a local/private or reserved network address.",
        10,
      );
    } else if (isIP(ip))
      add(
        "ip_destination",
        "The destination uses an IP address instead of a domain name.",
        2,
      );
    if (url.protocol === "http:")
      add("http", "HTTP does not encrypt the connection.", 2);
    if (host.split(".").some((x) => x.startsWith("xn--")))
      add(
        "international_domain",
        "This is an encoded international domain. Inspect the decoded spelling; this alone does not prove impersonation.",
        2,
      );
    if ([...shorteners].some((x) => within(host, x)))
      add(
        "shortened_url",
        "A shortener hides the final destination. It has not been expanded.",
        2,
      );
    if (url.port && !["80", "443"].includes(url.port))
      add("unusual_port", "This URL uses a nonstandard web port.", 1);
    let path = url.pathname;
    try {
      path = decodeURIComponent(path);
    } catch {}
    if (
      /\.(?:exe|msi|scr|bat|cmd|ps1|vbs|js|jar|apk|dmg|iso)(?:$|[/?])/i.test(
        path,
      )
    )
      add(
        "executable_download",
        "This path appears to point to executable or installable content. The file was not downloaded.",
        4,
      );
    if (
      [...url.searchParams.keys()].some((x) =>
        /(?:token|password|secret|session|signature|api.?key|^sig$|^key$)/i.test(
          x,
        ),
      )
    )
      add(
        "sensitive_query",
        "The address contains credential-like or signed-link parameters. Opening it may disclose access information.",
        4,
      );
    const normalized = domainToUnicode(host)
      .toLowerCase()
      .replace(/[01]/g, (x) => (x === "0" ? "o" : "l"));
    for (const [brand, official] of Object.entries(brands)) {
      if (within(host, official)) continue;
      if (new RegExp("(?:^|[.-])" + brand + "(?:[.-]|$)").test(normalized)) {
        add(
          "brand_in_unrelated_domain",
          "The hostname mentions " +
            brand +
            " but is not " +
            official +
            " or its subdomain. It may be an unrelated site; verify the intended destination.",
          3,
        );
        break;
      }
    }
    if (typeof label === "string" && label.length <= 500) {
      let visible;
      try {
        if (
          /^(?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:\/\S*)?$/i.test(
            label.trim(),
          )
        )
          visible = new URL(
            /^https?:/i.test(label) ? label : "https://" + label,
          ).hostname
            .toLowerCase()
            .replace(/\.$/, "");
      } catch {}
      if (
        visible &&
        visible.replace(/^www\./, "") !== host.replace(/^www\./, "")
      )
        add(
          "label_mismatch",
          "The displayed address names " +
            visible +
            ", but the actual hostname is " +
            host +
            ".",
          4,
        );
    }
  }
  const level = blocked
    ? "blocked"
    : score >= 4
      ? "high"
      : score > 0
        ? "caution"
        : "unverified";
  return {
    schemaVersion: "1",
    level,
    label: {
      blocked: "Do not open from this result",
      high: "High concern — review before opening",
      caution: "Caution — inspect this link",
      unverified: "No obvious URL warnings",
    }[level],
    openAllowed: !blocked,
    hostname: url?.hostname || null,
    displayURL:
      url && ["http:", "https:"].includes(url.protocol)
        ? url.origin + url.pathname
        : null,
    unicodeHostname: url ? domainToUnicode(url.hostname) : null,
    signals,
    checkedAt: new Date().toISOString(),
    method: "local_url_rules",
    reputation: { status: "not_checked" },
    limitations: [
      "URL rules are warning signals, not malware/phishing confirmation.",
      "No destination was visited, no redirects followed and no file downloaded. Threat feeds and page contents were not checked.",
    ],
  };
}
export function exposureRisk(finding) {
  const category = String(finding.category || "");
  if (
    [
      "credential_like_assignment",
      "payment_card_exposure",
      "possible_identity_document",
      "breach_membership",
    ].includes(category)
  )
    return {
      level: "high",
      label: "Potentially sensitive exposure",
      reason:
        category === "breach_membership"
          ? "The provider returned a breach record. Review the affected data classes."
          : "Sensitive-looking content or document terms were detected. Review the evidence; patterns can include examples or false matches.",
    };
  if (/email|phone|linkedin|instagram|public_reference/.test(category))
    return {
      level: "review",
      label: "Public reference — review visibility",
      reason:
        "This reference may be intentional or belong to someone else. Confirm relevance and desired visibility.",
    };
  return {
    level: "informational",
    label:
      category === "image_reference"
        ? "Image similarity — review match"
        : "Review finding",
    reason: "This finding alone does not establish harm or identity.",
  };
}
export function flagReport(report) {
  if (!report || !Array.isArray(report.findings)) return report;
  const findings = report.findings.map((f) => ({
    ...f,
    exposureAssessment: exposureRisk(f),
    ...(f.url || f.source
      ? { linkAssessment: assessLink(f.url || f.source, f.title || "") }
      : {}),
  }));
  return {
    ...report,
    findings,
    riskSummary: {
      blockedLinks: findings.filter(
        (f) => f.linkAssessment?.level === "blocked",
      ).length,
      highConcernLinks: findings.filter(
        (f) => f.linkAssessment?.level === "high",
      ).length,
      cautionLinks: findings.filter(
        (f) => f.linkAssessment?.level === "caution",
      ).length,
      potentialSensitiveFindings: findings.filter(
        (f) => f.exposureAssessment.level === "high",
      ).length,
      reputationChecked: false,
    },
  };
}
export function assessLinks(body) {
  if (body?.consent?.selfOwned !== true || body.consent.version !== "1")
    throw Object.assign(Error("Confirm this is an authorized link review."), {
      status: 400,
    });
  if (
    !Array.isArray(body.links) ||
    !body.links.length ||
    body.links.length > 20 ||
    body.links.some(
      (x) =>
        !x ||
        typeof x.url !== "string" ||
        x.url.length > 4000 ||
        (x.label !== undefined && typeof x.label !== "string"),
    )
  )
    throw Object.assign(Error("Provide one to twenty URL/label objects."), {
      status: 400,
    });
  return {
    service: "link_assessment",
    checkedAt: new Date().toISOString(),
    networkRequests: false,
    results: body.links.map((x, index) => ({
      index,
      assessment: assessLink(x.url, x.label),
    })),
  };
}
