#!/usr/bin/env node
// Disposable-profile proof against the staged production web build (output/pwa-public):
//  1. project–calendar links and event project choices survive a stale, empty phone map
//  2. a link removed on this device is still removed
//  3. time zones save (stored as JSON text) without a save error
//  4. the one-time 15 minute estimate backfill: dry run, apply, idempotent, undo, no default on new tasks
// A fresh headless browser profile is used. No account, no sync server, no personal data.
const { chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { serve } = require("./lib-static-server.cjs");

(async () => {
  const { server, port } = await serve(path.resolve(__dirname, "../output/pwa-public"));
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === new URL(base).origin ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const open = async () => {
      await page.goto(base + "/");
      const handle = await page.waitForSelector('iframe[title="Calm Work"]', { timeout: 60000 });
      const frame = await handle.contentFrame();
      await frame.waitForFunction(() => window.CalmRuntime?.ready(), null, { timeout: 60000 });
      return frame;
    };
    let frame = await open();
    const snap = () => frame.evaluate(() => CalmRuntime.snapshot());
    const byTitle = (s, title) => s.tasks.find((t) => t.title === title);

    // Seed: projects, links, one event choice, and tasks of every kind the backfill must tell apart.
    await frame.evaluate(() => {
      const base = { project: "", date: "", schedule: "", done: false, today: false, estimate: null };
      tasks.splice(0, tasks.length,
        { ...base, id: "t-none-a", title: "No estimate A" },
        { ...base, id: "t-none-e", title: "No estimate E", project: "Launch" },
        { ...base, id: "t-has", title: "Has 30", estimate: 30 },
        { ...base, id: "t-time", title: "Has time" },
        { ...base, id: "t-done", title: "Done no estimate", done: true },
      );
      projects.splice(0, projects.length, "Launch", "Home");
      state.projectCalendars = { Launch: "google|a", Home: "google|b" };
      state.eventMeta = { "event:1": { project: "Launch" } };
      const now = Date.now();
      state.sessions = [{
        sessionKey: "s-1", id: "t-time", title: "Has time", project: "", date: calmToday(),
        start: "09:00", end: "09:30", startMinute: 540, endMinute: 570,
        startTimestamp: now - 3600000, endTimestamp: now - 1800000,
        focusedSeconds: 1800, duration: 30, estimate: null, recorded: true,
      }];
      tasks.find((t) => t.id === "t-time").actual = state.sessions[0];
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    frame = await open();
    let s = await snap();
    assert.equal(JSON.parse(s.drafts.$projectCalendars.json).Launch, "google|a", "links saved");
    assert.equal(JSON.parse(s.drafts.$eventMeta.json)["event:1"].project, "Launch", "event choice saved");
    console.log("ok: links and event choice persist across reload");

    // 1. A phone that hydrated before the links arrived: empty map, empty baseline, then a local edit.
    await frame.evaluate(() => {
      state.projectCalendars = {};
      state.eventMeta = {};
      state.mergeBase = { projectCalendars: "{}", eventMeta: "{}" };
      getTask("t-has").notes = "edited on the phone";
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    frame = await open();
    s = await snap();
    assert.deepEqual(JSON.parse(s.drafts.$projectCalendars.json), { Launch: "google|a", Home: "google|b" }, "stale empty map did not delete links");
    assert.equal(JSON.parse(s.drafts.$eventMeta.json)["event:1"].project, "Launch", "stale empty map kept the event choice");
    assert.equal(byTitle(s, "Has 30").notes, "edited on the phone", "the local edit itself saved");
    console.log("ok: a stale, empty map and a local edit did not delete any link");

    // An unreadable baseline can never delete either.
    await frame.evaluate(() => {
      state.projectCalendars = {};
      state.mergeBase = {};
      getTask("t-has").notes = "second edit";
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    frame = await open();
    s = await snap();
    assert.equal(Object.keys(JSON.parse(s.drafts.$projectCalendars.json)).length, 2, "no baseline: nothing deleted");

    // 2. A removal made on this device still works.
    await frame.evaluate(() => {
      delete state.projectCalendars.Home;
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    frame = await open();
    s = await snap();
    assert.deepEqual(JSON.parse(s.drafts.$projectCalendars.json), { Launch: "google|a" }, "own removal kept, other link kept");
    console.log("ok: a link removed on this device is removed, others stay");

    // 3. Time zones.
    await frame.evaluate(() => show("modules"));
    const zone = frame.locator("#tz-zone-0");
    await zone.waitFor();
    await zone.fill("Asia/Tokyo");
    await zone.dispatchEvent("change");
    await frame.evaluate(() => CalmRuntime.flush());
    s = await snap();
    assert.equal(typeof s.drafts.$settings.timeZones, "string", "time zones stored as JSON text");
    assert.deepEqual(JSON.parse(s.drafts.$settings.timeZones)[0], "Asia/Tokyo");
    frame = await open();
    s = await snap();
    assert.equal(JSON.parse(s.drafts.$settings.timeZones)[0], "Asia/Tokyo", "time zone survives reload");
    console.log("ok: time zones save as JSON text and survive reload");

    // 4. Backfill.
    const before = await snap();
    const dry = await frame.evaluate(() => CalmRuntime.backfillEstimates());
    assert.deepEqual(dry.plan.tasks.map((t) => t.id).sort(), ["t-none-a", "t-none-e"]);
    assert.equal(dry.plan.skippedDone, 1);
    assert.equal(dry.plan.skippedTracked, 1);
    assert.equal(dry.applied, 0);
    const afterDry = await snap();
    assert.deepEqual(afterDry.tasks.map((t) => t.estimate), before.tasks.map((t) => t.estimate), "dry run changes nothing");
    console.log("ok: dry run lists", dry.plan.tasks.length, "tasks and changes nothing");

    const applied = await frame.evaluate(() => CalmRuntime.backfillEstimates({ apply: true }));
    assert.equal(applied.applied, 2);
    frame = await open();
    s = await snap();
    assert.equal(byTitle(s, "No estimate A").estimate, 15);
    assert.equal(byTitle(s, "No estimate E").estimate, 15);
    assert.equal(byTitle(s, "Has 30").estimate, 30, "existing estimate untouched");
    assert.equal(byTitle(s, "Has time").estimate, null, "tracked task untouched");
    assert.equal(byTitle(s, "Done no estimate").estimate, null, "finished task untouched");
    console.log("ok: apply set 15 on exactly the two eligible tasks; reload keeps it");

    // Idempotent, and a user who clears an estimate afterwards is never refilled.
    await frame.evaluate(() => {
      getTask("t-none-a").estimate = null;
      getTask("t-none-e").estimate = 20;
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    const again = await frame.evaluate(() => CalmRuntime.backfillEstimates({ apply: true }));
    assert.equal(again.alreadyApplied, true);
    assert.equal(again.applied, 0);
    frame = await open();
    s = await snap();
    assert.equal(byTitle(s, "No estimate A").estimate, null, "cleared estimate not refilled");
    assert.equal(byTitle(s, "No estimate E").estimate, 20, "changed estimate untouched");
    console.log("ok: second apply does nothing, even after the user cleared an estimate");

    // New tasks get no default estimate.
    await frame.evaluate(() => { show("track"); openAdd(); });
    await frame.locator("#add-title").fill("Brand new task");
    await frame.locator(".add-submit").click();
    await frame.waitForFunction(() => tasks.some((t) => t.title === "Brand new task"));
    await frame.evaluate(() => CalmRuntime.flush());
    frame = await open();
    s = await snap();
    assert.equal(byTitle(s, "Brand new task").estimate, null, "new task has no default estimate");
    console.log("ok: a new task keeps no estimate");

    // Undo clears only backfilled tasks whose estimate is still exactly 15 (a later 15 typed by hand is indistinguishable).
    await frame.evaluate(() => {
      getTask("t-none-a").estimate = 15;
      renderScreen();
    });
    await frame.evaluate(() => CalmRuntime.flush());
    const undone = await frame.evaluate(() => CalmRuntime.backfillEstimates({ undo: true }));
    assert.equal(undone.reverted, 1, "only the task still at 15 is reverted");
    s = await snap();
    assert.equal(byTitle(s, "No estimate A").estimate, null);
    assert.equal(byTitle(s, "No estimate E").estimate, 20);
    console.log("ok: undo only clears backfilled tasks still at 15");

    // Finished past tasks: their own one-time scope, never calendar events or tracked tasks.
    await frame.evaluate(() => {
      tasks.find((t) => t.id === "t-done").estimate = null;
      renderScreen();
    });
    const doneDry = await frame.evaluate(() => CalmRuntime.backfillEstimates({ scope: "done" }));
    assert.deepEqual(doneDry.plan.tasks.map((t) => t.id), ["t-done"]);
    assert.equal(doneDry.plan.scope, "done");
    const doneApplied = await frame.evaluate(() => CalmRuntime.backfillEstimates({ apply: true, scope: "done" }));
    assert.equal(doneApplied.applied, 1);
    frame = await open();
    s = await snap();
    assert.equal(byTitle(s, "Done no estimate").estimate, 15);
    assert.equal(byTitle(s, "Has time").estimate, null, "tracked task untouched");
    const doneAgain = await frame.evaluate(() => CalmRuntime.backfillEstimates({ apply: true, scope: "done" }));
    assert.equal(doneAgain.alreadyApplied, true);
    console.log("ok: done scope sets 15 on the finished task only, once");

    assert.deepEqual(errors, []);
    console.log("PASS: link resync, time zones and estimate backfill on a disposable profile.");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
