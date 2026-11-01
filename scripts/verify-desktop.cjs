#!/usr/bin/env node
const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const { execFile } = require("node:child_process"),
  { promisify } = require("node:util");
const run = promisify(execFile),
  root = path.resolve(__dirname, "..");
const profile = path.join(root, "output/desktop-check-" + Date.now());
let app;
async function launch() {
  app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: profile },
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1200, height: 850 });
  await page.context().setOffline(true);
  const frame = page.frameLocator('iframe[title="Calm Work"]');
  await frame.locator("#global-add").waitFor();
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      if (window.CalmRuntime?.ready()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Runtime not ready");
  });
  return { page, frame };
}
async function menuAction(id) {
  await app.evaluate(({ app }, id) => {
    const base = app.getAppPath() + "/electron/";
    const require = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const windows = require(base + "main-window.js"),
      lifecycle = require(base + "various-shared.js");
    const menu = require(base + "calm-tray-menu.js").createCalmTrayMenu(
      () => lifecycle.showOrFocus(windows.getWin()),
      lifecycle.quitApp,
    );
    menu.getMenuItemById(id).click();
  }, id);
}
async function quit() {
  const closing = app.waitForEvent("close", { timeout: 20000 });
  await menuAction("calm-quit");
  await closing;
  app = null;
}
(async () => {
  const { page, frame } = await launch();
  assert.equal(await app.evaluate(({ app }) => app.getName()), "Calm Work");
  const widgetCheck = await app.evaluate(async ({ app, BrowserWindow }) => {
    const base = app.getAppPath() + "/electron/";
    const load = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const widget = load(base + "task-widget/task-widget.js");
    const before = BrowserWindow.getAllWindows().length;
    widget.updateTaskWidgetEnabled(true);
    widget.showTaskWidget();
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { before, after: BrowserWindow.getAllWindows().length };
  });
  assert.equal(
    widgetCheck.after,
    widgetCheck.before,
    "SP widget must not create a Calm window",
  );

  assert.equal(await page.title(), "Calm Work");
  const metadata = await app.evaluate(({ app }) => {
    const base = app.getAppPath() + "/electron/";
    const require = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const lifecycle = require(base + "various-shared.js"),
      windows = require(base + "main-window.js");
    const tray = require(base + "indicator.js").ensureIndicator();
    const menu = require(base + "calm-tray-menu.js").createCalmTrayMenu(
      () => lifecycle.showOrFocus(windows.getWin()),
      lifecycle.quitApp,
    );
    return {
      trayAlive: !tray.isDestroyed(),
      labels: menu.items.filter((item) => item.label).map((item) => item.label),
    };
  });
  assert(metadata.trayAlive);
  assert.deepEqual(metadata.labels, [
    "Calm Work",
    "Today · planned tasks and events",
    "Nothing planned for today",
    "Open Calm Work",
    "Hide Calm Work",
    "Quit Calm Work",
  ]);
  await frame.locator("#global-add").click();
  await frame.locator("#add-title").fill("Desktop lifecycle check @today t25m");
  await frame.locator('#add-form [type="submit"]').click();
  const task = await frame
    .locator("body")
    .evaluate(() =>
      CalmRuntime.snapshot().tasks.find(
        (t) => t.title === "Desktop lifecycle check",
      ),
    );
  await frame.locator(`[data-row="${task.id}"]`).hover();
  await frame.locator(`[data-start="${task.id}"]`).click();
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  await menuAction("calm-hide");
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  await page.waitForTimeout(1100);
  assert.equal(
    await frame
      .locator("body")
      .evaluate(() => CalmRuntime.snapshot().clock.running),
    true,
  );
  await run(path.join(root, "scripts/launch-core.sh"), [], {
    env: { ...process.env, CALM_WORK_PROFILE: profile },
    timeout: 15000,
  });
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    true,
  );
  await page.waitForTimeout(300);
  // Closing the window hides it; it must not quit or discard the active session.
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].close(),
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  assert.equal(
    await frame
      .locator("body")
      .evaluate(() => CalmRuntime.snapshot().clock.running),
    true,
  );
  await menuAction("calm-open");
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    true,
  );
  await quit();
  const reopened = await launch();
  const saved = await reopened.frame
    .locator("body")
    .evaluate(() => CalmRuntime.snapshot());
  assert(saved.tasks.some((t) => t.id === task.id));
  assert.equal(saved.clock.active, task.id);
  assert.equal(saved.clock.running, false);
  assert(saved.clock.elapsedMs >= 1000);
  await quit();
  console.log(
    "PASS: Calm Work identity, native tray, Open/Hide/Quit actions, launcher single instance, close-to-tray tracking, graceful quit and restart persistence.",
  );
})().catch(async (error) => {
  console.error(error);
  if (app) await quit().catch(() => app?.process().kill());
  process.exitCode = 1;
});
