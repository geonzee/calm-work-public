// Time-block write-back against in-memory Google Calendar and Microsoft Graph fakes.
// No real account, token or calendar is used.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("../output/upstream/node_modules/typescript");
const vm = require("node:vm");
const compiled = ts.transpileModule(
  require("node:fs").readFileSync(path.join(__dirname, "../apps/desktop/native/calm-calendar.ts"), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, {
  exports: mod.exports, require, Buffer, URL, URLSearchParams, AbortSignal, fetch,
  setTimeout, clearTimeout, console, Intl, Date,
});
const { CalmCalendar } = mod.exports;
const KEY_PROP = "String {9d5f6c2e-3b8a-4f7e-9c1d-6a2b4e8f0c31} Name calmWorkKey";

function fakeProviders() {
  const world = {
    google: {
      calendars: [
        { id: "person@example.com", summary: "Ada", accessRole: "owner", primary: true },
        { id: "example-team", summary: "Example team", accessRole: "writer" },
        { id: "holidays", summary: "Holidays", accessRole: "reader", backgroundColor: "#16a765" },
      ],
      events: {}, // calendarId -> Map(id -> event)
      createdCalendars: 0,
    },
    graph: {
      calendars: [
        { id: "ms-cal", name: "Calendar", canEdit: true, isDefaultCalendar: true, hexColor: "#0078d4" },
        { id: "ms-shared", name: "Team (shared)", canEdit: false, color: "lightGreen" },
      ],
      events: new Map(),
    },
    writes: [],
    ifMatch: [],
    etag: 0,
    fail: null, // (method, url) => status | null
    ambiguous: false,
  };
  const gEvents = (cal) => (world.google.events[cal] ||= new Map());
  const fetcher = async (href, options = {}) => {
    const url = new URL(href);
    const method = options.method || "GET";
    if (url.pathname.endsWith("/token"))
      return Response.json({
        access_token: "access-" + crypto.randomUUID(),
        refresh_token: "refresh-" + crypto.randomUUID(),
        expires_in: 3600,
        scope: url.hostname.includes("google")
          ? "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.owned https://www.googleapis.com/auth/calendar.app.created"
          : "https://graph.microsoft.com/Calendars.ReadWrite",
      });
    if (method !== "GET") world.writes.push({ method, host: url.hostname, path: decodeURIComponent(url.pathname) });
    const forced = world.fail?.(method, url);
    if (forced) return new Response("{}", { status: forced });
    const body = options.body ? JSON.parse(options.body) : null;
    const ifMatch = options.headers?.["If-Match"];
    world.ifMatch.push(ifMatch || null);
    if (url.hostname === "www.googleapis.com") {
      const p = decodeURIComponent(url.pathname).replace("/calendar/v3", "");
      if (p === "/users/me/calendarList") return Response.json({ items: world.google.calendars });
      if (p === "/calendars" && method === "POST") {
        const id = "calm-" + ++world.google.createdCalendars + "@group.calendar.google.com";
        world.google.calendars.push({ id, summary: body.summary, accessRole: "owner" });
        return Response.json({ id, summary: body.summary });
      }
      const mv = p.match(/^\/calendars\/([^/]+)\/events\/([^/]+)\/move$/);
      if (mv && method === "POST") {
        const from = gEvents(mv[1]), event = from.get(mv[2]);
        if (!event) return new Response("{}", { status: 404 });
        if (ifMatch && ifMatch !== event.etag) return new Response("{}", { status: 412 });
        const dest = url.searchParams.get("destination");
        from.delete(mv[2]);
        event.etag = '"' + ++world.etag + '"';
        gEvents(dest).set(event.id, event);
        return Response.json(event);
      }
      const m = p.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
      if (!m) return new Response("{}", { status: 404 });
      const [, cal, id] = m;
      const store = gEvents(cal);
      if (!world.google.calendars.some((c) => c.id === cal)) return new Response("{}", { status: 404 });
      if (method === "GET" && !id) return Response.json({ items: [...store.values()] });
      if (method === "POST") {
        const owner = ["owner", "writer"].includes(world.google.calendars.find((c) => c.id === cal).accessRole);
        if (!owner) return new Response("{}", { status: 403 });
        const newId = body.id || "g" + crypto.randomUUID().replace(/-/g, "");
        if (store.has(newId)) return new Response("{}", { status: 409 });
        store.set(newId, { ...body, id: newId, status: "confirmed", etag: '"' + ++world.etag + '"' });
        if (world.ambiguous) { world.ambiguous = false; return new Response("{}", { status: 503 }); }
        return Response.json(store.get(newId));
      }
      const event = store.get(id);
      if (!event) return new Response("{}", { status: 404 });
      if (method === "GET") return Response.json(event);
      if (ifMatch && ifMatch !== event.etag) return new Response("{}", { status: 412 });
      if (method === "PATCH") { Object.assign(event, body); event.etag = '"' + ++world.etag + '"'; return Response.json(event); }
      if (method === "DELETE") { store.delete(id); return new Response(null, { status: 204 }); }
    }
    if (url.hostname === "graph.microsoft.com") {
      const p = decodeURIComponent(url.pathname).replace("/v1.0", "");
      if (p === "/me/calendars") return Response.json({ value: world.graph.calendars });
      let m = p.match(/^\/me\/calendars\/([^/]+)\/(events|calendarView)$/);
      if (m && method === "GET") {
        const filter = url.searchParams.get("$filter") || "";
        const key = filter.match(/ep\/value eq '([^']+)'/)?.[1];
        const items = [...world.graph.events.values()].filter((e) => e.calendar === m[1] &&
          (!key || e.singleValueExtendedProperties?.some((x) => x.value === key)));
        return Response.json({ value: items });
      }
      if (m && method === "POST") {
        const id = "ms-" + crypto.randomUUID();
        world.graph.events.set(id, { ...body, id, calendar: m[1], "@odata.etag": 'W/"' + ++world.etag + '"' });
        return Response.json(world.graph.events.get(id));
      }
      m = p.match(/^\/me\/events\/([^/]+)$/) || p.match(/^\/me\/calendars\/[^/]+\/events\/([^/]+)$/);
      if (m) {
        const event = world.graph.events.get(m[1]);
        if (!event) return new Response("{}", { status: 404 });
        if (method === "GET") return Response.json(event);
        if (ifMatch && ifMatch !== event["@odata.etag"]) return new Response("{}", { status: 412 });
        if (method === "PATCH") { Object.assign(event, body); event["@odata.etag"] = 'W/"' + ++world.etag + '"'; return Response.json(event); }
        if (method === "DELETE") { world.graph.events.delete(m[1]); return new Response(null, { status: 204 }); }
      }
    }
    return new Response("{}", { status: 404 });
  };
  return { world, fetcher };
}

async function setup() {
  const directory = await fs.mkdtemp("/tmp/calm-mirror-");
  const key = crypto.randomBytes(32);
  const { world, fetcher } = fakeProviders();
  const deps = {
    directory,
    timeoutMs: 1500,
    fetch: fetcher,
    vault: {
      available: () => true,
      encrypt: (value) => {
        const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv);
        const bytes = Buffer.concat([c.update(value), c.final()]);
        return Buffer.concat([iv, c.getAuthTag(), bytes]);
      },
      decrypt: (value) => {
        const c = crypto.createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
        c.setAuthTag(value.subarray(12, 28));
        return Buffer.concat([c.update(value.subarray(28)), c.final()]).toString();
      },
    },
    openExternal: async (href) => {
      const auth = new URL(href);
      await fetch(auth.searchParams.get("redirect_uri") + "?state=" + auth.searchParams.get("state") + "&code=ok");
    },
  };
  const client = new CalmCalendar(deps);
  return { world, deps, client, close: async () => { client.cancel(); await fs.rm(directory, { recursive: true, force: true }); } };
}
const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
const block = (over = {}) => ({ taskId: "t1", title: "Write proposal", date: tomorrow, start: "09:30", minutes: 45, target: "", ...over });
const gioEvents = (world) => [...(world.google.events["person@example.com"]?.values() || [])];
const calmCal = (world) => world.google.calendars.find((c) => c.summary === "Calm Work")?.id;
const calmEvents = (world) => [...(world.google.events[calmCal(world)]?.values() || [])];
const SP_GOOGLE = [{ accountId: "google", accessToken: "sp-held-token" }];
/** Google is signed in through SP's plugin; the shell lends its token with each command. */
async function connectGoogle(client, world) {
  if (world && !world.google.calendars.some((c) => c.summary === "Calm Work"))
    world.google.calendars.push({ id: "calm-1@group.calendar.google.com", summary: "Calm Work", accessRole: "owner", backgroundColor: "#4f6bed" });
  return client.command({ action: "refresh", provider: "google", accountId: "google", google: SP_GOOGLE });
}

test("default target is Ada's own Calm Work calendar; it is never created by the app", async () => {
  const c = await setup();
  try {
    // Without the calendar: nothing is written, and the block says what to do.
    await connectGoogle(c.client);
    let status = await c.client.command({ action: "mirror-sync", blocks: [block()] });
    assert.equal(c.world.writes.length, 0);
    assert.match(status.mirror.tasks.t1.error || "", /Create a calendar named "Calm Work"/);
    await connectGoogle(c.client, c.world);
    status = await c.client.command({ action: "mirror-sync", blocks: [block(), block({ taskId: "t2", start: "11:00" })] });
    assert.equal(c.world.google.createdCalendars, 0);
    const events = calmEvents(c.world);
    assert.equal(events.length, 2);
    for (const e of events) {
      assert.equal(e.extendedProperties.private.calmWork, "1");
      assert.match(e.extendedProperties.private.spTaskId, /^calm-work:/, "SP's plugin hides it from its agenda");
      assert.match(e.id, /^[0-9a-f]{40}$/);
      assert.equal(e.reminders.useDefault, false);
    }
    assert.equal(gioEvents(c.world).length, 0, "primary calendar untouched");
    assert.equal(status.mirror.pending, 0);
    assert.match(status.mirror.defaultLabel, /Calm Work/);
    // Picker targets: synced writable calendars only (example-team is writable but not ticked yet).
    const keys = status.mirror.targets.map((t) => t.key);
    assert.ok(keys.includes("google|person@example.com"));
    assert.ok(!keys.some((k) => k.includes("example-team") || k.includes("holidays")));
    // Same blocks again: no new writes; own events are not shown as provider events.
    const writes = c.world.writes.length;
    await c.client.command({ action: "refresh", provider: "google", accountId: "google" });
    status = await c.client.command({ action: "mirror-sync", blocks: [block(), block({ taskId: "t2", start: "11:00" })] });
    assert.equal(c.world.writes.length, writes);
    assert.equal(c.world.google.createdCalendars, 0);
    assert.equal(status.events.filter((e) => /Write proposal/.test(e.title)).length, 0);
  } finally { await c.close(); }
});

test("reschedule and resize patch the same event; removing the block deletes it", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    await c.client.command({ action: "mirror-sync", blocks: [block()] });
    const id = calmEvents(c.world)[0].id;
    await c.client.command({ action: "mirror-sync", blocks: [block({ start: "14:00", minutes: 90, title: "Write proposal v2" })] });
    const [e] = calmEvents(c.world);
    assert.equal(e.id, id);
    assert.equal(e.summary, "Write proposal v2");
    assert.equal((new Date(e.end.dateTime) - new Date(e.start.dateTime)) / 60000, 90);
    assert.equal(new Date(e.start.dateTime).getHours(), 14);
    await c.client.command({ action: "mirror-sync", blocks: [] });
    assert.equal(calmEvents(c.world).length, 0);
  } finally { await c.close(); }
});

test("edits made in Google are kept, shown as a conflict, and only replaced on request", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    await c.client.command({ action: "mirror-sync", blocks: [block()] });
    const e = calmEvents(c.world)[0];
    const moved = new Date(e.start.dateTime); moved.setHours(16, 0, 0, 0);
    e.start = { dateTime: moved.toISOString() };
    e.end = { dateTime: new Date(+moved + 30 * 60000).toISOString() };
    const patches = () => c.world.writes.filter((w) => w.method === "PATCH").length;
    let status = await c.client.command({ action: "mirror-sync", blocks: [block({ start: "10:00" })] });
    assert.equal(patches(), 0, "Ada's edit is not overwritten");
    assert.equal(status.mirror.tasks.t1.state, "conflict");
    assert.equal(status.mirror.tasks.t1.conflict.start, "16:00");
    assert.equal(status.mirror.tasks.t1.conflict.minutes, 30);
    // Keep the calendar version: the app returns the plan to apply locally.
    status = await c.client.command({ action: "mirror-resolve", taskId: "t1", choice: "calendar" });
    assert.deepEqual({ start: status.adopted.start, minutes: status.adopted.minutes }, { start: "16:00", minutes: 30 });
    status = await c.client.command({ action: "mirror-sync", blocks: [block({ start: "16:00", minutes: 30 })] });
    assert.equal(patches(), 0);
    assert.equal(status.mirror.tasks.t1.state, "synced");
    // A second edit, then explicit "use my plan" overwrites it.
    calmEvents(c.world)[0].summary = "Renamed in Google";
    await c.client.command({ action: "mirror-sync", blocks: [block({ start: "17:00", minutes: 30 })] });
    assert.equal(patches(), 0);
    await c.client.command({ action: "mirror-resolve", taskId: "t1", choice: "plan" });
    assert.equal(patches(), 1);
    assert.equal(calmEvents(c.world)[0].summary, "Write proposal");
    assert.equal(new Date(calmEvents(c.world)[0].start.dateTime).getHours(), 17);
  } finally { await c.close(); }
});

test("an event Ada deleted or edited is not recreated or deleted automatically", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    await c.client.command({ action: "mirror-sync", blocks: [block(), block({ taskId: "t2", start: "12:00" })] });
    const [first, second] = calmEvents(c.world);
    c.world.google.events[calmCal(c.world)].delete(first.id);
    second.summary = "Edited";
    let status = await c.client.command({ action: "mirror-sync", blocks: [block({ start: "09:45" })] });
    assert.equal(status.mirror.tasks.t1.state, "conflict");
    assert.equal(status.mirror.tasks.t1.conflict.removed, true);
    assert.equal(calmEvents(c.world).length, 1, "removed event not recreated; edited event kept");
    assert.equal(calmEvents(c.world)[0].summary, "Edited");
    assert.equal(c.world.writes.filter((w) => w.method === "DELETE").length, 0);
  } finally { await c.close(); }
});

test("moving a block to Microsoft 365 deletes the Google event and creates a marked Graph event", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    await c.client.command({ action: "connect", provider: "microsoft", clientId: "ms-desktop-client" });
    await c.client.command({ action: "mirror-sync", blocks: [block()] });
    assert.equal(calmEvents(c.world).length, 1);
    const status = await c.client.command({ action: "mirror-sync", blocks: [block({ target: "microsoft|ms-cal" })] });
    assert.equal(calmEvents(c.world).length, 0);
    const graph = [...c.world.graph.events.values()];
    assert.equal(graph.length, 1);
    assert.equal(graph[0].singleValueExtendedProperties[0].id, KEY_PROP);
    assert.match(graph[0].transactionId, /^[0-9a-f-]{36}$/);
    assert.equal(graph[0].start.timeZone, "UTC");
    assert.match(status.mirror.tasks.t1.calendar, /Microsoft 365/);
    // Resize in Graph via PATCH on the same event.
    await c.client.command({ action: "mirror-sync", blocks: [block({ target: "microsoft|ms-cal", minutes: 60 })] });
    assert.equal(c.world.graph.events.size, 1);
    assert.equal(c.world.writes.filter((w) => w.host === "graph.microsoft.com" && w.method === "PATCH").length, 1);
  } finally { await c.close(); }
});

test("failures stay queued with backoff and retries never duplicate events", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    c.world.fail = (method) => (method === "POST" ? 503 : null);
    let status = await c.client.command({ action: "mirror-sync", blocks: [block()] });
    assert.equal(status.mirror.pending, 1);
    assert.equal(status.mirror.tasks.t1.state, "pending");
    assert.equal(status.mirror.tasks.t1.retry, 1);
    // Restart: the queue survives in the encrypted vault.
    const restarted = new CalmCalendar(c.deps);
    status = await restarted.command({ action: "status", google: SP_GOOGLE });
    assert.equal(status.mirror.pending, 1);
    c.world.fail = null;
    c.world.ambiguous = true; // provider stores the event but the response is lost
    restarted.mirror.outbox.t1.nextAt = 0;
    await restarted.command({ action: "mirror-sync", blocks: [block()], google: SP_GOOGLE });
    restarted.mirror.outbox.t1 && (restarted.mirror.outbox.t1.nextAt = 0);
    status = await restarted.command({ action: "mirror-sync", blocks: [block()], google: SP_GOOGLE });
    assert.equal(calmEvents(c.world).length, 1, "ambiguous create adopted, not duplicated");
    assert.equal(status.mirror.pending, 0);
    restarted.cancel();
  } finally { await c.close(); }
});

test("never touches events without the Calm Work marker, read-only grants or unowned calendars", async () => {
  const c = await setup();
  try {
    await connectGoogle(c.client, c.world);
    await c.client.command({ action: "mirror-sync", blocks: [block()] });
    const e = calmEvents(c.world)[0];
    delete e.extendedProperties; // somebody else's event now
    const before = c.world.writes.length;
    await c.client.command({ action: "mirror-sync", blocks: [] });
    assert.equal(c.world.writes.length, before, "foreign event not deleted");
    assert.equal(calmEvents(c.world).length, 1);
    // A non-owned calendar is never a target.
    await c.client.command({ action: "mirror-sync", blocks: [block({ taskId: "t9", target: "google|holidays" })] });
    assert.equal(c.world.writes.length, before);
    await assert.rejects(c.client.command({ action: "mirror-settings", target: "google|holidays" }), /write to/);
    await assert.rejects(c.client.command({ action: "mirror-settings", target: "google|example-team" }), /write to/, "unsynced calendars are not offered");
    // Older read-only grant: nothing is written.
    c.client.credentials.google.scope = "https://www.googleapis.com/auth/calendar.readonly";
    await c.client.command({ action: "mirror-sync", blocks: [block({ taskId: "t3" })] });
    assert.equal(c.world.writes.length, before);
    // Disabled: nothing is written.
    c.client.credentials.google.scope = undefined;
  } finally { await c.close(); }
});

test("Microsoft uses the example tenant until a directory is saved", async () => {
  const c = await setup();
  let authorizeUrl;
  c.deps.openExternal = async (href) => {
    authorizeUrl = new URL(href);
    await fetch(authorizeUrl.searchParams.get("redirect_uri") + "?state=" + authorizeUrl.searchParams.get("state") + "&code=ok");
  };
  try {
    const client = new CalmCalendar(c.deps);
    await client.command({ action: "connect", provider: "microsoft", clientId: "ms-desktop-client" });
    assert.match(authorizeUrl.pathname, /^\/contoso\.onmicrosoft\.com\//);
    await client.command({ action: "configure", provider: "microsoft", clientId: "ms-desktop-client", tenant: "fabrikam.onmicrosoft.com" });
    await client.command({ action: "connect", provider: "microsoft", clientId: "ms-desktop-client" });
    assert.match(authorizeUrl.pathname, /^\/fabrikam\.onmicrosoft\.com\//);
    await assert.rejects(client.command({ action: "configure", provider: "microsoft", clientId: "ms-desktop-client", tenant: "bad/tenant" }), /tenant/);
    client.cancel();
  } finally { await c.close(); }
});

// ---------------------------------------------------------------------------
// Full event editing against the same fakes: etag/If-Match, conflicts,
// recurring scope, calendar moves, read-only and per-account calendar choice.
const at = (h, m = 0, days = 1) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return +d; };
const gioRef = (eventId, calendarId = "person@example.com") => ({ accountId: "google", calendarId, eventId });
const viewOf = (v) => ({ title: v.title, description: v.description, location: v.location, startMs: v.startMs, endMs: v.endMs });
async function editing() {
  const c = await setup();
  await connectGoogle(c.client, c.world);
  return c;
}

test("calendar choice per account: main calendar on, new ones off, Calm Work always, remembered", async () => {
  const c = await editing();
  try {
    let status = await c.client.command({ action: "status", google: SP_GOOGLE });
    const cals = Object.fromEntries(status.calendars.google.map((x) => [x.id, x]));
    assert.equal(cals["person@example.com"].synced, true);
    assert.equal(cals["example-team"].synced, false);
    assert.equal(cals["calm-1@group.calendar.google.com"].synced, true);
    assert.equal(cals["calm-1@group.calendar.google.com"].calm, true);
    assert.equal(cals.holidays.canWrite, false);
    assert.equal(cals.holidays.color, "#16a765");
    assert.equal(cals["example-team"].canWrite, true, "writer calendars are editable");
    await assert.rejects(c.client.command({ action: "calendar-select", accountId: "google", calendarId: "calm-1@group.calendar.google.com", enabled: false }), /always synced/);
    await c.client.command({ action: "calendar-select", accountId: "google", calendarId: "example-team", enabled: true });
    // A calendar discovered later starts unticked; earlier choices survive a restart.
    c.world.google.calendars.push({ id: "new-cal", summary: "New", accessRole: "owner" });
    const restarted = new CalmCalendar(c.deps);
    status = await restarted.command({ action: "refresh", provider: "google", accountId: "google", google: SP_GOOGLE });
    const after = Object.fromEntries(status.calendars.google.map((x) => [x.id, x]));
    assert.equal(after["example-team"].synced, true);
    assert.equal(after["new-cal"].synced, false);
    assert.ok(status.mirror.targets.some((t) => t.key === "google|example-team"));
    assert.ok(!status.mirror.targets.some((t) => t.key === "google|new-cal"), "unsynced calendars are not offered");
    // SP's token is lent per command and never written to the vault.
    const raw = c.deps.vault.decrypt(await fs.readFile(path.join(c.deps.directory, "calendar-vault")));
    assert.ok(!raw.includes("sp-held-token"));
    restarted.cancel();
  } finally { await c.close(); }
});

test("Google: create, edit and delete with If-Match; read-only and unsynced calendars refuse writes", async () => {
  const c = await editing();
  try {
    let result = await c.client.command({ action: "event-create", event: { accountId: "google", calendarId: "person@example.com", title: "Dentist", description: "Bring card", location: "Via Roma 1", startMs: at(10), endMs: at(11) } });
    const id = result.saved.eventId;
    assert.equal(result.saved.location, "Via Roma 1");
    assert.equal(result.saved.editable, true);
    const view = await c.client.command({ action: "event-get", ref: gioRef(id) });
    result = await c.client.command({ action: "event-update", ref: gioRef(id), base: viewOf(view.event), changes: { title: "Dentist (moved)", startMs: at(15), endMs: at(16) } });
    assert.equal(result.saved.title, "Dentist (moved)");
    assert.equal(new Date(result.saved.startMs).getHours(), 15);
    assert.ok(c.world.ifMatch.filter(Boolean).length >= 1, "PATCH carried If-Match");
    const fresh = (await c.client.command({ action: "event-get", ref: gioRef(id) })).event;
    result = await c.client.command({ action: "event-delete", ref: gioRef(id), base: viewOf(fresh) });
    assert.equal(result.deleted, true);
    assert.equal(c.world.google.events["person@example.com"].size, 0);
    // Read-only calendar.
    c.world.google.events.holidays = new Map([["h1", { id: "h1", summary: "Holiday", start: { date: "2026-12-25" }, end: { date: "2026-12-26" }, etag: '"1"' }]]);
    await c.client.command({ action: "calendar-select", accountId: "google", calendarId: "holidays", enabled: true });
    const writes = c.world.writes.length;
    await assert.rejects(c.client.command({ action: "event-update", ref: gioRef("h1", "holidays"), base: {}, changes: { title: "x" } }), /read-only/);
    await assert.rejects(c.client.command({ action: "event-create", event: { accountId: "google", calendarId: "holidays", title: "x", startMs: at(9), endMs: at(10) } }), /read-only/);
    // Writable but not synced.
    await assert.rejects(c.client.command({ action: "event-create", event: { accountId: "google", calendarId: "example-team", title: "x", startMs: at(9), endMs: at(10) } }), /Settings/);
    assert.equal(c.world.writes.length, writes, "nothing written");
  } finally { await c.close(); }
});

test("conflicts: a change made elsewhere is returned, never overwritten (compare and 412)", async () => {
  const c = await editing();
  try {
    const { saved } = await c.client.command({ action: "event-create", event: { accountId: "google", calendarId: "person@example.com", title: "Review", startMs: at(9), endMs: at(10) } });
    const base = viewOf((await c.client.command({ action: "event-get", ref: gioRef(saved.eventId) })).event);
    const stored = c.world.google.events["person@example.com"].get(saved.eventId);
    // Edited in Google after the editor opened.
    stored.summary = "Review (Ada renamed)"; stored.etag = '"99"';
    const patches = () => c.world.writes.filter((w) => w.method === "PATCH").length;
    let result = await c.client.command({ action: "event-update", ref: gioRef(saved.eventId), base, changes: { title: "Mine" } });
    assert.equal(result.conflict.title, "Review (Ada renamed)");
    assert.equal(patches(), 0);
    // Race: the provider changes between our read and our write -> 412 -> newer version.
    const base2 = viewOf(result.conflict);
    c.world.fail = (method) => { if (method === "PATCH") { stored.summary = "Changed again"; stored.etag = '"100"'; c.world.fail = null; return 412; } return null; };
    result = await c.client.command({ action: "event-update", ref: gioRef(saved.eventId), base: base2, changes: { title: "Mine" } });
    assert.equal(result.conflict.title, "Changed again");
    assert.equal(stored.summary, "Changed again");
    // Delete also refuses a stale view; a removed event is reported as removed.
    result = await c.client.command({ action: "event-delete", ref: gioRef(saved.eventId), base: base2 });
    assert.ok(result.conflict);
    assert.equal(c.world.google.events["person@example.com"].size, 1);
    c.world.google.events["person@example.com"].clear();
    result = await c.client.command({ action: "event-update", ref: gioRef(saved.eventId), base: base2, changes: { title: "x" } });
    assert.equal(result.conflict.removed, true);
  } finally { await c.close(); }
});

test("recurring: this occurrence by default; whole series shifts the master by the same amount", async () => {
  const c = await editing();
  try {
    const store = (c.world.google.events["person@example.com"] = new Map());
    store.set("rec", { id: "rec", summary: "Standup", recurrence: ["RRULE:FREQ=DAILY"], start: { dateTime: new Date(at(9)).toISOString() }, end: { dateTime: new Date(at(9, 15)).toISOString() }, etag: '"m1"' });
    store.set("rec_1", { id: "rec_1", recurringEventId: "rec", summary: "Standup", start: { dateTime: new Date(at(9)).toISOString() }, end: { dateTime: new Date(at(9, 15)).toISOString() }, etag: '"i1"' });
    const view = (await c.client.command({ action: "event-get", ref: gioRef("rec_1") })).event;
    assert.equal(view.recurring, true);
    await c.client.command({ action: "event-update", ref: gioRef("rec_1"), base: viewOf(view), changes: { startMs: at(10), endMs: at(10, 15) } });
    assert.equal(new Date(store.get("rec_1").start.dateTime).getHours(), 10);
    assert.equal(new Date(store.get("rec").start.dateTime).getHours(), 9, "series untouched");
    const v2 = (await c.client.command({ action: "event-get", ref: gioRef("rec_1") })).event;
    await c.client.command({ action: "event-update", ref: gioRef("rec_1"), base: viewOf(v2), changes: { title: "Daily standup" }, scope: "series" });
    assert.equal(store.get("rec").summary, "Daily standup");
    assert.ok(c.world.ifMatch.includes('"m1"'), "series PATCH used the series etag");
    const v3 = (await c.client.command({ action: "event-get", ref: gioRef("rec_1") })).event;
    await c.client.command({ action: "event-update", ref: gioRef("rec_1"), base: viewOf(v3), changes: { startMs: at(11), endMs: at(11, 15) }, scope: "series" });
    assert.equal(new Date(store.get("rec").start.dateTime).getHours(), 10, "master moves by the occurrence delta");
    await assert.rejects(c.client.command({ action: "event-update", ref: gioRef("rec_1"), base: viewOf(v3), changes: { calendarId: "calm-1@group.calendar.google.com" } }), /stays on its calendar/);
  } finally { await c.close(); }
});

test("calendar moves: Google move API within an account; copy-then-delete across providers", async () => {
  const c = await editing();
  try {
    await c.client.command({ action: "connect", provider: "microsoft", clientId: "ms-desktop-client" });
    const { saved } = await c.client.command({ action: "event-create", event: { accountId: "google", calendarId: "person@example.com", title: "Call", startMs: at(13), endMs: at(14) } });
    let view = (await c.client.command({ action: "event-get", ref: gioRef(saved.eventId) })).event;
    let result = await c.client.command({ action: "event-update", ref: gioRef(saved.eventId), base: viewOf(view), changes: { calendarId: "calm-1@group.calendar.google.com" } });
    assert.ok(c.world.writes.some((w) => w.path.endsWith("/move")));
    assert.equal(result.saved.calendarId, "calm-1@group.calendar.google.com");
    assert.equal(c.world.google.events["person@example.com"].size, 0);
    view = (await c.client.command({ action: "event-get", ref: result.saved })).event;
    result = await c.client.command({ action: "event-update", ref: result.saved, base: viewOf(view), changes: { accountId: "microsoft", calendarId: "ms-cal" } });
    assert.equal(result.saved.accountId, "microsoft");
    assert.equal(c.world.google.events["calm-1@group.calendar.google.com"].size, 0);
    assert.equal([...c.world.graph.events.values()].filter((e) => e.subject === "Call").length, 1);
    // Meetings with guests do not move across providers.
    const g = c.world.google.events["person@example.com"];
    g.set("meet", { id: "meet", summary: "Meet", attendees: [{ email: "a@b.c" }], start: { dateTime: new Date(at(16)).toISOString() }, end: { dateTime: new Date(at(17)).toISOString() }, etag: '"g"' });
    view = (await c.client.command({ action: "event-get", ref: gioRef("meet") })).event;
    await assert.rejects(c.client.command({ action: "event-update", ref: gioRef("meet"), base: viewOf(view), changes: { accountId: "microsoft", calendarId: "ms-cal" } }), /guests/);
    assert.ok(g.has("meet"));
  } finally { await c.close(); }
});

test("Microsoft 365: editable events with ids, colour and etags; read-only and unsynced calendars", async () => {
  const c = await setup();
  try {
    await c.client.command({ action: "connect", provider: "microsoft", clientId: "ms-desktop-client" });
    c.world.graph.events.set("ev1", { id: "ev1", calendar: "ms-cal", subject: "Planning", body: { content: "Agenda" }, location: { displayName: "Room 4" }, start: { dateTime: new Date(at(10)).toISOString().replace("Z", "") }, end: { dateTime: new Date(at(11)).toISOString().replace("Z", "") }, "@odata.etag": 'W/"1"', showAs: "busy" });
    c.world.graph.events.set("sh1", { id: "sh1", calendar: "ms-shared", subject: "Team", start: { dateTime: new Date(at(12)).toISOString().replace("Z", "") }, end: { dateTime: new Date(at(13)).toISOString().replace("Z", "") }, "@odata.etag": 'W/"1"' });
    let status = await c.client.command({ action: "refresh", provider: "microsoft", accountId: "microsoft" });
    const ev = status.events.find((e) => e.eventId === "ev1");
    assert.equal(ev.editable, true);
    assert.equal(ev.location, "Room 4");
    assert.equal(ev.color, "#0078d4");
    assert.ok(!status.events.some((e) => e.eventId === "sh1"), "shared calendar is not synced until ticked");
    status = await c.client.command({ action: "calendar-select", accountId: "microsoft", calendarId: "ms-shared", enabled: true });
    const shared = status.events.find((e) => e.eventId === "sh1");
    assert.equal(shared.editable, false);
    assert.equal(status.calendars.microsoft.find((x) => x.id === "ms-shared").color, "#70ad47");
    const ref = { accountId: "microsoft", calendarId: "ms-cal", eventId: "ev1" };
    const view = (await c.client.command({ action: "event-get", ref })).event;
    assert.equal(view.description, "Agenda");
    let result = await c.client.command({ action: "event-update", ref, base: viewOf(view), changes: { location: "Room 5" } });
    assert.equal(result.saved.location, "Room 5");
    assert.ok(c.world.ifMatch.includes('W/"1"'));
    // 412 from Graph -> newer version, nothing overwritten.
    const stored = c.world.graph.events.get("ev1");
    c.world.fail = (method) => { if (method === "PATCH") { stored.subject = "Planning (Outlook)"; stored["@odata.etag"] = 'W/"9"'; c.world.fail = null; return 412; } return null; };
    result = await c.client.command({ action: "event-update", ref, base: viewOf(result.saved), changes: { title: "Mine" } });
    assert.equal(result.conflict.title, "Planning (Outlook)");
    await assert.rejects(c.client.command({ action: "event-delete", ref: { accountId: "microsoft", calendarId: "ms-shared", eventId: "sh1" }, base: {} }), /read-only/);
    result = await c.client.command({ action: "event-delete", ref, base: viewOf(result.conflict) });
    assert.equal(result.deleted, true);
    assert.ok(!c.world.graph.events.has("ev1"));
    assert.ok(c.world.graph.events.has("sh1"));
  } finally { await c.close(); }
});

test("Google sign-in is SP's: the engine refuses its retired custom Google OAuth", async () => {
  const c = await setup();
  try {
    await assert.rejects(c.client.command({ action: "connect", provider: "google", accountId: "google", clientId: "desktop-client" }), /Super Productivity/);
    const status = await c.client.command({ action: "status" });
    assert.equal(status.accounts.length, 0);
  } finally { await c.close(); }
});
