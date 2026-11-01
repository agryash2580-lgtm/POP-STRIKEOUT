import { fail } from "./reporting-core.mjs";

export const insufficientEvidence = "Insufficient evidence to answer that reliably. Review the supplied evidence or open the listed official sources.";
const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
// Require a whole passage so dropping a negation cannot reverse its meaning.
export function requireExtract(text, passages, label) {
  const claim = normalize(text);
  if (!claim || !passages.some(p => normalize(p) === claim))
    fail(502, "AI returned unsupported " + label + ". No ungrounded answer was accepted; review the evidence and retry.");
  return text.trim();
}
export function sourcePassages(sources, ids) {
  return sources.filter(s => ids.includes(s.id)).flatMap(s => s.excerpts || []);
}

// Chat has no retrieval/tools. The model selects a reviewed response; it cannot
// author claims, URLs, incident facts or completed-action messages.
export const chatReplies = {
  clarify: "What happened, and which account or information is affected? I cannot inspect accounts or verify an incident from chat.",
  recovery: "For possible account compromise, open the platform's official recovery flow yourself. Do not share passwords, OTPs or recovery codes. I cannot verify compromise or recover the account for you.",
  evidence: "Open Cases & Reports, choose your case, and add the relevant evidence for review. Keep originals. An attachment or user statement alone does not prove who caused an incident.",
  reporting: "Open Cases & Reports to prepare an editable complaint draft. Review the facts before submitting it yourself. Generating a draft does not file a complaint.",
  exposure: "Open Check exposure and select the checks you consent to. Results cover only those checks; a possible match needs review, and no findings does not prove safety.",
  page: "Check this page checks rendered text on the current page for your locally stored identifiers. It does not search the internet or prove that a page is safe.",
  privacy: "Website cases and attached evidence save to your private backend account. Extension watchlists and screenshots stay browser-local until you deliberately hand them off. Reviewed report context or deliberately shared chat context can be sent to Gemini.",
  support: "I cannot book an expert or counsellor; provider booking is not configured. You can organise evidence and review reporting options in Cases & Reports.",
  unknown: insufficientEvidence,
};
export function validateChatSelection(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some(k => k !== "replyId") ||
      !Object.hasOwn(chatReplies, value.replyId))
    fail(502, "AI returned unsupported guidance. No generated claim was shown; try the case tools instead.");
  return { text: chatReplies[value.replyId] };
}
