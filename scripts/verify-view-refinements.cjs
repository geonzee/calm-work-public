#!/usr/bin/env node
const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const output = path.resolve(__dirname, "../output/view-refinements");
  fs.mkdirSync(output, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(
      "file://" +
        path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html") +
        "?reference=1",
    );
    await page.evaluate(() => {
      projects.splice(0, projects.length, "Alpha", "Beta");
      tasks.splice(
        0,
        tasks.length,
        {
          id: "a",
          title: "Alpha work",
          project: "Alpha",
          date: calmToday(),
          schedule: "09:00",
          estimate: 60,
          done: false,
        },
        {
          id: "b",
          title: "Next commitment",
          project: "Beta",
          date: calmToday(),
          schedule: "10:15",
          estimate: 20,
          done: false,
        },
        {
          id: "c",
          title: "Unplanned board task",
          project: "Alpha",
          date: "",
          schedule: "",
          estimate: 25,
          done: false,
        },
      );
      state.active = null;
      state.running = false;
      state.nowMinute = 600;
      state.sessions = [
        {
          id: "a",
          title: "Alpha work",
          project: "Alpha",
          date: "2026-10-13",
          start: "10:00",
          end: "10:30",
          duration: 30,
          focusedSeconds: 1800,
          estimate: 60,
        },
        {
          id: "a",
          title: "Alpha work",
          project: "Alpha",
          date: "2026-10-14",
          start: "23:45",
          end: "00:15",
          duration: 30,
          focusedSeconds: 1800,
          estimate: 60,
          dailyMs: { "2026-10-14": 900000, "2026-10-15": 900000 },
        },
        {
          id: "b",
          title: "Next commitment",
          project: "Beta",
          date: "2026-10-14",
          start: "09:00",
          end: "09:25",
          duration: 25,
          focusedSeconds: 1500,
          estimate: 20,
        },
      ];
      // This section verifies task sessions; event totals have their own fixture.
      window.savedSampleCalendarEvents = sampleCalendarEvents;
      sampleCalendarEvents = () => ({});
      state.reportFrom = "";
      state.reportTo = "2026-10-15";
      show("reports");
    });
    assert.deepEqual(
      await page.evaluate(() => ({
        total: reportSummary().total,
        estimate: reportSummary().estimate,
      })),
      { total: 85, estimate: 80 },
    );
    assert.equal(
      await page.locator(".report-totals strong").first().textContent(),
      "1h 25m",
    );
    assert.deepEqual(
      await page.evaluate(() => ({
        under: reportDuration(59),
        hour: reportDuration(60),
        hourRest: reportDuration(90),
        day: reportDuration(24 * 60),
        dayRest: reportDuration(26 * 60),
        month: reportDuration(30 * 24 * 60),
        year: reportDuration(12 * 30 * 24 * 60),
        yearRest: reportDuration(13 * 30 * 24 * 60),
      })),
      {
        under: "59m",
        hour: "1h",
        hourRest: "1h 30m",
        day: "1d",
        dayRest: "1d 2h",
        month: "1mo",
        year: "1y",
        yearRest: "1y 1mo",
      },
    );
    assert.equal(await page.locator(".daily-report-row").count(), 3);
    await page.locator("#report-group").selectOption("day");
    assert.equal(await page.locator("#screen tbody tr").count(), 3);
    assert.equal(
      await page.evaluate(() =>
        reportSummary().groups.reduce((n, g) => n + g.estimate, 0),
      ),
      80,
    );
    await page.locator("#report-project").selectOption("Alpha");
    await page.locator("#report-from").fill("2026-10-14");
    await page.locator("#report-from").press("Tab");
    await page.locator("#report-to").fill("2026-10-14");
    await page.locator("#report-to").press("Tab");
    assert.equal(
      await page.evaluate(() => reportSummary().total),
      15,
      "daily range clips overnight focused time",
    );
    assert.equal(
      await page.locator(".report-totals strong").first().textContent(),
      "15m",
    );
    await page
      .getByRole("button", { name: "Time entries", exact: true })
      .click();
    assert.equal(await page.locator("#screen tbody tr").count(), 1);
    await page.getByRole("button", { name: "Export", exact: true }).click();
    assert.match(
      await page.locator("#drawer-content").textContent(),
      /1 entries matching/,
    );
    assert.equal(
      await page.locator("#drawer-content input[type=checkbox]").count(),
      0,
    );
    await page.locator("#close-drawer").click();
    await page.locator("#report-from").fill("2026-10-15");
    await page.locator("#report-from").press("Tab");
    assert.match(
      await page.locator("#screen .empty").textContent(),
      /end date/,
    );
    await page.getByRole("button", { name: "All time", exact: true }).click();
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await page.screenshot({ path: path.join(output, "reports-filtered.png") });
    await page.evaluate(() => { sampleCalendarEvents = window.savedSampleCalendarEvents; });
    await page.evaluate(() => {
      show("track");
      state.active = null;
      state.running = false;
      renderScreen();
    });
    await page.locator('[data-row="a"]').hover();
    await page.locator('[data-start="a"]').click();
    assert.equal(await page.locator(".commitment").isVisible(), true);
    assert.match(
      await page.locator(".commitment").textContent(),
      /Next commitment/,
    );
    assert.equal(await page.evaluate(() => nextCommitment().inMinutes), 15);
    await page.locator("#pause-timer").click();
    assert.equal(await page.locator(".commitment").isVisible(), true);
    await page.screenshot({ path: path.join(output, "active-track.png") });
    await page.evaluate(() => {
      state.active = null;
      state.running = false;
      state.projectName = "Alpha";
      show("project-board");
    });
    await page
      .locator('[data-row="c"]')
      .dragTo(page.locator('[data-board-target="planned"]'));
    assert.equal(await page.evaluate(() => getTask("c").date), "2026-10-14");
    await page
      .locator('[data-row="c"]')
      .dragTo(page.locator('[data-board-target="done"]'));
    assert.equal(await page.evaluate(() => getTask("c").done), true);
    assert.equal(
      await page.locator('[data-row="c"]').getAttribute("draggable"),
      "true",
    );
    await page
      .locator('[data-row="c"]')
      .dragTo(page.locator('[data-board-target="unplanned"]'));
    assert.deepEqual(
      await page.evaluate(() => ({
        done: getTask("c").done,
        date: getTask("c").date,
      })),
      { done: false, date: "" },
    );
    await page.locator('[data-row="c"]').focus();
    await page.keyboard.press("Alt+ArrowRight");
    assert.equal(await page.evaluate(() => getTask("c").date), "2026-10-14");
    await page.screenshot({ path: path.join(output, "board-drag.png") });
    await page.evaluate(() => show("plan"));
    const initial = await page.evaluate(() => {
      const wrap = document.querySelector(".calendar-wrap"),
        columns = [...document.querySelectorAll(".day-column")];
      return {
        first: calmWeekDate(Number(columns[0].dataset.day)),
        today: calmToday(),
        pan: wrap.scrollLeft,
        ratio:
          columns[0].getBoundingClientRect().width /
          columns[1].getBoundingClientRect().width,
      };
    });
    assert.equal(initial.first, initial.today);
    assert.equal(initial.pan, 0);
    assert(initial.ratio > 1.1 && initial.ratio < 1.2);
    const header = await page.locator(".calendar-header").boundingBox();
    await page.mouse.move(header.x + 450, header.y + 25);
    await page.mouse.down();
    await page.mouse.move(header.x + 150, header.y + 25, { steps: 12 });
    await page.mouse.up();
    assert(
      (await page.locator(".calendar-wrap").evaluate((w) => w.scrollLeft)) >
        200,
    );
    await page.getByRole("button", { name: "Today", exact: true }).click();
    assert.equal(
      await page.locator(".calendar-wrap").evaluate((w) => w.scrollLeft),
      0,
    );
    await page.evaluate(() => {
      const task = getTask("c");
      task.date = calmDateAfter(9);
      task.schedule = "10:00";
      renderScreen();
    });
    await page.locator('[data-calendar-task="c"]').scrollIntoViewIfNeeded();
    await page.locator('[data-calendar-task="c"]').click();
    assert.equal(
      await page.locator('[name="schedule"]').inputValue(),
      "2026-10-23",
    );
    await page.locator("#close-drawer").click();
    await page.evaluate(() => {
      const wrap = document.querySelector(".calendar-wrap");
      wrap.scrollLeft = wrap.scrollWidth;
    });
    await page.waitForFunction(() => state.calendarSpan > 28);
    await page.evaluate(() => {
      show("projects");
      show("plan");
    });
    assert.equal(
      await page.locator(".calendar-wrap").evaluate((w) => w.scrollLeft),
      0,
    );
    await page.screenshot({ path: path.join(output, "calendar-today.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => show("reports"));
    const width = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert(width.body <= width.viewport);
    await page.screenshot({ path: path.join(output, "phone-reports.png") });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: report date/project/day grouping and overnight totals; honest filtered export; active next commitment; pointer and keyboard board moves; today-first wider calendar, header pan, future dates, horizon extension and reset; phone layout.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
