# AI grounding controls

Live report research accepts the listed platform/government hosts, including Meta's
recovery hub, and the original publications on ESET and McAfee's own domains.
Security-provider guidance is labelled separately from official platform/government
sources in the interface and PDF. This does not imply a partnership or booking
integration. Arbitrary blogs, forums, lookalike hosts and recovery-agent sites remain
excluded. The configured production research model is independent of the writer;
quota fallback records the failure reason and never claims newly retrieved research.
For Instagram, unavailable search or rejected search citations can trigger a bounded
GET of the fixed ESET recovery guide. Short, relevant paragraphs are extracted from
the current HTML, timestamped, labelled security-provider guidance and capped at 140
words. This mode explicitly says it is direct retrieval, not Google Search. If the
page cannot be read, the existing honest fallback/error remains. No private case
description or identifier is sent to the publisher.

Reports and saved-report help now use extractive guidance. Model text is rejected with a retryable error when it does not equal one whole cited source excerpt (apart from whitespace). A valid citation ID alone is insufficient. Observations must equal whole selected evidence notes with the correct evidence IDs. Attachments can still be shared by explicit consent, but observations cannot introduce unsupported interpretations of their contents.

New report generation asks Gemini for a source ID and zero-based excerpt index,
not a rewritten detail paragraph. The server validates those selectors and inserts
the stored text. Evidence observations similarly select one reviewed evidence ID;
the server inserts its note. Older text-bearing responses still pass the exact-text
checks above. Model paraphrases are never rendered merely because a citation exists.

The server builds the summary and complaint from the supplied description, incident date and requested help, labels them user-reported/unsubmitted, assigns service titles from the product catalogue, and supplies fixed limitations. Generated narrative, titles and unknowns are not rendered. This sacrifices free-form synthesis to limit unsupported additions. Conflicting sources are not automatically reconciled; original sources still require user review.

Saved-report guidance is restricted to unfinished saved steps with matching source IDs; summaries can quote the saved summary or cited source excerpts. Unsupported requests can return an explicit insufficient-evidence response. No new research is implied.

Pop has no retrieval, page-reading or action tools. Its default contextual chat is generative and uses the same saved history and explicitly approved case context on website and extension. Prompt rules distinguish user-reported facts from general advice and prohibit invented actions; they do not guarantee factual accuracy. An optional server flag, POP_REVIEWED_REPLIES_ONLY=true, instead makes Gemini select a response ID from the reviewed catalogue. Only that optional mode rejects free text, invented IDs and extra fields; it limits flexibility and can still select an irrelevant response. The user requested contextual chat for the presentation, so the live flag is false.

Search-grounding excerpts are text supplied through Gemini grounding metadata, not independently fetched verbatim source documents. Bundled references retain their existing not-live-researched label. Exact matching prevents additional unsupported output, but does not prove source truth, resolve contradictions, verify user statements, or eliminate all hallucinations. No second model is treated as a truth oracle.

Verification: tests/ai-grounding.test.mjs covers citation laundering, missing evidence, wrong-source quotes, invented outcomes, completed steps and abstention. The existing report adapter and authenticated Pop tests cover provider integration, optional reviewed-only rejection of extra claims/invalid JSON, and truncated responses with synthetic provider responses. Live Gemini quality and live source accuracy require separate evaluation.
