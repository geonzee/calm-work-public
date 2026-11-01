import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import nodemailer from "nodemailer";
import { openStore } from "../src/store.mjs";
import { createOnline } from "../src/server.mjs";
import { MailWorker, bookingIcs } from "../src/mail-worker.mjs";
const owner = "synthetic-mail-organizer-token-long-enough-for-tests";
test("calendar invitation encoding prevents line injection and folds UTF-8 safely", () => {
  const value = bookingIcs(
    {
      id: "a",
      title: "Meeting\r\nBEGIN:VEVENT, notes; " + "日".repeat(80),
      name: 'Guest "name"',
      email: "guest@example.test",
      start: "2026-10-18T10:00:00.000Z",
      end: "2026-10-18T10:30:00.000Z",
    },
    { origin: "https://example.test", from: "host@example.test" },
  );
  assert.equal(value.split("BEGIN:VEVENT").length, 3); // One real event plus escaped text, not another CRLF event boundary.
  assert.equal(value.includes("\r\nBEGIN:VEVENT, notes"), false);
  for (const line of value.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(!value.includes("\uFFFD"));
});
test("opt-in mail: MIME invite/cancel, single automatic attempt, uncertain recovery and explicit resend", async () => {
  const directory = await mkdtemp("/tmp/calm-mail-");
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
  const store = await openStore(),
    mime = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "windows",
    });
  let uncertain = false,
    calls = 0;
  const messages = [];
  const transport = {
    sendMail: async (message) => {
      calls++;
      if (uncertain)
        throw new Error("Socket closed after DATA; acceptance unknown.");
      const rendered = await mime.sendMail(message);
      messages.push(rendered.message.toString());
      return { accepted: [message.to.address] };
    },
  };
  const app = await createOnline({
    store,
    ownerToken: owner,
    mail: { transport, from: "host@example.test" },
    workerIntervalMs: 0,
  });
  const request = async (method, url, payload, secret = owner) => {
    const r = await app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { authorization: "Bearer " + secret },
    });
    return { status: r.statusCode, data: r.json() };
  };
  try {
    const page = (
      await request("POST", "/api/pages", {
        title: "Booking",
        durationMinutes: 30,
        minimumNoticeMinutes: 0,
        timeZone: "UTC",
        availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          start: "09:00",
          end: "18:00",
        })),
      })
    ).data;
    const start = new Date(Date.now() + 3 * 86400000);
    start.setUTCHours(12, 0, 0, 0);
    const booked = (
      await request(
        "POST",
        `/api/pages/${page.id}/reserve`,
        {
          start: start.toISOString(),
          name: "Guest",
          email: "guest@example.test",
          idempotencyKey: "first",
        },
        "",
      )
    ).data;
    assert.equal(calls, 0);
    await app.calmMailWorker.tick();
    assert.equal(calls, 1);
    assert.match(messages[0], /text\/calendar;[\s\S]*method=REQUEST/i);
    assert.match(messages[0], /Content-Type: application\/ics/i);
    await app.calmMailWorker.tick();
    assert.equal(calls, 1);
    await request(
      "POST",
      `/api/bookings/${booked.bookingId}/cancel`,
      {},
      booked.cancelToken,
    );
    await app.calmMailWorker.tick();
    assert.equal(calls, 2);
    assert.match(messages[1], /method=CANCEL/i);
    await app.calmMailWorker.tick();
    assert.equal(calls, 2);
    uncertain = true;
    start.setUTCDate(start.getUTCDate() + 1);
    const pending = (
      await request(
        "POST",
        `/api/pages/${page.id}/reserve`,
        {
          start: start.toISOString(),
          name: "Guest",
          email: "guest@example.test",
          idempotencyKey: "second",
        },
        "",
      )
    ).data;
    await app.calmMailWorker.tick();
    assert.equal(calls, 3);
    await new MailWorker({
      store,
      transport,
      from: "host@example.test",
      origin: "http://127.0.0.1:4242",
      ownerToken: owner,
    }).tick();
    assert.equal(calls, 3);
    let status = (
      await request(
        "GET",
        "/api/bookings/" + pending.bookingId,
        null,
        pending.cancelToken,
      )
    ).data;
    assert.equal(status.invitationSent, false);
    assert.equal(Object.values(status.mailStatus)[0].state, "uncertain");
    assert.equal(
      (
        await request(
          "POST",
          `/api/bookings/${pending.bookingId}/mail/retry`,
          {},
          owner,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "POST",
          `/api/bookings/${pending.bookingId}/mail/retry`,
          { confirmResend: true },
          pending.cancelToken,
        )
      ).status,
      401,
    );
    uncertain = false;
    await request("POST", `/api/bookings/${pending.bookingId}/mail/retry`, {
      confirmResend: true,
    });
    await app.calmMailWorker.tick();
    assert.equal(calls, 4);
    status = (
      await request(
        "GET",
        "/api/bookings/" + pending.bookingId,
        null,
        pending.cancelToken,
      )
    ).data;
    assert.equal(status.invitationSent, true);
  } finally {
    await app.close();
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
