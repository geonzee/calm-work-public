#!/usr/bin/env node
const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
const root = path.resolve(__dirname, ".."),
  profile = path.join(root, "output/daily-workflow/native-" + Date.now());
let app;
const errors = [];
async function launch() {
  app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: profile },
  });
  fs.mkdirSync(path.join(profile, "downloads"), { recursive: true });
  await app.evaluate(
    ({ app }, directory) => app.setPath("downloads", directory),
    path.join(profile, "downloads"),
  );
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.context().setOffline(true);
  await page
    .frameLocator('iframe[title="Calm Work"]')
    .locator("#global-add")
    .waitFor();
  const frame = page.frameLocator('iframe[title="Calm Work"]');
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      if (window.CalmRuntime?.ready()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error("Workspace not ready");
  });
  return { page, frame };
}
async function quit() {
  const closing = app.waitForEvent("close", { timeout: 20000 });
  await app.evaluate(({ app }) => {
    const base = app.getAppPath() + "/electron/";
    const req = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    req(base + "main-window.js").closeWinAndQuit(
      req(base + "various-shared.js").quitApp,
    );
  });
  await closing;
  app = null;
}
async function menu(action) {
  return app.evaluate(({ app }, action) => {
    const base = app.getAppPath() + "/electron/";
    const req = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const win = req(base + "main-window.js").getWin();
    const menu = req(base + "calm-tray-menu.js").createCalmTrayMenu(
      () => win.show(),
      () => {},
    );
    if (action) {
      const item = menu.getMenuItemById(action.id);
      if (!item) throw new Error("Missing menu item " + action.id);
      const target =
        action.submenu != null ? item.submenu.items[action.submenu] : item;
      target.click();
    }
    return menu.items.map((i) => ({
      id: i.id,
      label: i.label,
      submenu: i.submenu?.items.map((c) => c.label),
    }));
  }, action);
}
async function until(check) {
  for (let i = 0; i < 60; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Native menu state timeout");
}
(async () => {
  fs.mkdirSync(profile, { recursive: true });
  let { page, frame } = await launch();
  await app.evaluate(({ app }) => {
    const base = app.getAppPath() + "/electron/";
    const req = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const tray = req(base + "indicator.js").ensureIndicator();
    const setTooltip = tray.setToolTip.bind(tray);
    tray.setToolTip = (value) => {
      globalThis.__calmTestTooltip = value;
      setTooltip(value);
    };
    let opened = false;
    tray.popUpContextMenu = (menu) => {
      opened = menu.items.some((item) => item.id === "calm-open");
    };
    tray.emit("click");
    if (!opened)
      throw new Error("Clicking the tray did not open its agenda menu");
  });
  await frame.locator("body").evaluate(async () => {
    await CalmRuntime.seed();
    await CalmRuntime.flush();
  });
  assert.equal(
    await frame.locator("body").evaluate(() => typeof window.calmTray),
    "undefined",
    "task iframe must not expose native IPC",
  );
  await until(async () =>
    (await menu()).some((i) => i.id?.startsWith("calm-agenda-")),
  );
  let items = await menu();
  assert(
    items.some((i) => i.label.includes("(event)")),
    "saved events belong in today agenda",
  );
  const taskItem = items.find((i) => i.submenu?.includes("Start tracking"));
  assert(taskItem);
  await menu({ id: "calm-hide" });
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  await menu({ id: taskItem.id, submenu: 0 });
  await until(async () =>
    (await menu()).some(
      (i) => i.id === "calm-toggle" && i.label === "Pause recording",
    ),
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
    "starting via tray must not force the main window open",
  );
  const taskId = await frame.locator("body").evaluate(() => state.active);
  assert(taskId);
  // Even a delayed duplicate start action must not turn recording off.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0].webContents.send("calm-tray-action", {
      type: "start",
      id,
    });
  }, taskId);
  await page.waitForTimeout(300);
  assert.equal(await frame.locator("body").evaluate(() => state.running), true);
  await menu({ id: "calm-toggle" });
  await until(
    async () => !(await frame.locator("body").evaluate(() => state.running)),
  );
  assert(
    (await menu()).some(
      (i) => i.id === "calm-toggle" && i.label === "Resume recording",
    ),
  );
  await until(async () =>
    app.evaluate(({ app }) => {
      const base = app.getAppPath() + "/electron/";
      const req = process
        .getBuiltinModule("module")
        .createRequire(base + "main.js");
      return globalThis.__calmTestTooltip?.startsWith("Paused");
    }),
  );
  await menu({ id: "calm-toggle" });
  await until(
    async () => await frame.locator("body").evaluate(() => state.running),
  );
  const eventItem = (await menu()).find((item) =>
    item.label.includes("(event)"),
  );
  await menu({ id: eventItem.id });
  await frame.locator("#event-title").waitFor();
  assert.equal(await frame.locator("#drawer").isVisible(), true);
  await frame.locator("#close-drawer").click();

  await new Promise((r) => setTimeout(r, 1200));
  await menu({ id: "calm-toggle" });
  await until(
    async () => !(await frame.locator("body").evaluate(() => state.running)),
  );
  await menu({ id: "calm-hide" });
  await menu({ id: "calm-complete" });
  await until(
    async () =>
      (await frame.locator("body").evaluate(() => state.active)) === null,
  );
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].isVisible(),
    ),
    false,
  );
  const sessionCount = await frame
    .locator("body")
    .evaluate(() => state.sessions.length);
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0].webContents.send("calm-tray-action", {
      type: "complete",
      id,
    });
  }, taskId);
  await page.waitForTimeout(100);
  assert.equal(
    await frame.locator("body").evaluate(() => state.sessions.length),
    sessionCount,
  );
  await menu({ id: "calm-open" });

  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  await frame.locator("body").evaluate(() => show("plan"));
  const completed = frame.locator(
    `[data-calendar-task="${taskId}"].actual-block`,
  );
  await completed.first().waitFor();
  assert.match(await completed.first().getAttribute("aria-label"), /tracked/);
  // The block sits at the current time, which the task panel can cover late in the day.
  await completed.first().dispatchEvent("click");
  await frame.locator("#detail-complete").uncheck();
  await frame.locator("#drawer-save").click();
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  assert.ok(
    (await frame
      .locator(`[data-calendar-task="${taskId}"].actual-block`)
      .count()) >= 1,
    "tracked time stays on Plan after reopening",
  );
  const reopenedBlocks = await frame
    .locator(`[data-calendar-task="${taskId}"]`)
    .evaluateAll((blocks) => blocks.map((block) => ({
      start: Number(block.dataset.blockStart),
      end: Number(block.dataset.blockEnd),
    })));
  // A late-night interval has one segment on each side of midnight.
  assert.ok(reopenedBlocks.length >= 1 && reopenedBlocks.length <= 2);
  for (const block of reopenedBlocks) {
    assert.ok(block.start >= 0 && block.end <= 1440 && block.end > block.start);
  }
  if (reopenedBlocks.length === 2) {
    assert.equal(reopenedBlocks[0].end, 1440);
    assert.equal(reopenedBlocks[1].start, 0);
  }
  // Tray start is available even while the full app is in Plan.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0].webContents.send("calm-tray-action", {
      type: "start",
      id,
    });
  }, taskId);
  await until(
    async () =>
      (await frame.locator("body").evaluate(() => state.active)) === taskId,
  );
  assert.equal(await frame.locator("body").evaluate(() => state.view), "plan");
  await frame.locator("#header-complete").click();
  assert.equal(
    await frame
      .locator("body")
      .evaluate((_body, id) => getTask(id).done, taskId),
    true,
  );
  await frame
    .locator(`[data-calendar-task="${taskId}"].actual-block`)
    .first()
    .dispatchEvent("click");
  await frame.locator("#detail-complete").uncheck();
  await frame.locator("#drawer-save").click();
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  await quit();
  ({ page, frame } = await launch());
  assert.equal(
    await frame
      .locator("body")
      .evaluate((_body, id) => getTask(id).done, taskId),
    false,
  );
  await frame.locator("body").evaluate(() => show("plan"));
  assert.equal(
    await frame.locator(`[data-calendar-task="${taskId}"]`).count(),
    1,
  );
  await frame.locator("body").evaluate(() => show("reports"));
  assert.equal(await frame.locator(".report-totals").count(), 1);
  await frame.locator('#screen [data-show="export"]').click();
  await frame.locator("#report-export-format").selectOption("CSV");
  await frame.locator("#download-report").click();
  const exported = await frame
    .locator("body")
    .evaluate(() => CalmRuntime.lastExport());
  assert.equal(exported.format, "csv");
  assert.match(exported.data, /recordedSeconds/);
  await frame.locator("#close-drawer").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="reports"]').click();
  assert.equal(
    await frame.locator("body").evaluate(() => state.view),
    "reports",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({ path: path.join(profile, "native-reports.png") });
  await quit();
  console.log(
    "PASS: native agenda from saved data; hidden-window start/pause/resume; isolated IPC; completion/reopen across restart; report totals/CSV and styled mobile navigation.",
  );
})().catch(async (e) => {
  console.error(e);
  if (app) await quit().catch(() => app?.process().kill());
  process.exitCode = 1;
});
