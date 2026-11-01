#!/usr/bin/env node
// Exercise the daily workspace through its real navigation in a disposable profile.
const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "output/ui-cleanup");
const profile = path.join(output, "workspace-profile-" + Date.now());
let app;
async function quit() {
  const closing = app.waitForEvent("close", { timeout: 20000 });
  await app.evaluate(({ app }) => {
    const base = app.getAppPath() + "/electron/";
    const require = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    require(base + "main-window.js").closeWinAndQuit(
      require(base + "various-shared.js").quitApp,
    );
  });
  await closing;
  app = null;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: profile },
  });
  const downloads = path.join(profile, "downloads");
  fs.mkdirSync(downloads, { recursive: true });
  await app.evaluate(
    ({ app }, directory) => app.setPath("downloads", directory),
    downloads,
  );
  const page = await app.firstWindow();
  await page.context().setOffline(true);
  await page.setViewportSize({ width: 1440, height: 950 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const frame = page.frameLocator('iframe[title="Calm Work"]');
  await frame.locator("#global-add").waitFor();
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 150; i++) {
      if (window.CalmRuntime?.ready()) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Runtime not ready");
  });
  assert.equal(await frame.locator(".review-toolbar").isVisible(), false);
  assert.equal(await frame.locator(".key-hints").isVisible(), false);
  assert.deepEqual(
    await frame
      .locator("#navigation .nav-item:visible")
      .evaluateAll((nodes) => nodes.map((n) => n.dataset.show)),
    ["track", "plan", "inbox", "projects", "reports"],
  );
  assert((await frame.locator(".app-header").boundingBox()).height <= 48);
  assert.equal(
    await frame.getByText("One task at a time", { exact: true }).count(),
    0,
  );
  assert.equal(await frame.locator("#toggle-picker").count(), 0);
  const boot = fs.readFileSync(
    path.join(root, "output/upstream/.tmp/angular-dist/browser/index.html"),
    "utf8",
  );
  assert(boot.includes("Opening Calm Work"));
  assert(!/productivityTips|spinner-pulse|productivity-tip/.test(boot));
  const initial = await frame
    .locator("body")
    .evaluate(() => CalmRuntime.snapshot());
  assert.equal(
    initial.tasks.length,
    0,
    "fresh Calm profiles should not receive upstream tutorial tasks",
  );
  for (const task of initial.tasks) {
    await frame.locator("body").evaluate((_body, id) => openTask(id), task.id);
    await frame.locator("#delete-task").click();
    await frame.locator("#confirm-delete-task").click();
  }
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  await frame.locator("body").evaluate(() => CalmRuntime.seed());
  await frame.locator("#collapse-nav").click();
  assert.equal(
    await frame
      .locator('#navigation [data-show="plan"]')
      .getAttribute("aria-label"),
    "Plan",
  );
  await frame.getByRole("button", { name: "Plan", exact: true }).click();
  assert.equal(await frame.locator("body").evaluate(() => state.view), "plan");
  await frame.locator("#collapse-nav").click();
  const navigate = (view) =>
    frame.locator(`#navigation [data-show="${view}"]`).click();
  await navigate("track");
  await frame.locator("#picker-search").fill("Reply");
  assert.equal(await frame.locator(".today-queue [data-row]").count(), 1);
  assert.match(
    await frame.locator(".today-queue").textContent(),
    /Reply to Alex/,
  );
  await frame.locator("#picker-search").press("Escape");
  assert.equal(await frame.locator("#picker-search").inputValue(), "");
  await frame.locator("#picker-search").press("ArrowDown");
  await page.keyboard.press("i");
  assert.equal(await frame.locator("#drawer").isVisible(), true);
  await frame.locator("#close-drawer").click();
  await page.screenshot({ path: path.join(output, "native-track.png") });
  await navigate("inbox");
  await frame.locator("#task-filter").fill("packaging");
  assert.equal(await frame.locator("#screen [data-row]").count(), 1);
  await frame.locator("#task-filter").press("Escape");
  await page.screenshot({ path: path.join(output, "native-inbox.png") });
  await navigate("projects");
  await frame.locator("#task-filter").fill("Personal");
  assert.equal(await frame.locator(".project-row").count(), 1);
  await frame.locator(".project-row").hover();
  await frame
    .getByRole("button", { name: "Details for Personal", exact: true })
    .click();
  await frame.locator("#project-name").fill("Personal work");
  await frame.locator("#drawer-save").click();
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  assert.equal(
    await page.locator(".mat-mdc-snack-bar-container").count(),
    0,
    "project edits should not duplicate upstream feedback",
  );
  await frame
    .getByRole("button", { name: "Personal work", exact: true })
    .click();
  assert.equal(
    await frame.locator("#screen-title").textContent(),
    "Personal work",
  );
  assert.equal(
    await frame
      .locator('#navigation [data-show="projects"]')
      .getAttribute("class"),
    "nav-item active",
  );
  assert(
    !(await frame.locator("#screen .task-meta").allTextContents())
      .join(" ")
      .includes("Personal work"),
  );
  await frame.locator("#task-filter").fill("reply");
  assert.equal(await frame.locator("#screen [data-row]").count(), 1);
  await frame.locator("#task-filter").press("Escape");
  await frame.getByRole("button", { name: "Board", exact: true }).click();
  await frame.locator("#task-filter").fill("reply");
  assert.equal(await frame.locator("#screen [data-row]").count(), 1);
  await frame.locator("#task-filter").press("Escape");
  await page.screenshot({
    path: path.join(output, "native-project-board.png"),
  });
  const boardTask = await frame
    .locator("#screen [data-row]")
    .first()
    .getAttribute("data-row");
  await frame
    .locator(`[data-row="${boardTask}"]`)
    .dragTo(frame.locator('[data-board-target="done"]'));
  assert.equal(
    await frame
      .locator("body")
      .evaluate((_body, id) => getTask(id).done, boardTask),
    true,
  );
  await frame
    .locator(`[data-row="${boardTask}"]`)
    .dragTo(frame.locator('[data-board-target="unplanned"]'));
  assert.equal(
    await frame
      .locator("body")
      .evaluate((_body, id) => getTask(id).date, boardTask),
    "",
  );
  await frame
    .locator(`[data-row="${boardTask}"]`)
    .dragTo(frame.locator('[data-board-target="planned"]'));
  assert.equal(
    await frame
      .locator("body")
      .evaluate((_body, id) => getTask(id).date, boardTask),
    await frame.locator("body").evaluate(() => calmToday()),
  );
  await frame.locator("body").evaluate(() => CalmRuntime.flush());
  await frame.getByRole("button", { name: "List", exact: true }).click();
  await page.screenshot({ path: path.join(output, "native-project.png") });
  await frame.getByRole("button", { name: "Back to projects" }).click();
  await page.screenshot({ path: path.join(output, "native-projects.png") });
  await navigate("plan");
  assert.equal(
    await frame.locator(".day-column").first().getAttribute("data-day"),
    String(await frame.locator("body").evaluate(() => calmTodayIndex())),
  );
  assert.equal(
    await frame.locator(".calendar-wrap").evaluate((w) => w.scrollLeft),
    0,
  );
  const calendarHeader = await frame.locator(".calendar-header").boundingBox();
  await page.mouse.move(calendarHeader.x + 450, calendarHeader.y + 25);
  await page.mouse.down();
  await page.mouse.move(calendarHeader.x + 150, calendarHeader.y + 25, {
    steps: 10,
  });
  await page.mouse.up();
  assert(
    (await frame.locator(".calendar-wrap").evaluate((w) => w.scrollLeft)) > 200,
  );
  await frame.locator('[data-calendar-nav="today"]').click();
  assert.equal(
    await frame.locator("#task-filter").getAttribute("placeholder"),
    "To plan",
  );
  await frame.locator("#task-filter").fill("handoff");
  assert.equal(await frame.locator(".plan-tasks [data-row]").count(), 1);
  await frame.locator("#task-filter").press("Escape");
  await page.screenshot({ path: path.join(output, "native-plan.png") });
  await navigate("reports");
  await frame.locator("#task-filter").fill("customer");
  assert.equal(await frame.locator("#screen tbody > tr").count(), 1);
  await frame
    .getByRole("button", { name: "Time entries", exact: true })
    .click();
  assert.equal(await frame.locator("#screen tbody > tr").count(), 1);
  await frame.locator("#task-filter").press("Escape");
  await page.screenshot({ path: path.join(output, "native-reports.png") });
  await navigate("track");
  const next = await frame
    .locator(".today-queue [data-row]")
    .first()
    .getAttribute("data-row");
  await frame.locator(`[data-row="${next}"]`).hover();
  await frame.locator(`[data-start="${next}"]`).click();
  await page.waitForTimeout(1100);
  assert.equal(await frame.locator(".commitment").isVisible(), true);
  await frame.locator(".nav-bottom").click();
  await frame.locator("#workspace-backup").click();
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 100; i++) {
      if (CalmRuntime.lastExport()?.format === "workspace") return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error("Workspace export missing");
  });
  const backup = await frame
    .locator("body")
    .evaluate(() => JSON.parse(CalmRuntime.lastExport().data));
  assert.equal(backup.format, "calm-work-workspace");
  assert.equal(backup.version, 1);
  assert.equal(backup.document.clock.running, false);
  assert(
    backup.document.clock.elapsedMs >= 1000,
    "export includes the current session through the export instant",
  );
  assert.equal(
    await frame
      .locator("body")
      .evaluate(() => CalmRuntime.snapshot().clock.running),
    true,
    "export does not pause live tracking",
  );
  assert(backup.document.projects.includes("Personal work"));
  assert(backup.document.tasks.some((t) => t.project === "Personal work"));
  assert(
    backup.document.sessions.length > 0 && backup.document.events.length > 0,
  );
  const snapshot = await frame
    .locator("body")
    .evaluate(() => CalmRuntime.snapshot());
  assert.equal(backup.document.tasks.length, snapshot.tasks.length);
  await page.screenshot({ path: path.join(output, "native-settings.png") });
  // Every core destination stays reachable in a narrow desktop window.
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await frame.locator("#mobile-more").isVisible(), true);
  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="plan"]').click();
  assert.equal(await frame.locator("body").evaluate(() => state.view), "plan");
  for (const view of ["projects", "reports", "modules"]) {
    await frame.locator("#mobile-more").click();
    await frame.locator(`#mobile-menu [data-show="${view}"]`).click();
    assert.equal(await frame.locator("body").evaluate(() => state.view), view);
  }
  await frame.locator("#mobile-more").click();
  await frame.locator('#mobile-menu [data-show="track"]').click();
  await frame.locator("#global-add").click();
  assert.equal(await frame.locator("#add-title").isVisible(), true);
  await frame.locator("#close-add").click();
  await page.screenshot({ path: path.join(output, "native-phone.png") });
  const bounds = await frame.locator("body").evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  assert(bounds.width <= bounds.viewport);
  assert.deepEqual(errors, []);
  await quit();
  console.log(
    "PASS: compact chrome; core-only navigation; inline Track/Inbox/Projects/Plan/Reports filters; keyboard details; project list/board/rename consistency; workspace export; mobile navigation and capture; no browser errors.",
  );
})().catch(async (error) => {
  console.error(error);
  if (app) await quit().catch(() => app?.process().kill());
  process.exitCode = 1;
});
