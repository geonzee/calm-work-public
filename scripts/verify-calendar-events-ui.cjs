// Event editing UI for provider calendars against a fake calmEventApi (no account, no network).
const { chromium } = require("../output/upstream/node_modules/@playwright/test");
const assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs");
const out = path.resolve(__dirname, "../output/v2");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("file://" + path.resolve(__dirname, "../apps/desktop/ui/keyboard-review.html"));
    await page.evaluate(() => {
      window.calmRuntimeMode = true;
      window.calmReference = false;
      const day = calmToday();
      const mk = (id, title, start, end, extra = {}) => ({
        id: "google:google:ada:" + id + ":0", title, date: day, start, end,
        calendar: "Google 1 · Ada", owned: false, busy: true, accountId: "google", calendarId: "ada", eventId: id,
        editable: true, allDay: false, startMs: dateTimeToMs(day, start), endMs: dateTimeToMs(day, end), color: "#9fe1e7", ...extra,
      });
      window.calmProviderEvents = Object.fromEntries([
        mk("e1", "Design review", "10:00", "11:00"),
        mk("ro", "Team holiday", "13:00", "14:00", { editable: false, calendar: "Google 1 · Holidays", calendarId: "holidays", color: "#16a765" }),
        mk("rec", "Standup", "09:00", "09:15", { seriesId: "rec-master", recurring: true }),
      ].map((e) => [e.id, e]));
      const store = {
        e1: { title: "Design review", description: "Agenda", location: "Room 4" },
        rec: { title: "Standup", description: "", location: "", recurring: true },
      };
      for (const event of Object.values(window.calmProviderEvents))
        store[event.eventId] = { ...(store[event.eventId] || {}), startMs: event.startMs, endMs: event.endMs };
      window.__calls = [];
      window.__conflictOnce = false;
      const view = (ref) => {
        const e = Object.values(window.calmProviderEvents).find((x) => x.eventId === ref.eventId);
        const saved = store[ref.eventId];
        return { ...ref, ...saved, startMs: saved.startMs, endMs: saved.endMs, allDay: false, editable: e.editable, recurring: !!saved.recurring, calendar: e.calendar };
      };
      window.calmEventApi = {
        calendars: () => [
          { key: "google|ada", accountId: "google", calendarId: "ada", label: "Google 1 · Ada" },
          { key: "google|calm", accountId: "google", calendarId: "calm", label: "Google 1 · Calm Work" },
          { key: "microsoft|ms-cal", accountId: "microsoft", calendarId: "ms-cal", label: "Microsoft 365 · Calendar" },
        ],
        defaultKey: () => "google|calm",
        get: async (ref) => (window.__calls.push(["get", ref.eventId]), view(ref)),
        create: async (event) => {
          window.__calls.push(["create", event]);
          const eventId = "new-" + String(event.title || "event").toLowerCase().replace(/\s+/g, "-");
          return { saved: { ...event, eventId, seriesId: event.recurrence ? eventId : "" } };
        },
        update: async (ref, base, changes, scope) => {
          window.__calls.push(["update", ref.eventId, base, changes, scope]);
          if (window.__conflictOnce) {
            window.__conflictOnce = false;
            return { conflict: { ...view(ref), title: "Design review (edited in Google)" } };
          }
          Object.assign(store[ref.eventId], changes);
          return { saved: { ...view(ref), ...changes } };
        },
        remove: async (ref, base, scope) => (window.__calls.push(["remove", ref.eventId, base, scope]), { deleted: true }),
      };
      state.localEvents = [];
      state.sessions = [];
      tasks.splice(0, tasks.length);
      state.calendarMode = "day";
      state.calendarSlot.day = 0;
      state.calendarAnchor = 0;
      state.nowMinute = 480;
      show("plan");
      const wrap = document.querySelector(".calendar-wrap");
      wrap.scrollTop = calendarY(8 * 60);
    });
    const calls = () => page.evaluate(() => window.__calls);
    const block = (id) => page.locator(`.calendar-block[data-event="google:google:ada:${id}:0"]`);
    // Read-only calendar: dashed, fields disabled, clear message.
    assert.match(await block("ro").getAttribute("class"), /readonly-event/);
    assert.equal(await block("ro").getAttribute("draggable"), "false");
    await block("ro").click();
    assert.equal(await page.locator("#event-title").isDisabled(), true);
    await page.locator("#drawer-content .muted").getByText("Read-only calendar").waitFor();
    await page.screenshot({ path: path.join(out, "event-readonly.png") });
    await page.locator("#close-drawer").click();
    // Editable event: fresh read, full editor.
    assert.match(await block("e1").getAttribute("class"), /editable-event/);
    await block("e1").click();
    await page.locator("#event-location").waitFor();
    await page.waitForFunction(() => document.querySelector("#event-location").value === "Room 4");
    assert.equal(await page.locator("#event-location").inputValue(), "Room 4");
    assert.equal(await page.locator("#event-notes").inputValue(), "Agenda");
    assert.equal(await page.locator("#event-calendar").inputValue(), "google|ada");
    await page.locator("#event-title").fill("Design review v2");
    await page.locator("#event-location").fill("Room 5");
    await page.screenshot({ path: path.join(out, "event-edit.png") });
    // A change made elsewhere comes back as a conflict: newer version shown, nothing saved.
    await page.evaluate(() => (window.__conflictOnce = true));
    await page.locator("#drawer-save").click();
    await page.locator(".event-conflict").waitFor();
    assert.equal(await page.locator("#event-title").inputValue(), "Design review (edited in Google)");
    await page.screenshot({ path: path.join(out, "event-conflict.png") });
    let update = (await calls()).filter((c) => c[0] === "update").at(-1);
    assert.equal(update[2].title, "Design review");
    assert.equal(update[3].title, "Design review v2");
    assert.equal(update[3].location, "Room 5");
    assert.equal(update[3].startMs, undefined, "unchanged times are not sent");
    // Save again on the newer version, moving it to another calendar.
    await page.locator("#event-calendar").selectOption("google|calm");
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Event saved." }).waitFor();
    update = (await calls()).filter((c) => c[0] === "update").at(-1);
    assert.equal(update[2].title, "Design review (edited in Google)");
    assert.equal(update[3].calendarId, "calm");
    // Delete with confirmation.
    await block("e1").click();
    await page.locator("#event-delete").click();
    await page.locator("#event-delete-dialog").waitFor();
    await page.screenshot({ path: path.join(out, "event-delete-confirm.png") });
    await page.locator("#confirm-delete-event").click();
    await page.locator("#toast").filter({ hasText: "Event deleted." }).waitFor();
    assert.equal((await calls()).filter((c) => c[0] === "remove").length, 1);
    // Recurring: saving asks, and the series choice is sent.
    await block("rec").click();
    assert.equal(await page.locator("#event-calendar").isDisabled(), true);
    assert.equal(await page.locator("#detail-repeat").inputValue(), "Keep current repeat");
    await page.locator("#event-title").fill("Daily standup");
    await page.locator("#event-project").selectOption("Personal");
    await page.locator("#drawer-save").click();
    await page.locator("#series-scope-dialog").waitFor();
    assert.equal(await page.locator('[name="series-scope"][value="occurrence"]').isChecked(), true);
    await page.locator('[name="series-scope"][value="series"]').check();
    await page.screenshot({ path: path.join(out, "event-recurring.png") });
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Series updated." }).waitFor();
    assert.equal((await calls()).filter((c) => c[0] === "update").at(-1)[4], "series");
    assert.equal(await page.evaluate(() => eventProject({ id: "other-day", seriesId: "rec-master", eventId: "rec-other" })), "Personal");
    await block("rec").click();
    assert.equal(await page.locator("#event-project").inputValue(), "Personal");
    await page.locator("#event-project").selectOption("Website refresh");
    await page.locator("#drawer-save").click();
    await page.locator("#series-scope-dialog").waitFor();
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Event saved." }).waitFor();
    assert.equal(await page.evaluate(() => eventProject(window.calmProviderEvents["google:google:ada:rec:0"])), "Website refresh");
    assert.equal(await page.evaluate(() => eventProject({ id: "other-day", seriesId: "rec-master", eventId: "rec-other" })), "Personal");
    // Drag an editable event to 15:00 (keeps its length).
    const dayColumn = () => page.locator(".day-column").first();
    const geometry = (minute) =>
      page.evaluate((m) => {
        const column = document.querySelector(".day-column");
        const r = column.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + calendarY(m) + 2 };
      }, minute);
    const wrapTo = (minute) => page.evaluate((m) => (document.querySelector(".calendar-wrap").scrollTop = calendarY(m)), minute);
    await wrapTo(9 * 60);
    let target = await geometry(15 * 60);
    const colBox = await dayColumn().boundingBox();
    const sourceBox = await block("e1").boundingBox();
    const grab = 16;
    await block("e1").dragTo(dayColumn(), {
      sourcePosition: { x: sourceBox.width / 2, y: grab },
      targetPosition: { x: target.x - colBox.x, y: target.y - colBox.y + grab - 2 },
    });
    await page.locator("#toast").filter({ hasText: "Event moved." }).waitFor();
    update = (await calls()).filter((c) => c[0] === "update").at(-1);
    assert.equal(new Date(update[3].startMs).getHours(), 15);
    assert.equal(update[3].endMs - update[3].startMs, 3600000);
    // Resize from the bottom edge to 16:30. The block already sits at 15:00.
    await wrapTo(14 * 60);
    const box = await block("e1").boundingBox();
    const end = await geometry(16 * 60 + 30);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 3);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, end.y, { steps: 6 });
    await page.mouse.up();
    await page.locator("#toast").filter({ hasText: "Event moved." }).waitFor();
    update = (await calls()).filter((c) => c[0] === "update").at(-1);
    assert.equal(update[3].startMs, update[2].startMs, "resize keeps the start");
    assert.equal(new Date(update[3].endMs).getHours() * 60 + new Date(update[3].endMs).getMinutes(), 16 * 60 + 30);
    // Top edge moves the start and keeps the end.
    const topBox = await block("e1").boundingBox();
    const earlier = await geometry(14 * 60 + 30);
    await page.mouse.move(topBox.x + topBox.width / 2, topBox.y + 3);
    await page.mouse.down();
    await page.mouse.move(topBox.x + topBox.width / 2, earlier.y, { steps: 6 });
    await page.mouse.up();
    await page.locator("#toast").filter({ hasText: "Event moved." }).waitFor();
    update = (await calls()).filter((c) => c[0] === "update").at(-1);
    assert.equal(new Date(update[3].startMs).getHours() * 60 + new Date(update[3].startMs).getMinutes(), 14 * 60 + 30);
    assert.equal(new Date(update[3].endMs).getHours() * 60 + new Date(update[3].endMs).getMinutes(), 16 * 60 + 30);
    // Drag on empty space chooses the time. Name the task, or switch to an event.
    await wrapTo(15 * 60);
    const kept = await page.evaluate(() => {
      const wrap = document.querySelector(".calendar-wrap");
      const date = calmWeekDate(state.calendarSlot.day);
      tasks.push({ id: "moved", title: "Move me", project: "Personal", estimate: 30, schedule: "09:30", date, done: false, today: date === calmToday() });
      repaintPlan();
      wrap.dataset.kept = "1";
      tasks.find((item) => item.id === "moved").schedule = "15:15";
      repaintPlan();
      const block = document.querySelector('[data-calendar-task="moved"]');
      return document.querySelector(".calendar-wrap") === wrap && wrap.dataset.kept === "1" && block?.dataset.blockStart === "915";
    });
    assert.equal(kept, true, "changing a time keeps the same calendar surface");
    const a = await geometry(16 * 60), b = await geometry(17 * 60 + 30);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await page.locator("#detail-title").waitFor();
    assert.match(await page.locator("#drawer-heading").innerText(), /16:00/);
    assert.equal(await page.locator("[name=schedule-time]").count(), 0);
    await page.locator("[data-create-kind=event]").click();
    await page.locator("#event-title").waitFor();
    assert.equal(await page.locator("#event-calendar").inputValue(), "google|calm");
    assert.equal(await page.locator('[name="event-start"]').inputValue(), "16:00");
    assert.equal(await page.locator('[name="event-end"]').inputValue(), "17:30");
    await page.locator("#event-title").fill("Deep work");
    await page.locator("#event-location").fill("Home");
    await page.locator("#event-notes").fill("Phone off");
    await page.screenshot({ path: path.join(out, "event-create.png") });
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Event added to the calendar." }).waitFor();
    const created = (await calls()).find((c) => c[0] === "create")[1];
    assert.deepEqual(
      { accountId: created.accountId, calendarId: created.calendarId, title: created.title, location: created.location, description: created.description },
      { accountId: "google", calendarId: "calm", title: "Deep work", location: "Home", description: "Phone off" },
    );
    assert.equal(created.endMs - created.startMs, 90 * 60000);
    await wrapTo(8 * 60 + 30);
    await page.screenshot({ path: path.join(out, "plan-provider-events.png") });
    await page.evaluate(() => {
      state.calendarSlot = { day: calmTodayIndex(), minute: 18 * 60 };
      state.calendarSlotEnd = 18 * 60 + 30;
      openCalendarCreate("event");
    });
    await page.locator("#event-title").fill("Daily review");
    await page.locator("#event-project").selectOption("Personal");
    await page.locator("#detail-repeat").selectOption({ label: "Every day" });
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Event added to the calendar." }).waitFor();
    const dailyCreate = (await calls()).filter((c) => c[0] === "create").at(-1)[1];
    assert.equal(dailyCreate.title, "Daily review");
    assert.deepEqual(dailyCreate.recurrence, { freq: "daily", interval: 1 });
    assert.equal(dailyCreate.project, "Personal");
    assert.equal(await page.evaluate(() => eventProject({ id: "later", seriesId: "new-daily-review", eventId: "new-daily-review-later" })), "Personal");
    await page.evaluate(() => {
      state.calendarSlot = { day: calmTodayIndex(), minute: 18 * 60 };
      state.calendarSlotEnd = 18 * 60 + 45;
      openCalendarCreate("event");
    });
    await page.locator("#event-title").fill("Weekly review");
    await page.locator("#event-project").selectOption("Product launch");
    await page.locator("#event-calendar").selectOption("local");
    await page.locator("#detail-repeat").selectOption({ label: "Every week" });
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Event saved on this device." }).waitFor();
    const rules = await page.evaluate(() => ({
      weekday: recurrenceFrom("Every weekday", null, "2026-10-20"),
      monthly: recurrenceFrom("Monthly weekday", { weekdays: [1], weekOfMonth: -1 }, "2026-10-20"),
      dates: repeatDates({ date: "2026-10-20", repeat: "Every day", repeatRule: null, skipDates: ["2026-10-22"] }, "2026-10-20", "2026-10-24"),
    }));
    assert.deepEqual(rules.weekday, { freq: "weekly", interval: 1, byDay: [1, 2, 3, 4, 5] });
    assert.equal(rules.monthly.freq, "monthlyWeekday");
    assert.equal(rules.monthly.weekOfMonth, -1);
    assert.deepEqual(rules.dates, ["2026-10-20", "2026-10-21", "2026-10-23", "2026-10-24"]);
    await page.evaluate(() => {
      state.calendarMode = "week";
      state.calendarAnchor = calmTodayIndex();
      renderScreen();
    });
    const series = await page.evaluate(() => {
      const master = state.localEvents.find((event) => event.title === "Weekly review");
      return { id: master.id, dates: allEvents().filter((event) => event.seriesId === master.id || event.id === master.id).map((event) => event.date) };
    });
    assert.ok(series.dates.length >= 4, "a weekly event is drawn on later days");
    const later = series.dates.find((date) => date !== series.dates[0]);
    const laterId = `${series.id}@${later}`;
    assert.equal(
      await page.evaluate((id) => allEvents().filter((event) => event.seriesId === id || event.id === id).every((event) => eventProject(event) === "Product launch"), series.id),
      true,
    );
    await page.locator(`[data-event="${laterId}"]`).click();
    assert.equal(await page.locator("#event-project").inputValue(), "Product launch");
    await page.locator("#event-title").fill("Weekly review once");
    await page.locator("#drawer-save").click();
    await page.locator("#series-scope-dialog").waitFor();
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Event saved." }).waitFor();
    const afterOne = await page.evaluate((date) => ({
      master: state.localEvents.find((event) => event.title === "Weekly review")?.title,
      once: allEvents().find((event) => event.date === date && event.owned)?.title,
    }), later);
    assert.equal(afterOne.master, "Weekly review");
    assert.equal(afterOne.once, "Weekly review once");
    await page.locator(`[data-event="${series.id}"]`).click();
    await page.locator("#event-title").fill("Weekly review all");
    await page.locator("#drawer-save").click();
    await page.locator('[name="series-scope"][value="series"]').check();
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Event saved." }).waitFor();
    const afterAll = await page.evaluate((date) => ({
      master: state.localEvents.find((event) => event.repeat === "Every week")?.title,
      later: allEvents().find((event) => event.repeat === "Every week" && event.date !== state.localEvents.find((item) => item.repeat === "Every week").date)?.title,
      once: allEvents().find((event) => event.date === date && event.seriesId && !event.repeat)?.title,
    }), later);
    assert.equal(afterAll.master, "Weekly review all");
    assert.equal(afterAll.later, "Weekly review all");
    assert.equal(afterAll.once, "Weekly review once");
    await page.locator(`[data-event="${series.id}"]`).click();
    await page.locator("#event-duplicate").click();
    assert.equal(await page.locator("#detail-repeat").inputValue(), "Every week");
    await page.locator("#event-title").fill("Weekly copy");
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Event saved on this device." }).waitFor();
    assert.equal(await page.evaluate(() => state.localEvents.filter((event) => event.repeat === "Every week").length), 2);
    const moved = await page.evaluate(() => state.localEvents.find((event) => event.title === "Weekly review all").date);
    await page.evaluate(() => (document.querySelector(".calendar-wrap").scrollTop = calendarY(12 * 60)));
    const blockBox = await page.locator(`[data-event="${series.id}"]`).boundingBox();
    const dropAt = await page.evaluate((id) => {
      const column = document.querySelector(`[data-event="${id}"]`).closest(".day-column");
      const rect = column.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + calendarY(13 * 60) + 8 };
    }, series.id);
    await page.mouse.move(blockBox.x + blockBox.width / 2, blockBox.y + 12);
    await page.mouse.down();
    await page.mouse.move(dropAt.x, dropAt.y, { steps: 15 });
    await page.mouse.up();
    await page.locator("#series-scope-dialog").waitFor({ timeout: 2000 });
    await page.locator("#cancel-series-scope").click();
    assert.equal(await page.evaluate(() => state.localEvents.find((event) => event.title === "Weekly review all").date), moved);
    const onceId = await page.evaluate((date) => allEvents().find((event) => event.date === date && event.title === "Weekly review once").id, later);
    await page.locator(`[data-event="${onceId}"]`).click();
    await page.locator("#event-delete").click();
    await page.locator("#confirm-choice-yes").click();
    await page.locator("#toast").filter({ hasText: "Event deleted." }).waitFor();
    assert.equal(await page.evaluate((date) => allEvents().some((event) => event.date === date && event.title === "Weekly review once"), later), false);
    await page.locator(`[data-event="${series.id}"]`).click();
    await page.locator("#event-delete").click();
    await page.locator("#series-scope-dialog").waitFor();
    await page.locator('[name="series-scope"][value="occurrence"]').check();
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Event deleted." }).waitFor();
    const skipped = await page.evaluate((id) => {
      const master = state.localEvents.find((event) => event.id === id);
      return master.skipDates.includes(master.date) && allEvents().some((event) => event.seriesId === id && event.date !== master.date);
    }, series.id);
    assert.equal(skipped, true);
    await page.evaluate((id) => openEvent(allEvents().find((event) => event.seriesId === id).id), series.id);
    await page.locator("#event-delete").click();
    await page.locator('[name="series-scope"][value="series"]').check();
    await page.locator("#confirm-series-scope").click();
    await page.locator("#toast").filter({ hasText: "Event deleted." }).waitFor();
    assert.equal(await page.evaluate((id) => state.localEvents.some((event) => event.id === id || event.seriesId === id), series.id), false);
    const held = await page.evaluate(() => {
      window.calmProviderEvents.held = {
        id: "google:google:calm:pending-1:0",
        title: "Held daily",
        date: calmToday(),
        start: "07:00",
        end: "07:30",
        repeat: "Every day",
        owned: false,
        accountId: "google",
        calendarId: "calm",
        eventId: "pending-1",
        editable: false,
      };
      return allEvents().filter((event) => event.title === "Held daily").length;
    });
    assert.ok(held >= 7, "a new repeating calendar event shows on later days before the next poll");
    await page.evaluate(() => {
      window.calmMirror = {
        defaultTarget: "",
        defaultLabel: "",
        targets: [
          { key: "google|calm", label: "Google 1 · Calm Work" },
          { key: "google|ada", label: "Google 1 · Ada" },
        ],
      };
      if (!$("drawer").hidden) closeDrawer(false);
      show("projects");
    });
    await page.locator("#new-project").click();
    await page.locator("#project-calendar").waitFor();
    assert.match(await page.locator("#project-calendar option:checked").innerText(), /Choose a calendar/);
    await page.locator("#project-name").fill("Calendar project");
    await page.locator("#drawer-save").click();
    await page.locator("#project-calendar-error").waitFor();
    assert.match(await page.locator("#project-calendar-error").innerText(), /Choose a calendar/);
    await page.locator("#project-calendar").selectOption("google|ada");
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Project created." }).waitFor();
    await page.locator("#new-project").click();
    await page.locator("#project-calendar").waitFor();
    const taken = await page.locator("#project-calendar option").allTextContents();
    assert.ok(!taken.some((text) => text.includes("Ada")), "a calendar already used by a project is not offered");
    await page.locator("#project-name").fill("Calm project");
    await page.locator("#project-calendar").selectOption("google|calm");
    await page.locator("#drawer-save").click();
    await page.locator("#toast").filter({ hasText: "Project created." }).waitFor();
    const linked = await page.evaluate(() => {
      const onAda = { id: "fresh", accountId: "google", calendarId: "ada", eventId: "fresh", calendar: "Google 1 · Ada", owned: false };
      const onCalm = { id: "calm-event", accountId: "google", calendarId: "calm", eventId: "calm-event", calendar: "Google 1 · Calm Work", owned: false };
      state.projectCalendars.Personal = "google|ada";
      const ambiguous = eventProject(onAda);
      delete state.projectCalendars.Personal;
      return {
        ada: eventProject(onAda),
        calm: eventProject(onCalm),
        ambiguous,
        taskDefault: taskCalendarTarget({ project: "Calendar project", calendar: "" }),
        taskOverride: taskCalendarTarget({ project: "Calendar project", calendar: "none" }),
        inbox: taskCalendarTarget({ project: "", calendar: "" }),
        unset: taskCalendarTarget({ project: "Personal", calendar: "" }),
      };
    });
    assert.equal(linked.ada, "Calendar project");
    assert.equal(linked.calm, "Calm project");
    assert.equal(linked.ambiguous, "");
    assert.equal(linked.taskDefault, "google|ada");
    assert.equal(linked.taskOverride, "none");
    assert.equal(linked.inbox, "none");
    assert.equal(linked.unset, "");
    await page.evaluate(() => {
      state.calendarSlot = { day: calmTodayIndex(), minute: 11 * 60 };
      state.calendarSlotEnd = 11 * 60 + 30;
      openCalendarCreate("event");
    });
    await page.locator("#event-project").waitFor();
    assert.equal(await page.locator("#event-project").inputValue(), "Calm project");
    await page.locator("#event-calendar").selectOption("google|ada");
    assert.equal(await page.locator("#event-project").inputValue(), "Calendar project");
    await page.locator("#event-calendar").selectOption("google|calm");
    assert.equal(await page.locator("#event-project").inputValue(), "Calm project");
    const reported = await page.evaluate(() => {
      window.calmProviderEvents = {};
      state.localEvents = [{
        id: "meet",
        title: "Wafer sync",
        date: calmToday(),
        start: "10:00",
        end: "11:00",
        calendar: "Local calendar",
        owned: true,
        project: "Calendar project",
      }];
      state.eventMeta = { meet: { actualEnd: "10:20", project: "Calendar project" } };
      state.sessions = [];
      state.reportProject = "all";
      state.reportFrom = "";
      state.reportTo = "";
      state.reportGroup = "project";
      state.reportMode = "summary";
      state.filter = "";
      const summary = reportSummary();
      const row = summary.groups.find((item) => item.title === "Calendar project");
      state.reportProject = "Calm project";
      const other = reportSummary().total;
      return { total: summary.total, row: row && row.duration, other, minutes: eventMinutes({ id: "meet", start: "10:00", end: "11:00" }) };
    });
    assert.equal(reported.minutes, 20);
    assert.equal(reported.total, 20);
    assert.equal(reported.row, 20);
    assert.equal(reported.other, 0);
    assert.deepEqual(errors, []);
    console.log("PASS: read-only events locked; editable events open fresh, edit title/time/calendar/description/location, show conflicts without saving, delete with confirmation, recurring occurrence/series, drag, resize and drag-to-create.");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
