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
      CALM_WORK_NO_BROWSER: "1",
      CALM_WORK_PROFILE: path.join(
        root,
        "output/calendar-background-" + Date.now(),
      ),
    },
  });
  try {
    const page = await app.firstWindow(),
      frame = page.frameLocator('iframe[title="Calm Work"]');
    await frame.locator("#global-add").waitFor({ timeout: 60000 });
    await app.evaluate(({ ipcMain }) => {
      globalThis.__calmCalendarRefresh = [];
      globalThis.__calmCalendarOffline = false;
      ipcMain.removeHandler("calm-calendar");
      ipcMain.handle("calm-calendar", (_event, input) => {
        if (input.action === "refresh") {
          globalThis.__calmCalendarRefresh.push(input.provider);
          if (globalThis.__calmCalendarOffline)
            return { error: "Synthetic offline provider" };
        }
        return {
          accounts: [
            { provider: "google", refreshedAt: new Date().toISOString() },
            { provider: "microsoft", refreshedAt: new Date().toISOString() },
          ],
          events: [],
          serviceOrigin: "",
        };
      });
    });
    await frame.locator("body").evaluate(async () => {
      await CalmRuntime.calendar({ action: "status" });
      projects.push("Private");
      tasks.push({
        id: "editing",
        title: "Keep local editor",
        project: "Private",
        date: calmToday(),
        schedule: "",
        estimate: 25,
        done: false,
        today: true,
      });
      await CalmRuntime.flush();
      openTask("editing", true);
    });
    await frame
      .locator("#detail-notes")
      .fill("Unsaved notes must survive provider refresh");
    await frame.locator("body").evaluate(() => {
      window.__realDateNow = Date.now;
      Date.now = () => window.__realDateNow() + 301000;
    });
    for (
      let i = 0;
      i < 100 &&
      (await app.evaluate(() => globalThis.__calmCalendarRefresh.length)) < 2;
      i++
    )
      await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(
      await app.evaluate(() => globalThis.__calmCalendarRefresh),
      ["google", "microsoft"],
    );
    assert.equal(
      await frame.locator("#detail-notes").inputValue(),
      "Unsaved notes must survive provider refresh",
    );
    await frame.locator("#drawer-save").click();
    await frame.locator("body").evaluate(() => CalmRuntime.flush());
    await frame.locator("#global-add").click();
    await frame.locator("#add-title").fill("Keep unfinished capture");
    await app.evaluate(() => {
      globalThis.__calmCalendarOffline = true;
    });
    await frame.locator("body").evaluate(() => {
      Date.now = () => window.__realDateNow() + 602000;
    });
    for (
      let i = 0;
      i < 100 &&
      (await app.evaluate(() => globalThis.__calmCalendarRefresh.length)) < 4;
      i++
    )
      await new Promise((r) => setTimeout(r, 50));
    assert.equal(
      await app.evaluate(() => globalThis.__calmCalendarRefresh.length),
      4,
    );
    assert.equal(
      await frame.locator("#add-title").inputValue(),
      "Keep unfinished capture",
    );
    await frame.locator("body").evaluate(() => {
      Date.now = window.__realDateNow;
    });
    console.log(
      "PASS: both connected calendars refresh automatically, offline failures retain local work, and task/capture drafts survive background responses.",
    );
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
