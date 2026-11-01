#!/usr/bin/env node
const {
  chromium,
} = require("../output/upstream/node_modules/@playwright/test");
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const { execFileSync } = require("node:child_process");
function pixels(file) {
  return execFileSync("magick", [file, "-depth", "8", "rgba:-"], {
    maxBuffer: 32000000,
  });
}
function comparePixels(a, b) {
  const expected = pixels(a),
    actual = pixels(b);
  if (expected.length !== actual.length)
    return { identical: false, changedPixels: -1 };
  let changedPixels = 0,
    maxDelta = 0;
  for (let i = 0; i < expected.length; i += 4) {
    let delta = 0;
    for (let c = 0; c < 4; c++)
      delta = Math.max(delta, Math.abs(expected[i + c] - actual[i + c]));
    maxDelta = Math.max(maxDelta, delta);
    if (delta > 2) changedPixels++;
  }
  return { identical: changedPixels === 0, changedPixels, maxDelta };
}
const root = path.resolve(__dirname, ".."),
  dist = path.join(root, "output/upstream/.tmp/angular-dist/browser");
const artifacts = path.join(root, "output/ui-parity");
fs.mkdirSync(artifacts, { recursive: true });
(async () => {
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent((request.url || "/").split("?")[0]);
    const reference = url.startsWith("/reference/");
    const base = reference ? path.join(root, "apps/desktop/ui") : dist;
    const relative = reference ? url.slice("/reference".length) : url;
    const file = path.resolve(
      base,
      "." + (relative === "/" ? "/index.html" : relative),
    );
    if (!file.startsWith(base + "/")) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          }[path.extname(file)] || "application/octet-stream",
      });
      response.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("**/*", (route) =>
    route.request().url().startsWith(origin) ? route.continue() : route.abort(),
  );
  const reference = await context.newPage(),
    app = await context.newPage(),
    errors = [];
  for (const page of [reference, app])
    page.on("pageerror", (error) => errors.push(error.message));
  await reference.goto(origin + "/reference/keyboard-review.html?reference=1");
  await app.goto(origin + "/#/calm?reference=1");
  await app
    .frameLocator('iframe[title="Calm Work"]')
    .locator("#review-picker")
    .waitFor();
  const frame = app
    .frames()
    .find((frame) => frame.url().includes("/assets/calm/"));
  if (!frame) throw new Error("Reviewed renderer frame missing");
  await frame.locator("#review-picker").waitFor();
  for (const page of [reference, frame])
    await page.evaluate(() => {
      for (let id = 1; id < 100; id++) clearInterval(id);
      state.seconds = 1694;
      state.nowMinute = 592 + 14 / 60;
      renderScreen();
    });
  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, "apps/desktop/ui/keyboard-view-inventory.json")),
  );
  const report = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await reference.setViewportSize(viewport);
    await app.setViewportSize(viewport);
    for (const item of inventory) {
      await reference.selectOption("#review-picker", item.key);
      await frame.selectOption("#review-picker", item.key);
      const basename = viewport.width + "-" + item.key;
      const expectedFile = path.join(artifacts, basename + "-reference.png"),
        actualFile = path.join(artifacts, basename + "-app.png");
      await reference.screenshot({
        path: expectedFile,
        animations: "disabled",
      });
      await app.screenshot({ path: actualFile, animations: "disabled" });
      const comparison = comparePixels(expectedFile, actualFile);
      report.push({ viewport: viewport.width, state: item.key, ...comparison });
      if (!comparison.identical)
        console.log(
          "DIFF",
          basename,
          comparison.changedPixels,
          comparison.maxDelta,
        );
    }
  }
  fs.writeFileSync(
    path.join(artifacts, "results.json"),
    JSON.stringify(
      { states: inventory.length, comparisons: report.length, errors, report },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  if (errors.length || report.some((row) => !row.identical))
    throw new Error("Visual parity failed: " + errors.join("; "));
  console.log(
    "PASS: all " +
      report.length +
      " desktop/phone state screenshots match the reviewed UI with only a 2/255 edge-rasterization tolerance.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
