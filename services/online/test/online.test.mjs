import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { same } from "../src/domain.mjs";
import { openStore } from "../src/store.mjs";
import { createOnline } from "../src/server.mjs";
const owner = "synthetic-owner-token-that-is-long-enough-for-tests";
let directory, store, app;
const auth = (token = owner) => ({ authorization: "Bearer " + token });
async function call(method, url, payload, token = owner) {
  const response = await app.inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: token ? auth(token) : {},
  });
  return { status: response.statusCode, data: response.json() };
}
const future = (day = 2, hour = 12) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
test("optional service: durable booking races, poll capabilities, team revisions/ACL/replay/revocation", async () => {
  assert.equal(same("é", "a"), false);
  directory = await mkdtemp("/tmp/calm-online-");
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
  store = await openStore();
  app = await createOnline({ store, ownerToken: owner });
  let second;
  try {
    assert.equal((await call("GET", "/api/admin", null, "")).status, 401);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/pages",
          headers: { origin: "https://evil.test", ...auth() },
          payload: {},
        })
      ).statusCode,
      403,
    );
    const created = await call("POST", "/api/pages", {
      title: "Intro",
      durationMinutes: 30,
      bufferMinutes: 10,
      minimumNoticeMinutes: 0,
      timeZone: "UTC",
      availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        start: "09:00",
        end: "18:00",
      })),
    });
    assert.equal(created.status, 200);
    const page = created.data;
    const request = {
      start: future(),
      name: "Guest",
      email: "guest@example.test",
      idempotencyKey: "unique-reservation-one",
    };
    // A second independent Prisma connection exercises database CAS, not an in-memory mutex.
    const otherStore = await openStore();
    second = await createOnline({ store: otherStore, ownerToken: owner });
    const raced = await Promise.all([
      call("POST", `/api/pages/${page.id}/reserve`, request, ""),
      second.inject({
        method: "POST",
        url: `/api/pages/${page.id}/reserve`,
        payload: { ...request, idempotencyKey: "reservation-two" },
      }),
    ]);
    const statuses = [raced[0].status, raced[1].statusCode];
    assert.deepEqual(statuses.sort(), [200, 409]);
    const booking = raced[0].status === 200 ? raced[0].data : raced[1].json();
    const winningKey =
      raced[0].status === 200 ? request.idempotencyKey : "reservation-two";
    const replay = await call(
      "POST",
      `/api/pages/${page.id}/reserve`,
      { ...request, idempotencyKey: winningKey },
      "",
    );
    assert.equal(replay.data.bookingId, booking.bookingId);
    assert.equal(replay.data.cancelToken, booking.cancelToken);
    assert.equal(
      (
        await call(
          "POST",
          `/api/pages/${page.id}/reserve`,
          { ...request, name: "Changed", idempotencyKey: winningKey },
          "",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/bookings/${booking.bookingId}/cancel`,
          {},
          "wrong",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/bookings/${booking.bookingId}/cancel`,
          {},
          booking.cancelToken,
        )
      ).status,
      200,
    );
    await call("PUT", "/api/busy", {
      required: true,
      intervals: [{ start: future(), end: future(2, 13) }],
    });
    assert.equal(
      (
        await call(
          "POST",
          `/api/pages/${page.id}/reserve`,
          { ...request, idempotencyKey: "busy-test" },
          "",
        )
      ).status,
      409,
    );
    const stale = await createOnline({
      store,
      ownerToken: owner,
      now: () => Date.now() + 6 * 60000,
    });
    const unavailable = await stale.inject({
      method: "POST",
      url: `/api/pages/${page.id}/reserve`,
      payload: { ...request, start: future(3), idempotencyKey: "stale-test" },
    });
    assert.equal(unavailable.statusCode, 409);
    await stale.close();
    await second.close();
    await otherStore.close();
    second = null;
    const p = await call("POST", "/api/polls", {
      title: "Review",
      expiresAt: future(10),
      options: [{ start: future(), end: future(2, 13), timeZone: "UTC" }],
    });
    assert.equal(p.status, 200);
    let publicPoll = (await call("GET", "/api/polls/" + p.data.id, null, ""))
      .data;
    const option = publicPoll.options[0].id;
    assert.equal(JSON.stringify(publicPoll).includes("organizerHash"), false);
    const vote = await call(
      "POST",
      "/api/polls/" + p.data.id + "/vote",
      { name: "Voter", votes: [{ optionId: option, availability: "yes" }] },
      "",
    );
    assert.equal(vote.status, 200);
    await call(
      "POST",
      "/api/polls/" + p.data.id + "/vote",
      {
        name: "Voter",
        votes: [{ optionId: option, availability: "if-needed" }],
      },
      vote.data.participantToken,
    );
    publicPoll = (await call("GET", "/api/polls/" + p.data.id, null, "")).data;
    assert.equal(publicPoll.totals[option].yes, 0);
    assert.equal(publicPoll.totals[option].ifNeeded, 1);
    assert.equal(
      (
        await call(
          "POST",
          "/api/polls/" + p.data.id + "/finalize",
          { optionId: option, expectedRevision: 0 },
          vote.data.participantToken,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/api/polls/" + p.data.id + "/finalize",
          { optionId: option, expectedRevision: 0 },
          p.data.organizerToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/api/polls/" + p.data.id + "/finalize",
          { optionId: option, expectedRevision: publicPoll.revision },
          p.data.organizerToken,
        )
      ).data.invitationSent,
      false,
    );
    assert.equal(
      (
        await call(
          "POST",
          "/api/polls/" + p.data.id + "/vote",
          { name: "New", votes: [] },
          "",
        )
      ).status,
      409,
    );
    const w = (await call("POST", "/api/workspaces", { name: "Shared only" }))
      .data;
    const isolated = (
      await call("POST", "/api/workspaces", { name: "Other workspace" })
    ).data;
    assert.equal(
      (await call("GET", `/api/workspaces/${w.id}`, null, isolated.memberToken))
        .status,
      403,
    );
    const project = (
      await call(
        "POST",
        `/api/workspaces/${w.id}/projects`,
        { name: "Project" },
        w.memberToken,
      )
    ).data;
    const editor = (
      await call(
        "POST",
        `/api/workspaces/${w.id}/members`,
        { name: "Editor", role: "editor" },
        w.memberToken,
      )
    ).data;
    const viewer = (
      await call(
        "POST",
        `/api/workspaces/${w.id}/members`,
        { name: "Viewer", role: "viewer" },
        w.memberToken,
      )
    ).data;
    let snapshot = (
      await call("GET", `/api/workspaces/${w.id}`, null, editor.memberToken)
    ).data;
    assert.equal(JSON.stringify(snapshot).includes("tokenHash"), false);
    const op = {
      id: "operation-one",
      baseRevision: snapshot.projectRevision,
      projectId: project.id,
      kind: "task.upsert",
      task: {
        id: "task-one",
        title: "Shared task",
        done: false,
        notes: "Shared notes",
        assignee: w.memberId,
      },
    };
    assert.equal(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          op,
          viewer.memberToken,
        )
      ).status,
      403,
    );
    const accepted = await call(
      "POST",
      `/api/workspaces/${w.id}/operations`,
      op,
      editor.memberToken,
    );
    assert.equal(accepted.status, 200);
    assert.deepEqual(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          op,
          editor.memberToken,
        )
      ).data,
      accepted.data,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          { ...op, task: { ...op.task, title: "Different" } },
          editor.memberToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          { ...op, id: "other-operation" },
          editor.memberToken,
        )
      ).status,
      409,
    );
    const commentResult = await call(
      "POST",
      `/api/workspaces/${w.id}/operations`,
      {
        id: "comment-one",
        baseRevision: accepted.data.projectRevision,
        projectId: project.id,
        kind: "comment.add",
        taskId: "task-one",
        text: "Review this together",
      },
      editor.memberToken,
    );
    assert.equal(commentResult.status, 200);
    const commented = (
      await call("GET", `/api/workspaces/${w.id}`, null, w.memberToken)
    ).data;
    assert.equal(
      commented.projects[0].comments[0].text,
      "Review this together",
    );
    assert.equal(commented.projects[0].tasks[0].assignee, w.memberId);
    await call(
      "DELETE",
      `/api/workspaces/${w.id}/members/${editor.memberId}`,
      null,
      w.memberToken,
    );
    assert.equal(
      (await call("GET", `/api/workspaces/${w.id}`, null, editor.memberToken))
        .status,
      403,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          { ...op, id: "revoked" },
          editor.memberToken,
        )
      ).status,
      403,
    );
    snapshot = (
      await call("GET", `/api/workspaces/${w.id}`, null, w.memberToken)
    ).data;
    await call(
      "POST",
      `/api/workspaces/${w.id}/operations`,
      {
        id: "delete",
        baseRevision: snapshot.projectRevision,
        projectId: project.id,
        kind: "task.delete",
        taskId: "task-one",
      },
      w.memberToken,
    );
    assert.equal(
      (
        await call(
          "POST",
          `/api/workspaces/${w.id}/operations`,
          {
            ...op,
            id: "resurrect",
            baseRevision: snapshot.projectRevision + 1,
          },
          w.memberToken,
        )
      ).status,
      409,
    );
    await app.close();
    await store.close();
    store = await openStore();
    app = await createOnline({ store, ownerToken: owner });
    assert.equal(
      (await call("GET", `/api/workspaces/${w.id}`, null, w.memberToken)).data
        .projects[0].tasks.length,
      0,
    );
    assert.equal((await call("GET", "/api/admin")).data.pages.length, 1);
  } finally {
    if (second) await second.close();
    await app.close();
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
