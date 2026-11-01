// Potential-impact review policy, not a probability score or verification of harm.
const evidenceStrength = {
  provider_record: 3,
  exact_occurrence_in_public_provider_text: 2,
  exact_occurrence_in_supplied_text: 2,
  profile_path_occurrence_in_supplied_text: 1,
  formatted_number_occurrence_in_supplied_text: 1,
};
const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
const rules = {
  credential_like_assignment: ["critical", "Possible credential or access token could enable account access; the pattern is not validated."],
  payment_card_exposure: ["high", "Possible payment-card exposure could enable financial misuse; a checksum does not verify a real card."],
  possible_identity_document: ["high", "Possible identity-document exposure could enable impersonation; ownership is not verified."],
  public_email_reference: ["medium", "Public email exposure can support targeted phishing or unwanted contact."],
  email_occurrence: ["medium", "Email occurrence warrants review for phishing or unwanted-contact exposure."],
  public_phone_reference: ["medium", "Public phone exposure can support scams or unwanted contact."],
  phone_occurrence: ["medium", "Phone occurrence warrants review for scams or unwanted-contact exposure."],
  public_instagram_reference: ["low", "Public social-profile reference alone has limited evidence of sensitive exposure."],
  public_linkedin_reference: ["low", "Public professional-profile reference alone has limited evidence of sensitive exposure."],
  linkedin_reference: ["low", "Profile reference alone has limited evidence of sensitive exposure."],
};
function severityRule(finding, service) {
  if (finding.category === "breach_membership") {
    const classes = Array.isArray(finding.dataClasses) ? finding.dataClasses : [];
    if (classes.some(x => /password|auth.*token|api.*key|secret.*answer/i.test(x)))
      return ["critical", "Breach record includes credential-related data classes; current credential validity is unknown."];
    if (classes.some(x => /credit card|payment|bank account|passport|government.*id|social security|national.*id|biometric/i.test(x)))
      return ["high", "Breach record includes financial or identity data classes; individual exposed fields require confirmation."];
    return ["medium", "Breach membership warrants review; credential, financial or identity exposure is not established by the returned data classes."];
  }
  // Generic web-search categories inherit only the service being checked.
  const category = finding.category === "public_reference"
    ? ({ email: "public_email_reference", phone: "public_phone_reference", instagram: "public_instagram_reference", linkedin: "public_linkedin_reference" }[service])
    : finding.category;
  return rules[category] || ["medium", "Unclassified finding needs manual risk review; severity is provisional."];
}

export function prioritizeFindings(findings, { service } = {}) {
  return findings
    .map((finding, index) => {
      const [severity, severityReason] = severityRule(finding, service);
      const evidence = evidenceStrength[finding.confidence] || 0;
      return {
        finding: {
          ...finding,
          severity,
          severityReason,
          priorityReason: [
            severityReason,
            evidence === 3 ? "Breach-provider record; identity still requires review."
              : evidence === 2 ? "Exact identifier occurrence in the checked text."
              : evidence === 1 ? "Identifier formatting or profile-path match."
              : "Unverified lead or pattern; confirm the source before acting.",
          ].join(" "),
        },
        severity: severityOrder[severity], evidence, index,
      };
    })
    .sort((a, b) => b.severity - a.severity || b.evidence - a.evidence || a.index - b.index)
    .map(({ finding }) => finding);
}
