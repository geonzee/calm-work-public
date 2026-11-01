const {
  _electron: electron,
} = require("../output/upstream/node_modules/@playwright/test");
const fs = require("fs");
const assert = require("assert");
let runningApp;
(async () => {
  const profile = require("path").resolve(
    __dirname,
    "../output/core-baseline-persistence-" + Date.now(),
  );
  fs.mkdirSync(profile, { recursive: true });
  async function launch() {
    const app = await electron.launch({
      executablePath: require("path").resolve(
        __dirname,
        "../output/upstream/.tmp/app-builds/linux-unpacked/superproductivity",
      ),
      args: ["--no-sandbox", "--user-data-dir=" + profile],
      env: {
        ...process.env,
        XDG_CONFIG_HOME: profile + "/config",
        XDG_DATA_HOME: profile + "/data",
        XDG_CACHE_HOME: profile + "/cache",
      },
    });
    runningApp = app;
    const page = await app.firstWindow();
    await page.context().setOffline(true);
    await page.waitForFunction(
      () =>
        window.ng?.getComponent?.(document.querySelector("app-root"))
          ?._taskService,
    );
    await page.waitForTimeout(3000);
    return { app, page };
  }
  let { app, page } = await launch();
  const ids = await page.evaluate(() => {
    const s = ng.getComponent(document.querySelector("app-root"))._taskService;
    const first = s.add(
      "Offline timer persistence test",
      false,
      { projectId: "INBOX_PROJECT" },
      false,
      true,
    );
    const second = s.add(
      "Offline completion persistence test",
      false,
      { projectId: "INBOX_PROJECT" },
      false,
      true,
    );
    s.setDone(second);
    s.setCurrentId(first);
    return { first, second };
  });
  await page.waitForTimeout(10000);
  await page.evaluate(() =>
    ng
      .getComponent(document.querySelector("app-root"))
      ._taskService.setCurrentId(null),
  );
  await page.waitForTimeout(2500);
  const before = await page.evaluate(
    () =>
      new Promise((resolve) => {
        ng.getComponent(
          document.querySelector("app-root"),
        )._taskService.allTasks$.subscribe((tasks) =>
          resolve(
            tasks.map((t) => ({
              id: t.id,
              title: t.title,
              timeSpent: t.timeSpent,
              isDone: t.isDone,
            })),
          ),
        );
      }),
  );
  assert(before.find((t) => t.id === ids.first).timeSpent > 0);
  await app.close();
  ({ app, page } = await launch());
  const after = await page.evaluate(
    () =>
      new Promise((resolve) => {
        ng.getComponent(
          document.querySelector("app-root"),
        )._taskService.allTasks$.subscribe((tasks) =>
          resolve(
            tasks.map((t) => ({
              id: t.id,
              title: t.title,
              timeSpent: t.timeSpent,
              isDone: t.isDone,
            })),
          ),
        );
      }),
  );
  for (const id of Object.values(ids))
    assert.deepEqual(
      after.find((t) => t.id === id),
      before.find((t) => t.id === id),
    );
  assert(after.find((t) => t.id === ids.second).isDone);
  console.log(
    JSON.stringify(
      {
        passed: true,
        profile,
        tasks: after.filter((t) => Object.values(ids).includes(t.id)),
      },
      null,
      2,
    ),
  );
  await app.close();
})().catch(async (e) => {
  console.error(e);
  if (runningApp) await runningApp.close().catch(() => {});
  process.exitCode = 1;
});
