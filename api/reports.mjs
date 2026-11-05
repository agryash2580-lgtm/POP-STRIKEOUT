import express from "express";
import { randomInt, randomUUID } from "node:crypto";
import { read, write, remove, hash } from "./store.mjs";
import { fail, text, sourceFingerprint, newCase } from "./reporting-core.mjs";
import { createGemini, caseSnapshot, services } from "./report-ai.mjs";
import { reportPDF } from "./report-pdf.mjs";
import { createMailer } from "./report-mail.mjs";

export async function deleteCaseReportData(ownerId, caseId) {
  const key = "analysis_cases/" + ownerId + "/" + caseId;
  const state = await read(key);
  for (const id of state?.jobs || [])
    await remove("analysis_jobs/" + ownerId + "/" + id);
  await remove(key);
}
export async function deleteAccountReportData(owner) {
  for (const value of owner.cases || [])
    await deleteCaseReportData(owner.id, value.id);
  await remove("analysis_email/" + owner.id);
}

// One durable stage per request. Refreshing resumes the same saved job.
// No detached promises, in-memory-only queue, or assumed serverless worker.
export function reportsRouter({
  user,
  guarded,
  limited,
  ai = createGemini(),
  mail = createMailer(),
  makePDF = reportPDF,
}) {
  const router = express.Router();
  router.use(
    guarded(async (req, res, next) => {
      req.reportOwner = await user(req);
      next();
    }),
  );
  const ownerKey = (req) => "analysis_email/" + req.reportOwner.id;
  const indexKey = (req, id) =>
    "analysis_cases/" + req.reportOwner.id + "/" + id;
  const jobKey = (req, id) => "analysis_jobs/" + req.reportOwner.id + "/" + id;
  function throttle(req, scope, max) {
    limited({ ip: req.reportOwner.id, headers: {} }, "reports-" + scope, max);
  }
  function incident(req, id = req.params.id) {
    if (typeof id !== "string" || !/^[a-z0-9_-]{1,80}$/i.test(id))
      fail(404, "Case not found.");
    const value = (req.reportOwner.cases || []).find((c) => c.id === id);
    if (!value) fail(404, "Case not found.");
    return value;
  }
  async function index(req, id) {
    return (
      (await read(indexKey(req, id))) || {
        jobs: [],
        completedSteps: [],
        messages: [],
      }
    );
  }
  function stale(job, value) {
    try {
      return job.snapshot.sourceFingerprint !== sourceFingerprint(value);
    } catch {
      return true;
    }
  }
  function view(job, value) {
    // Never expose the PDF payload, selected file bytes, lease, or provider secret.
    return {
      id: job.id,
      caseId: job.caseId,
      version: job.version,
      stage: job.stage,
      busy: !!(job.lease?.until > Date.now()),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      stale: stale(job, value),
      error: job.error || null,
      pdfReady: !!job.pdf,
      selection: job.selection,
      method: job.method || "gemini",
      report: job.report || null,
      research: job.research || null,
      email: job.email,
      services,
      pdfURL: job.pdf ? "/api/reports/jobs/" + job.id + "/pdf" : null,
    };
  }
  async function load(req) {
    if (!/^[a-f0-9-]{36}$/.test(req.params.jobId))
      fail(404, "Report not found.");
    const job = await read(jobKey(req, req.params.jobId));
    if (!job) fail(404, "Report not found.");
    return { job, value: incident(req, job.caseId) };
  }
  async function saveJob(req, job) {
    job.updatedAt = new Date().toISOString();
    await write(jobKey(req, job.id), job, job._etag);
  }
  async function start(req, value, options) {
    const snapshot = caseSnapshot(value, options);
    if (typeof options.emailReport !== "boolean")
      fail(400, "Choose whether to email the report.");
    const state = await index(req, value.id);
    const activeId = state.jobs.at(-1);
    const active = activeId ? await read(jobKey(req, activeId)) : null;
    // Repeated Start clicks reuse the unfinished job, including its disclosure.
    const selection = {
      evidenceIds: [...new Set(options.evidenceIds)].sort(),
      includeFiles: options.includeFiles,
      emailReport: options.emailReport,
    };
    if (active && active.stage !== "ready" && !stale(active, value)) {
      if (JSON.stringify(active.selection) !== JSON.stringify(selection))
        fail(
          409,
          "This case already has an unfinished report with a different sharing selection. Resume that saved selection or delete its report data before starting again.",
        );
      return active;
    }
    if (state.jobs.length >= 5)
      fail(400, "Keep each case to five report versions.");
    const address = await read(ownerKey(req));
    if (options.emailReport && !address?.verifiedAt)
      fail(400, "Verify your email address before enabling emailed reports.");
    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      caseId: value.id,
      version: state.jobs.length + 1,
      stage: "research",
      snapshot,
      selection,
      createdAt: now,
      updatedAt: now,
      email: {
        status: options.emailReport ? "pending" : "not_requested",
        to: options.emailReport ? address.email : null,
      },
      lease: null,
    };
    await write(jobKey(req, job.id), job);
    state.jobs.push(job.id);
    await write(indexKey(req, value.id), state, state._etag);
    return job;
  }

  router.get("/capabilities", (req, res) =>
    res.json({
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      emailConfigured: mail.configured(),
      services,
      execution: "request-driven-resumable-stages",
      region: "India",
      evidenceFilesOptIn: true,
    }),
  );
  router.get(
    "/email",
    guarded(async (req, res) => {
      const value = await read(ownerKey(req));
      res.json({ email: value?.email || null, verified: !!value?.verifiedAt });
    }),
  );
  router.post(
    "/email/verification",
    guarded(async (req, res) => {
      throttle(req, "verify-send", 2);
      const email = text(req.body.email, "Email", 254, true).toLowerCase();
      if (
        !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ||
        /[\r\n]/.test(email)
      )
        fail(400, "Enter a valid email address.");
      if (!mail.configured())
        fail(
          503,
          "Configure the email service before verifying addresses. Reports and PDFs work without it.",
        );
      const previous = await read(ownerKey(req));
      if (previous?.issuedAt && Date.now() - previous.issuedAt < 60000)
        fail(429, "Wait a minute before requesting another code.");
      const code = String(randomInt(100000, 1000000)),
        salt = randomUUID();
      const record = {
        email,
        codeHash: hash(salt + code),
        salt,
        expiresAt: Date.now() + 10 * 60000,
        issuedAt: Date.now(),
        attempts: 0,
        verifiedAt: null,
      };
      await write(ownerKey(req), record, previous?._etag);
      await mail.send({
        to: email,
        subject: "Your STRIKEOUT verification code",
        text:
          "Your code is " +
          code +
          ". It expires in 10 minutes. This verifies access to this address for STRIKEOUT report delivery and authorized exposure checks. Never share this code with a support person.",
        key: "verify/" + req.reportOwner.id + "/" + salt,
      });
      res.json({ sent: true, expiresInSeconds: 600 });
    }),
  );
  router.post(
    "/email/confirm",
    guarded(async (req, res) => {
      throttle(req, "verify-confirm", 8);
      const state = await read(ownerKey(req));
      if (
        !state ||
        state.expiresAt < Date.now() ||
        state.attempts >= 5 ||
        state.verifiedAt
      )
        fail(400, "Request a new verification code.");
      const code = text(req.body.code, "Code", 6, true);
      state.attempts++;
      const matches = hash(state.salt + code) === state.codeHash;
      if (matches) {
        state.verifiedAt = new Date().toISOString();
        delete state.codeHash;
        delete state.salt;
      }
      await write(ownerKey(req), state, state._etag);
      if (!matches) fail(400, "The code did not match.");
      res.json({ email: state.email, verified: true });
    }),
  );

  router.get(
    "/cases/:id",
    guarded(async (req, res) => {
      const value = incident(req),
        state = await index(req, value.id);
      const jobs = await Promise.all(
        state.jobs.map((id) => read(jobKey(req, id))),
      );
      res.json({
        reports: jobs.filter(Boolean).map((job) => view(job, value)),
        completedSteps: state.completedSteps,
        messages: state.messages,
      });
    }),
  );
  router.post(
    "/cases",
    guarded(async (req, res) => {
      throttle(req, "create", 5);
      const owner = req.reportOwner;
      if (
        !Number.isInteger(req.body.dataVersion) ||
        req.body.dataVersion !== (owner.dataVersion || 0)
      )
        fail(409, "Reload the case list before creating this case.");
      if ((owner.cases || []).length >= 20)
        fail(400, "The workspace limit is 20 cases.");
      const value = newCase(req.body.details);
      // Validate the AI disclosure before saving, then save facts before any AI work.
      caseSnapshot(value, req.body);
      if (typeof req.body.emailReport !== "boolean")
        fail(400, "Choose whether to email the report.");
      if (req.body.emailReport && !(await read(ownerKey(req)))?.verifiedAt)
        fail(400, "Verify your email before requesting emailed reports.");
      owner.cases = [...(owner.cases || []), value];
      owner.dataVersion = (owner.dataVersion || 0) + 1;
      await write("users/" + owner.id, owner, owner._etag);
      try {
        res.status(201).json({
          case: value,
          dataVersion: owner.dataVersion,
          report: view(await start(req, value, req.body), value),
        });
      } catch (error) {
        res.status(201).json({
          case: value,
          dataVersion: owner.dataVersion,
          report: null,
          reportError: error.status
            ? error.message
            : "Case saved. Start report generation separately.",
        });
      }
    }),
  );
  router.post(
    "/cases/:id",
    guarded(async (req, res) => {
      throttle(req, "start", 5);
      const value = incident(req);
      const job = await start(req, value, req.body);
      res.status(201).json(view(job, value));
    }),
  );
  router.get(
    "/jobs/:jobId",
    guarded(async (req, res) => {
      const { job, value } = await load(req);
      res.json(view(job, value));
    }),
  );
  router.post(
    "/cases/:id/offline",
    guarded(async (req, res) => {
      throttle(req, "offline", 5);
      const value = incident(req),
        state = await index(req, value.id);
      if (state.jobs.length >= 5)
        fail(400, "Keep each case to five report versions.");
      const snapshot = caseSnapshot(value, {
        aiApproved: true,
        evidenceIds: req.body.evidenceIds || [],
        includeFiles: false,
      });
      const sources = [
        {
          id: "S1",
          title: "National Cyber Crime Reporting Portal",
          url: "https://cybercrime.gov.in/",
          retrievedAt: "Bundled reference; not fetched for this report",
        },
      ];
      const report = {
        summary: "User-reported account: " + value.description,
        observations: snapshot.evidence.map((e) => ({
          text: "User-supplied evidence note: " + e.note,
          evidenceIds: [e.id],
        })),
        unknowns: [
          "This template has not used AI or current web research.",
          "The incident and evidence have not been independently verified.",
          ...(value.occurredOn ? [] : ["Incident date not supplied."]),
        ],
        nextSteps: [
          {
            id: "preserve",
            title: "Keep relevant evidence",
            detail:
              "Save relevant messages, screenshots and source addresses. Review sensitive details before sharing.",
            sourceIds: ["S1"],
            serviceId: "reporting",
          },
          {
            id: "report",
            title: "Review the official reporting channel",
            detail:
              "Prepare your facts and complete any report yourself through the official portal. STRIKEOUT has not submitted anything.",
            sourceIds: ["S1"],
            serviceId: "reporting",
          },
        ],
        complaintDraft:
          "DRAFT FOR USER REVIEW. NOT SUBMITTED.\n\n" +
          value.description +
          "\n\nRequested help: " +
          (value.requestedOutcome ||
            "Please assess the supplied information and advise on next steps."),
      };
      const now = new Date().toISOString();
      const job = {
        id: randomUUID(),
        caseId: value.id,
        version: state.jobs.length + 1,
        stage: "ready",
        method: "local_template",
        snapshot,
        report,
        research: { sources, mode: "bundled_references", searchEntryPoint: "" },
        createdAt: now,
        updatedAt: now,
        email: { status: "not_requested" },
        lease: null,
      };
      job.pdf = (await makePDF(job)).toString("base64");
      await write(jobKey(req, job.id), job);
      state.jobs.push(job.id);
      await write(indexKey(req, value.id), state, state._etag);
      res.status(201).json(view(job, value));
    }),
  );
  router.post(
    "/jobs/:jobId/advance",
    guarded(async (req, res) => {
      throttle(req, "advance", 20);
      const { job, value } = await load(req);
      if (job.stage === "ready") return res.json(view(job, value));
      if (stale(job, value))
        fail(409, "The case changed. Generate a new report version.");
      if (job.lease?.until > Date.now())
        return res.status(202).json(view(job, value));
      // ETag compare-and-swap prevents two tabs doing the same stage together.
      const leaseId = randomUUID();
      job.lease = { id: leaseId, until: Date.now() + 180000 };
      job.error = null;
      await saveJob(req, job);
      let update;
      try {
        if (job.stage === "research")
          update = {
            research: await ai.research(job.snapshot.details),
            stage: "writing",
          };
        else if (job.stage === "writing")
          update = {
            report: await ai.write(job.snapshot, job.research),
            stage: "pdf",
          };
        else if (job.stage === "pdf")
          update = {
            pdf: (await makePDF(job)).toString("base64"),
            stage: job.email.status === "pending" ? "email" : "ready",
          };
        else if (job.stage === "email") {
          if (!mail.configured())
            update = {
              stage: "ready",
              email: { ...job.email, status: "unconfigured" },
            };
          else {
            const address = await read(ownerKey(req));
            if (!address?.verifiedAt || address.email !== job.email.to)
              fail(409, "The report recipient is no longer verified.");
            // Never retry an uncertain send after Resend's 24-hour dedupe window.
            if (
              job.email.attemptedAt &&
              Date.now() - Date.parse(job.email.attemptedAt) > 23 * 3600000
            )
              fail(
                409,
                "Check this email in the provider dashboard before retrying; the deduplication window has expired.",
              );
            if (!job.email.attemptedAt) {
              const current = await read(jobKey(req, job.id));
              current.email.attemptedAt = new Date().toISOString();
              await saveJob(req, current);
              job.email = current.email;
            }
            const accepted = await mail.send({
              to: job.email.to,
              subject: "Your STRIKEOUT report " + job.version,
              text: "Your private AI-assisted STRIKEOUT case report is attached. Review its facts and guidance before sharing. This report has not been filed with any authority.",
              attachment: job.pdf,
              key: "report/" + req.reportOwner.id + "/" + job.id,
            });
            update = {
              stage: "ready",
              email: {
                ...job.email,
                ...accepted,
                acceptedAt: new Date().toISOString(),
              },
            };
          }
        } else fail(500, "Unknown report stage.");
      } catch (error) {
        const current = await read(jobKey(req, job.id));
        if (current?.lease?.id === leaseId) {
          current.lease = null;
          current.error = error.status
            ? error.message
            : "This report stage failed. Retry without creating a new job.";
          await saveJob(req, current);
        }
        throw error;
      }
      const current = await read(jobKey(req, job.id));
      if (!current || current.lease?.id !== leaseId)
        fail(409, "Another request resumed this report. Reload its status.");
      Object.assign(current, update, { lease: null, error: null });
      await saveJob(req, current);
      // Re-read facts: editing a case during generation must be visible as stale.
      const latestOwner = await user(req),
        latestCase = latestOwner.cases?.find((c) => c.id === current.caseId);
      res.json(view(current, latestCase || {}));
    }),
  );
  router.get(
    "/jobs/:jobId/pdf",
    guarded(async (req, res) => {
      const { job } = await load(req);
      if (!job.pdf) fail(409, "PDF generation is not finished.");
      res
        .type("application/pdf")
        .set(
          "Content-Disposition",
          'attachment; filename="strikeout-report-' + job.version + '.pdf"',
        )
        .send(Buffer.from(job.pdf, "base64"));
    }),
  );
  router.post(
    "/jobs/:jobId/email",
    guarded(async (req, res) => {
      throttle(req, "email-retry", 3);
      const { job, value } = await load(req);
      if (!job.pdf || stale(job, value))
        fail(409, "Use a current report with a finished PDF.");
      if (job.email.status === "accepted") return res.json(view(job, value));
      if (req.body.confirm !== true || job.email.status === "not_requested")
        fail(400, "This report must already have an explicit email opt-in.");
      if (job.lease?.until > Date.now())
        fail(409, "The report is already being processed.");
      if (!mail.configured())
        fail(503, "Configure the mail service before retrying delivery.");
      const address = await read(ownerKey(req));
      if (!address?.verifiedAt || address.email !== job.email.to)
        fail(409, "Verify the original report recipient first.");
      job.stage = "email";
      job.email.status = "pending";
      await saveJob(req, job);
      res.json(view(job, value));
    }),
  );
  router.post(
    "/jobs/:jobId/help",
    guarded(async (req, res) => {
      throttle(req, "help", 8);
      const { job, value } = await load(req);
      if (!job.report) fail(409, "Finish report writing first.");
      if (stale(job, value))
        fail(
          409,
          "The case changed. Generate an updated report before asking for guidance.",
        );
      if (req.body.aiApproved !== true)
        fail(400, "Approve sharing this question and report with Gemini.");
      if (!["summary", "guidance"].includes(req.body.mode))
        fail(
          400,
          "Choose summary or guidance. For updated sources generate a new report.",
        );
      const message = text(
        req.body.message || "Explain this simply.",
        "Question",
        3000,
        true,
      );
      const state = await index(req, job.caseId);
      const progress = {
        completedSteps: state.completedSteps.filter(
          (s) => s.reportId === job.id,
        ),
        submissions: value.reporting?.submissions || [],
        resolution: value.reporting?.resolution || null,
        recentMessages: state.messages
          .filter((m) => m.reportId === job.id)
          .slice(-6),
      };
      const answer =
        job.method === "local_template"
          ? {
              answer:
                req.body.mode === "summary"
                  ? job.report.summary +
                    "\n\nLocal template, without AI or fresh research."
                  : job.report.nextSteps
                      .filter(
                        (s) =>
                          !progress.completedSteps.some(
                            (p) => p.stepId === s.id,
                          ),
                      )
                      .map((s) => s.title + ": " + s.detail)
                      .join("\n\n") +
                    "\n\nTemplate guidance, without AI. Save new facts in Your story.",
              sourceIds: ["S1"],
              serviceIds: ["reporting"],
            }
          : await ai.help(job, req.body.mode, message, progress);
      const fresh = await index(req, job.caseId);
      fresh.messages = [
        ...fresh.messages,
        {
          id: randomUUID(),
          reportId: job.id,
          mode: req.body.mode,
          message,
          ...answer,
          recordedAt: new Date().toISOString(),
          source: "ai-assisted",
        },
      ].slice(-30);
      await write(indexKey(req, job.caseId), fresh, fresh._etag);
      res.json({
        ...answer,
        reportId: job.id,
        freshResearch: false,
        services: services.filter((s) => answer.serviceIds.includes(s.id)),
      });
    }),
  );
  router.post(
    "/jobs/:jobId/progress",
    guarded(async (req, res) => {
      throttle(req, "progress", 30);
      const { job, value } = await load(req);
      if (!job.report || stale(job, value))
        fail(409, "Use a current finished report.");
      const step = job.report.nextSteps.find((s) => s.id === req.body.stepId);
      if (!step || typeof req.body.done !== "boolean")
        fail(400, "Choose a report step and done or pending.");
      const state = await index(req, job.caseId);
      state.completedSteps = state.completedSteps.filter(
        (s) => !(s.reportId === job.id && s.stepId === step.id),
      );
      if (req.body.done)
        state.completedSteps.push({
          reportId: job.id,
          stepId: step.id,
          title: step.title,
          note: text(req.body.note, "Progress note", 1000),
          source: "user-reported",
          recordedAt: new Date().toISOString(),
        });
      await write(indexKey(req, job.caseId), state, state._etag);
      res.json({ completedSteps: state.completedSteps });
    }),
  );
  router.delete(
    "/cases/:id",
    guarded(async (req, res) => {
      incident(req);
      if (req.body.confirm !== true)
        fail(400, "Confirm deletion of report versions and messages.");
      await deleteCaseReportData(req.reportOwner.id, req.params.id);
      res.json({ deleted: true });
    }),
  );
  return router;
}
