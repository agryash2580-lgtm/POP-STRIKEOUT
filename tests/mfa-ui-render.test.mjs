import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Render the actual TSX component, rather than matching its source text.
function loadSecurityUI() {
  const filename = path.resolve(
    "frontend/src/app/components/AccountSecurity.tsx",
  );
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled.outputText)(
    createRequire(filename),
    module,
    module.exports,
  );
  return module.exports;
}
test("enrolled-user MFA login challenge renders without setup-only state or blanking the app", () => {
  const { MFAChallenge } = loadSecurityUI();
  const html = renderToStaticMarkup(
    React.createElement(MFAChallenge, {
      onComplete: () => {},
      onCancel: () => {},
    }),
  );
  assert.match(html, /One more check/);
  assert.match(html, /Authenticator or recovery code/);
  assert.match(html, /Verify and sign in/);
  assert.match(html, /Cancel sign-in/);
  assert.ok(!html.includes("Loading account security"));
});
