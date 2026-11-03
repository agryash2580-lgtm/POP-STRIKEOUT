# Contributing to StrikeOut

Start with [DEVFEST_READINESS.md](DEVFEST_READINESS.md),
[CODE-GUIDE.md](CODE-GUIDE.md) and [the architecture map](docs/DEVFEST-ARCHITECTURE.md).
Preserve the existing desktop brand and working recovery/Pop features.

## Local setup

Install Node.js 22+ and Git. Use a branch based on current main. From the root:

```sh
npm ci
npm run check
npm run demo
```

The demo opens at `http://localhost:3031/devfest.html`; no credentials needed.
For the full app, copy `.env.example` to `.env.local` only if the private file does
not already exist. Set an available `PORT` and run `npm run dev`. Default: 3002.
Do not start `OSINT BACKEND/` to use the integrated website.

Full live exposure needs a permanent account, a stable privately generated
`MFA_ENCRYPTION_KEY`, enrollment and a fresh step-up code. Provider and production
storage credentials are optional dependencies for their respective capabilities,
not interchangeable API keys. Configure them privately. Never use `VITE_*` secrets.

## Changes and checks

Keep each change small and preserve existing conventions. Use synthetic fixtures
and controlled assets. Tests may start ephemeral local servers and need loopback
access; an environment denying `listen` can fail API suites before they test a feature.

- `npm run check:syntax`: JS syntax across active server/shared/extension/scripts;
  this is not semantic linting.
- `npm run typecheck`: TypeScript compiler across TSX/frontend and Vite configuration;
  legacy JS is imported but is not fully type-checked, and strict mode is not enabled.
- `npm test`: root unit/API/regression tests; no provider keys should be required.
- `npm run build`: production bundle; not a substitute for the compiler or browser QA.
- `npm run test:demo`: focused deterministic fixtures and isolated-server checks.
- `npm run package:demo`: allowlisted portable demo folder under ignored `output/`.
- `npm run qr:demo`: QR asset; verify the real destination before printing.
- `npm run check:deployment`: public health, durable storage, demo page and assets.
  Set `DEPLOY_URL` for a preview; a protected preview fails visitor-access checks.
- `npm audit`: current registry advisory check; needs network and is not a penetration test.

Existing `tests/*browser*.mjs` and desktop scripts cover various historical flows.
Use current selectors and real gates; never satisfy a check by bypassing MFA in a
production route. Record which tests actually ran. Follow the manual acceptance
matrix in the readiness register, including reset, failure, phone size and keyboard.

## Reviews and releases

Describe the observed problem, resulting behavior, files, actual checks and remaining
limits. Do not commit `.env*` values, `.data`, personal screenshots, browser profiles,
private exports or provider response bodies. Use a reviewed PR for deployment and
verify the actual production revision afterward. Keep the portable demo available.

Never add private-account bypass, credential hunting, surveillance discovery,
mass personal-data harvesting or claims of whole-web coverage. Additional providers
need documented authorization, disclosure, validation, quotas and failure handling.
Recognition and partner-logo claims need evidence and permission.
