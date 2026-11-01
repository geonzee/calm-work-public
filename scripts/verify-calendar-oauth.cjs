const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("../output/upstream/node_modules/typescript");
const vm = require("node:vm");
const compiled = ts.transpileModule(
  require("node:fs").readFileSync(
    path.join(__dirname, "../apps/desktop/native/calm-calendar.ts"),
    "utf8",
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  },
).outputText;
const mod = { exports: {} };
vm.runInNewContext(compiled, {
  exports: mod.exports,
  require,
  Buffer,
  URL,
  URLSearchParams,
  AbortSignal,
  fetch,
  setTimeout,
  clearTimeout,
  console,
});
const { CalmCalendar } = mod.exports;
async function setup(overrides = {}) {
  const directory = await fs.mkdtemp("/tmp/calm-oauth-");
  const key = crypto.randomBytes(32);
  const deps = {
    directory,
    timeoutMs: 1500,
    vault: {
      available: () => true,
      encrypt: (value) => {
        const iv = crypto.randomBytes(12),
          cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
        const bytes = Buffer.concat([cipher.update(value), cipher.final()]);
        return Buffer.concat([iv, cipher.getAuthTag(), bytes]);
      },
      decrypt: (value) => {
        const cipher = crypto.createDecipheriv(
          "aes-256-gcm",
          key,
          value.subarray(0, 12),
        );
        cipher.setAuthTag(value.subarray(12, 28));
        return Buffer.concat([
          cipher.update(value.subarray(28)),
          cipher.final(),
        ]).toString();
      },
    },
    openExternal: async () => {},
    ...overrides,
  };
  return {
    directory,
    deps,
    client: new CalmCalendar(deps),
    close: () => fs.rm(directory, { recursive: true, force: true }),
  };
}
// Google sign-in now belongs to SP's google-calendar-provider (see the last test and
// verify-calendar-mirror.cjs); the engine's own OAuth is Microsoft 365 only.
for (const provider of ["microsoft"])
  test(`${provider}: PKCE, state, encrypted persistence, pagination, split intervals, refresh rotation, disconnect`, async () => {
    let authorize,
      tokenCalls = 0,
      listCalls = 0,
      rejectRefresh = false;
    const context = await setup({
      openExternal: async (href) => {
        authorize = new URL(href);
        const redirect = authorize.searchParams.get("redirect_uri");
        assert.equal(
          new URL(redirect).hostname,
          provider === "microsoft" ? "localhost" : "127.0.0.1",
        );
        const invalid = await fetch(redirect + "?state=wrong&code=bad");
        assert.equal(invalid.status, 400);
        await fetch(
          redirect +
            "?state=" +
            authorize.searchParams.get("state") +
            "&code=valid",
        );
      },
      fetch: async (href, options) => {
        const url = new URL(href);
        if (url.pathname.endsWith("/token")) {
          tokenCalls++;
          const body = options.body;
          if (body.get("grant_type") === "authorization_code") {
            assert.equal(
              crypto
                .createHash("sha256")
                .update(body.get("code_verifier"))
                .digest("base64url"),
              authorize.searchParams.get("code_challenge"),
            );
            assert.equal(body.get("code"), "valid");
          } else
            assert.equal(
              body.get("refresh_token"),
              tokenCalls === 2 ? "refresh-1" : "refresh-" + (tokenCalls - 1),
            );
          return Response.json({
            access_token: "secret-access-" + tokenCalls,
            refresh_token: "refresh-" + tokenCalls,
            expires_in: 1,
          });
        }
        if (rejectRefresh) return new Response("", { status: 503 });
        assert.match(options.headers.Authorization, /Bearer secret-access-/);
        const google = provider === "google";
        if (
          url.pathname.endsWith("/calendarList") ||
          url.pathname.endsWith("/me/calendars")
        ) {
          listCalls++;
          return Response.json(
            google
              ? { items: [{ id: "work", summary: "Work" }] }
              : {
                  value: [
                    { id: "work", name: "Work", canEdit: true },
                    { id: "work-copy", name: "Work copy", canEdit: false },
                  ],
                },
          );
        }
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(23, 30, 0, 0);
        const end = new Date(+date + 60 * 60000);
        const event = {
          id: "event",
          iCalUId: "meet-1",
          summary: "Meeting",
          subject: "Meeting",
          start: { dateTime: date.toISOString() },
          end: { dateTime: end.toISOString() },
          hangoutLink: "javascript:alert(1)",
        };
        const holiday = {
          id: "holiday",
          iCalUId: "holiday-1",
          subject: "Holiday",
          isAllDay: true,
          start: { dateTime: "2026-10-19T00:00:00.0000000", timeZone: "UTC" },
          end: { dateTime: "2026-10-20T00:00:00.0000000", timeZone: "UTC" },
          showAs: "free",
        };
        const morning = new Date(date);
        morning.setHours(9, 0, 0, 0);
        const later = new Date(morning.getTime() + 60 * 60000);
        const privateCall = {
          id: "private",
          iCalUId: "private-1",
          subject: "Private",
          start: { dateTime: morning.toISOString() },
          end: { dateTime: new Date(morning.getTime() + 30 * 60000).toISOString() },
          body: { content: "Talk through https://calls.acme.test/room/42 and then decide." },
        };
        const documentNote = {
          id: "docs",
          iCalUId: "docs-1",
          subject: "Docs",
          start: { dateTime: later.toISOString() },
          end: { dateTime: new Date(later.getTime() + 30 * 60000).toISOString() },
          body: { content: "Spec https://docs.google.com/document/d/1 and https://github.com/acme/spec" },
        };
        const page =
          url.searchParams.has("pageToken") || url.searchParams.has("page");
        return Response.json(
          google
            ? {
                items: page ? [] : [event],
                ...(!page ? { nextPageToken: "next" } : {}),
              }
            : {
                value: page ? [] : [event, holiday, privateCall, documentNote],
                ...(!page ? { "@odata.nextLink": url.href + "&page=2" } : {}),
              },
        );
      },
    });
    try {
      const result = await context.client.command({
        action: "connect",
        provider,
        clientId: "desktop-client",
      });
      assert.equal(result.accounts.length, 1);
      const meetings = result.events.filter((event) => event.title === "Meeting");
      const holidays = result.events.filter((event) => event.title === "Holiday");
      assert.equal(meetings.length, 2, "duplicate calendars collapse to one overnight split");
      assert.equal(meetings[0].end, "24:00");
      assert.equal(meetings[1].start, "00:00");
      assert.match(meetings[0].calendar, /· Work$/);
      assert.equal(holidays.length, 1, "an all-day event stays on its civil date");
      assert.equal(holidays[0].date, "2026-10-19");
      assert.equal(holidays[0].allDay, true);
      assert.equal(result.events.length, 5);
      assert.equal(meetings[0].meetingUrl, "");
      assert.equal(result.events.find((item) => item.title === "Private").meetingUrl, "https://calls.acme.test/room/42");
      assert.equal(result.events.find((item) => item.title === "Docs").meetingUrl, "");
      assert.equal(result.events[0].owned, false);
      assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
      // Narrow write scopes only: owned-calendar events plus app-created calendars
      // (Google) or delegated calendar read/write (Microsoft). Never full calendar/ACL access.
      assert.deepEqual(
        authorize.searchParams.get("scope").split(" ").sort(),
        provider === "google"
          ? [
              "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
              "https://www.googleapis.com/auth/calendar.events",
            ]
          : ["https://graph.microsoft.com/Calendars.ReadWrite", "offline_access"],
      );
      if (provider === "microsoft")
        assert.equal(
          authorize.pathname,
          "/contoso.onmicrosoft.com/oauth2/v2.0/authorize",
        );
      assert.ok(tokenCalls >= 2);
      const disk = await fs.readFile(
        path.join(context.directory, "calendar-vault"),
      );
      assert.equal(disk.includes(Buffer.from("secret-access")), false);
      assert.equal(JSON.stringify(result).includes("refresh-"), false);
      const restored = new CalmCalendar(context.deps);
      assert.equal(
        (await restored.command({ action: "status" })).events.length,
        5,
      );
      rejectRefresh = true;
      await assert.rejects(
        restored.command({ action: "refresh", provider }),
        /refresh failed/,
      );
      assert.equal(
        (await restored.command({ action: "status" })).events.length,
        5,
      );
      await restored.command({ action: "disconnect", provider });
      assert.equal(
        (await new CalmCalendar(context.deps).command({ action: "status" }))
          .events.length,
        0,
      );
      assert.ok(listCalls >= 1);
    } finally {
      await context.close();
    }
  });
test("denial, timeout, cancellation and unavailable secure storage", async () => {
  const denied = await setup({
    openExternal: async (href) => {
      const u = new URL(href);
      await fetch(
        u.searchParams.get("redirect_uri") +
          "?state=" +
          u.searchParams.get("state") +
          "&error=access_denied",
      );
    },
  });
  try {
    await assert.rejects(
      denied.client.command({
        action: "connect",
        provider: "microsoft",
        clientId: "desktop-client",
      }),
      /cancelled/,
    );
  } finally {
    await denied.close();
  }
  const timeout = await setup({ timeoutMs: 30 });
  try {
    await assert.rejects(
      timeout.client.command({
        action: "connect",
        provider: "microsoft",
        clientId: "desktop-client",
      }),
      /timed out/,
    );
  } finally {
    await timeout.close();
  }
  let cancel;
  const cancelled = await setup({ openExternal: async () => cancel() });
  cancel = () => cancelled.client.cancel();
  try {
    await assert.rejects(
      cancelled.client.command({
        action: "connect",
        provider: "microsoft",
        clientId: "desktop-client",
      }),
      /cancelled/,
    );
  } finally {
    await cancelled.close();
  }
  const locked = await setup({ vault: { available: () => false } });
  try {
    await assert.rejects(
      locked.client.command({ action: "status" }),
      /credential store/,
    );
  } finally {
    await locked.close();
  }
});
test("optional service launcher only accepts origins and never passes calendar tokens", async () => {
  let opened = "";
  const context = await setup({
    openExternal: async (url) => {
      opened = url;
    },
  });
  try {
    for (const origin of [
      "file:///tmp/private",
      "http://example.test",
      "https://example.test/path",
      "https://user:pass@example.test",
    ])
      await assert.rejects(
        context.client.command({ action: "open-service", origin }),
      );
    const result = await context.client.command({
      action: "open-service",
      origin: "http://127.0.0.1:4242",
    });
    assert.equal(opened, "http://127.0.0.1:4242");
    assert.equal(result.serviceOrigin, opened);
    assert.equal(
      (await new CalmCalendar(context.deps).command({ action: "status" }))
        .serviceOrigin,
      opened,
    );
  } finally {
    await context.close();
  }
});
test("two Google slots use SP-held tokens independently and never persist them", async () => {
  const used = [];
  const context = await setup({
    openExternal: async () => assert.fail("no browser for Google: SP's plugin signs in"),
    fetch: async (href, options) => {
      const url = new URL(href);
      used.push(options.headers.Authorization);
      if (url.pathname.endsWith("/calendarList"))
        return Response.json({ items: [{ id: "primary-" + options.headers.Authorization.slice(-1), summary: "Calendar", accessRole: "owner", primary: true }] });
      return new Response("{}", { status: 404 });
    },
  });
  try {
    const google = [
      { accountId: "google", accessToken: "sp-token-A" },
      { accountId: "google-2", accessToken: "sp-token-B" },
    ];
    let result = await context.client.command({ action: "refresh", provider: "google", accountId: "google", google });
    result = await context.client.command({ action: "refresh", provider: "google", accountId: "google-2", google });
    assert.equal(result.accounts.length, 2);
    assert.ok(result.accounts.every((a) => a.managedBy === "super-productivity" && a.canWrite));
    assert.equal(result.accounts.find((a) => a.accountId === "google").label, "primary-A");
    assert.equal(result.accounts.find((a) => a.accountId === "google-2").label, "primary-B");
    assert.equal(used.at(-1), "Bearer sp-token-B");
    assert.equal(result.events.length, 0, "Google events come from SP, not the engine");
    const disk = await fs.readFile(path.join(context.directory, "calendar-vault"));
    assert.equal(disk.includes(Buffer.from("sp-token")), false);
    // A slot SP no longer lists is dropped; the other keeps working.
    result = await context.client.command({ action: "disconnect", provider: "google", accountId: "google", google: google.slice(1) });
    assert.equal(result.accounts.map((a) => a.accountId).join(","), "google-2");
    await assert.rejects(
      context.client.command({ action: "refresh", provider: "microsoft", accountId: "google-2" }),
      /valid calendar account slot/,
    );
  } finally {
    await context.close();
  }
});
