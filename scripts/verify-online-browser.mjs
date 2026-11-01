import { createRequire } from "node:module";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { createOnline } from "../services/online/src/server.mjs";
import { openStore } from "../services/online/src/store.mjs";
const require = createRequire(import.meta.url),
  { chromium } = require("../output/upstream/node_modules/@playwright/test");
const dir = await mkdtemp("/tmp/calm-online-browser-");
process.env.CALM_ONLINE_DATABASE_URL = "file:" + join(dir, "online.db");
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
  owner = "synthetic-owner-token-for-browser-tests-only";
const store = await openStore(),
  server = await createOnline({
    store,
    ownerToken: owner,
    publicOrigin: origin,
  });
await server.listen({ host: "127.0.0.1", port });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
let debugPage;
async function api(path, body, token = owner) {
  const r = await fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.json();
}
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  debugPage = page;
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.getByLabel("Organizer access token").fill(owner);
  await page.getByRole("button", { name: "Open organizer tools" }).click();
  await page.getByRole("heading", { name: "Organizer tools" }).waitFor();
  await page.getByText("New booking page", { exact: true }).click();
  await page.locator('#page-form input[name="title"]').fill("Intro call");
  await page.locator('#page-form input[name="zone"]').fill("UTC");
  await page
    .getByRole("button", { name: "Publish booking page", exact: true })
    .click();
  await page.getByRole("link", { name: "Intro call" }).waitFor();
  const admin = await api("/api/admin"),
    booking = admin.pages[0];
  await page.goto(origin + "/book/" + booking.id);
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 3);
  while ([0, 6].includes(day.getUTCDay())) day.setUTCDate(day.getUTCDate() + 1);
  await page.getByLabel("Choose a day").fill(day.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Show available times" }).click();
  await page.locator("#slots button").first().waitFor();
  await page.locator("#slots button").first().click();
  await page.getByLabel("Your name").fill("Guest");
  await page.getByLabel("Email", { exact: true }).fill("guest@example.test");
  await page.getByRole("button", { name: "Confirm booking" }).click();
  await page.getByRole("heading", { name: "Booking confirmed" }).waitFor();
  await page
    .getByRole("button", { name: "Cancel booking", exact: true })
    .click();
  await page.getByRole("heading", { name: "Booking cancelled" }).waitFor();
  const start = new Date(+day + 12 * 3600000),
    end = new Date(+start + 1800000);
  const poll = await api("/api/polls", {
    title: "Choose a time",
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    options: [
      { start: start.toISOString(), end: end.toISOString(), timeZone: "UTC" },
    ],
  });
  await page.goto(origin + "/poll/" + poll.id);
  await page.getByLabel("Your name").fill("Participant");
  await page.locator("select").selectOption("if-needed");
  await page.getByRole("button", { name: "Save availability" }).click();
  await page.getByText("1 if needed", { exact: false }).waitFor();
  assert.equal(await page.locator("select").inputValue(), "if-needed");
  assert.equal(await page.getByLabel("Your name").inputValue(), "Participant");
  await page.goto(
    origin + "/poll/" + poll.id + "#organizer=" + poll.organizerToken,
  );
  await page.getByRole("heading", { name: "Choose the final time" }).waitFor();
  await page.locator("#final-options button").click();
  await page.getByText("A time has been selected:", { exact: false }).waitFor();
  const workspace = await api("/api/workspaces", { name: "Team review" });
  await page.goto(
    origin + "/team/" + workspace.id + "#member=" + workspace.memberToken,
  );
  await page.getByLabel("Project name").fill("Shared project");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByLabel("Task name").fill("Shared task");
  await page.getByRole("button", { name: "Add shared task" }).click();
  await page.getByText("Shared task", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await page.locator('#shared-details input[name="estimate"]').fill("25");
  await page
    .locator('#shared-details textarea[name="notes"]')
    .fill("Preserve shared notes");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("25 min", { exact: false }).waitFor();
  await page.evaluate(async () => {
    const original = api;
    api = async (...args) => {
      if (args[1] === "POST" && args[0].endsWith("/operations"))
        await new Promise((resolve) => setTimeout(resolve, 150));
      return original(...args);
    };
    const projectId = workspace.projects[0].id;
    await Promise.all([
      enqueue({
        kind: "task.upsert",
        projectId,
        task: {
          id: crypto.randomUUID(),
          title: "Rapid first edit",
          done: false,
        },
      }),
      enqueue({
        kind: "task.upsert",
        projectId,
        task: {
          id: crypto.randomUUID(),
          title: "Rapid second edit",
          done: false,
        },
      }),
    ]);
    api = original;
    if (cache().outbox.length) throw new Error("Rapid edits remained pending");
  });
  await page.getByText("Rapid first edit", { exact: true }).waitFor();
  await page.getByText("Rapid second edit", { exact: true }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByText("Offline · local shared copy").waitFor();
  await page.getByLabel("Task name").fill("Offline task");
  await page.getByRole("button", { name: "Add shared task" }).click();
  await page.getByText("Offline task · waiting for sync").waitFor();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: /^Sync/ }).click();
  await page.getByText("Offline task", { exact: true }).waitFor();
  await page.getByLabel("Member name").fill("Viewer");
  await page.locator('#invite select[name="role"]').selectOption("viewer");
  await page
    .getByRole("button", { name: "Create private access link" })
    .click();
  await page.getByRole("link", { name: "Open member workspace" }).waitFor();
  const memberLink = await page
    .getByRole("link", { name: "Open member workspace" })
    .getAttribute("href");
  const memberPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  memberPage.on("pageerror", (e) => errors.push(e.message));
  await memberPage.goto(origin + memberLink);
  await memberPage.getByText("Shared task", { exact: true }).waitFor();
  assert.equal(
    await memberPage.getByRole("button", { name: "Add shared task" }).count(),
    0,
  );
  assert.equal(
    await memberPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.getByRole("button", { name: "Revoke access" }).click();
  await memberPage
    .getByRole("button", { name: "Refresh", exact: true })
    .click();
  await memberPage.getByRole("heading", { name: "Access revoked" }).waitFor();
  await memberPage
    .getByRole("button", { name: "Export pending edits" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: resolve("output/online-phone.png") });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: organizer publishing, guest booking/cancellation, retained poll edits/finalization, shared task details, offline outbox/reconnect, viewer restrictions/revocation and phone containment.",
  );
} catch (error) {
  if (debugPage) {
    await writeFile(
      resolve("output/online-error.html"),
      await debugPage.content(),
    );
    console.error(
      "Browser errors",
      errors,
      "Notice",
      await debugPage.locator("#notice").textContent(),
    );
  }
  throw error;
} finally {
  await browser.close();
  await server.close();
  await store.close();
  await rm(dir, { recursive: true, force: true });
}
