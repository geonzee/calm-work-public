#!/usr/bin/env node
const {
  chromium,
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
(async () => {
  const native = process.argv.includes("--native");
  const root = path.resolve(__dirname, "..");
  const output = path.join(root, "output/ux-audit");
  fs.mkdirSync(output, { recursive: true });
  let browser, app;
  const errors = [];
  try {
    let window;
    if (native) {
      const profile = path.join(output, "editing-profile-" + Date.now());
      app = await electron.launch({
        executablePath: path.join(
          root,
          "output/upstream/.tmp/app-builds/linux-unpacked/superproductivity",
        ),
        args: ["--no-sandbox", "--user-data-dir=" + profile],
        env: {
          ...process.env,
          XDG_CONFIG_HOME: profile + "/xdg-config",
          XDG_CACHE_HOME: profile + "/xdg-cache",
        },
      });
      window = await app.firstWindow();
      await window.context().setOffline(true);
      await window
        .frameLocator('iframe[title="Calm Work"]')
        .locator("#global-add")
        .waitFor();
    } else {
      browser = await chromium.launch({
        executablePath: "/usr/bin/chromium",
        args: ["--no-sandbox"],
      });
      window = await browser.newPage();
      await window.goto(
        "file://" + path.join(root, "apps/desktop/ui/keyboard-review.html"),
      );
    }
    await window.setViewportSize({ width: 1440, height: 1000 });
    window.on("pageerror", (e) => errors.push(e.message));
    const surface = native
      ? window.frames().find((f) => f.url().includes("keyboard-review.html"))
      : window;
    const page = {
      evaluate: surface.evaluate.bind(surface),
      locator: surface.locator.bind(surface),
      keyboard: window.keyboard,
      screenshot: (options) => window.screenshot(options),
      setViewportSize: (size) => window.setViewportSize(size),
    };
    if (native) {
      await surface.waitForFunction(() => window.CalmRuntime?.ready());
      await surface.evaluate(async () => {
        await CalmRuntime.seed();
        await CalmRuntime.flush();
      });
    }
    const id = await page.evaluate(() => {
      show("track");
      return tasks.find((t) => !t.done).id;
    });
    const title = await page.evaluate((id) => getTask(id).title, id);
    const open = () => page.evaluate((id) => openTask(id), id);
    await open();
    await page.locator("#detail-title").fill("Unsaved task change");
    await page.locator("#global-add").click();
    await page.locator("#add-title").fill("Separate capture draft");
    await page.keyboard.press("Control+Enter");
    assert.equal(
      await page.evaluate((id) => getTask(id).title, id),
      title,
      "capture must not save background details",
    );
    assert.equal(await page.locator("#add-overlay").isVisible(), true);
    assert.equal(
      await page.evaluate(() => document.getElementById("app").inert),
      true,
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#detail-title").inputValue(),
      "Unsaved task change",
    );
    assert.equal(
      await page.evaluate(() => document.getElementById("app").inert),
      false,
    );
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#drawer-discard").isVisible(), true);
    await page.locator("#keep-editing").click();
    assert.equal(
      await page.locator("#detail-title").inputValue(),
      "Unsaved task change",
    );
    await page.locator('[data-show="plan"]').first().click();
    assert.equal(
      await page.evaluate(() => state.view),
      "track",
      "navigation must wait for discard",
    );
    await page.locator("#discard-edits").click();
    assert.equal(await page.evaluate(() => state.view), "plan");
    await open();
    assert.equal(await page.locator("#detail-title").inputValue(), title);
    await page.locator("#detail-title").fill("");
    await page.locator("#drawer-save").click();
    assert.equal(
      await page.locator("#detail-title").getAttribute("aria-invalid"),
      "true",
    );
    assert.equal(
      await page.locator("#detail-title-error").textContent(),
      "Enter a task title.",
    );
    assert.equal(
      await page.evaluate(() => document.activeElement.id),
      "detail-title",
    );
    await page.locator("#detail-title").fill("Saved by keyboard");
    assert.equal(await page.locator("#detail-title-error").count(), 0);
    await page.locator('[name="estimate"]').fill("0");
    await page.locator("#drawer-save").click();
    assert.equal(
      await page.locator('[name="estimate"]').getAttribute("aria-invalid"),
      "true",
    );
    await page.locator('[name="estimate"]').fill("25");
    await page.keyboard.press("Control+Enter");
    assert.equal(
      await page.evaluate((id) => getTask(id).title, id),
      "Saved by keyboard",
    );
    assert.equal(await page.locator("#drawer").isVisible(), false);
    assert.equal(
      await page.evaluate(() =>
        Boolean(document.activeElement.getClientRects().length),
      ),
      true,
      "focus must remain visible",
    );
    assert.equal(
      await page.evaluate(() =>
        document.getElementById("drawer").contains(document.activeElement),
      ),
      false,
    );
    assert.notEqual(
      await page.evaluate(() => document.activeElement.tagName),
      "BODY",
    );
    await open();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator("#drawer").isVisible(),
      false,
      "unchanged details close without a prompt",
    );
    // Switching between task drawers also requires a choice.
    await open();
    await page.locator("#detail-title").fill("Switch protection");
    const second = await page.evaluate(
      (id) => tasks.find((t) => t.id !== id).id,
      id,
    );
    await page.evaluate((id) => openTask(id), second);
    assert.equal(
      await page.locator("#detail-title").inputValue(),
      "Switch protection",
    );
    await page.locator("#discard-edits").click();
    assert.equal(
      await page.locator("#detail-title").inputValue(),
      await page.evaluate((id) => getTask(id).title, second),
    );
    await page.keyboard.press("Escape");
    await page.evaluate(() => {
      show("projects");
      projectEditor(true);
    });
    await page.locator("#project-name").fill("Project draft");
    await page.locator("#close-drawer").click();
    assert.equal(await page.locator("#drawer-discard").isVisible(), true);
    await page.locator("#discard-edits").click();
    await page.evaluate(() => {
      show("plan");
      openCalendarCreate("event");
    });
    await page.locator("#event-title").fill("Event draft");
    await page.locator("#close-drawer").click();
    assert.equal(await page.locator("#drawer-discard").isVisible(), true);
    await page.screenshot({ path: path.join(output, "after-discard.png") });
    await page.locator("#discard-edits").click();
    await open();
    await page.locator("#detail-title").fill("");
    await page.locator("#drawer-save").click();
    await page.screenshot({ path: path.join(output, "after-validation.png") });
    await page.locator("#detail-title").fill("Help must not save this");
    await page.evaluate(() => help());
    await page.keyboard.press("Control+Enter");
    assert.notEqual(
      await page.evaluate((id) => getTask(id).title, id),
      "Help must not save this",
    );
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("#close-drawer").click();
    assert.equal(await page.locator("#keep-editing").isVisible(), true);
    assert.equal(await page.locator("#discard-edits").isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: path.join(output, "phone-discard.png") });
    assert.deepEqual(errors, []);
    console.log(
      (native ? "NATIVE " : "BROWSER ") +
        "PASS: modal isolation, dirty task/project/event protection, navigation/task switching, inline validation and visible save focus.",
    );
  } finally {
    if (app) {
      const closing = app.waitForEvent("close", { timeout: 20000 });
      await app
        .evaluate(({ app }) => {
          const base = app.getAppPath() + "/electron/";
          const require = process
            .getBuiltinModule("module")
            .createRequire(base + "main.js");
          require(base + "main-window.js").closeWinAndQuit(
            require(base + "various-shared.js").quitApp,
          );
        })
        .catch(() => {});
      await closing;
    }
    if (browser) await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
