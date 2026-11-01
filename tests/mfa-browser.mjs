import { chromium } from "@playwright/test";
import * as OTPAuth from "otpauth";
import assert from "node:assert/strict";
const base = process.env.DESKTOP_TEST_URL || "http://localhost:3002";
const args = process.env.TEST_HOST_IP
  ? [
      "--host-resolver-rules=MAP " +
        new URL(base).hostname +
        " " +
        process.env.TEST_HOST_IP,
    ]
  : [];
const browser = await chromium.launch({ args });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let created = false;
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "New here? Create account", exact: true })
    .click();
  const username = "mfa_ui_" + Date.now().toString(36),
    password = "Fictional-mfa-browser-42";
  await page.getByLabel("STRIKEOUT username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A place to pick back up.", exact: true })
    .waitFor();
  created = true;
  await page
    .getByRole("button", { name: "Account security", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set up authenticator MFA", exact: true })
    .click();
  await page
    .getByAltText("Authenticator setup QR code", { exact: true })
    .waitFor();
  const secret = await page
    .locator("p")
    .filter({ hasText: "Manual setup key:" })
    .locator("code")
    .innerText();
  const otp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  await page
    .getByLabel("Six-digit authenticator code", { exact: true })
    .fill(otp.generate());
  await page.getByRole("button", { name: "Enable MFA", exact: true }).click();
  await page
    .getByText("Save these recovery codes now. They appear only once.", {
      exact: true,
    })
    .waitFor();
  const recovery = (await page.locator("pre").innerText()).trim().split("\n");
  assert.equal(recovery.length, 8);
  await page.getByRole("button", { name: "I saved them", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByLabel("STRIKEOUT username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "One more check.", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(async () => (await fetch("/api/data")).status),
    401,
  );
  await page
    .getByLabel("Authenticator or recovery code", { exact: true })
    .fill(recovery[0]);
  await page
    .getByRole("button", { name: "Verify and sign in", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "A place to pick back up.", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Account security", exact: true })
    .click();
  await page
    .getByLabel("Current authenticator or recovery code", { exact: true })
    .fill(recovery[1]);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Disable MFA", exact: true }).click();
  await page
    .getByRole("button", { name: "Set up authenticator MFA", exact: true })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real MFA UI enrolment/QR, recovery download display, gated sign-in, one-use recovery login and disabling; no browser errors.",
  );
} catch (error) {
  console.log("MFA UI errors:", await page.locator(".error").allTextContents());
  throw error;
} finally {
  if (created)
    await page.evaluate(async () =>
      fetch("/api/account", { method: "DELETE" }),
    );
  await browser.close();
}
