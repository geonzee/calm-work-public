const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  vm = require("node:vm"),
  { execFileSync } = require("node:child_process");
const ts = require("../output/upstream/node_modules/typescript"),
  moduleObject = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(
    require("node:fs").readFileSync(
      path.resolve(__dirname, "../apps/desktop/native/calm-team.ts"),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: moduleObject.exports,
    require,
    Buffer,
    URL,
    URLSearchParams,
    AbortSignal,
    fetch,
    structuredClone,
    Uint8Array,
  },
);
const { CalmTeam } = moduleObject.exports,
  owner = "synthetic-native-shared-owner-token-long-enough";
async function fixture() {
  const directory = await fs.mkdtemp("/tmp/calm-shared-sync-");
  process.env.CALM_ONLINE_DATABASE_URL =
    "file:" + path.join(directory, "db.sqlite");
  execFileSync(
    path.resolve(__dirname, "../services/online/node_modules/.bin/prisma"),
    [
      "db",
      "push",
      "--skip-generate",
      "--schema",
      path.resolve(__dirname, "../services/online/prisma/schema.prisma"),
    ],
    { stdio: "pipe" },
  );
  const { openStore } = await import("../services/online/src/store.mjs"),
    { createOnline } = await import("../services/online/src/server.mjs");
  const store = await openStore(),
    app = await createOnline({ store, ownerToken: owner });
  const call = async (method, url, payload, token = owner) => {
    const r = await app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { authorization: "Bearer " + token },
    });
    assert.equal(r.statusCode, 200, r.body);
    return r.json();
  };
  const w = await call("POST", "/api/workspaces", { name: "Shared" }),
    p = await call(
      "POST",
      `/api/workspaces/${w.id}/projects`,
      { name: "Alpha" },
      w.memberToken,
    );
  let revision = (
    await call("GET", `/api/workspaces/${w.id}`, null, w.memberToken)
  ).projectRevision;
  const initial = {
    id: "task-one",
    title: "Initial",
    done: false,
    plannedFor: null,
    plannedDate: "2026-10-17",
    estimateMinutes: 25,
    notes: "Shared notes",
    assignee: null,
  };
  await call(
    "POST",
    `/api/workspaces/${w.id}/operations`,
    {
      id: crypto.randomUUID(),
      baseRevision: revision,
      projectId: p.id,
      kind: "task.upsert",
      task: initial,
    },
    w.memberToken,
  );
  const member = await call(
    "POST",
    `/api/workspaces/${w.id}/members`,
    { name: "Editor", role: "editor" },
    w.memberToken,
  );
  const key = crypto.randomBytes(32);
  let offline = false,
    loseAfter = false,
    failBefore = false;
  const deps = {
    directory: path.join(directory, "native"),
    vault: {
      available: () => true,
      encrypt: (value) => {
        const iv = crypto.randomBytes(12),
          cipher = crypto.createCipheriv("aes-256-gcm", key, iv),
          body = Buffer.concat([cipher.update(value), cipher.final()]);
        return Buffer.concat([iv, cipher.getAuthTag(), body]);
      },
      decrypt: (bytes) => {
        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          key,
          bytes.subarray(0, 12),
        );
        decipher.setAuthTag(bytes.subarray(12, 28));
        return Buffer.concat([
          decipher.update(bytes.subarray(28)),
          decipher.final(),
        ]).toString();
      },
    },
    openExternal: async () => {},
    fetch: async (href, options) => {
      const url = new URL(href);
      if (offline) throw new Error("Offline");
      if (failBefore && options.method === "POST") {
        failBefore = false;
        throw new Error("Before write");
      }
      const r = await app.inject({
        method: options.method,
        url: url.pathname,
        headers: options.headers,
        ...(options.body ? { payload: JSON.parse(options.body) } : {}),
      });
      if (loseAfter && options.method === "POST") {
        loseAfter = false;
        throw new Error("After write");
      }
      return new Response(r.body, {
        status: r.statusCode,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
  const client = new CalmTeam(deps),
    connected = await client.command({
      action: "connect",
      link: `http://127.0.0.1:4242/team/${w.id}#member=${member.memberToken}`,
    }),
    id = connected.activeConnectionId;
  const remote = () =>
    call("GET", `/api/workspaces/${w.id}`, null, w.memberToken);
  const mutate = async (task) => {
    const current = await remote();
    await call(
      "POST",
      `/api/workspaces/${w.id}/operations`,
      {
        id: crypto.randomUUID(),
        baseRevision: current.projectRevision,
        projectId: p.id,
        kind: "task.upsert",
        task,
      },
      w.memberToken,
    );
  };
  return {
    directory,
    app,
    store,
    client,
    deps,
    id,
    w,
    p,
    member,
    initial,
    remote,
    mutate,
    setOffline: (v) => (offline = v),
    setLose: (v) => (loseAfter = v),
    setFail: (v) => (failBefore = v),
    call,
    close: async () => {
      await app.close();
      await store.close();
      await fs.rm(directory, { recursive: true, force: true });
    },
  };
}
test("native shared sync: encrypted capabilities, offline changes, replay across restart, conflicts and explicit resolutions", async () => {
  const f = await fixture();
  try {
    const row = (task) => ({
      projectId: f.p.id,
      taskId: "task-one",
      base: f.initial,
      task,
    });
    const next = { ...f.initial, title: "Offline edit" };
    f.setOffline(true);
    let status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(next)],
    });
    assert.match(status.connections[0].error, /offline/);
    f.setOffline(false);
    f.setLose(true);
    status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(next)],
    });
    assert.equal(status.connections[0].pendingCount, 1);
    const restored = new CalmTeam(f.deps);
    status = await restored.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(next)],
    });
    assert.equal(status.connections[0].pendingCount, 0);
    assert.equal((await f.remote()).projects[0].tasks[0].title, "Offline edit");
    assert.equal(JSON.stringify(status).includes(f.member.memberToken), false);
    assert.equal(
      (await fs.readFile(path.join(f.deps.directory, "team-vault"))).includes(
        Buffer.from(f.member.memberToken),
      ),
      false,
    );
    const teamChanged = { ...next, title: "Remote edit" };
    await f.mutate(teamChanged);
    const myChanged = { ...next, title: "My conflicting edit" };
    status = await restored.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(myChanged)],
    });
    assert.equal(status.connections[0].conflicts.length, 1);
    assert.equal((await f.remote()).projects[0].tasks[0].title, "Remote edit");
    const conflict = status.connections[0].conflicts[0];
    await restored.command({
      action: "resolve",
      connectionId: f.id,
      key: conflict.key,
      choice: "local",
    });
    status = await restored.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(myChanged)],
    });
    assert.equal(status.connections[0].conflicts.length, 0);
    assert.equal(
      (await f.remote()).projects[0].tasks[0].title,
      "My conflicting edit",
    );
    const changedAgain = { ...myChanged, title: "Team changed again" };
    await f.mutate(changedAgain);
    status = await restored.command({
      action: "sync",
      connectionId: f.id,
      rows: [row({ ...myChanged, notes: "Local note" })],
    });
    assert.equal(status.connections[0].conflicts.length, 1);
    await restored.command({
      action: "resolve",
      connectionId: f.id,
      key: conflict.key,
      choice: "private",
    });
    assert.equal(
      (await restored.command({ action: "status" })).connections[0].ignored
        .length,
      1,
    );
  } finally {
    await f.close();
  }
});
test("native shared sync retains newer local edits behind an older pending command and never advances a pulled base prematurely", async () => {
  const f = await fixture();
  try {
    const row = (task) => ({
      projectId: f.p.id,
      taskId: "task-one",
      base: f.initial,
      task,
    });
    const first = { ...f.initial, title: "First change" },
      second = { ...f.initial, title: "Newer local change" };
    f.setFail(true);
    let status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(first)],
    });
    assert.equal(status.connections[0].pendingCount, 1);
    status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(second)],
    });
    assert.equal((await f.remote()).projects[0].tasks[0].title, "First change");
    assert.equal(status.connections[0].preserveKeys.length, 1);
    await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(second)],
    });
    assert.equal(
      (await f.remote()).projects[0].tasks[0].title,
      "Newer local change",
    );
    const remote = { ...second, notes: "Remote note" };
    await f.mutate(remote);
    // Local was unchanged at pull time, but user edits while its response waits for application.
    await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(second)],
    });
    status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row({ ...second, notes: "Concurrent local note" })],
    });
    assert.equal(status.connections[0].conflicts.length, 1);
    assert.equal((await f.remote()).projects[0].tasks[0].notes, "Remote note");
    await f.call(
      "DELETE",
      `/api/workspaces/${f.w.id}/members/${f.member.memberId}`,
      null,
      f.w.memberToken,
    );
    status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(second)],
    });
    assert.match(status.connections[0].error, /revoked/);
    assert.equal(status.connections[0].conflicts.length, 1);
  } finally {
    await f.close();
  }
});

test("applied pulls are acknowledged before subsequent local edits; newer conflict edits require fresh review", async () => {
  const f = await fixture();
  try {
    const changed = { ...f.initial, notes: "Teammate note" };
    await f.mutate(changed);
    const row = (task) => ({
      projectId: f.p.id,
      taskId: task.id,
      task,
      base: changed,
    });
    await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [{ ...row(f.initial), base: f.initial }],
    });
    await f.client.command({
      action: "ack",
      connectionId: f.id,
      rows: [row(changed)],
    });
    const local = { ...changed, title: "Edit after pull" };
    let status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(local)],
    });
    assert.equal(status.connections[0].conflicts.length, 0);
    assert.equal((await f.remote()).projects[0].tasks[0].title, local.title);
    await f.mutate({ ...local, title: "Concurrent remote" });
    const mine = { ...local, notes: "Concurrent mine" };
    status = await f.client.command({
      action: "sync",
      connectionId: f.id,
      rows: [row(mine)],
    });
    const key = status.connections[0].conflicts[0].key;
    await assert.rejects(
      f.client.command({
        action: "resolve",
        connectionId: f.id,
        key,
        choice: "remote",
        rows: [row({ ...mine, notes: "Newer local note" })],
      }),
      /local task changed again/,
    );
    status = await f.client.command({ action: "status" });
    assert.equal(
      status.connections[0].conflicts[0].local.notes,
      "Newer local note",
    );
  } finally {
    await f.close();
  }
});
