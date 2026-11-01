#!/usr/bin/env node
const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"),
    );
    await page.evaluate(() => {
      tasks.splice(
        0,
        tasks.length,
        {
          id: "active",
          title: "Active today",
          date: calmToday(),
          schedule: "10:00",
          project: "Alpha",
          estimate: 30,
          done: false,
        },
        {
          id: "today",
          title: "Another today",
          date: calmToday(),
          schedule: "",
          project: "Alpha",
          done: false,
        },
        {
          id: "done",
          title: "Completed today",
          date: calmToday(),
          schedule: "",
          project: "Alpha",
          done: true,
        },
        {
          id: "old",
          title: "Completed yesterday",
          date: calmDateAfter(-1),
          schedule: "",
          project: "Alpha",
          done: true,
        },
        {
          id: "future",
          title: "Tomorrow task",
          date: calmTomorrow(),
          schedule: "10:00",
          project: "Alpha",
          done: false,
        },
      );
      state.sessions = [];
      state.active = "active";
      state.running = true;
      state.seconds = 600;
      state.nowMinute = 610;
      state.sessionStartMinute = 600;
      show("track");
    });
    assert.match(
      await page.locator(".task-picker").textContent(),
      /2 remaining/,
    );
    assert.match(
      await page
        .locator(".collapsed-section summary")
        .allTextContents()
        .then((x) => x.join("|")),
      /Later.*Completed today/,
    );
    assert.equal(await page.locator(".later-tasks .task-row").count(), 1);
    assert.equal(await page.locator(".done-today .task-row").count(), 1);
    await page.evaluate(() => {
      show("plan");
      openTask("active");
    });
    await page.locator("#detail-title").fill("Draft title survives completion");
    await page.locator("#header-complete").click();
    assert.equal(await page.evaluate(() => getTask("active").done), true);
    assert.equal(await page.locator("#global-tracker").isVisible(), false);
    assert.equal(await page.locator("#detail-complete").isChecked(), true);
    assert.equal(
      await page.locator("#detail-title").inputValue(),
      "Draft title survives completion",
    );
    await page.locator("#drawer-save").click();
    assert.equal(
      await page.evaluate(() => getTask("active").done),
      true,
      "saving an open editor must not reopen a completed task",
    );
    assert.equal(
      await page.evaluate(
        () => state.sessions.filter((s) => s.id === "active").length,
      ),
      1,
    );
    await page.evaluate(() => show("track"));
    assert.match(
      await page.locator(".task-picker").textContent(),
      /1 remaining/,
    );
    assert.match(
      await page
        .locator(".collapsed-section summary")
        .allTextContents()
        .then((x) => x.join("|")),
      /Later.*Completed today/,
    );
    assert.equal(await page.locator(".later-tasks .task-row").count(), 1);
    assert.equal(await page.locator(".done-today .task-row").count(), 2);
    // Completing from a paused header has the same semantics.
    await page.evaluate(() => {
      startTask("today");
      state.running = false;
      state.seconds = 90;
      renderScreen();
      show("reports");
    });
    await page.locator("#header-complete").click();
    assert.equal(await page.evaluate(() => getTask("today").done), true);
    assert.equal(await page.evaluate(() => state.active), null);
    assert.deepEqual(errors, []);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      getTask("today").done = false;
      show("track");
      startTask("today");
    });
    assert.equal(await page.locator("#header-complete").isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => {
      state.active = null;
      state.running = false;
      getTask("active").done = true;
      state.sessions = [
        {
          id: "active",
          title: "First short session",
          date: calmToday(),
          start: "10:00",
          end: "10:01",
          duration: 1,
        },
        {
          id: "active",
          title: "Second short session",
          date: calmToday(),
          start: "10:01",
          end: "10:02",
          duration: 1,
        },
      ];
      show("plan");
    });
    const shortSessions = page.locator(
      '[data-calendar-task="active"].actual-block',
    );
    assert.equal(await shortSessions.count(), 2);
    for (let i = 0; i < 2; i++) {
      await shortSessions.nth(i).click();
      await page.locator("#close-drawer").click();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: header completes running/paused tasks from other views; preserves editor drafts without reopening; Today counts exclude other dates, Later remains separate; mobile containment.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
