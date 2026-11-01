// Review ordering only: these rules do not verify identity or actual harm.
const evidenceStrength = {
  provider_record: 3,
  exact_occurrence_in_public_provider_text: 2,
  exact_occurrence_in_supplied_text: 2,
  profile_path_occurrence_in_supplied_text: 1,
  formatted_number_occurrence_in_supplied_text: 1,
};

export function prioritizeFindings(findings) {
  return findings
    .map((finding, index) => {
      const high = finding.reviewPriority === "high";
      const evidence = evidenceStrength[finding.confidence] || 0;
      return {
        finding: {
          ...finding,
          priorityReason: [
            high ? "Flagged for high-priority review." : "General exposure reference for review.",
            evidence === 3 ? "Breach-provider record; identity still requires review."
              : evidence === 2 ? "Exact identifier occurrence in the checked text."
              : evidence === 1 ? "Identifier formatting or profile-path match."
              : "Unverified lead or pattern; confirm the source before acting.",
          ].join(" "),
        },
        high: Number(high), evidence, index,
      };
    })
    .sort((a, b) => b.high - a.high || b.evidence - a.evidence || a.index - b.index)
    .map(({ finding }) => finding);
}
