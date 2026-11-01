// This adapter augments the reviewed renderer. Its DOM, styles and SVGs remain the source of truth.
(() => {
  const reference = window.calmReference;
  const debug = new URLSearchParams(location.search).get("debug") === "1";
  if (!reference) {
    document.body.dataset.runtime = "true";
    document.body.dataset.debug = String(debug);
    document.querySelectorAll("#navigation [data-show]").forEach((button) => {
      if (
        !["inbox", "track", "plan", "projects", "reports", "bookings", "polls", "team"].includes(
          button.dataset.show,
        )
      )
        button.hidden = !debug;
    });
  }
  if (!reference) $("mobile-menu").querySelector('[data-show="modules"]').insertAdjacentHTML("beforebegin", '<button role="menuitem" data-show="bookings">Booking</button><button role="menuitem" data-show="polls">Polls</button><button role="menuitem" data-show="team">Team</button>');
  const OPTIONAL_VIEWS = ["bookings", "polls", "team"];
  // Booking, Polls and Team stay in the code but are hidden until enabled in Settings.
  function optionalModulesOn() {
    return !!drafts?.$settings?.optionalModules;
  }
  function applyModuleVisibility() {
    if (reference) return;
    const on = optionalModulesOn();
    document
      .querySelectorAll(OPTIONAL_VIEWS.map((key) => `#navigation [data-show="${key}"],#mobile-menu [data-show="${key}"]`).join(","))
      .forEach((button) => (button.hidden = !on));
    document.body.dataset.optionalModules = String(on);
  }
  window.calmOptionalModulesOn = () => reference || optionalModulesOn();
  const requests = new Map();
  let ready = false,
    applying = false,
    saveTimer,
    clock = null,
    drafts = {},
    exported = null,
    lastSignature = "",
    saveChain = Promise.resolve();
  let sharedApplying = false;
  const deferredSharedTrayActions = [];
  const fixture = {
    tasks: structuredClone(tasks),
    projects: [...projects],
    sessions: structuredClone(state.sessions),
    events: Object.values(sampleCalendarEvents()).map((event) => ({
      ...event,
      owned: true,
      calendar: "Local calendar",
    })),
    clock: null,
    drafts: {},
  };
  const nativeClock = () => {
    const date = new Date();
    return (
      date.getHours() * 60 +
      date.getMinutes() +
      date.getSeconds() / 60 +
      date.getMilliseconds() / 60000
    );
  };
  const request = (command, document, requestId = crypto.randomUUID(), extra = {}) =>
    new Promise((resolve, reject) => {
      const timeout = command === "restore" ? null : setTimeout(() => {
        requests.delete(requestId);
        reject(new Error("Local save timed out"));
      }, 15000);
      requests.set(requestId, { resolve, reject, timeout });
      parent.postMessage(
        { channel: "calm-work-v1", requestId, command, ...extra, ...(command === "restore" ? { archive: document } : { document }) },
        "*",
      );
    });
  function accrue(now = Date.now()) {
    if (!clock?.running) return;
    let cursor = clock.resumedAt;
    clock.dailyMs ||= {};
    while (cursor < now) {
      const end = new Date(cursor);
      end.setHours(24, 0, 0, 0);
      const next = Math.min(now, end.getTime());
      const day = calmDateString(new Date(cursor));
      clock.dailyMs[day] = (clock.dailyMs[day] || 0) + next - cursor;
      clock.elapsedMs += next - cursor;
      cursor = next;
    }
    clock.resumedAt = now;
    clock.lastActiveAt = now;
  }
  function elapsed() {
    return clock
      ? clock.elapsedMs + (clock.running ? Date.now() - clock.resumedAt : 0)
      : 0;
  }
  function syncClock() {
    if (state.active !== clock?.active) {
      if (state.active) {
        const task = getTask(state.active);
        clock = {
          active: state.active,
          running: state.running,
          startedAt: Date.now(),
          elapsedMs: 0,
          resumedAt: Date.now(),
          estimate: task?.estimate || null,
          nativeStartMs: task?.nativeMs || 0,
          nativeStartDays: { ...(task?.nativeDays || {}) },
          dailyMs: {},
          lastActiveAt: Date.now(),
        };
        if (task) task.today = task.date === calmToday() || task.today;
      } else clock = null;
    }
    if (clock && state.running !== clock.running) {
      accrue();
      clock.running = state.running;
      clock.resumedAt = Date.now();
    }
    state.seconds = Math.floor(elapsed() / 1000);
    state.nowMinute = nativeClock();
    if (clock) {
      const start = new Date(clock.startedAt);
      state.sessionDate = calmDateString(start);
      state.sessionStartMinute =
        start.getHours() * 60 +
        start.getMinutes() +
        start.getSeconds() / 60 +
        start.getMilliseconds() / 60000;
      state.liveSession = {
        startTimestamp: clock.startedAt,
        endTimestamp: clock.running
          ? Date.now()
          : clock.lastActiveAt || clock.resumedAt,
      };
    } else state.liveSession = null;
  }
  function documentSnapshot() {
    drafts.$capture = {
      title: $("add-title").value || state.addTitle || "",
      active: state.addDraftActive,
      ...state.add,
    };
    for (const [name, notes] of Object.entries(state.projectNotes || {}))
      drafts["project:" + name] = { notes };
    // Always send both maps, even when empty: the host saves only the difference from
    // mergeBase, so an empty map never deletes a link this device did not remove itself.
    drafts.$eventMeta = { json: JSON.stringify(state.eventMeta || {}) };
    drafts.$projectCalendars = { json: JSON.stringify(state.projectCalendars || {}) };
    for (const name of state.deletedProjects || []) delete drafts["project:" + name];
    return {
      deletedTaskIds: [...state.deletedTaskIds],
      deletedProjects: [...(state.deletedProjects || [])],
      projectRenames: { ...state.projectRenames },
      today: calmToday(),
      tasks: tasks.map((task) => ({
        ...task,
        actual: task.actual ? { ...task.actual } : null,
      })),
      projects: [...projects],
      sessions: state.sessions.map((session) => ({ ...session })),
      events: state.localEvents.map((event) => ({ ...event })),
      clock: clock ? structuredClone(clock) : null,
      drafts: structuredClone(drafts),
      mergeBase: { ...state.mergeBase },
    };
  }
  function signature(document) {
    const value = structuredClone(document);
    delete value.mergeBase;
    value.tasks.forEach((task) => {
      delete task.nativeMs;
      delete task.nativeDays;
    });
    return JSON.stringify(value);
  }
  function commit(immediate = false, requestId) {
    if (reference || !ready || applying) return Promise.resolve();
    syncClock();
    const value = documentSnapshot(),
      next = signature(value);
    if (next === lastSignature && !requestId) return saveChain;
    clearTimeout(saveTimer);
    const save = () => {
      saveChain = saveChain
        .catch(() => undefined)
        .then(async () => {
          const document = await request("save", value, requestId);
          for (const row of document.tasks) {
            const task = getTask(row.id);
            if (task) {
              task.nativeMs = row.nativeMs;
              task.nativeDays = row.nativeDays;
              task.shared = row.shared;
            }
          }
          window.calmSharedProjects = document.sharedProjects || [];
          scheduleSharedSync();
          for (const id of value.deletedTaskIds || [])
            state.deletedTaskIds = state.deletedTaskIds.filter(
              (item) => item !== id,
            );
          state.deletedProjects = (state.deletedProjects || []).filter(
            (name) => !(value.deletedProjects || []).includes(name),
          );
          scheduleMirrorSync();
          for (const [oldName, newName] of Object.entries(
            value.projectRenames || {},
          ))
            if (state.projectRenames[oldName] === newName)
              delete state.projectRenames[oldName];
          // What this device just sent is now what it last saw.
          state.mergeBase = {
            projectCalendars: value.drafts.$projectCalendars?.json,
            eventMeta: value.drafts.$eventMeta?.json,
          };
          lastSignature = signature({
            ...value,
            deletedTaskIds: [],
            deletedProjects: [],
            projectRenames: {},
          });
        })
        .catch(() => {
          notify("Local change not saved · retry after checking storage.");
          throw new Error("Local save failed");
        });
      return saveChain;
    };
    if (immediate) return save();
    saveTimer = setTimeout(() => {
      void save().catch(() => {});
    }, 100);
    return Promise.resolve();
  }
  function readTimeZones(value, fallback) {
    let list = value;
    if (typeof list === "string") {
      try { list = JSON.parse(list); } catch { list = null; }
    }
    return Array.isArray(list) ? list.slice(0, 3).map((zone) => String(zone || "")) : fallback;
  }
  function hydrate(document) {
    window.calmSharedProjects = document.sharedProjects || [];
    recoveryPending = !!document.recoveryPending;
    if (recoveryPending) setTimeout(() => restoreDialog(true), 0);
    applying = true;
    tasks.splice(0, tasks.length, ...document.tasks);
    projects.splice(0, projects.length, ...document.projects);
    state.sessions = document.sessions;
    state.localEvents = document.events;
    clock = document.clock;
    drafts = document.drafts || {};
    state.mergeBase = {};
    // An unreadable copy leaves no baseline, so nothing on this device can delete a link.
    try {
      state.eventMeta = JSON.parse(drafts.$eventMeta?.json || "{}") || {};
      state.mergeBase.eventMeta = JSON.stringify(state.eventMeta);
    } catch {
      state.eventMeta = {};
    }
    state.extraTimeZones = readTimeZones(drafts.$settings?.timeZones, state.extraTimeZones);
    try {
      state.projectCalendars = JSON.parse(drafts.$projectCalendars?.json || "{}") || {};
      state.mergeBase.projectCalendars = JSON.stringify(state.projectCalendars);
    } catch {
      state.projectCalendars = {};
    }
    state.deletedTaskIds = [];
    state.deletedProjects = [];
    state.projectRenames = {};
    applyModuleVisibility();
    const capture = drafts.$capture;
    if (capture) {
      state.addTitle = String(capture.title || "");
      state.addDraftActive = !!capture.active;
      for (const field of ["project", "schedule", "estimate", "repeat"])
        state.add[field] = String(capture[field] || "");
      $("add-title").value = state.addTitle;
    }
    state.projectNotes = Object.fromEntries(
      Object.entries(drafts)
        .filter(([key]) => key.startsWith("project:"))
        .map(([key, value]) => [key.slice(8), value.notes || ""]),
    );
    // Resolve identity after JSON transport, so Reports edits also update a task's latest actual interval.
    tasks.forEach((task) => {
      task.actual =
        state.sessions.find(
          (session) => session.sessionKey === task.actual?.sessionKey,
        ) || null;
    });
    state.active = clock?.active || null;
    state.running = !!clock?.running;
    syncClock();
    lastSignature = signature(documentSnapshot());
    renderScreen();
    applying = false;
  }
  const originalRender = renderScreen;
  renderScreen = function () {
    if (!reference && ready) syncClock();
    if (!reference && OPTIONAL_VIEWS.includes(state.view) && !optionalModulesOn()) state.view = "track";
    originalRender();
    if (!reference) renderOnlineModule();
    bindRuntimeForms();
    if (!reference && ready) {
      void commit();
    }
  };
  const originalRepaint = repaintPlan;
  repaintPlan = function () {
    originalRepaint();
    if (!reference && ready && !applying) void commit();
  };
  const originalRecord = recordSession;
  recordSession = function () {
    if (reference) return originalRecord();
    if (!clock || !state.active) return;
    accrue();
    const task = getTask(state.active),
      start = new Date(clock.startedAt),
      end = new Date(clock.lastActiveAt || Date.now());
    const startMinute =
      start.getHours() * 60 +
      start.getMinutes() +
      start.getSeconds() / 60 +
      start.getMilliseconds() / 60000;
    const endMinute = startMinute + (end.getTime() - start.getTime()) / 60000;
    const session = {
      sessionKey: crypto.randomUUID(),
      id: task.id,
      title: task.title,
      project: task.project,
      date: calmDateString(start),
      start: timeString(startMinute),
      end: timeString(end.getHours() * 60 + end.getMinutes()),
      startMinute,
      endMinute,
      startTimestamp: start.getTime(),
      endTimestamp: end.getTime(),
      focusedSeconds: clock.elapsedMs / 1000,
      duration: clock.elapsedMs / 60000,
      estimate: clock.estimate,
      nativeStartMs: clock.nativeStartMs,
      nativeStartDays: clock.nativeStartDays,
      dailyMs: structuredClone(clock.dailyMs),
      recorded: true,
    };
    state.sessions.push(session);
    task.actual = session;
    task.today = task.date === calmToday() || task.today;
  };
  const originalSaveEntry = saveEntry;
  saveEntry = function (index) {
    const previous = state.sessions[index]
      ? structuredClone(state.sessions[index])
      : null;
    originalSaveEntry(index);
    const session = state.sessions[index];
    if (!reference && session && previous) {
      if (
        session.startMinute !== previous.startMinute ||
        session.endMinute !== previous.endMinute ||
        session.focusedSeconds !== previous.focusedSeconds
      ) {
        session.dailyMs = {
          [session.date]: Math.round(session.focusedSeconds * 1000),
        };
      } else if (session.date !== previous.date && previous.dailyMs) {
        const delta = Math.round(
          (new Date(session.date + "T12:00:00Z") -
            new Date(previous.date + "T12:00:00Z")) /
            86400000,
        );
        session.dailyMs = Object.fromEntries(
          Object.entries(previous.dailyMs).map(([day, amount]) => {
            const shifted = new Date(day + "T12:00:00");
            shifted.setDate(shifted.getDate() + delta);
            return [calmDateString(shifted), amount];
          }),
        );
      }
      void commit();
    }
  };
  function formKey() {
    return $("review-picker").value || state.view;
  }
  function eligibleFields(root) {
    return [...root.querySelectorAll("input,select,textarea")].filter(
      (field) =>
        field.type !== "password" &&
        !/secret|token|passphrase|credential|key/i.test(
          (field.name || "") +
            " " +
            (field.id || "") +
            " " +
            (field.closest("label")?.textContent || ""),
        ),
    );
  }
  function bindRuntimeForms() {
    // Core editors read domain state; indexed prototype drafts must never overwrite another task.
    if (
      reference ||
      [
        "track",
        "inbox",
        "plan",
        "projects",
        "project",
        "project-board",
        "reports",
      ].includes(state.view)
    )
      return;
    for (const root of [$("screen"), $("drawer-content")]) {
      const key = formKey() + ":" + root.id,
        fields = eligibleFields(root);
      if (drafts[key])
        fields.forEach((field, index) => {
          const value = drafts[key][index];
          if (value !== undefined) {
            if (field.type === "checkbox" || field.type === "radio")
              field.checked = !!value;
            else if (
              !field.matches(
                "#task-filter,#report-task-filter,#picker-search,[name=schedule],[name=schedule-time],#detail-title,#detail-project,[name=estimate],#detail-repeat,#detail-notes,[role=combobox],#project-name,#project-notes",
              )
            )
              field.value = String(value);
          }
        });
      fields.forEach((field, index) => {
        if (field.dataset.runtimeBound) return;
        field.dataset.runtimeBound = "1";
        field.addEventListener("change", () => {
          if (
            /^(task|new-task|mobile-task|calendar-new|calendar-event)/.test(
              formKey(),
            )
          )
            return;
          drafts[key] ||= {};
          drafts[key][index] =
            field.type === "checkbox" || field.type === "radio"
              ? field.checked
              : field.value;
          void commit();
        });
      });
    }
  }
  const originalDrawer = openStaticDrawer;
  openStaticDrawer = function (key) {
    originalDrawer(key);
    bindRuntimeForms();
  };
  let recoveryPending = false;
  function restoreDialog(required = recoveryPending) {
    let dialog = document.getElementById("workspace-recovery");
    if (dialog) return;
    dialog = document.createElement("dialog");
    dialog.id = "workspace-recovery";
    dialog.setAttribute("aria-labelledby", "recovery-title");
    dialog.innerHTML = '<h2 id="recovery-title">Restore workspace</h2><p>Choose a Calm Work JSON export. Restore requires an empty profile and never replaces existing work. A recovered timer stays paused.</p><label>Workspace export<input id="recovery-file" type="file" accept="application/json,.json"></label><p id="recovery-preview" role="status"></p><div class="actions"><button class="quiet" id="recovery-apply" disabled>Restore</button><button class="quiet" id="recovery-cancel">Cancel</button></div>';
    document.body.append(dialog);
    dialog.showModal();
    let archive = null, busy = false;
    const preview = dialog.querySelector("#recovery-preview"), apply = dialog.querySelector("#recovery-apply"), cancel = dialog.querySelector("#recovery-cancel");
    const close = () => { if (required || busy) return; dialog.close(); dialog.remove(); document.getElementById("workspace-restore")?.focus(); };
    cancel.hidden = required; cancel.onclick = close;
    dialog.oncancel = event => { event.preventDefault(); close(); };
    dialog.onkeydown = event => event.stopPropagation();
    dialog.querySelector("#recovery-file").onchange = async event => {
      archive = null; apply.disabled = true;
      const file = event.target.files[0];
      if (!file) return;
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error("Export exceeds 20 MB.");
        const value = JSON.parse(await file.text());
        if (value.format !== "calm-work-workspace" || value.version !== 1 || !Array.isArray(value.document?.tasks) || !Array.isArray(value.document?.sessions) || !Array.isArray(value.document?.projects) || !Array.isArray(value.document?.events)) throw new Error("Choose a valid Calm Work version 1 export.");
        archive = value;
        preview.textContent = `${value.document.tasks.length} tasks · ${value.document.projects.length} projects · ${value.document.sessions.length} time entries · ${value.document.events.length} events. Ready for validation and restore.`;
        apply.disabled = false;
      } catch (error) { preview.textContent = error.message; }
    };
    apply.onclick = async () => {
      if (!archive || busy) return;
      busy = true; apply.disabled = true; cancel.disabled = true;
      preview.textContent = "Restoring locally. Keep this window open until recovery finishes.";
      dialog.querySelector("#recovery-file").disabled = true;
      try {
        if (!recoveryPending) await commit(true);
        applying = true;
        const value = await request("restore", archive);
        recoveryPending = false; required = false; busy = false;
        dialog.close(); dialog.remove(); applying = false; hydrate(value);
        notify("Workspace restored. Any recovered timer is paused.");
      } catch (error) {
        applying = false; busy = false;
        preview.textContent = error.message + " You can retry the same export after an interrupted restore.";
        apply.disabled = false; cancel.disabled = false;
        dialog.querySelector("#recovery-file").disabled = false;
      }
    };
  }
  document.addEventListener("click", event => { if (event.target.closest("#workspace-restore")) restoreDialog(); });
  async function downloadWorkspace() {
    accrue();
    await commit(true);
    const document = structuredClone(documentSnapshot());
    if (document.clock) document.clock.running = false;
    const data = JSON.stringify(
      {
        format: "calm-work-workspace",
        version: 1,
        exportedAt: new Date().toISOString(),
        document,
      },
      null,
      2,
    );
    exported = { format: "workspace", data };
    downloadFile(
      data,
      "application/json",
      "calm-work-workspace-" + calmToday() + ".json",
    );
    // The native download notification provides the saved file and Open folder.
  }
  function downloadFile(data, type, name) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function download(format) {
    const sessions = reportSessions();
    const rows = [
      ...sessions.map((session) => ({
        task: session.title,
        project: session.project,
        date: session.date,
        start: session.start,
        end: session.end,
        recordedSeconds: session.source === "plan" ? 0 : session.focusedSeconds,
        estimateMinutes: session.source === "plan" ? session.duration : session.estimate,
      })),
      ...estimateOnlyTasks()
        .filter(({ task }) => !sessions.some((session) => session.id === task.id))
        .map(({ task, date, length }) => ({
          task: task.title,
          project: task.project,
          date,
          start: task.schedule || "",
          end: "",
          recordedSeconds: 0,
          estimateMinutes: length,
        })),
      ...reportEvents().map((event) => ({
        task: event.title || "Event",
        project: eventProject(event) || "",
        date: event.date,
        start: event.start,
        end: shownEventEnd(event),
        recordedSeconds: eventMinutes(event) * 60,
        estimateMinutes: null,
      })),
    ];
    const quote = (value) =>
      '"' + String(value ?? "").replaceAll('"', '""') + '"';
    const data =
      format === "json"
        ? JSON.stringify(rows, null, 2)
        : [
            [
              "task",
              "project",
              "date",
              "start",
              "end",
              "recordedSeconds",
              "estimateMinutes",
            ].join(","),
            ...rows.map((row) => Object.values(row).map(quote).join(",")),
          ].join("\n");
    exported = { format, data };
    downloadFile(
      data,
      format === "json" ? "application/json" : "text/csv",
      "calm-work-time-report." + format,
    );
  }
  for (const type of ["input", "change"])
    document.addEventListener(type, (event) => {
      if (reference || !event.target.closest("#add-overlay")) return;
      state.addTitle = $("add-title").value;
      void commit();
    });
  const originalCloseAdd = closeAdd;
  closeAdd = function () {
    originalCloseAdd();
    void commit();
  };
  $("close-add").onclick = closeAdd;
  document.addEventListener("click", (event) => {
    if (reference) return;
    const button = event.target.closest("button");
    if (!button) return;
    if (button.closest("#calendar-account-controls,#shared-workspace-controls,#sync-controls") || button.dataset.show || button.dataset.teamAction || button.id === "open-online-module" || button.id === "workspace-restore") return;
    const text = button.textContent.trim();
    if (
      state.view === "reports" &&
      /^(Download|Export) (CSV|JSON)/i.test(text)
    ) {
      event.preventDefault();
      download(/json/i.test(text) ? "json" : "csv");
      return;
    }
    if (text === "Download export") {
      event.preventDefault();
      const format =
        $("drawer-content").querySelector("select")?.value === "JSON"
          ? "json"
          : "csv";
      download(format);
      return;
    }
    if (
      /^(Save|Apply|Confirm|Submit|Vote|Finalize|Cancel booking)/i.test(text) &&
      !button.id &&
      !button.dataset.saveEntry
    ) {
      setTimeout(() => {
        void commit(true).catch(() => {});
        notify("Design preview only · no live action performed.");
      }, 0);
    }
    if (
      /^(Connect|Authorize|Enable AI|Generate token|Restore backup)/i.test(text)
    ) {
      event.preventDefault();
      notify(
        "This integration is not connected in the local development build.",
      );
    }
  });
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.channel !== "calm-work-v1")
      return;
    if (event.data.event === "tray-action" && ready && !reference) {
      const action = event.data.action;
      if (sharedApplying) { deferredSharedTrayActions.push(action); return; }
      if (action?.type === "toggle" && action.id === state.active) {
        $("header-pause")?.click();
      } else if (
        action?.type === "complete" &&
        action.id === state.active &&
        state.active
      ) {
        finishTask();
      } else if (
        action?.type === "start" &&
        getTask(action.id) &&
        !getTask(action.id).done
      ) {
        if (state.active !== action.id || !state.running)
          startTask(action.id, { fromTray: true });
      } else if (action?.type === "task" && getTask(action.id)) {
        const open = () => {
          show("track");
          state.selected = action.id;
          $("screen")
            .querySelector(`[data-row="${CSS.escape(action.id)}"]`)
            ?.focus();
        };
        if (!guardDrawerChange(open)) open();
      } else if (action?.type === "event") {
        const event = allEvents().find((e) => e.id === action.id);
        if (event) {
          const open = () => {
            show("plan");
            openEvent(event.id);
          };
          if (!guardDrawerChange(open)) open();
        }
      }
      publishTray();
      return;
    }
    if (event.data.event === "prepare-close") {
      if (clock) {
        accrue();
        clock.running = false;
        state.running = false;
      }
      void commit(true, event.data.requestId).catch(() => {});
      return;
    }
    const waiting = requests.get(event.data.requestId);
    if (!waiting) return;
    clearTimeout(waiting.timeout);
    requests.delete(event.data.requestId);
    event.data.error
      ? waiting.reject(new Error(event.data.reason || "Local save failed"))
      : waiting.resolve(event.data.backfill ?? event.data.document);
  });
  async function seedReference() {
    if (tasks.length || state.sessions.length || state.localEvents.length)
      throw new Error("Sample data can only be loaded into an empty workspace");
    const document = structuredClone(fixture);
    document.sessions = document.sessions.map((session) => ({
      ...session,
      sessionKey: crypto.randomUUID(),
      date: calmToday(),
      startMinute: minutes(session.start),
      endMinute: minutes(session.end),
      focusedSeconds: session.duration * 60,
      estimate: null,
      recorded: true,
    }));
    const value = await request("seed", document);
    ready = true;
    hydrate(value);
    notify("Sample workspace loaded locally.");
  }
  const calendarRequests = new Map();
  let calendarStatus = { accounts: [], events: [] },
    calendarBusy = false, calendarRenderPending = false, calendarNextAt = Date.now() + 300000,
    calendarPlanSignature = "";
  function planSignature(result) {
    const events = [...(result?.events || [])]
      .map((event) => [event.id, event.title, event.date, event.start, event.end, event.calendar || "", event.allDay ? 1 : 0, event.editable ? 1 : 0, event.color || "", event.busy === false ? 0 : 1])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const marks = Object.entries(result?.mirror?.tasks || {})
      .map(([id, item]) => [id, item?.state || ""])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return JSON.stringify([events, marks]);
  }
  function setCalendarNotice(text) {
    const next = text || "";
    if (next === (window.calmCalendarNotice || "")) return;
    window.calmCalendarNotice = next;
    const node = document.getElementById("calendar-stale");
    if (node) {
      node.hidden = !next;
      node.textContent = next;
      return;
    }
    if (state.view === "plan" && calendarCanRender()) repaintPlan();
  }
  function calendarCanRender() {
    return !sharedApplying && !recoveryPending && $("drawer").hidden && !activeModal() && !document.querySelector("dialog[open]") && !document.activeElement?.matches("input,textarea,select") && !calendarDrag;
  }
  async function refreshCalendarsAutomatically() {
    if (calendarBusy || sharedApplying || recoveryPending || !calendarStatus.accounts.length || Date.now() < calendarNextAt) return;
    calendarNextAt = Date.now() + 300000; calendarBusy = true;
    const failed = [];
    try {
      for (const account of [...calendarStatus.accounts]) {
        try { await calendarCommand({action:"refresh",provider:account.provider,accountId:account.accountId||account.provider}); }
        catch { failed.push(account); }
      }
    } finally { calendarBusy = false; renderCalendarAccounts(); }
    if (failed.length) {
      const names = [...new Set(failed.map((account) => account.provider === "microsoft" ? "Microsoft 365" : account.provider === "google" ? "Google Calendar" : account.provider === "caldav" ? "CalDAV" : "A calendar"))];
      setCalendarNotice(names.join(" and ") + " could not refresh. Showing the last copy.");
    } else setCalendarNotice("");
  }
  function calendarCommand(input) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        calendarRequests.delete(requestId);
        reject(new Error("Calendar request timed out."));
      }, 210000);
      calendarRequests.set(requestId, { resolve, timer });
      parent.postMessage(
        { channel: "calm-work-v1", command: "calendar", requestId, input },
        "*",
      );
    }).then((result) => {
      if (result.error) throw new Error(result.error);
      applyCalendarStatus(result);
      return result;
    });
  }
  function applyCalendarStatus(result) {
    const next = planSignature(result);
    const changed = next !== calendarPlanSignature;
    calendarPlanSignature = next;
    calendarStatus = result;
    window.calmMirror = result.mirror || null;
    window.calmCalendarAccounts = result.accounts || [];
    window.calmProviderEvents = Object.fromEntries(
      (result.events || []).map((event) => [event.id, event]),
    );
    renderCalendarAccounts();
    if (!changed && !calendarRenderPending) return;
    if (calendarCanRender()) { repaintPlan(); calendarRenderPending = false; }
    else if (changed) calendarRenderPending = true;
  }
  /** Calendars Ada can create and edit events on, for the event editor's picker. */
  function writableCalendars() {
    const list = [];
    for (const [accountId, calendars] of Object.entries(calendarStatus.calendars || {}))
      for (const calendar of calendars || [])
        if (calendar.canWrite && calendar.synced !== false && calendarStatus.accounts.some((a) => (a.accountId || a.provider) === accountId && a.canWrite))
          list.push({ key: `${accountId}|${calendar.id}`, accountId, calendarId: calendar.id, label: calendar.label || calendar.name });
    return list;
  }
  // Event editing on provider calendars; the main process checks writability and etags.
  window.calmEventApi = {
    calendars: writableCalendars,
    defaultKey() {
      const list = writableCalendars();
      const calm = list.find((item) => item.accountId === "google" && /(^|· )Calm Work$/.test(item.label));
      return (calm || list.find((item) => item.calendarId === calendarStatus.accounts.find((a) => a.accountId === item.accountId)?.label) || list[0])?.key || "";
    },
    get: (ref) => calendarCommand({ action: "event-get", ref }).then((result) => result.event),
    create: (event) => calendarCommand({ action: "event-create", event }),
    update: (ref, base, changes, scope) => calendarCommand({ action: "event-update", ref, base, changes, scope }),
    remove: (ref, base, scope) => calendarCommand({ action: "event-delete", ref, base, scope }),
  };
  window.addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.channel !== "calm-work-v1")
      return;
    if (event.data.event === "calendar-update" && event.data.calendar && !event.data.calendar.error) {
      applyCalendarStatus(event.data.calendar);
      return;
    }
    const pending = calendarRequests.get(event.data.requestId);
    if (!pending || !event.data.calendar) return;
    clearTimeout(pending.timer);
    calendarRequests.delete(event.data.requestId);
    pending.resolve(event.data.calendar);
  });
  function signInReason(provider, registration, account) {
    if (calendarBusy) return "Waiting for the sign-in in your browser…";
    if (!registration && provider !== "google") return "Add the one-time Calendar setup below first.";
    if (account && !account.canWrite) return "Signed in read-only. Sign in again to allow time blocks.";
    return "";
  }
  /** Which calendars of this account are fetched, shown in Plan and offered in pickers. */
  function calendarChoices(accountId) {
    const list = calendarStatus.calendars?.[accountId] || [];
    if (!list.length) return `<p class="settings-hint calendar-choices-empty">Calendars appear here after the first refresh.</p>`;
    return `<fieldset class="calendar-choices" aria-label="Calendars to sync"><legend>Calendars to sync</legend>${list.map((calendar) => `<div class="calendar-choice"><input type="checkbox" data-calendar-select="${esc(accountId)}" value="${esc(calendar.id)}" aria-label="Sync ${esc(calendar.name)}" ${calendar.synced !== false ? "checked" : ""} ${calendar.calm || calendarBusy ? "disabled" : ""}><input type="color" data-calendar-color="${esc(accountId)}" data-calendar-id="${esc(calendar.id)}" value="${/^#[0-9a-f]{6}$/i.test(calendar.color || "") ? calendar.color : "#86827b"}" aria-label="Colour for ${esc(calendar.name)}" ${calendarBusy ? "disabled" : ""}><span class="calendar-choice-name">${esc(calendar.name)}</span><small>${calendar.calm ? "Calm Work · always synced" : calendar.canWrite ? "Editable" : "Read-only"}</small></div>`).join("")}</fieldset>`;
  }
  function googleAdvanced(openSetup) {
    const custom = calendarStatus.googleCustomClient || {};
    const using = Object.entries(custom).filter(([, on]) => on).map(([slot]) => (slot === "google-2" ? "account 2" : "account 1"));
    return `<p class="settings-hint">Uses Super Productivity’s Google sign-in, so there is nothing to set up. For time blocks, create a calendar named “Calm Work” in the Google account you sign in with.</p><details data-setup="google" ${openSetup.has("google") ? "open" : ""}><summary>Advanced · your own Google client${using.length ? ` · in use for ${using.join(" and ")}` : ""}</summary><p class="settings-hint">Only if you have your own Google Cloud desktop client. Leave empty to use the built-in sign-in.</p><form data-calendar-connect="google"><label>Account <select name="accountId"><option value="google">Google account 1</option><option value="google-2">Google account 2</option></select></label><label>Client ID <input name="clientId" autocomplete="off" spellcheck="false"></label><label>Client secret <input name="clientSecret" type="password" autocomplete="off"></label><button class="quiet" ${calendarBusy?"disabled":""}>Sign in with this client</button></form></details>`;
  }
  function caldavSection() {
    const account = (calendarStatus.accounts || []).find((item) => (item.accountId || item.provider) === "caldav");
    const title = account?.name || (String(account?.label || "").includes("@") ? account.label : "iCloud");
    const server = account?.serverUrl || "https://caldav.icloud.com";
    const form = `<form data-calendar-connect="caldav" class="settings-inline-form"><label>Name <input name="name" value="${esc(account?.name || "")}" placeholder="iCloud" maxlength="80" autocomplete="off"></label><label>Server <input name="serverUrl" type="url" value="${esc(server)}" required autocomplete="off" spellcheck="false"></label><label>Email <input name="username" type="text" value="${esc(account?.label || "")}" required autocomplete="off" spellcheck="false"></label><label>App-specific password <input name="password" type="password" required autocomplete="off"></label><button class="quiet" ${calendarBusy ? "disabled" : ""}>${account ? "Update connection" : "Connect"}</button></form>`;
    return `<section class="settings-group"><h3>iCloud and CalDAV</h3><p class="settings-hint">Uses Super Productivity’s CalDAV calendar. For iCloud, create an app-specific password at appleid.apple.com and leave the server as caldav.icloud.com.</p>${account ? `<div class="calendar-account"><div class="calendar-account-text"><strong>${esc(title)}</strong><span>${account.canWrite ? "Can add events" : "Read-only"}${account.refreshedAt ? " · updated " + esc(new Date(account.refreshedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })) : ""}</span></div><div class="calendar-account-actions"><button class="quiet" data-calendar-command="refresh" data-provider="caldav" data-account="caldav" ${calendarBusy ? "disabled" : ""}>Refresh</button><button class="quiet" data-calendar-command="disconnect" data-provider="caldav" data-account="caldav" ${calendarBusy ? "disabled" : ""}>Disconnect</button></div></div>${calendarChoices("caldav")}<details><summary>Update the password or server</summary>${form}</details>` : form}</section>`;
  }
  function renderCalendarAccounts() {
    const target = document.getElementById("calendar-account-controls");
    if (!target) return;
    const fields = [...target.querySelectorAll("input")].map(input=>({name:input.name,provider:input.closest('[data-calendar-connect]')?.dataset.calendarConnect,value:input.value,focused:document.activeElement===input,selection:[input.selectionStart,input.selectionEnd]}));
    const openSetup = new Set([...target.querySelectorAll("details[data-setup][open]")].map((item) => item.dataset.setup));
    document.getElementById("calendar-connections").textContent =
      "Your Google, Microsoft 365 and CalDAV calendars, including iCloud, appear here. Press Refresh after you add one. Turn it on to show its events in Plan and to use it on a project. Sign-in stays on this device.";
    const mirror = calendarStatus.mirror || { targets: [], enabled: true, pending: 0, tasks: {} };
    const conflicts = Object.values(mirror.tasks || {}).filter((item) => item.state === "conflict").length,
      failures = Object.values(mirror.tasks || {}).filter((item) => item.state === "error").length;
    const blocks = `<section class="settings-group"><h3>Time blocks</h3><label class="settings-toggle"><input type="checkbox" id="mirror-enabled" ${mirror.enabled ? "checked" : ""} ${calendarBusy ? "disabled" : ""}><span>Add planned tasks to a calendar</span></label><p class="settings-hint">${mirror.targets.length ? `Each project has its own calendar, chosen in the project details. A task can use another calendar. Only events Calm Work created are changed; edits you make in the calendar are kept.${mirror.pending ? ` ${mirror.pending} waiting to sync.` : ""}${conflicts ? ` ${conflicts} changed in the calendar.` : ""}${failures ? ` ${failures} could not sync.` : ""}` : "Sign in to a calendar below. Each project then chooses its own."}</p></section>`;
    target.innerHTML = blocks +
      ["google", "microsoft"]
        .map((provider) => {
          const registration = calendarStatus.registrations?.[provider];
          const slots = provider === "google" ? ["google","google-2"] : ["microsoft"];
          return `<section class="settings-group"><h3>${provider === "google" ? "Google Calendar" : "Microsoft 365"}</h3>${slots.map(accountId=>{
            const account=calendarStatus.accounts.find(item=>(item.accountId||item.provider)===accountId);
            const label=provider==="google" ? (accountId==="google-2"?"Google account 2":"Google account 1") : "Microsoft 365";
            const title = account?.name || (String(account?.label || "").includes("@") ? account.label : label);
            const reason = signInReason(provider, registration, account);
            const state = account
              ? `${account.canWrite ? "Can add time blocks" : "Read-only"}${account.refreshedAt ? " · updated " + esc(new Date(account.refreshedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })) : ""}`
              : "Not signed in";
            const actions = account
              ? `<button class="quiet" data-calendar-command="refresh" data-provider="${provider}" data-account="${accountId}" ${calendarBusy?"disabled":""}>Refresh</button>${account.canWrite ? "" : `<button class="quiet" data-calendar-command="connect" data-provider="${provider}" data-account="${accountId}" aria-label="Sign in again to ${label}" ${calendarBusy||(!registration&&provider!=="google")?"disabled":""}>Sign in again</button>`}<button class="quiet" data-calendar-command="disconnect" data-provider="${provider}" data-account="${accountId}" ${calendarBusy?"disabled":""}>Disconnect</button>`
              : `<button class="quiet" data-calendar-command="connect" data-provider="${provider}" data-account="${accountId}" aria-label="Sign in to ${label}" ${reason ? `disabled aria-describedby="reason-${accountId}"` : ""}>Sign in</button>`;
            const nameForm = account ? `<form data-account-name="${esc(accountId)}" class="settings-inline-form"><label>Name <input name="name" value="${esc(account.name || "")}" placeholder="${esc(String(account.label || "").includes("@") ? account.label : title)}" maxlength="80" autocomplete="off"></label><button class="quiet" type="submit" ${calendarBusy ? "disabled" : ""}>Save name</button></form>` : "";
            return `<div class="calendar-account"><div class="calendar-account-text"><strong>${esc(title)}</strong><span>${state}</span>${reason && (!account || !account.canWrite) ? `<small class="settings-hint" id="reason-${accountId}">${esc(reason)}</small>` : ""}</div><div class="calendar-account-actions">${actions}</div></div>${nameForm}${account ? calendarChoices(accountId) : ""}`;
          }).join("")}${provider === "google" ? googleAdvanced(openSetup) : `<details data-setup="${provider}" ${openSetup.has(provider) ? "open" : ""}><summary>Calendar setup${registration?" · done":" · needed once"}</summary><p class="settings-hint">${provider === "google" ? "Paste the Desktop app client from your Google Cloud project. Both Google accounts share it." : "Paste the Application (client) ID from your Microsoft Entra app registration."} See the sign-in checklist in the project docs.</p><form data-calendar-connect="${provider}"><label>Client ID <input name="clientId" value="${esc(registration?.clientId||"")}" required autocomplete="off" spellcheck="false"></label>${provider === "google" ? '<label>Client secret <small>(Google issues one for desktop apps)</small><input name="clientSecret" type="password" autocomplete="off" placeholder="' + (registration ? "Saved · leave empty to keep" : "") + '"></label>' : `<label>Tenant <small>(your organisation)</small><input name="tenant" value="${esc(registration?.tenant || "contoso.onmicrosoft.com")}" autocomplete="off" spellcheck="false" placeholder="your-tenant.onmicrosoft.com"></label>`}<button class="quiet" ${calendarBusy?"disabled":""}>Save setup</button></form></details>`}</section>`;
        })
        .join("") +
      caldavSection() +
      (calendarBusy
        ? '<button class="quiet" data-calendar-command="cancel">Cancel sign-in</button>'
        : "");
    const service = document.getElementById("online-service-controls");
    if (service)
      service.innerHTML = optionalModulesOn()
        ? `<form id="online-service-form" class="settings-inline-form"><label>Service address<input name="origin" type="url" value="${esc(calendarStatus.serviceOrigin || "http://127.0.0.1:4242")}" required></label><button class="quiet">Open service</button></form>`
        : "";
    for (const field of fields) {
      const input = (field.provider ? target : document).querySelector(field.provider ? `[data-calendar-connect="${field.provider}"] input[name="${field.name}"]` : `#online-service-form input[name="${field.name}"]`);
      if (input && field.value && input.type !== "password") { input.value=field.value; if(field.focused){input.focus();if (field.selection[0] !== null) input.setSelectionRange(...field.selection);} }
    }
    const shared = document.getElementById("shared-workspace-controls");
    if (shared) shared.hidden = !optionalModulesOn();
    const toggle = document.getElementById("setting-optional-modules");
    if (toggle) toggle.checked = optionalModulesOn();
  }
  // ---- Time blocks written to calendars (main process owns the queue and safety checks)
  let mirrorTimer = null, mirrorIntent = "";
  function mirrorBlocks() {
    return tasks
      .filter((task) => task.title?.trim())
      .map((task) => {
        const span = typeof mirrorSpan === "function" ? mirrorSpan(task) : null;
        if (!span) return null;
        return {
          taskId: task.id,
          title: task.title.trim(),
          date: span.date,
          start: span.start,
          minutes: span.minutes,
          target: typeof taskCalendarTarget === "function" ? taskCalendarTarget(task) : task.calendar || "",
        };
      })
      .filter(Boolean);
  }
  function scheduleMirrorSync(force = false) {
    // Nothing is sent until an account with write access is signed in.
    if (reference || !calendarStatus.accounts.some((account) => account.canWrite)) return;
    const blocks = mirrorBlocks(), intent = JSON.stringify(blocks);
    if (!force && intent === mirrorIntent) return;
    clearTimeout(mirrorTimer);
    mirrorTimer = setTimeout(() => {
      mirrorIntent = intent;
      void calendarCommand({ action: "mirror-sync", blocks }).catch(() => {
        mirrorIntent = "";
      });
    }, 1500);
  }
  window.calmResolveMirror = async (taskId, choice) => {
    try {
      const result = await calendarCommand({ action: "mirror-resolve", taskId, choice });
      const adopted = result.adopted, task = getTask(taskId);
      if (adopted && task) {
        if (adopted.removed) task.calendar = "none";
        else Object.assign(task, { date: adopted.date, schedule: adopted.start, estimate: adopted.minutes, actual: null });
        task.today = task.date === calmToday();
      }
      if (!$("drawer").hidden && state.drawerTask === taskId) closeDrawer(false);
      renderScreen();
      notify(choice === "plan" ? "Calendar updated from your plan." : adopted?.removed ? "Kept it off the calendar." : "Plan updated from the calendar.");
    } catch (error) {
      notify(error.message);
    }
  };
  document.addEventListener("change", (event) => {
    if (event.target.dataset?.calendarColor) {
      const accountId = event.target.dataset.calendarColor;
      void calendarCommand({ action: "calendar-color", accountId, calendarId: event.target.dataset.calendarId, color: event.target.value })
        .then(() => notify("Calendar colour saved."))
        .catch((error) => { notify(error.message); renderCalendarAccounts(); });
      return;
    }
    if (event.target.dataset?.calendarSelect) {
      const accountId = event.target.dataset.calendarSelect, enabled = event.target.checked;
      void calendarCommand({ action: "calendar-select", accountId, calendarId: event.target.value, enabled })
        .then(() => notify(enabled ? "Calendar turned on." : "Calendar turned off. Its events are hidden."))
        .catch((error) => { notify(error.message); renderCalendarAccounts(); });
      return;
    }
    if (event.target.id === "mirror-enabled") {
      void runCalendar({ action: "mirror-settings", enabled: event.target.checked });
    } else if (event.target.classList?.contains("tz-zone")) {
      const zones = [...document.querySelectorAll("#timezone-section .tz-zone")].map((input) => input.value.trim()).slice(0, 3);
      // Draft values must be strings or booleans, so the list is stored as JSON text.
      drafts.$settings = { ...(drafts.$settings || {}), timeZones: JSON.stringify(zones) };
      state.extraTimeZones = zones;
      void commit(true);
    } else if (event.target.id === "setting-optional-modules") {
      drafts.$settings = { ...(drafts.$settings || {}), optionalModules: event.target.checked };
      applyModuleVisibility();
      renderCalendarAccounts();
      void commit(true);
      notify(event.target.checked ? "Booking, Polls and Team are in the sidebar." : "Booking, Polls and Team are hidden.");
    }
  });
  async function runCalendar(input) {
    calendarBusy = true;
    calendarNextAt = Date.now() + 300000;
    renderCalendarAccounts();
    try {
      await calendarCommand(input);
      notify(
        input.action === "open-service"
          ? "Optional service opened."
          : input.action === "configure" ? (input.provider === "google" ? (input.clientId ? "Signed in with your own Google client." : "Nothing to save: the built-in Google sign-in is used.") : "Calendar setup saved. Use Sign in to connect an account.")
          : input.action === "mirror-settings" ? "Time block settings saved."
          : input.action === "connect" && input.provider === "caldav" ? "CalDAV calendar connected."
          : input.action === "disconnect"
            ? "Calendar disconnected locally. Provider consent can be revoked in your account settings."
            : "Calendar updated.",
      );
    } catch (error) {
      notify(error.message);
    } finally {
      calendarBusy = false;
      renderCalendarAccounts();
    }
  }
  document.addEventListener("submit", (event) => {
    if (event.target.id === "online-service-form") {
      event.preventDefault();
      void runCalendar({
        action: "open-service",
        origin: new FormData(event.target).get("origin"),
      });
      return;
    }
    const named = event.target.closest("[data-account-name]");
    if (named) {
      event.preventDefault();
      void calendarCommand({ action: "account-name", accountId: named.dataset.accountName, name: new FormData(named).get("name") || "" })
        .then(() => notify("Account name saved."))
        .catch((error) => notify(error.message));
      return;
    }
    const form = event.target.closest("[data-calendar-connect]");
    if (!form) return;
    event.preventDefault();
    const fields = new FormData(form);
    if (form.dataset.calendarConnect === "caldav") {
      void runCalendar({
        action: "connect",
        provider: "caldav",
        accountId: "caldav",
        name: fields.get("name") || "",
        serverUrl: fields.get("serverUrl") || "",
        username: fields.get("username") || "",
        password: fields.get("password") || "",
      });
      return;
    }
    void runCalendar({
      action: "configure",
      provider: form.dataset.calendarConnect,
      ...(form.dataset.calendarConnect === "google" ? { accountId: fields.get("accountId") || "google" } : {}),
      clientId: fields.get("clientId"),
      clientSecret: fields.get("clientSecret") || "",
      ...(form.dataset.calendarConnect === "microsoft" ? { tenant: fields.get("tenant") || "" } : {}),
    });
  });
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-calendar-command]");
    if (button)
      void runCalendar({
        action: button.dataset.calendarCommand,
        provider: button.dataset.provider,
        accountId: button.dataset.account,
      });
  });
  const accountObserver = new MutationObserver(() => {
    if (
      document.getElementById("calendar-account-controls") &&
      !document.getElementById("calendar-account-controls").children.length
    )
      renderCalendarAccounts();
  });
  if (!reference)
    accountObserver.observe(document.getElementById("screen"), {
      childList: true,
      subtree: true,
    });
  applyModuleVisibility();
  if (!reference) void calendarCommand({ action: "status" }).then(() => scheduleMirrorSync(true)).catch(() => {});
  const sharedRequests = new Map();
  let sharedStatus = { connections: [] }, sharedBusy = false, sharedReady = [], sharedNextAt = Date.now() + 30000, sharedIntent = "", sharedCursor = 0;
  function scheduleSharedSync() {
    if (reference || !sharedStatus.connections.length) return;
    const value = JSON.stringify(tasks.filter(task => task.shared || window.calmSharedProjects?.includes(task.project)).map(task => [task.id,task.title,task.project,task.date,task.schedule,task.estimate,task.done,task.notes]));
    if (value !== sharedIntent) { sharedIntent = value; sharedNextAt = Math.min(sharedNextAt,Date.now()+1500); }
  }
  function teamCommand(input) {
    const requestId = crypto.randomUUID();
    return new Promise((resolve,reject) => {
      sharedRequests.set(requestId,{resolve,reject});
      parent.postMessage({channel:"calm-work-v1",command:"team",requestId,input},"*");
    });
  }
  function renderOnlineModule() {
    const team = ["team","members"].includes(state.view), booking = /^(bookings|booking-|public-booking)/.test(state.view), poll = /^(polls|poll-|public-poll)/.test(state.view);
    if (!team && !booking && !poll) return;
    const title = team ? "Shared workspaces" : booking ? "Booking pages" : "Group polls";
    $("screen").innerHTML = `<div class="workspace-settings"><section><h2>${title}</h2><p>${team ? "Connect shared tasks in Settings. Manage members, assignment and comments in your shared workspace." : booking ? "Create booking pages, manage availability and share guest links through your optional service." : "Propose times, share a voting link and choose the final time through your optional service."}</p><div class="actions"><button class="quiet" id="open-online-module">Open ${team ? "organizer tools" : title.toLowerCase()}</button><button class="quiet" data-show="modules">${team ? "Connect workspace" : "Service settings"}</button></div><p class="muted">${calendarStatus.serviceOrigin ? esc(calendarStatus.serviceOrigin) : "Set your service address in Settings first."}</p></section>${team ? sharedStatus.connections.map(connection=>`<section><h3>${esc(connection.name)}</h3><p>${esc(connection.role)}${connection.error ? " · "+esc(connection.error) : ""}</p><div class="actions"><button class="quiet" data-team-action="open" data-connection="${connection.id}">Open shared workspace</button><button class="quiet" data-team-action="sync" data-connection="${connection.id}">Sync tasks</button></div></section>`).join("") : ""}</div>`;
    $("open-online-module").onclick = () => {
      if (!calendarStatus.serviceOrigin) { show("modules"); return; }
      void runCalendar({action:"open-service",origin:calendarStatus.serviceOrigin});
    };
  }
  function teamSummary(task) {
    if (!task) return '<p>Task deleted</p>';
    return `<p>${esc(task.title)} · ${task.done ? "Completed" : "Open"}</p><p>${esc(task.plannedDate || (task.plannedFor ? new Date(task.plannedFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) : "Unplanned"))} · ${task.estimateMinutes || "No"} min estimate</p><details><summary>Notes</summary><p class="shared-conflict-notes">${esc(task.notes || "No notes")}</p></details>`;
  }
  function renderSharedSettings() {
    const target = $("shared-workspace-controls"); if (!target) return;
    const link = target.querySelector('[name="link"]'), draft = link?.value || "", focused = document.activeElement === link, selection = [link?.selectionStart,link?.selectionEnd];
    target.innerHTML = `<section><h3>Shared workspaces</h3><p>Connect an owner/editor workspace to use its tasks in Track, Plan and Projects. Personal time and reports stay private. Viewers use the separate shared view.</p><form id="connect-shared-workspace"><label>Private member link<input type="password" name="link" autocomplete="off" required></label><button class="quiet" ${sharedBusy ? "disabled" : ""}>Connect workspace</button></form></section>${sharedStatus.connections.map(connection=>`<section><h3>${esc(connection.name)}</h3><p>${esc(connection.role)} · ${connection.pendingCount || 0} pending${connection.error ? " · "+esc(connection.error) : ""}</p><div class="actions"><button class="quiet" data-team-action="sync" data-connection="${connection.id}" ${sharedBusy?"disabled":""}>Sync shared tasks</button><button class="quiet" data-team-action="open" data-connection="${connection.id}">Open shared view</button><button class="quiet" data-team-action="disconnect" data-connection="${connection.id}" ${sharedBusy?"disabled":""}>Disconnect, keep local copies</button></div>${connection.conflicts.map(conflict=>`<details class="shared-conflict"><summary>Resolve ${esc(conflict.local?.title || conflict.remote?.title || "shared task")}</summary><h4>My changes</h4>${teamSummary(conflict.local)}<h4>Shared version</h4>${teamSummary(conflict.remote)}<div class="actions">${conflict.remote?`<button class="quiet" data-team-resolve="remote" data-connection="${connection.id}" data-key="${esc(conflict.key)}">Use shared version</button><button class="quiet" data-team-resolve="local" data-connection="${connection.id}" data-key="${esc(conflict.key)}">${conflict.local?"Keep my changes":"Keep my deletion"}</button>`:""}<button class="quiet" data-team-resolve="private" data-connection="${connection.id}" data-key="${esc(conflict.key)}">Keep a private copy</button></div></details>`).join("")}</section>`).join("")}`;
    const input = target.querySelector('[name="link"]');
    if (input && draft) { input.value = draft; if (focused) { input.focus(); input.setSelectionRange(...selection); } }
  }
  async function runTeam(input,automatic=false) {
    if (sharedBusy && input.action !== "open") return;
    sharedBusy = true; renderSharedSettings();
    try {
      const result = await teamCommand(input);
      sharedStatus = result;
      if (["team","members"].includes(state.view)) renderOnlineModule();
      if (!automatic) notify(result.connections?.find(connection=>connection.id===input.connectionId)?.error || "Shared workspace updated. Pending/conflicting changes remain visible in Settings.");
    } catch(error) { if (!automatic) notify(error.message); }
    finally { sharedBusy = false; sharedNextAt = Date.now()+30000; renderSharedSettings(); }
  }
  async function applyReadyShared() {
    if (!sharedReady.length || sharedApplying || recoveryPending || !$("drawer").hidden || activeModal() || document.querySelector("dialog[open]") || document.activeElement?.matches("input,textarea,select") || calendarDrag) return;
    const message = sharedReady.shift();
    sharedApplying = true; $("app").inert = true;
    try {
      const active = getTask(state.active), connection = message.team.connections?.find(connection=>connection.id===active?.shared?.connectionId);
      if (active?.shared && connection && !connection.error) {
        const remote = connection.snapshot.projects.find(project=>project.id===active.shared.projectId)?.tasks.find(task=>task.id===active.shared.taskId);
        const key = active.shared.projectId + ":" + active.shared.taskId;
        if ((!remote || remote.done) && ["owner","editor"].includes(connection.role) && !connection.conflicts.some(conflict=>conflict.key===key) && !connection.preserveKeys?.includes(key)) finishTask();
      }
      await commit(true);
      applying = true;
      parent.postMessage({channel:"calm-work-v1",command:"team-apply",requestId:message.requestId},"*");
    } catch(error) {
      sharedApplying = false; applying = false; $("app").inert = false;
      sharedRequests.get(message.requestId)?.reject(error); sharedRequests.delete(message.requestId);
    }
  }
  window.addEventListener("message",event=>{
    if(event.source!==parent||event.data?.channel!=="calm-work-v1"||!event.data.team)return;
    const message=event.data,pending=sharedRequests.get(message.requestId);if(!pending)return;
    if(message.event==="team-ready") { sharedStatus=message.team;sharedReady.push(message);renderSharedSettings();void applyReadyShared();return; }
    if(message.event==="team-applied") {
      applying = false; sharedApplying = false; $("app").inert = false;
      if(message.document) hydrate(message.document);
      for(const action of deferredSharedTrayActions.splice(0)) window.dispatchEvent(new MessageEvent("message",{source:parent,data:{channel:"calm-work-v1",event:"tray-action",action}}));
    }
    sharedRequests.delete(message.requestId);
    if(message.team.error)pending.reject(new Error(message.team.error));else {sharedStatus=message.team;pending.resolve(message.team);}
    renderSharedSettings();
  });
  document.addEventListener("submit",event=>{
    if(event.target.id!=="connect-shared-workspace")return;
    event.preventDefault();const link=new FormData(event.target).get("link");event.target.reset();void runTeam({action:"connect",link});
  });
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-team-action],[data-team-resolve]");if(!button)return;
    void runTeam({action:button.dataset.teamResolve?"resolve":button.dataset.teamAction,connectionId:button.dataset.connection,key:button.dataset.key,choice:button.dataset.teamResolve});
  });
  const sharedObserver=new MutationObserver(()=>{
    const target=$("shared-workspace-controls");if(target&&!target.children.length)renderSharedSettings();
    const task=getTask(state.drawerTask);if(task?.shared&&$("detail-project")){ $("detail-project").disabled=true; if($("detail-project-search"))$("detail-project-search").disabled=true; }
  });
  if(!reference){sharedObserver.observe($("app"),{childList:true,subtree:true});void teamCommand({action:"status"}).then(value=>{sharedStatus=value;renderSharedSettings();if (["team","members"].includes(state.view)) renderOnlineModule();}).catch(()=>{});}
  // ---- Sync between devices (SuperSync). The host owns the account and the engine.
  let syncStatus = null, syncNotice = "", syncDraft = "", syncExportCode = "", syncPending = false, externalPending = false, externalSince = 0, lastSyncSignature = "";
  let browserStorage = "checking", storageDismissed = false;
  function renderStorageNotice() {
    let note = $("storage-notice");
    if (!note) {
      document.querySelector(".workspace-body")?.insertAdjacentHTML("beforebegin", '<aside id="storage-notice" class="storage-notice" role="status" hidden><p>Browser storage can be cleared. Connect Sync for another copy of your tasks.</p><button class="quiet" id="storage-open-sync">Sync</button><button class="icon-btn" id="storage-dismiss" aria-label="Dismiss storage notice">×</button></aside>');
      note = $("storage-notice");
      $("storage-open-sync").onclick = () => show("modules", { preserveSurface: true });
      $("storage-dismiss").onclick = () => { storageDismissed = true; renderStorageNotice(); };
    }
    if (note) note.hidden = storageDismissed || !["best-effort", "unavailable"].includes(browserStorage) || !!syncStatus?.configured;
  }
  function renderDeviceChecks() {
    const target = $("sync-controls");
    if (!target || $("device-checks")) return;
    target.insertAdjacentHTML("beforeend", '<details id="device-checks" class="device-checks"><summary>Device checks</summary><textarea id="device-checks-output" readonly aria-label="Device checks, no task or account data"></textarea></details>');
    $("device-checks").ontoggle = () => {
      if (!$("device-checks").open) return;
      const host = parent.document.querySelector("calm-shell"), viewport = parent.visualViewport;
      const nav = $("mobile-nav").getBoundingClientRect();
      const safe = host ? parent.getComputedStyle(host) : null;
      $("device-checks-output").value = JSON.stringify({
        release: parent.document.querySelector('meta[name="calm-release"]')?.content || "local build",
        standalone: !!parent.navigator.standalone || parent.matchMedia("(display-mode: standalone)").matches,
        storageProtection: browserStorage,
        viewport: viewport ? { width: viewport.width, height: viewport.height, top: viewport.offsetTop, scale: viewport.scale } : null,
        frame: { width: innerWidth, height: innerHeight },
        safeArea: safe ? { top: safe.paddingTop, bottom: safe.paddingBottom } : null,
        navigationBottom: nav.bottom,
        phoneMode: document.body.dataset.phoneFocus,
        userAgent: navigator.userAgent,
      }, null, 2);
    };
  }
  const syncRequests = new Map();
  function syncCommand(input) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { syncRequests.delete(requestId); reject(new Error("Sync did not answer. Try again.")); }, 90000);
      syncRequests.set(requestId, { resolve, reject, timer });
      parent.postMessage({ channel: "calm-work-v1", command: "sync", requestId, input }, "*");
    });
  }
  function syncSummary() {
    const status = syncStatus;
    if (!status || !status.configured) return { tone: "off", label: "Sync off", line: "This device is not connected." };
    if (!navigator.onLine) return { tone: "off", label: "Offline", line: "Offline. Keep working on this device; sync needs an internet connection." };
    if (!status.enabled) return { tone: "off", label: "Sync off", line: "Sync is switched off on this device." };
    const at = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
    if (status.state === "syncing" || syncPending) return { tone: "busy", label: "Syncing", line: "Syncing…" };
    if (status.state === "error") return { tone: "error", label: "Sync problem", line: status.error || "Sync did not finish. Tap Sync now to retry." };
    if (status.pending) return { tone: "busy", label: "Sending", line: "Changes are waiting to be sent." };
    return { tone: "ok", label: "Synced", line: at ? `Up to date · last sync ${at}` : "Up to date." };
  }
  function renderSyncChip() {
    const chip = $("sync-chip");
    if (!chip) return;
    const summary = syncSummary();
    renderStorageNotice();
    chip.dataset.tone = summary.tone;
    chip.setAttribute("aria-label", `Sync: ${summary.label}. Open sync settings`);
    chip.querySelector(".sync-chip-label").textContent = summary.label;
  }
  function renderSyncControls() {
    const target = $("sync-controls");
    if (!target) return;
    const summary = syncSummary(), connected = !!syncStatus?.configured;
    const html = connected
      ? `<p class="sync-line" data-tone="${summary.tone}" role="status">${esc(summary.line)}</p>${syncStatus.baseUrl ? `<p class="settings-hint">${esc(syncStatus.baseUrl.replace(/^https?:\/\//, ""))}</p>` : ""}${syncNotice ? `<p class="settings-hint" role="alert">${esc(syncNotice)}</p>` : ""}${syncExportCode ? `<label class="settings-field"><span>Setup code</span><textarea id="sync-code-out" rows="4" readonly>${esc(syncExportCode)}</textarea></label>` : ""}<div class="actions">${syncStatus.enabled ? `<button class="quiet" id="sync-now" ${syncPending ? "disabled" : ""}>Sync now</button><button class="quiet" id="sync-copy">Copy setup code</button><button class="quiet danger-text" id="sync-off">Turn sync off</button>` : `<button class="quiet" id="sync-reconnect">Turn sync on</button>`}</div>`
      : `<p>Keep this device and your other devices in step. Everything is encrypted before it leaves this device.</p>${syncNotice ? `<p class="settings-hint" role="alert">${esc(syncNotice)}</p>` : ""}<form id="sync-connect"><label class="settings-field"><span>Setup code</span><textarea name="code" rows="4" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="calmsync1.…" aria-describedby="sync-code-hint">${esc(syncDraft)}</textarea></label><button class="primary" ${syncPending ? "disabled" : ""}>${syncPending ? "Connecting…" : "Connect"}</button></form><p class="settings-hint" id="sync-code-hint">On your computer open Calm Work, Settings, Sync, then Copy setup code. Paste it here.</p>`;
    if (html !== lastSyncSignature || !target.children.length) {
      lastSyncSignature = html;
      target.innerHTML = html;
    }
    renderDeviceChecks();
  }
  function setSyncNotice(text) { syncNotice = text; renderSyncControls(); }
  if (!reference) {
    document.querySelector(".header-right")?.insertAdjacentHTML("afterbegin", '<button id="sync-chip" class="sync-chip" type="button" data-tone="off" aria-label="Sync"><span class="sync-dot" aria-hidden="true"></span><span class="sync-chip-label">Sync off</span></button>');
    $("sync-chip").onclick = () => show("modules", { preserveSurface: true });
    const phoneQuery = matchMedia("(max-width: 700px) and (pointer: coarse), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)");
    const applyPhoneFocus = () => {
      document.body.dataset.phoneFocus = String(phoneQuery.matches);
      $("add-title").placeholder = phoneQuery.matches ? "What needs doing?" : "A task title +project @16:00 t25m";
      applyTextScale();
      if (phoneQuery.matches && ready && !["track", "inbox", "modules", "plan", "projects", "project", "project-board", "reports"].includes(state.view)) show("track", { preserveSurface: true });
      if (typeof applyViewOrientation === "function") applyViewOrientation();
    };
    // iOS reports the Larger Text setting only through the system body font (17px at the default size).
    const textProbe = document.createElement("span");
    textProbe.setAttribute("aria-hidden", "true");
    textProbe.style.cssText = "font: -apple-system-body; position: absolute; visibility: hidden; pointer-events: none";
    textProbe.textContent = "A";
    document.body.append(textProbe);
    const applyTextScale = (size = parseFloat(getComputedStyle(textProbe).fontSize)) => {
      const scale = phoneQuery.matches && size > 17 ? Math.min(1.6, size / 17) : 1;
      document.documentElement.style.zoom = scale === 1 ? "" : String(scale);
      document.body.dataset.textScale = scale.toFixed(2);
    };
    window.calmApplyTextScale = applyTextScale;
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && applyTextScale());
    // The phone web app paints this copy at launch while the app itself starts (scripts/stage-pwa.cjs).
    const saveLaunchSnapshot = () => {
      if (!phoneQuery.matches || !ready || !window.frameElement) return;
      try {
        const body = document.body.cloneNode(true);
        body.querySelectorAll("script, .overlay, #toast, [role=dialog]").forEach((node) => node.remove());
        const rect = window.frameElement.getBoundingClientRect();
        parent.localStorage.setItem("calm-launch-snapshot", JSON.stringify({
          html: body.innerHTML,
          attrs: [...document.body.attributes].map((attr) => [attr.name, attr.value]),
          zoom: document.documentElement.style.zoom,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          viewport: [parent.innerWidth, parent.innerHeight],
        }));
      } catch {}
    };
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveLaunchSnapshot());
    window.addEventListener("pagehide", saveLaunchSnapshot);
    phoneQuery.addEventListener("change", applyPhoneFocus);
    for (const event of ["online", "offline"]) window.addEventListener(event, () => { renderSyncChip(); renderSyncControls(); });
    applyPhoneFocus();
    window.addEventListener("message", (event) => {
      if (event.source !== parent || event.data?.channel !== "calm-work-v1") return;
      if (event.data.event === "storage-status") { browserStorage = event.data.storage; renderStorageNotice(); return; }
      if (event.data.event === "sync-status") { syncStatus = event.data.sync; renderSyncChip(); renderSyncControls(); return; }
      if (event.data.event === "external-update") { externalPending = true; externalSince ||= Date.now(); return; }
      const pending = syncRequests.get(event.data.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      syncRequests.delete(event.data.requestId);
      if (event.data.sync) { syncStatus = event.data.sync; renderSyncChip(); }
      pending.resolve(event.data);
    });
    document.addEventListener("input", (event) => { if (event.target.closest?.("#sync-connect")) syncDraft = event.target.value; });
    document.addEventListener("submit", async (event) => {
      if (event.target.id !== "sync-connect") return;
      event.preventDefault();
      const code = String(new FormData(event.target).get("code") || "");
      syncPending = true; syncNotice = ""; renderSyncControls();
      try {
        const result = await syncCommand({ action: "connect", code });
        if (result.error) syncNotice = result.error; else syncDraft = "";
      } catch (error) { syncNotice = error.message; }
      syncPending = false; renderSyncControls(); renderSyncChip();
    });
    document.addEventListener("click", async (event) => {
      const button = event.target.closest("#sync-now,#sync-off,#sync-reconnect,#sync-copy");
      if (!button) return;
      if (button.id === "sync-copy") {
        try {
          if (!syncExportCode) {
            const result = await syncCommand({ action: "export-code" });
            if (result.error) throw new Error(result.error);
            if (!result.code) throw new Error("This device has no setup code to copy.");
            syncExportCode = result.code;
          }
          let copied = false;
          try {
            await navigator.clipboard.writeText(syncExportCode);
            copied = true;
          } catch {
            copied = false;
          }
          setSyncNotice(copied ? "Setup code copied. Paste it on your other device." : "The setup code is shown below. Select it and copy it onto your other device.");
          const box = $("sync-code-out");
          if (box && !copied) {
            box.focus();
            box.select();
          }
        } catch (error) { setSyncNotice(error.message); }
        return;
      }
      if (button.id === "sync-off") syncExportCode = "";
      syncPending = true; syncNotice = ""; renderSyncControls(); renderSyncChip();
      try {
        const result = await syncCommand({ action: button.id === "sync-now" ? "now" : button.id === "sync-off" ? "disconnect" : "now" });
        if (result.error) syncNotice = result.error;
      } catch (error) { syncNotice = error.message; }
      syncPending = false; renderSyncControls(); renderSyncChip();
    });
    new MutationObserver(() => { const target = $("sync-controls"); if (target && !target.children.length) renderSyncControls(); }).observe($("app"), { childList: true, subtree: true });
    void syncCommand({ action: "status" }).then(() => { renderSyncChip(); renderSyncControls(); }).catch(() => {});
    async function refreshFromHost() {
      externalPending = false; externalSince = 0;
      try {
        await commit(true);
        const value = await request("refresh");
        if (!applying) hydrate(value);
      } catch { externalPending = true; externalSince = Date.now(); }
    }
    setInterval(() => {
      if (!externalPending || !ready || applying || recoveryPending || sharedApplying || calendarDrag) return;
      if (!$("drawer").hidden || activeModal() || document.querySelector("dialog[open]") || document.activeElement?.matches?.("input,textarea,select")) return;
      void refreshFromHost();
    }, 1000);
  }
  window.CalmRuntime = {
    flush: () => commit(true),
    snapshot: documentSnapshot,
    seed: seedReference,
    exportWorkspace: downloadWorkspace,
    // One-time 15 minute estimate for old tasks with no estimate and no recorded time.
    // Default is a dry run that changes nothing. { apply: true } records what it changes first;
    // { undo: true } clears only the estimates it set. Back up the profile before applying.
    // scope "done" fills finished past tasks instead of open ones; calendar events are never changed.
    backfillEstimates: async ({ apply = false, undo = false, scope = "open" } = {}) => {
      if (apply || undo) await commit(true);
      const result = await request(undo ? "backfill-undo" : "backfill", undefined, undefined, { apply, scope });
      if ((apply || undo) && !result.alreadyApplied) {
        applying = true;
        try { const value = await request("refresh"); applying = false; hydrate(value); } finally { applying = false; }
      }
      return result;
    },
    restore: async archive => { if (!recoveryPending) await commit(true); applying = true; try { const value = await request("restore", archive); applying = false; hydrate(value); return value; } finally { applying = false; } },
    ready: () => ready,
    lastExport: () => exported,
    team: teamCommand,
    calendar: calendarCommand,
    teamStatus: () => sharedStatus,
  };
  if (reference) {
    ready = true;
    lastSignature = signature(documentSnapshot());
    renderScreen();
    return;
  }
  const note = document.querySelector(".review-toolbar small");
  if (note)
    note.textContent = "Local development · online integrations not connected";
  const sample = document.createElement("button");
  sample.className = "quiet";
  sample.textContent = "Load sample workspace";
  sample.onclick = () =>
    seedReference().catch(() => notify("Sample workspace could not be saved."));
  document.querySelector(".review-toolbar").append(sample);
  document.body.style.visibility = "hidden";
  request("load")
    .then((value) => {
      ready = true;
      hydrate(value);
      delete document.documentElement.dataset.calmLoading;
      document.body.style.visibility = "";
      document.documentElement.dataset.calmReady = "true";
    })
    .catch(() => {
      ready = false;
      document.body.innerHTML = '<main role="alert" style="padding:32px;color:#e8e4df;background:#171614;min-height:100vh"><p>Local workspace could not be loaded.</p><button id="retry-workspace">Try again</button></main>';
      $("retry-workspace").onclick = () => location.reload();
      delete document.documentElement.dataset.calmLoading;
      document.body.style.visibility = "";
    });
  let lastTraySignature = "";
  function publishTray() {
    if (!ready || reference) return;
    const active = getTask(state.active);
    const agenda = [
      ...tasks
        .filter((t) => !t.done && t.date === calmToday())
        .map((t) => ({
          id: t.id,
          title: t.title,
          time: t.schedule || "",
          kind: "task",
        })),
      ...allEvents()
        .filter((e) => e.date === calmToday())
        .map((e) => ({
          id: e.id,
          title: e.title,
          time: e.start,
          kind: "event",
        })),
    ].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
    const value = {
      active: active
        ? {
            id: active.id,
            title: active.title,
            running: state.running,
            minutes: Math.floor(state.seconds / 60),
          }
        : null,
      agenda,
    };
    const signature = JSON.stringify(value);
    if (signature !== lastTraySignature) {
      lastTraySignature = signature;
      parent.postMessage(
        { channel: "calm-work-v1", event: "tray-state", state: value },
        "*",
      );
    }
  }
  let lastDay = calmToday();
  setInterval(() => {
    if (!ready || reference) return;
    syncClock();
    if (calendarRenderPending && calendarCanRender()) { calendarRenderPending = false; repaintPlan(); }
    void refreshCalendarsAutomatically();
    void applyReadyShared();
    if (!recoveryPending && !sharedBusy && !sharedApplying && sharedStatus.connections.length && Date.now() >= sharedNextAt) {
      const connection=sharedStatus.connections[sharedCursor++ % sharedStatus.connections.length];
      sharedNextAt=Date.now()+30000;void runTeam({action:"sync",connectionId:connection.id},true);
    }
    publishTray();
    updateCalendarNow();
    for (const id of ["header-clock", "active-timer"]) {
      const element = $(id),
        value = clockText();
      if (element && element.textContent !== value) element.textContent = value;
    }
    const upcoming = $("next-commitment");
    if (upcoming) {
      const value = upcomingCommitment();
      if (upcoming.innerHTML !== value) upcoming.innerHTML = value;
    }
    const day = calmToday();
    if (day !== lastDay) {
      lastDay = day;
      window.calmWeekOffset = 0;
      state.calendarSlot.day = calmTodayIndex();
      state.calendarAnchor = calmTodayIndex();
      state.calendarPan = 0;
      renderScreen();
    }
  }, 250);
  function clockText() {
    return window.clock(state.seconds);
  }
  setInterval(() => {
    if (clock?.running) {
      accrue();
      void commit(true).catch(() => {});
    }
  }, 10000);
})();
