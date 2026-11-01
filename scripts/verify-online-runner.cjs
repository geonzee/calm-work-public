const { spawn } = require("node:child_process"),
  fs = require("node:fs/promises"),
  path = require("node:path"),
  net = require("node:net"),
  assert = require("node:assert/strict");
(async () => {
  const directory = await fs.mkdtemp("/tmp/calm-runner-"),
    socket = net.createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = "http://127.0.0.1:" + port,
    secret = "synthetic-runner-owner-token-not-a-real-credential";
  const child = spawn(process.execPath, ["scripts/run-online.cjs"], {
    cwd: process.env.CALM_RUNNER_TEST_ROOT || path.resolve(__dirname, ".."),
    env: {
      ...process.env,
      CALM_ONLINE_OWNER_TOKEN: secret,
      CALM_ONLINE_DATABASE_URL: "file:" + path.join(directory, "online.db"),
      CALM_ONLINE_PORT: String(port),
      CALM_ONLINE_ORIGIN: origin,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const closed = new Promise((resolve) => child.on("exit", resolve));
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const r = await fetch(origin + "/health");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.ok(
      ready,
      "Runner did not become ready: " + output.replaceAll(secret, "[redacted]"),
    );
    assert.equal((await fetch(origin + "/api/admin")).status, 401);
    assert.equal(
      (
        await fetch(origin + "/api/admin", {
          headers: { Authorization: "Bearer " + secret },
        })
      ).status,
      200,
    );
    assert.equal(output.includes(secret), false);
    console.log(
      "PASS: local runner generates client/schema, starts authenticated service, keeps secret out of output and shuts down.",
    );
  } finally {
    child.kill("SIGTERM");
    await closed;
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
