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
      viewport: { width: 1440, height: 820 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"),
    );
    const result = await page.evaluate(() => {
      window.calmRuntimeMode = true;
      window.calmReference = false;
      window.__providerInjection = false;
      const provider = {
        id: 'provider:calendar:" data-injected="yes',
        title: "External meeting",
        calendar:
          'Google · <img src=x onerror="window.__providerInjection=true">',
        date: calmToday(),
        start: "11:00",
        end: "24:00",
        owned: false,
        busy: false,
        meetingUrl: "https://example.test/meeting",
      };
      window.calmProviderEvents = { [provider.id]: provider };
      state.localEvents = [];
      state.sessions = [];
      state.active = null;
      state.nowMinute = 600;
      tasks.splice(0, tasks.length, {
        id: "local-task",
        title: "Local task",
        project: "Alpha",
        date: calmToday(),
        schedule: "11:00",
        estimate: 30,
        done: false,
      });
      state.calendarMode = "day";
      state.calendarSlot.day = 0;
      state.calendarAnchor = 0;
      show("plan");
      return {
        next: nextCommitment().id,
        summary: conflictSummary(),
        id: provider.id,
      };
    });
    assert.equal(result.next, "local-task");
    assert.equal(result.summary, "");
    assert.equal(await page.locator("[data-injected]").count(), 0);
    const external = page.locator(".calendar-block[data-event]");
    await external.click();
    assert.match(
      await page.locator("#event-calendar").inputValue(),
      /^Google · <img/,
    );
    assert.equal(
      await page.locator('[name="event-end"]').inputValue(),
      "24:00",
    );
    assert.equal(await page.locator("#event-title").isDisabled(), true);
    assert.equal(await page.locator("#drawer-content img").count(), 0);
    assert.equal(await page.evaluate(() => window.__providerInjection), false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: provider identities/labels escaped, actual calendar name and midnight end visible, events read-only, and free events excluded from conflicts/next countdown.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
