# Separate specialist assistants

Cases & Reports > Get help now contains Cybersecurity assistant and Emotional-support assistant. Each has a separate message history and its own explicitly approved Google connection. No case, report, attachment, Pop conversation or other assistant history is automatically attached. Chats stay in component memory and clear on leaving the screen or on account changes; Google still receives approved messages under its own terms.

The emotional-support assistant is our Gemini-powered support chat, not a therapist or a Therabot API integration. Open Therabot links to https://trytherabot.com/ in a new tab with no referrer or chat transfer. No public Therabot API contract was established; no undocumented endpoints or embeddings are used.

## Server configuration

Set CYBER_GEMINI_API_KEY and THERAPY_GEMINI_API_KEY separately in the server environment. Optional SPECIALIST_GEMINI_MODEL defaults to gemini-2.5-flash. Local .env.local is ignored by Git. Configure these two keys in the hosting environment before using the hosted chats; pushing source does not provision production secrets. Never use VITE_ variables for these keys. Existing Pop/report keys are unaffected.

## Behavior and limits

The backend requires a signed-in account (including demo accounts), approval, bounded messages/history and existing request limits. It uses separate role instructions, omits tools/search, requests structured output, rejects invented URLs/extra fields/truncated output, and returns generic provider errors without forwarding credentials or upstream error details. Chat context is untrusted. These controls do not prove factual accuracy or replace clinical care. Model-generated advice can still be wrong. No diagnosis, treatment, crisis-service booking or account recovery action is performed. Crisis instructions encourage local emergency help and trusted human support without inventing hotline numbers.

## Verification

73/73 automated tests and production build passed. Four added test groups cover role/key isolation, consent/input validation, provider failure/invalid output handling, and authentication/no-store. Both supplied Google keys passed live model-list and generate-content calls with fictional test prompts. tests/specialist-bots-browser.mjs passed both real Gemini UI replies, consent gating, history separation, independent clear, Therabot link target, and no browser runtime errors. Browser test defaults to localhost:3019 and requires the two local server keys; DESKTOP_TEST_URL can override it. The Therabot site itself was not logged into or tested internally. Hosted deployment was not verified.
