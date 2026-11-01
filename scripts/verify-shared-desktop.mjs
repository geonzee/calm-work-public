import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createOnline } from "../services/online/src/server.mjs";
import { openStore } from "../services/online/src/store.mjs";
const require = createRequire(import.meta.url),
  {
    _electron: electron,
  } = require("../output/upstream/node_modules/@playwright/test");
const directory = await mkdtemp("/tmp/calm-shared-desktop-");
process.env.CALM_ONLINE_DATABASE_URL = "file:" + join(directory, "db.sqlite");
execFileSync(
  resolve("services/online/node_modules/.bin/prisma"),
  [
    "db",
    "push",
    "--skip-generate",
    "--schema",
    resolve("services/online/prisma/schema.prisma"),
  ],
  { stdio: "pipe" },
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const origin = "http://127.0.0.1:" + port,
  owner = "synthetic-shared-desktop-owner-token-long-enough";
const store = await openStore(),
  service = await createOnline({
    store,
    ownerToken: owner,
    publicOrigin: origin,
  });
await service.listen({ host: "127.0.0.1", port });
async function api(method, url, payload, token = owner) {
  const r = await fetch(origin + url, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
const workspace = await api("POST", "/api/workspaces", { name: "Design team" }),
  project = await api(
    "POST",
    `/api/workspaces/${workspace.id}/projects`,
    { name: "Release" },
    workspace.memberToken,
  ),
  member = await api(
    "POST",
    `/api/workspaces/${workspace.id}/members`,
    { name: "Editor", role: "editor" },
    workspace.memberToken,
  );
const today = new Date().toLocaleDateString("en-CA");
async function remote() {
  return api(
    "GET",
    `/api/workspaces/${workspace.id}`,
    null,
    workspace.memberToken,
  );
}
async function remoteTask(task) {
  const current = await remote();
  return api(
    "POST",
    `/api/workspaces/${workspace.id}/operations`,
    {
      id: crypto.randomUUID(),
      baseRevision: current.projectRevision,
      projectId: project.id,
      kind: "task.upsert",
      task,
    },
    workspace.memberToken,
  );
}
await remoteTask({
  id: "shared-task",
  title: "Shared release task",
  done: false,
  plannedDate: today,
  plannedFor: null,
  estimateMinutes: 25,
  notes: "Team notes",
  assignee: member.memberId,
});
let app;
const errors = [];
const watchdog = setTimeout(() => {
  console.error("Native shared test exceeded five minutes");
  process.exit(1);
}, 300000);
async function launch() {
  app = await electron.launch({
    executablePath: resolve("scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: join(directory, "profile") },
  });
  const page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await app.evaluate(({ safeStorage }) => {
    const c = process.getBuiltinModule("crypto"),
      key = Buffer.alloc(32, 7);
    safeStorage.isEncryptionAvailable = () => true;
    safeStorage.getSelectedStorageBackend = () => "gnome_libsecret";
    safeStorage.encryptString = (value) => {
      const iv = c.randomBytes(12),
        cipher = c.createCipheriv("aes-256-gcm", key, iv),
        data = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    };
    safeStorage.decryptString = (bytes) => {
      const decipher = c.createDecipheriv(
        "aes-256-gcm",
        key,
        bytes.subarray(0, 12),
      );
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString();
    };
  });
  const frame = page.frameLocator('iframe[title="Calm Work"]');
  await frame.locator("#global-add").waitFor({ timeout: 60000 });
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 100 && !CalmRuntime.ready(); i++)
      await new Promise((r) => setTimeout(r, 50));
  });
  return { page, frame };
}
try {
  let { page, frame } = await launch();
  await frame.locator("body").evaluate(async () => {
    projects.push("Personal");
    tasks.push({
      id: "private-task",
      title: "Never upload this personal task",
      project: "Personal",
      date: calmToday(),
      schedule: "",
      estimate: 15,
      done: false,
      today: true,
    });
    await CalmRuntime.flush();
    show("modules");
  });
  await page.evaluate(() => {
    const service = window.ng.getComponent(
      document.querySelector("calm-shell"),
    )._workspace;
    const put = service._put.bind(service);
    service._put = async (key, value) => {
      if (value.kind === "task" && value.alias?.startsWith("shared:"))
        throw new Error("Synthetic interrupted shared projection");
      return put(key, value);
    };
  });
  await frame
    .locator('#connect-shared-workspace input[name="link"]')
    .fill(`${origin}/team/${workspace.id}#member=${member.memberToken}`);
  await frame
    .getByRole("button", { name: "Connect workspace", exact: true })
    .click();
  await frame
    .getByText("Synthetic interrupted shared projection", { exact: true })
    .waitFor({ timeout: 20000 });
  await page.evaluate(async () => {
    await window.ng
      .getComponent(document.querySelector("calm-shell"))
      ._workspace._writes.flushPendingWrites();
  });
  await app.evaluate(({ app }) => app.exit(0));
  app = null;
  ({ page, frame } = await launch());
  await frame.locator("body").evaluate(async () => {
    for (
      let i = 0;
      i < 100 && !CalmRuntime.teamStatus().connections.length;
      i++
    )
      await new Promise((r) => setTimeout(r, 50));
    await CalmRuntime.team({
      action: "sync",
      connectionId: CalmRuntime.teamStatus().connections[0].id,
    });
  });
  console.log(
    "PASS: interrupted native shared projection resumes after restart without duplicate tasks",
  );
  await frame.locator("body").evaluate(async () => {
    for (let i = 0; i < 200 && !tasks.some((t) => t.shared); i++)
      await new Promise((r) => setTimeout(r, 50));
  });
  let snapshot = await frame
    .locator("body")
    .evaluate(() => CalmRuntime.snapshot());
  assert.equal(snapshot.tasks.length, 2);
  const shared = snapshot.tasks.find((t) => t.shared);
  assert.ok(shared);
  const connectionId = shared.shared.connectionId;
  assert.equal(JSON.stringify(await remote()).includes("Never upload"), false);
  await frame.locator("body").evaluate(() => {
    show("track");
    openTask(tasks.find((t) => t.shared).id, true);
  });
  await frame
    .locator("#detail-notes")
    .fill("Edited from ordinary task details");
  await frame.locator('[name="schedule-time"]').fill("09:30");
  await frame.locator('[name="estimate"]').fill("12.5");
  assert.equal(
    await frame.locator("#detail-project-search").isDisabled(),
    true,
  );
  await frame.locator("#drawer-save").click();
  await frame.locator("#drawer").waitFor({ state: "hidden", timeout: 5000 });
  console.log(
    "PASS: shared task editor accepts fractional estimates and closes after save",
  );
  await frame.locator("body").evaluate(() => {
    document.activeElement?.blur();
    return CalmRuntime.flush();
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  let current = (await remote()).projects[0].tasks[0];
  assert.equal(current.notes, "Edited from ordinary task details");
  assert.equal(current.estimateMinutes, 12.5);
  assert.ok(current.plannedFor);
  await remoteTask({
    ...current,
    title: "Renamed by teammate",
    plannedFor: null,
    plannedDate: today,
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  assert.equal(
    await frame
      .locator("body")
      .evaluate(() => tasks.find((t) => t.shared).title),
    "Renamed by teammate",
  );
  await frame.locator("body").evaluate(async () => {
    const shared = tasks.find((t) => t.shared);
    startTask(shared.id, { fromTray: true });
    await CalmRuntime.flush();
  });
  await new Promise((r) => setTimeout(r, 1100));
  await frame.locator("body").evaluate(async () => {
    document.getElementById("header-pause").click();
    await CalmRuntime.flush();
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  current = (await remote()).projects[0].tasks[0];
  await remoteTask({ ...current, done: true });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  snapshot = await frame.locator("body").evaluate(() => CalmRuntime.snapshot());
  if (snapshot.clock)
    console.log(
      "Completion diagnostic",
      JSON.stringify(
        await frame.locator("body").evaluate(() => ({
          status: CalmRuntime.teamStatus(),
          tasks,
          active: state.active,
        })),
        null,
        2,
      ),
    );
  assert.equal(snapshot.clock, null);
  assert.equal(snapshot.tasks.find((t) => t.shared).done, true);
  assert.equal(snapshot.sessions.length, 1);
  const seconds = snapshot.sessions[0].focusedSeconds;
  assert.ok(seconds >= 1);
  assert.equal(
    JSON.stringify(await remote()).includes("focusedSeconds"),
    false,
  );
  await frame.locator("body").evaluate(() => {
    state.projectName = tasks.find((t) => t.shared).project;
    show("project");
  });
  await frame.locator("#global-add").click();
  await frame.locator("#add-title").fill("Captured into the shared project");
  await frame.locator(".add-submit").click();
  await frame.locator("body").evaluate(async () => {
    document.activeElement?.blur();
    await CalmRuntime.flush();
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  let captured = (await remote()).projects[0].tasks.find(
    (t) => t.title === "Captured into the shared project",
  );
  assert.ok(captured);
  await frame
    .locator("body")
    .evaluate(() =>
      openTask(
        tasks.find((t) => t.title === "Captured into the shared project").id,
        true,
      ),
    );
  await frame.locator("#delete-task").click();
  await frame.locator("#confirm-delete-task").click();
  await frame.locator("body").evaluate(async () => {
    document.activeElement?.blur();
    await CalmRuntime.flush();
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "sync", connectionId: id }),
      connectionId,
    );
  assert.equal(
    (await remote()).projects[0].tasks.some((t) => t.id === captured.id),
    false,
  );
  console.log(
    "PASS: global capture shares only deliberately mapped tasks and ordinary deletion reaches the shared workspace",
  );
  await frame.locator("body").evaluate(async () => {
    show("modules");
    document.activeElement?.blur();
  });
  await frame
    .locator("body")
    .evaluate(
      (_el, id) => CalmRuntime.team({ action: "disconnect", connectionId: id }),
      connectionId,
    );
  snapshot = await frame.locator("body").evaluate(() => CalmRuntime.snapshot());
  assert.equal(
    snapshot.tasks.some((t) => t.shared),
    false,
  );
  assert.equal(snapshot.sessions[0].focusedSeconds, seconds);
  assert.equal(snapshot.tasks.length, 2);
  await app.evaluate(({ shell }) => {
    shell.openExternal = async (url) => {
      globalThis.__calmOpenedService = url;
    };
  });
  await frame.locator("body").evaluate(() => show("bookings"));
  await frame
    .getByRole("heading", { name: "Booking pages", exact: true })
    .waitFor();
  await frame.locator("#open-online-module").click();
  await frame.locator("#online-service-form").waitFor();
  await frame.locator('#online-service-form [name="origin"]').fill(origin);
  await frame.locator("#online-service-form button").click();
  for (
    let i = 0;
    i < 100 &&
    (await app.evaluate(() => globalThis.__calmOpenedService)) !== origin;
    i++
  )
    await new Promise((r) => setTimeout(r, 50));
  assert.equal(
    await app.evaluate(() => globalThis.__calmOpenedService),
    origin,
  );
  for (const view of ["bookings", "polls", "team"]) {
    await app.evaluate(() => {
      globalThis.__calmOpenedService = "";
    });
    await frame.locator("body").evaluate((_el, view) => show(view), view);
    await frame.locator("#open-online-module").click();
    for (
      let i = 0;
      i < 100 &&
      (await app.evaluate(() => globalThis.__calmOpenedService)) !== origin;
      i++
    )
      await new Promise((r) => setTimeout(r, 50));
    assert.equal(
      await app.evaluate(() => globalThis.__calmOpenedService),
      origin,
    );
  }
  console.log(
    "PASS: native Booking, Polls and Team link to the configured functional service without preview actions",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: native shared connection imports one task model, excludes personal tasks/time from uploads, syncs ordinary edits/planning/estimates and remote completion, saves private tracked time and keeps local history on disconnect.",
  );
} finally {
  clearTimeout(watchdog);
  if (app) await app.close();
  await service.close();
  await store.close();
  await rm(directory, { recursive: true, force: true });
}
