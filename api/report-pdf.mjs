// Formatting is ordinary code. Gemini never creates or executes a PDF program.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function reportPDF(job) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("STRIKEOUT private case report");
  pdf.setCreationDate(new Date(job.createdAt));
  const regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page, y;
  // Built-in PDF fonts do not cover all Unicode. Unsupported characters get an
  // explicit printable marker rather than crashing an otherwise usable export.
  function printable(value, font) {
    return Array.from(String(value))
      .map((c) => {
        try {
          font.encodeText(c);
          return c;
        } catch {
          return "?";
        }
      })
      .join("");
  }
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 785;
  }
  newPage();
  function line(content = "", heading = false) {
    const font = heading ? bold : regular,
      size = heading ? 13 : 10;
    const words = printable(content, font).replace(/\r/g, "").split(/\s+/);
    let row = "";
    function draw() {
      if (y < 65) newPage();
      page.drawText(row, {
        x: 48,
        y,
        size,
        font,
        color: heading ? rgb(0, 0.26, 0.3) : rgb(0.08, 0.1, 0.12),
      });
      y -= heading ? 21 : 15;
      row = "";
    }
    // Break long URLs/identifiers as well as normal words.
    for (const word of words) {
      const candidate = row ? row + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) <= 495) {
        row = candidate;
        continue;
      }
      if (row) draw();
      if (font.widthOfTextAtSize(word, size) <= 495) {
        row = word;
        continue;
      }
      for (const char of word) {
        if (font.widthOfTextAtSize(row + char, size) > 495) draw();
        row += char;
      }
    }
    draw();
  }
  function section(title, paragraphs) {
    if (y < 110) newPage();
    y -= 9;
    line(title, true);
    for (const paragraph of paragraphs.length
      ? paragraphs
      : ["No items included."])
      for (const part of String(paragraph).split("\n")) line(part);
  }
  line("STRIKEOUT | PRIVATE CASE REPORT", true);
  line(
    "Report " + job.version + " | " + job.createdAt + " | Case " + job.caseId,
  );
  line(
    (job.method === "local_template"
      ? "Local template. No AI or fresh research."
      : "AI-assisted guidance.") +
      " User-reported facts. Not a filed complaint or verified finding.",
  );
  section("Incident reported by the user", [
    job.snapshot.details.title,
    job.report.summary,
  ]);
  if (job.research.limitation)
    section("Research availability", [job.research.limitation]);
  section("Supplied timeline", [
    job.snapshot.details.occurredOn
      ? "Incident date supplied by user: " + job.snapshot.details.occurredOn
      : "Incident date not supplied. No date inferred.",
  ]);
  section(
    "Selected evidence and observations",
    job.report.observations.length
      ? job.report.observations.map(
          (o) =>
            o.text +
            (o.evidenceIds.length
              ? " [" + o.evidenceIds.join(", ") + "]"
              : " [User account / no evidence reference]"),
        )
      : ["No evidence observations supplied."],
  );
  section("Unknowns and limits", job.report.unknowns);
  section(
    "Suggested next steps",
    job.report.nextSteps.map(
      (s, i) =>
        `${i + 1}. ${s.title}: ${s.detail} [${s.sourceIds.join(", ")}] | STRIKEOUT service: ${s.serviceId}`,
    ),
  );
  section("Complaint draft for user review; NOT SUBMITTED", [
    job.report.complaintDraft,
  ]);
  section(
    "Selected evidence inventory",
    job.snapshot.evidence.map(
      (e) => e.id + ": " + e.note + (e.url ? " | " + e.url : ""),
    ),
  );
  section(
    "Guidance sources",
    job.research.sources.map(
      (s) => `[${s.id}] ${s.title} (${s.kind === "security_vendor" ? "security-provider guidance" : "official source"})\n${s.url}\nRetrieved: ${s.retrievedAt}`,
    ),
  );
  section("Reading this document", [
    "Sources support general guidance, not the truth of the incident. AI may make mistakes; review facts before sharing. Evidence originals are not embedded. Unsupported font characters are shown as ?. Progress and follow-up messages are stored separately from this report version.",
  ]);
  pdf
    .getPages()
    .forEach((p, i) =>
      p.drawText(
        `${i + 1} / ${pdf.getPageCount()} | Private - review before sharing`,
        { x: 48, y: 32, size: 8, font: regular },
      ),
    );
  return Buffer.from(await pdf.save());
}
