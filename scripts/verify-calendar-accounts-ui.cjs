const {
    _electron: electron,
  } = require("../output/upstream/node_modules/@playwright/test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
(async () => {
  const app = await electron.launch({
    executablePath: path.resolve("scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: {
      ...process.env,
      CALM_WORK_PROFILE: path.resolve("output/account-buttons-" + Date.now()),
      CALM_WORK_NO_BROWSER: "1",
    },
  });
  try {
    const page = await app.firstWindow(),
      frame = page.frameLocator('iframe[title="Calm Work"]');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await frame.locator("#global-add").waitFor({ timeout: 60000 });
    await app.evaluate(({ ipcMain }) => {
      globalThis.__accounts = [];
      globalThis.__actions = [];
      globalThis.__oauthUrls = [];
      // Capture SP's plugin OAuth start; the browser itself is disabled in this profile.
      ipcMain.on("PLUGIN_OAUTH_START", (_event, { url }) => globalThis.__oauthUrls.push(url));
      const calendars = {
        google: [
          { id: "ada@example.test", name: "Ada", canWrite: true, synced: true, color: "#9fe1e7" },
          { id: "calm", name: "Calm Work", canWrite: true, synced: true, calm: true, color: "#4f6bed" },
          { id: "holidays", name: "Holidays", canWrite: false, synced: false, color: "#16a765" },
        ],
      };
      ipcMain.removeHandler("calm-calendar");
      ipcMain.handle("calm-calendar", (_event, input) => {
        globalThis.__actions.push({ ...input, google: (input.google || []).map((g) => g.accountId) });
        if (input.action === "connect")
          globalThis.__accounts.push({ provider: input.provider, accountId: input.accountId, canWrite: true, refreshedAt: new Date().toISOString() });
        if (input.action === "disconnect")
          globalThis.__accounts = globalThis.__accounts.filter((a) => a.accountId !== input.accountId);
        if (input.action === "calendar-select") {
          const c = calendars.google.find((x) => x.id === input.calendarId);
          if (c) c.synced = input.enabled;
        }
        return {
          accounts: globalThis.__accounts,
          calendars: Object.fromEntries(globalThis.__accounts.map((a) => [a.accountId, calendars[a.accountId] || []])),
          events: [],
          registrations: { microsoft: { clientId: "synthetic-microsoft" } },
        };
      });
    });
    await frame.locator("body").evaluate(async () => {
      show("modules");
      await CalmRuntime.calendar({ action: "status" });
    });
    // Google: SP's plugin builds the authorize URL (its public client, PKCE, two scopes).
    await frame.getByRole("button", { name: "Sign in to Google account 1", exact: true }).click();
    await frame.locator("#toast").filter({ hasText: /browser|disabled|failed|cancel/i }).waitFor({ timeout: 30000 });
    const urls = await app.evaluate(() => globalThis.__oauthUrls);
    assert.equal(urls.length, 1);
    const auth = new URL(urls[0]);
    assert.equal(auth.origin + auth.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.ok((auth.searchParams.get("client_id") || "").endsWith(".apps.googleusercontent.com"));
    assert.equal(auth.searchParams.get("scope").split(" ").sort().join(" "),
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events");
    assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
    assert.equal(new URL(auth.searchParams.get("redirect_uri")).hostname, "127.0.0.1");
    assert.equal(auth.searchParams.get("access_type"), "offline");
    assert.ok(!(await app.evaluate(() => globalThis.__actions)).some((a) => a.provider === "google" && a.action === "connect"),
      "Google sign-in never goes to the Calm Work engine");
    // Microsoft: Calm Work's own Entra sign-in.
    await frame.getByRole("button", { name: "Sign in to Microsoft 365", exact: true }).click();
    await frame.locator('[data-calendar-command="disconnect"][data-account="microsoft"]').waitFor();
    // A signed-in Google slot (as SP would report it) lists its calendars with colour and access.
    await app.evaluate(() => globalThis.__accounts.push({ provider: "google", accountId: "google", label: "ada@example.test", canWrite: true, managedBy: "super-productivity" }));
    await frame.locator("body").evaluate(() => CalmRuntime.calendar({ action: "status" }));
    const list = frame.locator('fieldset.calendar-choices');
    await list.first().waitFor();
    assert.equal(await frame.locator('[data-calendar-select="google"]').count(), 3);
    assert.equal(await frame.locator('[data-calendar-select="google"][value="calm"]').isDisabled(), true, "Calm Work is always synced");
    assert.equal(await frame.locator('[data-calendar-select="google"][value="holidays"]').isChecked(), false);
    assert.match(await list.first().innerText(), /Holidays\s*Read-only/);
    assert.match(await list.first().innerText(), /Ada\s*Editable/);
    await frame.locator('[data-calendar-select="google"][value="holidays"]').check();
    await frame.locator("#toast").filter({ hasText: "Calendar turned on." }).waitFor();
    const select = (await app.evaluate(() => globalThis.__actions)).find((a) => a.action === "calendar-select");
    assert.equal(select.calendarId, "holidays");
    assert.equal(select.enabled, true);
    await page.screenshot({ path: path.resolve("output/v2/settings-calendars.png") });
    // Disconnect stays isolated per slot.
    await frame.locator('[data-calendar-command="disconnect"][data-account="google"]').click();
    await frame.getByRole("button", { name: "Sign in to Google account 1", exact: true }).waitFor();
    assert.equal(await frame.locator('[data-calendar-command="disconnect"][data-account="microsoft"]').count(), 1);
    // Booking, Polls and Team are hidden until enabled in Settings.
    for (const view of ["bookings", "polls", "team"])
      assert.equal(
        await frame
          .locator('#navigation [data-show="' + view + '"]')
          .isVisible(),
        false,
      );
    await frame.locator("#setting-optional-modules").check();
    for (const view of ["bookings", "polls", "team"])
      assert.equal(
        await frame
          .locator('#navigation [data-show="' + view + '"]')
          .isVisible(),
        true,
      );
    await page.setViewportSize({ width: 390, height: 844 });
    await frame.locator("#mobile-more").click();
    for (const view of ["bookings", "polls", "team"])
      assert.equal(
        await frame
          .locator('#mobile-menu [data-show="' + view + '"]')
          .isVisible(),
        true,
      );
    console.log(
      "PASS: Google sign-in uses SP's OAuth (public client, PKCE, two scopes, no browser in tests); Microsoft uses the engine; per-account calendar checklist with colour/access; disconnect is isolated; modules visible on desktop and mobile.",
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
