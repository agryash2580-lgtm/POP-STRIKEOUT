import { fail, draftStatus, draftDigest } from "./reporting-core.mjs";
export const cyberdostAddress = "cyberdost@mha.gov.in";
export async function emailReviewedComplaint(incident, ownerId, body, mail) {
  if (body.confirm !== true) fail(400, "Confirm sending this reviewed draft to CyberDost.");
  const draft = incident.reporting?.draft;
  if (draftStatus(incident) !== "approved") fail(409, "Approve the current draft before emailing it.");
  if (body.text !== draft.text) fail(409, "The draft changed. Review it again before sending.");
  const digest = draftDigest(draft);
  if (draft.cyberdostEmail?.digest === digest && draft.cyberdostEmail.status === "accepted") return draft.cyberdostEmail;
  if (!mail.configured()) fail(503, "Email delivery is not configured. Download your reviewed draft instead.");
  const result = await mail.send({
    to: cyberdostAddress,
    subject: "STRIKEOUT: user-reviewed cyber incident details",
    text: draft.text,
    key: "cyberdost/" + ownerId + "/" + digest,
  });
  if (result.status !== "accepted") fail(503, "The email service has not confirmed acceptance.");
  const receipt = { status: "accepted", to: cyberdostAddress, digest, acceptedAt: new Date().toISOString() };
  draft.cyberdostEmail = receipt;
  return receipt;
}
