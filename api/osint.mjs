import { authenticatorAuthService } from "./osint/authenticator-auth.mjs";
import express from "express";
import { runCheck, runPasswordRange } from "./osint/osint.mjs";
import { reviewDocuments } from "./osint/documents.mjs";
import { reverseImage } from "./osint/images.mjs";
import { runDorks, dorkTemplates } from "./osint/dorks.mjs";
import { domainOwnershipService } from "./osint/domain-ownership.mjs";
import { createDistributedLimiter } from "./osint/distributed-limit.mjs";
import { usesCloud } from "./store.mjs";
import { flagReport, assessLinks } from "./osint/link-risk.mjs";
export function osintRouter({
  user,
  guarded,
  limited,
  imageOptions,
  searchOptions,
  domainOwnership = domainOwnershipService(),
  exposureAuth = authenticatorAuthService({ domains: domainOwnership }),
  sharedLimit = usesCloud() ? createDistributedLimiter() : async () => {},
}) {
  const router = express.Router();
  const limitExposure = async (req, scope, max) => {
    const identity = req.osintUser.id;
    limited({ ip: identity, headers: {} }, scope, max);
    await sharedLimit(identity, scope, max);
  };
  router.use(
    guarded(async (req, res, next) => {
      req.osintUser = await user(req);
      next();
    }),
  );
  router.get(
    "/auth/status",
    guarded(async (req, res) => res.json(await exposureAuth.state(req))),
  );
  router.post(
    "/auth/verify",
    guarded(async (req, res) => {
      await limitExposure(req, "exposure-auth", 10);
      res.json(await exposureAuth.verify(req));
    }),
  );
  router.get("/capabilities", (req, res) =>
    res.json({
      version: "0.5.1",
      authentication: {
        phoneOtpRequired: false,
        authenticatorRequired: true,
        instagramOwnershipRequired: true,
        emailOwnershipRequired: true,
        domainAndImageOwnershipRequired: true,
        domainOwnershipRequired: true,
        domainVerificationAvailable: true,
        imageHostProofRequired: true,
        imageHostVerificationAvailable: true,
      },
      providers: {
        github_public: true,
        manual_email_handoff: true,
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
        "Public GitHub issues and pull requests; user-opened web search links for a verified email; supplied document text; password-hash prefixes.",
    }),
  );
  const handle = (fn) =>
    guarded(async (req, res) => {
      await exposureAuth.requireVerified(req);
      await limitExposure(req, "osint", 12);
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
  const domainRoute = (fn, limit = 8) => guarded(async (req, res) => {
    await exposureAuth.requireVerified(req);
    await limitExposure(req, "osint-domain-proof", limit);
    res.json(await fn(req));
  });
  router.get("/domains/status", domainRoute(req =>
    domainOwnership.current(req, req.query.domain), 20));
  router.post("/domains/challenge", domainRoute(req =>
    domainOwnership.challenge(req, req.body?.domain)));
  router.post("/domains/verify", domainRoute(req =>
    domainOwnership.verify(req, req.body?.domain)));
  router.post("/domains/revoke", domainRoute(req =>
    domainOwnership.revoke(req, req.body?.domain)));
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
