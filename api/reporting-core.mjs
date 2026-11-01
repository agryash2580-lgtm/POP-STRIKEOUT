// Reporting rules are deterministic. No AI, scraping or external submission.
import { createHash, randomUUID } from "node:crypto";

export const categories = [
  "account_takeover",
  "impersonation",
  "financial_fraud",
  "harassment",
  "exposure",
  "other",
];
export const categoryLabels = {
  account_takeover: "My account was hacked.",
  impersonation: "Someone is impersonating me.",
  financial_fraud: "I received a suspicious link or message.",
  harassment: "I’m not sure.",
  exposure: "My personal information is exposed.",
  other: "I’m not sure.",
};

export const channels = [
  {
    id: "national_portal",
    name: "National Cyber Crime Reporting Portal",
    url: "https://cybercrime.gov.in/",
    purpose:
      "Prepare a cybercrime complaint, then complete it yourself on the official portal.",
    source: "https://cybercrime.gov.in/Webform/FAQ.aspx",
    checkedOn: "2026-10-31",
  },
  {
    id: "instagram_recovery",
    name: "Instagram account recovery",
    url: "https://www.instagram.com/hacked/",
    purpose: "Open Instagram’s official account-recovery flow.",
    source: "https://www.instagram.com/hacked/",
    checkedOn: "2026-10-31",
  },
  {
    id: "facebook_recovery",
    name: "Facebook compromised-account help",
    url: "https://www.facebook.com/hacked",
    purpose: "Open Facebook’s official compromised-account flow.",
    source: "https://www.facebook.com/hacked",
    checkedOn: "2026-10-31",
  },
  {
    id: "google_recovery",
    name: "Google account security and recovery",
    url: "https://support.google.com/accounts/answer/6294825",
    purpose: "Read Google’s official compromised-account instructions.",
    source: "https://support.google.com/accounts/answer/6294825",
    checkedOn: "2026-10-31",
  },
];
for (const channel of channels) {
  channel.sourceStatus = ["instagram_recovery", "facebook_recovery"].includes(
    channel.id,
  )
    ? "official_endpoint_content_access_limited"
    : "official_source_reviewed";
}

export const reportingGuidance = {
  financialFraud: {
    text: "For financial cyber fraud, contact your bank/payment provider through a verified channel and use the official cybercrime helpline 1930 or reporting portal promptly.",
    source: "https://cybercrime.gov.in/Webform/Accept.aspx",
  },
  tracking: {
    text: "Keep the acknowledgement/reference you receive. Check official complaint status on the portal; STRIKEOUT does not fetch police status.",
    source: "https://cybercrime.gov.in/Webform/FAQ.aspx",
  },
  evidence: {
    text: "Keep relevant messages, page addresses, screenshots and transaction records. Review every item before including it in a report.",
    source: "https://cybercrime.gov.in/Webform/FAQ.aspx",
  },
};

export function fail(status, message) {
  throw Object.assign(Error(message), { status });
}
export function text(value, name, max, required = false) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string" || value.length > max)
    fail(400, name + " must be text of at most " + max + " characters.");
  value = value.trim();
  if (required && !value) fail(400, name + " is required.");
  return value;
}

export function dateOnly(value, name = "Date") {
  const date = text(value, name, 10);
  if (!date) return "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    fail(400, name + " must be a real date in YYYY-MM-DD format.");
  return date;
}

export function webAddress(value) {
  const address = text(value, "Page address", 2000);
  if (!address) return "";
  let url;
  try {
    url = new URL(address);
  } catch {
    fail(400, "Use a complete HTTP or HTTPS page address.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    fail(400, "Use an HTTP or HTTPS address without credentials.");
  // Preserve public profile/video identifiers, but discard login/tracking tokens.
  const query = new URLSearchParams();
  for (const key of ["id", "v", "story_fbid"])
    if (url.searchParams.has(key)) query.set(key, url.searchParams.get(key));
  return url.origin + url.pathname + (query.size ? "?" + query : "");
}

export function facts(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail(400, "Provide incident details as an object.");
  if (!categories.includes(input.category))
    fail(400, "Choose a supported incident category.");
  const amount = text(input.amount, "Amount", 30);
  if (amount && !/^\d{1,12}(?:\.\d{1,2})?$/.test(amount))
    fail(400, "Enter the amount as digits with up to two decimal places.");
  const currency = text(input.currency || "INR", "Currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency))
    fail(400, "Use a three-letter currency code.");
  return {
    title: text(input.title, "Title", 120, true),
    category: input.category,
    platform: text(input.platform, "Platform", 100),
    description: text(input.description, "What happened", 8000, true),
    occurredOn: dateOnly(input.occurredOn, "Incident date"),
    profile: webAddress(input.profile),
    realProfile: webAddress(input.realProfile),
    contactName: text(input.contactName, "Name", 120),
    email: text(input.email, "Email", 254),
    phone: text(input.phone, "Phone", 40),
    amount,
    currency,
    transactionReference: text(
      input.transactionReference,
      "Transaction reference",
      120,
    ),
    paymentProvider: text(input.paymentProvider, "Bank/payment provider", 120),
    requestedOutcome: text(input.requestedOutcome, "Requested help", 1500),
  };
}

export function newCase(input) {
  const value = facts(input);
  const now = new Date().toISOString();
  return {
    ...value,
    id: randomUUID(),
    kind: categoryLabels[value.category],
    summary: value.description,
    evidence: [],
    timeline: [],
    reporting: {
      draft: null,
      submissions: [],
      followUps: [],
      resolution: null,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function addActivity(incident, message) {
  incident.updatedAt = new Date().toISOString();
  incident.timeline = [
    ...(incident.timeline || []),
    { id: randomUUID(), at: incident.updatedAt, text: message },
  ].slice(-200);
}

export function reportingState(incident) {
  const state = incident.reporting || {};
  return {
    draft: state.draft || null,
    submissions: Array.isArray(state.submissions) ? state.submissions : [],
    followUps: Array.isArray(state.followUps) ? state.followUps : [],
    resolution: state.resolution || null,
  };
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function evidenceItem(input) {
  const item = {
    id: randomUUID(),
    note: text(input.note, "Evidence note", 3000, true),
    url: webAddress(input.url),
    capturedOn: dateOnly(input.capturedOn, "Capture date"),
    addedAt: new Date().toISOString(),
  };
  if (!input.file) return item;
  const file = input.file;
  const name = text(file.name, "File name", 180, true).replace(
    /[\\/\r\n]/g,
    "_",
  );
  if (!["image/png", "image/jpeg", "application/pdf"].includes(file.type))
    fail(400, "Evidence files must be PNG, JPEG or PDF.");
  const validExtension =
    file.type === "image/png"
      ? /\.png$/i
      : file.type === "image/jpeg"
        ? /\.jpe?g$/i
        : /\.pdf$/i;
  if (!validExtension.test(name))
    fail(
      400,
      "The file name must end in the correct .png, .jpg/.jpeg or .pdf extension.",
    );
  if (typeof file.data !== "string")
    fail(400, "Provide file data as a base64 data URL.");
  const prefix = "data:" + file.type + ";base64,";
  if (!file.data.startsWith(prefix))
    fail(400, "The evidence file type and data URL must agree.");
  const encoded = file.data.slice(prefix.length);
  if (encoded.length > Math.ceil((500 * 1024) / 3) * 4)
    fail(413, "Keep each evidence file below 500 KB.");
  if (!encoded || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))
    fail(400, "Invalid base64 evidence data.");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded)
    fail(400, "Invalid base64 evidence data.");
  if (bytes.length > 500 * 1024)
    fail(413, "Keep each evidence file below 500 KB.");
  const valid =
    file.type === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : bytes.subarray(0, 5).toString() === "%PDF-";
  if (!valid) fail(400, "The file header does not match its declared type.");
  item.file = {
    name,
    type: file.type,
    size: bytes.length,
    sha256: sha256(bytes),
    data: file.data,
  };
  return item;
}

export function sourceFingerprint(incident) {
  // Include legacy summary edits too, so old UI saves cannot leave a draft approved.
  const values = {
    ...facts(incident),
    summary: incident.summary || "",
    evidence: (incident.evidence || []).map((item) => ({
      id: item.id,
      note: item.note,
      url: item.url || item.source || "",
      capturedOn: item.capturedOn || "",
      file: item.file
        ? {
            name: item.file.name,
            type: item.file.type,
            sha256: sha256(String(item.file.data || "")),
          }
        : null,
    })),
  };
  return sha256(JSON.stringify(values));
}

export function draftDigest(draft) {
  return sha256(
    JSON.stringify([
      draft.text,
      draft.sourceFingerprint,
      draft.targetId,
      draft.evidenceIds,
      draft.includeContact,
    ]),
  );
}

export function draftStatus(incident) {
  const draft = reportingState(incident).draft;
  if (!draft) return "missing";
  let fingerprint;
  try {
    fingerprint = sourceFingerprint(incident);
  } catch {
    return "stale";
  }
  if (draft.sourceFingerprint !== fingerprint) return "stale";
  return draft.approvedDigest === draftDigest(draft)
    ? "approved"
    : "review_required";
}

export function generateDraft(incident, input) {
  const target = channels.find((channel) => channel.id === input.targetId);
  if (!target) fail(400, "Choose a supported reporting channel.");
  if (
    !Array.isArray(input.evidenceIds) ||
    input.evidenceIds.length > 20 ||
    input.evidenceIds.some((id) => typeof id !== "string")
  )
    fail(
      400,
      "Select evidence IDs explicitly, including an empty list if none.",
    );
  if (typeof input.includeContact !== "boolean")
    fail(400, "Choose whether to include your contact details.");
  const evidenceIds = [...new Set(input.evidenceIds)];
  const evidence = evidenceIds.map((id) => {
    const found = (incident.evidence || []).find((item) => item.id === id);
    if (!found) fail(400, "Selected evidence does not belong to this case.");
    return found;
  });
  const value = facts(incident);
  const lines = [
    "DRAFT FOR USER REVIEW — NOT SUBMITTED",
    "",
    "To: " + target.name,
    "Subject: " + value.title,
    "",
    "What happened (information supplied by me):",
    value.description,
    "",
    "Incident date: " + (value.occurredOn || "Not supplied"),
    "Platform/service: " + (value.platform || "Not supplied"),
    "Relevant page/profile: " + (value.profile || "Not supplied"),
    "My genuine profile, if relevant: " + (value.realProfile || "Not supplied"),
  ];
  if (value.category === "financial_fraud")
    lines.push(
      "",
      "Amount reported: " +
        (value.amount ? value.currency + " " + value.amount : "Not supplied"),
      "Bank/payment provider: " + (value.paymentProvider || "Not supplied"),
      "Transaction reference: " +
        (value.transactionReference || "Not supplied"),
    );
  lines.push(
    "",
    "What I am requesting:",
    value.requestedOutcome ||
      "Please assess the information provided and advise me on the appropriate next steps.",
  );
  if (input.includeContact)
    lines.push(
      "",
      "Contact details I chose to include:",
      "Name: " + (value.contactName || "Not supplied"),
      "Email: " + (value.email || "Not supplied"),
      "Phone: " + (value.phone || "Not supplied"),
    );
  lines.push("", "Selected evidence:");
  if (!evidence.length) lines.push("No evidence selected.");
  evidence.forEach((item, index) => {
    lines.push(index + 1 + ". " + item.note);
    if (item.url) lines.push("   Source: " + item.url);
    if (item.file)
      lines.push(
        "   File: " +
          item.file.name +
          (item.file.sha256 ? " | SHA-256: " + item.file.sha256 : ""),
      );
  });
  lines.push(
    "",
    "I will review and correct this draft before using it. Unknown facts are marked as not supplied. STRIKEOUT has not filed this complaint or verified the incident.",
  );
  return {
    id: randomUUID(),
    targetId: target.id,
    text: lines.join("\n"),
    evidenceIds,
    includeContact: input.includeContact,
    sourceFingerprint: sourceFingerprint(incident),
    generatedAt: new Date().toISOString(),
    approvedDigest: null,
    approvedAt: null,
  };
}

export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

export function exportHTML(incident) {
  if (draftStatus(incident) !== "approved")
    fail(409, "Review and approve the current draft before exporting it.");
  const draft = reportingState(incident).draft;
  const selected = draft.evidenceIds.map((id) =>
    incident.evidence.find((item) => item.id === id),
  );
  const evidence = selected
    .map(
      (item) =>
        "<article><h3>" +
        escapeHTML(item.file?.name || "Evidence note") +
        "</h3><p>" +
        escapeHTML(item.note) +
        "</p>" +
        (item.file?.type?.startsWith("image/")
          ? '<img alt="Selected evidence supplied by user" src="' +
            escapeHTML(item.file.data) +
            '">'
          : "<p>Attach the original file separately if required.</p>") +
        "</article>",
    )
    .join("");
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>STRIKEOUT reviewed complaint draft</title><style>body{font:15px/1.55 system-ui,sans-serif;color:#172b34;max-width:850px;margin:35px auto;padding:20px}h1{font-size:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}article{border-top:1px solid #aaa;padding-top:14px;break-inside:avoid}img{max-width:100%;max-height:700px;object-fit:contain}.notice{background:#eef5f4;border-left:4px solid #008080;padding:12px}@media print{body{margin:0;padding:10mm}img{max-height:180mm}}</style></head><body><h1>Reviewed complaint draft</h1><p class="notice">Not submitted by STRIKEOUT. Complete reporting yourself through the chosen channel. File hashes describe uploaded bytes, not authenticity or authorship.</p><pre>' +
    escapeHTML(draft.text) +
    "</pre><h2>Selected evidence</h2>" +
    (evidence || "<p>No evidence selected.</p>") +
    "</body></html>"
  );
}

export function publicCase(incident) {
  const reporting = reportingState(incident);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return {
    ...incident,
    reporting: {
      ...reporting,
      draftStatus: draftStatus(incident),
      followUps: reporting.followUps.map((item) => ({
        ...item,
        overdue: item.status === "pending" && item.dueOn < today,
      })),
    },
  };
}
