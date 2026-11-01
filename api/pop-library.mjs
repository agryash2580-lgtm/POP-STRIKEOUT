import express from "express";
import { read, write, remove, hash, createIfMissing } from "./store.mjs";
import { evidenceItem, publicCase, addActivity } from "./reporting-core.mjs";
import { createMailer } from "./report-mail.mjs";
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
const itemKey = (owner, id) => "pop_evidence/" + owner + "/" + id;
const indexKey = (owner) => "pop_evidence_index/" + owner;
async function addToIndex(owner, id) {
  await createIfMissing(indexKey(owner), { ids: [] });
  for (let attempt = 0; attempt < 3; attempt++) {
    const index = await read(indexKey(owner));
    if (index.ids.includes(id)) return;
    if (index.ids.length >= 50)
      fail(413, "Your evidence library holds 50 captures.");
    index.ids.push(id);
    try {
      await write(indexKey(owner), index, index._etag);
      return;
    } catch (error) {
      if (error.status !== 409 || attempt === 2) throw error;
    }
  }
}
export async function deletePopLibrary(owner) {
  const index = await read(indexKey(owner));
  for (const id of index?.ids || []) await remove(itemKey(owner, id));
  await remove(indexKey(owner));
  await remove("pop_conversations/" + owner);
}
export function evidenceLibraryRouter({ identity, guarded, limited }) {
  const router = express.Router();
  router.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    next();
  });
  router.use(
    guarded(async (req, res, next) => {
      req.libraryOwner = await identity(req);
      next();
    }),
  );
  const get = async (req) => {
    if (!/^[a-z0-9-]{1,80}$/i.test(req.params.id))
      fail(404, "Evidence not found.");
    const item = await read(itemKey(req.libraryOwner, req.params.id));
    if (!item) fail(404, "Evidence not found.");
    return item;
  };
  const view = (item) => ({
    id: item.id,
    name: item.name,
    title: item.title,
    address: item.address,
    capturedAt: item.capturedAt,
    receivedAt: item.receivedAt,
    selectedText: item.selectedText,
    note: item.note,
    imageHash: item.file.sha256,
    htmlHash: item.htmlHash,
    hasHTML: !!item.html,
    redactionCount: item.redactionCount,
    email: item.email || null,
  });
  router.get(
    "/",
    guarded(async (req, res) => {
      const index = await read(indexKey(req.libraryOwner));
      const items = await Promise.all(
        (index?.ids || []).map((id) => read(itemKey(req.libraryOwner, id))),
      );
      res.json({
        items: items.filter(Boolean).map(view).reverse(),
        emailConfigured: createMailer().configured(),
      });
    }),
  );
  router.post(
    "/",
    guarded(async (req, res) => {
      limited({ ip: req.libraryOwner, headers: {} }, "evidence-upload", 12);
      const b = req.body;
      if (!/^[a-z0-9-]{1,80}$/i.test(b.id || ""))
        fail(400, "A capture ID is required.");
      const digest = hash(
        JSON.stringify({
          imageData: b.imageData,
          html: b.html || "",
          name: b.name || b.incident,
          note: b.note,
          address: b.address,
          selectedText: b.selectedText,
          redactionCount: b.redactionCount,
        }),
      );
      const existing = await read(itemKey(req.libraryOwner, b.id));
      if (existing) {
        if (existing.captureDigest !== digest)
          fail(
            409,
            "This capture ID already contains different evidence. Keep it unchanged or create a new capture.",
          );
        await addToIndex(req.libraryOwner, b.id);
        return res.json({ item: view(existing), alreadySaved: true });
      }
      const name = String(b.name || b.incident || "")
        .trim()
        .slice(0, 100);
      if (!name) fail(400, "Name this evidence.");
      const fileType = String(b.imageData || "").startsWith("data:image/jpeg")
        ? "image/jpeg"
        : "image/png";
      const verified = evidenceItem({
        note: String(b.note || name).slice(0, 3000),
        url: b.address,
        capturedOn: String(b.capturedAt || "").slice(0, 10),
        file: {
          name: name.replace(/[\\/\r\n]/g,"_") + "." + (fileType === "image/jpeg" ? "jpg" : "png"),
          type: fileType,
          data: b.imageData,
        },
      });
      const raw = String(b.html || "");
      if (raw.length > 1500000)
        fail(
          413,
          "The HTML snapshot exceeds 1.5 million characters. Save without HTML or use a smaller page.",
        );
      const html = raw
        ? "<!doctype html><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'\">" +
          raw
        : "";
      const index = (await read(indexKey(req.libraryOwner))) || { ids: [] };
      if (index.ids.length >= 50)
        fail(
          413,
          "Your evidence library holds 50 captures. Export and delete older captures first.",
        );
      const item = {
        id: b.id,
        captureDigest: digest,
        name,
        title: String(b.title || name).slice(0, 300),
        address: verified.url,
        capturedAt: String(b.capturedAt || "").slice(0, 40),
        receivedAt: new Date().toISOString(),
        selectedText: String(b.selectedText || "").slice(0, 12000),
        note: verified.note,
        file: verified.file,
        html,
        htmlHash: html ? hash(html) : null,
        redactionCount: Number(b.redactionCount) || 0,
      };
      await createIfMissing(itemKey(req.libraryOwner, item.id), item);
      const stored = await read(itemKey(req.libraryOwner, item.id));
      if (stored.captureDigest !== digest)
        fail(409, "This capture ID already contains different evidence.");
      await addToIndex(req.libraryOwner, item.id);
      res.status(201).json({
        item: view(item),
        emailConfigured: createMailer().configured(),
      });
    }),
  );
  router.get(
    "/:id/:kind",
    guarded(async (req, res) => {
      const item = await get(req);
      const kind = req.params.kind;
      if (!["image", "html", "manifest"].includes(kind))
        fail(404, "File not found.");
      res.set({
        "Cache-Control": "no-store",
        "Content-Disposition":
          'attachment; filename="pop-' +
          item.id +
          (kind === "image"
            ? item.file.type === "image/jpeg"
              ? ".jpg"
              : ".png"
            : kind === "html"
              ? ".html"
              : ".json") +
          '"',
        "Content-Security-Policy": "sandbox; default-src 'none'",
      });
      if (kind === "image")
        return res
          .type(item.file.type)
          .send(Buffer.from(item.file.data.split(",")[1], "base64"));
      if (kind === "html")
        return res.type("text/html").send(item.html || "No HTML was included.");
      return res.json(view(item));
    }),
  );
  router.post(
    "/:id/attach",
    guarded(async (req, res) => {
      const item = await get(req),
        owner = await read("users/" + req.libraryOwner);
      const incident = owner?.cases?.find((c) => c.id === req.body.caseId);
      if (!incident) fail(404, "Case not found.");
      if (incident.evidence.some((e) => e.popCaptureId === item.id))
        return res.json({
          case: publicCase(incident),
          dataVersion: owner.dataVersion,
          alreadyAttached: true,
        });
      const evidence = evidenceItem({
        note: (
          item.name +
          "\n" +
          item.note +
          "\nSelected text: " +
          item.selectedText +
          "\nCaptured: " +
          item.capturedAt +
          "\nReceived: " +
          item.receivedAt +
          "\nImage SHA-256: " +
          item.file.sha256 +
          "\nHTML SHA-256: " +
          (item.htmlHash || "not included")
        ).slice(0, 3000),
        url: item.address,
        capturedOn: item.capturedAt.slice(0, 10),
        file: item.file,
      });
      evidence.popCaptureId = item.id;
      incident.evidence.push(evidence);
      if (JSON.stringify(owner.cases).length > 1450000)
        fail(
          413,
          "This case collection is too large. Remove older attachments first.",
        );
      addActivity(incident, "Attached reviewed Pop capture: " + item.name);
      owner.dataVersion = (owner.dataVersion || 0) + 1;
      await write("users/" + owner.id, owner, owner._etag);
      res.json({ case: publicCase(incident), dataVersion: owner.dataVersion });
    }),
  );
  router.post(
    "/:id/email",
    guarded(async (req, res) => {
      limited({ ip: req.libraryOwner, headers: {} }, "evidence-email", 6);
      const item = await get(req);
      const recipient = await read("analysis_email/" + req.libraryOwner);
      if (!recipient?.verifiedAt)
        fail(409, "Verify your email address in website Delivery & Pop first.");
      const mail = createMailer();
      if (!mail.configured())
        fail(
          503,
          "Email delivery is not configured. Your evidence is saved and downloadable.",
        );
      const attachments = [
        {
          filename:
            "screenshot." + (item.file.type === "image/jpeg" ? "jpg" : "png"),
          content: item.file.data.split(",")[1],
        },
        {
          filename: "manifest.json",
          content: Buffer.from(JSON.stringify(view(item), null, 2)).toString(
            "base64",
          ),
        },
      ];
      if (item.html)
        attachments.push({
          filename: "page-snapshot.html",
          content: Buffer.from(item.html).toString("base64"),
        });
      const receipt = await mail.send({
        to: recipient.email,
        subject: "STRIKEOUT evidence: " + item.name,
        text: "Your reviewed evidence bundle. Capture time is reported by the device. File hashes support later comparisons; they do not prove authenticity or legal admissibility. Image redactions do not edit HTML.",
        attachments,
        key: "pop-evidence-" + req.libraryOwner + "-" + item.id,
      });
      item.email = receipt;
      await write(itemKey(req.libraryOwner, item.id), item, item._etag);
      res.json(receipt);
    }),
  );
  router.delete(
    "/:id",
    guarded(async (req, res) => {
      const item = await get(req);
      await remove(itemKey(req.libraryOwner, item.id));
      const index = await read(indexKey(req.libraryOwner));
      if (index) {
        index.ids = index.ids.filter((id) => id !== item.id);
        await write(indexKey(req.libraryOwner), index, index._etag);
      }
      res.json({ deleted: true, attachedCaseCopiesRemain: true });
    }),
  );
  return router;
}
