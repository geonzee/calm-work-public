#!/usr/bin/env node
// Two-way sync proof between the Electron desktop app (disposable profile) and a
// phone-size browser, against a real SuperSync server with a throwaway account.
//   CALM_SYNC_SERVER=http://127.0.0.1:1900 CALM_SYNC_CODE_FILE=/tmp/calm-test-code.txt node scripts/verify-sync-desktop.cjs
const { _electron: electron, chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { serve } = require("./lib-static-server.cjs");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "output/sync-proof");
fs.mkdirSync(out, { recursive: true });
const code = fs.readFileSync(process.env.CALM_SYNC_CODE_FILE, "utf8").trim();
const stamp = Date.now().toString(36);
const names = { d: `Desk ${stamp}`, p: `Phone ${stamp}` };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const snap = (c) => c.frame.evaluate(() => CalmRuntime.snapshot());
async function waitFor(label, c, pred, timeout = 90000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    last = await snap(c);
    if (pred(last)) return log(`  ok: ${label} (${Math.round((Date.now() - t0) / 1000)}s)`);
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out: ${label}: ${JSON.stringify(last.tasks.map((t) => [t.title, t.done]))}`);
}

(async () => {
  const profile = path.join(root, "output/desktop-sync-" + Date.now());
  const started = await serve(path.join(root, "output/pwa-public"));
  const base = `http://127.0.0.1:${started.port}`;
  const app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: profile },
  });
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1280, height: 850 });
    const handle = await page.waitForSelector('iframe[title="Calm Work"]', { timeout: 60000 });
    const frame = await handle.contentFrame();
    await frame.waitForFunction(() => window.CalmRuntime?.ready(), null, { timeout: 60000 });
    const desk = { page, frame };
    log("desktop: connect");
    await frame.evaluate(() => show("modules"));
    await frame.locator("#sync-connect textarea").fill(code);
    await frame.locator("#sync-connect button.primary").click();
    await frame.locator(".sync-line", { hasText: /Up to date|waiting/i }).waitFor({ timeout: 90000 });
    log("desktop:", await frame.locator(".sync-line").innerText());
    await frame.locator("#global-add").click();
    await frame.locator("#add-title").fill(`${names.d} @today`);
    await frame.locator("#add-title").press("Enter");
    await waitFor("desktop holds task", desk, (s) => s.tasks.some((t) => t.title === names.d));
    await page.screenshot({ path: path.join(out, "electron-desktop.png") });

    log("phone: connect");
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
    const syncServer = process.env.CALM_SYNC_SERVER;
    if (!syncServer) throw new Error("Set CALM_SYNC_SERVER to your SuperSync origin, such as http://127.0.0.1:1900");
    await ctx.route(new URL(syncServer).origin + "/**", async (route) => {
      const h = {
        "access-control-allow-origin": base,
        "access-control-allow-headers": "authorization,content-type,content-encoding,x-client-id,x-app-version,x-platform",
        "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: h });
      const r = await route.fetch({ timeout: 120000 });
      await route.fulfill({ response: r, headers: { ...r.headers(), ...h } });
    });
    const pp = await ctx.newPage();
    await pp.goto(base + "/");
    const ph = await pp.waitForSelector('iframe[title="Calm Work"]', { timeout: 60000 });
    const pf = await ph.contentFrame();
    await pf.waitForFunction(() => window.CalmRuntime?.ready(), null, { timeout: 60000 });
    const phone = { page: pp, frame: pf };
    await pf.locator("#sync-chip").tap();
    await pf.locator("#sync-connect textarea").fill(code);
    await pf.locator("#sync-connect button.primary").tap();
    await pf.locator(".sync-line", { hasText: /Up to date|waiting/i }).waitFor({ timeout: 90000 });
    await waitFor("phone receives desktop task", phone, (s) => s.tasks.some((t) => t.title === names.d));

    log("phone adds task, desktop receives it");
    await pf.locator("#mobile-more").tap();
    await pf.locator("#mobile-menu [data-show=track]").tap();
    await pf.locator("#phone-add").tap();
    await pf.locator("#add-title").fill(names.p);
    await pf.locator("#add-title").press("Enter");
    await waitFor("desktop receives phone task", desk, (s) => s.tasks.some((t) => t.title === names.p));

    log("phone completes the desktop task, desktop follows");
    await pf.locator("#mobile-more").tap();
    await pf.locator("#mobile-menu [data-show=inbox]").tap();
    const id = await pf.evaluate((t) => tasks.find((x) => x.title === t).id, names.d);
    await pf.locator(`[data-complete="${id}"]`).tap();
    await waitFor("desktop sees done", desk, (s) => s.tasks.find((t) => t.title === names.d)?.done === true);
    await page.screenshot({ path: path.join(out, "electron-desktop-end.png") });
    log("DESKTOP SYNC PROOF PASSED");
  } finally {
    await browser.close().catch(() => {});
    await app.close().catch(() => {});
    started.server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch((e) => { console.error("DESKTOP SYNC PROOF FAILED:", e.message); process.exit(1); });
