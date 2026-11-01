/** Convert task data only; never copy SP settings, integrations or credentials into Calm Work. */
export function convertSpTasks(
  source,
  existing = { tasks: [], projects: [] },
  today = new Date().toLocaleDateString("en-CA"),
) {
  const entities = {
    ...source.archiveOld?.task?.entities,
    ...source.archiveYoung?.task?.entities,
    ...source.task?.entities,
  };
  const originals = Object.values(entities).filter(Boolean),
    projectEntities = source.project?.entities || {},
    projectNames = new Map(),
    names = [...existing.projects];
  for (const project of Object.values(projectEntities)) {
    if (!project || project.id === "INBOX") continue;
    let name = project.title.trim();
    if (names.includes(name)) {
      name = "SP · " + name;
      for (let n = 2; names.includes(name); n++)
        name = "SP · " + project.title.trim() + " (" + n + ")";
    }
    projectNames.set(project.id, name);
    names.push(name);
  }
  const result = [];
  let removedParentMs = 0;
  for (const task of originals) {
    const id = "sp:" + task.id;
    if (existing.tasks.some((t) => t.id === id))
      throw new Error(
        "SP task identities already exist; refusing to overwrite imported edits.",
      );
    const parent = entities[task.parentId],
      project = projectNames.get(task.projectId || parent?.projectId) || "";
    const days = { ...task.timeSpentOnDay };
    for (const childId of task.subTaskIds || [])
      for (const [day, amount] of Object.entries(
        entities[childId]?.timeSpentOnDay || {},
      )) {
        const removed = Math.min(days[day] || 0, amount);
        days[day] = Math.max(0, (days[day] || 0) - amount);
        removedParentMs += removed;
      }
    const extra = [];
    if (parent)
      extra.push("SP parent: " + parent.title + " [" + "sp:" + parent.id + "]");
    if (task.subTaskIds?.length)
      extra.push(
        "SP subtasks: " +
          task.subTaskIds.map((id) => entities[id]?.title || id).join("; "),
      );
    if (task.attachments?.length)
      extra.push(
        "SP attachments (original backup retains file references): " +
          JSON.stringify(task.attachments),
      );
    const cfg = source.taskRepeatCfg?.entities?.[task.repeatCfgId];
    let repeat = "",
      repeatRule = null;
    if (cfg) {
      const weekdays = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ].flatMap((day, i) => (cfg[day] ? [i] : []));
      if (cfg.repeatCycle === "WEEKLY" && weekdays.length) {
        repeat = "Custom weekly";
        repeatRule = { cycle: "weekly", every: cfg.repeatEvery || 1, weekdays };
      } else if (
        cfg.repeatCycle === "MONTHLY" &&
        cfg.monthlyWeekday != null &&
        cfg.monthlyWeekOfMonth != null
      ) {
        repeat = "Monthly weekday";
        repeatRule = {
          cycle: "monthly",
          every: cfg.repeatEvery || 1,
          weekdays: [cfg.monthlyWeekday],
          weekOfMonth: cfg.monthlyWeekOfMonth,
        };
      } else
        extra.push("SP recurrence retained for review: " + JSON.stringify(cfg));
    }
    const dateTime = task.dueWithTime ? new Date(task.dueWithTime) : null;
    const date = dateTime
      ? dateTime.getFullYear() +
        "-" +
        String(dateTime.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(dateTime.getDate()).padStart(2, "0")
      : task.dueDay || (task.tagIds?.includes("TODAY") ? today : "");
    result.push({
      id,
      title: task.title?.trim() || "Untitled SP task",
      project,
      date,
      schedule: dateTime
        ? String(dateTime.getHours()).padStart(2, "0") +
          ":" +
          String(dateTime.getMinutes()).padStart(2, "0")
        : "",
      estimate: task.timeEstimate ? task.timeEstimate / 60000 : null,
      done: !!task.isDone,
      today: date === today,
      notes: [task.notes || "", ...extra].filter(Boolean).join("\n\n"),
      repeat,
      repeatRule,
      nativeDays: days,
      nativeMs: Object.values(days).reduce((n, v) => n + v, 0),
    });
  }
  return {
    tasks: result,
    projects: names.filter((name) => !existing.projects.includes(name)),
    summary: {
      tasks: result.length,
      subtasks: originals.filter((t) => t.parentId).length,
      removedParentMs,
      totalMs: result.reduce((n, t) => n + t.nativeMs, 0),
    },
  };
}
