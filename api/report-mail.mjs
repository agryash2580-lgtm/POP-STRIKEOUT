import { sendGmail } from "./report-smtp.mjs";
import { fail } from "./reporting-core.mjs";

export function createMailer({ fetcher = fetch, env = process.env } = {}) {
  return {
    configured: () =>
      !!(
        (env.SMTP_USER && env.SMTP_APP_PASSWORD) ||
        (env.RESEND_API_KEY && env.REPORT_EMAIL_FROM)
      ),
    async send({ to, subject, text, attachment, attachments, key }) {
      if (env.SMTP_USER && env.SMTP_APP_PASSWORD)
        return sendGmail({
          env,
          to,
          subject,
          text,
          key,
          attachments:
            attachments ||
            (attachment
              ? [{ filename: "strikeout-report.pdf", content: attachment }]
              : []),
        });
      if (!env.RESEND_API_KEY || !env.REPORT_EMAIL_FROM)
        fail(
          503,
          "Email is not configured. Set SMTP_USER and a Gmail SMTP_APP_PASSWORD, or configure Resend with a verified sender. Downloads and website sync still work.",
        );
      let response;
      try {
        response = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            from: env.REPORT_EMAIL_FROM,
            to: [to],
            subject,
            text,
            ...(attachments
              ? { attachments }
              : attachment
                ? {
                    attachments: [
                      { filename: "strikeout-report.pdf", content: attachment },
                    ],
                  }
                : {}),
          }),
          signal: AbortSignal.timeout(12000),
        });
      } catch {
        fail(
          503,
          "Email acceptance is unknown. Retry within 24 hours using this same report.",
        );
      }
      if (!response.ok)
        fail(
          503,
          "The email service did not confirm acceptance. Check sender configuration or retry.",
        );
      const value = await response.json();
      if (!value.id) fail(503, "The email service returned no acceptance ID.");
      return { status: "accepted", providerId: value.id };
    },
  };
}
