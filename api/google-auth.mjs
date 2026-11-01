import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

// Optional: configuration is private server-side data, never a VITE_* variable.
export function installGoogleAuth(
  app,
  {
    guarded,
    limited,
    fail,
    read,
    write,
    remove,
    hash,
    seed,
    session,
    env = process.env,
    createOAuthClient = (id, secret, redirect) => new OAuth2Client(id, secret, redirect),
  },
) {
  const configured = () =>
    !!(
      env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET &&
      env.GOOGLE_REDIRECT_URI
    );
  const cookieName = "strikeout_google_state";
  const cookieOptions = {
    httpOnly: true,
    secure: !!env.VERCEL,
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: 10 * 60 * 1000,
  };
  app.get("/api/auth/providers", (req, res) =>
    res.json({ google: configured() }),
  );
  app.get(
    "/api/auth/google/start",
    guarded(async (req, res) => {
      limited(req, "google-login", 10);
      if (!configured())
        fail(
          503,
          "Google sign-in needs the project’s Google OAuth credentials. Username/password sign-in remains available.",
        );
      const redirect = new URL(env.GOOGLE_REDIRECT_URI);
      if (
        redirect.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(redirect.hostname)
      )
        fail(503, "Google redirect URL must use HTTPS except on localhost.");
      const state = randomBytes(32).toString("hex"),
        nonce = randomBytes(32).toString("hex"),
        verifier = randomBytes(48).toString("base64url");
      const { createHash } = await import("node:crypto");
      await write("oauth_states/" + hash(state), {
        nonce,
        verifier,
        expires: Date.now() + 10 * 60 * 1000,
      });
      res.cookie(cookieName, state, cookieOptions);
      const client = createOAuthClient(
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.GOOGLE_REDIRECT_URI,
      );
      res.redirect(
        client.generateAuthUrl({
          scope: ["openid", "email", "profile"],
          state,
          nonce,
          code_challenge: createHash("sha256")
            .update(verifier)
            .digest("base64url"),
          code_challenge_method: "S256",
          prompt: "select_account",
        }),
      );
    }),
  );
  app.get(
    "/api/auth/google/callback",
    guarded(async (req, res) => {
      limited(req, "google-callback", 15);
      const state = String(req.query.state || "");
      const browserState = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith(cookieName + "="))
        ?.slice(cookieName.length + 1);
      res.clearCookie(cookieName, {
        path: cookieOptions.path,
        secure: cookieOptions.secure,
        sameSite: "lax",
      });
      if (
        !configured() ||
        !/^[a-f0-9]{64}$/.test(state) ||
        state !== browserState
      )
        return res.redirect("/?auth-error=google-state");
      const pending = await read("oauth_states/" + hash(state));
      await remove("oauth_states/" + hash(state));
      if (
        !pending ||
        pending.expires < Date.now() ||
        req.query.error ||
        typeof req.query.code !== "string"
      )
        return res.redirect("/?auth-error=google-cancelled");
      try {
        const client = createOAuthClient(
          env.GOOGLE_CLIENT_ID,
          env.GOOGLE_CLIENT_SECRET,
          env.GOOGLE_REDIRECT_URI,
        );
        const { tokens } = await client.getToken({
          code: req.query.code,
          codeVerifier: pending.verifier,
        });
        const ticket = await client.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const identity = ticket.getPayload();
        if (
          !identity?.sub ||
          identity.nonce !== pending.nonce ||
          identity.email_verified !== true ||
          typeof identity.email !== "string" ||
          !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(identity.email)
        )
          throw Error("Invalid identity");
        // Stable Google subject, not email/name, identifies an account. No automatic account linking.
        const id = hash("google:" + identity.sub);
        let owner = await read("users/" + id);
        if (!owner) {
          owner = {
            id,
            username: "google_" + id.slice(0, 12),
            displayName: String(identity.name || "Google user").slice(0, 100),
            authProvider: "google",
            workspaceId: randomBytes(16).toString("hex"),
            cases: [],
            identifiers: [],
          };
          await write(
            "workspaces/" + owner.workspaceId,
            seed(owner.workspaceId),
          );
          await write("users/" + id, owner);
        }
        // Google has verified this address. Keep an existing, separately chosen
        // delivery address; otherwise use it for this account's reports/evidence.
        const deliveryKey = "analysis_email/" + id;
        if (!(await read(deliveryKey))) {
          await write(deliveryKey, {
            email: String(identity.email).toLowerCase(),
            verifiedAt: new Date().toISOString(),
            verifiedBy: "google",
          });
        }
        await session(res, id);
        res.redirect("/");
      } catch {
        return res.redirect("/?auth-error=google-unavailable");
      }
    }),
  );
}
