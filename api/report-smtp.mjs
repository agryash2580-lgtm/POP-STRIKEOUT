import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { read, write, hash, createIfMissing } from "./store.mjs";
import { fail } from "./reporting-core.mjs";
// A stable receipt prevents our own repeated SMTP submissions. SMTP itself has
// no provider idempotency guarantee, so unknown delivery needs manual review.
export async function sendGmail({ env, to, subject, text, attachments, key }) {
  if (!/^[a-z]{16}$/i.test(env.SMTP_APP_PASSWORD.replace(/\s/g, "")))
    fail(
      503,
      "Gmail requires its generated 16-letter app password, not the account login password.",
    );
  const recordKey =
    "mail_receipts/" + hash("gmail:" + env.SMTP_USER + ":" + key);
  let receipt = await read(recordKey);
  if (receipt?.status === "accepted") return receipt;
  const marker = randomUUID();
  const pending = {
    status: "pending",
    marker,
    at: new Date().toISOString(),
  };
  if (receipt?.status === "failed") {
    // Only definite non-delivery may be retried. The ETag lets one retry win.
    await write(recordKey, pending, receipt._etag);
  } else {
    await createIfMissing(recordKey, pending);
  }
  receipt = await read(recordKey);
  if (receipt.marker !== marker)
    fail(
      409,
      "This email was already attempted. Check the sending mailbox before retrying; delivery may be pending.",
    );
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_APP_PASSWORD.replace(/\s/g, ""),
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const result = await transport.sendMail({
      from: { name: "STRIKEOUT", address: env.SMTP_USER },
      to,
      subject,
      text,
      messageId: "<" + hash(key) + "@strikeout.local>",
      attachments: (attachments || []).map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content, "base64"),
      })),
    });
    if (!result.accepted?.length)
      throw Object.assign(Error("No recipient accepted"), { code: "NO_RECIPIENT" });
    const accepted = { status: "accepted", providerId: result.messageId };
    await write(recordKey, accepted, receipt._etag);
    return accepted;
  } catch (error) {
    const definiteFailure = ["EAUTH", "EENVELOPE", "ECONNECTION", "EDNS", "NO_RECIPIENT"].includes(error.code)
      || (Number(error.responseCode) >= 500 && Number(error.responseCode) < 600);
    if (definiteFailure) {
      await write(recordKey, { status: "failed", at: new Date().toISOString() }, receipt._etag);
      fail(503, "Email was not accepted. Check the sender configuration, then retry. Your evidence and downloads remain saved.");
    }
    fail(
      503,
      "Gmail did not confirm acceptance. Check the sending mailbox and app-password configuration before another attempt. Your saved evidence and downloads remain available.",
    );
  } finally {
    transport.close();
  }
}

