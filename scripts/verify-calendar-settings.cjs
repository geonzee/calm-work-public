const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
(async () => {
  const app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: {
      ...process.env,
      CALM_WORK_PROFILE: path.join(root, "output/oauth-settings-" + Date.now()),
      CALM_WORK_NO_BROWSER: "1",
    },
  });
  try {
    const page = await app.firstWindow();
    const frame = page.frameLocator('iframe[title="Calm Work"]');
    await frame.locator("#global-add").waitFor({ timeout: 60000 });
    await frame.locator("body").evaluate(() => show("modules"));
    // Setup is collapsed and the service form appears only with optional modules on.
    assert.equal(await frame.locator('[data-calendar-connect="google"]').isVisible(), false);
    assert.equal(await frame.locator("#online-service-form").count(), 0);
    await frame.locator("#setting-optional-modules").check();
    // Google: no setup, just Sign in; the custom client lives under Advanced.
    await frame.getByText("Uses Super Productivity’s Google sign-in").waitFor();
    assert.equal(await frame.getByRole("button", { name: "Sign in to Google account 1", exact: true }).isEnabled(), true);
    assert.equal(await frame.getByRole("button", { name: "Sign in to Microsoft 365", exact: true }).isEnabled(), false);
    await frame.locator('[data-setup="google"] summary').click();
    await frame.locator('[data-setup="microsoft"] summary').click();
    await frame.locator('[data-calendar-connect="google"] select[name="accountId"]').waitFor();
    assert.equal(
      await frame.locator('[data-calendar-connect="microsoft"] input[name="tenant"]').inputValue(),
      "contoso.onmicrosoft.com",
    );
    assert.equal(
      await frame.locator('[data-calendar-connect="microsoft"] input[name="clientSecret"]').count(),
      0,
    );
    await frame.locator('#online-service-form input[name="origin"]').waitFor();
    assert.equal(
      await frame.locator('#online-service-form input[name="origin"]').inputValue(),
      "http://127.0.0.1:4242",
    );
    await frame.locator('[data-calendar-connect="microsoft"] input[name="clientId"]').fill("bad");
    await frame
      .locator('[data-calendar-connect="microsoft"]')
      .getByRole("button", { name: "Save setup", exact: true })
      .click();
    await frame.locator("#toast").filter({ hasText: /valid desktop client ID|credential store/ }).waitFor();
    const invalid = await page.evaluate(() =>
      window.calmCalendar.command({ action: "connect", provider: "microsoft", clientId: "bad" }),
    );
    assert.match(invalid.error, /valid desktop client ID|credential store/);
    // The engine refuses its retired custom Google OAuth.
    const retired = await page.evaluate(() =>
      window.calmCalendar.command({ action: "connect", provider: "google", clientId: "custom-client-1234" }),
    );
    assert.match(retired.error, /Super Productivity|credential store/);
    const untrusted = await frame
      .locator("body")
      .evaluate(() => typeof window.calmCalendar);
    assert.equal(untrusted, "undefined");
    const safe = await page.evaluate(() =>
      window.calmCalendar.command({ action: "status" }),
    );
    assert.equal(JSON.stringify(safe).includes("accessToken"), false);
    await page.screenshot({
      path: path.join(root, "output/oauth-settings.png"),
    });
    assert.equal(
      await frame
        .locator('[data-calendar-connect="google"] input[name="clientId"]')
        .getAttribute("autocomplete"),
      "off",
    );
    console.log(
      "PASS: Google is one Sign in (advanced custom client hidden), Microsoft setup/tenant, invalid input handling, retired Google OAuth refused and iframe isolation.",
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
