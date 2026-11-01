const reviewInventory = [
  {
    key: "track",
    title: "Track",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "inbox",
    title: "Clean",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "new-task",
    title: "Add task",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "task",
    title: "Task detail",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "today",
    title: "Today tasks",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "plan",
    title: "Plan / calendar",
    source: "Morgen",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "block",
    title: "Time block detail",
    source: "Morgen",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "history",
    title: "Actual time / history",
    source: "Super Productivity + original session view",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "session",
    title: "Edit tracked session",
    source: "Super Productivity + original session view",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "projects",
    title: "Projects",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "project",
    title: "Project detail",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "reports",
    title: "Reports / export",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "export",
    title: "Export report",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "bookings",
    title: "Booking types",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "booking-edit",
    title: "Booking editor / availability",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "public-booking",
    title: "Public booking page",
    source: "Cal.com",
    surface: "public",
    group: "Scheduling",
  },
  {
    key: "booking-attendee",
    title: "Booking attendee details",
    source: "Cal.com",
    surface: "public",
    group: "Scheduling",
  },
  {
    key: "booking-confirmed",
    title: "Booking confirmation",
    source: "Cal.com",
    surface: "public",
    group: "Scheduling",
  },
  {
    key: "booking-manage",
    title: "Booking management / cancellation",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "polls",
    title: "Group polls",
    source: "Rallly",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "poll-edit",
    title: "Poll editor",
    source: "Rallly",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "public-poll",
    title: "Public poll / participant vote",
    source: "Rallly",
    surface: "public",
    group: "Scheduling",
  },
  {
    key: "poll-results",
    title: "Poll results / finalize",
    source: "Rallly",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "team",
    title: "Shared project / collaboration",
    source: "Super Productivity + original team view",
    surface: "desktop",
    group: "Team",
  },
  {
    key: "members",
    title: "Team members / roles",
    source: "Original team view",
    surface: "desktop",
    group: "Team",
  },
  {
    key: "modules",
    title: "Settings / feature modules",
    source: "Original modular settings",
    surface: "desktop",
    group: "Settings",
  },
  {
    key: "calendars",
    title: "Calendar connections / permissions",
    source: "Google + Microsoft OAuth",
    surface: "desktop",
    group: "Settings",
  },
  {
    key: "sync",
    title: "Sync / backup / recovery",
    source: "Super Productivity",
    surface: "desktop",
    group: "Settings",
  },
  {
    key: "ai",
    title: "AI control / local access",
    source: "Super Productivity local API",
    surface: "desktop",
    group: "Settings",
  },
  {
    key: "tray",
    title: "Menu bar panel",
    source: "Super Productivity tracking + original compact view",
    surface: "tray",
    group: "Platforms",
  },
  {
    key: "mobile",
    title: "Mobile tasks / tracking",
    source: "Super Productivity",
    surface: "mobile",
    group: "Platforms",
  },
  {
    key: "mobile-task",
    title: "Mobile task detail",
    source: "Super Productivity",
    surface: "mobile",
    group: "Platforms",
  },
  {
    key: "booking-availability",
    title: "Booking availability",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "booking-rules",
    title: "Booking rules / calendars",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "booking-questions",
    title: "Booking questions",
    source: "Cal.com",
    surface: "desktop",
    group: "Scheduling",
  },
  {
    key: "task-options",
    title: "Task repeat / reminders / files",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "project-board",
    title: "Project board",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "project-notes",
    title: "Project notes",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "project-settings",
    title: "Project settings",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "restore",
    title: "Restore backup",
    source: "Super Productivity",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "poll-finalized",
    title: "Poll finalized",
    source: "Rallly",
    surface: "desktop",
    group: "Scheduling",
  },
];
const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  back: "M19 12H5M11 6l-6 6 6 6",
  sun: "M12 5v-3M12 22v-3M5 12H2M22 12h-3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10Z",
  edit: "M4 16L16 4l4 4L8 20H4ZM14 6l4 4",
  plus: "M12 4v16M4 12h16",
  close: "M5 5l14 14M19 5L5 19",
  play: "M8 5l11 7-11 7Z",
  pause: "M8 5v14M16 5v14",
  details: "M4 4h16v16H4ZM14 4v16M7 9h4M7 13h4",
  sidebar: "M3 4h18v16H3ZM9 4v16",
  calendar: "M4 5h16v16H4ZM7 2v6M17 2v6M4 10h16",
  clock: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18ZM12 7v5l3 2",
  repeat: "M5 7h12l-3-3M19 17H7l3 3M19 7v5M5 17v-5",
  folder: "M3 6h7l2 3h9v11H3Z",
  keyboard: "M3 6h18v12H3ZM7 10h1M11 10h1M15 10h1M7 14h10",
  check: "M5 12l4 4 10-10",
  chevron: "M8 10l4 4 4-4",
  search: "M10 3a7 7 0 1 0 0 14a7 7 0 1 0 0-14ZM16 16l5 5",
  inbox: "M4 4h16v16H4ZM4 13h5l2 3h2l2-3h5",
  list: "M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1",
  chart: "M4 20V9M10 20V4M16 20v-9M22 20V7",
  people:
    "M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8ZM2 21v-3a7 7 0 0 1 14 0v3M18 4a4 4 0 0 1 0 7M19 14a6 6 0 0 1 3 7",
  settings:
    "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
};
const svg = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name] || icons.list}"/></svg>`;
function paintIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = svg(el.dataset.icon)));
}
const state = {
  view: "track",
  surface: "desktop",
  active: "draft",
  seconds: 1694,
  sessionStartMinute: 564,
  nowMinute: 592 + 14 / 60,
  sessionEstimate: 45,
  running: true,
  selected: null,
  pickerQuery: "",
  filter: "",
  drawerTask: null,
  inline: null,
  calendarMode: "week",
  calendarAnchor: calmTodayIndex(),
  calendarSpan: 28,
  calendarPan: 0,
  calendarSlot: { day: calmTodayIndex(), minute: 660 },
  slotVisible: false,
  showPlanTasks: true,
  localEvents: [],
  eventMeta: {},
  projectCalendars: {},
  planSelectedTask: null,
  projectName: "",
  addTitle: "",
  addDraftActive: false,
  projectRenames: {},
  deletedTaskIds: [],
  deletedProjects: [],
  reportMode: "summary",
  reportGroup: "project",
  reportProject: "all",
  reportProjects: null,
  reportFrom: "",
  reportTo: calmToday(),
  extraTimeZones: [],
  reportTask: "all",
  reportEdit: null,
  completion: "",
  planListKind: "tasks",
  projectFilter: "All projects",
  lastFocus: null,
  addField: null,
  add: { project: "", schedule: "", estimate: "", repeat: "" },
  sessions: [
    {
      id: "notes",
      title: "Read customer notes",
      project: "Product launch",
      start: "09:00",
      end: "09:18",
      duration: 18,
    },
  ],
};
try {
  const savedZones = JSON.parse(localStorage.getItem("calm-time-zones") || "null");
  if (Array.isArray(savedZones))
    state.extraTimeZones = savedZones.slice(0, 3).map((zone) => String(zone || ""));
} catch {}
// Same phone test as the runtime's phone focus, so tablets keep the full layout.
const phoneMedia = matchMedia(
  "(max-width: 700px) and (pointer: coarse), (max-width: 1000px) and (max-height: 500px) and (pointer: coarse)",
);
// Temporarily keep planning on desktop/Android while iOS uses Apple Calendar.
const iosPlanHidden = Boolean(window.calmRuntimeMode) &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
if (iosPlanHidden) {
  document.documentElement.dataset.iosPlanHidden = "true";
  const style = document.createElement("style");
  style.textContent = 'html[data-ios-plan-hidden="true"] [data-show="plan"] { display: none !important; }';
  document.head.append(style);
}
function isPhoneUi() {
  return (
    state.surface === "mobile" ||
    document.body?.dataset.phoneFocus === "true" ||
    phoneMedia.matches
  );
}
const tasks = [
  {
    id: "draft",
    title: "Draft product update",
    project: "Product launch",
    estimate: 45,
    schedule: "09:30",
    date: calmToday(),

    today: true,
    done: false,
  },
  {
    id: "supplier",
    title: "Review supplier brief",
    project: "Product launch",
    estimate: 30,
    schedule: "11:00",
    date: calmToday(),

    today: true,
    done: false,
  },
  {
    id: "reply",
    title: "Reply to Alex",
    project: "Personal",
    estimate: 15,
    schedule: "14:00",
    date: calmToday(),

    today: true,
    done: false,
  },
  {
    id: "sample",
    title: "Confirm sample finish",
    project: "Product launch",
    estimate: null,
    schedule: "",
    date: calmToday(),

    today: true,
    done: false,
  },
  {
    id: "packaging",
    title: "Check packaging dimensions",
    project: "",
    estimate: null,
    schedule: "",
    date: "",

    today: false,
    done: false,
  },
  {
    id: "feedback",
    title: "Read product feedback",
    project: "",
    estimate: 20,
    schedule: "",
    date: calmDateAfter(2),

    today: false,
    done: false,
  },
  {
    id: "dentist",
    title: "Book dentist appointment",
    project: "",
    estimate: null,
    schedule: "",
    date: "",

    today: false,
    done: false,
  },
  {
    id: "launch",
    title: "Prepare launch checklist",
    project: "Product launch",
    estimate: 40,
    schedule: "",
    date: calmDateAfter(2),

    today: false,
    done: false,
  },
  {
    id: "notes",
    title: "Read customer notes",
    project: "Product launch",
    estimate: 20,
    schedule: "09:00",
    date: calmToday(),

    today: true,
    done: true,
  },
  {
    id: "website",
    title: "Review mobile layout",
    project: "Website refresh",
    estimate: 30,
    schedule: "",
    date: calmTomorrow(),

    today: false,
    done: false,
  },
  {
    id: "copy",
    title: "Update homepage copy",
    project: "Website refresh",
    estimate: 60,
    schedule: "",
    date: calmDateAfter(2),

    today: false,
    done: false,
  },
  {
    id: "handoff",
    title: "Prepare handoff",
    project: "Website refresh",
    estimate: 30,
    schedule: "",
    date: calmMonday(),

    today: false,
    done: false,
  },
];
const getTask = (id) => tasks.find((t) => t.id === id);
const projects = ["Product launch", "Personal", "Website refresh"];
const navigation = [
  ["track", "play", "Track"],
  ["plan", "calendar", "Plan"],
  ["inbox", "inbox", "Clean"],
  ["projects", "folder", "Projects"],
  ["bookings", "calendar", "Booking"],
  ["polls", "list", "Polls"],
  ["reports", "chart", "Reports"],
  ["team", "people", "Team"],
];
$("navigation").innerHTML = navigation
  .map(
    ([key, icon, label]) =>
      `<button class="nav-item" data-show="${key}" aria-label="${label}" title="${label}">${svg(icon)}<span class="nav-label">${label}</span></button>`,
  )
  .join("");

reviewInventory.push(
  {
    key: "public-booking-manage",
    title: "Guest booking management",
    source: "Cal.com",
    surface: "public",
    group: "Scheduling",
  },
  {
    key: "public-poll-saved",
    title: "Participant response confirmation",
    source: "Rallly",
    surface: "public",
    group: "Scheduling",
  },
);
staticViews["public-booking-manage"] = staticViews["booking-manage"];
staticViews["booking-confirmed"] = staticViews["booking-confirmed"].replaceAll(
  'data-open="booking-manage"',
  'data-open="public-booking-manage"',
);
staticViews["public-poll"] = staticViews["public-poll"].replaceAll(
  'data-open="poll-results"',
  'data-open="public-poll-saved"',
);
staticViews["public-poll-saved"] =
  `<div class="review-head"><div><h2>Response saved</h2><p>Team planning · Taylor</p></div></div><div class="table-scroll"><table><thead><tr><th>Option</th><th>Your availability</th></tr></thead><tbody><tr><td>Thu 15 · 10:00</td><td>Yes</td></tr><tr><td>Thu 15 · 14:00</td><td>If needed</td></tr><tr><td>Fri 16 · 11:00</td><td>Yes</td></tr></tbody></table></div><div class="actions"><button class="quiet" data-open="public-poll">Edit my response</button></div>`;
staticViews["bookings"] = staticViews["bookings"].replace(
  "Thu 15 Oct · 10:00",
  "Thu 15 Oct · 16:00 Hong Kong",
);
reviewInventory.splice(
  0,
  reviewInventory.length,
  ...reviewInventory.filter((v) => !["block", "members"].includes(v.key)),
);
reviewInventory.push(
  {
    key: "calendar-new-task",
    title: "Calendar · new task",
    source: "Morgen",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "calendar-new-event",
    title: "Calendar · new event",
    source: "Morgen",
    surface: "desktop",
    group: "Personal",
  },
  {
    key: "calendar-event",
    title: "Calendar · event details",
    source: "Morgen",
    surface: "desktop",
    group: "Personal",
  },
);
const reviewItems = reviewInventory.map((v) => ({
  ...v,
  title:
    {
      "new-task": "Global add bar",
      task: "Task details",
      "task-options": "Task details · notes",
      "mobile-task": "Mobile task sidebar",
      export: "Report export sidebar",
      block: "Calendar task details",
      session: "Reports · edit time entry",
    }[v.key] ||
    {
      today: "Track · Today queue",
      history: "Reports · time entries",
      team: "Team · on hold",
    }[v.key] ||
    v.title,
}));
for (const group of [...new Set(reviewItems.map((v) => v.group))]) {
  const opt = document.createElement("optgroup");
  opt.label = group;
  reviewItems
    .filter((v) => v.group === group)
    .forEach((v) => {
      const o = document.createElement("option");
      o.value = v.key;
      o.textContent = v.title;
      opt.append(o);
    });
  $("review-picker").append(opt);
}
const head = (title, sub = "", actions = "") =>
  `<div class="content-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div>${actions}</div>`;
const btn = (text, action, primary = false) =>
  `<button class="${primary ? "primary" : "quiet"}" ${action}>${text}</button>`;
function row(task, { inbox = false, compact = false } = {}) {
  const planning = state.view === "plan",
    tracking = state.view === "track";
  const needsPlan =
    ["project", "project-board"].includes(state.view) &&
    (!task.project ||
      !task.date ||
      (state.view === "project-board" && !task.schedule)) &&
    !task.done;
  const meta = [
    ["project", "project-board"].includes(state.view) ? "" : task.project,
    task.estimate
      ? state.surface === "mobile"
        ? task.estimate + "m"
        : task.estimate + " min estimate"
      : "",
  ].filter(Boolean);
  const inline = inbox
    ? `<div class="inline-fields"><button class="${!task.project ? "missing" : ""}" data-inline="project" data-task="${task.id}">${esc(task.project || "Project")}</button><button class="${!task.date ? "missing" : ""}" data-inline="date" data-task="${task.id}">${task.date ? shortDay(task.date) : "Schedule"}</button><button class="${!task.estimate ? "missing" : ""}" data-inline="estimate" data-task="${task.id}">${task.estimate ? task.estimate + " min" : "Estimate"}</button></div>`
    : "";
  const check = planning
    ? ""
    : `<button class="task-check ${task.done ? "checked" : ""}" data-complete="${task.id}" aria-label="${task.done ? "Reopen" : "Complete"} ${esc(task.title)}">${task.done ? svg("check") : ""}</button>`;
  const move =
    tracking && task.date !== calmToday() && !task.done
      ? `<button class="icon-btn" data-today="${task.id}" aria-label="Move ${esc(task.title)} to Today" title="Move to Today">${svg("sun")}</button>`
      : "";
  const actions = planning
    ? ""
    : `<div class="task-actions">${tracking && !task.done ? `<button class="icon-btn play-action" data-start="${task.id}" aria-label="Track ${esc(task.title)}" title="Start tracking (Enter)">${svg("play")}</button>` : ""}${move}<button class="icon-btn ${needsPlan ? "needs-plan" : ""}" data-detail="${task.id}" aria-label="Details for ${esc(task.title)}" title="Details (I)">${svg("details")}</button></div>`;
  const taskRow = `<div class="task-row ${inbox ? "inbox-row" : ""} ${task.done ? "done" : ""} ${state.selected === task.id ? "selected" : ""}" tabindex="0" data-row="${task.id}" draggable="${state.view === "track" && isPhoneUi() ? "false" : !task.done || state.view === "project-board"}" aria-label="${esc(task.title)}">${check}<div class="task-copy"><div class="task-name">${esc(task.title)}</div>${!inbox && !compact && meta.length ? `<div class="task-meta">${meta.map(esc).join("<span>·</span>")}</div>` : ""}</div>${!inbox && !compact && task.schedule ? `<time class="task-time">${task.schedule}</time>` : ""}${planning && task.estimate ? `<small>${task.estimate}m</small>` : ""}${inline}${actions}</div>`;
  const host = tracking && !inbox
    ? `<div class="swipe-host" data-swipe="${task.id}" data-can-track="${task.done ? "0" : "1"}" data-can-today="${!task.done && task.date !== calmToday() ? "1" : "0"}"><div class="swipe-bg swipe-today" aria-hidden="true">Today</div><div class="swipe-bg swipe-track" aria-hidden="true">Track</div>${taskRow}</div>`
    : taskRow;
  return host + (state.inline?.id === task.id ? inlineEditor(task) : "");
}
function inlineEditor(task) {
  let field = state.inline.field;
  let input =
    field === "project"
      ? projectField("inline-value", task.project)
      : field === "date"
        ? `<input id="inline-value" aria-label="Scheduled date" type="date" value="${task.date}">`
        : `<input id="inline-value" aria-label="Estimate minutes" inputmode="decimal" type="number" min="0.001" max="100000" step="any" value="${task.estimate || ""}" placeholder="Minutes">`;
  const presets =
    field === "date"
      ? [
          ["Today", calmToday()],
          ["Tomorrow", calmTomorrow()],
          ["Clear", ""],
        ]
      : field === "estimate"
        ? [
            ["15 min", "15"],
            ["30 min", "30"],
            ["60 min", "60"],
          ]
        : [];
  return `<div class="inline-editor"><label>${field === "date" ? "Schedule" : field === "estimate" ? "Estimate" : "Project"} ${input}</label>${btn("Apply", 'id="apply-inline"')}${btn("Cancel", 'id="cancel-inline"')}${presets.length ? `<div class="inline-presets">${presets.map(([label, value]) => btn(label, `data-inline-preset="${value}"`)).join("")}</div>` : ""}</div>`;
}
function liveToday() {
  return tasks
    .filter((t) => t.date === calmToday() && !t.done)
    .sort(
      (a, b) =>
        (a.schedule ? minutes(a.schedule) : Infinity) -
        (b.schedule ? minutes(b.schedule) : Infinity),
    );
}
function matches(task, query) {
  return (task.title + " " + task.project)
    .toLowerCase()
    .includes(query.replace(/^\//, "").trim().toLowerCase());
}
function taskRows(list, options = {}) {
  return list.length
    ? list.map((t) => row(t, options)).join("")
    : '<p class="empty">Nothing here.</p>';
}
function listFilter(label, id, value, count = "") {
  return `<div class="list-heading"><input class="list-filter" id="${id}" aria-label="${esc(label)}" placeholder="${esc(label)}" value="${esc(value)}" autocomplete="off" spellcheck="false">${count !== "" ? `<small class="list-count" aria-live="polite">${count}</small>` : ""}</div>`;
}
function trackView() {
  const task = getTask(state.active);
  return `<section class="focus-work">${task ? `<div class="active-work"><p class="focus-label">${state.running ? "Now working on" : "Paused"}</p><h2>${esc(task.title)}</h2><div class="focus-meta">${[task.project, task.estimate ? task.estimate + " min estimate" : ""].filter(Boolean).map(esc).join("<span>·</span>")}</div><div class="timer-row"><div class="timer" id="active-timer">${clock(state.seconds)}</div>${btn(state.running ? "Pause" : "Resume", 'id="pause-timer"', true)}${btn("Finish", 'id="finish-task"')}<button class="icon-btn" data-detail="${task.id}" aria-label="Details for ${esc(task.title)}">${svg("details")}</button></div></div>` : ""}<div id="next-commitment">${upcomingCommitment()}</div><div class="next-task-wrap">${pickerView()}</div></section>`;
}
function bySchedule(a, b) {
  return (a.date || "").localeCompare(b.date || "") || minutes(a.schedule || "00:00") - minutes(b.schedule || "00:00");
}
function pickerView() {
  const query = state.pickerQuery;
  const past = tasks.filter((task) => task.date && task.date < calmToday() && !task.done).sort(bySchedule);
  const list = liveToday().filter((task) => matches(task, query));
  const later = tasks.filter((task) => task.date && task.date > calmToday() && !task.done).sort(bySchedule);
  const completed = tasks.filter((task) => task.date === calmToday() && task.done);
  return `<div class="task-picker">${past.length ? `<details class="collapsed-section past-tasks" open><summary>Past <small>${past.length}</small></summary>${taskRows(past.filter((task) => matches(task, query)))}</details>` : ""}${listFilter("Today’s tasks", "picker-search", query, liveToday().length + " remaining")}<div class="today-queue">${taskRows(list)}</div>${later.length ? `<details class="collapsed-section later-tasks"><summary>Later</summary>${taskRows(later.filter((task) => matches(task, query)))}</details>` : ""}${completed.length ? `<details class="collapsed-section done-today"><summary>Completed today</summary>${taskRows(completed.filter((task) => matches(task, query)))}</details>` : ""}</div>`;
}
function inboxView() {
  const unassigned = tasks.filter((t) => !t.project && !t.done);
  const list = unassigned.filter((t) => matches(t, state.filter));
  const events = unassignedEvents().filter((event) => matchesEvent(event, state.filter));
  return (
    listFilter(
      "To organize",
      "task-filter",
      state.filter,
      unassigned.length + unassignedEvents().length,
    ) +
    (list.length ? taskRows(list, { inbox: true }) : "") +
    (events.length ? `<p class="group-title">Events</p>${events.map(eventRow).join("")}` : "") +
    (list.length || events.length ? "" : '<p class="empty">Nothing here.</p>')
  );
}
function projectToolbar(board = false) {
  return `<div class="project-toolbar"><button class="quiet project-back" data-show="projects" aria-label="Back to projects">Projects</button><div class="segmented"><button class="${!board ? "active" : ""}" data-show="project">List</button><button class="${board ? "active" : ""}" data-show="project-board">Board</button></div><button class="icon-btn" data-show="project-settings" aria-label="Project details" title="Project details">${svg("details")}</button></div>`;
}
function projectView() {
  const all = tasks.filter((t) => t.project === calmSelectedProject());
  const list = all.filter((t) => !t.done && matches(t, state.filter));
  const completed = all.filter((t) => t.done);
  return (
    projectToolbar() +
    listFilter(
      "Project tasks",
      "task-filter",
      state.filter,
      all.filter((t) => !t.done).length + " open",
    ) +
    taskRows(list) +
    (completed.length
      ? `<details class="collapsed-section"><summary>Completed <small>${completed.length}</small></summary>${taskRows(completed.filter((t) => matches(t, state.filter)))}</details>`
      : "")
  );
}
function boardView() {
  return (
    projectToolbar(true) +
    listFilter("Project tasks", "task-filter", state.filter) +
    `<div class="board">${[
      ["Unplanned", "unplanned"],
      ["Planned", "planned"],
      ["Completed", "done"],
    ]
      .map(
        ([label, key]) =>
          `<section class="board-column" data-board-target="${key}"><h3>${label}</h3>${taskRows(
            tasks.filter(
              (t) =>
                t.project === calmSelectedProject() &&
                matches(t, state.filter) &&
                (key === "done"
                  ? t.done
                  : key === "planned"
                    ? !t.done && t.date
                    : !t.done && !t.date),
            ),
            { compact: true },
          )}</section>`,
      )
      .join("")}</div>`
  );
}
function timezoneSettings() {
  const zones = state.extraTimeZones || [];
  const known = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC", "Europe/Rome", "America/New_York", "Asia/Hong_Kong"];
  return `<section id="timezone-section"><h2>Other time zones</h2><p class="settings-hint">Hover a time on Plan to compare up to three other zones.</p><div class="tz-fields">${[0, 1, 2].map((index) => `<label>Time zone ${index + 1}<input class="tz-zone" id="tz-zone-${index}" list="timezone-options" value="${esc(zones[index] || "")}" placeholder="Area/City" autocomplete="off" spellcheck="false"></label>`).join("")}</div><datalist id="timezone-options">${known.map((zone) => `<option value="${esc(zone)}"></option>`).join("")}</datalist></section>`;
}
function workspaceView() {
  const runtime = window.calmRuntimeMode && !window.calmReference;
  return `<div class="workspace-settings">${runtime ? '<section id="sync-section"><h2>Sync</h2><div id="sync-controls"></div></section>' : ""}<section id="calendar-section"><h2>Calendars</h2><p id="calendar-connections">Calendar connections are available in the desktop app.</p><div id="calendar-account-controls"></div><p class="settings-hint phone-settings-note">Other settings come from your computer. Sign in here only if this phone needs its own calendar connection.</p></section><section><h2>Workspace</h2><p>Tasks, projects, tracking, planning and reports are stored on this device. Closing the window keeps tracking active; Quit saves and pauses it.</p><div class="actions"><button class="quiet" id="workspace-backup" ${runtime ? "" : 'disabled title="Available in the desktop app"'}>Export workspace</button><button class="quiet" id="workspace-restore" ${runtime ? "" : "disabled"}>Restore workspace</button><button class="quiet" data-show="reports">Time reports</button><button class="quiet" id="settings-shortcuts">Keyboard shortcuts</button></div><p class="settings-hint">Export includes tasks, projects, recorded time, local events and drafts. Restore works into an empty profile.</p></section><section><h2>Optional modules</h2><label class="settings-toggle"><input type="checkbox" id="setting-optional-modules" ${runtime ? "" : "disabled"}><span>Show Booking, Polls and Team</span></label><p class="settings-hint">These use a separate online service and are off by default.</p><div id="online-service-controls"></div><div id="shared-workspace-controls"></div></section>${timezoneSettings()}</div>`;
}
function teamView() {
  return (
    head("Shared projects", "On hold for a separate design review") +
    `<div class="hold-note"><h3>One shared workspace, when it is needed.</h3><p>Collaboration layouts will be explored separately.</p></div>`
  );
}
function calendarDays() {
  return state.calendarMode === "day"
    ? [state.calendarSlot.day]
    : Array.from(
        { length: state.calendarSpan },
        (_, i) => state.calendarAnchor + i,
      );
}
function nightBlocks() {
  return calendarDays().flatMap((day) => dayBlocks(day).filter((block) => block.start < nightEndMinute() && block.end > 0));
}
function sleepToggleButton() {
  const count = nightBlocks().length;
  const shown = !!state.showSleepHours;
  const name = shown ? "Hide 00–08" : "Show 00–08";
  const label = count
    ? `${name}. ${count} ${count === 1 ? "item is" : "items are"} between 00:00 and 08:00.`
    : `${shown ? "Hide" : "Show"} 00:00 to 08:00`;
  return `<button class="quiet${count ? " has-night" : ""}" id="toggle-sleep" aria-pressed="${shown}" aria-label="${esc(label)}">${name}${count ? `<span class="sleep-alert">${count}</span>` : ""}</button>`;
}
function calendarView() {
  if (isPhoneUi()) state.showPlanTasks = false;
  const taskToggle = isPhoneUi()
    ? ""
    : `<button class="quiet" id="toggle-plan-tasks" aria-expanded="${state.showPlanTasks}" aria-label="${state.showPlanTasks ? "Hide the task list" : "Show the task list"}">${state.showPlanTasks ? "Hide tasks" : "Tasks"}</button>`;
  return `<p id="calendar-stale" class="calendar-stale" role="status"${window.calmCalendarNotice ? "" : " hidden"}>${esc(window.calmCalendarNotice || "")}</p><div class="plan-toolbar"><h2 id="calendar-range-label">${new Date(calmWeekDate(state.calendarMode === "day" ? state.calendarSlot.day : state.calendarAnchor) + "T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h2>${conflictSummary()}<button class="quiet" data-calendar-nav="prev" aria-label="Earlier days">‹</button><button class="quiet" data-calendar-nav="today">Today</button><button class="quiet" data-calendar-nav="next" aria-label="Later days">›</button>${sleepToggleButton()}${taskToggle}<div class="segmented"><button class="${state.calendarMode === "day" ? "active" : ""}" data-calendar-mode="day">Day</button><button class="${state.calendarMode === "week" ? "active" : ""}" data-calendar-mode="week">7 days</button></div></div><div class="plan-layout">${state.showPlanTasks ? calendarSidebar() : ""}<div class="calendar-wrap" data-mode="${state.calendarMode}" aria-label="Calendar. Scroll horizontally or drag the date headings to browse days."><div class="calendar ${state.calendarMode === "day" ? "day-mode calendar-day" : ""}">${calendarGrid()}</div></div></div>`;
}
let calendarResizeObserver;
function bindCalendarPan() {
  calendarResizeObserver?.disconnect();
  const wrap = $("screen").querySelector(".calendar-wrap");
  if (!wrap) return;
  const calendar = wrap.querySelector(".calendar"),
    header = wrap.querySelector(".calendar-header"),
    body = wrap.querySelector(".calendar-body");
  const layout = () => {
    fitCalendarHours(wrap);
    const width = Math.max(112, (wrap.clientWidth - 60) / 7.15);
    wrap.dataset.dayWidth = width;
    const columns = calendarDays().map((day) =>
      state.calendarMode === "day"
        ? Math.max(112, wrap.clientWidth - 60)
        : width * (calmWeekDate(day) === calmToday() ? 1.15 : 1),
    );
    const template = "60px " + columns.map((value) => value + "px").join(" ");
    for (const element of [header, body])
      element.style.gridTemplateColumns = template;
    calendar.style.width = 60 + columns.reduce((a, b) => a + b, 0) + "px";
    calendar.style.minWidth = "0";
  };
  layout();
  bindCalendarAutoScroll(wrap);
  calendarResizeObserver = new ResizeObserver(layout);
  calendarResizeObserver.observe(wrap);
  wrap.scrollLeft = state.calendarMode === "week" ? state.calendarPan : 0;
  wrap.onscroll = () => {
    if (!wrap.isConnected) return;
    if (state.calendarMode !== "week") return;
    state.calendarPan = wrap.scrollLeft;
    const day =
      state.calendarAnchor +
      Math.floor(wrap.scrollLeft / Number(wrap.dataset.dayWidth));
    $("calendar-range-label").textContent = new Date(
      calmWeekDate(day) + "T12:00:00",
    ).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (
      !calendarDrag &&
      wrap.scrollLeft > 0 &&
      wrap.scrollWidth - wrap.clientWidth - wrap.scrollLeft <
        Number(wrap.dataset.dayWidth) * 3 &&
      state.calendarSpan < 366
    ) {
      state.calendarSpan += 14;
      requestAnimationFrame(() => {
        if (wrap.isConnected) renderScreen();
      });
    }
  };
  let origin = null;
  header.onpointerdown = (event) => {
    if (event.target.closest("button") || state.calendarMode !== "week" || event.button !== 0) return;
    origin = { x: event.clientX, left: wrap.scrollLeft };
    header.setPointerCapture(event.pointerId);
    header.classList.add("panning");
    event.preventDefault();
  };
  header.onpointermove = (event) => {
    if (origin) wrap.scrollLeft = origin.left + origin.x - event.clientX;
  };
  const end = () => {
    origin = null;
    header.classList.remove("panning");
  };
  header.onpointerup = end;
  header.onpointercancel = end;
}
function calendarSidebar() {
  const eligible = tasks.filter(
    (t) =>
      planningStatus(t) &&
      matches(t, state.filter) &&
      (state.projectFilter === "All projects" ||
        (t.project || "Inbox") === state.projectFilter),
  );
  const groups = [
    [
      "Needs replanning",
      eligible.filter((t) => planningStatus(t) === "Needs replanning" && t.project),
    ],
    [
      "Unplanned",
      eligible.filter((t) => planningStatus(t) === "Unplanned" && t.project),
    ],
    [
      "Inbox",
      eligible.filter((t) => !t.project),
    ],
  ];
  return `<aside class="plan-tasks"><div class="plan-stage-nav">${groups.map(([label,list],index)=>`<button class="quiet" data-plan-jump="${index}" ${list.length ? "" : "disabled"}>${label}<small>${list.length}</small></button>`).join("")}</div>${listFilter("To plan", "task-filter", state.filter, eligible.length)}<select class="project-filter" id="plan-project-filter" aria-label="Filter by project">${["All projects", ...projects, "Inbox"].map((p) => `<option ${p === state.projectFilter ? "selected" : ""}>${esc(p)}</option>`).join("")}</select>${groups
    .map(([label, list], index) =>
      list.length
        ? `<section class="plan-pending-section" id="plan-stage-${index}" data-plan-group="${label}"><h4 tabindex="-1">${label}<small>${list.length}</small></h4>${
            label === "Inbox"
              ? taskRows(list, { compact: true })
              : [...projects, ""]
                  .map((project) => {
                    const grouped = list.filter((t) => t.project === project);
                    return grouped.length
                      ? `<details class="task-group" open><summary class="group-title">${esc(project || "Inbox")}<small>${grouped.length}</small></summary>${taskRows(grouped, { compact: true })}</details>`
                      : "";
                  })
                  .join("")
          }</section>`
        : "",
    )
    .join(
      "",
    )}${eligible.length ? "" : '<p class="empty">All tasks are planned.</p>'}</aside>`;
}
function allEvents() {
  const map = new Map();
  for (const event of [...Object.values(calendarEvents()), ...localEventOccurrences()])
    for (const copy of repeatingCopies(event)) if (copy?.id) map.set(copy.id, copy);
  return [...map.values()];
}
function repeatingCopies(event) {
  if (!event?.repeat || event.seriesId || event.owned || !event.date || !event.start) return [event];
  const from = calmDateAfter(-21);
  const until = calmDateAfter(Math.max(160, (state.calendarSpan || 7) + 21));
  return repeatDates(event, from, until).map((date) => {
    const startMs = dateTimeToMs(date, event.start);
    const endClock = event.end === "24:00" ? "00:00" : event.end || "00:30";
    let endMs = dateTimeToMs(date, endClock);
    if (event.end === "24:00" || endMs <= startMs) endMs += 86400000;
    return {
      ...event,
      id: date === event.date ? event.id : `${event.id}@${date}`,
      date,
      startMs,
      endMs,
      recurring: true,
      seriesId: event.id,
      expanded: true,
    };
  });
}
function shiftIsoDate(date, days) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-${pad2(next.getDate())}`;
}
function isoDayDelta(from, to) {
  return Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86400000);
}
function repeatDates(event, from, until) {
  const skip = new Set(event.skipDates || []);
  const dates = [];
  let date = event.date;
  for (let i = 0; i < 200 && date && date <= until; i++) {
    if (date >= from && !skip.has(date)) dates.push(date);
    const next = nextRepeatDate({ repeat: event.repeat, repeatRule: event.repeatRule, date });
    if (!next || next <= date) break;
    date = next;
  }
  return dates;
}
function localEventOccurrences() {
  const from = calmDateAfter(-21);
  const until = calmDateAfter(Math.max(160, (state.calendarSpan || 7) + 21));
  const out = [];
  for (const event of state.localEvents) {
    if (!event?.repeat || event.seriesId) {
      out.push(event);
      continue;
    }
    for (const date of repeatDates(event, from, until)) {
      out.push(
        date === event.date
          ? { ...event, recurring: true, seriesId: event.id }
          : { ...event, id: `${event.id}@${date}`, date, recurring: true, seriesId: event.id, owned: true },
      );
    }
  }
  return out;
}
function localMaster(source) {
  const id = source?.seriesId && source.seriesId !== source.id ? source.seriesId : source?.id;
  return state.localEvents.find((event) => event.id === id) || null;
}
function storedProject(meta) {
  if (!meta || !Object.prototype.hasOwnProperty.call(meta, "project")) return undefined;
  return meta.project || "";
}
function eventCalendarParts(event) {
  if (event?.accountId && event?.calendarId)
    return { key: `${event.accountId}|${event.calendarId}`, label: event.calendar || "" };
  const key = String(event?.key || "");
  if (key && key !== "local" && key.includes("|")) return { key, label: event?.calendar || "" };
  return { key: "", label: event?.calendar || "" };
}
function projectsForEvent(event) {
  const parts = eventCalendarParts(event);
  const mirror = window.calmMirror || {};
  return projects.filter((name) => {
    const stored = state.projectCalendars?.[name] || "";
    if (!stored) return false;
    if (parts.key && stored === parts.key) return true;
    const target = (mirror.targets || []).find((item) => item.key === stored);
    return !!(parts.label && target && target.label === parts.label);
  });
}
function inheritedEventProject(event) {
  const names = projectsForEvent(event);
  return names.length === 1 ? names[0] : "";
}
function eventProject(event) {
  if (!event) return "";
  if (event.owned) return event.project || inheritedEventProject(event);
  const own = storedProject(state.eventMeta?.[event.id]);
  if (own !== undefined) return own;
  if (event.eventId) {
    const byEvent = storedProject(state.eventMeta?.["event:" + event.eventId]);
    if (byEvent !== undefined) return byEvent;
  }
  if (event.seriesId) {
    const series = storedProject(state.eventMeta?.["series:" + event.seriesId]);
    if (series !== undefined) return series;
  }
  return event.project || inheritedEventProject(event);
}
function storeEventProject(event, project, scope) {
  const value = project || "";
  const seriesId = String(event?.seriesId || "");
  if (scope === "series" && seriesId) {
    for (const meta of Object.values(state.eventMeta || {})) {
      if (meta && meta.seriesId === seriesId) delete meta.project;
    }
    rememberEventLength("series:" + seriesId, "", "", value);
    if (state.eventMeta["series:" + seriesId]) state.eventMeta["series:" + seriesId].seriesId = seriesId;
    return;
  }
  const keys = [event?.id, event?.eventId ? "event:" + event.eventId : ""].filter(Boolean);
  for (const key of keys) {
    rememberEventLength(key, "", "", value);
    if (seriesId && state.eventMeta[key]) state.eventMeta[key].seriesId = seriesId;
  }
}
function clearEventProject(event, scope) {
  const seriesId = String(event?.seriesId || "");
  const drop = (key) => {
    const meta = state.eventMeta?.[key];
    if (!meta || !Object.prototype.hasOwnProperty.call(meta, "project")) return;
    delete meta.project;
    if (!Object.keys(meta).length) delete state.eventMeta[key];
  };
  if (scope === "series" && seriesId) {
    drop("series:" + seriesId);
    for (const [key, meta] of Object.entries(state.eventMeta || {})) if (meta?.seriesId === seriesId) drop(key);
    return;
  }
  if (event?.id) drop(event.id);
  if (event?.eventId) drop("event:" + event.eventId);
}
function applyEventProject(event, project, scope) {
  if ((project || "") === inheritedEventProject(event)) clearEventProject(event, scope);
  else storeEventProject(event, project, scope);
}
function calendarOwner(key, exceptName = "") {
  if (!key) return "";
  return projects.find((name) => name !== exceptName && state.projectCalendars?.[name] === key) || "";
}
function taskCalendarTarget(task) {
  if (task?.calendar) return task.calendar;
  const stored = task?.project && state.projectCalendars?.[task.project];
  if (stored) return stored;
  if (!task?.project) return "none";
  return "";
}
function taskCalendarDefaultLabel(task) {
  const mirror = window.calmMirror || {};
  const stored = task?.project ? state.projectCalendars?.[task.project] : "";
  if (stored) {
    const label = (mirror.targets || []).find((item) => item.key === stored)?.label;
    return label ? `Project · ${label}` : "Project calendar";
  }
  if (task?.project) return "Project calendar not set";
  return "Not on a calendar";
}
function calendarChoiceField(id, value, exceptName = "") {
  const targets = window.calmMirror?.targets || [];
  const current = value || "";
  const known = !current || targets.some((item) => item.key === current);
  const free = targets.filter((item) => !calendarOwner(item.key, exceptName));
  return `<label class="field"><span>Calendar</span><select id="${id}"><option value="">Choose a calendar</option>${free.map((item) => `<option value="${esc(item.key)}" ${item.key === current ? "selected" : ""}>${esc(item.label)}</option>`).join("")}${known ? "" : `<option value="${esc(current)}" selected>Unavailable calendar</option>`}</select><small class="settings-hint">${targets.length ? "Each project uses a different calendar. Tasks in this project use it, and events on it use this project. A task or event can still pick another calendar." : "Sign in to a calendar under Settings. A project needs its own calendar."}</small></label>`;
}
function shownEventEnd(event) {
  return state.eventMeta?.[event.id]?.actualEnd || event?.actualEnd || event?.end || "";
}
function eventMinutes(event) {
  const end = shownEventEnd(event);
  if (!event?.start || !end || event.allDay) return 0;
  const span = (end === "24:00" ? 1440 : minutes(end)) - minutes(event.start);
  return span > 0 ? span : 0;
}
function timedEvents() {
  return allEvents().filter((event) => event.start && event.end && !event.allDay && event.end !== "24:00");
}
function unassignedEvents() {
  return timedEvents()
    .filter((event) => !eventProject(event))
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || minutes(a.start) - minutes(b.start));
}
function matchesEvent(event, query) {
  return (event.title + " " + eventProject(event))
    .toLowerCase()
    .includes(query.replace(/^\//, "").trim().toLowerCase());
}
function safeHttps(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}
function meetingHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
function isMeetingHost(url) {
  const host = meetingHost(url);
  return ["meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "whereby.com", "webex.com", "gotomeeting.com", "meet.jit.si", "chime.aws", "around.co"].some(
    (item) => host === item || host.endsWith("." + item),
  );
}
function isCalendarPage(url) {
  const host = meetingHost(url);
  return ["calendar.google.com", "outlook.office.com", "outlook.office365.com", "outlook.live.com"].some(
    (item) => host === item || host.endsWith("." + item),
  );
}
function isDocument(url) {
  const host = meetingHost(url);
  return ["docs.google.com", "drive.google.com", "sites.google.com", "notion.so", "notion.site", "dropbox.com", "github.com", "gitlab.com", "bitbucket.org", "figma.com", "miro.com", "docs.microsoft.com", "wikipedia.org"].some(
    (item) => host === item || host.endsWith("." + item),
  );
}
function guessPrivateMeetingUrl(text) {
  const plain = String(text || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "\n");
  const rows = [];
  for (const line of plain.split("\n")) {
    for (const url of urlsIn(line)) {
      if (isCalendarPage(url) || isMeetingHost(url)) continue;
      rows.push({ url, join: /\b(join|meeting|call|hangout)\b/i.test(line) });
    }
  }
  const joined = rows.find((row) => row.join && !isDocument(row.url));
  if (joined) return joined.url;
  const open = [...new Set(rows.filter((row) => !isDocument(row.url)).map((row) => row.url))];
  return open.length === 1 ? open[0] : "";
}
function urlsIn(text) {
  const raw = String(text || "");
  const found = [];
  for (const match of raw.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = safeHttps(match[1]);
    if (url) found.push(url);
  }
  for (const match of raw.replace(/<[^>]+>/g, " ").matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = safeHttps(match[0].replace(/[),.;]+$/, ""));
    if (url) found.push(url);
  }
  return found;
}
function meetingUrlFrom(explicit, text, whole) {
  for (const value of explicit || []) {
    const url = safeHttps(value);
    if (url && !isCalendarPage(url)) return url;
  }
  const blob = (text || []).join("\n");
  const known = urlsIn(blob).find((url) => isMeetingHost(url));
  if (known) return known;
  const guessed = guessPrivateMeetingUrl(blob);
  if (guessed) return guessed;
  for (const value of whole || []) {
    const trimmed = String(value || "").trim();
    const url = safeHttps(trimmed);
    if (url && !isCalendarPage(url) && !isDocument(url)) return url;
  }
  return "";
}
function eventMeetingUrl(event) {
  return meetingUrlFrom(
    [event?.meetingUrl],
    [event?.notes, event?.description],
    [event?.location],
  );
}
function plainNotes(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function notesWithoutLink(text, url) {
  let body = plainNotes(text);
  if (url) body = body.split(url).join("");
  return body
    .split("\n")
    .filter((line) => !/^\s*(join with google meet|click here to join)\s*:?\s*$/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function notesForSave(edited, original, url) {
  const source = String(original || "");
  if (String(edited || "").trim() === notesWithoutLink(source, url).trim()) return source;
  const next = String(edited || "").trim();
  if (!url || next.includes(url)) return next;
  return next ? `${next}\n\n${url}` : url;
}
function formatNotes(text) {
  const body = esc(text || "").trim();
  if (!body) return "";
  return body
    .replace(/https?:\/\/[^\s<]+/g, (url) => `<a href="${url}" target="_blank" rel="noopener">${url}</a>`)
    .split(/\n{2,}/)
    .map((part) => `<p>${part.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
function notesField(id, text, editable) {
  if (!editable) {
    const view = formatNotes(text);
    return view ? `<div class="notes-read">${view}</div>` : "";
  }
  return `<label class="field"><span>Notes</span><textarea id="${id}" rows="5">${esc(text || "")}</textarea></label>`;
}
function meetingLinkHtml(url) {
  const value = safeHttps(url);
  if (!value) return "";
  return `<a class="quiet meeting-link" href="${esc(value)}" target="_blank" rel="noopener">Open meeting link</a>`;
}
function eventProjectField(value) {
  const current = value || "";
  const names = !current || projects.includes(current) ? projects : [current, ...projects];
  return `<label class="field"><span>Project</span><select id="event-project"><option value="">No project</option>${names.map((name) => `<option value="${esc(name)}" ${name === current ? "selected" : ""}>${esc(name)}</option>`).join("")}</select></label>`;
}
function actualEndField(value) {
  return `<label class="field"><span>Actual end</span><input name="event-actual-end" type="time" value="${esc(value || "")}"><small class="settings-hint">The real finish. Plan and Track use this length.</small></label>`;
}
function rememberEventLength(id, plannedEnd, actualEnd, project) {
  if (!id) return;
  const meta = { ...(state.eventMeta[id] || {}) };
  if (actualEnd) {
    if (!meta.plannedEnd && plannedEnd) meta.plannedEnd = plannedEnd;
    meta.actualEnd = actualEnd;
  } else if (plannedEnd) delete meta.actualEnd;
  if (project !== undefined) meta.project = project || "";
  state.eventMeta[id] = meta;
}
function eventRow(event) {
  const mins = eventMinutes(event);
  const planned = state.eventMeta?.[event.id]?.plannedEnd || event.plannedEnd;
  const actual = shownEventEnd(event);
  const plannedMins = planned ? Math.max(0, (planned === "24:00" ? 1440 : minutes(planned)) - minutes(event.start || "00:00")) : mins;
  const meta = [
    "Event",
    mins ? `${mins} min` : "",
    planned && planned !== actual ? `planned ${plannedMins} min` : "",
    eventProject(event),
  ].filter(Boolean);
  return `<div class="task-row event-row" tabindex="0" data-event="${esc(event.id)}" aria-label="${esc(event.title)}"><span class="event-mark" aria-hidden="true"></span><div class="task-copy"><div class="task-name">${esc(event.title)}</div><div class="task-meta">${meta.map(esc).join("<span>·</span>")}</div></div>${event.start ? `<time class="task-time">${esc(event.start)}</time>` : ""}<button class="icon-btn" data-event="${esc(event.id)}" aria-label="Details for ${esc(event.title)}">${svg("details")}</button></div>`;
}
function minutes(time) {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return h * 60 + m;
}
function timeString(minute) {
  const whole = Math.floor(minute);
  return (
    String(Math.floor(whole / 60)).padStart(2, "0") +
    ":" +
    String(whole % 60).padStart(2, "0")
  );
}
function dayShelfItems(day) {
  const date = calmWeekDate(day);
  return {
    events: allEvents().filter((event) => event.date === date && event.allDay),
    // The phone Plan is the calendar only: no task chips above it.
    pending: isPhoneUi() ? [] : tasks.filter((task) => task.date === date && !task.schedule && !task.done && task.id !== state.active),
  };
}
function shelfChip(item, kind) {
  return kind === "event"
    ? `<button type="button" class="day-chip event" data-event="${esc(item.id)}">${esc(item.title)}</button>`
    : `<button type="button" class="day-chip" data-calendar-task="${esc(item.id)}">${esc(item.title)}</button>`;
}
function calendarDayShelf(day) {
  const { events, pending } = dayShelfItems(day);
  const sleep = state.showSleepHours ? [] : dayBlocks(day).filter((block) => block.start < nightEndMinute() && block.end > 0);
  if (!events.length && !pending.length && !sleep.length) return "";
  const shownEvents = events.slice(0, 2),
    shownPending = pending.slice(0, 2);
  const hidden = events.length - shownEvents.length + pending.length - shownPending.length;
  return `<div class="day-shelf" aria-label="${calmDayLabel(day)} day items">${shownEvents.length ? `<small>All day</small>${shownEvents.map((event) => shelfChip(event, "event")).join("")}` : ""}${shownPending.length ? `<small>To schedule</small>${shownPending.map((task) => shelfChip(task, "task")).join("")}` : ""}${hidden ? `<button type="button" class="day-more" data-day-more="${day}">+${hidden} more</button>` : ""}${sleep.map((block) => `<button type="button" class="day-chip sleep-item" data-sleep-item="${day}" title="Show overnight time">${timeString(block.start)} · ${esc(block.title)}</button>`).join("")}</div>`;
}
function openDayOverflow(day) {
  document.getElementById("day-overflow")?.remove();
  const { events, pending } = dayShelfItems(day);
  const dialog = document.createElement("div");
  dialog.id = "day-overflow";
  dialog.className = "day-overflow";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", calmDayLabel(day));
  const date = new Date(calmWeekDate(day) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  dialog.innerHTML = `<header><strong>${esc(date)}</strong><button type="button" class="icon-btn" data-close-overflow aria-label="Close">${svg("close")}</button></header>${events.map((event) => shelfChip(event, "event")).join("")}${pending.map((task) => shelfChip(task, "task")).join("")}`;
  document.body.append(dialog);
  const opener = document.querySelector(`[data-day-more="${day}"]`);
  const rect = opener?.getBoundingClientRect();
  const width = Math.min(280, window.innerWidth - 24);
  const left = rect ? Math.min(Math.max(12, rect.left), window.innerWidth - width - 12) : 12;
  const top = rect ? Math.min(rect.bottom + 6, window.innerHeight - 16) : 80;
  dialog.style.left = left + "px";
  dialog.style.top = top + "px";
  dialog.style.width = width + "px";
  dialog.querySelector("[data-close-overflow]").onclick = () => dialog.remove();
}
function calendarGrid() {
  const days = calendarDays();
  return `<div class="calendar-header"><div></div>${days.map((d) => `<div data-shelf-day="${d}" class="${calmWeekDate(d) === calmToday() ? "current-day" : ""}">${calmDayLabel(d, true)}<strong>${new Date(calmWeekDate(d) + "T12:00:00").getDate()}</strong>${calendarDayShelf(d)}</div>`).join("")}</div><div class="calendar-body"><div class="time-axis">${Array.from({ length: 24 }, (_, i) => (!state.showSleepHours && i < 8) ? "" : `<span data-minute="${i * 60}" style="top:${calendarY(i * 60)}px">${String(i).padStart(2, "0")}:00</span>`).join("")}</div>${days.map((d) => `<div class="day-column ${calmWeekDate(d) === calmToday() ? "current-day" : ""}" data-day="${d}" tabindex="0" aria-label="${calmDayLabel(d)} calendar. Drag to choose a time, then name the task. Arrow keys move the selection. Enter names a task at the selection.">${calendarBlocks(d)}${calmWeekDate(d) === calmToday() ? `<div class="calendar-now" role="img" aria-label="Current time"><span>${timeString(state.nowMinute)}</span></div>` : ""}${state.slotVisible && state.calendarSlot.day === d ? `<div class="calendar-selected" style="top:${calendarY(state.calendarSlot.minute)}px"></div>` : ""}</div>`).join("")}</div>`;
}
function calendarBlocks(day) {
  const all = packCalendarBlocks(dayBlocks(day).filter((b) => state.showSleepHours || b.end > nightEndMinute()));
  return all
    .map((block) => {
      const overlaps = conflictsFor(block, all),
        count = block.columns;
      const time = `${calendarTime(block.start, block.end - block.start < 1)}–${calendarTime(block.end, block.end - block.start < 1)}`,
        recorded =
          block.recordedMinutes != null
            ? ` · ${durationLabel(block.recordedMinutes)} tracked`
            : "",
        warning = overlaps.length
          ? `Overlaps ${overlaps.map((b) => b.title).join(", ")}`
          : "",
        mirrored =
          block.kind === "task" && window.calmMirror?.tasks?.[block.id]?.state === "conflict";
      return `${mirrored ? `<span class="mirror-mark" title="Changed in the calendar · open the task to choose" style="top:${calendarY(block.start) + 2}px;left:calc(${((block.lane + 1) * 100) / count}% - 18px)" aria-hidden="true">↺</span>` : ""}<button class="calendar-block ${block.kind === "event" ? "event" : "task"} ${block.kind === "actual" ? "actual-block" : ""} ${overlaps.length ? "has-conflict" : ""}" ${block.kind === "event" ? `data-event="${esc(block.id)}"` : `data-calendar-task="${esc(block.id)}"`} data-block-start="${block.start}" data-block-end="${block.end}" style="top:${calendarY(block.start)}px;height:${calendarIntervalHeight(block.start, block.end)}px;left:calc(${(block.lane * 100) / count}% + 3px);width:calc(${100 / count}% - 6px)" ${block.key.startsWith("live-") ? 'data-live-session="true"' : ""} aria-label="${esc(block.title)} · ${time}${recorded}${warning ? " · " + esc(warning) : ""}${mirrored ? " · changed in the calendar" : ""}"><strong>${overlaps.length ? '<span class="conflict-mark" aria-hidden="true">!</span> ' : ""}${block.recordedMinutes != null ? `<span class="calendar-block-title">${esc(block.title)}</span><span class="recorded-duration" title="Tracked time">${durationLabel(block.recordedMinutes)}</span>` : esc(block.title)}</strong>${block.end - block.start >= 40 ? `<small>${block.recordedMinutes != null ? time : block.key.startsWith("live-") ? "Recording · " + durationLabel(block.end - block.start) + " planned" : time}</small>` : ""}</button>`;
    })
    .join("");
}
function planBlockKey(el) {
  return (el.dataset.event || "") + "|" + (el.dataset.calendarTask || "") + "|" + el.className;
}
function wirePlanBlock(block) {
  block.dataset.wired = "1";
  if (block.dataset.calendarTask && !block.dataset.event) {
    block.draggable = !block.classList.contains("actual-block");
    block.onfocus = () => (state.selected = block.dataset.calendarTask);
    block.ondragstart = (event) => beginCalendarDrag(event, "task", block.dataset.calendarTask);
    bindTaskResize(block);
    return;
  }
  const providerEvent = calendarEvents()[block.dataset.event];
  const localEvent = localEventOccurrences().find((event) => event.id === block.dataset.event);
  block.draggable =
    (!!localEvent?.owned && !localEvent.allDay) ||
    (isEditableProviderEvent(providerEvent) && !providerEvent.allDay);
  if (/^#[0-9a-f]{3,8}$/i.test(providerEvent?.color || "")) block.style.setProperty("--event-color", providerEvent.color);
  if (isEditableProviderEvent(providerEvent)) block.classList.add("editable-event");
  else if (providerApi() && providerEvent && !providerEvent.owned) {
    block.classList.add("readonly-event");
    const reason = providerLockCopy(providerEvent);
    block.title = reason;
    const label = block.getAttribute("aria-label") || "";
    if (!label.includes(reason)) block.setAttribute("aria-label", `${label}. ${reason}`);
  }
  block.ondragstart = (event) => {
    if (block.classList.contains("resizing")) {
      event.preventDefault();
      return;
    }
    beginCalendarDrag(event, "event", block.dataset.event);
  };
  bindEventResize(block);
}
function showPlanSlot(focus = true) {
  const screen = $("screen");
  if (state.view !== "plan" || !screen.querySelector(".calendar-wrap")) return renderScreen();
  state.slotVisible = true;
  screen.querySelectorAll(".calendar-selected").forEach((el) => el.remove());
  const column = screen.querySelector(`.day-column[data-day="${state.calendarSlot.day}"]`);
  if (!column) return renderScreen();
  const mark = document.createElement("div");
  mark.className = "calendar-selected";
  mark.style.top = calendarY(state.calendarSlot.minute) + "px";
  column.append(mark);
  if (focus && document.activeElement !== column) column.focus();
}
function placeTaskOnDate(day, transfer) {
  const task = getTask(transfer);
  if (!task || task.done || task.id === state.active) return;
  task.date = calmWeekDate(Number(day));
  task.schedule = "";
  stopCalendarDrag();
  repaintPlan();
}
function bindPlanShelves() {
  const screen = $("screen");
  screen.querySelectorAll("[data-shelf-day]").forEach((cell) => {
    cell.ondragover = (event) => event.preventDefault();
    cell.ondrop = (event) => {
      if (event.target.closest(".day-shelf")) return;
      event.preventDefault();
      event.stopPropagation();
      placeTaskOnDate(cell.dataset.shelfDay, event.dataTransfer.getData("text/plain"));
    };
  });
  screen.querySelectorAll(".day-shelf").forEach((shelf) => {
    shelf.ondragover = (event) => event.preventDefault();
    shelf.ondrop = (event) => {
      event.preventDefault();
      event.stopPropagation();
      placeTaskOnDate(shelf.closest("[data-shelf-day]").dataset.shelfDay, event.dataTransfer.getData("text/plain"));
    };
  });
  screen.querySelectorAll("[data-sleep-item]").forEach((button) => (button.onclick = () => {
    state.showSleepHours = true;
    renderScreen();
    screen.querySelector(".calendar-wrap").scrollTop = calendarY(120);
  }));
}
function refreshPlanList(focusId) {
  const aside = $("screen")?.querySelector(".plan-tasks");
  if (state.view !== "plan" || !aside) return renderScreen();
  const pos = focusId ? $(focusId)?.selectionStart : null;
  const probe = document.createElement("div");
  probe.innerHTML = calendarSidebar();
  const scroll = aside.scrollTop;
  aside.replaceWith(probe.firstElementChild);
  const next = $("screen").querySelector(".plan-tasks");
  if (next) next.scrollTop = scroll;
  bindPlanList();
  const field = focusId ? $(focusId) : null;
  if (field) {
    field.focus();
    if (pos != null && field.setSelectionRange) field.setSelectionRange(pos, pos);
  }
}
function bindPlanList() {
  const filter = $("task-filter");
  if (filter && state.view === "plan")
    filter.oninput = (event) => {
      state.filter = event.target.value;
      refreshPlanList("task-filter");
    };
  if ($("plan-project-filter"))
    $("plan-project-filter").onchange = (event) => {
      state.projectFilter = event.target.value;
      refreshPlanList();
    };
  $("screen").querySelectorAll("[data-plan-jump]").forEach((button) => (button.onclick = () => {
    const section = $("plan-stage-" + button.dataset.planJump);
    section?.scrollIntoView({ block: "start" });
    section?.querySelector("h4")?.focus({ preventScroll: true });
  }));
  $("screen").querySelectorAll(".plan-tasks [data-row]").forEach((element) => {
    element.onfocus = () => {
      state.selected = element.dataset.row;
      state.planSelectedTask = state.selected;
    };
    element.ondragstart = (event) => {
      state.selected = element.dataset.row;
      event.dataTransfer.setData("text/plain", state.selected);
      beginCalendarDrag(event, "task", state.selected);
      element.classList.add("dragging");
    };
    element.ondragend = () => element.classList.remove("dragging");
    element.onclick = (event) => {
      if (!event.target.closest("button")) {
        state.planSelectedTask = element.dataset.row;
        openTask(element.dataset.row);
      }
    };
  });
}
function syncColumnBlocks(column, day) {
  const holder = document.createElement("div");
  holder.innerHTML = calendarBlocks(day);
  const next = [...holder.children];
  const current = [...column.querySelectorAll(":scope > .calendar-block, :scope > .mirror-mark")];
  const same =
    current.length === next.length &&
    current.every((el, i) => planBlockKey(el) === planBlockKey(next[i]));
  if (same) {
    current.forEach((el, i) => {
      const style = next[i].style;
      for (const prop of ["top", "height", "left", "width"])
        if (el.style[prop] !== style[prop]) el.style[prop] = style[prop];
      for (const name of ["data-block-start", "data-block-end", "aria-label"]) {
        const value = next[i].getAttribute(name);
        if (value != null && el.getAttribute(name) !== value) el.setAttribute(name, value);
      }
      if (el.textContent !== next[i].textContent) {
        const handles = [...el.querySelectorAll(".event-resize")];
        el.innerHTML = next[i].innerHTML;
        handles.forEach((handle) => el.append(handle));
      }
    });
    return;
  }
  current.forEach((el) => el.remove());
  if (next.length) column.prepend(...next);
  column.querySelectorAll(":scope > .calendar-block").forEach(wirePlanBlock);
}
/** Move blocks and the task list without replacing the calendar scroll surface. */
function repaintPlan() {
  const screen = $("screen");
  const wrap = screen?.querySelector(".calendar-wrap");
  if (state.view !== "plan" || !wrap) return renderScreen();
  const aside = screen.querySelector(".plan-tasks");
  if (aside && state.showPlanTasks) {
    const probe = document.createElement("div");
    probe.innerHTML = calendarSidebar();
    const ids = (root) => [...root.querySelectorAll("[data-row]")].map((el) => el.dataset.row).join("\n");
    if (ids(aside) !== ids(probe)) {
      const scroll = aside.scrollTop;
      aside.replaceWith(probe.firstElementChild);
      const next = screen.querySelector(".plan-tasks");
      if (next) next.scrollTop = scroll;
      bindPlanList();
    }
  }
  screen.querySelectorAll(".day-column").forEach((column) => syncColumnBlocks(column, Number(column.dataset.day)));
  screen.querySelectorAll("[data-shelf-day]").forEach((cell) => {
    const next = calendarDayShelf(Number(cell.dataset.shelfDay));
    const shelf = cell.querySelector(".day-shelf");
    if (!next) shelf?.remove();
    else if (!shelf) cell.insertAdjacentHTML("beforeend", next);
    else if (shelf.outerHTML !== next) shelf.outerHTML = next;
  });
  screen.querySelectorAll("[data-calendar-task], .calendar-block[data-event]").forEach((block) => {
    if (!block.dataset.wired) wirePlanBlock(block);
  });
  bindPlanShelves();
  screen.querySelectorAll(".calendar-selected").forEach((el) => el.remove());
  if (state.slotVisible) {
    const column = screen.querySelector(`.day-column[data-day="${state.calendarSlot.day}"]`);
    if (column) {
      const mark = document.createElement("div");
      mark.className = "calendar-selected";
      mark.style.top = calendarY(state.calendarSlot.minute) + "px";
      column.append(mark);
    }
  }
  const notice = screen.querySelector(".calendar-conflict-notice");
  const summary = conflictSummary();
  if (notice && summary) notice.outerHTML = summary;
  else if (notice && !summary) notice.remove();
  else if (!notice && summary) screen.querySelector(".plan-toolbar h2").insertAdjacentHTML("afterend", summary);
  if (typeof updateCalendarNow === "function") updateCalendarNow();
}
function renderScreen() {
  if (iosPlanHidden && state.view === "plan") { state.view = "track"; $("screen-title").textContent = "Track"; }
  hideCalendarTooltip();
  const oldCalendarScroll =
    $("screen").querySelector(".calendar-wrap")?.scrollTop;
  calendarResizeObserver?.disconnect();
  updateInboxCount();
  if (["project", "project-board"].includes(state.view))
    $("screen-title").textContent = calmSelectedProject();
  const screen = $("screen");
  screen.className = state.view === "plan" ? "plan-screen" : "";
  if (state.view === "track") screen.innerHTML = trackView();
  else if (state.view === "inbox") screen.innerHTML = inboxView();
  else if (state.view === "projects") screen.innerHTML = projectsView();
  else if (state.view === "project") screen.innerHTML = projectView();
  else if (state.view === "project-board") screen.innerHTML = boardView();
  else if (state.view === "team") screen.innerHTML = teamView();
  else if (state.view === "modules") screen.innerHTML = workspaceView();
  else if (state.view === "reports") screen.innerHTML = reportsView();
  else if (state.view === "plan") screen.innerHTML = calendarView();
  else screen.innerHTML = staticViews[state.view] || head("Tasks");
  paintIcons(screen);
  adaptStaticTasks(screen);
  bindScreen();
  document.querySelectorAll("[data-plan-jump]").forEach(button => button.onclick = () => { const section = $("plan-stage-" + button.dataset.planJump); section?.scrollIntoView({block:"start"}); section?.querySelector("h4").focus({preventScroll:true}); });
  updateBackButton();
  const sleepToggle = $("toggle-sleep");
  if (sleepToggle) sleepToggle.onclick = () => {
    const minute = calendarMinuteAt(screen.querySelector(".calendar-wrap").scrollTop);
    state.showSleepHours = !state.showSleepHours; renderScreen();
    screen.querySelector(".calendar-wrap").scrollTop = calendarY(minute);
  };
  screen.querySelectorAll("[data-sleep-item]").forEach(button => button.onclick = () => {
    state.showSleepHours = true; renderScreen();
    screen.querySelector(".calendar-wrap").scrollTop = calendarY(120);
  });
  bindPlanShelves();
  if (state.view === "plan") bindPlanList();
  bindCalendarPan();
  const calendarWrap = screen.querySelector(".calendar-wrap");
  if (calendarWrap)
    calendarWrap.scrollTop =
      oldCalendarScroll ??
      Math.max(0, calendarY((Math.floor(state.nowMinute / 60) - 1) * 60));
  renderGlobalTracker();
  updateHints();
  if (["bookings", "polls"].includes(state.view)) addShareLinks();
}
const drawerStates = {
  "new-task": ["track", "add"],
  task: ["track", "task"],
  "task-options": ["track", "options"],
  "mobile-task": ["track", "task"],
  session: ["reports", "entry"],
  export: ["reports", "static"],
  "project-notes": ["project", "static"],
  "project-settings": ["project", "static"],
  restore: ["sync", "static"],
  "booking-edit": ["bookings", "static"],
  "booking-availability": ["bookings", "static"],
  "booking-rules": ["bookings", "static"],
  "booking-questions": ["bookings", "static"],
  "poll-edit": ["polls", "static"],
  "booking-manage": ["bookings", "static"],
};
function viewContext() {
  return Object.fromEntries(["view","projectName","reportMode","reportProject","reportTask","filter","pickerQuery","calendarAnchor","calendarPan","calendarMode","showPlanTasks"].map(key=>[key,state[key]]));
}
function viewLabel(context) {
  return ({inbox:"Clean",track:"Track",plan:"Plan",projects:"Projects",project:context.projectName||"Project","project-board":context.projectName||"Project",reports:"Reports",modules:"Settings",bookings:"Booking",polls:"Polls",team:"Team"})[context.view] || "previous view";
}
function updateBackButton() {
  const button=$("nav-back"), prior=state.navigationHistory?.at(-1);
  button.hidden=!prior && $("drawer").hidden;
  const label="Back to "+viewLabel(!$("drawer").hidden ? viewContext() : prior || viewContext());
  button.setAttribute("aria-label",label);button.title=label+" (Alt+Left)";
}
function goBack() {
  if (!$("drawer").hidden) { closeDrawer(); return; }
  const history=state.navigationHistory||[], prior=history.at(-1); if(!prior)return;
  history.pop();state.navigationReturning=true;
  try { state.projectName=prior.projectName;show(prior.view,{preserveSurface:true});Object.assign(state,prior);renderScreen(); } finally {state.navigationReturning=false;}
  $("screen").focus();updateBackButton();
}
$("nav-back").onclick=goBack;
document.addEventListener("keydown",event=>{if(event.altKey&&event.key==="ArrowLeft"&&!activeModal()){event.preventDefault();event.stopImmediatePropagation();goBack();}},true);
function show(key, { preserveSurface = false } = {}) {
  if (iosPlanHidden && ["plan", "block", "calendar-new-task", "calendar-new-event", "calendar-event"].includes(key)) key = "track";
  if (guardDrawerChange(() => show(key, { preserveSurface }))) return;
  const previousContext=viewContext();
  const previousView = state.view;
  closeAdd();
  $("help-overlay").hidden = true;
  closeDrawer(false);
  state.inline = null;
  state.filter = "";
  state.selected = null;
  state.pickerQuery = "";
  if (["members", "block"].includes(key))
    key = key === "members" ? "team" : "plan";
  const item = reviewItems.find((v) => v.key === key);
  if (!preserveSurface) state.surface = item?.surface || "desktop";
  if (["tray", "mobile", "mobile-task"].includes(key))
    state.surface = key === "tray" ? "tray" : "mobile";
  if (["today", "mobile", "tray"].includes(key)) state.view = "track";
  else if (key === "history") {
    state.view = "reports";
    state.reportMode = "entries";
    state.reportEdit = null;
  } else if (
    ["calendar-new-task", "calendar-new-event", "calendar-event"].includes(key)
  )
    state.view = "plan";
  else state.view = drawerStates[key]?.[0] || key;
  if (state.view === "plan" && previousView !== "plan") {
    window.calmWeekOffset = 0;
    state.calendarSlot.day = calmTodayIndex();
    state.calendarAnchor = calmTodayIndex();
    state.calendarPan = 0;
    state.calendarSpan = 28;
  }
  if (!state.navigationReturning && previousView!==state.view) { state.navigationHistory ||= [];state.navigationHistory.push(previousContext);if(state.navigationHistory.length>50)state.navigationHistory.shift(); }
  if (state.view === "plan" && (previousView !== "plan" || isPhoneUi())) state.showPlanTasks = isPhoneUi() || innerWidth < 700 ? false : state.desktopPlanTasks !== false;
  state.planSelectedTask = null;
  $("app").dataset.surface = state.surface;
  $("screen-title").textContent =
    {
      track: "Track",
      inbox: "Clean",
      project: calmSelectedProject(),
      "project-board": calmSelectedProject(),
      projects: "Projects",
      modules: "Settings",
      plan: "Plan",
      bookings: "Booking",
      team: "Team",
      reports: "Reports",
    }[state.view] ||
    reviewItems.find((v) => v.key === state.view)?.title ||
    state.view;
  $("review-picker").value = key;
  document
    .querySelectorAll(".nav-item")
    .forEach((n) =>
      n.classList.toggle(
        "active",
        n.dataset.show ===
          (["project", "project-board"].includes(state.view)
            ? "projects"
            : state.view),
      ),
    );
  renderScreen();updateBackButton();
  if (key === "calendar-new-task") openCalendarCreate("task");
  else if (key === "calendar-new-event") openCalendarCreate("event");
  else if (key === "calendar-event") openEvent("design");
  else if (drawerStates[key]) {
    const kind = drawerStates[key][1];
    if (kind === "add") openAdd();
    else if (kind === "task" || kind === "options")
      openTask(kind === "options" ? "supplier" : "sample", kind === "options");
    else if (kind === "entry") openSession("notes");
    else openStaticDrawer(key);
  }
  document
    .querySelectorAll("#mobile-menu [data-show]")
    .forEach((button) => {
      const current =
        button.dataset.show === state.view ||
        (button.dataset.show === "projects" &&
          ["project", "project-board"].includes(state.view));
      button.setAttribute("aria-current", current ? "page" : "false");
    });
  applyViewOrientation();
  location.hash = key;
}
function applyViewOrientation() {
  // Portrait and landscape offer the same phone views; nothing asks for a rotation.
  document.body.dataset.portraitView = "false";
  try {
    Promise.resolve(screen.orientation?.unlock?.()).catch(() => {});
  } catch {}
}
phoneMedia.addEventListener?.("change", applyViewOrientation);
function bindScreen() {
  if ($("workspace-backup"))
    $("workspace-backup").onclick = () =>
      window.CalmRuntime?.exportWorkspace().catch(() =>
        notify("Workspace export failed. Your local data is unchanged."),
      );
  if ($("new-project")) $("new-project").onclick = () => projectEditor(true);
  $("screen")
    .querySelectorAll("[data-project-index]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          openProject(Number(button.dataset.projectIndex));
        }),
    );
  $("screen")
    .querySelectorAll("[data-project-detail]")
    .forEach((button) => {
      button.onclick = () => {
        openProject(Number(button.dataset.projectDetail), true);
      };
    });
  bindProjectPicker("inline-value");
  bindProjectPicker("entry-project");
  function filter(id, property) {
    const input = $(id);
    if (input)
      input.oninput = (event) => {
        state[property] = event.target.value;
        const pos = event.target.selectionStart;
        renderScreen();
        $(id).focus();
        $(id).setSelectionRange(pos, pos);
      };
  }
  filter("task-filter", "filter");
  filter("picker-search", "pickerQuery");
  if ($("settings-shortcuts")) $("settings-shortcuts").onclick = help;
  if ($("pause-timer"))
    $("pause-timer").onclick = () => {
      state.running = !state.running;
      renderScreen();
    };
  if ($("finish-task")) $("finish-task").onclick = finishTask;
  if ($("apply-inline")) $("apply-inline").onclick = applyInline;
  if ($("cancel-inline"))
    $("cancel-inline").onclick = () => {
      state.inline = null;
      renderScreen();
    };
  if ($("inline-value"))
    $("inline-value").onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyInline();
      }
    };
  $("screen")
    .querySelectorAll("[data-inline-preset]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          $("inline-value").value = button.dataset.inlinePreset;
          applyInline();
        }),
    );
  if ($("toggle-plan-tasks"))
    $("toggle-plan-tasks").onclick = () => {
      state.showPlanTasks = !state.showPlanTasks;
      if(innerWidth>=700)state.desktopPlanTasks=state.showPlanTasks;
      renderScreen();
      $("toggle-plan-tasks")?.focus({ preventScroll: true });
    };
  if (!window.calmPlanResize) {
    window.calmPlanResize = true;
    addEventListener("resize", () => {
      if (state.view !== "plan" || isPhoneUi() || innerWidth < 700 || state.desktopPlanTasks === false || state.showPlanTasks) return;
      state.showPlanTasks = true;
      renderScreen();
    });
  }
  if ($("plan-project-filter"))
    $("plan-project-filter").onchange = (event) => {
      state.projectFilter = event.target.value;
      renderScreen();
    };
  $("screen")
    .querySelectorAll("[data-plan-list]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          state.planListKind = button.dataset.planList;
          renderScreen();
        }),
    );
  $("screen")
    .querySelectorAll("[data-calendar-mode]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          state.calendarMode = button.dataset.calendarMode;
          renderScreen();
        }),
    );
  $("screen")
    .querySelectorAll("[data-calendar-nav]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const direction = button.dataset.calendarNav;
          const wrap = $("screen").querySelector(".calendar-wrap");
          if (direction === "today") {
            window.calmWeekOffset = 0;
            state.calendarSlot.day = calmTodayIndex();
            state.calendarAnchor = calmTodayIndex();
            state.calendarPan = 0;
          } else if (state.calendarMode === "week") {
            if (direction === "prev" && wrap.scrollLeft < 1) {
              state.calendarAnchor -= 7;
              state.calendarSpan += 7;
              state.calendarPan = Number(wrap.dataset.dayWidth) * 6;
            } else {
              wrap.scrollBy({
                left:
                  Number(wrap.dataset.dayWidth) *
                  (direction === "next" ? 1 : -1),
                behavior: "smooth",
              });
              return;
            }
          } else state.calendarSlot.day += direction === "next" ? 1 : -1;
          renderScreen();
          if (direction === "today")
            $("screen").querySelector(".calendar-wrap").scrollTop = calendarY(
              Math.max(0, state.nowMinute - 60),
            );
        }),
    );
  $("screen")
    .querySelectorAll("[data-row]")
    .forEach((element) => {
      element.onfocus = () => {
        state.selected = element.dataset.row;
        if (state.view === "plan") state.planSelectedTask = state.selected;
      };
      element.ondragstart = (event) => {
        state.selected = element.dataset.row;
        event.dataTransfer.setData("text/plain", state.selected);
        if (state.view === "plan")
          beginCalendarDrag(event, "task", state.selected);
        element.classList.add("dragging");
      };
      element.ondragend = () => element.classList.remove("dragging");
      if (state.view === "track") {
        element.ondragover = (event) => event.preventDefault();
        element.ondrop = (event) => {
          event.preventDefault();
          reorderTask(
            event.dataTransfer.getData("text/plain"),
            element.dataset.row,
          );
        };
      }
      if (state.view === "plan")
        element.onclick = (event) => {
          if (!event.target.closest("button")) {
            state.planSelectedTask = element.dataset.row;
            openTask(element.dataset.row);
          }
        };
    });
  $("screen")
    .querySelectorAll("[data-calendar-task], .calendar-block[data-event]")
    .forEach(wirePlanBlock);
  $("screen")
    .querySelectorAll(".day-column")
    .forEach((column) => {
      function slot(event) {
        return calendarSlotAt(column, event.clientX, event.clientY);
      }
      bindCreateDrag(column);
      column.onclick = (event) => {
        if (event.target.closest(".calendar-block,.day-chip") || column.dataset.dragCreated) return;
        state.calendarSlot = slot(event);
        state.calendarSlotEnd = null;
        state.planSelectedTask = null;
        if (isPhoneUi()) {
          openCalendarCreate("event");
          return;
        }
        showPlanSlot(false);
      };
      column.ondragover = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        showCalendarDrop(column, { x: event.clientX, y: event.clientY - (calendarDrag?.offset || 0) });
      };
      column.ondragleave = (event) => {
        if (!column.contains(event.relatedTarget)) {
          column.classList.remove("drop-over");
          column.querySelector(".calendar-selected")?.remove();
        }
      };
      column.ondrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        dropCalendarItem(event, column);
      };
    });
  $("screen")
    .querySelectorAll("[data-board-target]")
    .forEach((column) => {
      column.ondragover = (event) => {
        event.preventDefault();
        column.classList.add("drop-over");
      };
      column.ondragleave = (event) => {
        if (!column.contains(event.relatedTarget))
          column.classList.remove("drop-over");
      };
      column.ondrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        column.classList.remove("drop-over");
        moveBoardTask(
          event.dataTransfer.getData("text/plain"),
          column.dataset.boardTarget,
        );
      };
    });
  for (const [id, property] of [
    ["report-project", "reportProject"],
    ["report-group", "reportGroup"],
    ["report-from", "reportFrom"],
    ["report-to", "reportTo"],
  ]) {
    if ($(id))
      $(id).onchange = (event) => {
        if (id === "report-project") applyReportProjects(event.target);
        else state[property] = event.target.value;
        state.reportEdit = null;
        renderScreen();
      };
  }
  $("screen").querySelectorAll(".tz-zone").forEach((input) => {
    input.onchange = saveTimeZones;
    input.onblur = saveTimeZones;
  });
  bindTrackSwipe();
  bindZoneHover();
  $("screen")
    .querySelectorAll("[data-report-range]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const range = button.dataset.reportRange;
          state.reportFrom =
            range === "all"
              ? ""
              : range === "today"
                ? calmToday()
                : calmDateAfter(-calmTodayIndex());
          state.reportTo =
            range === "all"
              ? ""
              : range === "today"
                ? calmToday()
                : calmDateAfter(6 - calmTodayIndex());
          renderScreen();
        }),
    );
  $("screen")
    .querySelectorAll("[data-report-mode]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          state.reportMode = button.dataset.reportMode;
          state.reportEdit = null;
          renderScreen();
        }),
    );
  if ($("report-task-filter"))
    $("report-task-filter").onchange = (event) => {
      state.reportTask = event.target.value;
      state.reportEdit = null;
      renderScreen();
    };
  $("screen")
    .querySelectorAll("[data-open-event]")
    .forEach((button) => {
      button.onclick = () => openEvent(button.dataset.openEvent);
    });
  $("screen")
    .querySelectorAll("[data-report-edit]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          state.reportEdit = Number(button.dataset.reportEdit);
          renderScreen();
          ($("entry-project-search") || $("entry-project"))?.focus();
        }),
    );
  $("screen")
    .querySelectorAll("[data-save-entry]")
    .forEach(
      (button) =>
        (button.onclick = () => saveEntry(Number(button.dataset.saveEntry))),
    );
  if ($("cancel-entry"))
    $("cancel-entry").onclick = () => {
      state.reportEdit = null;
      renderScreen();
    };
}
function adaptStaticTasks(root) {
  root.querySelectorAll(".review-row").forEach((el) => {
    const name = el.querySelector("strong")?.textContent.trim();
    const task = tasks.find((t) => t.title === name);
    if (task) el.outerHTML = row(task);
  });
  root.querySelectorAll("table tbody tr").forEach((tr) => {
    const name = tr.cells[0]?.textContent.trim();
    const task = tasks.find((t) => t.title === name);
    if (task)
      tr.cells[0].innerHTML = `<div class="report-task-cell"><span>${esc(task.title)}</span><button class="icon-btn report-task-detail" data-detail="${task.id}" aria-label="Details for ${esc(task.title)}">${svg("details")}</button></div>`;
  });
  root
    .querySelectorAll("form")
    .forEach((f) => (f.onsubmit = (e) => e.preventDefault()));
}
function applyInline() {
  const { id, field } = state.inline;
  const task = getTask(id),
    value = $("inline-value").value;
  if (
    field === "estimate" &&
    value &&
    (Number(value) <= 0 || Number(value) > 100000)
  )
    return notify("Choose a positive estimate in minutes.");
  task[field] = field === "estimate" ? (value ? Number(value) : null) : value;
  if (field === "project")
    state.sessions
      .filter((s) => s.id === task.id)
      .forEach((s) => (s.project = value));
  if (field === "date") task.today = value === calmToday();
  const rows=[...$("screen").querySelectorAll("[data-row]")], index=rows.findIndex(row=>row.dataset.row===id);
  state.inline = null;
  renderScreen();
  const remaining=[...$("screen").querySelectorAll("[data-row]")], target=remaining.find(row=>row.dataset.row===id)||remaining[Math.min(Math.max(0,index),remaining.length-1)]||$("task-filter");
  target?.focus();
  notify(field === "project" && value ? "Moved to " + value : "Task updated.");
}
function startTask(id, { fromTray = false } = {}) {
  if (state.view !== "track" && !fromTray) return;
  const task = getTask(id);
  if (!task || task.done) return;
  if (state.active === id) {
    state.running = true;
    renderScreen();
    return;
  }
  if (state.active) recordSession();
  task.today = task.date === calmToday() || task.today;
  state.active = id;
  state.seconds = 0;
  state.sessionStartMinute = state.nowMinute;
  state.sessionDate = calmToday();
  state.sessionEstimate = task.estimate;
  state.running = true;
  state.pickerQuery = "";
  renderScreen();
}
function recordSession() {
  if (!state.active) return;
  const task = getTask(state.active),
    endMinute = state.nowMinute,
    duration = state.seconds / 60;
  const session = {
    id: task.id,
    title: task.title,
    project: task.project,
    date: calmToday(),
    start: timeString(state.sessionStartMinute),
    end: timeString(endMinute),
    startMinute: state.sessionStartMinute,
    endMinute,
    focusedSeconds: state.seconds,
    duration,
    estimate: state.sessionEstimate ?? task.estimate,
    recorded: true,
  };
  state.sessions.push(session);
  task.actual = session;
}
function taskHasRecordedOrEstimate(task, pendingSeconds = 0) {
  if (!task) return false;
  if (pendingSeconds > 0) return true;
  if (realSessions(task).some((session) => (Number(session.duration) || 0) > 0)) return true;
  return (Number(task.estimate) || 0) > 0 || (Number(task.planMinutes) || 0) > 0;
}
function applyEstimate(task, length) {
  task.estimate = length;
  task.planMinutes = length;
  const input = document.querySelector('#drawer [name="estimate"]');
  if (input && state.drawerTask === task.id) input.value = String(length);
  for (const session of state.sessions) {
    if (session.id !== task.id || session.source !== "plan") continue;
    const start = session.startMinute ?? minutes(session.start);
    const end = Math.min(1440, start + Math.round(length));
    session.endMinute = end;
    session.end = timeString(end);
    session.duration = Math.max(0, end - start);
    session.focusedSeconds = session.duration * 60;
    session.estimate = length;
  }
}
function closeTimePrompt(restore = true) {
  $("time-overlay").hidden = true;
  state.pendingComplete = null;
  if (restore && state.timePromptFocus?.isConnected) state.timePromptFocus.focus();
}
function askForEstimate(task, resume) {
  state.pendingComplete = { id: task.id, resume };
  state.timePromptFocus = document.activeElement;
  $("time-overlay").hidden = false;
  $("time-overlay-minutes").value = "";
  $("time-overlay-minutes").focus();
  notify("This task needs recorded time or an estimate.");
}
function saveTimePrompt() {
  const pending = state.pendingComplete;
  const minutes = Number($("time-overlay-minutes").value);
  if (!pending || !(minutes > 0) || minutes > 100000) {
    notify("Enter the minutes for this estimate.");
    $("time-overlay-minutes").focus();
    return;
  }
  const task = getTask(pending.id);
  const resume = pending.resume;
  applyEstimate(task, minutes);
  closeTimePrompt(false);
  resume?.();
}
function markTaskDone(task) {
  if (!task || task.done) return;
  const id = task.id;
  if (state.active === id) {
    if (state.seconds > 0) recordSession();
    state.active = null;
    state.seconds = 0;
    state.running = false;
  }
  task.done = true;
  adoptPlannedTime(task, true);
  if (state.drawerTask === id && $("detail-complete")) {
    $("detail-complete").checked = true;
    if (state.drawerBaseline) {
      const baseline = JSON.parse(state.drawerBaseline);
      baseline.forEach((field) => {
        if (field[0] === "detail-complete") field[2] = true;
      });
      state.drawerBaseline = JSON.stringify(baseline);
    }
  }
  renderScreen();
}
function finishTask() {
  if (!state.active) return;
  const task = getTask(state.active);
  if (!taskHasRecordedOrEstimate(task, state.seconds)) {
    askForEstimate(task, finishTask);
    return;
  }
  markTaskDone(task);
  $("screen").focus();
  notify(realSessions(task).length ? "Task completed; actual time is in Reports." : "Estimate saved. Plan uses that time.");
}
$("time-overlay-save").onclick = saveTimePrompt;
$("time-overlay-cancel").onclick = () => closeTimePrompt();
$("time-overlay-minutes").onkeydown = (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveTimePrompt();
  }
};
function saveTimeZones() {
  const inputs = [...document.querySelectorAll("#timezone-section .tz-zone")];
  if (!inputs.length) return;
  state.extraTimeZones = inputs.map((input) => input.value.trim()).slice(0, 3);
  try { localStorage.setItem("calm-time-zones", JSON.stringify(state.extraTimeZones)); } catch {}
}
function moveTaskToToday(id) {
  const task = getTask(id);
  if (!task || task.done || task.date === calmToday()) return;
  task.today = true;
  task.date = calmToday();
  task.schedule = "";
  task.actual = null;
  renderScreen();
  notify("Added to today.");
}
function bindTrackSwipe() {
  if (!isPhoneUi()) return;
  $("screen").querySelectorAll(".swipe-host").forEach((host) => {
    const row = host.querySelector(".task-row");
    let startX = 0, startY = 0, dx = 0, dragging = false, pointer = null;
    host.onpointerdown = (event) => {
      if (event.button !== 0 || event.target.closest("button,input,textarea,select,a")) return;
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      dx = 0;
      dragging = false;
    };
    host.onpointermove = (event) => {
      if (event.pointerId !== pointer) return;
      const moveX = event.clientX - startX;
      const moveY = event.clientY - startY;
      if (!dragging) {
        if (Math.abs(moveX) < 10 && Math.abs(moveY) < 10) return;
        if (Math.abs(moveY) > Math.abs(moveX)) {
          pointer = null;
          return;
        }
        dragging = true;
        host.classList.add("is-dragging");
        host.setPointerCapture?.(event.pointerId);
      }
      dx = moveX;
      if (dx > 0 && host.dataset.canToday !== "1") dx = Math.min(dx, 0);
      if (dx < 0 && host.dataset.canTrack !== "1") dx = Math.max(dx, 0);
      dx = Math.max(-160, Math.min(160, dx));
      row.style.transform = `translateX(${dx}px)`;
      host.classList.toggle("show-today", dx > 20);
      host.classList.toggle("show-track", dx < -20);
    };
    const end = (event) => {
      if (event.pointerId !== pointer && pointer !== null) return;
      const acted = dragging && Math.abs(dx) >= 72;
      pointer = null;
      dragging = false;
      host.classList.remove("is-dragging", "show-today", "show-track");
      row.style.transform = "";
      if (!acted) return;
      state.suppressRowClickUntil = Date.now() + 500;
      if (dx < 0) startTask(host.dataset.swipe);
      else moveTaskToToday(host.dataset.swipe);
      dx = 0;
    };
    host.onpointerup = end;
    host.onpointercancel = end;
  });
}
function zoneClock(timeZone, minute) {
  const when = new Date();
  when.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(when);
  return `${timeZone.split("/").pop().replaceAll("_", " ")} ${time}`;
}
function zoneTip() {
  let tip = document.getElementById("zone-tip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "zone-tip";
    tip.className = "zone-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}
function hideZoneTip() {
  const tip = document.getElementById("zone-tip");
  if (tip) tip.hidden = true;
}
function bindZoneHover() {
  const axis = $("screen").querySelector(".time-axis");
  if (!axis || isPhoneUi()) return;
  const zones = (state.extraTimeZones || []).map((zone) => String(zone || "").trim()).filter(Boolean).slice(0, 3);
  axis.onpointermove = (event) => {
    if (!zones.length) return hideZoneTip();
    const minute = Math.max(0, Math.min(1439, Math.round(calendarMinuteAt(event.clientY - axis.getBoundingClientRect().top))));
    const lines = zones.flatMap((zone) => {
      try { return [zoneClock(zone, minute)]; } catch { return []; }
    });
    if (!lines.length) return hideZoneTip();
    const tip = zoneTip();
    tip.innerHTML = `<strong>${timeString(minute)}</strong><span>${lines.map(esc).join("<br>")}</span>`;
    tip.hidden = false;
    const width = tip.offsetWidth || 160;
    tip.style.left = Math.max(8, Math.min(innerWidth - width - 8, event.clientX + 14)) + "px";
    tip.style.top = Math.max(8, event.clientY + 16) + "px";
  };
  axis.onpointerleave = hideZoneTip;
}
function clock(seconds) {
  return (
    String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, "0") +
    ":" +
    String(Math.floor(Math.max(0, seconds)) % 60).padStart(2, "0")
  );
}
function field(label, name, value, type = "text", attention = false) {
  return `<label class="field ${attention ? "needs-attention" : ""}"><span>${label}${attention ? " · missing" : ""}</span><input name="${name}" type="${type}" ${type === "number" ? 'min="0.001" step="any" max="100000" inputmode="decimal"' : ""} value="${esc(value)}"></label>`;
}
function drawerValues() {
  return JSON.stringify(
    [...$("drawer-content").querySelectorAll("input,select,textarea")].map(
      (el) => [el.id || el.name, el.value, el.checked],
    ),
  );
}
function guardDrawerChange(action) {
  if (
    $("drawer").hidden ||
    state.drawerBaseline == null ||
    state.drawerBaseline === drawerValues()
  )
    return false;
  const prompt = $("drawer-discard");
  prompt.hidden = false;
  $("keep-editing").onclick = () => {
    prompt.hidden = true;
    (
      $("drawer-content").querySelector(
        "input:not([hidden]),textarea,select:not([hidden])",
      ) || $("close-drawer")
    ).focus();
  };
  $("discard-edits").onclick = () => {
    state.drawerBaseline = drawerValues();
    prompt.hidden = true;
    action();
  };
  $("keep-editing").focus();
  return true;
}
function activeModal() {
  return [$("time-overlay"), $("add-overlay"), $("help-overlay")].find((el) => el && !el.hidden);
}
function drawerFieldError(input, message) {
  const id = (input.id || input.name) + "-error";
  let error = $(id);
  if (!error) {
    error = document.createElement("small");
    error.id = id;
    error.className = "field-error";
    error.setAttribute("role", "alert");
    input.closest(".field").append(error);
  }
  error.textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.setAttribute("aria-describedby", id);
  input.focus();
}
function clearDrawerErrors() {
  $("drawer-content")
    .querySelectorAll("[aria-invalid]")
    .forEach((input) => {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    });
  $("drawer-content")
    .querySelectorAll(".field-error")
    .forEach((el) => el.remove());
}
function openDrawer(title, content) {
  state.drawerReturnFocus = document.activeElement;
  state.drawerReturnTask =
    state.drawerReturnFocus.closest("[data-row]")?.dataset.row;
  state.drawerBaseline = null;
  $("drawer-discard").hidden = true;
  $("drawer-heading").textContent = title;
  $("drawer-content").innerHTML = content;
  $("drawer-save").hidden = true;
  $("drawer").hidden = false;
  updateBackButton();
  paintIcons($("drawer"));
  $("close-drawer").focus();
  const contentNode = $("drawer-content").firstElementChild;
  queueMicrotask(() => {
    if (contentNode === $("drawer-content").firstElementChild)
      state.drawerBaseline = drawerValues();
  });
}
function closeDrawer(restore = true) {
  if ($("drawer").hidden) return;
  if (restore && guardDrawerChange(() => closeDrawer(restore))) return;
  const focusWasInside = $("drawer").contains(document.activeElement);
  $("drawer-discard").hidden = true;
  state.drawerBaseline = null;
  $("drawer").hidden = true;
  state.calendarSlotEnd = null;
  updateBackButton();
  state.drawerTask = null;
  if (focusWasInside)
    queueMicrotask(() => {
      const origin = state.drawerReturnFocus;
      const row = [...$("screen").querySelectorAll("[data-row]")].find(
        (el) => el.dataset.row === state.drawerReturnTask,
      );
      const target =
        origin?.isConnected &&
        origin !== document.body &&
        origin !== document.documentElement &&
        origin.getClientRects().length
          ? origin
          : row || $("screen");
      if (!activeModal() && $("drawer").hidden) target.focus();
    });
}
function openTask(id, expand = false) {
  const task = getTask(id);
  if (task)
    taskEditor(task, {
      expand,
      highlightPlanned:
        state.view === "project-board" && task.date && !task.schedule,
    });
}
function openStaticDrawer(key) {
  if (key === "export") return reportExportDrawer();
  if (["project-settings", "project-notes"].includes(key))
    return projectEditor(false, key === "project-notes");
  const labels = {
    "booking-edit": "Intro call",
    "booking-availability": "Availability",
    "booking-rules": "Booking rules",
    "booking-questions": "Attendee questions",
    "booking-manage": "Booking details",
    "project-notes": "Project notes",
    "project-settings": "Project settings",
    members: "Team members",
    export: "Export report",
    restore: "Restore backup",
    "poll-edit": "Poll details",
  };
  const label =
    labels[key] || reviewItems.find((v) => v.key === key)?.title || key;
  openDrawer(label, staticViews[key]);
  const oldHead = $("drawer-content").querySelector(".review-head");
  if (oldHead) {
    const actionButtons = [...oldHead.querySelectorAll("button")];
    if (actionButtons.length) {
      const actionBar = document.createElement("div");
      actionBar.className = "actions";
      actionButtons.forEach((button) => actionBar.append(button));
      $("drawer-content").append(actionBar);
    }
    oldHead.remove();
  }
  $("drawer-content")
    .querySelectorAll("form")
    .forEach((f) => (f.onsubmit = (e) => e.preventDefault()));
}
function openBlock(id) {
  if (id && getTask(id)) openTask(id);
  else if (state.planSelectedTask) {
    placePlanTask(state.planSelectedTask);
    state.planSelectedTask = null;
  } else openCalendarCreate();
}
function openSession(id) {
  state.view = "reports";
  state.reportMode = "entries";
  state.reportTask = id;
  state.reportEdit = state.sessions.findIndex((session) => session.id === id);
  $("screen-title").textContent = "Reports";
  renderScreen();
  $("screen").querySelector("[name=entry-date]")?.focus();
}
function openEvent(id) {
  const event = allEvents().find((item) => item.id === id);
  if (!event) return;
  if (isEditableProviderEvent(event)) openProviderEvent(event);
  else eventEditor(event);
}
function openAdd() {
  state.lastFocus = document.activeElement;
  if (!state.addDraftActive)
    state.add = {
      project: ["project", "project-board"].includes(state.view)
        ? calmSelectedProject()
        : "",
      schedule: "",
      time: "",
      estimate: "",
      repeat: "",
    };
  state.addField = null;
  state.addDraftActive = true;
  $("add-title").value = state.addTitle;
  $("add-field").hidden = true;
  $("add-overlay").classList.toggle(
    "mobile-add",
    state.surface === "mobile" ||
      document.body.dataset.phoneFocus === "true" ||
      window.matchMedia("(max-width: 600px)").matches,
  );
  $("add-overlay").hidden = false;
  updateAddLabels();
  $("add-title").focus();
}
function closeAdd() {
  if ($("add-overlay").hidden) return;
  state.addTitle = $("add-title").value;
  $("add-overlay").hidden = true;
  state.lastFocus?.isConnected && state.lastFocus.focus();
}
function parsedAdd() {
  let title = $("add-title").value;
  let props = { ...state.add };
  const project = title.match(/\+([\w-]+)/);
  if (project) {
    const p = projects.find(
      (p) =>
        projectToken(p).toLowerCase() === project[1].toLowerCase() ||
        p.toLowerCase().includes(project[1].toLowerCase()) ||
        (project[1].toLowerCase() === "launch" && p === "Product launch"),
    );
    if (p) {
      props.project = p;
      title = title.replace(project[0], "");
    }
  }
  const repeat = title.match(/@every\s+(weekday|friday|day|week|month)/i);
  if (repeat) {
    props.repeat = "Every " + repeat[1];
    title = title.replace(repeat[0], "");
  }
  const schedules = [
    ...title.matchAll(/@(\d{1,2}:\d{2}|today|tomorrow|\d{4}-\d{2}-\d{2})/g),
  ];
  for (const schedule of schedules) {
    if (/^\d{1,2}:/.test(schedule[1]))
      props.time = schedule[1].padStart(5, "0");
    else props.schedule = schedule[1];
    title = title.replace(schedule[0], "");
  }
  const estimate = title.match(/\bt(\d+)m\b/);
  if (estimate) {
    props.estimate = estimate[1];
    title = title.replace(estimate[0], "");
  }
  return { title: title.trim().replace(/\s+/g, " "), ...props };
}
function updateAddLabels() {
  const value = parsedAdd();
  $("add-project-label").textContent = value.project || "Project";
  const timeOnly = /^\d{1,2}:\d{2}$/.test(value.schedule);
  const plannedTime = value.time || (timeOnly ? value.schedule.padStart(5, "0") : "");
  const day = timeOnly || (!value.schedule && plannedTime) || value.schedule === "today" || value.schedule === calmToday()
    ? "Today" : value.schedule === "tomorrow" || value.schedule === calmTomorrow()
      ? "Tomorrow" : value.schedule === calmMonday() ? "Next week"
        : calmValidDate(value.schedule) ? shortDay(value.schedule) : value.schedule;
  $("add-schedule-label").textContent =
    [day, plannedTime].filter(Boolean).join(" · ") || "Schedule";
  $("add-estimate-label").textContent = value.estimate
    ? value.estimate + " min"
    : "Estimate";
  $("add-repeat-label").textContent = value.repeat || "Repeat";
  renderAddQuick(value);
  updateCompletion();
}
function shortDay(date) {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
function renderAddQuick(p) {
  const box = $("add-quick");
  const phone = document.body.dataset.phoneFocus === "true";
  box.hidden = !phone;
  $("add-overlay").querySelector(".add-submit").disabled = phone && !p.title;
  if (!phone) return;
  const isTime = /^\d{1,2}:\d{2}$/.test(p.schedule);
  const time = p.time || (isTime ? p.schedule.padStart(5, "0") : "");
  const day =
    p.schedule === "today" || p.schedule === calmToday() || isTime || (time && !p.schedule)
      ? "today"
      : p.schedule === "tomorrow" || p.schedule === calmTomorrow()
        ? "tomorrow"
        : calmValidDate(p.schedule)
          ? "date"
          : "";
  const minutes = Number(p.estimate) || 0;
  const chip = (attr, value, label, on) =>
    `<button type="button" class="add-chip" ${attr}="${value}" aria-pressed="${on}">${label}</button>`;
  const picker = (id, type, label, value, on, aria) =>
    `<label class="add-chip add-chip-picker" data-on="${on}"><span>${label}</span><input id="${id}" type="${type}" value="${esc(value)}" aria-label="${aria}"></label>`;
  box.innerHTML =
    `<div class="add-quick-row" role="group" aria-label="Day">` +
    chip("data-quick-day", "today", "Today", day === "today") +
    chip("data-quick-day", "tomorrow", "Tomorrow", day === "tomorrow") +
    chip("data-quick-day", calmMonday(), "Next week", p.schedule === calmMonday()) +
    picker("add-quick-date", "date", day === "date" ? shortDay(p.schedule) : "Date", day === "date" ? p.schedule : "", day === "date", "Pick a day") +
    chip("data-quick-day", "", "No date", !day && !time) +
    `</div><div class="add-quick-row" role="group" aria-label="Time and length">` +
    picker("add-quick-time", "time", time || "Time", time, Boolean(time), "Start time") +
    [15, 30, 60]
      .map((m) => chip("data-quick-estimate", m, m === 60 ? "1 h" : m + " min", minutes === m))
      .join("") +
    chip("data-quick-estimate", "other", minutes && ![15, 30, 60].includes(minutes) ? minutes + " min" : "Other", Boolean(minutes) && ![15, 30, 60].includes(minutes)) +
    `</div>`;
  $("add-quick-date").onchange = (e) => e.target.value && chooseAddDate(e.target.value);
  $("add-quick-time").onchange = (e) => {
    if (isTime) setAddField("schedule", "today");
    $("add-title").value = $("add-title").value.replace(/@\d{1,2}:\d{2}/, "");
    state.add.time = e.target.value;
    updateAddLabels();
  };
}
$("add-quick").onpointerdown = (e) => {
  if (e.target.closest("button.add-chip")) e.preventDefault();
};
$("add-quick").onclick = (e) => {
  const dayChip = e.target.closest("[data-quick-day]");
  const estimateChip = e.target.closest("[data-quick-estimate]");
  if (dayChip) {
    chooseAddDate(dayChip.dataset.quickDay);
  } else if (estimateChip) {
    const value = estimateChip.dataset.quickEstimate;
    if (value === "other") return showAddField("estimate");
    setAddField("estimate", state.add.estimate === value && estimateChip.getAttribute("aria-pressed") === "true" ? "" : value);
  }
};
function chooseAddDate(value) {
  const p = parsedAdd();
  const time = p.time || (/^\d{1,2}:\d{2}$/.test(p.schedule) ? p.schedule.padStart(5, "0") : "");
  $("add-title").value = $("add-title").value.replace(/@(\d{1,2}:\d{2}|today|tomorrow|\d{4}-\d{2}-\d{2})/g, "");
  state.add.schedule = value;
  state.add.time = value ? time : "";
  updateAddLabels();
}
function closeAddField() {
  $("add-field").hidden = true;
  $("add-title").focus();
}
function showAddField(fieldName) {
  state.addField = fieldName;
  const p = parsedAdd();
  $("add-field").hidden = false;
  if (fieldName === "project")
    $("add-field").innerHTML =
      `<div class="field"><label for="add-field-value-search">Project</label>${projectField("add-field-value", p.project)}</div>`;
  else if (fieldName === "repeat")
    $("add-field").innerHTML =
      `<label class="field"><span>Repeat</span><select id="add-field-value"><option value="">Does not repeat</option><option>Every day</option><option>Every weekday</option><option>Every friday</option><option>Every week</option><option>Every month</option></select></label>`;
  else
    $("add-field").innerHTML =
      `<div class="add-field-presets" role="group" aria-label="${fieldName === "estimate" ? "Estimate presets" : "Date suggestions"}">${fieldName === "estimate"
        ? [15, 25, 30, 60, 90].map(n => `<button class="quiet" type="button" data-add-estimate="${n}" aria-pressed="${Number(p.estimate) === n}">${n < 60 ? n + " min" : n === 60 ? "1 h" : "1 h 30"}</button>`).join("") + '<button class="quiet" type="button" data-add-estimate="">No estimate</button>'
        : [["today", "Today"], ["tomorrow", "Tomorrow"], [calmMonday(), "Next week"], ["", "No date"]].map(([value, label]) => `<button class="quiet" type="button" data-add-day="${value}" aria-pressed="${p.schedule === value || (value === "today" && p.schedule === calmToday()) || (value === "tomorrow" && p.schedule === calmTomorrow())}">${label}</button>`).join("")}</div>${fieldName === "schedule" ? `<div class="add-schedule-options"><label class="field"><span>Calendar</span><input id="add-calendar-date" type="date" value="${calmValidDate(p.schedule) ? p.schedule : p.schedule === "today" ? calmToday() : p.schedule === "tomorrow" ? calmTomorrow() : ""}"></label><label class="field"><span>Start time (optional)</span><input id="add-calendar-time" type="time" value="${esc(p.time || (/^\d{1,2}:\d{2}$/.test(p.schedule) ? p.schedule.padStart(5, "0") : ""))}"></label></div>` : ""}<label class="field"><span>${fieldName === "estimate" ? "Custom estimate (minutes)" : "Or type a date or time"}</span><input id="add-field-value" value="${esc(p[fieldName])}" ${fieldName === "estimate" ? 'type="number" inputmode="decimal" enterkeyhint="done" min="0.001" max="100000" step="any"' : 'placeholder="16:00" enterkeyhint="done"'}></label>`;
  $("add-field").querySelectorAll("[data-add-day]").forEach(button => button.onclick = () => {
    chooseAddDate(button.dataset.addDay);
    showAddField("schedule");
  });
  $("add-field").querySelectorAll("[data-add-estimate]").forEach(button => button.onclick = () => {
    $("add-field-value").value = button.dataset.addEstimate;
    setAddField("estimate", button.dataset.addEstimate);
    closeAddField();
  });
  if ($("add-calendar-date")) $("add-calendar-date").onchange = e => {
    chooseAddDate(e.target.value);
    showAddField("schedule");
  };
  if ($("add-calendar-time")) $("add-calendar-time").onchange = e => {
    const value = parsedAdd();
    chooseAddDate(value.schedule && !/^\d{1,2}:\d{2}$/.test(value.schedule) ? value.schedule : "today");
    state.add.time = e.target.value;
    updateAddLabels();
  };
  if (fieldName === "repeat") $("add-field-value").value = p.repeat || "";
  bindProjectPicker("add-field-value");
  ($("add-field-value-search") || $("add-field-value")).focus();
  $("add-field-value").onchange = (e) => {
    setAddField(fieldName, e.target.value);
  };
  $("add-field-value").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setAddField(fieldName, e.target.value);
      $("add-field").hidden = true;
      $("add-title").focus();
    }
  };
}
function setAddField(fieldName, value) {
  if (fieldName === "schedule") {
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const p = parsedAdd();
      chooseAddDate(p.schedule && !/^\d{1,2}:\d{2}$/.test(p.schedule) ? p.schedule : "today");
      state.add.time = value.padStart(5, "0");
      updateAddLabels();
    } else chooseAddDate(value);
    return;
  }
  const patterns = {
    project: /\+[\w-]+/,
    schedule: /@(\d{1,2}:\d{2}|today|tomorrow|\d{4}-\d{2}-\d{2})/,
    estimate: /\bt\d+m\b/,
    repeat: /@every\s+(weekday|friday|day|week|month)/i,
  };
  $("add-title").value = $("add-title").value.replace(patterns[fieldName], "");
  state.add[fieldName] = value;
  updateAddLabels();
}
$("add-title").oninput = updateAddLabels;
$("add-form").onsubmit = (e) => {
  e.preventDefault();
  const p = parsedAdd();
  if (!p.title) {
    $("add-title").focus();
    return;
  }
  const isTime = /^\d{1,2}:\d{2}$/.test(p.schedule);
  if (
    p.schedule &&
    !isTime &&
    !["today", "tomorrow"].includes(p.schedule) &&
    !calmValidDate(p.schedule)
  )
    return notify("Choose today, tomorrow, a valid date or HH:MM.");
  const plannedTime = p.time || (isTime ? p.schedule.padStart(5, "0") : "");
  if (plannedTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(plannedTime))
    return notify("Choose a time between 00:00 and 23:59.");
  if (p.estimate && (Number(p.estimate) <= 0 || Number(p.estimate) > 100000))
    return notify("Choose a positive estimate in minutes.");
  const date =
    isTime || (!p.schedule && plannedTime) || p.schedule === "today"
      ? calmToday()
      : p.schedule === "tomorrow"
        ? calmTomorrow()
        : /^\d{4}-\d{2}-\d{2}$/.test(p.schedule)
          ? p.schedule
          : "";
  const task = {
    id: "new-" + Date.now(),
    title: p.title,
    project: p.project,
    estimate: Number(p.estimate) || null,
    schedule: plannedTime,
    date,

    today: date === calmToday(),
    done: false,
    repeat: p.repeat,
  };
  tasks.push(task);
  closeAdd();
  state.addTitle = "";
  state.addDraftActive = false;
  state.add = { project: "", schedule: "", time: "", estimate: "", repeat: "" };
  $("add-title").value = "";
  renderScreen();
  notify(task.project ? "Added to " + task.project + "." : "Added to Inbox.");
};
$("add-overlay")
  .querySelectorAll("[data-add-field]")
  .forEach((b) => (b.onclick = () => showAddField(b.dataset.addField)));
$("global-add").onclick = openAdd;
$("phone-add").onclick = () => {
  openAdd();
  // A task added on the phone is for today unless a date is chosen, so Track can start it.
  if (
    (document.body.dataset.phoneFocus === "true" || state.surface === "mobile") &&
    !state.add.schedule &&
    !$("add-title").value
  ) {
    state.add.schedule = "today";
    updateAddLabels();
  }
};
$("close-add").onclick = closeAdd;
$("close-drawer").onclick = () => closeDrawer();
$("collapse-nav").onclick = () => {
  const closed = $("app").classList.toggle("nav-collapsed");
  $("collapse-nav").setAttribute("aria-expanded", String(!closed));
  $("collapse-nav").setAttribute(
    "aria-label",
    closed ? "Expand navigation" : "Collapse navigation",
  );
};
function closeMobileMenu(restore = false) {
  $("mobile-menu").hidden = true;
  $("mobile-more").setAttribute("aria-expanded", "false");
  if (restore) $("mobile-more").focus();
}
$("mobile-more").onclick = () => {
  const open = $("mobile-menu").hidden;
  $("mobile-menu").hidden = !open;
  $("mobile-more").setAttribute("aria-expanded", String(open));
  if (open) $("mobile-menu").querySelector("button").focus();
};
$("mobile-menu").onclick = (event) => {
  const button = event.target.closest("[data-show]");
  if (button) {
    event.stopPropagation();
    closeMobileMenu();
    show(button.dataset.show, { preserveSurface: true });
    $("screen").focus();
  }
};
$("mobile-menu").onkeydown = (event) => {
  const buttons = [...$("mobile-menu").querySelectorAll("button")];
  const index = buttons.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
    event.preventDefault();
    event.stopPropagation();
    buttons[
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length
    ].focus();
  }
};
document.addEventListener(
  "keydown",
  (event) => {
    if (!$("mobile-menu").hidden && ["Escape", "Tab"].includes(event.key)) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      closeMobileMenu(true);
    }
  },
  true,
);
document.addEventListener("click", (event) => {
  if (!event.target.closest("#mobile-nav")) closeMobileMenu();
});
$("review-picker").onchange = (e) => show(e.target.value);
function help() {
  const bindings = [
    ["Global task bar", "Shift+A"],
    ["Accept typed suggestion", "Tab"],
    ["Filter this view", "/"],
    ["Select a task", "↑ ↓ or J K"],
    ["Track: start selected task", "Enter / Space"],
    ["Open task details", "I"],
    ["Save sidebar edits", "Ctrl/Cmd+Enter"],
    ["Complete selected task", "Ctrl/Cmd+Enter outside sidebar"],
    ["Reorder tasks with the same time", "Alt+↑ ↓"],
    ["Plan: select time grid", "→ from task list"],
    ["Plan: move time/day", "↑ ↓ ← →"],
    ["Place selected task / new item", "Enter on calendar"],
    ["Calendar day / week", "D / W"],
    ["Close current panel", "Escape"],
    ["Back to previous view", "Alt+Left"],
  ];
  $("help-content").innerHTML = bindings
    .map(
      ([label, key]) =>
        `<div class="help-row"><span>${label}</span><kbd>${key}</kbd></div>`,
    )
    .join("");
  state.lastFocus = document.activeElement;
  $("help-overlay").hidden = false;
  $("close-help").focus();
}
$("shortcut-help").onclick = help;
$("close-help").onclick = () => {
  $("help-overlay").hidden = true;
  state.lastFocus?.isConnected && state.lastFocus.focus();
};
function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(state.toastTimeout);
  state.toastTimeout = setTimeout(() => ($("toast").hidden = true), 2800);
}
function updateHints() {
  const hints =
    state.view === "plan"
      ? [
          ["/", "Find task"],
          ["→", "Choose time"],
          ["↑ ↓ ← →", "Move slot"],
          ["Enter", "Place / create"],
        ]
      : state.view === "track"
        ? [
            ["/", "Today’s tasks"],
            ["↑ ↓", "Select"],
            ["Enter", "Start"],
            ["Alt+↑ ↓", "Reorder"],
            ["I", "Details"],
          ]
        : state.view === "reports"
          ? [["Enter", "Edit focused time entry"]]
          : [
              ["↑ ↓", "Select"],
              ["I", "Details"],
              ["Ctrl+Enter", "Complete"],
            ];
  $("key-hints").innerHTML = hints
    .map(([key, label]) => `<span><kbd>${key}</kbd>${label}</span>`)
    .join("");
}
function moveBoardTask(id, target) {
  const task = getTask(id);
  if (!task || !["unplanned", "planned", "done"].includes(target)) return;
  if (target === "done" && !task.done && !taskHasRecordedOrEstimate(task, state.active === task.id ? state.seconds : 0)) {
    askForEstimate(task, () => moveBoardTask(id, target));
    return;
  }
  if (state.active === id && target !== "done")
    return notify("Finish this tracking session before changing its plan.");
  if (target === "done" && state.active === id) {
    recordSession();
    state.active = null;
    state.running = false;
    state.seconds = 0;
  }
  task.done = target === "done";
  if (target === "unplanned") {
    task.date = "";
    task.schedule = "";
    task.actual = null;
  }
  if (target === "planned") {
    if (!task.date || task.date < calmToday()) {
      task.date = calmToday();
      task.schedule = "";
    }
    task.actual = null;
  }
  task.today = task.date === calmToday();
  renderScreen();
  state.selected = id;
  $("screen").querySelector(`[data-row="${id}"]`)?.focus();
}
function reorderTask(id, targetId) {
  const a = tasks.findIndex((t) => t.id === id),
    b = tasks.findIndex((t) => t.id === targetId);
  if (a < 0 || b < 0 || a === b) return;
  if ((tasks[a].schedule || "") !== (tasks[b].schedule || "")) {
    notify("Planned times set the order. Edit a time to move this task.");
    return;
  }
  const [task] = tasks.splice(a, 1);
  tasks.splice(b, 0, task);
  renderScreen();
  state.selected = id;
  $("screen").querySelector(`[data-row="${id}"]`)?.focus();
  notify("Track order changed; scheduled times unchanged.");
}
document.addEventListener("click", (e) => {
  if (!e.target.closest("#day-overflow") && !e.target.closest("[data-day-more]"))
    document.getElementById("day-overflow")?.remove();
  const more = e.target.closest("[data-day-more]");
  if (more) {
    openDayOverflow(Number(more.dataset.dayMore));
    return;
  }
  const start = e.target.closest("[data-start]");
  if (start) {
    startTask(start.dataset.start);
    return;
  }
  const detail = e.target.closest("[data-detail]");
  if (detail) {
    openTask(detail.dataset.detail);
    return;
  }
  const complete = e.target.closest("[data-complete]");
  if (complete) {
    const task = getTask(complete.dataset.complete);
    if (!task.done && !taskHasRecordedOrEstimate(task, state.active === task.id ? state.seconds : 0)) {
      askForEstimate(task, () => {
        markTaskDone(task);
        if (state.drawerTask === task.id) closeDrawer();
        notify("Estimate saved. Plan uses that time.");
      });
      return;
    }
    task.done = !task.done;
    if (task.done && state.active === task.id) {
      recordSession();
      state.active = null;
      state.running = false;
      state.seconds = 0;
    }
    if (task.done) adoptPlannedTime(task);
    else dropPlannedSessions(task);
    renderScreen();
    if (state.drawerTask === task.id) closeDrawer();
    return;
  }
  const inline = e.target.closest("[data-inline]");
  if (inline) {
    state.inline = { id: inline.dataset.task, field: inline.dataset.inline };
    renderScreen();
    ($("inline-value-search") || $("inline-value")).focus();
    return;
  }
  const move = e.target.closest("[data-today]");
  if (move) {
    moveTaskToToday(move.dataset.today);
    return;
  }
  if (state.suppressRowClickUntil > Date.now()) {
    state.suppressRowClickUntil = 0;
    return;
  }
  const row = e.target.closest("#screen [data-row]");
  if (
    row &&
    (matchMedia("(pointer: coarse)").matches || isPhoneUi()) &&
    !e.target.closest("button,input,select,textarea,label,a,[data-inline]")
  ) {
    openTask(row.dataset.row);
    return;
  }
  const open = e.target.closest("[data-show],[data-open]");
  if (open) {
    show(open.dataset.show || open.dataset.open, {
      preserveSurface: Boolean(open.closest("#mobile-nav")),
    });
    return;
  }
  const event = e.target.closest("[data-event]");
  if (event?.dataset.resized || e.target.closest(".event-resize")) return;
  if (event) {
    document.getElementById("day-overflow")?.remove();
    openEvent(event.dataset.event);
    return;
  }
  const session = e.target.closest("[data-session]");
  if (session) {
    openSession(session.dataset.session);
    return;
  }
  const block = e.target.closest("[data-calendar-task]");
  if (block?.dataset.resized || e.target.closest(".event-resize")) return;
  if (block) {
    const task = getTask(block.dataset.calendarTask);
    state.calendarSlot = {
      day: calmDayIndex(task.date || calmToday()),
      minute: task.schedule ? minutes(task.schedule) : 660,
    };
    openBlock(task.id);
    return;
  }
  if (e.target === $("add-overlay")) closeAdd();
  if (e.target === $("help-overlay")) $("help-overlay").hidden = true;
});
function focusRow(direction) {
  const context =
    !$("drawer").hidden && $("drawer").contains(document.activeElement)
      ? $("drawer")
      : $("screen");
  const all = [...context.querySelectorAll("[data-row]")].filter(
    (el) => el.getClientRects().length,
  );
  if (!all.length) return;
  let index = all.findIndex((el) => el.dataset.row === state.selected);
  index = Math.max(0, Math.min(all.length - 1, index + direction));
  state.selected = all[index].dataset.row;
  all.forEach((el) =>
    el.classList.toggle("selected", el.dataset.row === state.selected),
  );
  all[index].focus();
}
document.addEventListener("keydown", (e) => {
  const input = e.target.matches("input,textarea,select");
  const dialog = activeModal();
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key === "Enter" &&
    !$("drawer").hidden &&
    !$("drawer-save").hidden &&
    !dialog
  ) {
    e.preventDefault();
    $("drawer-save").click();
    return;
  }
  if (dialog && e.key === "Tab") {
    const focusable = [
      ...dialog.querySelectorAll("button,input,select,textarea"),
    ].filter((el) => el.getClientRects().length);
    const first = focusable[0],
      last = focusable.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (dialog) {
      if (dialog.id === "add-overlay") closeAdd();
      else if (dialog.id === "time-overlay") closeTimePrompt();
      else {
        $("help-overlay").hidden = true;
        state.lastFocus?.focus();
      }
    } else if (!$("drawer").hidden) closeDrawer();
    else if (state.inline) {
      state.inline = null;
      renderScreen();
    } else if (e.target.matches(".list-filter,.filter") && e.target.value) {
      e.target.value = "";
      e.target.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (input) e.target.blur();
    return;
  }
  if (state.surface === "public") return;
  if (!input && e.shiftKey && e.key.toLowerCase() === "a") {
    e.preventDefault();
    openAdd();
    return;
  }
  if (dialog) return;
  if (
    e.target.matches(".list-filter,.filter") &&
    ["ArrowDown", "ArrowUp"].includes(e.key)
  ) {
    e.preventDefault();
    focusRow(e.key === "ArrowDown" ? 1 : -1);
    return;
  }
  if (input) return;
  if (
    state.view === "project-board" &&
    e.altKey &&
    ["ArrowLeft", "ArrowRight"].includes(e.key) &&
    e.target.closest("[data-row]")
  ) {
    e.preventDefault();
    const task = getTask(e.target.closest("[data-row]").dataset.row);
    const keys = ["unplanned", "planned", "done"],
      index = task.done ? 2 : task.date ? 1 : 0;
    moveBoardTask(
      task.id,
      keys[Math.max(0, Math.min(2, index + (e.key === "ArrowRight" ? 1 : -1)))],
    );
    return;
  }
  if (e.key === "Enter" && e.target.closest(".event-row")) {
    e.preventDefault();
    openEvent(e.target.closest(".event-row").dataset.event);
    return;
  }
  if (e.key === "Enter" && e.target.closest("[data-calendar-task]")) {
    e.preventDefault();
    const task = getTask(
      e.target.closest("[data-calendar-task]").dataset.calendarTask,
    );
    state.calendarSlot = {
      day: calmDayIndex(task.date || calmToday()),
      minute: task.schedule ? minutes(task.schedule) : 660,
    };
    openBlock(task.id);
    return;
  }
  if (e.key === "?") {
    e.preventDefault();
    help();
    return;
  }
  if (e.key === "/") {
    e.preventDefault();
    if (state.view === "track") {
      $("picker-search")?.focus();
    } else $("task-filter")?.focus();
    return;
  }
  if (e.target.closest(".day-column") && !e.target.closest(".calendar-block")) {
    const col = e.target.closest(".day-column");
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      state.slotVisible = true;
      state.calendarSlot.day = Number(col.dataset.day);
      if (e.key === "ArrowUp")
        state.calendarSlot.minute = Math.max(0, state.calendarSlot.minute - 30);
      if (e.key === "ArrowDown")
        state.calendarSlot.minute = Math.min(
          1410,
          state.calendarSlot.minute + 30,
        );
      if (e.key === "ArrowLeft")
        state.calendarSlot.day = Math.max(
          state.calendarAnchor,
          state.calendarSlot.day - 1,
        );
      if (e.key === "ArrowRight")
        state.calendarSlot.day = Math.min(
          state.calendarAnchor + state.calendarSpan - 1,
          state.calendarSlot.day + 1,
        );
      showPlanSlot();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      openBlock();
      return;
    }
  }
  if (state.view === "plan" && ["d", "w"].includes(e.key.toLowerCase())) {
    e.preventDefault();
    state.calendarMode = e.key.toLowerCase() === "d" ? "day" : "week";
    renderScreen();
    return;
  }
  if (
    e.altKey &&
    ["ArrowUp", "ArrowDown"].includes(e.key) &&
    state.view === "track" &&
    e.target.matches("[data-row]") &&
    state.selected
  ) {
    e.preventDefault();
    const list = liveToday(),
      i = list.findIndex((t) => t.id === state.selected),
      other = list[i + (e.key === "ArrowUp" ? -1 : 1)];
    if (other) reorderTask(state.selected, other.id);
    return;
  }
  if (["ArrowUp", "ArrowDown", "j", "k"].includes(e.key)) {
    e.preventDefault();
    focusRow(["ArrowDown", "j"].includes(e.key) ? 1 : -1);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && state.selected) {
    e.preventDefault();
    $("screen").querySelector(`[data-complete="${state.selected}"]`)?.click();
    return;
  }
  if (e.key.toLowerCase() === "i") {
    e.preventDefault();
    openTask(state.selected || state.active);
    return;
  }
  if (
    (e.key === " " || e.key === "Enter") &&
    state.view === "track" &&
    e.target.matches("[data-row]") &&
    state.selected
  ) {
    e.preventDefault();
    startTask(state.selected);
  }
});
setInterval(() => {
  if (window.calmRuntimeMode) return;
  state.nowMinute += 1 / 60;
  updateCalendarNow();
  if (state.active && state.running) {
    state.seconds++;
    if ($("header-clock")) $("header-clock").textContent = clock(state.seconds);
    if ($("active-timer")) $("active-timer").textContent = clock(state.seconds);
  }
}, 1000);
paintIcons();
show(location.hash.slice(1) || "track");
document.addEventListener("focusin", (event) => {
  const row = event.target.closest("[data-row]");
  if (row) state.selected = row.dataset.row;
});

function renderGlobalTracker() {
  const add = $("global-add");
  if (state.surface === "mobile") $("app").append(add);
  else document.querySelector(".header-right").append(add);
  const task = getTask(state.active),
    el = $("global-tracker");
  el.hidden = !task || state.surface === "public";
  if (el.hidden) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `<span class="recording-status ${state.running ? "is-recording" : ""}" role="img" aria-label="${state.running ? "Recording" : "Paused"}" title="${state.running ? "Recording" : "Paused"}"></span><button class="header-task-name" data-show="track" title="Open Track">${esc(task.title)}</button><time id="header-clock">${clock(state.seconds)}</time><button class="icon-btn" id="header-pause" aria-label="${state.running ? "Pause" : "Resume"} active tracking" title="${state.running ? "Pause" : "Resume"}">${svg(state.running ? "pause" : "play")}</button><button class="icon-btn" id="header-complete" aria-label="Complete active task" title="Complete task">${svg("check")}</button>`;
  $("header-complete").onclick = finishTask;
  $("header-pause").onclick = () => {
    state.running = !state.running;
    renderScreen();
    $("header-pause")?.focus();
  };
}
function reportInRange(date) {
  return (
    (!state.reportFrom || date >= state.reportFrom) &&
    (!state.reportTo || date <= state.reportTo)
  );
}
function reportProjectMatches(name) {
  const project = name || "";
  if (Array.isArray(state.reportProjects)) return state.reportProjects.includes(project);
  return !state.reportProject || state.reportProject === "all" || project === state.reportProject;
}
function applyReportProjects(select) {
  const values = [...select.selectedOptions].map((option) => option.value);
  const wasAll = !Array.isArray(state.reportProjects);
  let next = null;
  if (values.includes("all") && values.length > 1) next = wasAll ? values.filter((value) => value !== "all") : null;
  else if (!values.includes("all") && values.length) next = values;
  state.reportProjects = next;
  state.reportProject = next ? next[0] : "all";
}
function reportDayParts(session) {
  const daily = session.dailyMs && Object.entries(session.dailyMs);
  return daily?.length
    ? daily.map(([date, ms]) => ({ date, duration: ms / 60000 }))
    : [{ date: session.date || calmToday(), duration: session.duration }];
}
function reportSessions() {
  return state.sessions.filter(
    (session) =>
      matches(session, state.filter) &&
      reportProjectMatches(session.project) &&
      (state.reportMode !== "entries" ||
        state.reportTask === "all" ||
        session.id === state.reportTask) &&
      reportDayParts(session).some((part) => reportInRange(part.date)),
  );
}
function reportEvents() {
  if (state.reportMode === "entries" && state.reportTask !== "all") return [];
  return allEvents().filter((event) => {
    if (!eventMinutes(event)) return false;
    const project = eventProject(event) || "";
    return (
      (!state.filter || matchesEvent(event, state.filter)) &&
      reportProjectMatches(project) &&
      reportInRange(event.date || "")
    );
  });
}
function estimateOnlyTasks() {
  return tasks.flatMap((task) => {
    if (!task.done || realSessions(task).length) return [];
    if (!matches(task, state.filter) || !reportProjectMatches(task.project)) return [];
    if (state.reportMode === "entries" && state.reportTask !== "all" && state.reportTask !== task.id) return [];
    const plan = state.sessions.find((session) => session.id === task.id && session.source === "plan");
    const date = plan?.date || task.date || "";
    if (date ? !reportInRange(date) : state.reportFrom) return [];
    const length = Number(plan?.duration) || Number(task.planMinutes) || Number(task.estimate) || 0;
    return length > 0 ? [{ task, date, length }] : [];
  });
}
function reportSummary() {
  const sessions = reportSessions().filter((session) => session.source !== "plan"),
    groups = new Map(),
    daily = new Map(),
    estimates = new Map();
  for (const session of [...sessions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start),
  )) {
    const parts = reportDayParts(session).filter((part) =>
      reportInRange(part.date),
    );
    if (!estimates.has(session.id) && session.estimate != null)
      estimates.set(session.id, session.estimate);
    for (const part of parts) {
      daily.set(part.date, (daily.get(part.date) || 0) + part.duration);
      const key =
        state.reportGroup === "day"
          ? part.date
          : state.reportGroup === "project"
            ? session.project || "No project"
            : session.id;
      if (!groups.has(key))
        groups.set(key, {
          key,
          title: state.reportGroup === "task" ? session.title : key,
          duration: 0,
          tasks: new Set(),
          estimate: 0,
        });
      const item = groups.get(key);
      item.duration += part.duration;
      item.tasks.add(session.id);
    }
  }
  for (const event of reportEvents()) {
    const project = eventProject(event) || "No project";
    const key =
      state.reportGroup === "day"
        ? event.date
        : state.reportGroup === "project"
          ? project
          : "event:" + event.id;
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: state.reportGroup === "task" ? event.title || "Event" : state.reportGroup === "project" ? project : event.date,
        duration: 0,
        tasks: new Set(),
        estimate: 0,
      });
    const item = groups.get(key);
    if (state.reportGroup === "task") item.title = event.title || "Event";
    item.duration += eventMinutes(event);
    daily.set(event.date, (daily.get(event.date) || 0) + eventMinutes(event));
  }
  const total = [...daily.values()].reduce((a, b) => a + b, 0);
  let planned = 0;
  for (const { task, date, length } of estimateOnlyTasks()) {
    const key =
      state.reportGroup === "day"
        ? date || "No date"
        : state.reportGroup === "project"
          ? task.project || "No project"
          : task.id;
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: state.reportGroup === "task" ? task.title : key,
        duration: 0,
        tasks: new Set(),
        estimate: 0,
      });
    const item = groups.get(key);
    item.planned = (item.planned || 0) + length;
    planned += length;
    if (date) daily.set(date, (daily.get(date) || 0) + length);
  }
  const allocated = new Set();
  for (const item of [...groups.values()].sort((a, b) =>
    state.reportGroup === "day" ? a.key.localeCompare(b.key) : 0,
  )) {
    for (const id of item.tasks) {
      if (allocated.has(id)) continue;
      item.estimate += estimates.get(id) || 0;
      allocated.add(id);
    }
  }
  return {
    groups: [...groups.values()].sort((a, b) => a.title.localeCompare(b.title)),
    daily: [...daily].sort(([a], [b]) => a.localeCompare(b)),
    total,
    planned,
    time: total + planned,
    estimate: [...estimates.values()].reduce((a, b) => a + b, 0),
  };
}
function reportProjectOptions() {
  const names = [
    ...new Set([
      ...projects,
      ...state.sessions.map((session) => session.project),
      ...allEvents().map((event) => eventProject(event)),
      ...tasks.map((task) => task.project),
    ]),
  ].filter((name) => name);
  const chosen = Array.isArray(state.reportProjects)
    ? state.reportProjects
    : state.reportProject && state.reportProject !== "all"
      ? [state.reportProject]
      : ["all"];
  const option = (value, label) =>
    `<option value="${esc(value)}" ${chosen.includes(value) ? "selected" : ""}>${esc(label)}</option>`;
  return [
    option("all", "All projects"),
    option("", "No project"),
    ...names.map((name) => option(name, name)),
  ].join("");
}
function tasksInReport() {
  const seen = new Set(reportSessions().map((session) => session.id));
  return tasks.filter((task) => {
    if (seen.has(task.id) || !matches(task, state.filter)) return false;
    if (!task.done && !(Number(task.planMinutes) || Number(task.estimate))) return false;
    if (!reportProjectMatches(task.project)) return false;
    if (state.reportMode === "entries" && state.reportTask !== "all" && state.reportTask !== task.id) return false;
    if (task.date) return reportInRange(task.date);
    return !state.reportFrom;
  });
}
function reportsView() {
  const tabs = `<div class="segmented report-tabs"><button class="${state.reportMode === "summary" ? "active" : ""}" data-report-mode="summary">Overview</button><button class="${state.reportMode === "entries" ? "active" : ""}" data-report-mode="entries">Time entries</button></div>`;
  const controls = `<div class="report-toolbar">${tabs}${btn("Export", 'data-show="export"')}</div><div class="report-filters"><label>Projects<select id="report-project" multiple size="5" aria-label="Projects">${reportProjectOptions()}</select></label><label>From<input type="date" id="report-from" value="${state.reportFrom}"></label><label>To<input type="date" id="report-to" value="${state.reportTo}"></label><label>Search<input type="search" class="report-search" id="task-filter" value="${esc(state.filter)}" placeholder="Task name" autocomplete="off" spellcheck="false"></label>${state.reportMode === "summary" ? `<label>Group by<select id="report-group">${["task", "project", "day"].map((key) => `<option value="${key}" ${state.reportGroup === key ? "selected" : ""}>${key[0].toUpperCase() + key.slice(1)}</option>`).join("")}</select></label>` : ""}</div><div class="report-presets">${[
    ["Today", "today"],
    ["This week", "week"],
    ["All time", "all"],
  ]
    .map(([label, key]) => btn(label, `data-report-range="${key}"`))
    .join(
      "",
    )}</div>`;
  if (state.reportFrom && state.reportTo && state.reportFrom > state.reportTo)
    return (
      controls +
      '<p class="empty" role="status">Choose an end date on or after the start date.</p>'
    );
  if (state.reportMode === "summary") {
    const summary = reportSummary(),
      max = Math.max(1, ...summary.daily.map(([, duration]) => duration));
    return (
      controls +
      `<section class="report-totals" aria-label="Report totals"><div><span>Total time</span><strong>${reportDuration(summary.time)}</strong></div><div><span>Recorded</span><strong>${reportDuration(summary.total)}</strong></div><div><span>Projects</span><strong>${new Set([...reportSessions().filter((entry) => entry.source !== "plan").map((entry) => entry.project || "No project"), ...reportEvents().map((event) => eventProject(event) || "No project"), ...estimateOnlyTasks().map(({ task }) => task.project || "No project")]).size}</strong></div><div><span>Days worked</span><strong>${summary.daily.length}</strong></div></section><p class="settings-hint">Total time is recorded time plus the estimate of completed tasks that have no recorded time. Calendar events count as recorded, using the actual end when one is set.</p><div class="table-scroll"><table><thead><tr><th>${state.reportGroup === "day" ? "Day" : state.reportGroup === "project" ? "Project" : "Task"}</th><th>Recorded</th><th title="Completed tasks with no recorded time">Estimate</th><th>Total</th></tr></thead><tbody>${summary.groups.map((item) => `<tr><td>${esc(item.title)}</td><td>${item.duration ? reportDuration(item.duration) : "—"}</td><td>${item.planned ? reportDuration(item.planned) : "—"}</td><td>${reportDuration(item.duration + (item.planned || 0))}</td></tr>`).join("")}</tbody><tfoot><tr><th>Total</th><td>${reportDuration(summary.total)}</td><td>${summary.planned ? reportDuration(summary.planned) : "—"}</td><td>${reportDuration(summary.time)}</td></tr></tfoot></table></div>${summary.daily.length ? `<section class="daily-report"><h3>Daily breakdown</h3>${summary.daily.map(([date, duration]) => `<div class="daily-report-row"><time datetime="${date}">${new Date(date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</time><div class="daily-report-track"><i style="width:${(duration / max) * 100}%"></i></div><span>${reportDuration(duration)}</span></div>`).join("")}</section>` : '<p class="empty">No time in this selection.</p>'}`
    );
  }
  const selected = new Set(reportSessions());
  const relevant = state.sessions
    .map((session, index) => ({ session, index }))
    .filter(({ session }) => selected.has(session));
  const eventRows = reportEvents()
    .map((event) => {
      const end = shownEventEnd(event);
      return `<tr><td>${esc(event.title || "Event")}</td><td>${esc(eventProject(event) || "No project")}</td><td><time datetime="${event.date}">${new Date(event.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time></td><td>${event.start}–${end}</td><td>${reportDuration(eventMinutes(event))}</td><td>—</td><td><button class="icon-btn" data-open-event="${esc(event.id)}" aria-label="Open ${esc(event.title || "event")}" title="Open event">${svg("details")}</button></td></tr>`;
    })
    .join("");
  const taskChoices = [...new Set([...state.sessions.map((session) => session.id), ...tasksInReport().map((task) => task.id)])];
  const taskRows = tasksInReport().map((task) => {
    const estimate = Number(task.planMinutes) || Number(task.estimate) || 0;
    return `<tr><td>${esc(task.title)}</td><td>${esc(task.project || "No project")}</td><td>${task.date ? `<time datetime="${task.date}">${new Date(task.date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>` : "—"}</td><td>${task.schedule || "—"}</td><td>—</td><td>${estimate ? reportDuration(estimate) : "—"}</td><td><button class="icon-btn" data-detail="${task.id}" aria-label="Details for ${esc(task.title)}" title="Details">${svg("details")}</button></td></tr>`;
  }).join("");
  return (
    controls +
    `<label class="field report-task-filter"><span>Task</span><select id="report-task-filter"><option value="all">All tasks</option>${taskChoices.map((id) => `<option value="${id}" ${state.reportTask === id ? "selected" : ""}>${esc(getTask(id)?.title || id)}</option>`).join("")}</select></label><div class="table-scroll"><table class="report-entries"><thead><tr><th>Task</th><th>Project</th><th>Date</th><th>Time</th><th>Recorded</th><th>Estimate</th><th></th></tr></thead><tbody>${relevant.map(({ session: s, index: i }) => { const plan = s.source === "plan"; const estimate = plan ? s.duration : s.estimate; return `<tr tabindex="0" data-report-row="${i}"><td>${esc(s.title)}</td><td>${esc(s.project || "No project")}</td><td><time datetime="${s.date || calmToday()}">${new Date((s.date || calmToday()) + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time></td><td>${s.start}–${s.end}</td><td>${!plan && s.duration ? reportDuration(s.duration) : "—"}</td><td>${estimate ? reportDuration(estimate) : "—"}</td><td><button class="icon-btn report-edit" data-report-edit="${i}" aria-label="Edit entry for ${esc(s.title)}" title="Edit time entry">${svg("edit")}</button></td></tr>${state.reportEdit === i ? reportEditor(s, i) : ""}`; }).join("")}${eventRows}${taskRows}</tbody></table></div>`
  );
}
function reportExportDrawer() {
  openDrawer(
    "Export report",
    `<p class="muted">${reportSessions().length + reportEvents().length + estimateOnlyTasks().filter(({ task }) => !reportSessions().some((session) => session.id === task.id)).length} entries matching the report’s date, project and task filters.</p><label class="field"><span>Format</span><select id="report-export-format"><option>CSV</option><option>JSON</option></select></label><button class="primary" id="download-report">Download export</button>`,
  );
}
function reportEditor(session, index) {
  return `<tr class="report-editor"><td colspan="7"><div class="report-edit-fields"><div class="field"><label for="entry-project-search">Project</label>${projectField("entry-project", session.project)}</div>${field("Date", "entry-date", session.date || calmToday(), "date")}${field("Start", "entry-start", session.start, "time")}${field("End", "entry-end", session.end, "time")}</div><div class="actions">${btn("Save entry", `data-save-entry="${index}"`, true)}${btn("Cancel", 'id="cancel-entry"')}</div></td></tr>`;
}
function saveEntry(index) {
  const entry = state.sessions[index],
    start = $("screen").querySelector("[name=entry-start]").value,
    end = $("screen").querySelector("[name=entry-end]").value;
  const date = $("screen").querySelector("[name=entry-date]").value;
  const timesChanged = start !== entry.start || end !== entry.end;
  if (
    !date ||
    !start ||
    !end ||
    (timesChanged && minutes(end) <= minutes(start))
  ) {
    notify("Choose a valid date and an end time after the start.");
    return;
  }
  const previousDate = entry.date;
  const startMinute = timesChanged
    ? minutes(start)
    : (entry.startMinute ?? minutes(start));
  const endMinute = timesChanged
    ? minutes(end)
    : (entry.endMinute ?? minutes(end));
  const focusedSeconds = timesChanged
    ? (endMinute - startMinute) * 60
    : (entry.focusedSeconds ?? entry.duration * 60);
  if (timesChanged || date !== previousDate) {
    entry.startTimestamp =
      new Date(date + "T" + start).getTime() +
      (startMinute - minutes(start)) * 60000;
    entry.endTimestamp =
      new Date(date + "T" + end).getTime() + (endMinute - minutes(end)) * 60000;
  }
  Object.assign(entry, {
    project: $("entry-project").value,
    date,
    start,
    end,
    startMinute,
    endMinute,
    focusedSeconds,
    duration: focusedSeconds / 60,
  });
  const task = getTask(entry.id);
  if (task) {
    task.project = entry.project;
    state.sessions
      .filter((session) => session.id === task.id)
      .forEach((session) => (session.project = entry.project));
  }
  if (task?.actual?.sessionKey === entry.sessionKey || task?.actual === entry) {
    task.actual = entry;
    task.date = entry.date;
    task.schedule = entry.start;
  }
  state.reportEdit = null;
  renderScreen();
  notify("Time entry and calendar updated.");
}
function taskEditor(
  task,
  {
    isNew = false,
    expand = false,
    highlightPlanned = false,
    creation = false,
  } = {},
) {
  if (
    guardDrawerChange(() =>
      taskEditor(task, { isNew, expand, highlightPlanned, creation }),
    )
  )
    return;
  const now = Math.ceil(state.nowMinute / 15) * 15;
  const suggestions = [
    ...new Set([Math.min(1425, now), Math.min(1425, now + 30), 540, 840]),
  ];
  const repeats = [
    "Does not repeat",
    "Every day",
    "Every weekday",
    "Every week",
    "Every month",
    "Custom weekly",
    "Monthly weekday",
  ];
  const shownTime = taskTimeLabel(task);
  const content = `${creation ? creationTabs("task") : ""}${task.shared ? '<p class="muted">Shared task · edits stay local until this device syncs its workspace. Your recorded time stays private.</p>' : ""}<label class="field task-title-field"><span>Task</span><div class="detail-title-row"><input id="detail-complete" type="checkbox" aria-label="Task completed" ${task.done ? "checked" : ""}><input id="detail-title" value="${esc(task.title)}" placeholder="Task title"></div></label>${!isNew && !task.done && state.active !== task.id && isPhoneUi() ? '<button class="primary detail-start" id="detail-start" type="button">Start tracking</button>' : ""}<div class="field"><label for="detail-project-search">Project</label>${projectField("detail-project", task.project)}</div><section class="planned-group ${highlightPlanned ? "planned-attention" : ""}"><h3>Planned for</h3><div class="planned-fields">${field("Date", "schedule", task.date, "date")}${field("Time", "schedule-time", task.schedule, "time")}</div><div class="date-suggestions"><button class="quiet" type="button" data-detail-date="${calmToday()}">Today</button><button class="quiet" type="button" data-detail-date="${calmTomorrow()}">Tomorrow</button><button class="quiet" type="button" data-detail-date="${calmMonday()}">Next week</button><button class="quiet" type="button" data-detail-date="">Unplanned</button></div><div class="time-suggestions">${suggestions.map((minute, i) => `<button class="quiet" type="button" data-detail-time="${timeString(minute)}">${i === 0 ? "Next 15 min · " : ""}${timeString(minute)}</button>`).join("")}<button class="quiet" type="button" id="clear-planned-time">No time</button></div>${calendarTargetField(task)}</section>${field("Estimate (minutes)", "estimate", task.planMinutes || task.estimate || "", "number")}<div class="estimate-suggestions">${[15, 25, 30, 60].map((n) => `<button class="quiet" type="button" data-detail-estimate="${n}">${n} min</button>`).join("")}<button class="quiet" type="button" data-detail-estimate="">No estimate</button></div><label class="field"><span>Repeat</span><select id="detail-repeat">${[...new Set([...repeats, ...(task.repeat && !repeats.includes(task.repeat) ? [task.repeat] : [])])].map((value) => `<option ${(!task.repeat && value === "Does not repeat") || task.repeat === value ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><div id="repeat-options"></div><div class="drawer-duration"><span>${shownTime.label}</span><span>${durationLabel(shownTime.minutes)}</span></div><details class="detail-section" ${expand || isNew ? "open" : ""}><summary>Notes</summary><label class="field"><textarea id="detail-notes" rows="4">${esc(task.notes || "")}</textarea></label></details>${isNew ? "" : '<div class="task-delete-area"><button class="quiet danger-text" id="delete-task" type="button">Delete task</button><div id="delete-task-confirm" hidden><p>Delete this task and its recorded time?</p><button class="quiet danger-text" id="confirm-delete-task" type="button">Delete permanently</button><button class="quiet" id="cancel-delete-task" type="button">Cancel</button></div></div>'}`;
  openDrawer(isNew ? "New task" : "Task details", content);
  state.drawerTask = isNew ? null : task.id;
  bindProjectPicker("detail-project");
  $("detail-project")?.addEventListener("change", () => {
    const option = $("detail-calendar")?.querySelector('option[value=""]');
    if (option) option.textContent = taskCalendarDefaultLabel({ project: $("detail-project").value });
  });
  if (task.shared) { $("detail-project").disabled = true; $("detail-project-search").disabled = true; }
  const rule = task.repeatRule || {
    every: 1,
    weekdays: [new Date((task.date || calmToday()) + "T12:00:00").getDay()],
    weekOfMonth: 1,
  };
  function renderRepeat() {
    const kind = $("detail-repeat").value;
    $("repeat-options").innerHTML =
      kind === "Custom weekly"
        ? `<div class="repeat-custom"><label class="field"><span>Every N weeks</span><input id="repeat-every" inputmode="numeric" type="number" min="1" max="52" value="${rule.every}"></label><div class="weekday-choices" aria-label="Repeat on">${[1, 2, 3, 4, 5, 6, 0].map((day) => `<label><input type="checkbox" data-repeat-day="${day}" ${rule.weekdays.includes(day) ? "checked" : ""}><span>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}</span></label>`).join("")}</div></div>`
        : kind === "Monthly weekday"
          ? `<div class="planned-fields"><label class="field"><span>Occurrence</span><select id="repeat-ordinal">${[
              [1, "First"],
              [2, "Second"],
              [3, "Third"],
              [4, "Fourth"],
              [-1, "Last"],
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${rule.weekOfMonth === value ? "selected" : ""}>${label}</option>`,
              )
              .join(
                "",
              )}</select></label><label class="field"><span>Weekday</span><select id="repeat-month-day">${[1, 2, 3, 4, 5, 6, 0].map((day) => `<option value="${day}" ${rule.weekdays[0] === day ? "selected" : ""}>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}</option>`).join("")}</select></label></div>`
          : "";
  }
  renderRepeat();
  $("detail-repeat").onchange = renderRepeat;
  $("drawer-save").hidden = false;
  $("drawer-save").textContent = isNew ? "Create task" : "Save edits";
  $("drawer-save").onclick = async () => {
    const title = $("detail-title").value.trim(),
      date = $("drawer").querySelector("[name=schedule]"),
      time = $("drawer").querySelector("[name=schedule-time]"),
      estimate = $("drawer").querySelector("[name=estimate]");
    clearDrawerErrors();
    if (!title)
      return drawerFieldError($("detail-title"), "Enter a task title.");
    if (!date.validity.valid)
      return drawerFieldError(date, "Choose a valid planned date.");
    if (!time.validity.valid)
      return drawerFieldError(time, "Choose a valid planned time.");
    if (
      !estimate.validity.valid ||
      (estimate.value &&
        (Number(estimate.value) <= 0 || Number(estimate.value) > 100000))
    )
      return drawerFieldError(
        estimate,
        "Enter an estimate from 1 to 100000 minutes, or leave it empty.",
      );
    if (time.value && !date.value) date.value = calmToday();
    const repeat = $("detail-repeat").value;
    const repeatRule =
      repeat === "Custom weekly"
        ? {
            cycle: "weekly",
            every: Number($("repeat-every").value),
            weekdays: [
              ...$("repeat-options").querySelectorAll(
                "[data-repeat-day]:checked",
              ),
            ].map((el) => Number(el.dataset.repeatDay)),
          }
        : repeat === "Monthly weekday"
          ? {
              cycle: "monthly",
              every: 1,
              weekdays: [Number($("repeat-month-day").value)],
              weekOfMonth: Number($("repeat-ordinal").value),
            }
          : null;
    if (
      repeatRule &&
      (!repeatRule.weekdays.length ||
        repeatRule.every < 1 ||
        repeatRule.every > 52 ||
        !Number.isInteger(repeatRule.every))
    )
      return notify("Choose at least one weekday and a valid interval.");
    let repeatValue = repeat === "Does not repeat" ? "" : repeat;
    let ruleValue = repeatRule;
    const repeatTouched =
      !isNew &&
      task.repeat &&
      repeatValue &&
      (date.value !== task.date || time.value !== (task.schedule || "") || title !== task.title);
    if (repeatTouched) {
      const scope = await askSeriesScope("task-change");
      if (!scope) return;
      if (scope === "occurrence") {
        repeatValue = "";
        ruleValue = null;
      }
    }
    if ((date.value !== task.date || time.value !== task.schedule) && !realSessions(task).length) task.actual = null;
    const estimateInput = $("drawer").querySelector("[name=estimate]");
    if ($("detail-complete").checked && !task.done && !taskHasRecordedOrEstimate(task, state.active === task.id ? state.seconds : 0) && !(Number(estimateInput?.value) > 0)) {
      askForEstimate(task, () => $("drawer-save").click());
      return;
    }
    if ($("detail-complete").checked && state.active === task.id) {
      recordSession();
      date.value = task.date;
      time.value = task.schedule;
      state.active = null;
      state.running = false;
      state.seconds = 0;
    }
    Object.assign(task, {
      done: $("detail-complete").checked,
      title,
      project: $("detail-project").value,
      date: date.value,
      schedule: time.value,
      estimate: Number(estimate.value) || null,
      planMinutes: realSessions(task).length ? task.planMinutes : Number(estimate.value) || null,
      repeat: repeatValue,
      repeatRule: ruleValue,
      notes: $("detail-notes").value,
      ...($("detail-calendar") ? { calendar: $("detail-calendar").value } : {}),
    });
    state.sessions
      .filter((s) => s.id === task.id)
      .forEach((s) => {
        s.title = task.title;
        s.project = task.project;
      });
    task.today = task.date === calmToday();
    if (task.done) adoptPlannedTime(task, true);
    else dropPlannedSessions(task);
    if (isNew) tasks.push(task);
    closeDrawer(false);
    if (state.view === "plan") repaintPlan();
    else renderScreen();
    notify(isNew ? "Task created." : repeatTouched && !repeatValue ? "Only this one was changed. It no longer repeats." : "Task saved.");
  };
  $("drawer-content")
    .querySelectorAll("[data-detail-date]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          $("drawer").querySelector("[name=schedule]").value =
            button.dataset.detailDate;
          if (!button.dataset.detailDate)
            $("drawer").querySelector("[name=schedule-time]").value = "";
        }),
    );
  $("drawer-content")
    .querySelectorAll("[data-detail-time]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const date = $("drawer").querySelector("[name=schedule]");
          if (!date.value) date.value = calmToday();
          $("drawer").querySelector("[name=schedule-time]").value =
            button.dataset.detailTime;
        }),
    );
  $("drawer-content")
    .querySelectorAll("[data-detail-estimate]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          ($("drawer").querySelector("[name=estimate]").value =
            button.dataset.detailEstimate)),
    );
  $("clear-planned-time").onclick = () =>
    ($("drawer").querySelector("[name=schedule-time]").value = "");
  $("drawer-content")
    .querySelectorAll("[data-mirror-resolve]")
    .forEach(
      (button) =>
        (button.onclick = () => window.calmResolveMirror?.(task.id, button.dataset.mirrorResolve)),
    );
  if (!isNew) {
    const deleteTask = () => {
      if (state.active === task.id) {
        state.active = null;
        state.running = false;
        state.seconds = 0;
      }
      state.deletedTaskIds.push(task.id);
      tasks.splice(tasks.indexOf(task), 1);
      state.sessions = state.sessions.filter((s) => s.id !== task.id);
      if (state.reportTask === task.id) state.reportTask = "all";
      state.selected = null;
      closeDrawer(false);
      paintPlan();
      notify("Task deleted.");
    };
    if ($("detail-start"))
      $("detail-start").onclick = () => {
        closeDrawer();
        if (!$("drawer").hidden) return;
        if (state.view !== "track") show("track", { preserveSurface: true });
        startTask(task.id);
        notify("Tracking " + task.title + ".");
      };
    $("delete-task").onclick = async () => {
      if (task.repeat) {
        const scope = await askSeriesScope("task-delete");
        if (!scope) return;
        if (scope === "occurrence") {
          const next = nextRepeatDate(task);
          if (!next) return notify("Could not find the next repeat. Delete the series instead.");
          task.date = next;
          task.today = task.date === calmToday();
          closeDrawer(false);
          paintPlan();
          notify("This one is skipped. The repeat continues.");
          return;
        }
        deleteTask();
        return;
      }
      $("delete-task-confirm").hidden = false;
      $("delete-task").hidden = true;
      $("confirm-delete-task").focus();
    };
    $("cancel-delete-task").onclick = () => {
      $("delete-task-confirm").hidden = true;
      $("delete-task").hidden = false;
      $("delete-task").focus();
    };
    $("confirm-delete-task").onclick = deleteTask;
  }
  if (state.active === task.id) {
    $("drawer-content")
      .querySelectorAll(
        "[name=schedule],[name=schedule-time],[data-detail-date],[data-detail-time],#clear-planned-time",
      )
      .forEach((control) => (control.disabled = true));
  }
  if (isNew) $("detail-title").focus();
}
function calendarTargetField(task) {
  const mirror = window.calmMirror;
  if (!mirror?.targets?.length || task.shared) return "";
  const value = task.calendar || "",
    known = !value || value === "none" || mirror.targets.some((item) => item.key === value);
  const info = mirror.tasks?.[task.id];
  const note =
    info?.state === "conflict"
      ? `<div class="mirror-note" role="status"><p>${info.conflict === "removed" ? "This block was deleted in the calendar." : "This block was changed in the calendar."} Your calendar version is kept.</p><button class="quiet" type="button" data-mirror-resolve="calendar">${info.conflict === "removed" ? "Keep it off the calendar" : "Use calendar time"}</button><button class="quiet" type="button" data-mirror-resolve="plan">${info.conflict === "removed" ? "Add it again" : "Overwrite calendar"}</button></div>`
      : info?.state === "error"
        ? `<p class="mirror-note" role="status">Could not add this to the calendar: ${esc(info.error || "unknown error")}</p>`
        : info?.state === "pending"
          ? `<p class="settings-hint">Waiting to sync${info.retry ? " · retrying " + new Date(info.retry).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : ""}</p>`
          : info?.calendar
            ? `<p class="settings-hint">In ${esc(info.calendar)}</p>`
            : "";
  return `<label class="field calendar-target"><span>Calendar</span><select id="detail-calendar"><option value="">${esc(taskCalendarDefaultLabel(task))}</option>${mirror.targets.map((item) => `<option value="${esc(item.key)}" ${item.key === value ? "selected" : ""}>${esc(item.label)}</option>`).join("")}${known ? "" : `<option value="${esc(value)}" selected>Unavailable calendar</option>`}<option value="none" ${value === "none" ? "selected" : ""}>Don’t add to a calendar</option></select></label>${note}`;
}
function creationTabs(kind) {
  return `<div class="segmented create-tabs"><button class="${kind === "task" ? "active" : ""}" data-create-kind="task">Task</button><button class="${kind === "event" ? "active" : ""}" data-create-kind="event">Event</button></div>`;
}
function planWhen(date, startMinute, endMinute) {
  const label = new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${label}, ${timeString(startMinute)}–${endMinute >= 1440 ? "24:00" : timeString(endMinute)}`;
}
function openCalendarCreate(kind = "task") {
  if (guardDrawerChange(() => openCalendarCreate(kind))) return;
  const date = calmWeekDate(state.calendarSlot.day),
    start = timeString(state.calendarSlot.minute),
    endMinute = Math.min(1440, state.calendarSlotEnd || state.calendarSlot.minute + 30);
  const length = Math.max(15, endMinute - state.calendarSlot.minute);
  if (kind === "task") {
    const project = projects.includes(state.projectFilter) ? state.projectFilter : "";
    const task = {
      id: "new-" + Date.now(),
      title: "",
      project,
      date,
      schedule: start,
      estimate: length,
      repeat: "",
      done: false,
      today: date === calmToday(),
      notes: "",
    };
    openDrawer(
      planWhen(date, state.calendarSlot.minute, endMinute),
      `${creationTabs("task")}<label class="field task-title-field"><span>Task</span><input id="detail-title" placeholder="What are you doing?"></label><div class="field"><label for="detail-project-search">Project</label>${projectField("detail-project", project)}</div>`,
    );
    bindProjectPicker("detail-project");
    $("drawer-save").hidden = false;
    $("drawer-save").textContent = "Create task";
    $("detail-title").focus();
    $("detail-title").onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("drawer-save").click();
      }
    };
    $("drawer-save").onclick = () => {
      const title = $("detail-title").value.trim();
      clearDrawerErrors();
      if (!title) return drawerFieldError($("detail-title"), "Enter a task title.");
      task.title = title;
      task.project = $("detail-project").value;
      tasks.push(task);
      closeDrawer(false);
      repaintPlan();
      notify("Task created.");
    };
    return;
  }
  if (providerApi()?.calendars().length) {
    const startMs = dateTimeToMs(date, start);
    providerEditor(
      { title: "", description: "", location: "", startMs, endMs: startMs + (endMinute - state.calendarSlot.minute) * 60000, allDay: false, key: providerApi().defaultKey() },
      true,
    );
  } else
    eventEditor(
      {
        id: "event-" + Date.now(),
        title: "",
        date,
        start,
        end: endMinute >= 1440 ? "24:00" : timeString(endMinute),
        calendar: "Local calendar",
        attendees: "",
        meetingUrl: "",
        notes: "",
        owned: true,
      },
      true,
    );
}
function placePlanTask(id) {
  const task = getTask(id);
  if (!task) return;
  if (realSessions(task).length) return;
  task.actual = null;
  task.date = calmWeekDate(state.calendarSlot.day);
  task.schedule = timeString(state.calendarSlot.minute);
  task.planMinutes = plannedLength(task);
  task.estimate = task.planMinutes;
  task.today = task.date === calmToday();
  state.slotVisible = true;
  repaintPlan();
  notify("Planned time updated.");
}
function calendarEvents() {
  return window.calmRuntimeMode && !window.calmReference
    ? window.calmProviderEvents || {}
    : sampleCalendarEvents();
}
function sampleCalendarEvents() {
  return {
    design: {
      id: "design",
      title: "Design review",
      date: calmToday(),
      start: "10:30",
      end: "11:00",
      calendar: "Google · Work",
      meetingUrl: "https://example.test/meeting/design",
      notes: "Review the updated product direction and agree on next steps.",
      owned: false,
    },
    client: {
      id: "client",
      title: "Client check-in",
      date: calmDateAfter(-1),
      start: "14:00",
      end: "15:00",
      calendar: "Google · Work",
      meetingUrl: "https://example.test/meeting/client",
      notes: "Project scope and sample timing.",
      owned: false,
    },
    intro: {
      id: "intro",
      title: "Intro call",
      date: calmTomorrow(),
      start: "16:00",
      end: "16:30",
      calendar: "Google · Work",
      meetingUrl: "https://example.test/meeting/intro",
      notes: "Introductory project conversation.",
      owned: false,
    },
  };
}
function providerLockCopy(event) {
  const account = (window.calmCalendarAccounts || []).find(
    (item) => (item.accountId || item.provider) === event?.accountId,
  );
  if (account && account.canWrite === false) {
    const name = account.provider === "microsoft" ? "Microsoft 365" : "Google Calendar";
    return `Sign in again to edit ${name}. Open Settings, Calendars.`;
  }
  return `Read-only calendar. ${event?.calendar || "This calendar"} cannot be changed from Calm Work.`;
}
const REPEAT_CHOICES = ["Does not repeat", "Every day", "Every weekday", "Every week", "Every month", "Custom weekly", "Monthly weekday"];
function repeatFieldHtml(event, keepLabel = "") {
  const selected = event.repeat || keepLabel || "Does not repeat";
  const choices = [
    ...(keepLabel ? [keepLabel] : []),
    ...REPEAT_CHOICES,
    ...(event.repeat && !REPEAT_CHOICES.includes(event.repeat) ? [event.repeat] : []),
  ];
  return `<label class="field"><span>Repeat</span><select id="detail-repeat">${[...new Set(choices)].map((value) => `<option ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("")}</select></label><div id="repeat-options"></div>`;
}
function bindRepeatField(event) {
  const box = $("repeat-options");
  const select = $("detail-repeat");
  if (!box || !select) return;
  const rule = event.repeatRule || {
    every: 1,
    weekdays: [new Date((event.date || calmToday()) + "T12:00:00").getDay()],
    weekOfMonth: 1,
  };
  const render = () => {
    const kind = select.value;
    box.innerHTML =
      kind === "Custom weekly"
        ? `<div class="repeat-custom"><label class="field"><span>Every N weeks</span><input id="repeat-every" inputmode="numeric" type="number" min="1" max="52" value="${rule.every || 1}"></label><div class="weekday-choices" aria-label="Repeat on">${[1, 2, 3, 4, 5, 6, 0].map((day) => `<label><input type="checkbox" data-repeat-day="${day}" ${(rule.weekdays || []).includes(day) ? "checked" : ""}><span>${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}</span></label>`).join("")}</div></div>`
        : kind === "Monthly weekday"
          ? `<div class="planned-fields"><label class="field"><span>Occurrence</span><select id="repeat-ordinal">${[[1, "First"], [2, "Second"], [3, "Third"], [4, "Fourth"], [-1, "Last"]].map(([value, label]) => `<option value="${value}" ${Number(rule.weekOfMonth) === value ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="field"><span>Weekday</span><select id="repeat-month-day">${[1, 2, 3, 4, 5, 6, 0].map((day) => `<option value="${day}" ${(rule.weekdays || [])[0] === day ? "selected" : ""}>${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]}</option>`).join("")}</select></label></div>`
          : "";
  };
  render();
  select.onchange = render;
}
function readRepeat(date) {
  const repeat = $("detail-repeat")?.value || "Does not repeat";
  const day = date || $("drawer")?.querySelector("[name=event-date]")?.value || calmToday();
  if (repeat === "Keep current repeat") return { repeat: "", repeatRule: null, unchanged: true, recurrence: null };
  if (repeat === "Does not repeat") return { repeat: "", repeatRule: null, unchanged: false, recurrence: null };
  if (repeat === "Custom weekly") {
    const every = Number($("repeat-every")?.value);
    const weekdays = [...($("repeat-options")?.querySelectorAll("[data-repeat-day]:checked") || [])].map((el) => Number(el.dataset.repeatDay));
    if (!weekdays.length || every < 1 || every > 52 || !Number.isInteger(every))
      return { error: "Choose at least one weekday and a valid interval." };
    const repeatRule = { cycle: "weekly", every, weekdays };
    return { repeat, repeatRule, unchanged: false, recurrence: recurrenceFrom(repeat, repeatRule, day) };
  }
  if (repeat === "Monthly weekday") {
    const repeatRule = {
      cycle: "monthly",
      every: 1,
      weekdays: [Number($("repeat-month-day")?.value)],
      weekOfMonth: Number($("repeat-ordinal")?.value),
    };
    return { repeat, repeatRule, unchanged: false, recurrence: recurrenceFrom(repeat, repeatRule, day) };
  }
  return { repeat, repeatRule: null, unchanged: false, recurrence: recurrenceFrom(repeat, null, day) };
}
function recurrenceFrom(repeat, rule, date) {
  if (!repeat) return null;
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (repeat === "Every day") return { freq: "daily", interval: 1 };
  if (repeat === "Every weekday") return { freq: "weekly", interval: 1, byDay: [1, 2, 3, 4, 5] };
  if (repeat === "Every week" || repeat === "Every Friday") return { freq: "weekly", interval: 1, byDay: [weekday] };
  if (repeat === "Every month") return { freq: "monthly", interval: 1 };
  if (repeat === "Custom weekly") return { freq: "weekly", interval: rule?.every || 1, byDay: rule?.weekdays || [] };
  if (repeat === "Monthly weekday")
    return {
      freq: "monthlyWeekday",
      interval: 1,
      byDay: rule?.weekdays?.length ? [rule.weekdays[0]] : [weekday],
      weekOfMonth: rule?.weekOfMonth || 1,
    };
  return { freq: "weekly", interval: 1, byDay: [weekday] };
}
function localEventDirty(source, fields) {
  const master = localMaster(source) || source;
  const current = {
    title: source.title || "",
    calendar: source.calendar || "",
    date: source.date || "",
    start: source.start || "",
    end: source.end || "",
    project: eventProject(source),
    attendees: source.attendees || "",
    meetingUrl: source.meetingUrl || "",
    notes: source.notes || source.description || "",
    repeat: master.repeat || "",
  };
  if (JSON.stringify(master.repeatRule || null) !== JSON.stringify(fields.repeatRule || null)) return true;
  return Object.keys(current).some((key) => String(current[key]) !== String(fields[key] ?? ""));
}
async function commitLocalEvent(source, fields, isNew) {
  if (isNew) {
    const id = source.id && !state.localEvents.some((event) => event.id === source.id) ? source.id : "event-" + Date.now();
    state.localEvents.push({ ...fields, id, owned: true, skipDates: [], seriesId: "", recurring: false });
    return true;
  }
  const stored = state.localEvents.find((event) => event.id === source.id);
  if (stored?.seriesId && !stored.repeat) {
    Object.assign(stored, fields, { seriesId: fields.repeat ? "" : stored.seriesId });
    return true;
  }
  const master = localMaster(source);
  const series = Boolean(master?.repeat || source.recurring);
  if (!series || !master) {
    if (stored) Object.assign(stored, fields);
    else state.localEvents.push({ ...source, ...fields, owned: true, skipDates: [] });
    return true;
  }
  if (!localEventDirty(source, fields)) return true;
  const scope = await askSeriesScope("change");
  if (!scope) return false;
  if (scope === "occurrence") {
    master.skipDates = [...new Set([...(master.skipDates || []), source.date || master.date])];
    state.localEvents.push({
      ...fields,
      id: "event-" + Date.now(),
      owned: true,
      repeat: "",
      repeatRule: null,
      seriesId: master.id,
      recurring: false,
      skipDates: [],
    });
    return true;
  }
  Object.assign(master, fields, { date: shiftIsoDate(master.date, isoDayDelta(source.date || master.date, fields.date)) });
  return true;
}
function confirmChoice(message, confirmLabel) {
  $("confirm-choice")?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="confirm-backdrop" id="confirm-choice"><div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-choice-title"><h2 id="confirm-choice-title">${esc(message)}</h2><div class="actions"><button class="quiet" id="cancel-choice" type="button">Cancel</button><button class="quiet danger-text" id="confirm-choice-yes" type="button">${esc(confirmLabel)}</button></div></div></div>`,
  );
  const dialog = $("confirm-choice");
  return new Promise((resolve) => {
    const finish = (value) => {
      dialog.remove();
      resolve(value);
    };
    $("cancel-choice").onclick = () => finish(false);
    dialog.onclick = (event) => {
      if (event.target === dialog) finish(false);
    };
    dialog.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      finish(false);
    };
    $("confirm-choice-yes").onclick = () => finish(true);
    $("cancel-choice").focus();
  });
}
async function deleteLocalEvent(source) {
  const stored = state.localEvents.find((event) => event.id === source.id);
  const exception = stored?.seriesId && !stored.repeat;
  const master = localMaster(source);
  const series = !exception && Boolean(master?.repeat || source.recurring);
  if (series && master) {
    const scope = await askSeriesScope("event-delete");
    if (!scope) return false;
    if (scope === "occurrence")
      master.skipDates = [...new Set([...(master.skipDates || []), source.date || master.date])];
    else
      state.localEvents = state.localEvents.filter((event) => event.id !== master.id && event.seriesId !== master.id);
  } else {
    const ok = await confirmChoice(`Delete “${source.title || "this event"}”?`, "Delete event");
    if (!ok) return false;
    state.localEvents = state.localEvents.filter((event) => event.id !== (stored?.id || source.id));
  }
  return true;
}
function eventEditor(event, isNew = false, reason = "") {
  if (guardDrawerChange(() => eventEditor(event, isNew))) return;
  const link = eventMeetingUrl(event);
  const notes = plainNotes(event.notes || event.description || "");
  const shownNotes = notesWithoutLink(notes, link);
  openDrawer(
    isNew ? "New event" : "Event details",
    `${isNew ? creationTabs("event") : ""}<label class="field task-title-field"><span>Event</span><input id="event-title" value="${esc(event.title)}" placeholder="Event title"></label><label class="field"><span>Calendar</span><select id="event-calendar">${Array.from(new Set([event.calendar, ...(window.calmRuntimeMode && !window.calmReference ? ["Local calendar"] : ["Local calendar", "Google · Work", "Microsoft · Personal"])])).map((calendar) => `<option ${calendar === event.calendar ? "selected" : ""}>${esc(calendar)}</option>`).join("")}</select></label>${field("Date", "event-date", event.date, "date")}<div class="planned-fields">${field("Start", "event-start", event.start, "time")}${field("End", "event-end", event.end, event.end === "24:00" ? "text" : "time")}</div>${event.owned || isNew ? repeatFieldHtml(event) : ""}${event.recurring && !event.owned ? `<p class="settings-hint">This event repeats.</p>` : ""}${actualEndField(event.actualEnd || state.eventMeta?.[event.id]?.actualEnd || "")}${eventProjectField(eventProject(event))}<label class="field"><span>Invite attendees</span><input id="event-attendees" value="${esc(event.attendees || "")}" placeholder="name@example.test"></label>${event.owned || isNew ? `<label class="field"><span>Meeting link</span><input id="event-url" value="${esc(event.meetingUrl || "")}" placeholder="https://…"></label>` : ""}${meetingLinkHtml(link)}${notesField("event-notes", shownNotes, event.owned || isNew)}${!isNew && event.owned ? `<div class="actions"><button class="quiet" id="event-duplicate" type="button">Duplicate</button><button class="quiet danger-text" id="event-delete" type="button">Delete event…</button></div>` : ""}${!event.owned ? `<p class="muted">${esc(window.calmRuntimeMode && !window.calmReference ? reason || providerLockCopy(event) : "External calendar event. Read-only in this preview.")}</p>` : ""}`,
  );
  if (!event.owned) {
    $("drawer-content")
      .querySelectorAll("input,textarea,select")
      .forEach((input) => {
        if (input.name === "event-actual-end" || input.id === "event-project") return;
        input.disabled = true;
      });
    $("drawer-save").hidden = false;
    $("drawer-save").textContent = "Save length";
    $("drawer-save").onclick = () => {
      const actual = $("drawer").querySelector("[name=event-actual-end]").value;
      if (actual && minutes(actual) <= minutes(event.start || "00:00"))
        return notify("Actual end has to be after the start.");
      rememberEventLength(event.id, event.end, actual);
      const project = $("event-project").value;
      if (event.seriesId) applyEventProject(event, project, "series");
      else applyEventProject(event, project, "occurrence");
      closeDrawer(false);
      paintPlan();
      notify(actual ? "Event length saved." : "Event saved.");
    };
    return;
  }
  bindRepeatField(event);
  $("drawer-save").hidden = false;
  $("drawer-save").textContent = isNew ? "Create event" : "Save edits";
  $("drawer-save").onclick = async () => {
    const title = $("event-title").value.trim(),
      start = $("drawer").querySelector("[name=event-start]").value,
      end = $("drawer").querySelector("[name=event-end]").value,
      actual = $("drawer").querySelector("[name=event-actual-end]")?.value || "",
      date = $("drawer").querySelector("[name=event-date]").value;
    clearDrawerErrors();
    if (!title)
      return drawerFieldError($("event-title"), "Enter an event title.");
    if (!date || !start || !end || minutes(end) <= minutes(start)) {
      notify("Choose an end time after the start.");
      return;
    }
    if (actual && minutes(actual) <= minutes(start))
      return notify("Actual end has to be after the start.");
    const chosen = readRepeat(date);
    if (chosen.error) return notify(chosen.error);
    const fields = {
      title,
      calendar: $("event-calendar").value,
      date,
      start,
      end: actual || end,
      project: $("event-project").value,
      attendees: $("event-attendees").value,
      meetingUrl: $("event-url").value,
      notes: notesForSave($("event-notes").value, event.notes || event.description || "", link),
      repeat: chosen.repeat,
      repeatRule: chosen.repeatRule,
      plannedEnd: actual ? event.plannedEnd || end : event.plannedEnd || "",
      actualEnd: actual,
    };
    const saved = await commitLocalEvent(event, fields, isNew);
    if (!saved) return;
    rememberEventLength(isNew ? state.localEvents.at(-1)?.id : event.id, end, actual, fields.project);
    closeDrawer(false);
    paintPlan();
    notify(isNew ? "Event saved on this device." : "Event saved.");
  };
  if ($("event-duplicate"))
    $("event-duplicate").onclick = () => {
      const date = $("drawer").querySelector("[name=event-date]").value;
      const chosen = readRepeat(date);
      if (chosen.error) return notify(chosen.error);
      const master = localMaster(event) || event;
      state.drawerBaseline = drawerValues();
      eventEditor(
        {
          ...event,
          id: "event-" + Date.now(),
          title: $("event-title").value.trim() || event.title,
          calendar: $("event-calendar").value,
          date,
          start: $("drawer").querySelector("[name=event-start]").value,
          end: $("drawer").querySelector("[name=event-end]").value,
          project: $("event-project").value,
          attendees: $("event-attendees").value,
          meetingUrl: $("event-url").value,
          notes: notesForSave($("event-notes").value, event.notes || event.description || "", link),
          repeat: chosen.repeat || master.repeat || "",
          repeatRule: chosen.repeatRule || master.repeatRule || null,
          seriesId: "",
          recurring: false,
          skipDates: [],
          owned: true,
        },
        true,
      );
    };
  if ($("event-delete"))
    $("event-delete").onclick = async () => {
      const removed = await deleteLocalEvent(event);
      if (!removed) return;
      closeDrawer(false);
      paintPlan();
      notify("Event deleted.");
    };
  if (isNew) $("event-title").focus();
}
// ---- Provider calendar events (Google through SP's provider, Microsoft 365 through Graph).
// The main process re-reads each event and sends If-Match with its etag, so an
// edit made elsewhere comes back as a conflict and is never silently overwritten.
function providerApi() {
  return window.calmRuntimeMode && !window.calmReference ? window.calmEventApi || null : null;
}
function isEditableProviderEvent(event) {
  return Boolean(providerApi() && event && !event.owned && event.editable && event.eventId);
}
function providerRef(event) {
  return { accountId: event.accountId, calendarId: event.calendarId, eventId: event.eventId };
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function msToDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function msToTime(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function dateTimeToMs(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, time === "24:00" ? 1440 : minutes(time)).getTime();
}
function paintPlan() {
  if (state.view === "plan") repaintPlan();
  else renderScreen();
}
function nthWeekday(year, month, weekday, index) {
  const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (index === -1) {
    const last = new Date(year, month + 1, 0);
    last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7));
    return iso(last);
  }
  const first = new Date(year, month, 1);
  const day = 1 + ((weekday - first.getDay() + 7) % 7) + (index - 1) * 7;
  const date = new Date(year, month, day);
  return date.getMonth() === month ? iso(date) : "";
}
function nextRepeatDate(task) {
  if (!task?.date || !task.repeat) return "";
  const start = new Date(task.date + "T12:00:00");
  const iso = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const plus = (days) => {
    const d = new Date(start);
    d.setDate(d.getDate() + days);
    return iso(d);
  };
  if (task.repeat === "Every day") return plus(1);
  if (task.repeat === "Every weekday") {
    for (let n = 1; n < 8; n++) {
      const d = new Date(start);
      d.setDate(d.getDate() + n);
      if (d.getDay() !== 0 && d.getDay() !== 6) return iso(d);
    }
  }
  if (task.repeat === "Every week" || task.repeat === "Every Friday") return plus(7);
  if (task.repeat === "Every month") {
    const d = new Date(start);
    d.setMonth(d.getMonth() + 1);
    return iso(d);
  }
  if (task.repeat === "Monthly weekday") {
    const weekday = task.repeatRule?.weekdays?.[0] ?? start.getDay();
    const index = task.repeatRule?.weekOfMonth || 1;
    const probe = new Date(start);
    probe.setDate(1);
    probe.setMonth(probe.getMonth() + 1);
    return nthWeekday(probe.getFullYear(), probe.getMonth(), weekday, index);
  }
  const days = task.repeatRule?.weekdays?.length ? task.repeatRule.weekdays : [start.getDay()];
  const every = Math.max(1, task.repeatRule?.every || 1);
  for (let n = 1; n <= every * 14; n++) {
    const d = new Date(start);
    d.setDate(d.getDate() + n);
    if (!days.includes(d.getDay())) continue;
    if (task.repeat === "Custom weekly" && Math.floor((n - d.getDay() + start.getDay()) / 7) % every !== 0) continue;
    return iso(d);
  }
  return plus(7);
}
/** Only this occurrence, or the whole series. Resolves null when cancelled. */
function askSeriesScope(kind) {
  const copy = {
    change: ["This event repeats. Change only this one, or every event in the series?", "Only this event", "All events in the series"],
    "event-delete": ["This event repeats. Delete only this one, or the whole series?", "Only this event", "All events in the series"],
    "task-change": ["This task repeats. Change only this one, or the whole repeat?", "Only this one", "All in the series"],
    "task-delete": ["This task repeats. Skip only this one, or delete the whole repeat?", "Only this one", "Delete the series"],
  }[kind] || ["This repeats. Change only this one, or the whole series?", "Only this one", "All in the series"];
  document.getElementById("series-scope-dialog")?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="confirm-backdrop" id="series-scope-dialog"><div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="series-scope-title"><h2 id="series-scope-title">${esc(copy[0])}</h2><label class="settings-toggle"><input type="radio" name="series-scope" value="occurrence" checked><span>${esc(copy[1])}</span></label><label class="settings-toggle"><input type="radio" name="series-scope" value="series"><span>${esc(copy[2])}</span></label><div class="actions"><button class="quiet" id="cancel-series-scope" type="button">Cancel</button><button class="quiet" id="confirm-series-scope" type="button">Continue</button></div></div></div>`,
  );
  const dialog = $("series-scope-dialog");
  return new Promise((resolve) => {
    const finish = (value) => {
      dialog.remove();
      resolve(value);
    };
    $("cancel-series-scope").onclick = () => finish(null);
    dialog.onclick = (event) => {
      if (event.target === dialog) finish(null);
    };
    dialog.onkeydown = (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      finish(null);
    };
    $("confirm-series-scope").onclick = () =>
      finish(dialog.querySelector("[name=series-scope]:checked")?.value || "occurrence");
    $("cancel-series-scope").focus();
  });
}
function providerEditorHtml(view, options) {
  const calendars = providerApi().calendars();
  const key = options.key;
  const choices = [...calendars];
  if (key && key !== "local" && !choices.some((item) => item.key === key))
    choices.unshift({ key, label: view.calendar || "Current calendar" });
  const moveLocked = !options.isNew && view.recurring;
  const select = `<label class="field"><span>Calendar</span><select id="event-calendar" ${moveLocked ? 'disabled title="Recurring events stay on their calendar"' : ""}>${choices.map((item) => `<option value="${esc(item.key)}" ${item.key === key ? "selected" : ""}>${esc(item.label)}</option>`).join("")}${options.isNew ? `<option value="local" ${key === "local" ? "selected" : ""}>Local calendar (this device only)</option>` : ""}</select></label>`;
  const end = view.allDay ? msToDate(view.endMs - 1) : msToTime(view.endMs);
  const link = eventMeetingUrl(view);
  const location = String(view.location || "").trim();
  const locationUrl = safeHttps(location);
  const showLocation = !locationUrl || locationUrl !== link;
  const planned = state.eventMeta?.[view.id]?.plannedEnd;
  const plannedNote = planned && planned !== msToTime(view.endMs) ? `<p class="settings-hint">Planned end ${esc(planned)}. The block uses the actual end.</p>` : "";
  const times = view.allDay
    ? `<p class="settings-hint">All-day event${view.endMs - view.startMs > 86400000 ? ` · until ${esc(end)}` : ""}.</p>`
    : `<div class="planned-fields">${field("Start", "event-start", msToTime(view.startMs), "time")}${field("End", "event-end", msToTime(view.endMs) === "00:00" && view.endMs > view.startMs ? "24:00" : msToTime(view.endMs), msToTime(view.endMs) === "00:00" ? "text" : "time")}</div>${options.isNew ? "" : actualEndField(state.eventMeta?.[view.id]?.actualEnd || "")}${plannedNote}`;
  return `${options.isNew ? creationTabs("event") : ""}${options.banner ? `<p class="event-conflict" role="alert">${esc(options.banner)}</p>` : ""}<label class="field task-title-field"><span>Event</span><input id="event-title" value="${esc(view.title)}" placeholder="Event title"></label>${select}${field("Date", "event-date", msToDate(view.startMs), "date")}${times}${repeatFieldHtml(view, !options.isNew && view.recurring && !view.repeat ? "Keep current repeat" : "")}${eventProjectField(eventProject(view))}${meetingLinkHtml(link)}${showLocation ? `<label class="field"><span>Location</span><input id="event-location" value="${esc(location)}" placeholder="Room or address"></label>` : ""}${notesField("event-notes", notesWithoutLink(plainNotes(view.description || view.notes || ""), link), true)}${options.isNew ? "" : `<div class="actions"><button class="quiet" id="event-duplicate" type="button">Duplicate</button><button class="quiet danger-text" id="event-delete" type="button">Delete event…</button></div>`}`;
}
function readProviderForm(view) {
  const drawer = $("drawer");
  const date = drawer.querySelector("[name=event-date]").value;
  const out = {
    title: $("event-title").value.trim(),
    description: notesForSave($("event-notes")?.value || "", view.description || view.notes || "", eventMeetingUrl(view)),
    location: $("event-location") ? $("event-location").value.trim() : view.location || "",
    key: $("event-calendar").value,
    scope: drawer.querySelector("[name=event-scope]:checked")?.value || "occurrence",
  };
  if (!date) return { ...out, error: "Choose a date." };
  if (view.allDay) {
    const length = view.endMs - view.startMs;
    out.startMs = dateTimeToMs(date, "00:00");
    out.endMs = out.startMs + length;
  } else {
    const start = drawer.querySelector("[name=event-start]").value,
      end = drawer.querySelector("[name=event-end]").value,
      actual = drawer.querySelector("[name=event-actual-end]")?.value || "";
    if (!start || !end || minutes(end) <= minutes(start)) return { ...out, error: "Choose an end time after the start." };
    if (actual && minutes(actual) <= minutes(start)) return { ...out, error: "Actual end has to be after the start." };
    out.startMs = dateTimeToMs(date, start);
    out.endMs = dateTimeToMs(date, actual || end);
    out.actualEnd = actual;
    out.plannedEnd = end;
  }
  out.project = drawer.querySelector("#event-project")?.value || "";
  return out;
}
function providerConflict(result, retry) {
  const conflict = result.conflict;
    if (conflict.removed) {
    closeDrawer(false);
    paintPlan();
    notify("This event was deleted in the calendar. Nothing was changed.");
    return;
  }
  notify("This event changed in the calendar. Showing the newer version; your edits were not saved.");
  retry(conflict);
}
function drawerSnapshot() {
  const value = (name) => $("drawer")?.querySelector(`[name=${name}]`)?.value || "";
  return {
    title: $("event-title")?.value || "",
    notes: $("event-notes")?.value || "",
    location: $("event-location")?.value || "",
    start: value("event-start"),
    end: value("event-end"),
    actual: value("event-actual-end"),
    calendar: $("event-calendar")?.value || "",
    project: $("event-project")?.value || "",
    repeat: $("detail-repeat")?.value || "",
  };
}
function ensureMeetingLink(url) {
  const link = safeHttps(url);
  if (!link || $("drawer-content")?.querySelector(".meeting-link")) return;
  const html = meetingLinkHtml(link);
  const notes = $("event-notes")?.closest("label") || $("drawer-content")?.querySelector(".notes-read");
  if (notes) notes.insertAdjacentHTML("beforebegin", html);
  else $("drawer-content")?.insertAdjacentHTML("beforeend", html);
}
function openProviderEvent(event) {
  if (guardDrawerChange(() => openProviderEvent(event))) return;
  const api = providerApi();
  if (event.editable) providerEditor(event, false);
  else eventEditor(event, false);
  const opened = drawerSnapshot();
  const token = $("drawer-content").firstElementChild;
  api
    .get(providerRef(event))
    .then((view) => {
      if (!$("drawer") || $("drawer").hidden || token !== $("drawer-content").firstElementChild) return;
      if (view.removed) {
        closeDrawer(false);
        notify("This event was deleted in the calendar.");
        return;
      }
      const details = {
        ...event,
        ...view,
        id: event.id,
        calendar: view.calendar || event.calendar,
        notes: view.description || event.notes || "",
        description: view.description || event.notes || "",
        location: view.location || event.location || "",
        meetingUrl: event.meetingUrl || view.meetingUrl || "",
      };
      const typing = document.activeElement?.closest?.("#drawer input, #drawer textarea, #drawer select");
      const dirty = typing || Object.entries(opened).some(([key, value]) => drawerSnapshot()[key] !== value);
      if (dirty) return ensureMeetingLink(eventMeetingUrl(details));
      if (!view.editable) return eventEditor({ ...details, editable: false });
      providerEditor(details, false);
    })
    .catch((error) => {
      if (token === $("drawer-content").firstElementChild && !$("event-title"))
        eventEditor(event, false, `${error.message} Showing the last copy.`);
    });
}
function bindCalendarProject() {
  const calendar = $("event-calendar");
  const project = $("event-project");
  if (!calendar || !project || calendar.disabled) return;
  const fromCalendar = () => inheritedEventProject({ key: calendar.value });
  project.dataset.linked = !project.value || project.value === fromCalendar() ? "1" : "0";
  calendar.addEventListener("change", () => {
    if (project.dataset.linked !== "1") return;
    const next = fromCalendar();
    if ([...project.options].some((option) => option.value === next)) project.value = next;
  });
  project.addEventListener("change", () => {
    project.dataset.linked = project.value === fromCalendar() ? "1" : "0";
  });
}
function providerEditor(view, isNew, banner = "") {
  const key = isNew ? view.key : `${view.accountId}|${view.calendarId}`;
  openDrawer(isNew ? "New event" : "Event details", providerEditorHtml(view, { isNew, key, banner }));
  bindRepeatField({ ...view, date: view.date || msToDate(view.startMs || Date.now()) });
  bindCalendarProject();
  $("drawer-save").hidden = false;
  $("drawer-save").textContent = isNew ? "Create event" : "Save edits";
  const busy = (on) => {
    $("drawer-save").disabled = on;
    if ($("event-delete")) $("event-delete").disabled = on;
  };
  $("drawer-save").onclick = async () => {
    clearDrawerErrors();
    const form = readProviderForm(view);
    if (form.error) return notify(form.error);
    const chosen = readRepeat(msToDate(form.startMs || view.startMs || Date.now()));
    if (chosen.error) return notify(chosen.error);
    if (isNew && !form.title) return drawerFieldError($("event-title"), "Enter an event title.");
      if (isNew && form.key === "local") {
      state.localEvents.push({ id: "event-" + Date.now(), title: form.title, date: msToDate(form.startMs), start: msToTime(form.startMs), end: msToTime(form.endMs) === "00:00" ? "24:00" : msToTime(form.endMs), calendar: "Local calendar", attendees: "", meetingUrl: "", notes: form.description, project: form.project || "", owned: true, repeat: chosen.repeat, repeatRule: chosen.repeatRule, skipDates: [] });
      closeDrawer(false);
      paintPlan();
      notify("Event saved on this device.");
      return;
    }
    const [accountId, ...rest] = form.key.split("|"),
      calendarId = rest.join("|");
    busy(true);
    try {
      if (isNew) {
        if (chosen.recurrence && accountId.startsWith("caldav"))
          return notify("Repeats are not saved to iCloud or CalDAV yet. Pick Google, Microsoft, or the local calendar.");
        const result = await providerApi().create({
          accountId,
          calendarId,
          title: form.title,
          description: form.description,
          location: form.location,
          startMs: form.startMs,
          endMs: form.endMs,
          allDay: false,
          project: form.project || "",
          ...(chosen.recurrence
            ? { recurrence: chosen.recurrence, repeat: chosen.repeat, repeatRule: chosen.repeatRule }
            : {}),
        });
        const saved = result?.saved || {};
        const inherited = inheritedEventProject({ accountId, calendarId, key: form.key });
        if ((form.project || "") !== inherited) {
          const seriesId = chosen.recurrence ? String(saved.seriesId || saved.eventId || "") : "";
          if (seriesId) storeEventProject({ seriesId }, form.project, "series");
          else if (saved.eventId) storeEventProject({ eventId: saved.eventId }, form.project, "occurrence");
        }
        closeDrawer(false);
        paintPlan();
        notify("Event added to the calendar.");
        return;
      }
      const changes = {};
      for (const name of ["title", "description", "location"]) if (form[name] !== (view[name] || "")) changes[name] = form[name];
      if (form.startMs !== view.startMs || form.endMs !== view.endMs) Object.assign(changes, { startMs: form.startMs, endMs: form.endMs });
      if (accountId !== view.accountId || calendarId !== view.calendarId) Object.assign(changes, { accountId, calendarId });
      const projectChanged = (form.project || "") !== eventProject(view);
      const ruleChange = chosen.recurrence && !chosen.unchanged ? chosen.recurrence : null;
      if (!Object.keys(changes).length && !ruleChange && !projectChanged) {
        closeDrawer(false);
        paintPlan();
        return;
      }
      if (!form.title) return drawerFieldError($("event-title"), "Enter an event title.");
      let scope = "occurrence";
      if (view.recurring) {
        scope = await askSeriesScope("change");
        if (!scope) return;
      }
      if (projectChanged) {
        if (scope === "series" && view.seriesId) applyEventProject(view, form.project, "series");
        else applyEventProject(view, form.project, "occurrence");
      }
      if (!Object.keys(changes).length && !ruleChange) {
        closeDrawer(false);
        paintPlan();
        notify(scope === "series" && view.recurring ? "Series updated." : "Event saved.");
        return;
      }
      if (ruleChange) {
        if (view.recurring && scope !== "series") {
          if (!Object.keys(changes).length)
            return notify("A repeat rule changes the whole series. Choose all events in the series.");
        } else changes.recurrence = ruleChange;
      }
      const base = { title: view.title, description: view.description, location: view.location, startMs: view.startMs, endMs: view.endMs };
      const result = await providerApi().update(providerRef(view), base, changes, scope);
      if (result.conflict) return providerConflict(result, (fresh) => providerEditor({ ...fresh, id: view.id, meetingUrl: view.meetingUrl || "" }, false, "Changed in the calendar since you opened it. This is the newer version; your edits were not saved."));
      rememberEventLength(view.id || view.eventId, form.plannedEnd || view.end, form.actualEnd);
      closeDrawer(false);
      paintPlan();
      notify(scope === "series" && view.recurring ? "Series updated." : "Event saved.");
    } catch (error) {
      notify(error.message);
    } finally {
      if ($("drawer-save")) busy(false);
    }
  };
  if ($("event-duplicate"))
    $("event-duplicate").onclick = () => {
      const form = readProviderForm(view);
      if (form.error) return notify(form.error);
      const chosen = readRepeat(msToDate(form.startMs || view.startMs));
      if (chosen.error) return notify(chosen.error);
      state.drawerBaseline = drawerValues();
      providerEditor(
        {
          title: form.title || view.title,
          description: form.description,
          location: form.location,
          startMs: form.startMs,
          endMs: form.endMs,
          allDay: false,
          key: form.key,
          project: form.project,
          repeat: chosen.unchanged ? "" : chosen.repeat,
          repeatRule: chosen.unchanged ? null : chosen.repeatRule,
        },
        true,
      );
    };
  if ($("event-delete")) $("event-delete").onclick = () => confirmDeleteProviderEvent(view);
  if (isNew) $("event-title").focus();
}
function confirmDeleteProviderEvent(view) {
  $("event-delete-dialog")?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="confirm-backdrop" id="event-delete-dialog"><div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="event-delete-title"><h2 id="event-delete-title">Delete “${esc(view.title || "Event")}”?</h2><p>It is removed from ${esc(view.calendar || "the calendar")}.</p>${view.recurring ? `<label class="settings-toggle"><input type="radio" name="event-delete-scope" value="occurrence" checked><span>Only this event</span></label><label class="settings-toggle"><input type="radio" name="event-delete-scope" value="series"><span>All events in the series</span></label>` : ""}<div class="actions"><button class="quiet" id="cancel-delete-event" type="button">Cancel</button><button class="quiet danger-text" id="confirm-delete-event" type="button">Delete event</button></div></div></div>`,
  );
  const dialog = $("event-delete-dialog"),
    close = () => dialog.remove();
  $("cancel-delete-event").onclick = close;
  dialog.onclick = (event) => {
    if (event.target === dialog) close();
  };
  dialog.onkeydown = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  };
  $("confirm-delete-event").onclick = async () => {
    const scope = dialog.querySelector("[name=event-delete-scope]:checked")?.value || "occurrence";
    close();
    const base = { title: view.title, description: view.description, location: view.location, startMs: view.startMs, endMs: view.endMs };
    try {
      const result = await providerApi().remove(providerRef(view), base, scope);
      if (result.conflict) return providerConflict(result, (fresh) => providerEditor(fresh, false, "Changed in the calendar since you opened it, so it was not deleted. Check this newer version."));
      closeDrawer(false);
      paintPlan();
      notify(scope === "series" ? "Series deleted." : "Event deleted.");
    } catch (error) {
      notify(error.message);
    }
  };
  $("cancel-delete-event").focus();
}
/** Drag or resize of an editable provider event: re-read, compare, then save with If-Match. */
async function moveProviderEvent(event, startMs, endMs) {
  const api = providerApi();
  const previous = {
    startMs: event.startMs,
    endMs: event.endMs,
    start: event.start,
    end: event.end,
    date: event.date,
  };
  const paint = (start, end) => {
    event.startMs = start;
    event.endMs = end;
    event.date = msToDate(start);
    event.start = msToTime(start);
    const endLabel = msToTime(end);
    event.end = endLabel === "00:00" && end > start ? "24:00" : endLabel;
    repaintPlan();
  };
  paint(startMs, endMs);
  try {
    const view = await api.get(providerRef(event));
    if (view.removed || !view.editable) {
      Object.assign(event, previous);
      repaintPlan();
      return notify(view.removed ? "This event was deleted in the calendar." : "This calendar is read-only.");
    }
    if (view.startMs !== previous.startMs || view.endMs !== previous.endMs) {
      paint(view.startMs, view.endMs);
      return notify("This event changed in the calendar. Showing the newer version; it was not moved.");
    }
    let scope = "occurrence";
    if (view.recurring) {
      scope = await askSeriesScope("change");
      if (!scope) {
        Object.assign(event, previous);
        repaintPlan();
        return;
      }
    }
    const base = { title: view.title, description: view.description, location: view.location, startMs: view.startMs, endMs: view.endMs };
    const result = await api.update(providerRef(view), base, { startMs, endMs }, scope);
    if (result.conflict) {
      Object.assign(event, previous);
      repaintPlan();
      return providerConflict(result, (fresh) => providerEditor(fresh, false, "Changed in the calendar, so it was not moved. This is the newer version."));
    }
    notify(scope === "series" ? "Series moved." : view.recurring ? "This occurrence moved." : "Event moved.");
  } catch (error) {
    Object.assign(event, previous);
    repaintPlan();
    notify(error.message);
  }
}
/** Top and bottom edge resize for a planned task. The new length replaces the estimate. */
function bindTaskResize(block) {
  if (block.querySelector(".event-resize") || block.classList.contains("actual-block") || block.dataset.liveSession) return;
  const task = getTask(block.dataset.calendarTask);
  if (!task || realSessions(task).length) return;
  for (const edge of ["start", "end"]) {
    const handle = document.createElement("span");
    handle.className = edge === "start" ? "event-resize event-resize-top" : "event-resize";
    handle.title = edge === "start" ? "Drag to change the start" : "Drag to change the length";
    handle.setAttribute("aria-hidden", "true");
    handle.draggable = false;
    block.append(handle);
    handle.onpointerdown = (down) => {
      down.preventDefault();
      down.stopPropagation();
      const column = block.closest(".day-column");
      let startMinute = Number(block.dataset.blockStart);
      let endMinute = Number(block.dataset.blockEnd);
      const originalStart = startMinute, originalEnd = endMinute;
      handle.setPointerCapture(down.pointerId);
      block.classList.add("resizing");
      const move = (event) => {
        const slot = calendarSlotAt(column, event.clientX, event.clientY);
        if (edge === "end") endMinute = Math.max(startMinute + 15, Math.min(1440, slot.minute));
        else startMinute = Math.max(0, Math.min(endMinute - 15, slot.minute));
        block.style.top = calendarY(startMinute) + "px";
        block.style.height = calendarIntervalHeight(startMinute, endMinute) + "px";
      };
      const up = () => {
        handle.onpointermove = null;
        handle.onpointerup = null;
        block.classList.remove("resizing");
        block.dataset.resized = "1";
        setTimeout(() => delete block.dataset.resized, 0);
        if (startMinute === originalStart && endMinute === originalEnd) return;
        task.date = calmWeekDate(Number(column.dataset.day));
        task.schedule = timeString(startMinute);
        task.planMinutes = endMinute - startMinute;
        task.estimate = task.planMinutes;
        task.today = task.date === calmToday();
        task.actual = null;
        repaintPlan();
        notify(edge === "start" ? "Planned start updated." : "Planned length updated.");
      };
      handle.onpointermove = move;
      handle.onpointerup = up;
    };
  }
}
/** Top and bottom edge resize for editable events (provider and local). */
function bindEventResize(block) {
  if (block.querySelector(".event-resize")) return;
  const id = block.dataset.event,
    local = localEventOccurrences().find((e) => e.id === id && e.owned),
    provider = !local && calendarEvents()[id];
  if (!local && !(isEditableProviderEvent(provider) && !provider.allDay && provider.endMs - provider.startMs < 86400000)) return;
  for (const edge of ["start", "end"]) {
    const handle = document.createElement("span");
    handle.className = edge === "start" ? "event-resize event-resize-top" : "event-resize";
    handle.title = edge === "start" ? "Drag to change the start time" : "Drag to change the end time";
    handle.setAttribute("aria-hidden", "true");
    handle.draggable = false;
    block.append(handle);
    handle.onpointerdown = (down) => {
      down.preventDefault();
      down.stopPropagation();
      const column = block.closest(".day-column");
      let startMinute = Number(block.dataset.blockStart);
      let endMinute = Number(block.dataset.blockEnd);
      const originalStart = startMinute, originalEnd = endMinute;
      handle.setPointerCapture(down.pointerId);
      block.classList.add("resizing");
      const move = (event) => {
        const slot = calendarSlotAt(column, event.clientX, event.clientY);
        if (edge === "end") endMinute = Math.max(startMinute + 15, Math.min(1440, slot.minute));
        else startMinute = Math.max(0, Math.min(endMinute - 15, slot.minute));
        block.style.top = calendarY(startMinute) + "px";
        block.style.height = calendarIntervalHeight(startMinute, endMinute) + "px";
      };
      const up = async () => {
        handle.onpointermove = null;
        handle.onpointerup = null;
        block.classList.remove("resizing");
        block.dataset.resized = "1";
        setTimeout(() => delete block.dataset.resized, 0);
        if (startMinute === originalStart && endMinute === originalEnd) return;
        if (local) {
          const start = timeString(startMinute);
          const end = timeString(endMinute === 1440 ? 1439 : endMinute);
          const storedDirect = state.localEvents.find((event) => event.id === local.id);
          if (storedDirect?.seriesId && !storedDirect.repeat) {
            storedDirect.start = start;
            storedDirect.end = end;
            repaintPlan();
            notify(edge === "start" ? "Event start changed." : "Event length changed.");
            return;
          }
          const master = localMaster(local);
          const series = Boolean(master?.repeat || local.recurring);
          if (!series || !master) {
            const stored = state.localEvents.find((event) => event.id === local.id) || local;
            stored.start = start;
            stored.end = end;
            repaintPlan();
            notify(edge === "start" ? "Event start changed." : "Event length changed.");
            return;
          }
          const scope = await askSeriesScope("change");
          if (!scope) {
            repaintPlan();
            return;
          }
          if (scope === "series") {
            master.start = start;
            master.end = end;
          } else {
            master.skipDates = [...new Set([...(master.skipDates || []), local.date])];
            state.localEvents.push({
              ...master,
              id: "event-" + Date.now(),
              date: local.date,
              start,
              end,
              repeat: "",
              repeatRule: null,
              seriesId: master.id,
              recurring: false,
              skipDates: [],
              owned: true,
            });
          }
          repaintPlan();
          notify(scope === "series" ? "Series updated." : edge === "start" ? "Event start changed." : "Event length changed.");
        } else {
          const dayStart = dateTimeToMs(provider.date, "00:00");
          void moveProviderEvent(
            provider,
            edge === "start" ? dayStart + startMinute * 60000 : provider.startMs,
            edge === "end" ? dayStart + endMinute * 60000 : provider.endMs,
          );
        }
      };
      handle.onpointermove = move;
      handle.onpointerup = up;
    };
  }
}
/** Press and drag on empty calendar space to choose a time, then name the task. */
function bindCreateDrag(column) {
  if (isPhoneUi()) {
    column.onpointerdown = null;
    return;
  }
  column.onpointerdown = (down) => {
    if (down.button !== 0 || down.target.closest(".calendar-block,.event-resize")) return;
    const from = calendarSlotAt(column, down.clientX, down.clientY);
    let to = from.minute,
      dragging = false,
      marker = null;
    const move = (event) => {
      if (!dragging && Math.abs(event.clientY - down.clientY) < 8) return;
      dragging = true;
      to = calendarSlotAt(column, event.clientX, event.clientY).minute;
      if (!marker) {
        marker = document.createElement("div");
        marker.className = "calendar-range";
        column.append(marker);
      }
      const a = Math.min(from.minute, to),
        b = Math.max(from.minute, to);
      marker.style.top = calendarY(a) + "px";
      marker.style.height = Math.max(6, calendarY(b) - calendarY(a)) + "px";
      marker.dataset.label = `${timeString(a)}–${timeString(b)}`;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      marker?.remove();
      if (!dragging) return;
      column.dataset.dragCreated = "1";
      setTimeout(() => delete column.dataset.dragCreated, 0);
      const a = Math.min(from.minute, to),
        b = Math.max(from.minute, to);
      state.calendarSlot = { day: from.day, minute: a };
      state.calendarSlotEnd = Math.max(a + 15, b);
      state.planSelectedTask = null;
      openCalendarCreate("task");
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  };
}
function updateCompletion() {
  const value = $("add-title").value,
    match = value.match(/(?:^|\s)(\+[^\s]*|@[^\s]*|t\d*m?)$/);
  state.completion = "";
  $("add-ghost").innerHTML = "";
  $("accept-completion").hidden = true;
  if (!match) return;
  const token = match[1];
  const choices = token.startsWith("+")
    ? projects.map((project) => "+" + projectToken(project))
    : token.startsWith("@")
      ? [
          "@today",
          "@tomorrow",
          "@09:00",
          "@10:00",
          "@16:00",
          "@every friday",
          "@every week",
        ]
      : ["t15m", "t25m", "t30m", "t60m"];
  const choice = choices.find(
    (c) => c.toLowerCase().startsWith(token.toLowerCase()) && c !== token,
  );
  if (!choice) return;
  state.completion = value.slice(0, value.lastIndexOf(token)) + choice;
  $("add-ghost").innerHTML =
    `<span class="ghost-prefix">${esc(value)}</span><span>${esc(choice.slice(token.length))}</span>`;
  $("accept-completion").hidden = false;
  $("accept-completion").innerHTML =
    `<span>${choice.startsWith("+") ? esc(projects.find((project) => "+" + projectToken(project) === choice) || choice) : esc(choice)}</span><kbd>Tab</kbd> Accept`;
}
function acceptCompletion() {
  if (!state.completion) return;
  $("add-title").value = state.completion + " ";
  $("add-title").focus();
  $("add-title").setSelectionRange(
    $("add-title").value.length,
    $("add-title").value.length,
  );
  updateAddLabels();
}
function addShareLinks() {
  const url =
    state.view === "bookings"
      ? "https://example.test/booking/intro"
      : "https://example.test/poll/team-planning";
  const panel = document.createElement("section");
  panel.className = "share-preview";
  panel.innerHTML = `<h3>Example share page</h3><p class="muted">A public page with only the published meeting or poll.</p><div class="share-line"><input value="${url}" readonly aria-label="Example share link"><button class="quiet" id="copy-share">Copy link</button><button class="quiet" data-show="${state.view === "bookings" ? "public-booking" : "public-poll"}">Preview page</button></div>`;
  $("screen").append(panel);
  $("copy-share").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url);
      notify("Example link copied");
    } catch {
      panel.querySelector("input").select();
      notify("Select and copy the example link");
    }
  };
}

$("accept-completion").onclick = acceptCompletion;
$("add-title").addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !event.shiftKey && state.completion) {
    event.preventDefault();
    event.stopPropagation();
    acceptCompletion();
  }
});
document.addEventListener("click", (event) => {
  const create = event.target.closest("[data-create-kind]");
  if (create) {
    openCalendarCreate(create.dataset.createKind);
    return;
  }
});
document.addEventListener(
  "keydown",
  (event) => {
    if (activeModal()) return;
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      !$("drawer").hidden &&
      !$("drawer-save").hidden
    ) {
      event.preventDefault();
      event.stopPropagation();
      $("drawer-save").click();
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "Enter" &&
      state.view === "reports" &&
      state.reportEdit !== null
    ) {
      event.preventDefault();
      event.stopPropagation();
      saveEntry(state.reportEdit);
      return;
    }
    const reportRow = event.target.closest("[data-report-row]");
    if (
      reportRow &&
      event.key === "Enter" &&
      !event.target.matches("input,select,textarea")
    ) {
      event.preventDefault();
      event.stopPropagation();
      state.reportEdit = Number(reportRow.dataset.reportRow);
      renderScreen();
      ($("entry-project-search") || $("entry-project"))?.focus();
      return;
    }
    const row = event.target.closest("[data-row]");
    if (state.view === "plan" && row && event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      state.planSelectedTask = row.dataset.row;
      state.slotVisible = true;
      closeDrawer(false);
      showPlanSlot();
      return;
    }
    if (state.view === "plan" && row && event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      openTask(row.dataset.row);
    }
  },
  true,
);

function plannedLength(task) {
  const plan = Number(task.planMinutes);
  if (plan > 0) return plan;
  const estimate = Number(task.estimate);
  if (estimate > 0) return estimate;
  return 30;
}
function realSessions(task) {
  return state.sessions.filter(
    (session) => session.id === task.id && session.source !== "plan" && (Number(session.duration) || 0) > 0,
  );
}
function sessionsCoverPlan(task) {
  return state.sessions.some((session) => session.id === task.id && (Number(session.duration) || 0) > 0);
}
function dropPlannedSessions(task) {
  for (let index = state.sessions.length - 1; index >= 0; index -= 1)
    if (state.sessions[index].id === task.id && state.sessions[index].source === "plan")
      state.sessions.splice(index, 1);
  if (task.actual?.source === "plan") task.actual = realSessions(task).at(-1) || null;
}
function adoptPlannedTime(task, replace = false) {
  if (!task) return;
  if (realSessions(task).length) {
    dropPlannedSessions(task);
    return;
  }
  if (!task.date || !task.schedule) return;
  if (replace) dropPlannedSessions(task);
  else if (state.sessions.some((session) => session.id === task.id && session.source === "plan")) return;
  const start = minutes(task.schedule);
  const end = Math.min(1440, start + plannedLength(task));
  if (end <= start) return;
  const session = {
    sessionKey: crypto.randomUUID(),
    id: task.id,
    title: task.title,
    project: task.project,
    date: task.date,
    start: timeString(start),
    end: timeString(end),
    startMinute: start,
    endMinute: end,
    duration: end - start,
    focusedSeconds: (end - start) * 60,
    estimate: task.estimate,
    recorded: true,
    source: "plan",
  };
  state.sessions.push(session);
  task.actual = session;
}
function taskTimeLabel(task) {
  const live = state.active === task.id ? state.seconds / 60 : 0;
  const tracked = realSessions(task).reduce((sum, session) => sum + (Number(session.duration) || 0), 0) + live;
  if (tracked > 0) return { label: "Tracked", minutes: tracked };
  const planned = state.sessions
    .filter((session) => session.id === task.id && session.source === "plan")
    .reduce((sum, session) => sum + (Number(session.duration) || 0), 0);
  if (planned > 0) return { label: "Planned", minutes: planned };
  if (task.date && task.schedule) return { label: "Planned", minutes: plannedLength(task) };
  return { label: "Tracked", minutes: 0 };
}
function mirrorSpan(task) {
  const session = realSessions(task).at(-1);
  if (session?.date && session.start) {
    const length = Math.max(
      1,
      Math.min(
        1440,
        Math.round(
          (session.endMinute ?? minutes(session.end)) - (session.startMinute ?? minutes(session.start)) ||
            session.duration ||
            1,
        ),
      ),
    );
    return { date: session.date, start: String(session.start).slice(0, 5), minutes: length };
  }
  if (!task.date || !task.schedule) return null;
  return {
    date: task.date,
    start: String(task.schedule).slice(0, 5),
    minutes: Math.max(1, Math.min(1440, Math.round(plannedLength(task)))),
  };
}
function planningStatus(task) {
  if (task.done || state.active === task.id || realSessions(task).length) return null;
  if (!task.date || !task.schedule) return "Unplanned";
  const end = minutes(task.schedule) + plannedLength(task);
  if (
    task.date < calmToday() ||
    (task.date === calmToday() && end <= state.nowMinute)
  )
    return "Needs replanning";
  return null;
}
function dayBlocks(day) {
  const date = calmWeekDate(day);
  const active = getTask(state.active);
  const livePlan = active && state.liveSession ? { ...state.liveSession } : null;
  if (livePlan) {
    const start =
      livePlan.startTimestamp ??
      new Date((livePlan.date || calmToday()) + "T00:00:00").getTime() +
        (livePlan.startMinute || 0) * 60000;
    livePlan.endTimestamp = Math.max(livePlan.endTimestamp ?? start, start + 60000);
  }
  const liveInterval = livePlan ? sessionIntervalOnDate(livePlan, date) : null;
  const live = liveInterval
    ? [
        {
          key: "live-" + active.id,
          kind: "task",
          id: active.id,
          title: active.title,
          ...liveInterval,
        },
      ]
    : [];
  return [
    ...live,
    ...tasks
      .filter((t) => t.date && t.schedule && t.id !== state.active && !sessionsCoverPlan(t))
      .flatMap((t) => {
        const start = minutes(t.schedule);
        const interval = sessionIntervalOnDate(
          {
            date: t.date,
            startMinute: start,
            endMinute: start + plannedLength(t),
          },
          date,
        );
        return interval
          ? [
              {
                key: "task-" + t.id,
                kind: "task",
                id: t.id,
                title: t.title,
                ...interval,
              },
            ]
          : [];
      }),
    ...state.sessions.flatMap((session, i) => {
      if (session.source === "plan" && realSessions(getTask(session.id) || { id: session.id }).length) return [];
      const interval = sessionIntervalOnDate(session, date);
      return interval
        ? [
            {
              key: "actual-" + i,
              kind: "actual",
              id: session.id,
              title: getTask(session.id)?.title || session.title,
              recordedMinutes:
                session.source === "plan"
                  ? null
                  : session.dailyMs?.[date] != null
                    ? session.dailyMs[date] / 60000
                    : session.duration,
              ...interval,
            },
          ]
        : [];
    }),
    ...allEvents()
      .filter((e) => e.date === date && !e.allDay)
      .map((e) => ({
        key: "event-" + e.id,
        kind: "event",
        id: e.id,
        title: e.title,
        start: minutes(e.start),
        end: minutes(shownEventEnd(e)),
        busy: e.busy !== false,
      })),
  ].filter((b) => b.end > b.start);
}
function conflictsFor(block, all) {
  return all.filter(
    (b) =>
      block.busy !== false &&
      b.busy !== false &&
      b.key !== block.key &&
      block.start < b.end &&
      b.start < block.end,
  );
}
function updateInboxCount() {
  const button = document.querySelector(".nav-item[data-show=inbox]");
  if (!button) return;
  const taskCount = tasks.filter((t) => !t.project && !t.done).length;
  const count = taskCount + unassignedEvents().length;
  let badge = button.querySelector(".inbox-count");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "inbox-count";
    button.append(badge);
  }
  badge.textContent = count;
  badge.hidden = !count;
  button.setAttribute(
    "aria-label",
    `Clean, ${taskCount} tasks to organize${count > taskCount ? `, ${count - taskCount} events` : ""}`,
  );
}
function conflictSummary() {
  const pairs = [];
  for (const day of state.calendarMode === "day"
    ? [state.calendarSlot.day]
    : calendarDays()) {
    const all = dayBlocks(day);
    all.forEach((a, i) =>
      all.slice(i + 1).forEach((b) => {
        if (
          a.busy !== false &&
          b.busy !== false &&
          a.start < b.end &&
          b.start < a.end
        )
          pairs.push(`${a.title} / ${b.title}`);
      }),
    );
  }
  return pairs.length
    ? `<span class="calendar-conflict-notice" role="status" title="Check the marked blocks before planning more time." aria-label="${pairs.length} overlap${pairs.length === 1 ? "" : "s"}. Check the marked calendar blocks.">${pairs.length} overlap${pairs.length === 1 ? "" : "s"}</span>`
    : "";
}
function durationLabel(minute) {
  const seconds = Math.round(minute * 60);
  return seconds % 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds / 60}m`;
}

// Reports only. Minutes under an hour, then hours, days, 30-day months,
// and years of 12 such months. One remainder unit, same shape as "59m 30s".
function reportDuration(minute) {
  const seconds = Math.round(Number(minute) * 60);
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const minuteSeconds = 60;
  const hour = 60 * minuteSeconds;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 12 * month;
  const pair = (count, unit, rest, restUnit) =>
    rest ? `${count}${unit} ${rest}${restUnit}` : `${count}${unit}`;
  if (seconds >= year)
    return pair(
      Math.floor(seconds / year),
      "y",
      Math.floor((seconds % year) / month),
      "mo",
    );
  if (seconds >= month)
    return pair(
      Math.floor(seconds / month),
      "mo",
      Math.floor((seconds % month) / day),
      "d",
    );
  if (seconds >= day)
    return pair(
      Math.floor(seconds / day),
      "d",
      Math.floor((seconds % day) / hour),
      "h",
    );
  if (seconds >= hour)
    return pair(
      Math.floor(seconds / hour),
      "h",
      Math.floor((seconds % hour) / minuteSeconds),
      "m",
    );
  return seconds % minuteSeconds
    ? `${Math.floor(seconds / minuteSeconds)}m ${seconds % minuteSeconds}s`
    : `${Math.floor(seconds / minuteSeconds)}m`;
}

function nextCommitment() {
  const now =
    new Date(calmToday() + "T00:00:00").getTime() + state.nowMinute * 60000;
  const choices = [
    ...tasks
      .filter(
        (t) =>
          !t.done && t.id !== state.active && t.date && t.schedule && !t.actual,
      )
      .map((t) => ({
        id: t.id,
        title: t.title,
        date: t.date,
        start: t.schedule,
        kind: "task",
      })),
    ...allEvents().map((e) => ({
      ...e,
      kind: "event",
    })),
  ]
    .map((item) => ({
      ...item,
      timestamp: new Date(item.date + "T" + item.start).getTime(),
    }))
    .filter((item) => item.busy !== false && item.timestamp > now)
    .sort((a, b) => a.timestamp - b.timestamp);
  return choices[0]
    ? {
        ...choices[0],
        inMinutes: Math.ceil((choices[0].timestamp - now) / 60000),
      }
    : null;
}
function upcomingCommitment() {
  const next = nextCommitment();
  if (!next) return "";
  const wait =
    next.inMinutes < 60
      ? next.inMinutes + " min"
      : next.inMinutes < 1440
        ? Math.floor(next.inMinutes / 60) +
          "h" +
          (next.inMinutes % 60 ? " " + (next.inMinutes % 60) + "m" : "")
        : Math.floor(next.inMinutes / 1440) + "d " + next.start;
  return `<button class="commitment" ${next.kind === "task" ? `data-detail="${next.id}"` : `data-event="${esc(next.id)}"`} aria-label="Next ${next.kind}: ${esc(next.title)}, in ${next.inMinutes} minutes"><span><span class="commitment-label">Next</span> ${esc(next.title)} <strong>In ${wait}</strong></span><small>${next.kind === "task" ? "Planned task" : "Event"}${next.date !== calmToday() ? " · "+(next.date===calmTomorrow()?"Tomorrow":new Date(next.date+"T12:00:00").toLocaleDateString([], {month:"short",day:"numeric"})) : ""} · ${next.start}</small></button>`;
}
function projectToken(project) {
  return project
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function projectsView() {
  const list = projects
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => matches({ title: name, project: "" }, state.filter));
  return `<div class="projects-heading">${listFilter("Find a project", "task-filter", state.filter, projects.length)}<button class="icon-btn" id="new-project" aria-label="New project" title="New project">${svg("plus")}</button></div><div class="project-list">${list.map(({ name, index }) => `<div class="project-row"><button class="project-name" data-project-index="${index}">${esc(name)}</button><small>${tasks.filter((t) => t.project === name && !t.done).length} open</small><button class="icon-btn project-detail" data-project-detail="${index}" aria-label="Details for ${esc(name)}" title="Project details">${svg("details")}</button></div>`).join("") || '<p class="empty">' + (projects.length ? "No matching project." : "Create a project to organize tasks.") + "</p>"}</div>`;
}
function openProject(index, details = false) {
  if (guardDrawerChange(() => openProject(index, details))) return;
  state.projectName = projects[index];
  if (details) projectEditor();
  else show("project");
}
function projectEditor(isNew = false, notesOnly = false) {
  if (guardDrawerChange(() => projectEditor(isNew, notesOnly))) return;
  const name = isNew ? "" : calmSelectedProject();
  const notes = state.projectNotes?.[name] || "";
  const calendarValue =
    !isNew && state.projectCalendars && Object.prototype.hasOwnProperty.call(state.projectCalendars, name)
      ? state.projectCalendars[name] || ""
      : "";
  openDrawer(
    isNew ? "New project" : notesOnly ? "Project notes" : "Project details",
    `${notesOnly ? "" : `<label class="field"><span>Project name</span><input id="project-name" value="${esc(name)}"></label>${calendarChoiceField("project-calendar", calendarValue, name)}`}<label class="field"><span>Notes</span><textarea id="project-notes" rows="6">${esc(notes)}</textarea></label>`,
  );
  if (!isNew && window.calmSharedProjects?.includes(name) && $("project-name")) $("project-name").disabled = true;
  if (!isNew && !notesOnly) {
    $("drawer-content").insertAdjacentHTML("beforeend", '<div class="task-delete-area"><button class="quiet danger-text" id="delete-project" type="button">Delete project</button></div>');
    $("delete-project").onclick = () => confirmDeleteProject(name);
  }
  $("drawer-save").hidden = false;
  $("drawer-save").textContent = isNew ? "Create project" : "Save edits";
  $("drawer-save").onclick = () => {
    const next = notesOnly ? name : $("project-name").value.trim();
    clearDrawerErrors();
    if (!next)
      return drawerFieldError($("project-name"), "Enter a project name.");
    if (
      (isNew || next !== name) &&
      projects.some((p) => p.toLowerCase() === next.toLowerCase())
    )
      return notify("A project with this name already exists.");
    if ($("project-calendar")) {
      const chosen = $("project-calendar").value;
      const targets = window.calmMirror?.targets || [];
      if (targets.length && !chosen)
        return drawerFieldError($("project-calendar"), "Choose a calendar for this project.");
      const owner = calendarOwner(chosen, isNew ? "" : name);
      if (owner) return notify(`That calendar is already used by ${owner}.`);
    }
    state.projectNotes ||= {};
    if (isNew) projects.push(next);
    else if (next !== name) {
      projects.splice(projects.indexOf(name), 1, next);
      tasks.forEach((t) => {
        if (t.project === name) t.project = next;
      });
      state.sessions.forEach((s) => {
        if (s.project === name) s.project = next;
      });
      state.localEvents.forEach((event) => {
        if (event.project === name) event.project = next;
      });
      for (const meta of Object.values(state.eventMeta || {})) if (meta?.project === name) meta.project = next;
      state.projectRenames[name] = next;
      if (state.projectFilter === name) state.projectFilter = next;
      if (state.reportProject === name) state.reportProject = next;
      if (state.add.project === name) state.add.project = next;
      delete state.projectNotes[name];
      if (state.projectCalendars) delete state.projectCalendars[name];
    }
    if ($("project-calendar")) {
      state.projectCalendars ||= {};
      const chosen = $("project-calendar").value;
      if (chosen) state.projectCalendars[next] = chosen;
      else delete state.projectCalendars[next];
    }
    state.projectNotes[next] = $("project-notes").value;
    state.projectName = next;
    closeDrawer(false);
    renderScreen();
    notify(isNew ? "Project created." : "Project saved.");
  };
  $(notesOnly ? "project-notes" : "project-name").focus();
}
function confirmDeleteProject(name) {
  if (!name || !projects.includes(name)) return;
  if (window.calmSharedProjects?.includes(name))
    return notify("Disconnect the shared workspace before deleting this project.");
  const count = tasks.filter((t) => t.project === name).length;
  // The drawer traps clicks outside itself, so close it before asking.
  if (!$("drawer").hidden) closeDrawer(false);
  $("project-delete-dialog")?.remove();
  document.body.insertAdjacentHTML(
    "beforeend",
    `<div class="confirm-backdrop" id="project-delete-dialog"><div class="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="project-delete-title"><h2 id="project-delete-title">Delete “${esc(name)}”?</h2><p>${count ? `It has ${count} task${count === 1 ? "" : "s"}.` : "It has no tasks."}</p>${count ? `<label class="settings-toggle"><input type="radio" name="project-delete-mode" value="move" checked><span>Move tasks to Inbox</span></label><label class="settings-toggle"><input type="radio" name="project-delete-mode" value="delete"><span>Delete tasks and their recorded time too</span></label>` : ""}<div class="actions"><button class="quiet" id="cancel-delete-project" type="button">Cancel</button><button class="quiet danger-text" id="confirm-delete-project" type="button">Delete project</button></div></div></div>`,
  );
  const dialog = $("project-delete-dialog"),
    close = () => dialog.remove();
  $("cancel-delete-project").onclick = close;
  // Handlers use blocks: an on* handler returning false would cancel the event.
  dialog.onclick = (event) => {
    if (event.target === dialog) close();
  };
  dialog.onkeydown = (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    close();
  };
  $("confirm-delete-project").onclick = () => {
    const mode = dialog.querySelector("[name=project-delete-mode]:checked")?.value || "move";
    close();
    deleteProject(name, mode);
  };
  $("cancel-delete-project").focus();
}
function deleteProject(name, mode) {
  for (const task of tasks.filter((t) => t.project === name)) {
    if (mode === "delete") {
      if (state.active === task.id) {
        state.active = null;
        state.running = false;
        state.seconds = 0;
      }
      state.deletedTaskIds.push(task.id);
      tasks.splice(tasks.indexOf(task), 1);
      state.sessions = state.sessions.filter((s) => s.id !== task.id);
      if (state.reportTask === task.id) state.reportTask = "all";
    } else task.project = "";
  }
  state.sessions.forEach((s) => {
    if (s.project === name) s.project = "";
  });
  projects.splice(projects.indexOf(name), 1);
  state.deletedProjects.push(name);
  if (state.projectNotes) delete state.projectNotes[name];
  if (state.projectCalendars) delete state.projectCalendars[name];
  for (const key of ["projectFilter", "reportProject"])
    if (state[key] === name) state[key] = key === "reportProject" ? "all" : "";
  if (state.add?.project === name) state.add.project = "";
  if (!$("drawer").hidden) closeDrawer(false);
  state.selected = null;
  if (["project", "project-board"].includes(state.view) && state.projectName === name) state.view = "projects";
  state.projectName = "";
  renderScreen();
  notify(mode === "delete" ? "Project and its tasks deleted." : "Project deleted. Its tasks are in Inbox.");
}
document.addEventListener("contextmenu", (event) => {
  const row = event.target.closest?.(".project-row");
  const button = row?.querySelector("[data-project-index]");
  if (!button || window.calmReference) return;
  event.preventDefault();
  const name = projects[Number(button.dataset.projectIndex)];
  $("project-context-menu")?.remove();
  document.body.insertAdjacentHTML("beforeend", `<div class="context-menu" id="project-context-menu" role="menu" style="left:${Math.min(event.clientX, innerWidth - 200)}px;top:${Math.min(event.clientY, innerHeight - 120)}px"><button role="menuitem" data-menu="open">Open</button><button role="menuitem" data-menu="details">Project details</button><button role="menuitem" class="danger-text" data-menu="delete">Delete project…</button></div>`);
  const menu = $("project-context-menu"),
    close = () => { menu.remove(); document.removeEventListener("pointerdown", outside, true); };
  const outside = (e) => {
    if (!menu.contains(e.target)) close();
  };
  document.addEventListener("pointerdown", outside, true);
  menu.onkeydown = (e) => {
    if (e.key === "Escape") close();
  };
  menu.onclick = (e) => {
    const action = e.target.closest("[data-menu]")?.dataset.menu;
    if (!action) return;
    close();
    const index = projects.indexOf(name);
    if (action === "open") openProject(index);
    else if (action === "details") openProject(index, true);
    else confirmDeleteProject(name);
  };
  menu.querySelector("button").focus();
});
function projectField(id, value) {
  return `<div class="project-picker"><select id="${id}" hidden aria-hidden="true" tabindex="-1"><option value="">No project (Inbox)</option>${projects.map((p) => `<option ${p === value ? "selected" : ""}>${esc(p)}</option>`).join("")}</select><input id="${id}-search" role="combobox" aria-label="Filter projects" aria-autocomplete="list" aria-controls="${id}-options" aria-expanded="false" autocomplete="off" placeholder="Find a project…" value="${esc(value)}"><div id="${id}-options" role="listbox" hidden></div></div>`;
}
function bindProjectPicker(id) {
  const select = $(id),
    input = $(id + "-search"),
    list = $(id + "-options");
  if (!input) return;
  let index = 0,
    options = [];
  const choose = (value) => {
    select.value = value;
    input.value = value;
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const draw = () => {
    options = ["", ...projects].filter((p) =>
      (p || "No project Inbox")
        .toLowerCase()
        .includes(input.value.toLowerCase()),
    );
    index = Math.min(index, options.length - 1);
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    list.innerHTML = options.length
      ? options
          .map(
            (p, i) =>
              `<button type="button" role="option" id="${id}-option-${i}" aria-selected="${i === index}" data-option="${i}">${esc(p || "No project (Inbox)")}</button>`,
          )
          .join("")
      : '<p class="empty">No matching project.</p>';
    if (index >= 0)
      input.setAttribute("aria-activedescendant", id + "-option-" + index);
    list.querySelectorAll("[data-option]").forEach(
      (b) =>
        (b.onmousedown = (e) => {
          e.preventDefault();
          choose(options[Number(b.dataset.option)]);
        }),
    );
  };
  input.onfocus = () => {
    input.select();
    index = 0;
    draw();
  };
  input.oninput = () => {
    index = 0;
    draw();
  };
  input.onkeydown = (e) => {
    if (["ArrowDown", "ArrowUp"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      index = Math.max(
        0,
        Math.min(options.length - 1, index + (e.key === "ArrowDown" ? 1 : -1)),
      );
      draw();
    }
    if (
      ["Enter", "Tab"].includes(e.key) &&
      !list.hidden &&
      options[index] !== undefined
    ) {
      if (e.key === "Enter") e.preventDefault();
      e.stopPropagation();
      choose(options[index]);
    }
    if (e.key === "Escape" && !list.hidden) {
      e.preventDefault();
      e.stopPropagation();
      input.value = select.value;
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  };
  input.onblur = () => {
    list.hidden = true;
    input.value = select.value;
    input.setAttribute("aria-expanded", "false");
  };
}

function sessionIntervalOnDate(session, date) {
  const base = new Date((session.date || calmToday()) + "T00:00:00").getTime();
  const start =
    session.startTimestamp ??
    base + (session.startMinute ?? minutes(session.start)) * 60000;
  const end =
    session.endTimestamp ??
    base + (session.endMinute ?? minutes(session.end)) * 60000;
  const day = new Date(date + "T00:00:00").getTime(),
    next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + 1);
  if (end <= day || start >= next.getTime()) return null;
  return {
    start: Math.max(0, (start - day) / 60000),
    end: Math.min((next.getTime() - day) / 60000, (end - day) / 60000),
  };
}

// Capture/help own input while open; the workspace remains visible but inactive.
const modalObserver = new MutationObserver(() => {
  $("app").inert = Boolean(activeModal());
});
[$("time-overlay"), $("add-overlay"), $("help-overlay")].forEach((overlay) =>
  modalObserver.observe(overlay, {
    attributes: true,
    attributeFilter: ["hidden"],
  }),
);
$("drawer-content").addEventListener("input", (event) => {
  if (event.target.hasAttribute("aria-invalid")) clearDrawerErrors();
});

document.addEventListener("dragend", () => {
  document
    .querySelectorAll(".day-column.drop-over")
    .forEach((el) => el.classList.remove("drop-over"));
  if (state.view === "plan") {
    state.slotVisible = false;
    document
      .querySelectorAll(".calendar-selected")
      .forEach((el) => el.remove());
  }
});
