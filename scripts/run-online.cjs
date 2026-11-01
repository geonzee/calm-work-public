#!/usr/bin/env node
// Local-only convenience runner. Deployment and external exposure are separate actions.
const fs = require("node:fs"),
  path = require("node:path"),
  { randomBytes } = require("node:crypto"),
  { spawn, spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  directory = path.join(root, "output/online-service"),
  service = path.join(root, "services/online");
fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
const secretFile = path.join(directory, "owner-token");
if (!process.env.CALM_ONLINE_OWNER_TOKEN && !fs.existsSync(secretFile))
  fs.writeFileSync(secretFile, randomBytes(32).toString("base64url"), {
    mode: 0o600,
    flag: "wx",
  });
const env = {
  ...process.env,
  CALM_ONLINE_DATABASE_URL:
    process.env.CALM_ONLINE_DATABASE_URL ||
    "file:" + path.join(directory, "calendar.db"),
  CALM_ONLINE_OWNER_TOKEN:
    process.env.CALM_ONLINE_OWNER_TOKEN ||
    fs.readFileSync(secretFile, "utf8").trim(),
};
const prisma = path.join(service, "node_modules/.bin/prisma");
if (!fs.existsSync(prisma)) {
  console.error("Run npm ci --ignore-scripts in services/online first.");
  process.exit(1);
}
for (const args of [["generate"], ["db", "push", "--skip-generate"]]) {
  const result = spawnSync(
    prisma,
    [...args, "--schema", path.join(service, "prisma/schema.prisma")],
    { env, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(
  "Open " +
    (env.CALM_ONLINE_ORIGIN || "http://127.0.0.1:4242") +
    ". Organizer token is stored privately at " +
    secretFile +
    ".",
);
const child = spawn(process.execPath, [path.join(service, "src/server.mjs")], {
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code || 0));
