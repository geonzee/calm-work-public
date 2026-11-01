#!/usr/bin/env node
// Two-way sync proof against a real SuperSync server, using two browser clients:
// a desktop-size window and a phone-size window (touch, 390x844).
//
//   CALM_SYNC_SERVER=http://127.0.0.1:1900 CALM_SYNC_CODE_FILE=/tmp/calm-test-code.txt node scripts/verify-sync-pwa.cjs [--url https://example.test]
// When the sync hostname resolves to a private address, set CALM_FUNNEL_IP to the address a phone would use.
//
// The setup code belongs to a throwaway synthetic account. Without --url the staged
// build in output/pwa-public is served locally and CORS headers are added to the
// sync server's answers. Point CORS_ORIGINS at the origin you are actually testing.
const { chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { serve } = require("./lib-static-server.cjs");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "output/sync-proof");
fs.mkdirSync(out, { recursive: true });
const codeFile = process.env.CALM_SYNC_CODE_FILE;
if (!codeFile) throw new Error("Set CALM_SYNC_CODE_FILE to a file holding a calmsync1. setup code.");
const code = fs.readFileSync(codeFile, "utf8").trim();
const urlArg = process.argv.indexOf("--url");
const remoteUrl = urlArg > 0 ? process.argv[urlArg + 1] : null;
const stamp = Date.now().toString(36);
const names = { a: `Sync A ${stamp}`, b: `Sync B ${stamp}`, track: `Sync track ${stamp}` };
const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);

function syncOrigin() {
  const raw = process.env.CALM_SYNC_SERVER;
  if (!raw) throw new Error("Set CALM_SYNC_SERVER to your SuperSync origin, such as http://127.0.0.1:1900");
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("CALM_SYNC_SERVER must be http or https");
  return url.origin;
}

async function withCors(context, origin) {
  const server = syncOrigin();
  await context.route(server + "/**", async (route) => {
    const headers = {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization,content-type,content-encoding,x-client-id,x-app-version,x-platform",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-max-age": "600",
    };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const response = await route.fetch({ timeout: 120000 });
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
}

async function open(browser, name, viewport, mobile, base, local) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    serviceWorkers: local ? "block" : "allow",
  });
  if (local) await withCors(context, base);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/");
  const handle = await page.waitForSelector('iframe[title="Calm Work"]', { timeout: 60000 });
  const frame = await handle.contentFrame();
  await frame.waitForFunction(() => window.CalmRuntime?.ready(), null, { timeout: 60000 });
  return { name, context, page, frame, errors };
}

const snap = (client) => client.frame.evaluate(() => CalmRuntime.snapshot());
async function waitFor(label, client, predicate, timeout = 60000) {
  const started = Date.now();
  let last;
  while (Date.now() - started < timeout) {
    last = await snap(client);
    if (predicate(last)) {
      log(`  ok: ${label} (${Math.round((Date.now() - started) / 1000)}s)`);
      return last;
    }
    await client.page.waitForTimeout(500);
  }
  throw new Error(`Timed out: ${label}. Tasks: ${JSON.stringify(last.tasks.map((t) => [t.title, t.done]))}`);
}
async function shot(client, name) {
  await client.page.screenshot({ path: path.join(out, `${client.name}-${name}.png`) });
}
async function connect(client) {
  await client.frame.evaluate(() => show("modules"));
  await client.frame.locator("#sync-connect textarea").fill(code);
  await client.frame.locator("#sync-connect button.primary").click();
  await client.frame.locator(".sync-line", { hasText: /Up to date|waiting/i }).waitFor({ timeout: 90000 });
  log(`${client.name}: connected, ${await client.frame.locator(".sync-line").innerText()}`);
}
async function addTask(client, title, phone) {
  if (phone) await client.frame.locator("#phone-add").tap();
  else await client.frame.locator("#global-add").click();
  await client.frame.locator("#add-title").fill(title);
  await client.frame.locator("#add-title").press("Enter");
  await client.page.waitForTimeout(400);
}

(async () => {
  let server;
  let base = remoteUrl;
  if (!remoteUrl) {
    const started = await serve(path.join(root, "output/pwa-public"));
    server = started.server;
    base = `http://127.0.0.1:${started.port}`;
  }
  // On a tailnet machine the server name resolves to a private 100.x address and Chromium
  // blocks the public site from reaching it. Map it to a public Funnel address (as a phone sees it).
  const funnelIp = process.env.CALM_FUNNEL_IP;
  const args = ["--no-sandbox"];
  if (remoteUrl && funnelIp) args.push(`--host-resolver-rules=MAP ${new URL(syncOrigin()).hostname} ${funnelIp}`);
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args });
  const clients = [];
  try {
    log("open desktop-size client A");
    const a = await open(browser, "desktop", { width: 1280, height: 800 }, false, base, !remoteUrl);
    clients.push(a);
    await connect(a);
    await addTask(a, `${names.a} @today`, false);
    await waitFor("A holds its own task", a, (s) => s.tasks.some((t) => t.title === names.a));
    await a.page.waitForTimeout(3000);

    log("open phone-size client B (fresh storage)");
    let b = await open(browser, "phone", { width: 390, height: 844 }, true, base, !remoteUrl);
    clients.push(b);
    assert.equal(await b.frame.evaluate(() => document.body.dataset.phoneFocus), "true", "phone focus mode");
    const visibleNav = await b.frame.evaluate(() =>
      [...document.querySelectorAll("#mobile-nav > button")].filter((x) => x.offsetParent).map((x) => x.textContent.trim()),
    );
    assert.deepEqual(visibleNav, ["Add", "Menu"], "phone shows Add, the page, and Menu");
    await b.frame.locator("#sync-chip").tap();
    await b.frame.locator("#sync-connect textarea").fill(code);
    await shot(b, "1-before-connect");
    await b.frame.locator("#sync-connect button.primary").tap();
    await b.frame.locator(".sync-line", { hasText: /Up to date|waiting/i }).waitFor({ timeout: 90000 });
    await waitFor("phone receives desktop task", b, (s) => s.tasks.some((t) => t.title === names.a));
    await b.frame.locator("#mobile-more").tap();
    await b.frame.locator("#mobile-menu [data-show=inbox]").tap();
    await b.page.waitForTimeout(500);
    await shot(b, "2-clean-after-sync");

    log("phone adds a task (real taps)");
    await b.frame.locator("#mobile-more").tap();
    await b.frame.locator("#mobile-menu [data-show=track]").tap();
    await addTask(b, names.b, true);
    await waitFor("phone holds its task", b, (s) => s.tasks.some((t) => t.title === names.b));
    await waitFor("desktop receives phone task", a, (s) => s.tasks.some((t) => t.title === names.b), 90000);

    log("phone tracks time on the synced desktop task (real taps)");
    const trackedId = await b.frame.evaluate((title) => tasks.find((t) => t.title === title).id, names.a);
    await b.frame.locator(`[data-start="${trackedId}"]`).tap();
    await b.page.waitForTimeout(6500);
    await shot(b, "3-tracking");
    await b.frame.locator("#pause-timer").tap();
    await b.page.waitForTimeout(500);
    await b.frame.evaluate(() => CalmRuntime.flush());
    log(`  phone tracked ms: ${(await snap(b)).tasks.find((t) => t.id === trackedId).nativeMs}`);
    await waitFor("desktop sees tracked time", a, (s) => (s.tasks.find((t) => t.title === names.a)?.nativeMs || 0) >= 4000, 90000);

    log("desktop cleans (completes) the phone task and the phone follows");
    const idB = await a.frame.evaluate((title) => tasks.find((t) => t.title === title).id, names.b);
    await a.frame.locator("#navigation [data-show=inbox]").click();
    await a.frame.locator(`[data-complete="${idB}"]`).click();
    await waitFor("phone sees task done", b, (s) => s.tasks.find((t) => t.title === names.b)?.done === true, 90000);

    log("phone reloads, keeps its sync, then cleans (completes) a task and desktop follows");
    await b.page.reload();
    const handle = await b.page.waitForSelector('iframe[title="Calm Work"]', { timeout: 60000 });
    b.frame = await handle.contentFrame();
    await b.frame.waitForFunction(() => window.CalmRuntime?.ready(), null, { timeout: 60000 });
    await b.frame.locator("#sync-chip .sync-chip-label", { hasText: /Synced|Sending|Syncing/ }).waitFor({ timeout: 60000 });
    await b.frame.locator("#mobile-more").tap();
    await b.frame.locator("#mobile-menu [data-show=inbox]").tap();
    const idA = await b.frame.evaluate((title) => tasks.find((t) => t.title === title).id, names.a);
    await b.frame.locator(`[data-complete="${idA}"]`).tap();
    await b.page.waitForTimeout(600);
    await waitFor("desktop sees task done", a, (s) => s.tasks.find((t) => t.title === names.a)?.done === true, 90000);
    await shot(a, "4-desktop-end");
    await shot(b, "5-phone-end");

    for (const client of clients) assert.deepEqual(client.errors, [], `${client.name} page errors`);
    log("SYNC PROOF PASSED");
  } finally {
    for (const client of clients) await client.context.close().catch(() => {});
    await browser.close();
    server?.close();
  }
})().catch((error) => {
  console.error("SYNC PROOF FAILED:", error.message);
  process.exit(1);
});
