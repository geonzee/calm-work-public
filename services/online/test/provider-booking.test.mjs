import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { ProviderOAuth } from "../src/provider-oauth.mjs";
import { CalendarWriter } from "../src/calendar-writer.mjs";
import { BookingWorker } from "../src/booking-worker.mjs";
import { createOnline } from "../src/server.mjs";
import { openStore } from "../src/store.mjs";
const owner = "synthetic-provider-booking-owner-token-long-enough";
test("web service OAuth: state, PKCE, encrypted restart, refresh rotation, denial and replay", async () => {
  const directory = await mkdtemp("/tmp/calm-provider-oauth-"),
    key = randomBytes(32).toString("base64");
  let verifier = "",
    refreshes = 0;
  const options = {
    file: join(directory, "vault"),
    key,
    origin: "http://127.0.0.1:4242",
    clients: {
      google: { clientId: "web-client", clientSecret: "web-client-secret" },
    },
    fetcher: async (url, request) => {
      verifier = request.body.get("code_verifier") || verifier;
      refreshes++;
      return Response.json({
        access_token: "access-" + refreshes,
        refresh_token: "refresh-" + refreshes,
        expires_in: 1,
      });
    },
  };
  try {
    const oauth = new ProviderOAuth(options),
      begin = await oauth.begin("google"),
      url = new URL(begin.url);
    await assert.rejects(
      oauth.callback("google", { state: "wrong", code: "invalid" }),
      /state/,
    );
    await oauth.callback("google", {
      state: url.searchParams.get("state"),
      code: "valid",
    });
    assert.equal(
      createHash("sha256").update(verifier).digest("base64url"),
      url.searchParams.get("code_challenge"),
    );
    await assert.rejects(
      oauth.callback("google", {
        state: url.searchParams.get("state"),
        code: "replay",
      }),
      /state/,
    );
    const disk = await readFile(options.file);
    assert.equal(disk.includes(Buffer.from("access-")), false);
    assert.equal(disk.includes(Buffer.from("refresh-")), false);
    const restored = new ProviderOAuth(options);
    assert.equal(await restored.access("google"), "access-2");
    assert.equal((await restored.status())[0].connected, true);
    const rejected = new URL((await restored.begin("google")).url);
    await assert.rejects(
      restored.callback("google", {
        state: rejected.searchParams.get("state"),
        error: "access_denied",
      }),
      /cancelled/,
    );
    await restored.disconnect("google");
    await assert.rejects(restored.access("google"), /Connect/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
for (const provider of ["google", "microsoft"])
  test(`${provider}: pending reservation, ambiguous create recovery, lease races, external edit review and conditional cancellation`, async () => {
    const directory = await mkdtemp("/tmp/calm-provider-booking-");
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
      secondStore = await openStore();
    let now = Date.now(),
      creates = 0,
      deletes = 0,
      ambiguous = true,
      busy = false;
    const events = new Map();
    const oauth = {
      access: async () => "synthetic-provider-access",
      status: async () => [{ provider, connected: true, configured: true }],
    };
    const writer = new CalendarWriter({
      oauth,
      fetcher: async (href, options) => {
        const url = new URL(href),
          method = options.method;
        assert.equal(
          options.headers.Authorization,
          "Bearer synthetic-provider-access",
        );
        if (url.pathname.endsWith("/calendarList"))
          return Response.json({
            items: [
              { id: "owned", summary: "Host calendar", accessRole: "owner" },
            ],
          });
        if (url.pathname.endsWith("/me/calendars"))
          return Response.json({
            value: [{ id: "owned", name: "Host calendar", canEdit: true }],
          });
        if (url.pathname.endsWith("/freeBusy"))
          return Response.json({
            calendars: {
              owned: {
                busy: busy
                  ? [
                      {
                        start: new Date(now + 86400000).toISOString(),
                        end: new Date(now + 30 * 86400000).toISOString(),
                      },
                    ]
                  : [],
              },
            },
          });
        if (url.pathname.endsWith("/calendarView"))
          return Response.json({
            value: busy
              ? [
                  {
                    start: { dateTime: new Date(now + 86400000).toISOString() },
                    end: {
                      dateTime: new Date(now + 30 * 86400000).toISOString(),
                    },
                    showAs: "busy",
                  },
                ]
              : [],
          });
        if (method === "POST") {
          creates++;
          const body = JSON.parse(options.body);
          assert.equal(body.attendees?.length || 0, 0);
          const event = {
            ...body,
            id: body.id || "opaque-event",
            etag: "revision-1",
            "@odata.etag": "revision-1",
          };
          events.set(event.id, event);
          if (ambiguous) {
            ambiguous = false;
            throw new Error("Network lost after provider accepted");
          }
          return Response.json(event);
        }
        if (method === "DELETE") {
          const id = decodeURIComponent(url.pathname.split("/").at(-1)),
            event = events.get(id);
          if (!event) return new Response("", { status: 404 });
          assert.equal(options.headers["If-Match"], event.etag);
          events.delete(id);
          deletes++;
          return new Response(null, { status: 204 });
        }
        if (provider === "google") {
          const event = events.get(url.pathname.split("/").at(-1));
          return event
            ? Response.json(event)
            : new Response("", { status: 404 });
        }
        return Response.json({ value: [...events.values()] });
      },
    });
    const app = await createOnline({
      store,
      ownerToken: owner,
      writer,
      oauth,
      now: () => now,
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
          title: "Provider intro",
          durationMinutes: 30,
          bufferMinutes: 10,
          minimumNoticeMinutes: 0,
          timeZone: "UTC",
          availability: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday,
            start: "09:00",
            end: "18:00",
          })),
          destination: { provider, calendarId: "owned" },
        })
      ).data;
      const start = new Date(now + 3 * 86400000);
      start.setUTCHours(12, 0, 0, 0);
      busy = true;
      assert.equal(
        (
          await request(
            "POST",
            `/api/pages/${page.id}/reserve`,
            {
              start: start.toISOString(),
              name: "Guest",
              email: "guest@example.test",
              idempotencyKey: "busy",
            },
            "",
          )
        ).status,
        409,
      );
      busy = false;
      const reserved = await request(
        "POST",
        `/api/pages/${page.id}/reserve`,
        {
          start: start.toISOString(),
          name: "Guest",
          email: "guest@example.test",
          idempotencyKey: "one",
        },
        "",
      );
      assert.equal(reserved.data.state, "pending");
      const second = new BookingWorker({
        store: secondStore,
        writer,
        now: () => now,
      });
      await Promise.all([app.calmBookingWorker.tick(), second.tick()]);
      assert.equal(creates, 1);
      assert.equal(events.size, 1);
      let status = (
        await request(
          "GET",
          "/api/bookings/" + reserved.data.bookingId,
          null,
          reserved.data.cancelToken,
        )
      ).data;
      assert.equal(status.state, "pending");
      now += 120000;
      await app.calmBookingWorker.tick();
      assert.equal(creates, 1);
      status = (
        await request(
          "GET",
          "/api/bookings/" + reserved.data.bookingId,
          null,
          reserved.data.cancelToken,
        )
      ).data;
      assert.equal(status.state, "confirmed");
      const event = [...events.values()][0];
      event.etag = "external-revision";
      event["@odata.etag"] = "external-revision";
      await request(
        "POST",
        `/api/bookings/${reserved.data.bookingId}/cancel`,
        {},
        reserved.data.cancelToken,
      );
      await app.calmBookingWorker.tick();
      status = (
        await request(
          "GET",
          "/api/bookings/" + reserved.data.bookingId,
          null,
          reserved.data.cancelToken,
        )
      ).data;
      assert.equal(status.state, "review");
      assert.equal(deletes, 0);
      assert.equal(
        (
          await request(
            "POST",
            `/api/bookings/${reserved.data.bookingId}/acknowledge-provider`,
            { revision: "external-revision" },
            reserved.data.cancelToken,
          )
        ).status,
        401,
      );
      assert.equal(
        (
          await request(
            "POST",
            `/api/bookings/${reserved.data.bookingId}/acknowledge-provider`,
            { revision: "external-revision" },
          )
        ).status,
        200,
      );
      await app.calmBookingWorker.tick();
      assert.equal(deletes, 1);
      assert.equal(
        (
          await request(
            "GET",
            "/api/bookings/" + reserved.data.bookingId,
            null,
            reserved.data.cancelToken,
          )
        ).data.state,
        "cancelled",
      );
      assert.equal(
        (
          await request(
            "GET",
            "/api/bookings/" + reserved.data.bookingId,
            null,
            "wrong",
          )
        ).status,
        403,
      );
    } finally {
      await app.close();
      await store.close();
      await secondStore.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
