import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import {
  token,
  digest,
  same,
  fail,
  text,
  instant,
  integer,
  pageInput,
  available,
  pollInput,
  memberFor,
  applyOperation,
} from "./domain.mjs";
import { BookingWorker } from "./booking-worker.mjs";
import { ProviderOAuth } from "./provider-oauth.mjs";
import { CalendarWriter } from "./calendar-writer.mjs";
import { MailWorker } from "./mail-worker.mjs";
import nodemailer from "nodemailer";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

export async function createOnline({
  store,
  ownerToken,
  publicOrigin = "http://127.0.0.1:4242",
  now = () => Date.now(),
  oauth = null,
  writer = null,
  mail = null,
  workerIntervalMs = 30000,
  trustedProxy = false,
} = {}) {
  if (typeof ownerToken !== "string" || ownerToken.length < 32)
    throw new Error(
      "Set a random CALM_ONLINE_OWNER_TOKEN of at least 32 characters.",
    );
  const base = new URL(publicOrigin);
  if (
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        base.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)
      ))
  )
    throw new Error(
      "Use an HTTPS public origin, or HTTP loopback for local testing.",
    );
  if (
    trustedProxy !== false &&
    (!Array.isArray(trustedProxy) ||
      !trustedProxy.length ||
      trustedProxy.some(
        (value) =>
          typeof value !== "string" ||
          !/^[0-9a-fA-F:.]+(?:\/\d{1,3})?$/.test(value),
      ))
  )
    throw new Error("Trusted proxies must be an explicit IP/CIDR allowlist.");
  const app = Fastify({
    logger: false,
    bodyLimit: 256 * 1024,
    trustProxy: trustedProxy,
  });
  await app.register(rateLimit, { max: 90, timeWindow: "1 minute" });
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer")
      .header("X-Content-Type-Options", "nosniff")
      .header("X-Frame-Options", "DENY");
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const origin = request.headers.origin;
    if (origin && origin !== base.origin)
      fail(403, "Cross-origin requests are not accepted.");
  });
  app.setErrorHandler((error, request, reply) => {
    const status = error.statusCode || 500;
    reply.code(status).send({
      error:
        status >= 500 ? "Service unavailable. Retry later." : error.message,
    });
  });
  const bearer = (request) => {
    const h = request.headers.authorization || "";
    return h.startsWith("Bearer ") ? h.slice(7) : "";
  };
  const owner = (request) => {
    if (!same(bearer(request), ownerToken))
      fail(401, "Organizer authentication required.");
  };
  const publicUrl = (path) => base.origin + path;
  async function host() {
    let h = await store.read("booking-host");
    if (!h) {
      try {
        await store.create("booking-host", "host", {
          pages: [],
          bookings: [],
          busy: [],
          busyRequired: false,
          busyUpdatedAt: null,
        });
      } catch {}
      h = await store.read("booking-host");
    }
    return h;
  }
  async function pollFor(id) {
    const p = await store.read("poll:" + id);
    if (!p) fail(404, "Poll not found.");
    return p;
  }
  const publicPoll = (p) => ({
    id: p.id,
    title: p.title,
    options: p.options,
    expiresAt: p.expiresAt,
    finalized: p.finalized,
    closed: p.closed,
    revision: p.revision,
    totals: Object.fromEntries(
      p.options.map((o) => [
        o.id,
        {
          yes: p.votes.filter((v) =>
            v.votes.some(
              (x) => x.optionId === o.id && x.availability === "yes",
            ),
          ).length,
          ifNeeded: p.votes.filter((v) =>
            v.votes.some(
              (x) => x.optionId === o.id && x.availability === "if-needed",
            ),
          ).length,
          no: p.votes.filter((v) =>
            v.votes.some((x) => x.optionId === o.id && x.availability === "no"),
          ).length,
        },
      ]),
    ),
  });
  const worker = writer ? new BookingWorker({ store, writer, now }) : null;
  const mailWorker = mail
    ? new MailWorker({
        store,
        transport: mail.transport,
        from: mail.from,
        origin: base.origin,
        ownerToken,
        now,
      })
    : null;
  const interval =
    (worker || mailWorker) && workerIntervalMs
      ? setInterval(() => {
          void (async () => {
            if (worker) await worker.tick();
            if (mailWorker) await mailWorker.tick();
          })().catch(() => {});
        }, workerIntervalMs)
      : null;
  interval?.unref();
  app.addHook("onClose", async () => {
    if (interval) clearInterval(interval);
    if (worker?.running) await worker.running;
    if (mailWorker?.running) await mailWorker.running;
  });
  app.decorate("calmBookingWorker", worker);
  app.decorate("calmMailWorker", mailWorker);
  app.get("/api/calendar", async (request) => {
    owner(request);
    return { accounts: oauth ? await oauth.status() : [], enabled: !!writer };
  });
  app.post("/api/calendar/:provider/connect", async (request) => {
    owner(request);
    if (!oauth)
      fail(
        409,
        "Configure service OAuth credentials and encryption key first.",
      );
    return oauth.begin(request.params.provider);
  });
  app.get("/oauth/:provider/callback", async (request, reply) => {
    if (!oauth) fail(409, "Service OAuth is not configured.");
    await oauth.callback(request.params.provider, request.query);
    return reply
      .type("text/plain")
      .send(
        "Service calendar connected. Return to organizer tools and choose its booking destination.",
      );
  });
  app.get("/api/calendar/:provider/calendars", async (request) => {
    owner(request);
    if (!writer) fail(409, "Service calendar writer is disabled.");
    return { calendars: await writer.calendars(request.params.provider) };
  });
  app.post("/api/calendar/:provider/disconnect", async (request) => {
    owner(request);
    if (!oauth) fail(409, "Service OAuth is not configured.");
    const h = await host();
    if (
      h.bookings.some(
        (b) =>
          b.destination?.provider === request.params.provider && !b.cancelled,
      )
    )
      fail(
        409,
        "Resolve or cancel active provider bookings before disconnecting.",
      );
    return oauth.disconnect(request.params.provider);
  });
  app.post("/api/provider-bookings/process", async (request) => {
    owner(request);
    if (!worker && !mailWorker)
      fail(409, "No provider/mail worker is configured.");
    if (worker) await worker.tick();
    if (mailWorker) await mailWorker.tick();
    return { ok: true };
  });
  app.post("/api/bookings/:id/retry", async (request) => {
    owner(request);
    await store.change("booking-host", (h) => {
      const b = h.bookings.find(
        (b) => b.id === request.params.id && b.destination,
      );
      if (!b) fail(404, "Provider booking not found.");
      b.state = b.cancelRequested ? "cancel-pending" : "pending";
      b.attempts = 0;
      b.nextAttempt = 0;
      delete b.lastError;
    });
    return { queued: true };
  });
  app.get("/api/bookings/:id", async (request) => {
    const h = await host(),
      b = h.bookings.find((b) => b.id === request.params.id);
    if (
      !b ||
      (!same(b.cancelHash, digest(bearer(request))) &&
        !same(bearer(request), ownerToken))
    )
      fail(403, "Booking access required.");
    return {
      bookingId: b.id,
      title: b.title,
      start: b.start,
      end: b.end,
      state: b.state || (b.cancelled ? "cancelled" : "confirmed"),
      invitationSent: Object.values(b.mail || {}).some(
        (message) => message.state === "sent" && message.method === "REQUEST",
      ),
      mailStatus: b.mail || {},
      calendar: b.destination
        ? b.destination.provider + " calendar"
        : "Service booking calendar",
    };
  });
  app.get("/api/bookings/:id/provider", async (request) => {
    owner(request);
    if (!writer) fail(409, "Service writer disabled.");
    const h = await host(),
      b = h.bookings.find(
        (row) => row.id === request.params.id && row.destination,
      );
    if (!b) fail(404, "Provider booking not found.");
    const remote = await writer.find(b);
    if (!remote) return { missing: true };
    return {
      id: remote.id,
      revision: remote.revision,
      start: remote.event.start,
      end: remote.event.end,
      title: remote.event.summary || remote.event.subject,
    };
  });
  app.post("/api/bookings/:id/acknowledge-provider", async (request) => {
    owner(request);
    if (!writer) fail(409, "Service writer disabled.");
    const h = await host(),
      b = h.bookings.find(
        (row) => row.id === request.params.id && row.destination,
      );
    if (!b) fail(404, "Provider booking not found.");
    const remote = await writer.find(b);
    if (!remote || remote.revision !== request.body.revision)
      fail(409, "Provider changed again. Review the latest event.");
    const utc = (value) =>
      new Date(
        /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
      ).toISOString();
    await store.change("booking-host", (host) => {
      const current = host.bookings.find((row) => row.id === b.id);
      if (current.lease && current.lease.until > now())
        fail(409, "Wait for the active worker before reviewing.");
      current.start = utc(remote.event.start.dateTime);
      current.end = utc(remote.event.end.dateTime);
      current.remote = { id: remote.id, revision: remote.revision };
      current.sequence = (current.sequence || 0) + 1;
      current.state = current.cancelRequested ? "cancel-pending" : "confirmed";
      current.attempts = 0;
      current.nextAttempt = 0;
      delete current.lastError;
    });
    return { accepted: true };
  });
  app.post("/api/bookings/:id/mail/retry", async (request) => {
    owner(request);
    if (!mailWorker) fail(409, "Email delivery is disabled.");
    if (request.body.confirmResend !== true)
      fail(400, "Confirm that a prior message may already have been accepted.");
    await store.change("booking-host", (host) => {
      const b = host.bookings.find((row) => row.id === request.params.id);
      if (!b) fail(404, "Booking not found.");
      const desired = mailWorker.desired(b);
      if (!desired) fail(409, "Booking is not ready for email.");
      if (b.mail?.[desired.id]?.state === "sending")
        fail(409, "Wait for the active delivery attempt.");
      b.mail ||= {};
      b.mail[desired.id] = { state: "queued", method: desired.method };
    });
    return { queued: true };
  });
  app.get("/health", async () => ({ ok: true }));
  for (const route of [
    "/",
    "/book/:id",
    "/poll/:id",
    "/team/:id",
    "/cancel/:id",
  ])
    app.get(route, async (request, reply) =>
      reply
        .type("text/html")
        .send(
          await readFile(
            new URL("../public/index.html", import.meta.url),
            "utf8",
          ),
        ),
    );
  for (const [route, file, type] of [
    ["/app.js", "app.js", "application/javascript"],
    ["/worker.js", "worker.js", "application/javascript"],
    ["/style.css", "style.css", "text/css"],
  ])
    app.get(route, async (request, reply) =>
      reply
        .type(type)
        .send(
          await readFile(new URL("../public/" + file, import.meta.url), "utf8"),
        ),
    );
  app.get("/api/admin", async (request) => {
    owner(request);
    const h = await host();
    return {
      pages: h.pages.map((p) => ({
        ...p,
        publicUrl: publicUrl("/book/" + p.id),
      })),
      bookings: h.bookings.map(
        ({ cancelHash, idempotencyKey, fingerprint, ...b }) => b,
      ),
      mailEnabled: !!mailWorker,
      busyRequired: h.busyRequired,
      busyUpdatedAt: h.busyUpdatedAt,
    };
  });
  app.get("/api/admin/resources", async (request) => {
    owner(request);
    const { kind, after = "" } = request.query;
    if (
      !["poll", "team"].includes(kind) ||
      typeof after !== "string" ||
      after.length > 200
    )
      fail(400, "Choose polls or team workspaces.");
    const result = await store.list(kind, after);
    return {
      items: result.items.map((resource) => ({
        id: resource.id,
        name: resource.title || resource.name,
        closed: resource.closed || false,
        finalized: resource.finalized || null,
        publicUrl: publicUrl(
          (kind === "poll" ? "/poll/" : "/team/") + resource.id,
        ),
      })),
      next: result.next,
    };
  });
  app.post("/api/admin/polls/:id/recover", async (request) => {
    owner(request);
    if (request.body?.confirmReplace !== true)
      fail(400, "Confirm replacement of the previous organizer link.");
    const organizerToken = token();
    await store.change("poll:" + request.params.id, (poll) => {
      poll.organizerHash = digest(organizerToken);
    });
    return {
      organizerToken,
      publicUrl: publicUrl("/poll/" + request.params.id),
    };
  });
  app.post("/api/admin/workspaces/:id/recover", async (request) => {
    owner(request);
    if (request.body?.confirmGrant !== true)
      fail(400, "Confirm granting a new owner membership.");
    const memberId = token(),
      memberToken = token();
    await store.change("team:" + request.params.id, (workspace) => {
      if (workspace.members.length >= 10000) fail(400, "Member limit reached.");
      workspace.members.push({
        id: memberId,
        name: "Recovered owner",
        role: "owner",
        tokenHash: digest(memberToken),
        revoked: false,
      });
    });
    return {
      memberId,
      memberToken,
      url: publicUrl("/team/" + request.params.id),
    };
  });
  app.post("/api/pages", async (request) => {
    owner(request);
    await host();
    let destination = null;
    if (request.body.destination) {
      if (!writer)
        fail(
          409,
          "Configure the service calendar writer before publishing a provider page.",
        );
      const requested = request.body.destination;
      const allowed = await writer.calendars(requested.provider);
      if (
        !allowed.some(
          (calendar) => calendar.calendarId === requested.calendarId,
        )
      )
        fail(403, "Select an owned/editable booking calendar.");
      destination = {
        provider: requested.provider,
        calendarId: requested.calendarId,
      };
    }
    const page = {
      id: token(),
      ...pageInput(request.body),
      active: true,
      ...(destination ? { destination } : {}),
    };
    await store.change("booking-host", (h) => {
      h.pages.push(page);
    });
    return { ...page, publicUrl: publicUrl("/book/" + page.id) };
  });
  app.delete("/api/pages/:id", async (request) => {
    owner(request);
    await store.change("booking-host", (h) => {
      const p = h.pages.find((p) => p.id === request.params.id);
      if (!p) fail(404, "Page not found.");
      p.active = false;
    });
    return { ok: true };
  });
  app.put("/api/busy", async (request) => {
    owner(request);
    await host();
    const b = request.body;
    if (!Array.isArray(b.intervals) || b.intervals.length > 10000)
      fail(400, "Invalid busy intervals.");
    const intervals = b.intervals.map((row) => {
      const start = instant(row.start),
        end = instant(row.end);
      if (start >= end) fail(400, "Invalid busy interval.");
      return { start, end };
    });
    await store.change("booking-host", (h) => {
      h.busy = intervals;
      h.busyRequired = b.required === true;
      h.busyUpdatedAt = now();
    });
    return { ok: true };
  });
  app.get("/api/pages/:id", async (request) => {
    const h = await host(),
      p = h.pages.find((p) => p.id === request.params.id && p.active);
    if (!p) fail(404, "Booking page not found.");
    return {
      id: p.id,
      title: p.title,
      durationMinutes: p.durationMinutes,
      timeZone: p.timeZone,
      calendar: p.destination
        ? p.destination.provider + " calendar"
        : "Service booking calendar",
      providerBacked: !!p.destination,
      emailEnabled: !!mailWorker,
      availabilityVerified:
        !h.busyRequired || now() - h.busyUpdatedAt <= 300000,
    };
  });
  app.get("/api/pages/:id/slots", async (request) => {
    const h = await host(),
      p = h.pages.find((p) => p.id === request.params.id && p.active);
    if (!p) fail(404, "Booking page not found.");
    const from = instant(request.query.from),
      until = instant(request.query.until);
    if (Date.parse(until) - Date.parse(from) > 7 * 86400000 || until <= from)
      fail(400, "Request at most seven days.");
    const externalBusy = p.destination
      ? await writer?.busy(
          p.destination,
          from,
          new Date(
            Date.parse(until) + (p.durationMinutes + p.bufferMinutes) * 60000,
          ).toISOString(),
        )
      : [];
    if (p.destination && !externalBusy)
      fail(503, "Provider availability cannot be verified.");
    const candidateHost = { ...h, busy: [...h.busy, ...(externalBusy || [])] };
    const slots = [];
    for (
      let start = Math.ceil(Date.parse(from) / 300000) * 300000;
      start < Date.parse(until);
      start += 300000
    ) {
      const value = new Date(start).toISOString();
      if (available(candidateHost, p, value, now())) slots.push(value);
    }
    return { slots, timeZone: p.timeZone };
  });
  app.post("/api/pages/:id/reserve", async (request) => {
    const b = request.body || {},
      start = instant(b.start),
      name = text(b.name, 200),
      email = text(b.email, 320),
      key = text(b.idempotencyKey, 100);
    if (!/^[^\s@,;<>"\r\n]+@[^\s@,;<>"\r\n]+\.[^\s@,;<>"\r\n]+$/.test(email))
      fail(400, "Enter a valid email.");
    const fingerprint = digest(
        JSON.stringify({ page: request.params.id, start, name, email }),
      ),
      cancelToken = createHmac("sha256", ownerToken)
        .update(key + ":" + fingerprint)
        .digest("base64url"),
      bookingId = token();
    const snapshot = await host(),
      published = snapshot.pages.find(
        (page) => page.id === request.params.id && page.active,
      );
    let externalBusy = [];
    if (
      published?.destination &&
      !snapshot.bookings.some((row) => row.idempotencyKey === key)
    ) {
      if (!writer) fail(503, "Provider availability cannot be verified.");
      externalBusy = await writer.busy(
        published.destination,
        new Date(
          Date.parse(start) - published.bufferMinutes * 60000,
        ).toISOString(),
        new Date(
          Date.parse(start) +
            (published.durationMinutes + published.bufferMinutes) * 60000,
        ).toISOString(),
      );
    }
    const changed = await store.change("booking-host", (h) => {
      const replay = h.bookings.find((b) => b.idempotencyKey === key);
      if (replay) {
        if (replay.fingerprint !== fingerprint)
          fail(409, "Reservation key was reused.");
        return {
          state: replay.state || (replay.cancelled ? "cancelled" : "confirmed"),
          bookingId: replay.id,
          cancelToken,
          replayed: true,
        };
      }
      const p = h.pages.find((p) => p.id === request.params.id && p.active);
      if (!p) fail(404, "Booking page not found.");
      if (
        !available(
          { ...h, busy: [...h.busy, ...externalBusy] },
          p,
          start,
          now(),
        )
      )
        fail(409, "This time is unavailable or availability is stale.");
      const booking = {
        id: bookingId,
        pageId: p.id,
        title: p.title,
        start,
        end: new Date(
          Date.parse(start) + p.durationMinutes * 60000,
        ).toISOString(),
        bufferMinutes: p.bufferMinutes,
        name,
        email,
        idempotencyKey: key,
        fingerprint,
        cancelHash: digest(cancelToken),
        cancelled: false,
        ...(p.destination
          ? { destination: p.destination, state: "pending", attempts: 0 }
          : {}),
      };
      h.bookings.push(booking);
      return {
        state: p.destination ? "pending" : "confirmed",
        bookingId,
        cancelToken,
        start: booking.start,
        end: booking.end,
        calendar: p.destination
          ? p.destination.provider + " calendar"
          : "Service booking calendar",
        invitationSent: false,
      };
    });
    return changed.result;
  });
  app.post("/api/bookings/:id/cancel", async (request) => {
    const secret = bearer(request);
    const changed = await store.change("booking-host", (h) => {
      const b = h.bookings.find((b) => b.id === request.params.id);
      if (
        !b ||
        (!same(b.cancelHash, digest(secret)) && !same(secret, ownerToken))
      )
        fail(403, "Cancellation access required.");
      if (b.destination && !b.cancelled) {
        b.cancelRequested = true;
        b.state = "cancel-pending";
        b.nextAttempt = 0;
        return { ok: true, state: "cancel-pending" };
      }
      b.cancelled = true;
      return { ok: true, state: "cancelled" };
    });
    return changed.result;
  });
  app.post("/api/polls", async (request) => {
    owner(request);
    const id = token(),
      organizer = token();
    const p = {
      id,
      ...pollInput(request.body),
      organizerHash: digest(organizer),
    };
    await store.create("poll:" + id, "poll", p);
    return {
      id,
      publicUrl: publicUrl("/poll/" + id),
      organizerToken: organizer,
    };
  });
  app.get("/api/polls/:id", async (request) =>
    publicPoll(await pollFor(request.params.id)),
  );
  app.get("/api/polls/:id/participant", async (request) => {
    const p = await pollFor(request.params.id),
      v = p.votes.find((v) => same(v.tokenHash, digest(bearer(request))));
    if (!v) fail(403, "Participant access required.");
    return { name: v.name, votes: v.votes };
  });
  app.post("/api/polls/:id/vote", async (request) => {
    const input = request.body || {},
      name = text(input.name, 120),
      participant = token();
    if (!Array.isArray(input.votes) || input.votes.length > 100)
      fail(400, "Invalid votes.");
    const changed = await store.change("poll:" + request.params.id, (p) => {
      if (p.closed || p.finalized || Date.parse(p.expiresAt) <= now())
        fail(409, "This poll is closed.");
      const ids = new Set();
      const votes = input.votes.map((v) => {
        if (
          ids.has(v.optionId) ||
          !p.options.some((o) => o.id === v.optionId) ||
          !["yes", "if-needed", "no"].includes(v.availability)
        )
          fail(400, "Invalid poll option.");
        ids.add(v.optionId);
        return { optionId: v.optionId, availability: v.availability };
      });
      const supplied = bearer(request),
        existing = supplied
          ? p.votes.find((v) => same(v.tokenHash, digest(supplied)))
          : null;
      if (supplied && !existing) fail(403, "Invalid participant edit token.");
      if (existing) {
        existing.name = name;
        existing.votes = votes;
        return { updated: true };
      }
      if (p.votes.length >= 10000) fail(400, "Participant limit reached.");
      p.votes.push({
        id: token(),
        name,
        votes,
        tokenHash: digest(participant),
      });
      return { participantToken: participant, updated: false };
    });
    return changed.result;
  });
  app.post("/api/polls/:id/finalize", async (request) => {
    const changed = await store.change(
      "poll:" + request.params.id,
      (p, revision) => {
        if (!same(p.organizerHash, digest(bearer(request))))
          fail(403, "Poll organizer access required.");
        if (p.finalized) {
          if (p.finalized === request.body.optionId)
            return { finalized: p.finalized, invitationSent: false };
          fail(409, "Poll already finalized.");
        }
        if (revision !== request.body.expectedRevision)
          fail(409, "Poll changed. Review the latest votes.");
        if (p.closed || Date.parse(p.expiresAt) <= now())
          fail(409, "Poll closed.");
        if (!p.options.some((o) => o.id === request.body.optionId))
          fail(400, "Unknown option.");
        p.finalized = request.body.optionId;
        return { finalized: p.finalized, invitationSent: false };
      },
    );
    return changed.result;
  });
  app.post("/api/polls/:id/close", async (request) => {
    await store.change("poll:" + request.params.id, (p) => {
      if (!same(p.organizerHash, digest(bearer(request))))
        fail(403, "Poll organizer access required.");
      p.closed = true;
    });
    return { ok: true };
  });
  app.post("/api/workspaces", async (request) => {
    owner(request);
    const id = token(),
      memberToken = token(),
      memberId = token();
    const workspace = {
      id,
      name: text(request.body.name),
      projectRevision: 0,
      projects: [],
      members: [
        {
          id: memberId,
          name: "Owner",
          role: "owner",
          tokenHash: digest(memberToken),
          revoked: false,
        },
      ],
      receipts: [],
      tombstones: [],
    };
    await store.create("team:" + id, "team", workspace);
    return { id, memberId, memberToken, url: publicUrl("/team/" + id) };
  });
  app.get("/api/workspaces/:id", async (request) => {
    const w = await store.read("team:" + request.params.id);
    if (!w) fail(404, "Workspace not found.");
    const member = memberFor(w, bearer(request));
    return {
      id: w.id,
      name: w.name,
      projectRevision: w.projectRevision,
      projects: w.projects,
      members: w.members.map(({ tokenHash, ...m }) => m),
      currentMember: member.id,
    };
  });
  app.post("/api/workspaces/:id/projects", async (request) => {
    const id = token();
    const changed = await store.change("team:" + request.params.id, (w) => {
      const member = memberFor(w, bearer(request), true);
      if (member.role !== "owner") fail(403, "Owner access required.");
      w.projects.push({
        id,
        name: text(request.body.name),
        tasks: [],
        comments: [],
      });
      w.projectRevision++;
      return { id };
    });
    return changed.result;
  });
  app.post("/api/workspaces/:id/members", async (request) => {
    const memberToken = token(),
      id = token();
    const changed = await store.change("team:" + request.params.id, (w) => {
      if (memberFor(w, bearer(request)).role !== "owner")
        fail(403, "Owner access required.");
      const role = request.body.role;
      if (!["editor", "viewer"].includes(role))
        fail(400, "Choose editor or viewer.");
      w.members.push({
        id,
        name: text(request.body.name),
        role,
        tokenHash: digest(memberToken),
        revoked: false,
      });
      w.projectRevision++;
      return { memberId: id, memberToken };
    });
    return changed.result;
  });
  app.delete("/api/workspaces/:id/members/:member", async (request) => {
    await store.change("team:" + request.params.id, (w) => {
      if (memberFor(w, bearer(request)).role !== "owner")
        fail(403, "Owner access required.");
      const m = w.members.find((m) => m.id === request.params.member);
      if (!m || m.role === "owner") fail(400, "Cannot revoke this member.");
      m.revoked = true;
      w.projectRevision++;
    });
    return { ok: true };
  });
  app.get("/api/workspaces/:id/operations/:operation", async (request) => {
    const w = await store.read("team:" + request.params.id);
    if (!w) fail(404, "Workspace not found.");
    const m = memberFor(w, bearer(request));
    const receipt = w.receipts.find(
      (r) => r.id === request.params.operation && r.memberId === m.id,
    );
    return { receipt: receipt ? receipt.result : null };
  });
  app.post("/api/workspaces/:id/operations", async (request) => {
    const changed = await store.change("team:" + request.params.id, (w) => {
      const member = memberFor(w, bearer(request), true);
      return applyOperation(w, request.body, member);
    });
    return changed.result;
  });
  return app;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store = await openStore();
  const origin = process.env.CALM_ONLINE_ORIGIN || "http://127.0.0.1:4242";
  const oauth = process.env.CALM_PROVIDER_VAULT_KEY
    ? new ProviderOAuth({
        file:
          process.env.CALM_PROVIDER_VAULT_FILE ||
          resolve("output/online-service/provider-vault"),
        key: process.env.CALM_PROVIDER_VAULT_KEY,
        origin,
        clients: {
          google: {
            clientId: process.env.CALM_GOOGLE_WEB_CLIENT_ID,
            clientSecret: process.env.CALM_GOOGLE_WEB_CLIENT_SECRET,
          },
          microsoft: {
            clientId: process.env.CALM_MICROSOFT_WEB_CLIENT_ID,
            clientSecret: process.env.CALM_MICROSOFT_WEB_CLIENT_SECRET,
          },
        },
      })
    : null;
  const writer =
    process.env.CALM_PROVIDER_BOOKINGS === "1" && oauth
      ? new CalendarWriter({ oauth })
      : null;
  let mail = null;
  if (process.env.CALM_EMAIL_DELIVERY === "1") {
    const from = process.env.CALM_SMTP_FROM || "";
    if (
      !/^[^\s@,;<>"\r\n]+@[^\s@,;<>"\r\n]+\.[^\s@,;<>"\r\n]+$/.test(from) ||
      !process.env.CALM_SMTP_HOST
    )
      throw new Error(
        "Configure a valid SMTP sender/host before enabling delivery.",
      );
    const transport = nodemailer.createTransport({
      host: process.env.CALM_SMTP_HOST,
      port: Number(process.env.CALM_SMTP_PORT || 587),
      secure: process.env.CALM_SMTP_SECURE === "1",
      requireTLS: true,
      auth: process.env.CALM_SMTP_USER
        ? {
            user: process.env.CALM_SMTP_USER,
            pass: process.env.CALM_SMTP_PASSWORD,
          }
        : undefined,
      connectionTimeout: 20000,
      socketTimeout: 30000,
      tls: { rejectUnauthorized: true },
    });
    mail = { transport, from };
  }
  const app = await createOnline({
    store,
    trustedProxy: process.env.CALM_TRUSTED_PROXY
      ? process.env.CALM_TRUSTED_PROXY.split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      : false,
    mail,
    oauth,
    writer,
    ownerToken: process.env.CALM_ONLINE_OWNER_TOKEN,
    publicOrigin: process.env.CALM_ONLINE_ORIGIN,
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, async () => {
      await app.close();
      await store.close();
      process.exit(0);
    });
  await app.listen({
    host: process.env.CALM_ONLINE_HOST || "127.0.0.1",
    port: Number(process.env.CALM_ONLINE_PORT || 4242),
  });
  console.log(
    writer
      ? "Calm Work service is listening. Provider bookings require explicitly configured pages. Email follows the opt-in delivery configuration."
      : mail
        ? "Calm Work service is listening with opt-in email delivery; provider booking writes are disabled."
        : "Calm Work optional service is listening. No invitations or provider writes are enabled.",
  );
}
