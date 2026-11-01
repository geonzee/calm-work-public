// Planned time stays on the day, tracking replaces it, and the task list can return.
const { chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"));
    const planned = await page.evaluate(() => {
      tasks.splice(0, tasks.length, {
        id: "plan",
        title: "Only planned",
        project: "Personal",
        date: calmToday(),
        schedule: "10:00",
        estimate: 60,
        done: false,
      });
      state.sessions = [];
      state.active = null;
      state.liveSession = null;
      state.running = false;
      show("plan");
      const blocks = () =>
        dayBlocks(calmDayIndex(calmToday()))
          .filter((block) => block.id === "plan")
          .map((block) => ({ start: block.start, end: block.end, kind: block.kind }));
      const before = blocks();
      const task = getTask("plan");
      task.done = true;
      adoptPlannedTime(task);
      renderScreen();
      return {
        before,
        after: blocks(),
        label: taskTimeLabel(task),
        source: state.sessions.find((session) => session.id === "plan")?.source,
      };
    });
    assert.deepEqual(planned.before, [{ start: 600, end: 660, kind: "task" }]);
    assert.deepEqual(planned.after, [{ start: 600, end: 660, kind: "actual" }]);
    assert.equal(planned.label.label, "Planned");
    assert.equal(planned.label.minutes, 60);
    assert.equal(planned.source, "plan");

    const tracked = await page.evaluate(() => {
      tasks.push({
        id: "track",
        title: "Tracked",
        project: "Personal",
        date: calmToday(),
        schedule: "14:00",
        estimate: 45,
        done: false,
      });
      state.view = "track";
      state.active = null;
      startTask("track");
      state.seconds = 600;
      state.sessionStartMinute = 15 * 60;
      state.nowMinute = 15 * 60 + 10;
      recordSession();
      state.active = null;
      state.running = false;
      state.liveSession = null;
      show("plan");
      return {
        blocks: dayBlocks(calmDayIndex(calmToday()))
          .filter((block) => block.id === "track")
          .map((block) => ({ start: block.start, end: block.end, kind: block.kind })),
        listed: planningStatus(getTask("track")),
        schedule: getTask("track").schedule,
      };
    });
    assert.deepEqual(tracked.blocks, [{ start: 900, end: 910, kind: "actual" }]);
    assert.equal(tracked.listed, null);
    assert.equal(tracked.schedule, "14:00");

    const resized = await page.evaluate(() => {
      const task = getTask("plan");
      task.done = false;
      dropPlannedSessions(task);
      task.planMinutes = 90;
      task.estimate = 60;
      task.schedule = "10:00";
      const block = dayBlocks(calmDayIndex(calmToday())).find((item) => item.id === "plan");
      return block.end - block.start;
    });
    assert.equal(resized, 90);

    await page.evaluate(() => {
      state.showPlanTasks = false;
      renderScreen();
    });
    assert.equal(await page.locator(".plan-tasks").count(), 0);
    await page.locator("#toggle-plan-tasks").click();
    assert.equal(await page.locator(".plan-tasks").count(), 1);
    assert.deepEqual(errors, []);
    console.log("PASS: planned time stays, tracking replaces it, task list can return");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
