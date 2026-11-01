import { resolve } from "node:path";
import { handle } from "./identifiers.mjs";

const error = (message) => Object.assign(Error(message), { status: 409 });
export function validateRequest(record) {
  if (!record || record.status !== "prepared" || !record.consentAt)
    throw error("Prepare an active consent record before sending.");
  const owner = handle(record.owner),
    service = handle(record.service);
  const age = Date.now() - Date.parse(record.consentAt);
  if (owner === service || !Number.isFinite(age) || age < 0 || age > 86400000)
    throw error("Consent expired or invalid. Prepare a new request.");
  return { owner, service };
}
export async function verifySender(page, service) {
  await page.goto("https://www.instagram.com/accounts/edit/", {
    waitUntil: "domcontentloaded",
  });
  // Inspect only the logged-in navigation's Profile link, never a target-page link.
  const links = page.getByRole("link", { name: /Profile/i });
  await links
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {
      throw error(
        "Sign into the service account in the bot window, finish any verification, and try again. Use Instagram in English.",
      );
    });
  const hrefs = await links.evaluateAll((nodes) => nodes.map((n) => n.href));
  const expected = "https://www.instagram.com/" + service + "/";
  if (!hrefs.some((h) => h === expected))
    throw error(
      "The signed-in Instagram profile does not match @" +
        service +
        ". Switch accounts in the bot window.",
    );
}
export async function profileControl(page, owner, name) {
  const header = page
    .locator("header")
    .getByRole("button", { name, exact: typeof name === "string" });
  if ((await header.count()) === 1) return header;
  // Instagram mobile places profile actions outside <header>. Exclude suggestion controls.
  const identity = page.getByText(owner, { exact: true });
  if (!(await identity.count())) return null;
  const suggestions = page.getByText("Suggested for you", { exact: true });
  const boundary = (await suggestions.count())
    ? await suggestions.first().boundingBox()
    : null;
  const matches = [];
  for (const button of await page
    .getByRole("button", { name, exact: typeof name === "string" })
    .all()) {
    const box = await button.boundingBox();
    if (box && (!boundary || box.y < boundary.y)) matches.push(button);
  }
  return matches.length === 1 ? matches[0] : null;
}

export async function sendFollow(page, record, beforeClick) {
  const { owner, service } = validateRequest(record);
  await verifySender(page, service);
  await page.goto("https://www.instagram.com/" + owner + "/", {
    waitUntil: "domcontentloaded",
  });
  const current = new URL(page.url());
  if (
    current.origin !== "https://www.instagram.com" ||
    current.pathname !== "/" + owner + "/"
  )
    throw error(
      "Instagram redirected away from the requested profile. Nothing was clicked.",
    );
  if (await profileControl(page, owner, /^(Requested|Following)$/i))
    return {
      status: "already_present",
      owner,
      service,
      checkedAt: new Date().toISOString(),
    };
  if (
    record.accountPrivacy === "private" &&
    !(await page.getByText(/This (profile|account) is private/i).count())
  )
    return {
      status: "privacy_unconfirmed",
      owner,
      service,
      checkedAt: new Date().toISOString(),
    };
  const button = await profileControl(page, owner, "Follow");
  if (!button)
    throw error(
      "A unique Follow button was not found on the profile. Check the bot window; no action was taken.",
    );
  await beforeClick(); // Persist an attempt BEFORE mutation. Ambiguous attempts are never automatically retried.
  try {
    await button.click({ timeout: 10000 });
    await page
      .getByRole("button", { name: /^(Requested|Following)$/i })
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
    const pending = await profileControl(page, owner, "Requested");
    const following = await profileControl(page, owner, "Following");
    if (!pending && !following) throw Error("Unconfirmed profile action.");
    return {
      status: pending ? "requested" : "following",
      owner,
      service,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return {
      status: "needs_check",
      owner,
      service,
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function recoverPage(session) {
  if (!session?.browser?.isConnected())
    throw error(
      "The bot browser closed. Reconnect the service account from the operator page.",
    );
  if (session.page && !session.page.isClosed()) return session.page;
  const pages = session.context.pages().filter((page) => !page.isClosed());
  // Prefer Instagram's replacement login tab; never keep using a closed page.
  session.page =
    pages
      .filter((page) => {
        try {
          return (
            new URL(page.url()).hostname.endsWith(".instagram.com") ||
            new URL(page.url()).hostname === "instagram.com"
          );
        } catch {
          return false;
        }
      })
      .at(-1) ||
    pages.at(-1) ||
    (await session.context.newPage());
  session.page.setDefaultTimeout(15000);
  session.page.setDefaultNavigationTimeout(30000);
  if (session.page.url() === "about:blank")
    await session.page.goto("https://www.instagram.com/accounts/login/", {
      waitUntil: "domcontentloaded",
    });
  return session.page;
}

export const SERVICE_ACCOUNT = "popyourproblemsaway";
export function isInstagramOperator(u, env = process.env) {
  return (
    !!u &&
    !u.guest &&
    String(env.INSTAGRAM_OPERATOR_USERNAMES || "")
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean)
      .includes(String(u.username).toLowerCase())
  );
}

export function installInstagramBot(
  app,
  {
    user,
    guarded,
    fail,
    limited,
    read,
    write,
    remove,
    hash,
    env = process.env,
  },
) {
  let session = null,
    locked = false,
    uiQueue = Promise.resolve();
  function local(req) {
    if (
      env.VERCEL ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      )
    )
      fail(403, "The Instagram bot is available only on this computer.");
    const origin = req.get("origin");
    if (
      !origin ||
      !String(
        env.ALLOWED_ORIGINS || "http://localhost:3002,http://localhost:3010",
      )
        .split(",")
        .includes(origin)
    )
      fail(403, "Open the local Strikeout page to use the bot.");
  }
  async function queueIndex() {
    return (await read("instagram-queue/index")) || { entries: [] };
  }
  function publicRecord(r) {
    return {
      id: r.id,
      owner: r.owner,
      service: SERVICE_ACCOUNT,
      status: r.status,
      createdAt: r.createdAt,
      checkedAt: r.checkedAt || null,
    };
  }
  async function processRequest(record) {
    if (record.status !== "queued") return record;
    if (record.accountPrivacy !== "private") {
      record = {
        ...record,
        lastError: "A new private-account declaration is required.",
      };
      await write("instagram-requests/" + record.id, record);
      return record;
    }
    if (!session?.browser.isConnected()) return record;
    try {
      validateRequest({ ...record, status: "prepared" });
      await recoverPage(session);
      const receipt = await sendFollow(
        session.page,
        { ...record, status: "prepared" },
        async () => {
          const fresh = await read("instagram-requests/" + record.id);
          if (
            fresh?.status !== "queued" ||
            fresh.consentAt !== record.consentAt
          )
            fail(409, "Permission changed. Nothing sent.");
          validateRequest({ ...fresh, status: "prepared" });
          // Write before clicking; uncertain attempts are never automatically repeated.
          record = {
            ...record,
            status: "needs_check",
            checkedAt: new Date().toISOString(),
          };
          await write("instagram-requests/" + record.id, record);
        },
      );
      record = { ...record, ...receipt, lastError: null };
    } catch (e) {
      record = {
        ...record,
        lastError: e.status
          ? e.message
          : "Instagram browser unavailable. Reconnect the service account.",
      };
    }
    await write("instagram-requests/" + record.id, record);
    return record;
  }
  app.get(
    "/api/instagram/follow",
    guarded(async (req, res) => {
      const u = await user(req),
        index = await queueIndex();
      const records = await Promise.all(
        index.entries
          .filter((x) => x.userId === u.id)
          .map((x) => read("instagram-requests/" + x.id)),
      );
      res.json({
        service: SERVICE_ACCOUNT,
        requests: records.filter(Boolean).map(publicRecord).reverse(),
      });
    }),
  );
  app.post(
    "/api/instagram/follow",
    guarded(async (req, res) => {
      local(req);
      limited(req, "ig-request", 6);
      const u = await user(req);
      if (u.guest) fail(403, "Sign into Strikeout to request a follow.");
      if (req.body.accountPrivacy !== "private")
        fail(
          400,
          "Pop follow requests are only available for your private Instagram account.",
        );
      if (req.body.consent !== true)
        fail(
          400,
          "Confirm this is your account and you allow Pop to follow it.",
        );
      let owner;
      try {
        owner = handle(req.body.username);
      } catch {
        fail(400, "Enter an Instagram username, without a URL.");
      }
      if (owner === SERVICE_ACCOUNT)
        fail(400, "Enter your own Instagram username.");
      if (locked)
        fail(409, "Pop is helping someone else. Please try again in a moment.");
      locked = true;
      try {
        await uiQueue;
        const index = await queueIndex(),
          id = hash(u.id + ":" + owner);
        let record = await read("instagram-requests/" + id);
        if (!record) {
          if (
            index.entries.filter((x) => x.userId === u.id).length >= 20 ||
            index.entries.length >= 1000
          )
            fail(
              429,
              "The request limit has been reached. Contact Strikeout for help.",
            );
          const at = new Date().toISOString();
          record = {
            id,
            userId: u.id,
            owner,
            service: SERVICE_ACCOUNT,
            status: "queued",
            accountPrivacy: "private",
            consentAt: at,
            createdAt: at,
            consent: true,
          };
          await write("instagram-requests/" + id, record);
          index.entries.push({ id, userId: u.id });
          await write("instagram-queue/index", index);
        }
        if (record.status === "queued" && record.accountPrivacy !== "private") {
          record = {
            ...record,
            accountPrivacy: "private",
            consentAt: new Date().toISOString(),
          };
          await write("instagram-requests/" + id, record);
        }
        // Repeated submissions return the same request and never repeat uncertain clicks.
        record = await processRequest(record);
        res.json({ request: publicRecord(record) });
      } finally {
        locked = false;
      }
    }),
  );
  app.post(
    "/api/instagram/follow/:id/withdraw",
    guarded(async (req, res) => {
      local(req);
      const u = await user(req);
      if (locked) fail(409, "Please wait for the current request to finish.");
      const id = req.params.id;
      if (!/^[a-f0-9]{64}$/.test(id)) fail(404, "Request not found.");
      locked = true;
      try {
        const record = await read("instagram-requests/" + id);
        if (!record || record.userId !== u.id) fail(404, "Request not found.");
        record.status = "withdrawn";
        record.withdrawnAt = new Date().toISOString();
        await write("instagram-requests/" + id, record);
        res.json({ request: publicRecord(record) });
      } finally {
        locked = false;
      }
    }),
  );
  app.get(
    "/api/instagram/operator",
    guarded(async (req, res) => {
      const u = await user(req);
      if (!isInstagramOperator(u, env))
        fail(403, "This page is for Strikeout operators only.");
      const index = await queueIndex(),
        records = await Promise.all(
          index.entries.map((x) => read("instagram-requests/" + x.id)),
        );
      res.json({
        service: SERVICE_ACCOUNT,
        connected: !!session?.browser.isConnected(),
        requests: records.filter(Boolean).reverse(),
      });
    }),
  );
  app.post(
    "/api/instagram/bot/:action",
    guarded(async (req, res) => {
      local(req);
      const action = req.params.action;
      limited(
        req,
        ["view", "input"].includes(action) ? "ig-" + action : "ig-bot",
        ["view", "input"].includes(action) ? 240 : 10,
      );
      const u = await user(req);
      if (!isInstagramOperator(u, env))
        fail(403, "This page is for Strikeout operators only.");
      if (locked) fail(409, "The bot is busy. Wait for the current action.");
      if (session && session.owner !== u.id)
        fail(
          409,
          "Another Strikeout account is using this computer’s bot. Close its bot session first.",
        );
      if (session && !session.browser.isConnected()) session = null;
      if (["view", "input"].includes(action)) {
        const target = session;
        const operation = uiQueue.then(async () => {
          if (locked || session !== target)
            fail(409, "The bot is busy. Please wait.");
          if (session) await recoverPage(session);
          if (action === "view") {
            if (!session) fail(409, "Open Instagram sign-in first.");
            const png = await session.page.screenshot({
              type: "png",
              timeout: 10000,
            });
            return res.type("png").send(png);
          }
          if (action === "input") {
            if (!session) fail(409, "Open Instagram sign-in first.");
            const { kind, x, y, text, key, direction } = req.body;
            const page = session.page;
            if (kind === "click") {
              const size = page.viewportSize();
              if (
                !Number.isFinite(x) ||
                !Number.isFinite(y) ||
                x < 0 ||
                y < 0 ||
                x >= size.width ||
                y >= size.height
              )
                fail(400, "Invalid click.");
              await page.mouse.click(x, y);
            } else if (kind === "text") {
              if (typeof text !== "string" || text.length > 2000)
                fail(400, "Invalid text input.");
              await page.keyboard.insertText(text);
            } else if (kind === "key") {
              if (
                ![
                  "Tab",
                  "Shift+Tab",
                  "Enter",
                  "Escape",
                  "Backspace",
                  "Delete",
                  "ArrowLeft",
                  "ArrowRight",
                  "ArrowUp",
                  "ArrowDown",
                  "Home",
                  "End",
                ].includes(key)
              )
                fail(400, "Unsupported key.");
              await page.keyboard.press(key);
            } else if (kind === "scroll") {
              if (!["up", "down"].includes(direction))
                fail(400, "Invalid scroll direction.");
              await page.mouse.wheel(0, direction === "down" ? 400 : -400);
            } else fail(400, "Unknown input action.");
            return res.json({ ok: true });
          }
        });
        uiQueue = operation.catch(() => {});
        await operation;
        return;
      }
      locked = true;
      try {
        await uiQueue;

        if (action === "process") {
          const id = String(req.body.requestId || "");
          if (!/^[a-f0-9]{64}$/.test(id)) fail(400, "Invalid request.");
          const record = await read("instagram-requests/" + id);
          if (!record) fail(404, "Request not found.");
          return res.json({ request: await processRequest(record) });
        }
        if (action === "close") {
          if (session) await session.browser.close();
          session = null;
          return res.json({ status: "closed" });
        }
        if (action === "connect" || action === "signup") {
          if (!session) {
            // PLAYWRIGHT_BROWSERS_PATH can be set by the operator; otherwise use Playwright's standard installation.
            const { chromium } = await import("@playwright/test");
            let browser;
            try {
              browser = await chromium.launch({
                headless: env.INSTAGRAM_HEADLESS !== "false",
              });
            } catch {
              fail(
                503,
                "Bot browser could not start. Install its browser with PLAYWRIGHT_BROWSERS_PATH=.data/browsers npx playwright install chromium.",
              );
            }
            const context = await browser.newContext({
                locale: "en-US",
                viewport: { width: 480, height: 650 },
              }),
              page = await context.newPage();
            page.setDefaultTimeout(15000);
            page.setDefaultNavigationTimeout(30000);
            session = { owner: u.id, browser, context, page };
            browser.on("disconnected", () => {
              session = null;
            });
          }
          await recoverPage(session);
          await session.page.bringToFront();
          await session.page.goto(
            action === "signup"
              ? "https://www.instagram.com/accounts/emailsignup/"
              : "https://www.instagram.com/accounts/login/",
            { waitUntil: "domcontentloaded" },
          );
          return res.json({ status: "login_required" });
        }
        fail(404, "Unknown bot action.");
      } catch (e) {
        if (e.status) throw e;
        fail(
          503,
          "Instagram could not complete this action. Check the bot window. No automatic retry will run.",
        );
      } finally {
        locked = false;
      }
    }),
  );
  return {
    async removeUser(userId) {
      if (locked)
        fail(
          409,
          "Wait for the current Instagram action before deleting your account.",
        );
      locked = true;
      try {
        await uiQueue;
        const index = await queueIndex();
        const owned = index.entries.filter((x) => x.userId === userId);
        for (const entry of owned)
          await remove("instagram-requests/" + entry.id);
        if (owned.length) {
          index.entries = index.entries.filter((x) => x.userId !== userId);
          await write("instagram-queue/index", index);
        }
        if (session?.owner === userId) {
          await session.browser.close();
          session = null;
        }
      } finally {
        locked = false;
      }
    },
  };
}
