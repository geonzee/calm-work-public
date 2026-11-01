// Usable-screen check for the PWA renderer. A local page hosts the same
// files the phone site uses and answers load, save, sync and calendar.
// No live site, no setup code, no account.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium, devices } = require("../output/upstream/node_modules/@playwright/test");
const { serve } = require("./lib-static-server.cjs");

const root = path.resolve(__dirname, "..");
const stage = path.join(root, "output/phone-layout-harness");
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
  await frame.getByText("Write the brief", {exact:true}).waitFor();
  return { page, frame, errors };
}

(async () => {
  stageHarness();
  const {server, port} = await serve(stage);
  const browser = await chromium.launch({executablePath:'/usr/bin/chromium', args:['--no-sandbox']});
  try {
    const context = await browser.newContext({...devices['iPhone 13'], reducedMotion:'reduce'});
    const {page, frame, errors} = await openApp(context, `http://127.0.0.1:${port}/`);
    for (const size of [{width:320,height:568},{width:375,height:667},{width:390,height:844},{width:844,height:390}]) {
      await page.setViewportSize(size);
      assert.equal(await frame.locator('body').getAttribute('data-phone-focus'),'true');
      for (const view of ['track','inbox','modules','projects','reports','plan']) {
        await frame.locator('body').evaluate((_, v) => show(v),view);
        const metrics = await frame.locator('body').evaluate(() => ({
          overflow:document.documentElement.scrollWidth-innerWidth,
          tiny:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length && (b.getBoundingClientRect().height<43.5 || b.getBoundingClientRect().width<43.5)).map(b=>b.id || b.textContent.trim())
        }));
        assert.ok(metrics.overflow<=1, `${size.width} ${view}: page overflow`);
        assert.deepEqual(metrics.tiny,[],`${size.width} ${view}: undersized touch targets`);
        await page.screenshot({path:`${stage}/${size.width}-${view}.png`});
      }
    }
    await frame.locator('body').evaluate(()=>show('track'));
    await context.setOffline(true);
    await frame.locator('#sync-chip').filter({hasText:'Offline'}).waitFor();
    await context.setOffline(false);
    await frame.locator('#sync-chip').filter({hasText:'Synced'}).waitFor();
    // Simulate the iframe receiving the smaller area above the software keyboard.
    await page.setViewportSize({width:375,height:250});
    await frame.locator('#phone-add').click();
    assert.equal(await frame.locator('#add-title').getAttribute('placeholder'),'What needs doing?');
    await frame.locator('#add-title').fill('Phone keyboard capture');
    const submit = frame.locator('.add-submit');
    await submit.scrollIntoViewIfNeeded();
    const bounds = await submit.boundingBox();
    assert.ok(bounds && bounds.y>=0 && bounds.y+bounds.height<=251, 'submit remains reachable above keyboard');
    await submit.click();
    await frame.getByText('Phone keyboard capture',{exact:true}).waitFor();
    await page.setViewportSize({width:375,height:667});
    await frame.locator('[data-row] .task-name').first().click();
    await frame.locator('#detail-title').fill('A very long task title '.repeat(12));
    await frame.locator('#drawer-save').click();
    await frame.locator('body').evaluate(()=>document.documentElement.style.fontSize='200%');
    assert.ok(await frame.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:`${stage}/large-text.png`});
    assert.deepEqual(errors,[]);
    console.log('PASS: four phone sizes, landscape, all shared views, 44px targets, offline/reconnect, short keyboard capture, long title, enlarged root text and reduced motion.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
