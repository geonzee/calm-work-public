// Usable-screen check for the PWA renderer. A local page hosts the same
// files the phone site uses and answers load, save, sync and calendar.
// No live site, no setup code, no account.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, devices } = require("../output/upstream/node_modules/@playwright/test");
const { serve } = require("./lib-static-server.cjs");

const root = path.resolve(__dirname, "..");
const stage = path.join(root, "output/pwa-ui-harness");
const CODE = "calmsync1.local-screen-check";
const SYNC = {
  configured: true,
  enabled: true,
  state: "ok",
  baseUrl: "https://sync.example.test",
  lastSyncAt: Date.now(),
};
const CALENDAR = {
  accounts: [{ accountId: "google", provider: "google", label: "ada@example.test", canWrite: true }],
  calendars: {
    google: [
      { id: "calm", name: "Calm Work", label: "Google 1 · Calm Work", canWrite: true, synced: true },
      { id: "ada", name: "Ada", label: "Google 1 · Ada", canWrite: true, synced: true },
    ],
  },
  events: [],
  mirror: {
    enabled: true,
    defaultTarget: "",
    defaultLabel: "",
    targets: [
      { key: "google|calm", label: "Google 1 · Calm Work" },
      { key: "google|ada", label: "Google 1 · Ada" },
    ],
    pending: 0,
    tasks: {},
  },
};

function stageHarness() {
  fs.rmSync(stage, { recursive: true, force: true });
  fs.mkdirSync(stage, { recursive: true });
  for (const name of [
    "keyboard-review.css",
    "keyboard-date.js",
    "keyboard-calendar.js",
    "keyboard-prototypes.js",
    "keyboard-review.js",
  ]) {
    fs.copyFileSync(path.join(root, "mockups", name), path.join(stage, name));
  }
  fs.copyFileSync(
    path.join(root, "apps/desktop/calm-shell/runtime/runtime-controller.js"),
    path.join(stage, "runtime-controller.js"),
  );
  const html = fs.readFileSync(path.join(root, "apps/desktop/ui/keyboard-review.html"), "utf8");
  fs.writeFileSync(
    path.join(stage, "keyboard-review.html"),
    html
      .replace(
        "<head>",
        `<head><script>if (new URLSearchParams(location.search).get('reference') !== '1') document.documentElement.dataset.calmLoading = 'true';</script><style>html[data-calm-loading] body { visibility: hidden !important; }</style>`,
      )
      .replace(
        '<script src="keyboard-date.js">',
        '<script>window.calmRuntimeMode = true;</script>\n<script src="keyboard-date.js">',
      )
      .replace(
        '<script src="keyboard-review.js"></script>',
        '<script src="keyboard-review.js"></script>\n<script src="runtime-controller.js"></script>',
      ),
  );
  fs.writeFileSync(
    path.join(stage, "index.html"),
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Calm Work</title>
<style>html,body,iframe{margin:0;width:100%;height:100%;border:0;background:#171614}</style>
<script>
const CODE = ${JSON.stringify(CODE)};
const SYNC = ${JSON.stringify(SYNC)};
const CALENDAR = ${JSON.stringify(CALENDAR)};
const now = new Date();
const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
let documentState = {
  tasks: [{ id: "brief", title: "Write the brief", project: "", estimate: 30, schedule: "09:00", date: today, today: true, done: false, notes: "" }],
  projects: [],
  sessions: [],
  events: [],
  clock: null,
  drafts: {},
  sharedProjects: [],
};
window.addEventListener("message", (event) => {
  const data = event.data;
  const frame = document.getElementById("calm")?.contentWindow;
  if (!data || data.channel !== "calm-work-v1" || !frame || event.source !== frame || !data.command) return;
  const reply = (extra) => frame.postMessage({ channel: "calm-work-v1", requestId: data.requestId, ...extra }, "*");
  if (data.command === "load" || data.command === "refresh" || data.command === "seed" || data.command === "restore") {
    reply({ document: documentState });
  } else if (data.command === "save") {
    documentState = data.document;
    reply({ document: data.document });
  } else if (data.command === "sync") {
    const action = data.input && data.input.action;
    if (action === "export-code") reply({ code: CODE, sync: SYNC });
    else if (action === "disconnect") reply({ sync: { configured: false, enabled: false, state: "ok" } });
    else reply({ sync: SYNC });
  } else if (data.command === "team" || data.command === "team-apply") {
    reply({ team: { connections: [] } });
  } else if (data.command === "calendar") {
    reply({ calendar: CALENDAR });
  }
});
</script>
</head>
<body>
<iframe id="calm" title="Calm Work" src="keyboard-review.html" allow="clipboard-read; clipboard-write"></iframe>
</body>
</html>
`,
  );
}

async function openApp(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(url);
  const frame = page.frameLocator("iframe");
  await frame.locator("#screen-title").waitFor({ timeout: 15000 });
  await frame.getByText("Write the brief").waitFor();
  return { page, frame, errors };
}

(async () => {
  stageHarness();
  const { server, port } = await serve(stage);
  const url = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await desktop.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url });
    const desk = await openApp(desktop, url);
    assert.equal(await desk.frame.locator("body").getAttribute("data-phone-focus"), "false");
    await desk.frame.locator('.nav-item[data-show="plan"]').click();
    await desk.frame.locator(".calendar-body").waitFor();
    await desk.frame.locator('.nav-item[data-show="inbox"]').click();
    await desk.frame.locator("#screen-title", { hasText: "Clean" }).waitFor();
    await desk.frame.locator('.nav-item[data-show="track"]').click();
    await desk.frame.getByText("Write the brief").waitFor();
    await desk.frame.locator('.nav-item[data-show="projects"]').click();
    await desk.frame.locator("#new-project").click();
    await desk.frame.locator("#project-calendar option[value='google|ada']").waitFor({ state: "attached" });
    await desk.frame.locator("#project-name").fill("Ada project");
    await desk.frame.locator("#drawer-save").click();
    await desk.frame.locator("#project-calendar-error").waitFor();
    await desk.frame.locator("#project-calendar").selectOption("google|ada");
    await desk.frame.locator("#drawer-save").click();
    await desk.frame.locator("#toast").filter({ hasText: "Project created." }).waitFor();
    await desk.frame.locator("#new-project").click();
    await desk.frame.locator("#project-calendar option[value='google|calm']").waitFor({ state: "attached" });
    const offered = await desk.frame.locator("#project-calendar option").allTextContents();
    assert.ok(!offered.some((text) => text.includes("Ada")));
    await desk.frame.locator("#project-name").fill("Calm project");
    await desk.frame.locator("#project-calendar").selectOption("google|calm");
    await desk.frame.locator("#drawer-save").click();
    await desk.frame.locator("#toast").filter({ hasText: "Project created." }).waitFor();
    await desk.frame.locator('.nav-item[data-show="modules"]').click();
    assert.equal(await desk.frame.locator("#mirror-default").count(), 0);
    await desk.frame.locator("#sync-copy").click();
    await desk.frame.locator("#sync-code-out").waitFor();
    assert.equal(await desk.frame.locator("#sync-code-out").inputValue(), CODE);
    await desk.frame.locator("#sync-copy").click();
    await desk.frame.locator("[role=alert]").filter({ hasText: "Setup code copied" }).waitFor();
    assert.equal(await desk.frame.locator("body").evaluate(() => navigator.clipboard.readText()), CODE);
    assert.deepEqual(desk.errors, []);

    const phoneContext = await browser.newContext({ ...devices["iPhone 13"] });
    await phoneContext.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url });
    const phone = await openApp(phoneContext, url);
    assert.equal(await phone.frame.locator("body").getAttribute("data-phone-focus"), "true");
    const nav = (await phone.frame.locator("#mobile-nav button:visible").allTextContents()).map((text) => text.trim());
    assert.deepEqual(nav, ["Add", "Menu"]);
    await phone.frame.locator("#mobile-more").click();
    await phone.frame.locator('#mobile-menu [data-show="inbox"]').click();
    await phone.frame.locator("#screen-title", { hasText: "Clean" }).waitFor();
    await phone.frame.locator("#mobile-more").click();
    await phone.frame.locator('#mobile-menu [data-show="track"]').click();
    await phone.frame.locator("#phone-add").click();
    await phone.frame.locator("#add-title").fill("Call the supplier");
    await phone.frame.locator("#add-title").press("Enter");
    await phone.frame.getByText("Call the supplier").waitFor();
    await phone.frame.locator("[data-row] .task-name").first().click();
    const drawer = await phone.frame.locator("#drawer").boundingBox();
    assert.ok(drawer && drawer.width > 200 && drawer.x >= -1 && drawer.x + drawer.width <= 400);
    await phone.frame.locator("#close-drawer").click();
    await phone.frame.locator("#sync-chip").click();
    await phone.frame.locator("#sync-copy").click();
    await phone.frame.locator("#sync-code-out").waitFor();
    assert.equal(await phone.frame.locator("#sync-code-out").inputValue(), CODE);
    await phone.frame.locator("#sync-copy").click();
    await phone.frame.locator("[role=alert]").filter({ hasText: "Setup code copied" }).waitFor();
    const overflow = await phone.page.evaluate(() => {
      const doc = document.getElementById("calm").contentDocument.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    assert.ok(overflow <= 1, `phone page is ${overflow}px wider than the screen`);
    assert.deepEqual(phone.errors, []);
    console.log("PASS: desktop Track, Plan, Clean, one calendar per project, and setup code. Phone Add, Track, Clean, task details and setup code.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
