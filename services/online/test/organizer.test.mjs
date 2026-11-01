import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { openStore } from "../src/store.mjs";
import { createOnline } from "../src/server.mjs";
test("organizer resource listing survives restart, paginates without secrets, and recovers access only after explicit owner confirmation", async () => {
  const directory = await mkdtemp("/tmp/calm-organizer-");
  process.env.CALM_ONLINE_DATABASE_URL =
    "file:" + join(directory, "database.db");
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
  const store = await openStore(),
    ownerToken = "synthetic-organizer-owner-token-long-enough";
  let app = await createOnline({ store, ownerToken });
  async function call(method, url, payload, token = ownerToken) {
    const response = await app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: token ? { authorization: "Bearer " + token } : {},
    });
    return { status: response.statusCode, data: response.json() };
  }
  try {
    const expiresAt = new Date(Date.now() + 86400000).toISOString(),
      start = new Date(Date.now() + 3600000).toISOString(),
      end = new Date(Date.now() + 5400000).toISOString();
    const poll = (
      await call("POST", "/api/polls", {
        title: "Durable poll",
        expiresAt,
        options: [{ start, end, timeZone: "UTC" }],
      })
    ).data;
    const workspace = (
      await call("POST", "/api/workspaces", { name: "Durable team" })
    ).data;
    assert.equal(
      (await call("GET", "/api/admin/resources?kind=poll", null, "")).status,
      401,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/admin/polls/${poll.id}/recover`,
          { confirmReplace: true },
          workspace.memberToken,
        )
      ).status,
      401,
    );
    assert.equal(
      (await call("POST", `/api/admin/polls/${poll.id}/recover`, {})).status,
      400,
    );
    assert.equal(
      (await call("POST", `/api/admin/workspaces/${workspace.id}/recover`, {}))
        .status,
      400,
    );
    await app.close();
    app = await createOnline({ store, ownerToken });
    const listed = (await call("GET", "/api/admin/resources?kind=poll")).data;
    assert.equal(listed.items[0].name, "Durable poll");
    assert.equal(JSON.stringify(listed).includes("organizerHash"), false);
    assert.equal(JSON.stringify(listed).includes(poll.organizerToken), false);
    const recovered = (
      await call("POST", `/api/admin/polls/${poll.id}/recover`, {
        confirmReplace: true,
      })
    ).data;
    assert.notEqual(recovered.organizerToken, poll.organizerToken);
    assert.equal(
      (
        await call(
          "POST",
          `/api/polls/${poll.id}/close`,
          {},
          poll.organizerToken,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/polls/${poll.id}/close`,
          {},
          recovered.organizerToken,
        )
      ).status,
      200,
    );
    const access = (
      await call("POST", `/api/admin/workspaces/${workspace.id}/recover`, {
        confirmGrant: true,
      })
    ).data;
    const opened = (
      await call(
        "GET",
        `/api/workspaces/${workspace.id}`,
        null,
        access.memberToken,
      )
    ).data;
    assert.equal(
      opened.members.find((m) => m.id === opened.currentMember).role,
      "owner",
    );
    assert.equal(
      (
        await call(
          "GET",
          `/api/workspaces/${workspace.id}`,
          null,
          workspace.memberToken,
        )
      ).status,
      200,
    );
    for (let i = 0; i < 101; i++)
      await store.create(
        "poll:synthetic-" + String(i).padStart(3, "0"),
        "poll",
        {
          id: "synthetic-" + i,
          title: "Page " + i,
          organizerHash: "never-return-this",
        },
      );
    const first = (await call("GET", "/api/admin/resources?kind=poll")).data;
    assert.equal(first.items.length, 100);
    assert.ok(first.next);
    const second = (
      await call(
        "GET",
        "/api/admin/resources?kind=poll&after=" +
          encodeURIComponent(first.next),
      )
    ).data;
    assert.equal(second.items.length, 2);
    assert.equal(second.next, null);
    assert.equal(
      new Set([...first.items, ...second.items].map((i) => i.id)).size,
      102,
    );
    assert.equal(JSON.stringify(first).includes("never-return-this"), false);
  } finally {
    await app.close();
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
