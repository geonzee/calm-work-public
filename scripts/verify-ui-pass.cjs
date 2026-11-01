#!/usr/bin/env node
const { chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"));
    await page.locator(".done-today").waitFor();
    assert.equal(await page.locator(".done-today").getAttribute("open"), null, "completed today starts collapsed");
    assert.equal(await page.locator("#page-indicator").count(), 0);
    assert.equal((await page.locator("#phone-add").innerText()).trim(), "Add");
    const menu = await page.locator("#mobile-menu button").allTextContents();
    assert.deepEqual(menu.map((text) => text.trim()), ["Track", "Clean", "Plan", "Projects", "Reports", "Settings"]);

    const prompted = await page.evaluate(() => {
      const task = getTask("supplier");
      task.estimate = null;
      task.planMinutes = null;
      state.sessions = state.sessions.filter((session) => session.id !== "supplier");
      document.querySelector('[data-complete="supplier"]').click();
      return { open: !$("time-overlay").hidden, done: task.done };
    });
    assert.equal(prompted.done, false, "completion waits for a time");
    assert.equal(prompted.open, true);
    await page.locator("#time-overlay-minutes").fill("25");
    await page.locator("#time-overlay-save").click();
    const saved = await page.evaluate(() => {
      const task = getTask("supplier");
      return { done: task.done, estimate: task.estimate, plan: task.planMinutes };
    });
    assert.deepEqual(saved, { done: true, estimate: 25, plan: 25 });

    const overview = await page.evaluate(() => {
      tasks.push({ id: "older", title: "Older finished task", project: "Personal", date: calmDateAfter(-3), schedule: "", estimate: 15, planMinutes: 15, done: true, today: false, notes: "" });
      tasks.push({ id: "open-untimed", title: "Open task with no time", project: "Personal", date: calmDateAfter(-2), schedule: "", estimate: 0, done: false, today: false, notes: "" });
      Object.assign(state, { reportProjects: null, reportProject: "all", reportFrom: "", reportTo: calmToday(), reportMode: "summary", reportGroup: "task", filter: "" });
      const before = reportSummary();
      show("reports");
      const row = (title) => [...document.querySelectorAll("#screen tbody tr")].find((tr) => tr.cells[0].textContent === title)?.innerText.split("\t").map((cell) => cell.trim());
      const result = { summary: before, older: row("Older finished task"), supplier: row(getTask("supplier").title) };
      state.reportMode = "entries";
      show("reports");
      result.entry = [...document.querySelectorAll("#screen tbody tr")].find((tr) => tr.cells[0].textContent === "Older finished task")?.innerText.split("\t").map((cell) => cell.trim());
      result.untimed = [...document.querySelectorAll("#screen tbody tr")].some((tr) => tr.cells[0].textContent === "Open task with no time");
      return result;
    });
    assert.deepEqual(overview.older.slice(1), ["—", "15m", "15m"], "older estimate-only task counts in Overview, not as recorded");
    assert.deepEqual(overview.supplier.slice(1), ["—", "25m", "25m"], "popup estimate counts in Overview, not as recorded");
    assert.equal(overview.summary.time, overview.summary.total + overview.summary.planned);
    assert.ok(overview.summary.planned >= 40);
    assert.deepEqual(overview.entry.slice(4, 6), ["—", "15m"], "time entries keep the estimate out of Recorded");
    assert.equal(overview.untimed, false, "open tasks with no time stay out of Time entries");

    const mixed = await page.evaluate(() => {
      const saved = { tasks: tasks.splice(0), sessions: state.sessions, events: sampleCalendarEvents, local: state.localEvents };
      tasks.push(
        { id: "both", title: "Tracked and estimated", project: "Mix", date: calmToday(), schedule: "", estimate: 30, planMinutes: 30, done: true },
        { id: "only", title: "Estimate only", project: "Mix", date: calmToday(), schedule: "", estimate: 15, planMinutes: 15, done: true },
      );
      state.sessions = [{ sessionKey: "both-1", id: "both", title: "Tracked and estimated", project: "Mix", date: calmToday(), start: "09:00", end: "09:10", startMinute: 540, endMinute: 550, duration: 10, focusedSeconds: 600, estimate: 30 }];
      sampleCalendarEvents = () => ({});
      state.localEvents = [];
      Object.assign(state, { reportProjects: null, reportProject: "all", reportFrom: "", reportTo: calmToday(), reportMode: "summary", reportGroup: "task", filter: "" });
      show("reports");
      const cells = (tr) => [...tr.cells].map((cell) => cell.textContent.trim());
      const rows = Object.fromEntries([...document.querySelectorAll("#screen tbody tr")].map((tr) => [tr.cells[0].textContent, cells(tr).slice(1)]));
      const footer = cells(document.querySelector("#screen tfoot tr")).slice(1);
      const headline = document.querySelector(".report-totals strong").textContent;
      state.reportGroup = "project";
      const project = reportSummary().groups.find((group) => group.title === "Mix");
      const byProject = project.duration + (project.planned || 0);
      tasks.splice(0, tasks.length, ...saved.tasks);
      Object.assign(state, { sessions: saved.sessions, localEvents: saved.local });
      sampleCalendarEvents = saved.events;
      return { rows, footer, headline, byProject };
    });
    assert.deepEqual(mixed.rows["Tracked and estimated"], ["10m", "—", "10m"], "recorded time wins over the estimate");
    assert.deepEqual(mixed.rows["Estimate only"], ["—", "15m", "15m"], "estimate used when nothing is recorded");
    assert.deepEqual(mixed.footer, ["10m", "15m", "25m"], "the total never adds a task's estimate to its recorded time");
    assert.equal(mixed.headline, "25m");
    assert.equal(mixed.byProject, 25, "grouping by project gives the same total");

    await page.evaluate(() => {
      state.reportProjects = null;
      state.reportProject = "all";
      state.reportFrom = "";
      state.reportTo = "";
      state.reportMode = "summary";
      show("reports");
    });
    assert.equal(await page.locator("th", { hasText: "Difference" }).count(), 0);
    assert.equal(await page.locator("#report-project").getAttribute("multiple"), "", "projects allow more than one");
    await page.locator("#report-project").selectOption(["Product launch"]);
    const filtered = await page.evaluate(() => reportSessions().every((session) => (session.project || "") === "Product launch") && state.reportProjects.includes("Product launch"));
    assert.equal(filtered, true);

    await page.evaluate(() => {
      state.extraTimeZones = ["America/New_York", "Europe/London", "Asia/Tokyo"];
      show("plan");
    });
    const axis = page.locator(".time-axis");
    const box = await axis.boundingBox();
    await page.mouse.move(box.x + 12, box.y + 40);
    await page.locator("#zone-tip").waitFor();
    const tip = await page.locator("#zone-tip").innerText();
    assert.match(tip, /New York/);
    assert.match(tip, /London/);
    assert.match(tip, /Tokyo/);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      document.body.dataset.phoneFocus = "true";
      show("track", { preserveSurface: true });
    });
    const actionsHidden = await page.locator(".task-picker .task-actions").first().evaluate((el) => getComputedStyle(el).display === "none");
    assert.equal(actionsHidden, true, "track icons are hidden on the phone");
    const swiped = await page.evaluate(() => {
      const host = document.querySelector('.swipe-host[data-can-track="1"]');
      const id = host.dataset.swipe;
      const down = { clientX: 220, clientY: 30, pointerId: 1, bubbles: true, button: 0 };
      host.dispatchEvent(new PointerEvent("pointerdown", down));
      host.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: 180 }));
      host.dispatchEvent(new PointerEvent("pointermove", { ...down, clientX: 80 }));
      const showing = host.classList.contains("show-track");
      host.dispatchEvent(new PointerEvent("pointerup", { ...down, clientX: 40 }));
      return { showing, active: state.active, id };
    });
    assert.equal(swiped.showing, true);
    assert.equal(swiped.active, swiped.id);

    const startTarget = await page.evaluate(() => {
      const task = tasks.find((item) => item.date === calmToday() && !item.done && item.id !== state.active);
      openTask(task.id);
      return task.id;
    });
    await page.locator("#detail-start").click();
    assert.equal(await page.evaluate(() => state.active), startTarget, "details can start tracking without a swipe");
    assert.equal(await page.locator("#drawer").isHidden(), true);
    await page.evaluate(() => openTask(state.active));
    assert.equal(await page.locator("#detail-start").count(), 0, "no start button for the running task");
    await page.evaluate(() => closeDrawer(false));

    await page.evaluate(() => show("plan", { preserveSurface: true }));
    assert.equal(await page.locator("#toggle-plan-tasks").count(), 0);
    assert.equal(await page.locator(".plan-tasks").count(), 0);
    assert.equal(await page.locator("body").getAttribute("data-portrait-view"), "false", "Plan does not ask for portrait");
    assert.equal(await page.locator(".day-shelf [data-calendar-task]").count(), 0, "no task chips above the phone calendar");
    await page.evaluate(() => show("modules", { preserveSurface: true }));
    const settings = await page.evaluate(() => ({
      calendar: getComputedStyle(document.querySelector("#calendar-section")).display,
      zones: getComputedStyle(document.querySelector("#timezone-section")).display,
      note: getComputedStyle(document.querySelector(".phone-settings-note")).display,
    }));
    assert.notEqual(settings.calendar, "none");
    assert.equal(settings.zones, "none");
    assert.equal(settings.note, "block");
    await page.evaluate(() => show("track", { preserveSurface: true }));
    assert.equal(await page.locator("body").getAttribute("data-portrait-view"), "false");
    assert.deepEqual(errors, []);
    console.log("PASS: completed today, swipe, time prompt, report projects, zone hover, phone plan and settings.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
