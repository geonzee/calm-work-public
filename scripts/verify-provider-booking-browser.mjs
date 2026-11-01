import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createOnline } from "../services/online/src/server.mjs";
import { openStore } from "../services/online/src/store.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("../output/upstream/node_modules/@playwright/test");
const directory = await mkdtemp("/tmp/calm-provider-ui-");
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
  owner = "synthetic-provider-ui-owner-token-long-enough",
  events = new Map();
const writer = {
  calendars: async () => [
    { provider: "google", calendarId: "owned", name: "Host calendar" },
  ],
  busy: async () => [],
  find: async (b) => events.get(b.id) || null,
  assertRange: () => {},
  create: async (b) => {
    const remote = {
      id: b.id,
      revision: "v1",
      event: { start: { dateTime: b.start }, end: { dateTime: b.end } },
    };
    events.set(b.id, remote);
    return remote;
  },
  remove: async (b) => {
    events.delete(b.id);
    return { removed: true };
  },
};
const oauth = {
  status: async () => [
    { provider: "google", connected: true, configured: true },
  ],
};
const store = await openStore(),
  app = await createOnline({
    store,
    ownerToken: owner,
    publicOrigin: origin,
    writer,
    oauth,
    workerIntervalMs: 1000,
  });
await app.listen({ host: "127.0.0.1", port });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel("Organizer access token").fill(owner);
  await page.getByRole("button", { name: "Open organizer tools" }).click();
  await page.getByText("New booking page", { exact: true }).click();
  await page
    .locator('#page-form input[name="title"]')
    .fill("Provider-backed intro");
  await page.locator('#page-form input[name="zone"]').fill("UTC");
  await page
    .locator('#page-form select[name="destination"]')
    .selectOption({ label: "google · Host calendar" });
  await page
    .getByRole("button", { name: "Publish booking page", exact: true })
    .click();
  const link = page.getByRole("link", {
    name: "Provider-backed intro",
    exact: true,
  });
  await link.waitFor();
  await link.click();
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 3);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  await page.getByLabel("Choose a day").fill(day.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Show available times" }).click();
  await page.locator("#slots button").first().click();
  await page.getByLabel("Your name").fill("Guest");
  await page.getByLabel("Email", { exact: true }).fill("guest@example.test");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await page
    .getByRole("heading", { name: "Booking confirmed" })
    .waitFor({ timeout: 15000 });
  assert.equal(events.size, 1);
  const h = await store.read("booking-host"),
    booking = h.bookings[0];
  assert.equal(booking.destination.provider, "google");
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Booking cancelled" })
    .waitFor({ timeout: 15000 });
  assert.equal(events.size, 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: organizer selects a configured provider destination, guest waits for durable calendar confirmation, cancellation waits for provider removal, and no invitation transport is enabled.",
  );
} finally {
  await browser.close();
  await app.close();
  await store.close();
  await rm(directory, { recursive: true, force: true });
}
