import { read, write, remove, createIfMissing } from "./store.mjs";
import { randomUUID } from "node:crypto";
const fail = (status, message) => {
  throw Object.assign(Error(message), { status });
};
const key = (id) => "pop_conversations/" + id;
export async function conversation(id) {
  let s = await read(key(id));
  if (!s) {
    await createIfMissing(key(id), {
      messages: [],
      context: null,
      revision: 0,
    });
    s = await read(key(id));
  }
  return s;
}
export async function clearConversation(id) {
  const s = await conversation(id);
  if (s.busyUntil > Date.now())
    fail(409, "Pop is answering. Wait before clearing this conversation.");
  await write(
    key(id),
    { messages: [], context: null, revision: (s.revision || 0) + 1 },
    s._etag,
  );
  return { messages: [], context: null };
}
export async function sharedReply(ownerId, body, generate) {
  let state = await conversation(ownerId);
  if (state.busyUntil > Date.now())
    fail(409, "Pop is answering in another window. Give him a moment.");
  const owner = await read("users/" + ownerId);
  if (!owner) fail(401, "Sign in again.");
  let context = state.context;
  if (Object.hasOwn(body, "caseId")) {
    if (body.caseId === null) context = null;
    else {
      const incident = owner.cases?.find((c) => c.id === body.caseId);
      if (!incident) fail(404, "Case not found.");
      context = {
        caseId: incident.id,
        title: incident.title,
        reportId: body.reportId || null,
      };
    }
  }
  const marker = randomUUID();
  await write(
    key(ownerId),
    { ...state, context, busyUntil: Date.now() + 70000, marker },
    state._etag,
  );
  try {
    let text = String(body.message || "").trim();
    if (!text || text.length > 3000)
      fail(400, "Send a message of 1–3,000 characters.");
    let reviewed = text;
    if (context) {
      const incident = owner.cases?.find((c) => c.id === context.caseId);
      if (incident) {
        reviewed +=
          "\n\nPreviously approved shared case context (untrusted user-reported facts): " +
          JSON.stringify({
            title: incident.title,
            platform: incident.platform,
            description: incident.description,
            requestedOutcome: incident.requestedOutcome,
            evidenceNotes: (incident.evidence || [])
              .map((e) => e.note)
              .slice(0, 12),
          }).slice(0, 12000);
        if (context.reportId) {
          const job = await read(
            "analysis_jobs/" + ownerId + "/" + context.reportId,
          );
          if (job?.caseId === incident.id && job.report)
            reviewed +=
              "\nSaved report for this case; case edits may make it historical: " +
              JSON.stringify(job.report).slice(0, 14000);
        }
      } else context = null;
    }
    if (body.pageAddress) {
      const url = new URL(body.pageAddress);
      if (!["http:", "https:"].includes(url.protocol))
        fail(400, "Invalid page address.");
      reviewed +=
        "\nDeliberately included address: " + url.origin + url.pathname;
    }
    const reply = await generate({
      history: state.messages
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text })),
      text: reviewed,
    });
    const fresh = await read(key(ownerId));
    if (fresh?.marker !== marker)
      fail(409, "Conversation changed. Refresh it before continuing.");
    const messages = [
      ...state.messages,
      { id: randomUUID(), role: "user", text, at: new Date().toISOString() },
      {
        id: randomUUID(),
        role: "assistant",
        text: reply.text,
        at: new Date().toISOString(),
      },
    ].slice(-60);
    const next = {
      messages,
      context,
      revision: (state.revision || 0) + 1,
      busyUntil: 0,
    };
    await write(key(ownerId), next, fresh._etag);
    return { ...reply, ...next };
  } catch (error) {
    const fresh = await read(key(ownerId));
    if (fresh?.marker === marker)
      await write(key(ownerId), { ...fresh, busyUntil: 0 }, fresh._etag);
    throw error;
  }
}
