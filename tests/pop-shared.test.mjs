import test from "node:test";
import assert from "node:assert/strict";
import app from "../api/index.mjs";
import { hash } from "../api/store.mjs";
test("paired extension and website share chat, context, evidence and report attachments while isolating another account", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const nativeFetch = globalThis.fetch,
    oldKey = process.env.GEMINI_API_KEY;
  let cookie = "",
    token = "";
  async function call(path, method = "GET", body, extension = false) {
    const r = await nativeFetch(base + path, {
      method,
      headers: {
        ...(extension
          ? { Authorization: "Bearer " + token }
          : cookie
            ? { cookie }
            : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.headers.get("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json() };
  }
  try {
    await call("/api/auth/register", "POST", {
      username: "shared_" + Date.now().toString(36),
      password: "Fictional-shared-password-42",
    });
    const pairing = await call("/api/pop/connect-code", "POST", {});
    token = (
      await call("/api/pop/pair", "POST", { code: pairing.body.code }, true)
    ).body.token;
    process.env.GEMINI_API_KEY = "fictional-provider-key";
    let sent = [];
    globalThis.fetch = async (url, options) => {
      if (String(url).startsWith("https://generativelanguage.googleapis.com")) {
        sent.push(JSON.parse(options.body));
        return Response.json({
          candidates: [
            { content: { parts: [{ text: "Shared reply " + sent.length }] } },
          ],
        });
      }
      return nativeFetch(url, options);
    };
    assert.equal(
      (
        await call("/api/guide/chat", "POST", {
          message: "Website hello",
          approved: true,
        })
      ).status,
      200,
    );
    const extHistory = await call(
      "/api/pop/conversation",
      "GET",
      undefined,
      true,
    );
    assert.equal(extHistory.body.messages.length, 2);
    assert.equal(extHistory.body.messages[0].text, "Website hello");
    assert.equal(
      (
        await call(
          "/api/pop/chat",
          "POST",
          { message: "Extension follow-up" },
          true,
        )
      ).status,
      200,
    );
    const websiteHistory = await call("/api/guide/conversation");
    assert.equal(websiteHistory.body.messages.length, 4);
    assert.equal(websiteHistory.body.messages[2].text, "Extension follow-up");
    assert.equal(sent[1].contents[0].parts[0].text, "Website hello");
    const created = await call("/api/reporting/cases", "POST", {
      dataVersion: 0,
      details: {
        title: "Fictional linked evidence",
        category: "harassment",
        platform: "Instagram",
        description: "Fictional case only.",
      },
    });
    assert.equal(created.status, 201);
    await call("/api/guide/chat", "POST", {
      message: "Use my reviewed case",
      approved: true,
      caseId: created.body.case.id,
    });
    await call(
      "/api/pop/chat",
      "POST",
      { message: "Keep the same case context" },
      true,
    );
    assert.equal(
      (await call("/api/guide/conversation")).body.context.caseId,
      created.body.case.id,
    );
    assert.ok(
      sent
        .at(-1)
        .contents.at(-1)
        .parts[0].text.includes("Fictional case only."),
    );
    const capture = {
      id: crypto.randomUUID(),
      name: "Fictional capture",
      address: "https://example.org/profile",
      capturedAt: new Date().toISOString(),
      note: "Fictional screenshot note",
      selectedText: "Demo text",
      html: "<html><body>Fictional captured page</body></html>",
      imageData:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6XluW0AAAAASUVORK5CYII=",
    };
    const saved = await call("/api/pop/evidence", "POST", capture, true);
    assert.equal(saved.status, 201);
    assert.equal((await call("/api/library")).body.items[0].id, capture.id);
    assert.ok(saved.body.item.imageHash);
    assert.ok(saved.body.item.htmlHash);
    assert.equal(
      (await call("/api/pop/evidence", "POST", capture, true)).status,
      200,
    );
    assert.equal(
      (
        await call(
          "/api/pop/evidence",
          "POST",
          { ...capture, html: "Different evidence" },
          true,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call("/api/library/" + capture.id + "/attach", "POST", {
          caseId: created.body.case.id,
        })
      ).status,
      200,
    );
    const reloaded = await call("/api/reporting/cases/" + created.body.case.id);
    assert.equal(reloaded.body.case.evidence[0].popCaptureId, capture.id);
    const second = await call(
      "/api/library/" + capture.id + "/attach",
      "POST",
      { caseId: created.body.case.id },
    );
    assert.equal(second.body.alreadyAttached, true);
    assert.equal(
      (await call("/api/library/" + capture.id + "/email", "POST", {})).status,
      409,
    );
    await call("/api/guide/conversation", "DELETE");
    assert.equal(
      (await call("/api/pop/conversation", "GET", undefined, true)).body
        .messages.length,
      0,
    );
    await call("/api/account", "DELETE");
    cookie = "";
    await call("/api/auth/register", "POST", {
      username: "other_" + Date.now().toString(36),
      password: "Fictional-other-password-42",
    });
    assert.equal((await call("/api/library")).body.items.length, 0);
    assert.equal(
      (
        await call("/api/library/" + capture.id + "/attach", "POST", {
          caseId: created.body.case.id,
        })
      ).status,
      404,
    );
  } finally {
    globalThis.fetch = nativeFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = oldKey;
    if (cookie) await call("/api/account", "DELETE");
    await new Promise((r) => server.close(r));
  }
});
