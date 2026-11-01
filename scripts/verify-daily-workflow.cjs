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
  const output = path.resolve(__dirname, "../output/daily-workflow");
  fs.mkdirSync(output, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(
      "file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"),
    );
    await page.evaluate(() => {
      state.active = null;
      state.running = false;
      state.liveSession = null;
      projects.splice(0, projects.length, "Alpha", "Beta");
      const task = {
        id: "audit",
        title: "Recorded work",
        project: "Alpha",
        date: calmToday(),
        schedule: "10:00",
        estimate: 60,
        done: true,
      };
      const session = {
        id: task.id,
        title: task.title,
        project: task.project,
        date: calmToday(),
        start: "10:00",
        end: "10:12",
        duration: 12,
        focusedSeconds: 720,
        estimate: 60,
      };
      task.actual = session;
      tasks.splice(0, tasks.length, task, {
        id: "drag",
        title: "Unplanned work",
        project: "Beta",
        done: false,
        date: "",
        schedule: "",
        estimate: 30,
      });
      state.sessions = [session];
      state.localEvents = [];
      state.nowMinute = 500;
      show("plan");
    });
    const block = page.locator('[data-calendar-task="audit"]');
    assert.equal(await block.count(), 1);
    assert.match(await block.getAttribute("class"), /actual-block/);
    assert.match(await block.getAttribute("aria-label"), /12m tracked/);
    assert((await block.evaluate((el) => parseFloat(el.style.height))) >= 18);
    assert((await block.evaluate((el) => parseFloat(el.style.height))) < 24); // compact, no clipped text
    await block.click();
    await page.locator("#detail-complete").uncheck();
    await page.locator("#drawer-save").click();
    assert.equal(
      await page.locator('[data-calendar-task="audit"].actual-block').count(),
      1,
      "tracked time stays on Plan after reopening",
    );
    assert.equal(
      await page.evaluate(() => state.sessions.length),
      1,
      "reopening retains recorded history",
    );
    await page.locator('[data-calendar-task="audit"]').click();
    await page.locator("#detail-complete").check();
    await page.locator("#drawer-save").click();
    assert.equal(
      await page.locator('[data-calendar-task="audit"].actual-block').count(),
      1,
    );
    // Real dragover events across different columns must leave exactly one target.
    const columns = page.locator(".day-column");
    const transfer = await page.evaluateHandle(() => {
      const d = new DataTransfer();
      d.setData("text/plain", "drag");
      return d;
    });
    for (let i = 0; i < 3; i++) {
      await columns
        .nth(i)
        .dispatchEvent("dragover", { dataTransfer: transfer, clientY: 400 });
      assert.equal(await page.locator(".calendar-selected").count(), 1);
      assert.equal(await page.locator(".day-column.drop-over").count(), 1);
    }
    await columns
      .nth(2)
      .dispatchEvent("drop", { dataTransfer: transfer, clientY: 400 });
    assert.equal(
      await page.evaluate(() => getTask("drag").date),
      await page.evaluate(() =>
        calmWeekDate(
          Number(document.querySelectorAll(".day-column")[2].dataset.day),
        ),
      ),
    );
    await page.locator("body").dispatchEvent("dragend");
    assert.equal(await page.locator(".calendar-selected").count(), 0);
    await page.evaluate(() => {
      // Keep this task-only report fixture independent of calendar sample events.
      sampleCalendarEvents = () => ({});
      show("reports");
      state.reportFrom = "";
      state.reportTo = "";
      state.reportGroup = "project";
      renderScreen();
    });
    assert.match(await page.locator(".report-totals").textContent(), /12m/);
    assert.match(await page.locator(".daily-report").textContent(), /12m/);
    await page.screenshot({ path: path.join(output, "reports.png") });
    await page.locator("#report-project").selectOption("Beta");
    assert.match(await page.locator(".report-totals").textContent(), /0m/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#mobile-more").click();
    assert.equal(await page.locator("#mobile-menu").isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.activeElement.textContent),
      "Track",
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#mobile-menu").isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "mobile-more",
    );
    await page.locator("#mobile-more").click();
    await page.locator('#mobile-menu [data-show="track"]').count();
    await page.keyboard.press("Escape");
    await page.locator("#mobile-more").click();
    await page.locator('#mobile-menu [data-show="plan"]').click();
    assert.equal(await page.evaluate(() => state.view), "plan");
    await page.locator("#mobile-more").click();
    await page.screenshot({ path: path.join(output, "phone-more.png") });
    await page.keyboard.press("Escape");
    await page.locator("#global-add").click();
    assert.equal(
      await page
        .locator(".add-bar")
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      "none",
    );
    await page.screenshot({ path: path.join(output, "phone-capture.png") });
    await page.keyboard.press("Escape");
    // Exercise repeated view/editor/filter transitions and collect uncaught failures.
    await page.evaluate(() => {
      for (let i = 0; i < 100; i++) {
        show(["track", "inbox", "plan", "projects", "reports"][i % 5]);
        openTask("audit");
        closeDrawer();
      }
    });
    assert.deepEqual(errors, []);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    console.log(
      "PASS: completed/reopened calendar projections, retained history, single drop marker, report totals/filter/day breakdown, styled responsive navigation, single capture perimeter and 100 error-free navigation/editor cycles.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
