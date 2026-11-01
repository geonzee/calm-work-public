const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const path = require("node:path"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/runtime-controller.js", async (route) => {
      await gate;
      await route.continue();
    });
    const url =
      "file://" +
      path.resolve(
        __dirname,
        "../output/upstream/src/assets/calm/keyboard-review.html",
      );
    const loading = page.goto(url);
    await page.locator("#global-add").waitFor({ state: "attached" });
    await page.waitForFunction(() => typeof state !== "undefined");
    assert.equal(
      await page
        .locator("body")
        .evaluate((el) => getComputedStyle(el).visibility),
      "hidden",
      "Preview data must stay hidden before the runtime adapter loads",
    );
    release();
    await loading;
    const protectedState = await page.evaluate(
      () =>
        getComputedStyle(document.body).visibility === "hidden" ||
        (!document.getElementById("app") &&
          !!document.getElementById("retry-workspace")),
    );
    assert.equal(
      protectedState,
      true,
      "Missing workspace must stay hidden or show only recovery, never fixtures",
    );
    const review = await browser.newPage();
    await review.goto(url + "?reference=1");
    assert.equal(
      await review
        .locator("body")
        .evaluate((el) => getComputedStyle(el).visibility),
      "visible",
      "Explicit design review must remain available",
    );
    console.log(
      "PASS: delayed runtime and workspace startup hide preview tasks; explicit review stays visible",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
