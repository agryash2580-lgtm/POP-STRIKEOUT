import { phoneAuthService } from "./osint/phone-auth.mjs";
import express from "express";
import { runCheck, runPasswordRange } from "./osint/osint.mjs";
import { reviewDocuments } from "./osint/documents.mjs";
import { reverseImage } from "./osint/images.mjs";
import { runDorks, dorkTemplates } from "./osint/dorks.mjs";
import { flagReport, assessLinks } from "./osint/link-risk.mjs";
export function osintRouter({
  user,
  guarded,
  limited,
  imageOptions,
  searchOptions,
  phoneAuth = phoneAuthService(),
}) {
  const router = express.Router();
  router.use(
    guarded(async (req, res, next) => {
      req.osintUser = await user(req);
      next();
    }),
  );
  router.get(
    "/phone/status",
    guarded(async (req, res) => res.json(await phoneAuth.state(req))),
  );
  router.post(
    "/phone/send",
    guarded(async (req, res) => res.json(await phoneAuth.send(req))),
  );
  router.post(
    "/phone/verify",
    guarded(async (req, res) => res.json(await phoneAuth.verify(req))),
  );
  router.get("/capabilities", (req, res) =>
    res.json({
      version: "0.3.0",
      authentication: {
        phoneOtpRequired: true,
        instagramOwnershipRequired: true,
      },
      providers: {
        github_public: true,
        local_documents: true,
        brave: !!process.env.BRAVE_SEARCH_API_KEY,
        hibp: !!process.env.HIBP_API_KEY,
        pwned_passwords: true,
        google_lens: true,
        serpapi: !!process.env.SERPAPI_API_KEY,
        serpapi_google: !!process.env.SERPAPI_API_KEY,
        serpapi_bing: !!process.env.SERPAPI_API_KEY,
        serpapi_duckduckgo: !!process.env.SERPAPI_API_KEY,
      },
      linkFlagging: {
        enabled: true,
        method: "local_url_rules",
        threatFeedConfigured: false,
      },
      dorkTemplates,
      imageLookup: {
        automatic: !!process.env.SERPAPI_API_KEY,
        handoff: "google_lens",
        publicImageUrlOnly: true,
      },
      privateContentScanning: false,
      instagramBotConfigured: false,
      keylessCoverage:
        "Public GitHub issues and pull requests; supplied document text; password-hash prefixes.",
    }),
  );
  const handle = (fn) =>
    guarded(async (req, res) => {
      await phoneAuth.requireVerified(req);
      limited({ ip: req.osintUser.id, headers: {} }, "osint", 12);
      try {
        res.json(flagReport(await fn(req.body)));
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
  router.post(
    "/images/reverse",
    handle((body) => reverseImage(body, imageOptions)),
  );
  router.post(
    "/dorks",
    handle((body) => runDorks(body, searchOptions)),
  );
  router.post(
    "/links/assess",
    handle((body) => assessLinks(body)),
  );
  return router;
}
