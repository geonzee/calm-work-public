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
  async function login() {
    await page.goto(origin);
    await page.getByLabel("Organizer access token").fill(owner);
    await page.getByRole("button", { name: "Open organizer tools" }).click();
    await page.getByRole("heading", { name: "Organizer tools" }).waitFor();
  }
  await login();
  await page.getByText("New booking page", { exact: true }).click();
  await page.locator('#page-form [name="title"]').fill("Recoverable booking");
  await page
    .getByRole("button", { name: "Publish booking page", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Recoverable booking", exact: true })
    .waitFor();
  const booking = (await api("/api/admin")).pages[0];
  await page.locator('#poll-form [name="title"]').fill("Three options");
  await page.locator('#poll-form [name="first"]').fill("2026-11-20T09:00");
  await page.locator('#poll-form [name="second"]').fill("2026-11-20T10:00");
  await page.locator("#add-poll-option").click();
  await page.locator("#extra-poll-options input").fill("2026-11-20T11:00");
  await page.locator('#poll-form [name="poll-duration"]').fill("45");
  await page.getByRole("button", { name: "Publish poll", exact: true }).click();
  const link = page
    .locator("#poll-result")
    .getByRole("link", { name: "Open organizer view" });
  await link.waitFor();
  const oldLink = await link.getAttribute("href"),
    pollId = new URL(oldLink).pathname.split("/").pop();
  const published = await api("/api/polls/" + pollId);
  assert.equal(published.options.length, 3);
  assert.equal(
    Date.parse(published.options[0].end) -
      Date.parse(published.options[0].start),
    45 * 60000,
  );
  await page.locator('#team-form [name="name"]').fill("Recoverable team");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.locator("#team-result a").waitFor();
  await login();
  await page
    .locator("#organizer-polls")
    .getByRole("link", { name: "Three options", exact: true })
    .waitFor();
  await page
    .locator("#organizer-teams")
    .getByRole("link", { name: "Recoverable team", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Unpublish", exact: true }).click();
  await page
    .locator("#pages")
    .getByText("Disabled", { exact: false })
    .waitFor();
  assert.equal((await fetch(origin + "/api/pages/" + booking.id)).status, 404);
  await page.locator("#organizer-polls [data-recover]").click();
  await page.locator("#organizer-polls [data-cancel-recovery]").click();
  assert.equal(
    await page.locator("#organizer-polls [data-confirm-recovery]").count(),
    0,
  );
  await page.locator("#organizer-polls [data-recover]").click();
  await page.locator("#organizer-polls [data-confirm-recovery]").click();
  const recovered = page
    .locator("#organizer-polls")
    .getByRole("link", { name: "Open private organizer view" });
  await recovered.waitFor();
  const recoveredLink = await recovered.getAttribute("href");
  assert.notEqual(recoveredLink, oldLink);
  const oldToken = new URLSearchParams(new URL(oldLink).hash.slice(1)).get(
    "organizer",
  );
  assert.equal(
    (
      await fetch(origin + "/api/polls/" + pollId + "/close", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + oldToken,
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  await page.locator("#organizer-teams [data-recover]").click();
  await page.locator("#organizer-teams [data-confirm-recovery]").click();
  const ownerLink = page
    .locator("#organizer-teams")
    .getByRole("link", { name: "Open private owner view" });
  await ownerLink.waitFor();
  const teamUrl = new URL(await ownerLink.getAttribute("href")),
    member = new URLSearchParams(teamUrl.hash.slice(1)).get("member"),
    team = await api(
      "/api/workspaces/" + teamUrl.pathname.split("/").pop(),
      null,
      member,
    );
  assert.equal(
    team.members.find((m) => m.id === team.currentMember).role,
    "owner",
  );
  await page.goto(recoveredLink);
  await page.locator("#close-poll").click();
  await page.getByText("This poll is closed.", { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await login();
  await page
    .locator("#organizer-polls")
    .getByRole("link", { name: "Three options", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: resolve("output/organizer-phone.png") });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: multi-option polls, closure, durable lists, confirmed capability recovery, old-link invalidation, unpublishing and phone containment.",
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
