#!/usr/bin/env node
const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const output = path.resolve(__dirname, "../output/calendar-usability");
  fs.mkdirSync(output, { recursive: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 820 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"),
    );
    await page.evaluate(() => {
      state.showSleepHours = true;
      state.active = null;
      state.liveSession = null;
      state.running = false;
      state.nowMinute = 630.5;
      projects.splice(0, projects.length, "Alpha");
      tasks.splice(
        0,
        tasks.length,
        {
          id: "trace",
          title: "Brief check",
          project: "Alpha",
          date: calmToday(),
          schedule: "08:00",
          done: true,
          estimate: 30,
        },
        {
          id: "short",
          title: "Five minute review",
          project: "Alpha",
          date: calmToday(),
          schedule: "08:15",
          done: true,
          estimate: 30,
        },
        {
          id: "long",
          title: "Deep work",
          project: "Alpha",
          date: calmToday(),
          schedule: "09:00",
          done: false,
          estimate: 60,
        },
        {
          id: "drag",
          title: "Place me early",
          project: "Alpha",
          date: "",
          schedule: "",
          done: false,
          estimate: 30,
        },
      );
      state.sessions = [
        {
          id: "trace",
          title: "Brief check",
          project: "Alpha",
          date: calmToday(),
          startMinute: 480,
          endMinute: 480.1,
          start: "08:00",
          end: "08:00",
          duration: 0.1,
          focusedSeconds: 6,
        },
        {
          id: "short",
          title: "Five minute review",
          project: "Alpha",
          date: calmToday(),
          startMinute: 495,
          endMinute: 500,
          start: "08:15",
          end: "08:20",
          duration: 5,
          focusedSeconds: 300,
        },
      ];
      state.localEvents = [
        {
          id: "event",
          title: "Move this local event",
          date: calmToday(),
          start: "13:00",
          end: "13:30",
          owned: true,
          calendar: "Local calendar",
        },
      ];
      show("plan");
      document.querySelector(".calendar-wrap").scrollTop = calendarY(420);
    });
    const fit = await page.evaluate(() => {
      const w = document.querySelector(".calendar-wrap");
      return (
        (w.clientHeight - w.querySelector(".calendar-header").offsetHeight) /
        calendarHourHeight()
      );
    });
    assert(Math.abs(fit - 8) < 0.05, "default viewport must fit eight hours");
    assert.equal(await page.locator(".calendar-now").count(), 1);
    const y = await page
      .locator(".calendar-now")
      .evaluate((el) => parseFloat(el.style.top));
    await page.evaluate(() => {
      state.nowMinute += 1;
      updateCalendarNow();
    });
    assert(
      (await page
        .locator(".calendar-now")
        .evaluate((el) => parseFloat(el.style.top))) > y,
    );
    const trace = page.locator('[data-calendar-task="trace"]'),
      short = page.locator('[data-calendar-task="short"]');
    assert.equal(await trace.evaluate((el) => parseFloat(el.style.height)), 6);
    assert.equal(await trace.locator("strong").isVisible(), false);
    assert.equal(await short.evaluate((el) => parseFloat(el.style.height)), 14);
    assert.equal(await short.locator("strong").isVisible(), false);
    await trace.hover();
    assert.match(
      await page.locator("#calendar-tooltip").textContent(),
      /Brief check.*0m 6s tracked/,
    );
    await short.focus();
    assert.match(
      await page.locator("#calendar-tooltip").textContent(),
      /Five minute review.*5m tracked/,
    );
    await page.screenshot({ path: path.join(output, "compact-calendar.png") });
    const before = await page.evaluate(
      () =>
        document.querySelector(".calendar-wrap").scrollTop /
        calendarHourHeight(),
    );
    await page.setViewportSize({ width: 1440, height: 680 });
    await page.waitForTimeout(100);
    const after = await page.evaluate(
      () =>
        document.querySelector(".calendar-wrap").scrollTop /
        calendarHourHeight(),
    );
    assert(Math.abs(before - after) < 0.1, "resize preserves the viewed time");
    const wrap = page.locator(".calendar-wrap");
    let rect = await wrap.boundingBox();
    // Trusted mouse drag, held at the edge: keep scrolling even without pointer movement.
    await page.locator('[data-row="drag"]').scrollIntoViewIfNeeded();
    const source = await page.locator('[data-row="drag"]').boundingBox();
    await page.mouse.move(source.x + 30, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + 45, source.y + source.height / 2, {
      steps: 5,
    });
    const first = await page.locator(".day-column").first().boundingBox();
    await page.mouse.move(first.x + first.width / 2, rect.y + rect.height - 4, {
      steps: 12,
    });
    const downStart = await wrap.evaluate((w) => w.scrollTop);
    await page.waitForTimeout(650);
    assert(
      (await wrap.evaluate((w) => w.scrollTop)) > downStart + 80,
      "bottom edge scrolls while task is held",
    );
    let headerHeight = await page
      .locator(".calendar-header")
      .evaluate((el) => el.offsetHeight);
    await page.mouse.move(
      first.x + first.width / 2,
      rect.y + headerHeight + 2,
      { steps: 8 },
    );
    await page.waitForTimeout(1400);
    assert(
      (await wrap.evaluate((w) => w.scrollTop)) < 5,
      "upper edge can reach midnight",
    );
    const hh = await page.evaluate(() => calendarHourHeight());
    await page.mouse.move(
      first.x + first.width / 2,
      rect.y + headerHeight + hh / 4,
      { steps: 5 },
    );
    await page.mouse.up();
    assert.equal(await page.evaluate(() => getTask("drag").schedule), "00:15");
    assert.equal(await page.locator(".calendar-selected").count(), 0);
    // Local event movement preserves duration; read-only events cannot be dragged.
    await wrap.evaluate((w, hh) => (w.scrollTop = hh * 12), hh);
    await page.locator('[data-event="event"]').scrollIntoViewIfNeeded();
    const eventBox = await page.locator('[data-event="event"]').boundingBox();
    rect = await wrap.boundingBox();
    await page.mouse.move(
      eventBox.x + eventBox.width / 2,
      eventBox.y + eventBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      eventBox.x + eventBox.width / 2 + 12,
      eventBox.y + eventBox.height / 2,
      { steps: 5 },
    );
    await page.mouse.move(rect.x + rect.width - 4, rect.y + headerHeight + 50, {
      steps: 10,
    });
    const leftStart = await wrap.evaluate((w) => w.scrollLeft);
    await page.waitForTimeout(500);
    assert(
      (await wrap.evaluate((w) => w.scrollLeft)) > leftStart + 60,
      "horizontal edge scrolling stays available",
    );
    await page.mouse.move(rect.x + 63, rect.y + headerHeight + 2, {
      steps: 10,
    });
    await page.waitForTimeout(1400);
    await page.mouse.move(rect.x + 100, rect.y + headerHeight + hh / 2, {
      steps: 5,
    });
    await page.mouse.up();
    const moved = await page.evaluate(() =>
      state.localEvents.find((e) => e.id === "event"),
    );
    assert.equal(moved.start, "00:15");
    assert.equal(moved.end, "00:45");
    assert.equal(await page.locator(".calendar-selected").count(), 0);
    await page.locator('[data-calendar-mode="day"]').click();
    await page.locator('[data-calendar-nav="next"]').click();
    assert.equal(await page.locator(".calendar-now").count(), 0);
    await page.locator('[data-calendar-nav="today"]').click();
    assert.equal(await page.locator(".calendar-now").count(), 1);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: eight-hour fit, resize anchor, live today line, tiny/short hidden-label blocks and hover/focus details, real task/event edge-scroll dragging to midnight/early morning, horizontal drag scrolling, preserved event duration and phone containment.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
