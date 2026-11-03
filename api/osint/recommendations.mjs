// Deterministic guidance, never an assertion that a source was changed or a match is real.
export function recommendationsFor(finding) {
  const review = 'Privately confirm that this finding concerns your own information. A pattern or search snippet may be unrelated or outdated.';
  const category = String(finding.category || '');
  if (category === 'credential_like_assignment') return [review,
    'If this is a real credential you control, revoke or rotate it at the issuing service. Do not copy it into a report or chat.',
    'Remove it from the original document and any accessible history, then review account activity and enable MFA. Removal alone does not invalidate a credential.'];
  if (category === 'payment_card_exposure') return [review,
    'If a real payment card you own is exposed, contact its issuer through the official app or the number on the card. Ask about replacement and review transactions.',
    'Ask the publisher to remove the original document. Do not share full card numbers or security codes while seeking help.'];
  if (category === 'possible_identity_document') return [review,
    'Ask the responsible publisher to remove the document or restrict access. If an employee badge is involved, contact your employer security team privately.',
    'Avoid downloading or reposting someone else’s identity document. A document-title match does not verify its contents or ownership.'];
  if (category === 'breach_membership') return [review,
    'Review the provider’s affected data classes and the service’s official incident notice. A breach record does not reveal whether a current password is valid.',
    'For affected accounts you own, replace reused passwords, enable MFA and review active sessions.'];
  if (category === 'image_reference') return [
    'Privately review whether this is your image or merely a similar image. Similarity does not establish identity, location or capture time.',
    'If your image is shared without permission, use the publisher’s privacy or copyright process where applicable. Keep any evidence private.'];
  return [review,
    'Decide whether this information should be public. Edit a source you control, or ask its publisher to remove or minimize the information.',
    'After the source changes, request an outdated-result refresh through the relevant search engine if needed. Recheck the scoped source; search caches can lag.'];
}
