const {
    chromium,
  } = require("../output/upstream/node_modules/@playwright/test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  require("node:fs").mkdirSync(path.resolve(__dirname,"../output/daily-navigation"), {recursive:true});
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 960 },
    });
    await page.goto(
      "file://" +
        path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html") +
        "?reference=1",
    );
    await page.evaluate(() => show("inbox"));
    await page.locator('[data-inline="estimate"]').first().click();
    await page.locator("#inline-value").fill("12.5");
    await page.locator("#inline-value").press("Enter");
    const focus = await page.evaluate(() => ({
      tag: document.activeElement.tagName,
      id: document.activeElement.id,
    }));
    await page.locator("#global-add").click();
    await page.locator("#add-title").fill("Fractional capture");
    await page.locator('[data-add-field="estimate"]').click();
    await page.locator("#add-field-value").fill("12.5");
    await page.locator("#add-field-value").press("Enter");
    const count = await page.evaluate(() => tasks.length);
    await page.locator(".add-submit").click();
    const result = await page.evaluate(() => ({
      count: tasks.length,
      valid: document.getElementById("add-form").checkValidity(),
      estimate: state.add.estimate,
      stepMismatch:
        document.getElementById("add-field-value").validity.stepMismatch,
    }));
    assert.notEqual(focus.tag, "BODY");
    assert.equal(result.count, count + 1);
    assert.equal(result.stepMismatch, false);
    await page.evaluate(() => {
      show("projects");
      show("modules");
    });
    await page.locator("#nav-back").click();
    assert.equal(await page.evaluate(() => state.view), "projects");
    await page.evaluate(() => show("modules"));
    assert.equal(await page.locator("#shortcut-help").isVisible(), false);
    await page.locator("#settings-shortcuts").click();
    assert.equal(await page.locator("#help-overlay").isVisible(), true);
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      show("plan");
      state.showPlanTasks = true;
      renderScreen();
    });
    assert.equal(await page.locator("[data-plan-jump]").count(), 3);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => {
      show("track");
      show("plan");
    });
    assert.equal(await page.locator(".plan-tasks").count(), 0);
    await page.evaluate(() => {
      show("inbox");
      openTask(tasks.find((t) => !t.project).id, true);
    });
    assert.equal(await page.locator("#global-add").isVisible(), false);
    // Full-screen phone editors expose their own close control.
    await page.locator("#close-drawer").click();
    assert.equal(await page.locator("#drawer").isVisible(), false);
    await page.screenshot({
      path: path.resolve(
        __dirname,
        "../output/daily-navigation/after-phone-inbox.png",
      ),
    });
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.evaluate(() => show("plan"));
    await page.screenshot({
      path: path.resolve(
        __dirname,
        "../output/daily-navigation/after-desktop-plan.png",
      ),
    });
    console.log(
      "PASS fractional capture, inline focus, Back, Settings shortcuts, Plan stages, mobile calendar and editor controls",
    );
  } finally {
    await browser.close();
  }
})();
