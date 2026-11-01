#!/usr/bin/env node
const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const profile = path.join(root, "output", "core-ui-check-" + Date.now());
fs.mkdirSync(profile, { recursive: true });
let app;
let errors = [];
let resourceFailures = [];

async function launch() {
  app = await electron.launch({
    executablePath: path.join(
      root,
      "output/upstream/.tmp/app-builds/linux-unpacked/superproductivity",
    ),
    args: ["--no-sandbox", "--user-data-dir=" + profile],
    env: {
      ...process.env,
      XDG_CONFIG_HOME: profile + "/config",
      XDG_DATA_HOME: profile + "/data",
      XDG_CACHE_HOME: profile + "/cache",
    },
  });
  assert.equal(
    await app.evaluate(({ app }) => app.getPath("userData")),
    profile,
  );
  const downloads = path.join(profile, "downloads");
  fs.mkdirSync(downloads, { recursive: true });
  await app.evaluate(
    ({ app }, directory) => app.setPath("downloads", directory),
    downloads,
  );
  const page = await app.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    )
      errors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    resourceFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText,
    }),
  );
  await page.context().setOffline(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setSize(1400, 1000);
    window.show();
  });
  const frame = page.frameLocator('iframe[title="Calm Work"]');
  await frame.locator("#review-picker").waitFor({ state: "attached" });
  await frame.locator("#global-add").waitFor();
  try {
    await frame.locator("body").evaluate(async () => {
      for (let attempt = 0; attempt < 150; attempt++) {
        if (window.CalmRuntime?.ready()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(
        "Local workspace did not finish loading. Frame said: " +
          document.body.innerText,
      );
    });
  } catch (error) {
    const hostError = await page
      .locator(".runtime-error")
      .textContent()
      .catch(() => "");
    const frameInfo = await frame
      .locator("body")
      .evaluate(() => ({
        url: location.href,
        reference: window.calmReference,
        adapter: typeof window.CalmRuntime,
        ready: window.CalmRuntime?.ready(),
        visibility: document.body.style.visibility,
      }))
      .catch(() => ({}));
    throw new Error(
      String(error.message) +
        "\nHost: " +
        hostError +
        "\nFrame: " +
        JSON.stringify(frameInfo) +
        "\nConsole: " +
        errors.join("\n"),
    );
  }
  return { page, frame };
}

async function quitDesktop() {
  const closing = app.waitForEvent("close", { timeout: 20000 });
  await app.evaluate(({ app }) => {
    const base = app.getAppPath() + "/electron/";
    const require = process
      .getBuiltinModule("module")
      .createRequire(base + "main.js");
    const windows = require(base + "main-window.js"),
      lifecycle = require(base + "various-shared.js");
    windows.closeWinAndQuit(lifecycle.quitApp);
  });
  await closing;
  app = null;
}

async function snapshot(frame) {
  return frame.locator("body").evaluate(() => window.CalmRuntime.snapshot());
}

async function flush(frame) {
  await frame.locator("body").evaluate(() => window.CalmRuntime.flush());
}

async function choose(frame, key) {
  await frame.locator("body").evaluate((_body, key) => show(key), key);
}

async function addTask(frame, value) {
  await frame.locator("#global-add").click();
  await frame.locator("#add-title").fill(value);
  await frame.locator('#add-form button[type="submit"]').click();
  await frame.locator("#add-overlay").waitFor({ state: "hidden" });
}

(async () => {
  let { page, frame } = await launch();

  // Fresh runtime views contain no hard-coded project, task, event or history records.
  const empty = await snapshot(frame);
  assert(
    empty.tasks.every(
      (task) => !["draft", "supplier", "notes"].includes(task.id),
    ),
    "review fixtures must not leak into a fresh profile",
  );
  assert(
    empty.tasks.every(
      (task) => !task.project || empty.projects.includes(task.project),
    ),
  );
  assert.equal(empty.sessions.length, 0);
  assert.equal(empty.events.length, 0);
  assert.equal(await frame.locator(".commitment").count(), 0);
  assert.equal(await frame.locator(".focus-work h2").count(), 0);
  await choose(frame, "plan");
  assert.equal(await frame.locator(".calendar-block").count(), 0);
  assert.equal(await frame.locator(".calendar-header .current-day").count(), 1);
  await choose(frame, "projects");
  assert.equal(
    await frame.locator("[data-project-index]").count(),
    empty.projects.length,
  );

  // Remove upstream's optional onboarding task only in this disposable profile.
  for (const task of empty.tasks) {
    await frame.locator("body").evaluate((_body, id) => openTask(id), task.id);
    await frame.locator("#delete-task").click();
    await frame.locator("#confirm-delete-task").click();
  }
  await flush(frame);
  // Fixtures are created explicitly through the test helper, never on boot.
  await frame.locator("body").evaluate(() => CalmRuntime.seed());
  await frame.getByText("Sample workspace loaded locally.").waitFor();
  const sample = await snapshot(frame);
  assert(sample.tasks.length > 0);
  assert(sample.projects.includes("Product launch"));
  await choose(frame, "track");
  await frame.locator("#global-add").click();
  await frame.locator("#add-title").fill("Ghost completion +prod");
  await frame.locator("#accept-completion").waitFor();
  await frame.locator("#add-title").press("Tab");
  assert.match(
    await frame.locator("#add-title").inputValue(),
    /\+product-launch\s$/,
  );
  await frame.locator("#close-add").click();
  await frame.locator("#global-add").click();
  assert.match(
    await frame.locator("#add-title").inputValue(),
    /Ghost completion \+product-launch/,
  );
  await frame.locator("#close-add").click();

  await addTask(frame, "Core flow task +launch @today t25m");
  let current = await snapshot(frame);
  const task = current.tasks.find((item) => item.title === "Core flow task");
  assert(task, "capture shorthand should create the task");
  assert.equal(task.project, "Product launch");
  assert.equal(task.estimate, 25);
  assert.equal(task.date, current.today);
  assert.equal(task.schedule, "");

  // Inbox count and inline project assignment use the same task store.
  await addTask(frame, "Core inbox assignment check @today");
  current = await snapshot(frame);
  const inboxTask = current.tasks.find(
    (item) => item.title === "Core inbox assignment check",
  );
  assert(inboxTask && !inboxTask.project);
  await choose(frame, "inbox");
  const inboxButton = frame.locator('.nav-item[data-show="inbox"]');
  await inboxButton.waitFor({ state: "attached" });
  const pendingInboxCount = current.tasks.filter(
    (item) => !item.project && !item.done,
  ).length;
  assert.match(
    await inboxButton.getAttribute("aria-label"),
    new RegExp(pendingInboxCount + " tasks to organize"),
  );
  await frame
    .locator(`[data-row="${inboxTask.id}"] [data-inline="project"]`)
    .click();
  await frame.locator("#inline-value-search").fill("Product");
  await frame.locator("#inline-value-search").press("Enter");
  await frame.locator("#apply-inline").click();
  await frame
    .locator(`[data-row="${inboxTask.id}"]`)
    .waitFor({ state: "detached" });
  current = await snapshot(frame);
  assert.equal(
    current.tasks.find((item) => item.id === inboxTask.id).project,
    "Product launch",
  );

  // Local event and task placement share the calendar and produce a visible conflict.
  await choose(frame, "calendar-new-event");
  await frame.locator("#event-title").fill("Core flow booked event");
  await frame.locator('[name="event-date"]').fill(current.today);
  await frame.locator('[name="event-start"]').fill("10:30");
  await frame.locator('[name="event-end"]').fill("11:15");
  await frame.locator("#drawer-save").click();
  await frame.locator("#drawer").waitFor({ state: "hidden" });
  current = await snapshot(frame);
  const booked = current.events.find(
    (item) => item.title === "Core flow booked event",
  );
  assert(booked && booked.owned);

  await choose(frame, "plan");
  await frame.locator(`[data-row="${task.id}"] .task-name`).click();
  await frame.locator('[name="schedule-time"]').fill("10:45");
  await frame.locator("#detail-repeat").selectOption({ label: "Every week" });
  await frame.locator("#drawer-save").click();
  await frame.locator("#drawer").waitFor({ state: "hidden" });
  await frame
    .locator(`[data-calendar-task="${task.id}"].has-conflict`)
    .waitFor();
  await frame.getByText("Core flow booked event").waitFor();
  const pending = await frame
    .locator(".plan-pending-section")
    .allTextContents();
  assert(
    !pending.some(
      (section) =>
        section.includes("Unplanned") && section.includes("Core flow task"),
    ),
  );
  current = await snapshot(frame);
  const scheduled = current.tasks.find((item) => item.id === task.id);
  assert.equal(scheduled.schedule, "10:45");
  assert.equal(scheduled.repeat, "Every week");

  // Starting is available from Track only; the header timer survives navigation and pause/resume.
  await choose(frame, "track");
  const trackRow = frame.locator(`[data-row="${task.id}"]`);
  await trackRow.waitFor();
  await trackRow.hover();
  await trackRow.locator(`[data-start="${task.id}"]`).click();
  await frame.locator("#global-tracker").waitFor();
  await choose(frame, "inbox");
  await frame.locator("#global-tracker").waitFor();
  await frame.locator("#header-pause").click();
  await page.waitForTimeout(900);
  await frame.locator("#header-pause").click();
  // Both clock surfaces have exactly one monotonic writer (regression for flickering seconds).
  const values = [];
  for (let i = 0; i < 16; i++) {
    values.push(await frame.locator("#header-clock").textContent());
    assert.match(values.at(-1), /^\d{2,}:\d{2}$/);
    await page.waitForTimeout(100);
  }
  const seconds = (value) => {
    const parts = value.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  };
  for (let i = 1; i < values.length; i++)
    assert(
      seconds(values[i]) >= seconds(values[i - 1]),
      "timer seconds must never jump backwards",
    );
  assert(
    seconds(values.at(-1)) - seconds(values[0]) <= 2,
    "timer must not double increment",
  );
  await choose(frame, "plan");
  await frame
    .locator(`[data-calendar-task="${task.id}"][data-live-session]`)
    .waitFor();
  let live = await snapshot(frame);
  assert.equal(live.tasks.find((item) => item.id === task.id).date, live.today);
  await frame
    .locator(`[data-calendar-task="${task.id}"][data-live-session]`)
    .click();
  assert.equal(await frame.locator('[name="schedule"]').isDisabled(), true);
  assert.equal(
    await frame.locator('[name="schedule-time"]').isDisabled(),
    true,
  );
  await frame.locator("#close-drawer").click();
  assert.equal(await frame.locator(`[data-row="${task.id}"]`).count(), 0);
  await choose(frame, "track");
  await frame.locator("#finish-task").click();
  await frame.locator("#global-tracker").waitFor({ state: "hidden" });
  current = await snapshot(frame);
  const completed = current.tasks.find((item) => item.id === task.id);
  const actual = current.sessions.find(
    (item) => item.id === task.id && item.recorded,
  );
  assert(completed.done);
  assert(actual && actual.focusedSeconds >= 1);
  assert.equal(actual.estimate, 25);

  // Reports edit exact recorded totals and export the saved records locally.
  await choose(frame, "history");
  const reportRow = frame
    .locator(".report-entries tr[data-report-row]")
    .filter({ hasText: "Core flow task" });
  await reportRow.locator("[data-report-edit]").click();
  // Changing classification alone must preserve exact seconds, sub-minute spans and pause exclusions.
  await frame.locator("#entry-project-search").fill("Personal");
  await frame.locator("#entry-project-search").press("Enter");
  await frame.locator(".report-editor [data-save-entry]").click();
  await flush(frame);
  let classified = await snapshot(frame);
  assert.equal(
    classified.sessions.find((item) => item.sessionKey === actual.sessionKey)
      .focusedSeconds,
    actual.focusedSeconds,
  );
  assert.equal(
    classified.tasks.find((item) => item.id === task.id).project,
    "Personal",
  );
  const otherReportRow = frame
    .locator(".report-entries tr[data-report-row]")
    .filter({ hasText: "Read customer notes" });
  await otherReportRow.hover();
  await otherReportRow.locator("[data-report-edit]").click();
  assert.equal(
    await frame.locator("#entry-project").inputValue(),
    "Product launch",
    "editor state must not leak from another task",
  );
  await frame.locator("#cancel-entry").click();
  await reportRow.hover();
  await reportRow.locator("[data-report-edit]").click();
  assert.equal(await frame.locator("#entry-project").inputValue(), "Personal");
  await frame.locator('[name="entry-date"]').fill(current.today);
  await frame.locator('[name="entry-start"]').fill("12:00");
  await frame.locator('[name="entry-end"]').fill("12:02");
  await frame.locator(".report-editor [data-save-entry]").click();
  await frame
    .locator(".report-entries tr[data-report-row]")
    .filter({ hasText: "Core flow task" })
    .waitFor();
  await flush(frame);
  current = await snapshot(frame);
  const corrected = current.sessions.find(
    (item) => item.sessionKey === actual.sessionKey,
  );
  assert.equal(corrected.focusedSeconds, 120);
  assert.equal(
    current.tasks.find((item) => item.id === task.id).schedule,
    "12:00",
  );

  const downloadPromise = page.waitForEvent("download");
  await frame.getByRole("button", { name: "Export", exact: true }).click();
  await frame
    .getByRole("button", { name: "Download export", exact: true })
    .click();
  await Promise.race([
    downloadPromise.catch(() => null),
    page.waitForTimeout(500),
  ]);
  const exported = await frame
    .locator("body")
    .evaluate(() => window.CalmRuntime.lastExport());
  assert.equal(exported.format, "csv");
  assert(
    exported.data.includes("Core flow task") && exported.data.includes("120"),
  );

  // Create a project, then rename it through the shared project sidebar.
  await choose(frame, "projects");
  await frame.locator("#new-project").click();
  await frame.locator("#project-name").fill("Consistency project");
  await frame.locator("#project-notes").fill("Local project notes");
  await frame.locator("#drawer-save").click();
  await frame
    .getByRole("button", { name: "Consistency project", exact: true })
    .click();
  await frame.locator('#screen [data-show="project-settings"]').click();
  await frame.locator("#project-name").fill("Renamed project");
  await frame.locator("#drawer-save").click();
  await flush(frame);
  await addTask(frame, "Consistency task +renamed-project @today @16:00 t30m");
  let shared = await snapshot(frame);
  const consistentTask = shared.tasks.find(
    (item) => item.title === "Consistency task",
  );
  assert.equal(consistentTask.project, "Renamed project");
  assert.equal(consistentTask.schedule, "16:00");
  await choose(frame, "projects");
  await frame
    .getByRole("button", { name: "Renamed project", exact: true })
    .click();
  await frame.locator(`[data-row="${consistentTask.id}"]`).hover();
  await frame.locator(`.task-row [data-detail="${consistentTask.id}"]`).click();
  assert.equal(
    await frame.getByText("Links & files", { exact: true }).count(),
    0,
  );
  await frame.getByRole("button", { name: "Next week", exact: true }).click();
  const nextWeek = await frame.locator('[name="schedule"]').inputValue();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(nextWeek));
  assert(nextWeek > shared.today);
  await frame.locator('[data-detail-estimate="25"]').click();
  await frame.locator("#detail-repeat").selectOption("Custom weekly");
  await frame.locator('[data-repeat-day="1"]').check();
  await frame.locator('[data-repeat-day="4"]').check();
  await frame.locator("#detail-title").fill("Shared task edited");
  await frame.locator("#detail-title").press("Control+Enter");
  await flush(frame);
  shared = await snapshot(frame);
  assert.equal(
    shared.tasks.find((item) => item.id === consistentTask.id).date,
    nextWeek,
  );
  assert.equal(
    shared.tasks.find((item) => item.id === consistentTask.id).estimate,
    25,
  );
  assert(
    shared.tasks
      .find((item) => item.id === consistentTask.id)
      .repeatRule.weekdays.includes(1),
  );
  await choose(frame, "plan");
  await frame
    .locator(`[data-row="${consistentTask.id}"]`)
    .waitFor({ state: "detached" });
  await frame.locator('[data-calendar-nav="next"]').click();
  await frame.locator(`[data-calendar-task="${consistentTask.id}"]`).waitFor();
  await choose(frame, "track");
  await frame
    .locator(".collapsed-section")
    .filter({ has: frame.locator("summary", { hasText: "Later" }) })
    .locator("summary")
    .click();
  await frame.locator(`[data-row="${consistentTask.id}"]`).hover();
  await frame.locator(`.task-row [data-detail="${consistentTask.id}"]`).click();
  assert.equal(
    await frame.locator("#detail-title").inputValue(),
    "Shared task edited",
  );
  await frame.locator("#delete-task").click();
  // A repeating task asks whether to skip one or delete the series.
  await frame.locator('#series-scope-dialog input[value="series"]').check();
  await frame.locator("#confirm-series-scope").click();
  await flush(frame);
  assert(
    !(await snapshot(frame)).tasks.some(
      (item) => item.id === consistentTask.id,
    ),
  );
  // Deleting a task also removes its recorded sessions and calendar history.
  await choose(frame, "plan");
  await frame.locator('[data-calendar-task="notes"].actual-block').click();
  await frame.locator("#delete-task").click();
  await frame.locator("#confirm-delete-task").click();
  await flush(frame);
  assert(!(await snapshot(frame)).sessions.some((item) => item.id === "notes"));
  assert.equal(await frame.locator('[data-calendar-task="notes"]').count(), 0);
  // Preset capture values survive a full quit/relaunch, then clear after submission.
  await frame.locator("#global-add").click();
  await frame.locator("#add-title").fill("Unfinished capture");
  await frame.locator('[data-add-field="project"]').click();
  await frame.locator("#add-field-value-search").fill("Renamed");
  await frame.locator("#add-field-value-search").press("Enter");
  await frame.locator('[data-add-field="schedule"]').click();
  await frame.locator("#add-field-value").fill("tomorrow");
  await frame.locator("#add-field-value").press("Enter");
  await frame.locator('[data-add-field="estimate"]').click();
  await frame.locator("#add-field-value").fill("25");
  await frame.locator("#add-field-value").press("Enter");
  await frame.locator("#close-add").click();

  // Quitting and relaunching offline preserves task, event, exact session and estimate.
  await choose(frame, "track");
  await frame.locator(`[data-row="${inboxTask.id}"]`).hover();
  await frame
    .locator(`[data-row="${inboxTask.id}"] [data-start="${inboxTask.id}"]`)
    .click();
  await page.waitForTimeout(1300);
  await flush(frame);
  const beforeRestart = await snapshot(frame);
  assert.equal(beforeRestart.clock.active, inboxTask.id);
  assert.equal(beforeRestart.clock.running, true);
  await quitDesktop();
  ({ page, frame } = await launch());
  const afterRestart = await snapshot(frame);
  const reopenedTask = afterRestart.tasks.find((item) => item.id === task.id);
  const priorTask = beforeRestart.tasks.find((item) => item.id === task.id);
  for (const key of [
    "title",
    "project",
    "date",
    "schedule",
    "estimate",
    "done",
    "repeat",
    "notes",
  ])
    assert.equal(
      reopenedTask[key],
      priorTask[key],
      key + " should survive restart",
    );
  assert.deepEqual(reopenedTask.actual, priorTask.actual);
  assert.deepEqual(
    afterRestart.sessions.find(
      (item) => item.sessionKey === corrected.sessionKey,
    ),
    corrected,
  );
  assert(afterRestart.events.some((item) => item.id === booked.id));
  assert.equal(
    afterRestart.tasks.find((item) => item.id === task.id).nativeDays[
      afterRestart.today
    ],
    120000,
  );
  assert.equal(
    afterRestart.tasks.find((item) => item.id === task.id).estimate,
    25,
  );
  assert.equal(
    afterRestart.tasks.find((item) => item.id === task.id).repeat,
    "Every week",
  );
  assert.equal(afterRestart.clock.active, inboxTask.id);
  assert.equal(afterRestart.clock.running, false);
  assert(afterRestart.clock.elapsedMs >= 1000);
  assert(
    !afterRestart.tasks.some((item) => item.id === consistentTask.id),
    "deleted task must not resurrect",
  );
  assert(!afterRestart.sessions.some((item) => item.id === "notes"));
  assert(afterRestart.projects.includes("Renamed project"));
  assert(!afterRestart.projects.includes("Consistency project"));
  await choose(frame, "projects");
  await frame
    .getByRole("button", { name: "Renamed project", exact: true })
    .click();
  await frame
    .getByRole("button", { name: "Project details", exact: true })
    .click();
  assert.equal(
    await frame.locator("#project-notes").inputValue(),
    "Local project notes",
  );
  await frame.locator("#close-drawer").click();
  await frame.locator("#global-add").click();
  assert.equal(
    await frame.locator("#add-title").inputValue(),
    "Unfinished capture",
  );
  assert.equal(
    await frame.locator("#add-project-label").textContent(),
    "Renamed project",
  );
  assert.equal(
    await frame.locator("#add-schedule-label").textContent(),
    "Tomorrow",
  );
  assert.equal(
    await frame.locator("#add-estimate-label").textContent(),
    "25 min",
  );
  await frame.locator('#add-form button[type="submit"]').click();
  await frame.locator("#global-add").click();
  assert.equal(await frame.locator("#add-title").inputValue(), "");
  assert.equal(
    await frame.locator("#add-estimate-label").textContent(),
    "Estimate",
  );
  await frame.locator("#close-add").click();
  // Editing a restored actual session updates Plan after JSON transport.
  await choose(frame, "history");
  await frame
    .locator(".report-entries tr[data-report-row]")
    .filter({ hasText: "Core flow task" })
    .locator("[data-report-edit]")
    .click();
  await frame.locator('[name="entry-start"]').fill("13:00");
  await frame.locator('[name="entry-end"]').fill("13:03");
  await frame.locator(".report-editor [data-save-entry]").click();
  await flush(frame);
  const reedited = await snapshot(frame);
  assert.equal(
    reedited.tasks.find((item) => item.id === task.id).schedule,
    "13:00",
  );
  assert.equal(
    reedited.tasks.find((item) => item.id === task.id).actual.focusedSeconds,
    180,
  );
  await choose(frame, "plan");
  await frame
    .locator(`[data-calendar-task="${task.id}"].actual-block`)
    .waitFor();
  assert.equal(
    await frame.locator(".calendar-header .current-day strong").textContent(),
    String(new Date(reedited.today + "T12:00:00").getDate()),
  );
  await frame
    .locator(`[data-calendar-task="${task.id}"].actual-block`)
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(root, "output/core-consistency-plan.png"),
  });
  assert.equal(
    await page.locator("mat-snack-bar-container").count(),
    0,
    "native success toasts must not duplicate renderer feedback",
  );
  assert.deepEqual(errors, []);

  console.log(
    "PASS: offline shared task/project identities, searchable capture/details, draft recovery, real Plan/events, live actual intervals, monotonic timer, recurrence, permanent deletion, report edits after restart, export and full persistence.",
  );
  if (resourceFailures.length)
    console.log(
      "Offline resource requests: " + JSON.stringify(resourceFailures),
    );
  console.log("Synthetic Electron profile: " + profile);
  await quitDesktop();
  app = null;
})().catch(async (error) => {
  console.error(error);
  if (app) await quitDesktop().catch(() => app?.process().kill());
  process.exitCode = 1;
});
