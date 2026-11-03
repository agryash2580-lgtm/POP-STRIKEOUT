import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerURL;

// Extract locally. The form sends text only after the user reviews and submits it.
export async function documentText(file: File): Promise<string> {
  if (file.size > 2_000_000) throw Error("Keep documents below 2 MB.");
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    const text = await file.text();
    if (text.length > 100000)
      throw Error("Keep extracted text below 100,000 characters.");
    return text;
  }
  const task = getDocument({
    data: await file.arrayBuffer(),
  });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > 30) throw Error("Use a PDF with at most 30 pages.");
    let text = "";
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent();
      text += content.items.map((item: any) => item.str || "").join(" ") + "\n";
      if (text.length > 100000)
        throw Error("Extracted PDF text exceeds 100,000 characters.");
    }
    if (!text.trim())
      throw Error(
        "This PDF contains no readable text. Image-only PDFs need OCR, which this tool does not provide.",
      );
    return text;
  } finally {
    await task.destroy();
  }
}
