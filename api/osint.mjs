import express from "express";
import { runCheck, runPasswordRange } from "./osint/osint.mjs";
import { reviewDocuments } from "./osint/documents.mjs";
export function osintRouter({ user, guarded, limited }) {
  const router = express.Router();
  router.use(
    guarded(async (req, res, next) => {
      req.osintUser = await user(req);
      next();
    }),
  );
  router.get("/capabilities", (req, res) =>
    res.json({
      version: "0.2.0",
      providers: {
        github_public: true,
        local_documents: true,
        brave: !!process.env.BRAVE_SEARCH_API_KEY,
        hibp: !!process.env.HIBP_API_KEY,
        pwned_passwords: true,
      },
      privateContentScanning: false,
      instagramBotConfigured: false,
      keylessCoverage:
        "Public GitHub issues and pull requests; supplied document text; password-hash prefixes.",
    }),
  );
  const handle = (fn) =>
    guarded(async (req, res) => {
      limited({ ip: req.osintUser.id, headers: {} }, "osint", 12);
      try {
        res.json(await fn(req.body));
      } catch (e) {
        if (e.status) throw e;
        throw Object.assign(
          Error(
            e.code
              ? e.message
              : "Lookup unavailable. No result has been invented.",
          ),
          { status: e.code === "not_configured" ? 503 : 502 },
        );
      }
    });
  router.post(
    "/check",
    handle((body) => runCheck(body)),
  );
  router.post(
    "/review-documents",
    handle((body) => reviewDocuments(body)),
  );
  router.post(
    "/passwords/range",
    handle((body) => runPasswordRange(body)),
  );
  return router;
}
