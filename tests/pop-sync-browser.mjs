import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import dns from "node:dns";
import { createServer } from "node:http";
const base =
  process.env.DESKTOP_TEST_URL || "https://strikeout-mu20.vercel.app";
const ip = process.env.TEST_HOST_IP;
const lookup = dns.lookup;
if (ip)
  dns.lookup = function (host, options, callback) {
    if (host !== new URL(base).hostname) return lookup.apply(this, arguments);
    if (typeof options === "function") {
      callback = options;
      options = {};
    }
    queueMicrotask(() =>
      options?.all
        ? callback(null, [{ address: ip, family: 4 }])
        : callback(null, ip, 4),
    );
  };
const temp = await mkdtemp(path.join(os.tmpdir(), "pop-sync-"));
const ext = path.join(temp, "extension");
await cp("extension", ext, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(ext, "manifest.json")));
manifest.host_permissions.push("<all_urls>");
await writeFile(path.join(ext, "manifest.json"), JSON.stringify(manifest));
const fixtureServer = createServer((req, res) => {
  res.setHeader("content-type", "text/html");
  res.end(
    "<!doctype html><title>Fictional capture fixture</title><h1>Fictional incident evidence</h1><p>Contact demo@example.org</p><script>window.notForSnapshot=true</script>",
  );
});
await new Promise((r) => fixtureServer.listen(0, "127.0.0.1", r));
const args = [
  "--disable-extensions-except=" + ext,
  "--load-extension=" + ext,
  ...(ip
    ? ["--host-resolver-rules=MAP " + new URL(base).hostname + " " + ip]
    : []),
];
const context = await chromium.launchPersistentContext(
  path.join(temp, "profile"),
  {
    channel: "chromium",
    headless: true,
    viewport: { width: 1200, height: 850 },
    args,
  },
);
let created = false;
let apiBrowser;
try {
  const network = await context.newPage();
  await network.goto(base);
  apiBrowser = Object.fromEntries(
    ["get", "post", "delete"].map((method) => [
      method,
      async (address, options = {}) => {
        const value = await network.evaluate(
          async ({ address, method, options }) => {
            const r = await fetch(address, {
              method: method.toUpperCase(),
              credentials: "include",
              headers: options.data
                ? { "Content-Type": "application/json" }
                : {},
              body: options.data ? JSON.stringify(options.data) : undefined,
            });
            const bytes = new Uint8Array(await r.arrayBuffer());
            let raw = "";
            for (const byte of bytes) raw += String.fromCharCode(byte);
            return { status: r.status, data: btoa(raw) };
          },
          { address, method, options },
        );
        const bytes = Buffer.from(value.data, "base64");
        return {
          status: () => value.status,
          text: async () => bytes.toString("utf8"),
          json: async () => JSON.parse(bytes.toString("utf8")),
          body: async () => bytes,
        };
      },
    ]),
  );
  const registration = await apiBrowser.post(base + "/api/auth/register", {
    data: {
      username: "pop_sync_" + Date.now().toString(36),
      password: "Fictional-sync-test-password-42",
    },
  });
  assert.equal(registration.status(), 200);
  created = true;
  const worker =
    context.serviceWorkers()[0] ||
    (await context.waitForEvent("serviceworker"));
  const extensionURL = worker.url().replace("/background.js", "");
  const pairing = await apiBrowser.post(base + "/api/pop/connect-code", {
    data: {},
  });
  const paired = await apiBrowser.post(base + "/api/pop/pair", {
    data: { code: (await pairing.json()).code },
  });
  const { token } = await paired.json();
  assert.ok(token);
  await worker.evaluate(
    async ({ token, base }) =>
      chrome.storage.local.set({
        popToken: token,
        server: base,
        aiConsent: true,
      }),
    { token, base },
  );
  const caseResponse = await apiBrowser.post(base + "/api/reporting/cases", {
    data: {
      dataVersion: 0,
      details: {
        title: "Fictional Pop sync case",
        category: "harassment",
        platform: "Instagram",
        description: "Fictional demonstration only.",
      },
    },
  });
  assert.equal(caseResponse.status(), 201);
  const incident = (await caseResponse.json()).case;
  const fixture = await context.newPage();
  fixture.on("dialog", (d) => d.accept("Fictional quick capture"));
  await fixture.goto(
    "http://127.0.0.1:" + fixtureServer.address().port + "/capture",
  );
  const tabId = await worker.evaluate(
    async () =>
      (await chrome.tabs.query({})).find(
        (t) => t.title === "Fictional capture fixture",
      ).id,
  );
  const panel = await context.newPage();
  await panel.goto(extensionURL + "/panel.html");
  await fixture.bringToFront();
  const capturePromise = context.waitForEvent("page");
  const result = await panel.evaluate(
    async (tabId) =>
      chrome.runtime.sendMessage({ type: "POP_CAPTURE", tabId, askName: true }),
    tabId,
  );
  assert.ok(!result.error, result.error);
  const capture = await capturePromise;
  await capture.waitForURL(/workspace.html#capture/);
  await capture.waitForFunction(
    () =>
      document
        .getElementById("app-status")
        ?.textContent.includes("website evidence library"),
    null,
    { timeout: 30000 },
  );
  const saved = (await (await apiBrowser.get(base + "/api/library")).json())
    .items[0];
  assert.equal(saved.name, "Fictional quick capture");
  assert.ok(saved.hasHTML);
  assert.ok(saved.imageHash);
  assert.ok(saved.htmlHash);
  console.log(
    "PASS: quick capture synced screenshot, inert HTML and hashes to live evidence library.",
  );
  const html = await (
    await apiBrowser.get(base + "/api/library/" + saved.id + "/html")
  ).text();
  assert.ok(html.includes("Fictional incident evidence"));
  assert.ok(!html.includes("<script>"));
  const image = await apiBrowser.get(
    base + "/api/library/" + saved.id + "/image",
  );
  assert.equal(image.status(), 200);
  assert.ok((await image.body()).length > 100);
  const website = await context.newPage();
  website.setDefaultTimeout(20000);
  await website.goto(base + "/cases");
  await website
    .getByRole("button", { name: "Pop evidence", exact: true })
    .click();
  await website
    .getByRole("heading", { name: "Pop evidence library", exact: true })
    .waitFor();
  if (await website.getByLabel("Add evidence to", { exact: false }).count())
    await website
      .getByLabel("Add evidence to", { exact: false })
      .selectOption(incident.id);
  await website
    .getByRole("button", { name: "Add to case", exact: true })
    .click();
  await website
    .getByRole("button", { name: "Report & PDF", exact: true })
    .click();
  await website.getByLabel(/Fictional quick capture/).check();
  const ownerCase = await (
    await apiBrowser.get(base + "/api/reporting/cases/" + incident.id)
  ).json();
  assert.equal(ownerCase.case.evidence[0].popCaptureId, saved.id);
  console.log(
    "PASS: named quick capture, actual screenshot + inert HTML, local save, live account sync, hashes and case attachment.",
  );
  const chat = await apiBrowser.post(base + "/api/guide/chat", {
    data: {
      message:
        "Fictional website sync check. Give one short sentence about saving evidence.",
      approved: true,
      caseId: incident.id,
    },
  });
  assert.equal(chat.status(), 200, await chat.text());
  await capture.goto(extensionURL + "/workspace.html#chat");
  await capture
    .locator("#chat-log")
    .getByText(
      "You: Fictional website sync check. Give one short sentence about saving evidence.",
      { exact: true },
    )
    .waitFor();
  await capture
    .locator("#chat-message")
    .fill("Fictional extension follow-up: what case context do you have?");
  await capture.locator("#chat-send").click();
  await capture.waitForFunction(
    () =>
      document
        .querySelector("#chat-log")
        .textContent.includes("Fictional extension follow-up") &&
      !document.getElementById("chat-send").disabled,
    null,
    { timeout: 60000 },
  );
  const shared = await (
    await apiBrowser.get(base + "/api/guide/conversation")
  ).json();
  assert.equal(shared.messages.length, 4);
  assert.equal(shared.context.caseId, incident.id);
  assert.ok(
    shared.messages.some(
      (m) =>
        m.text ===
        "Fictional extension follow-up: what case context do you have?",
    ),
  );
  console.log(
    "PASS: website and extension display one saved live AI conversation and preserve the same reviewed case context. No email delivery claimed.",
  );
} catch (error) {
  for (const p of context.pages())
    console.log(
      "Test page:",
      p.url(),
      await p
        .locator("#app-status")
        .textContent({ timeout: 500 })
        .catch(() => ""),
    );
  throw error;
} finally {
  if (created) await apiBrowser.delete(base + "/api/account");
  await context.close();
  await new Promise((r) => fixtureServer.close(r));
  if (path.dirname(temp) === os.tmpdir())
    await rm(temp, { recursive: true, force: true });
}
