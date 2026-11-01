// Explicit-profile migration helper; use only on closed backup/rehearsal profiles first.
const path = require("node:path"),
  { pathToFileURL } = require("node:url"),
  root = path.resolve(__dirname, "..");
const { _electron: electron } = require(
  path.join(root, "output/upstream/node_modules/@playwright/test"),
);
const fs = require("node:fs/promises");
const [mode, profile, file] = process.argv.slice(2);
(async () => {
  const app = await electron.launch({
    executablePath: path.join(root, "scripts/launch-core.sh"),
    args: ["--no-sandbox"],
    env: { ...process.env, CALM_WORK_PROFILE: profile },
  });
  try {
    const p = await app.firstWindow(),
      f = p.frameLocator('iframe[title="Calm Work"]');
    await f.locator("#global-add").waitFor({ timeout: 60000 });
    await f.locator("body").evaluate(() => CalmRuntime.flush());
    if (mode === "extract") {
      const data = await p.evaluate(async () => {
        const s = window.ng.getComponent(
          document.querySelector("calm-shell"),
        )._workspace;
        const first = (obs) =>
          new Promise((resolve) => {
            const sub = obs.subscribe((value) => {
              resolve(value);
              queueMicrotask(() => sub.unsubscribe());
            });
          });
        return {
          tasks: await first(s._tasks.allTasks$),
          projects: s._projects.list(),
          repeats: await first(s._repeat.taskRepeatCfgs$),
        };
      });
      await fs.writeFile(file, JSON.stringify(data), { mode: 0o600 });
      console.log(
        JSON.stringify({
          extractedTasks: data.tasks.length,
          projects: data.projects.length,
        }),
      );
    } else if (mode === "merge") {
      const source = JSON.parse(await fs.readFile(file, "utf8")),
        before = await f.locator("body").evaluate(() => CalmRuntime.snapshot()),
        { convertSpTasks } = await import(
          pathToFileURL(path.join(root, "scripts/sp-task-converter.mjs")).href
        );
      const converted = convertSpTasks(source, before);
      await fs.writeFile(
        file + ".cw-before.json",
        JSON.stringify({
          format: "calm-work-workspace",
          version: 1,
          document: before,
        }),
        { mode: 0o600 },
      );
      const merged = {
        ...before,
        tasks: [...before.tasks, ...converted.tasks],
        projects: [...before.projects, ...converted.projects],
      };
      const after = await p.evaluate(async (value) => {
        const s = window.ng.getComponent(
          document.querySelector("calm-shell"),
        )._workspace;
        return await s.save(value, true);
      }, merged);
      if (after.tasks.length !== merged.tasks.length)
        throw Error("Task count mismatch");
      for (const task of converted.tasks) {
        const found = after.tasks.find((t) => t.id === task.id);
        if (
          !found ||
          found.nativeMs !== task.nativeMs ||
          found.title !== task.title ||
          found.done !== task.done
        )
          throw Error("Imported task verification failed");
      }
      for (const task of before.tasks) {
        const found = after.tasks.find((t) => t.id === task.id);
        if (
          !found ||
          found.nativeMs !== task.nativeMs ||
          found.title !== task.title
        )
          throw Error("Existing task changed");
      }
      await fs.writeFile(
        file + ".result.json",
        JSON.stringify({
          beforeTasks: before.tasks.length,
          afterTasks: after.tasks.length,
          ...converted.summary,
        }),
        { mode: 0o600 },
      );
      console.log(
        JSON.stringify({
          beforeTasks: before.tasks.length,
          afterTasks: after.tasks.length,
          ...converted.summary,
        }),
      );
    } else {
      const data = await f
        .locator("body")
        .evaluate(() => CalmRuntime.snapshot());
      console.log(
        JSON.stringify({
          tasks: data.tasks.length,
          imported: data.tasks.filter((t) => t.id.startsWith("sp:")).length,
          totalMs: data.tasks.reduce((n, t) => n + (t.nativeMs || 0), 0),
        }),
      );
    }
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
