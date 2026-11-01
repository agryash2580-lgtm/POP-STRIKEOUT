import express from "express";
import { randomUUID } from "node:crypto";
import { write } from "./store.mjs";
import { deleteCaseReportData } from "./reports.mjs";
import {
  categories,
  categoryLabels,
  channels,
  reportingGuidance,
  fail,
  text,
  dateOnly,
  facts,
  newCase,
  addActivity,
  reportingState,
  evidenceItem,
  generateDraft,
  draftDigest,
  draftStatus,
  exportHTML,
  publicCase,
} from "./reporting-core.mjs";

export function reportingRouter({ user, guarded, limited }) {
  const router = express.Router();
  router.get("/channels", (req, res) =>
    res.json({
      categories,
      channels,
      guidance: reportingGuidance,
      automaticSubmission: false,
      automaticStatusTracking: false,
    }),
  );
  router.use(
    guarded(async (req, res, next) => {
      req.reportingOwner = await user(req);
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
        limited(
          { ip: req.reportingOwner.id, headers: {} },
          "reporting-write",
          60,
        );
      next();
    }),
  );

  // Reads never mutate stored records. A signed-in account sees only its own cases.
  async function find(req) {
    const owner = req.reportingOwner;
    const incident = (owner.cases || []).find(
      (item) => item.id === req.params.id,
    );
    if (!incident) fail(404, "Case not found.");
    return { owner, incident };
  }

  function requireVersion(req, owner) {
    if (
      !Number.isInteger(req.body?.dataVersion) ||
      req.body.dataVersion !== (owner.dataVersion || 0)
    )
      fail(409, "Your case list changed. Reload it before saving this action.");
  }

  async function save(res, owner, incident, message, status = 200, afterWrite) {
    if (message && incident) addActivity(incident, message);
    if (JSON.stringify(owner.cases || []).length > 1450000)
      fail(
        413,
        "Your cases are too large. Export and remove older evidence before adding more.",
      );
    owner.dataVersion = (owner.dataVersion || 0) + 1;
    // Existing storage uses an ETag: two simultaneous saves cannot overwrite each other.
    await write("users/" + owner.id, owner, owner._etag);
    if (afterWrite) await afterWrite();
    res
      .status(status)
      .json({
        case: incident ? publicCase(incident) : null,
        dataVersion: owner.dataVersion,
      });
  }

  router.get(
    "/cases",
    guarded(async (req, res) => {
      const owner = req.reportingOwner;
      res.json({
        cases: (owner.cases || []).map(publicCase),
        dataVersion: owner.dataVersion || 0,
      });
    }),
  );

  router.post(
    "/cases",
    guarded(async (req, res) => {
      const owner = req.reportingOwner;
      requireVersion(req, owner);
      if ((owner.cases || []).length >= 20)
        fail(400, "The workspace limit is 20 cases.");
      const incident = newCase(req.body.details);
      owner.cases = [...(owner.cases || []), incident];
      await save(
        res,
        owner,
        incident,
        "Private incident record created. Nothing submitted externally.",
        201,
      );
    }),
  );

  router.get(
    "/cases/:id",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      res.json({
        case: publicCase(incident),
        dataVersion: owner.dataVersion || 0,
      });
    }),
  );

  router.patch(
    "/cases/:id",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if (
        !req.body.details ||
        typeof req.body.details !== "object" ||
        Array.isArray(req.body.details)
      )
        fail(400, "Provide the facts to update.");
      const updated = facts({ ...incident, ...req.body.details });
      Object.assign(incident, updated, {
        kind: categoryLabels[updated.category],
        summary: updated.description,
      });
      await save(
        res,
        owner,
        incident,
        "Incident facts updated. Existing report approval must be checked again.",
      );
    }),
  );

  router.delete(
    "/cases/:id",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if (req.body.confirm !== true) fail(400, "Confirm deletion explicitly.");
      owner.cases = owner.cases.filter((item) => item.id !== incident.id);
      await save(res, owner, null, null, 200, () =>
        deleteCaseReportData(owner.id, incident.id),
      );
    }),
  );

  router.post(
    "/cases/:id/evidence",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if ((incident.evidence || []).length >= 20)
        fail(400, "Keep each case to 20 evidence items.");
      const item = evidenceItem(req.body.evidence || {});
      incident.evidence = [...(incident.evidence || []), item];
      await save(
        res,
        owner,
        incident,
        "Evidence added privately. Report selections have not changed.",
        201,
      );
    }),
  );

  router.delete(
    "/cases/:id/evidence/:evidenceId",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if (
        !(incident.evidence || []).some(
          (item) => item.id === req.params.evidenceId,
        )
      )
        fail(404, "Evidence not found.");
      incident.evidence = incident.evidence.filter(
        (item) => item.id !== req.params.evidenceId,
      );
      await save(
        res,
        owner,
        incident,
        "Evidence removed from this case. Previously exported copies remain elsewhere.",
      );
    }),
  );

  router.get(
    "/cases/:id/evidence/:evidenceId/file",
    guarded(async (req, res) => {
      const { incident } = await find(req);
      const item = (incident.evidence || []).find(
        (entry) => entry.id === req.params.evidenceId,
      );
      if (!item?.file?.data) fail(404, "Evidence file not found.");
      const match =
        /^data:(image\/png|image\/jpeg|application\/pdf);base64,([A-Za-z0-9+/=]+)$/.exec(
          item.file.data,
        );
      if (!match)
        fail(
          400,
          "This legacy evidence file is not supported by the download route.",
        );
      // Always download originals; uploaded PDFs are never executed in our page.
      const extension =
        match[1] === "image/png"
          ? ".png"
          : match[1] === "image/jpeg"
            ? ".jpg"
            : ".pdf";
      let filename = item.file.name || "evidence";
      if (
        !(
          match[1] === "image/jpeg"
            ? /\.jpe?g$/i
            : new RegExp("\\" + extension + "$", "i")
        ).test(filename)
      )
        filename += extension;
      res
        .type("application/octet-stream")
        .set(
          "Content-Disposition",
          "attachment; filename*=UTF-8''" + encodeURIComponent(filename),
        )
        .send(Buffer.from(match[2], "base64"));
    }),
  );

  router.post(
    "/cases/:id/draft",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      incident.reporting = reportingState(incident);
      incident.reporting.draft = generateDraft(incident, req.body);
      await save(
        res,
        owner,
        incident,
        "Complaint draft generated from supplied facts and explicitly selected evidence. Review required.",
      );
    }),
  );

  router.patch(
    "/cases/:id/draft",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      const draft = reportingState(incident).draft;
      if (!draft) fail(404, "Generate a draft first.");
      if (draftStatus(incident) === "stale")
        fail(
          409,
          "Incident details changed. Regenerate the draft before editing it.",
        );
      draft.text = text(req.body.text, "Draft text", 20000, true);
      draft.approvedDigest = null;
      draft.approvedAt = null;
      await save(
        res,
        owner,
        incident,
        "Draft wording edited. Approval cleared.",
      );
    }),
  );

  router.post(
    "/cases/:id/draft/approve",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      const draft = reportingState(incident).draft;
      if (!draft) fail(404, "Generate a draft first.");
      if (req.body.reviewed !== true)
        fail(400, "Confirm that you reviewed the exact draft.");
      if (draftStatus(incident) === "stale")
        fail(409, "The case changed. Generate and review a fresh draft.");
      // Approval binds the displayed text too, not just a checkbox from an old tab.
      if (req.body.text !== draft.text)
        fail(
          409,
          "The displayed draft changed. Reload and review its exact wording.",
        );
      draft.approvedDigest = draftDigest(draft);
      draft.approvedAt = new Date().toISOString();
      await save(
        res,
        owner,
        incident,
        "User approved this exact draft for export. Nothing submitted.",
      );
    }),
  );

  router.get(
    "/cases/:id/export",
    guarded(async (req, res) => {
      const { incident } = await find(req);
      if (draftStatus(incident) !== "approved")
        fail(409, "Review and approve the current draft before exporting.");
      const format = req.query.format || "text";
      if (format === "html") {
        res
          .type("html")
          .set(
            "Content-Disposition",
            'attachment; filename="strikeout-reviewed-draft.html"',
          )
          .send(exportHTML(incident));
      } else if (format === "text") {
        res
          .type("text/plain")
          .set(
            "Content-Disposition",
            'attachment; filename="strikeout-reviewed-draft.txt"',
          )
          .send(reportingState(incident).draft.text);
      } else fail(400, "Choose text or html export.");
    }),
  );

  router.post(
    "/cases/:id/submissions",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if (req.body.submittedByMe !== true)
        fail(400, "Confirm you submitted this yourself outside STRIKEOUT.");
      if (!channels.some((channel) => channel.id === req.body.channelId))
        fail(400, "Choose a supported channel.");
      const state = reportingState(incident);
      if (state.submissions.length >= 30)
        fail(400, "Limit this case to 30 submission records.");
      state.submissions.push({
        id: randomUUID(),
        channelId: req.body.channelId,
        reference: text(req.body.reference, "Submission reference", 180),
        submittedOn: dateOnly(req.body.submittedOn, "Submission date"),
        note: text(req.body.note, "Submission note", 1500),
        recordedAt: new Date().toISOString(),
        source: "user-recorded",
        officialStatus: "not_checked",
      });
      incident.reporting = state;
      await save(
        res,
        owner,
        incident,
        "User recorded an external submission. Official outcome not checked.",
        201,
      );
    }),
  );

  router.post(
    "/cases/:id/follow-ups",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      const dueOn = dateOnly(req.body.dueOn, "Follow-up date");
      if (!dueOn) fail(400, "Choose a follow-up date.");
      const state = reportingState(incident);
      if (state.followUps.length >= 30)
        fail(400, "Limit this case to 30 follow-ups.");
      state.followUps.push({
        id: randomUUID(),
        dueOn,
        note: text(req.body.note, "Follow-up note", 1500, true),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      incident.reporting = state;
      await save(
        res,
        owner,
        incident,
        "Follow-up date saved. No background reminder or message scheduled.",
        201,
      );
    }),
  );

  router.patch(
    "/cases/:id/follow-ups/:followUpId",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      const followUp = reportingState(incident).followUps.find(
        (item) => item.id === req.params.followUpId,
      );
      if (!followUp) fail(404, "Follow-up not found.");
      if (!["pending", "done"].includes(req.body.status))
        fail(400, "Choose pending or done.");
      followUp.status = req.body.status;
      followUp.completedAt =
        req.body.status === "done" ? new Date().toISOString() : null;
      await save(
        res,
        owner,
        incident,
        "User marked a follow-up " + req.body.status + ".",
      );
    }),
  );

  router.post(
    "/cases/:id/resolution",
    guarded(async (req, res) => {
      const { owner, incident } = await find(req);
      requireVersion(req, owner);
      if (typeof req.body.resolved !== "boolean")
        fail(400, "Choose resolved or still open.");
      incident.reporting = reportingState(incident);
      incident.reporting.resolution = {
        resolved: req.body.resolved,
        note: text(req.body.note, "Resolution note", 1500, true),
        source: "user-reported",
        recordedAt: new Date().toISOString(),
      };
      await save(
        res,
        owner,
        incident,
        "User recorded their assessment of the outcome. This is not independent verification.",
      );
    }),
  );
  return router;
}
