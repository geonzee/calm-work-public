#!/usr/bin/env node
const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const artifacts = path.resolve(__dirname, "../output/consistency-review");
  fs.mkdirSync(artifacts, { recursive: true });
  const errors = [];
  try {
    for (const timezoneId of [
      "Asia/Hong_Kong",
      "America/Los_Angeles",
      "Pacific/Auckland",
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        timezoneId,
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: Date.parse("2026-10-15T13:00:00Z") });
      await page.goto(
        "file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"),
      );
      const dates = await page.evaluate(() => {
        show("plan");
        return {
          today: calmToday(),
          actual: calmDateString(new Date()),
          highlight: document.querySelector(".current-day strong")?.textContent,
          week: calmMonday(),
          index: calmTodayIndex(),
        };
      });
      assert.equal(dates.today, dates.actual);
      assert.equal(Number(dates.highlight), Number(dates.today.slice(-2)));
      assert(dates.week > dates.today);
      await page.locator('[data-calendar-mode="day"]').click();
      await page.locator('[data-calendar-nav="next"]').click();
      assert.equal(
        await page.locator(".calendar-header .current-day").count(),
        0,
      );
      await page.locator('[data-calendar-nav="today"]').click();
      assert.equal(
        await page.locator(".calendar-header .current-day").count(),
        1,
      );
      await page.evaluate(() => show("track"));
      const result = await page.evaluate(() => {
        tasks.splice(
          0,
          tasks.length,
          {
            id: "next",
            title: "Actual next task",
            project: "Work",
            date: calmToday(),
            schedule: "10:40",
            estimate: 25,
            done: false,
          },
          {
            id: "untimed",
            title: "Untimed",
            project: "Work",
            date: calmToday(),
            schedule: "",
            estimate: null,
            done: false,
          },
          {
            id: "early",
            title: "Earlier",
            project: "Work",
            date: calmToday(),
            schedule: "10:20",
            estimate: 15,
            done: false,
          },
        );
        projects.splice(0, projects.length, "Work");
        state.sessions = [];
        state.active = null;
        state.running = false;
        state.seconds = 0;
        state.nowMinute = 600;
        state.localEvents = [
          {
            id: "event-real",
            title: "Actual next event",
            date: calmToday(),
            start: "10:30",
            end: "11:00",
            calendar: "Local calendar",
            owned: true,
          },
        ];
        // Suppress the review fixture events to exercise the same real-data selector as the runtime.
        window.calmRuntimeMode = true;
        const order = liveToday().map((t) => t.id);
        const first = nextCommitment();
        tasks.find((t) => t.id === "early").done = true;
        const second = nextCommitment();
        state.localEvents = [];
        const third = nextCommitment();
        tasks.forEach((t) => (t.done = true));
        const none = nextCommitment();
        return {
          order,
          first,
          second,
          third,
          none,
          clocks: [clock(9.9), clock(10), clock(59.9), clock(60)],
        };
      });
      assert.deepEqual(result.order, ["early", "next", "untimed"]);
      assert.equal(result.first.title, "Earlier");
      assert.equal(result.first.inMinutes, 20);
      assert.equal(result.second.title, "Actual next event");
      assert.equal(result.second.inMinutes, 30);
      assert.equal(result.third.title, "Actual next task");
      assert.equal(result.none, null);
      assert.deepEqual(result.clocks, ["00:09", "00:10", "00:59", "01:00"]);
      await page.evaluate(() => {
        getTask("next").done = false;
        openTask("next");
      });
      await page
        .getByRole("button", { name: "Next week", exact: true })
        .click();
      assert.equal(
        await page.locator('[name="schedule"]').inputValue(),
        dates.week,
      );
      await page.locator('[data-detail-estimate="25"]').click();
      await page.locator("#detail-project-search").fill("Wo");
      await page.locator("#detail-project-search").press("Enter");
      await page.locator("#detail-title").press("Control+Enter");
      const edited = await page.evaluate(() => getTask("next"));
      assert.equal(edited.date, dates.week);
      assert.equal(edited.estimate, 25);
      assert.equal(edited.project, "Work");
      await page.evaluate(() => {
        tasks.find((t) => t.id === "untimed").done = false;
        state.picker = true;
        renderScreen();
      });
      await page.screenshot({
        path: path.join(
          artifacts,
          timezoneId.replaceAll("/", "-") + "-track.png",
        ),
      });
      // A short paused session may have the same displayed start/end minute.
      await page.evaluate(() => {
        const task = getTask("next"),
          session = {
            id: task.id,
            sessionKey: "short",
            title: task.title,
            project: task.project,
            date: calmToday(),
            start: "10:00",
            end: "10:00",
            startMinute: 600.1,
            endMinute: 600.6,
            focusedSeconds: 20,
            duration: 20 / 60,
            estimate: 25,
            recorded: true,
          };
        state.sessions = [session];
        task.actual = session;
        openSession(task.id);
      });
      await page
        .locator('[name="entry-date"]')
        .fill(await page.evaluate(() => calmTomorrow()));
      await page.locator("[data-save-entry]").click();
      const precise = await page.evaluate(() => state.sessions[0]);
      assert.equal(precise.focusedSeconds, 20);
      assert.equal(precise.startMinute, 600.1);
      assert.equal(precise.endMinute, 600.6);
      const spans = await page.evaluate(() => {
        const start = new Date(calmToday() + "T23:55:00"),
          end = new Date(start);
        end.setMinutes(end.getMinutes() + 10);
        return [
          sessionIntervalOnDate(
            { startTimestamp: start.getTime(), endTimestamp: end.getTime() },
            calmToday(),
          ),
          sessionIntervalOnDate(
            { startTimestamp: start.getTime(), endTimestamp: end.getTime() },
            calmTomorrow(),
          ),
        ];
      });
      assert.deepEqual(spans, [
        { start: 1435, end: 1440 },
        { start: 0, end: 5 },
      ]);
      // Layout stays inside the window; only the workspace/calendar should scroll.
      if (timezoneId === "Asia/Hong_Kong")
        for (const viewport of [
          { width: 1440, height: 1000 },
          { width: 620, height: 670 },
          { width: 390, height: 844 },
        ]) {
          await page.setViewportSize(viewport);
          await page.evaluate(() => {
            show("plan");
          });
          const layout = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            innerWidth,
            innerHeight,
            header: document
              .querySelector(".app-header")
              .getBoundingClientRect().top,
          }));
          assert(layout.width <= layout.innerWidth + 1);
          assert(layout.height <= layout.innerHeight + 1);
          assert(layout.header >= 0);
          await page.screenshot({
            path: path.join(artifacts, viewport.width + "-plan.png"),
          });
          await page.evaluate(() => openTask("next"));
          await page.screenshot({
            path: path.join(artifacts, viewport.width + "-details.png"),
          });
          await page.locator("#close-drawer").click();
        }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      "PASS: real next task/event and empty cue, sorted queue, second-digit rollovers, keyboard project/details, next-week preset, calendar day navigation in three time zones, and midnight interval splitting.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
