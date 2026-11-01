import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export const same = (left, right) => {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
export const fail = (code, message) => {
  throw Object.assign(new Error(message), { statusCode: code });
};
export function text(value, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    fail(400, "Enter a valid text value.");
  return value.trim();
}
export function calendarDay(value) {
  const result = text(value, 10),
    parsed = new Date(result + "T00:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  )
    fail(400, "Use a valid planned day.");
  return result;
}
export function instant(value) {
  if (
    typeof value !== "string" ||
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(400, "Use a date and time with a UTC offset.");
  return new Date(value).toISOString();
}
export function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max)
    fail(400, "Number is outside the allowed range.");
  return value;
}
export function zone(value) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    fail(400, "Invalid time zone.");
  }
  return text(value, 100);
}
export function clock(value) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    fail(400, "Invalid time.");
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
export function pageInput(body) {
  const availability = body.availability;
  if (
    !Array.isArray(availability) ||
    availability.length < 1 ||
    availability.length > 28
  )
    fail(400, "Add weekly availability.");
  return {
    title: text(body.title),
    durationMinutes: integer(body.durationMinutes, 5, 480),
    bufferMinutes: integer(body.bufferMinutes ?? 0, 0, 240),
    minimumNoticeMinutes: integer(body.minimumNoticeMinutes ?? 60, 0, 43200),
    timeZone: zone(body.timeZone),
    availability: availability.map((row) => {
      const weekday = integer(row.weekday, 0, 6),
        start = clock(row.start),
        end = clock(row.end);
      if (end <= start) fail(400, "Availability must end after it starts.");
      return { weekday, start: row.start, end: row.end };
    }),
  };
}
export function localParts(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      parts.weekday,
    ),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}
export function available(host, page, startValue, now = Date.now()) {
  const start = Date.parse(startValue),
    end = start + page.durationMinutes * 60000;
  if (
    start < now + page.minimumNoticeMinutes * 60000 ||
    start > now + 90 * 86400000
  )
    return false;
  const local = localParts(new Date(start), page.timeZone),
    finish = localParts(new Date(end), page.timeZone);
  if (
    local.date !== finish.date ||
    !page.availability.some(
      (row) =>
        row.weekday === local.weekday &&
        local.minute >= clock(row.start) &&
        finish.minute <= clock(row.end),
    )
  )
    return false;
  const buffer = page.bufferMinutes * 60000;
  if (
    host.busyRequired &&
    (!host.busyUpdatedAt || now - host.busyUpdatedAt > 5 * 60000)
  )
    return false;
  return ![...host.busy, ...host.bookings.filter((b) => !b.cancelled)].some(
    (b) =>
      start <
        Date.parse(b.end) + Math.max(buffer, (b.bufferMinutes || 0) * 60000) &&
      end >
        Date.parse(b.start) - Math.max(buffer, (b.bufferMinutes || 0) * 60000),
  );
}
export function pollInput(body) {
  if (
    !Array.isArray(body.options) ||
    body.options.length < 1 ||
    body.options.length > 100
  )
    fail(400, "Add 1–100 poll options.");
  const options = body.options.map((row) => {
    const start = instant(row.start),
      end = instant(row.end);
    if (end <= start) fail(400, "Poll end must follow start.");
    return { id: token(), start, end, timeZone: zone(row.timeZone || "UTC") };
  });
  const expiresAt = instant(body.expiresAt);
  if (
    Date.parse(expiresAt) <= Date.now() ||
    Date.parse(expiresAt) > Date.now() + 180 * 86400000
  )
    fail(400, "Poll expiry must be within 180 days.");
  return {
    title: text(body.title),
    options,
    expiresAt,
    votes: [],
    finalized: null,
    closed: false,
  };
}
export function memberFor(workspace, bearer, write = false) {
  const member = workspace.members.find(
    (m) => same(m.tokenHash, digest(bearer)) && !m.revoked,
  );
  if (!member) fail(403, "Workspace access was revoked or not granted.");
  if (write && member.role === "viewer")
    fail(403, "This workspace is read-only.");
  return member;
}
export function applyOperation(workspace, input, member) {
  const opId = text(input.id, 100);
  const known = workspace.receipts.find(
    (r) => r.id === opId && r.memberId === member.id,
  );
  const signature = digest(JSON.stringify(input));
  if (known) {
    if (known.signature !== signature)
      fail(409, "Operation ID was reused with different content.");
    return known.result;
  }
  if (input.baseRevision !== workspace.projectRevision)
    fail(409, "Shared project changed. Review remote changes before retrying.");
  const projectId = text(input.projectId, 100),
    project = workspace.projects.find((p) => p.id === projectId);
  if (!project) fail(404, "Shared project not found.");
  if (input.kind === "task.upsert") {
    const task = input.task || {},
      id = text(task.id, 100);
    if (workspace.tombstones.includes(projectId + ":" + id))
      fail(409, "This task was deleted. Restore it as a new task.");
    const existing = project.tasks.find((t) => t.id === id);
    if (
      task.assignee &&
      !workspace.members.some((m) => m.id === task.assignee && !m.revoked)
    )
      fail(400, "Assignee is not an active member.");
    const next = {
      id,
      title: text(task.title, 500),
      done: task.done === true,
      plannedFor: task.plannedFor ? instant(task.plannedFor) : null,
      plannedDate: task.plannedDate ? calendarDay(task.plannedDate) : null,
      estimateMinutes:
        task.estimateMinutes == null || task.estimateMinutes === 0
          ? null
          : Number.isFinite(task.estimateMinutes) &&
              task.estimateMinutes > 0 &&
              task.estimateMinutes <= 100000
            ? task.estimateMinutes
            : fail(400, "Invalid task estimate."),
      notes:
        task.notes === undefined
          ? ""
          : typeof task.notes === "string" && task.notes.length <= 20000
            ? task.notes
            : fail(400, "Shared notes must be at most 20000 characters."),
      assignee: task.assignee || null,
    };
    if (next.plannedDate && next.plannedFor)
      fail(400, "Use either a planned day or a planned time.");
    if (existing) Object.assign(existing, next);
    else {
      if (project.tasks.length >= 10000)
        fail(400, "Project task limit reached.");
      project.tasks.push(next);
    }
  } else if (input.kind === "task.delete") {
    const id = text(input.taskId, 100);
    project.tasks = project.tasks.filter((t) => t.id !== id);
    workspace.tombstones.push(projectId + ":" + id);
  } else if (input.kind === "comment.add") {
    if (!project.tasks.some((t) => t.id === input.taskId))
      fail(404, "Task not found.");
    project.comments.push({
      id: opId,
      taskId: input.taskId,
      memberId: member.id,
      text: text(input.text, 5000),
      createdAt: new Date().toISOString(),
    });
  } else fail(400, "Unsupported shared-project operation.");
  workspace.projectRevision++;
  const result = { id: opId, projectRevision: workspace.projectRevision };
  // Receipts and tombstones are retained: replay and deletion must stay deterministic.
  if (workspace.receipts.length >= 100000)
    fail(
      400,
      "Workspace operation retention limit reached; archive this workspace.",
    );
  workspace.receipts.push({ id: opId, memberId: member.id, signature, result });
  return result;
}
