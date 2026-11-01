import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { hash } from "./store.mjs";
export const fields = [
  "portfolioText",
  "portfolioQr",
  "resumeText",
  "resumeQr",
];
export const normalize = (s, country = "US") => {
  const p = parsePhoneNumberFromString(String(s || ""), country);
  return p && p.isPossible() ? p.number : null;
};
export function phoneMatches(text, number, country = "US") {
  const target = normalize(number, country);
  if (!target) return false;
  return (String(text).match(/\+?\d[\d ().-]{6,}\d/g) || []).some(
    (s) => normalize(s, country) === target,
  );
}
export function seed(id) {
  return {
    id,
    revision: 1,
    updatedAt: new Date().toISOString(),
    name: "Mira Rao",
    role: "Designer. Builder. Curious human.",
    email: "mira.work@example.com",
    phone: "+1 (202) 555-0147",
    portfolioText: "+1 (202) 555-0147",
    portfolioQr: "+1 (202) 555-0147",
    resumeText: "+1 (202) 555-0147",
    resumeQr: "+1 (202) 555-0147",
    externalPhone: "+1 (202) 555-0147",
    projects: [
      {
        title: "Neighbourhood Notes",
        description:
          "A small archive of the places that make a city feel like home.",
        url: "https://example.com/notes",
      },
      {
        title: "Small Hours",
        description: "An independent reading room for people who stay curious.",
        url: "https://example.com/hours",
      },
    ],
  };
}
export const contact = (p, field) =>
  [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "FN:" + p.name,
    "EMAIL:" + p.email,
    ...(p[field] ? ["TEL:" + p[field]] : []),
    "END:VCARD",
  ].join("\n");
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function qr(p, field) {
  return QRCode.toBuffer(contact(p, field), {
    type: "png",
    width: 280,
    margin: 3,
    errorCorrectionLevel: "M",
  });
}
export async function resume(p) {
  const d = await PDFDocument.create();
  d.setTitle(p.name + " — résumé");
  d.setAuthor(p.name);
  d.setCreationDate(new Date("2026-01-01"));
  d.setModificationDate(new Date(p.updatedAt));
  const page = d.addPage([595, 842]),
    font = await d.embedFont(StandardFonts.Helvetica),
    bold = await d.embedFont(StandardFonts.HelveticaBold);
  const text = (s, y, size = 12, b = false) =>
    page.drawText(s, {
      x: 48,
      y,
      size,
      font: b ? bold : font,
      color: rgb(0.19, 0.12, 0.29),
    });
  text("FICTIONAL DEMONSTRATION RESUME", 794, 9);
  text(p.name, 744, 30, true);
  text(p.role, 714, 12);
  text(p.email, 681, 12);
  if (p.resumeText) text(p.resumeText, 658, 12);
  text("SELECTED WORK", 600, 12, true);
  let y = 566;
  for (const project of p.projects) {
    text(project.title, y, 18, true);
    text(project.description, y - 27, 10);
    text(project.url, y - 48, 10);
    y -= 112;
  }
  text("CONTACT CARD", 239, 11, true);
  text("Work email and selected contact details.", 216, 10);
  const image = await d.embedPng(await qr(p, "resumeQr"));
  page.drawImage(image, { x: 410, y: 86, width: 130, height: 130 });
  text("Prepared for the Strikeout controlled demonstration.", 65, 9);
  return Buffer.from(await d.save());
}
export function portfolio(p) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)} — portfolio</title><style>body{font:17px/1.6 Georgia,serif;background:#f4f0e8;color:#312140;margin:0}main{max-width:920px;margin:auto;padding:32px}small{font:12px monospace}header{border-bottom:2px solid;padding:45px 0}h1{font-size:64px;line-height:1;margin:20px 0}h2{font-size:30px}article{padding:22px 0;border-bottom:1px solid #b9b0bf}a{color:#66378c}footer{display:flex;justify-content:space-between;align-items:center;margin-top:35px}img{width:160px;height:160px}p{max-width:640px}</style></head><body><main><small>FICTIONAL DEMONSTRATION · PUBLISHED REVISION ${p.revision}</small><header><h1>${esc(p.name)}</h1><p>${esc(p.role)}</p><a href="mailto:${esc(p.email)}">${esc(p.email)}</a>${p.portfolioText ? `<p data-location="portfolioText"><a href="tel:${esc(p.portfolioText)}">${esc(p.portfolioText)}</a></p>` : ""}</header><h2>Selected work</h2>${p.projects.map((x) => `<article data-project><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p><a href="${esc(x.url)}">Visit project</a></article>`).join("")}<footer><div><a href="/published/${p.id}/resume.pdf">Download my résumé</a><p>Scan my contact card.</p></div><img data-contact-qr="portfolioQr" alt="Contact QR code" src="/published/${p.id}/contact.png?r=${p.revision}"></footer></main></body></html>`;
}
export const external = (p) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Independent event archive — demonstration</title></head><body style="font:18px/1.7 Georgia;max-width:750px;margin:60px auto;padding:20px;background:#f3eee4;color:#30213d"><small>SIMULATED EXTERNAL SOURCE · READ-ONLY</small><h1>Community design evening</h1><p>Archive contributor: ${esc(p.name)}</p><p>Archived contact: <strong>${esc(p.externalPhone)}</strong></p><p>This independent copy is intentionally not changed by a portfolio repair. A removal request remains pending.</p></body></html>`;
export const fingerprint = (p) => hash(JSON.stringify(p));
export function prepare(p, number, selected, country = "US") {
  if (!normalize(number, country))
    throw Error("Enter a complete phone number and country.");
  if (!selected.length)
    throw Error("Confirm and select at least one owned occurrence.");
  const next = structuredClone(p);
  for (const f of selected) {
    if (!fields.includes(f) || !phoneMatches(p[f], number, country))
      throw Error(
        "The selected occurrence no longer matches. Inspect the published source again.",
      );
    next[f] = "";
  }
  next.revision = p.revision + 1;
  next.updatedAt = new Date().toISOString();
  return next;
}
export function analyzeLink(label, destination) {
  let url;
  try {
    url = new URL(destination);
  } catch {
    return [
      {
        signal: "Invalid URL",
        explanation:
          "This is not a complete HTTP or HTTPS address. Do not open it until you know its destination.",
      },
    ];
  }
  if (!["https:", "http:"].includes(url.protocol))
    return [
      {
        signal: "Unsupported link type",
        explanation:
          "Inspect this outside Pop. Only HTTP and HTTPS URLs are analysed.",
      },
    ];
  const signals = [];
  let visible;
  try {
    visible = new URL(label.startsWith("http") ? label : "https://" + label)
      .hostname;
  } catch {}
  if (
    visible &&
    visible.includes(".") &&
    visible.replace(/^www\./, "") !== url.hostname.replace(/^www\./, "")
  )
    signals.push({
      signal: "Label and destination differ",
      explanation: `The label says ${visible}, but the destination is ${url.hostname}. Check which site you intended to visit.`,
    });
  if (url.protocol === "http:")
    signals.push({
      signal: "Unencrypted connection",
      explanation:
        "This address uses HTTP. That does not prove a scam, but information sent here may not be protected in transit.",
    });
  if (url.hostname.includes("xn--"))
    signals.push({
      signal: "Encoded international domain",
      explanation:
        "This domain uses an encoded international name. Check its spelling carefully; this alone does not establish a scam.",
    });
  if (["bit.ly", "tinyurl.com", "t.co", "shorturl.at"].includes(url.hostname))
    signals.push({
      signal: "Shortened destination",
      explanation:
        "The final destination is hidden behind a short link. Pop has not followed it.",
    });
  if (url.username || url.password)
    signals.push({
      signal: "Credentials embedded in address",
      explanation:
        "Text before @ is not the destination domain. Check the hostname carefully.",
    });
  return signals.length
    ? signals
    : [
        {
          signal: "No supported warning sign found",
          explanation:
            "These local checks do not establish that a link is safe. Pop has not visited the destination.",
        },
      ];
}
