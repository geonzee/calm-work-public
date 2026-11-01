import { test } from "node:test";
import assert from "node:assert/strict";
import { convertSpTasks } from "./sp-task-converter.mjs";
test("SP migration preserves tasks, subtasks, schedules and own daily time without double-counting aggregates or copying credentials", () => {
  const source = {
    task: {
      entities: {
        parent: {
          id: "parent",
          title: "Parent",
          projectId: "p",
          subTaskIds: ["child"],
          timeSpentOnDay: { "2026-10-17": 9000 },
          isDone: false,
        },
        child: {
          id: "child",
          parentId: "parent",
          title: "Child",
          timeSpentOnDay: { "2026-10-17": 4000 },
          dueDay: "2026-10-17",
          isDone: true,
        },
      },
    },
    project: { entities: { p: { id: "p", title: "Shared" } } },
    globalConfig: { secret: "never-import" },
    issueProvider: { token: "never-import" },
  };
  const value = convertSpTasks(
    source,
    { projects: ["Shared"], tasks: [] },
    "2026-10-17",
  );
  assert.equal(value.summary.totalMs, 9000);
  assert.equal(value.summary.removedParentMs, 4000);
  assert.equal(value.tasks.length, 2);
  assert.equal(value.tasks[1].project, "SP · Shared");
  assert.equal(value.tasks[1].done, true);
  assert.match(value.tasks[1].notes, /SP parent/);
  assert.equal(JSON.stringify(value).includes("never-import"), false);
  assert.throws(
    () =>
      convertSpTasks(source, { projects: [], tasks: [{ id: "sp:parent" }] }),
    /refusing/,
  );
});
test("blank SP task titles receive an explicit import label without losing the record", () => {
  const value = convertSpTasks({
    task: {
      entities: { blank: { id: "blank", title: "", timeSpentOnDay: {} } },
    },
    project: { entities: {} },
  });
  assert.equal(value.tasks.length, 1);
  assert.equal(value.tasks[0].title, "Untitled SP task");
});
