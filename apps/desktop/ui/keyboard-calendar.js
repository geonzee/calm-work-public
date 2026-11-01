function calendarTime(minute, showSeconds = false) {
  if (!showSeconds) return timeString(minute);
  const seconds = Math.round(minute * 60);
  return (
    timeString(Math.floor(seconds / 60)) +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}
// Shared Plan geometry and pointer behavior; no separate task or clock state.
function calendarHourHeight() {
  return state.calendarHourHeight || 64;
}
function nightEndMinute() {
  return 8 * 60;
}
function calendarY(minute) {
  const shown = state.showSleepHours ? minute : Math.max(0, minute - nightEndMinute());
  return (shown / 60) * calendarHourHeight();
}
function calendarMinuteAt(y) {
  const minute = (y / calendarHourHeight()) * 60;
  return state.showSleepHours ? minute : minute + nightEndMinute();
}
function calendarIntervalHeight(start, end) {
  return Math.max(Math.min(calendarBlockHeight(end - start), 18), calendarY(end) - calendarY(start));
}
function calendarBlockHeight(minutes) {
  if (minutes < 1) return 6;
  if (minutes < 5) return 10;
  if (minutes < 10) return 14;
  return Math.max(18, minutes / 60 * calendarHourHeight());
}
function packCalendarBlocks(blocks) {
  const all = blocks.sort((a, b) => a.start - b.start),
    lanes = [];
  for (const block of all) {
    let lane = lanes.findIndex((end) => end <= calendarY(block.start) / calendarHourHeight() * 60);
    if (lane < 0) lane = lanes.length;
    block.lane = lane;
    block.visualEnd =
      calendarY(block.start) / calendarHourHeight() * 60 +
      ((calendarIntervalHeight(block.start, block.end) + 2) /
        calendarHourHeight()) *
        60;
    lanes[lane] = block.visualEnd;
  }
  let cluster = [],
    end = -Infinity;
  const assign = () => {
    const count = Math.max(...cluster.map((b) => b.lane)) + 1;
    cluster.forEach((b) => (b.columns = count));
  };
  for (const block of all) {
    if (cluster.length && calendarY(block.start) / calendarHourHeight() * 60 >= end) {
      assign();
      cluster = [];
      end = -Infinity;
    }
    cluster.push(block);
    end = Math.max(end, block.visualEnd);
  }
  if (cluster.length) assign();
  return all;
}
function positionCalendarBlocks(column) {
  const blocks = [...column.querySelectorAll(".calendar-block")].map(
    (element) => ({
      element,
      start: Number(element.dataset.blockStart),
      end: Number(element.dataset.blockEnd),
    }),
  );
  for (const block of packCalendarBlocks(blocks)) {
    const height = calendarIntervalHeight(block.start, block.end),
      el = block.element;
    el.style.top = calendarY(block.start) + "px";
    el.style.height = height + "px";
    el.style.left = `calc(${(block.lane * 100) / block.columns}% + 3px)`;
    el.style.width = `calc(${100 / block.columns}% - 6px)`;
    el.dataset.size =
      height < 10
        ? "trace"
        : height < 24
          ? "compact"
          : height < 48
            ? "label"
            : "full";
  }
}
function fitCalendarHours(wrap) {
  const header = wrap.querySelector(".calendar-header"),
    old = calendarHourHeight();
  const visibleMinute = calendarMinuteAt(wrap.scrollTop);
  state.calendarHourHeight = Math.max(
    24,
    Math.min(100, (wrap.clientHeight - header.offsetHeight) / 8),
  );
  wrap.style.setProperty("--hour-height", calendarHourHeight() + "px");
  wrap.querySelector(".calendar-body").style.height =
    calendarY(1440) + "px";
  wrap
    .querySelectorAll(".time-axis > span")
    .forEach((label, i) => (label.style.top = calendarY(Number(label.dataset.minute)) + "px"));
  wrap.querySelectorAll(".day-column").forEach(positionCalendarBlocks);
  wrap
    .querySelectorAll(".calendar-selected")
    .forEach(
      (marker) =>
        (marker.style.top =
          calendarY(
            Number(marker.dataset.minute || state.calendarSlot.minute),
          ) + "px"),
    );
  if (Math.abs(old - calendarHourHeight()) > 0.1)
    wrap.scrollTop = calendarY(visibleMinute);
  updateCalendarNow();
}
function updateCalendarNow() {
  document.querySelectorAll(".calendar-now").forEach((line) => {
    line.hidden = !state.showSleepHours && state.nowMinute < nightEndMinute();
    line.style.top = calendarY(state.nowMinute) + "px";
    line.setAttribute(
      "aria-label",
      "Current time " + timeString(state.nowMinute),
    );
    line.querySelector("span").textContent = timeString(state.nowMinute);
  });
}
let calendarDrag = null,
  calendarDragFrame = 0;
function calendarSlotAt(column, x, y) {
  const wrap = column.closest(".calendar-wrap"),
    rect = column.getBoundingClientRect();
  const top =
    wrap.getBoundingClientRect().top +
    wrap.querySelector(".calendar-header").offsetHeight;
  return {
    day: Number(column.dataset.day),
    minute: Math.max(
      0,
      Math.min(
        1435,
        Math.round(
          calendarMinuteAt(Math.max(top, y) - rect.top) / 5,
        ) * 5,
      ),
    ),
  };
}
function clearCalendarDrop() {
  document.querySelectorAll(".calendar-selected").forEach((el) => el.remove());
  document
    .querySelectorAll(".day-column.drop-over")
    .forEach((el) => el.classList.remove("drop-over"));
}
function showCalendarDrop(column, point) {
  const value = calendarSlotAt(column, point.x, point.y);
  let marker = column.querySelector(".calendar-selected");
  if (!marker) {
    clearCalendarDrop();
    marker = document.createElement("div");
  }
  const duration = calendarDrag?.duration || 30;
  const end = Math.min(1440, value.minute + duration);
  marker.className = "calendar-selected";
  marker.dataset.minute = value.minute;
  marker.style.top = calendarY(value.minute) + "px";
  marker.style.height = Math.max(18, calendarIntervalHeight(value.minute, end)) + "px";
  marker.setAttribute("data-drop-time", timeString(value.minute));
  column.append(marker);
  column.classList.add("drop-over");
}
function beginCalendarDrag(event, kind, id) {
  const block = event.target.closest(".calendar-block");
  const rect = block?.getBoundingClientRect();
  const start = Number(block?.dataset.blockStart);
  const end = Number(block?.dataset.blockEnd);
  calendarDrag = {
    kind,
    id,
    x: event.clientX,
    y: event.clientY,
    offset: rect ? Math.max(0, event.clientY - rect.top) : 0,
    duration: Number.isFinite(end - start) ? Math.max(15, end - start) : 30,
  };
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    kind === "event" ? "application/x-calm-event" : "text/plain",
    id,
  );
  hideCalendarTooltip();
}
function stopCalendarDrag() {
  calendarDrag = null;
  cancelAnimationFrame(calendarDragFrame);
  calendarDragFrame = 0;
  clearCalendarDrop();
}
function bindCalendarAutoScroll(wrap) {
  wrap.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!calendarDrag) calendarDrag = { x: event.clientX, y: event.clientY };
    calendarDrag.x = event.clientX;
    calendarDrag.y = event.clientY;
    if (calendarDragFrame) return;
    let previous = performance.now();
    const tick = (now) => {
      if (!calendarDrag || !wrap.isConnected) {
        stopCalendarDrag();
        return;
      }
      const dt = Math.min(40, now - previous) / 1000;
      previous = now;
      const rect = wrap.getBoundingClientRect(),
        header = wrap.querySelector(".calendar-header").offsetHeight;
      const p = calendarDrag,
        edge = 48;
      const velocity = (pos, start, end) =>
        pos < start + edge
          ? -Math.min(1, (start + edge - pos) / edge) * 900
          : pos > end - edge
            ? Math.min(1, (pos - (end - edge)) / edge) * 900
            : 0;
      if (
        p.x >= rect.left &&
        p.x <= rect.right &&
        p.y >= rect.top &&
        p.y <= rect.bottom
      ) {
        wrap.scrollTop += velocity(p.y, rect.top + header, rect.bottom) * dt;
        wrap.scrollLeft += velocity(p.x, rect.left + 60, rect.right) * dt;
        const column = [...wrap.querySelectorAll(".day-column")].find((el) => {
          const r = el.getBoundingClientRect();
          return p.x >= r.left && p.x < r.right;
        });
        if (column) showCalendarDrop(column, { x: p.x, y: p.y - (p.offset || 0) });
      }
      calendarDragFrame = requestAnimationFrame(tick);
    };
    calendarDragFrame = requestAnimationFrame(tick);
  });
  wrap.addEventListener("dragleave", (event) => {
    if (!wrap.contains(event.relatedTarget)) {
      clearCalendarDrop();
    }
  });
}
async function dropCalendarItem(event, column) {
  const slot = calendarSlotAt(column, event.clientX, event.clientY - (calendarDrag?.offset || 0));
  const eventId = event.dataTransfer.getData("application/x-calm-event");
  stopCalendarDrag();
  state.calendarSlot = slot;
  state.planSelectedTask = null;
  if (eventId) {
    const item = localEventOccurrences().find((e) => e.id === eventId && e.owned);
    const provider = !item && calendarEvents()[eventId];
    if (provider && isEditableProviderEvent(provider) && !provider.allDay) {
      const length = provider.endMs - provider.startMs;
      const startMs = dateTimeToMs(calmWeekDate(slot.day), timeString(slot.minute));
      if (startMs !== provider.startMs) void moveProviderEvent(provider, startMs, startMs + length);
      return;
    }
    if (!item) return;
    const duration = minutes(item.end) - minutes(item.start);
    if (slot.minute + duration >= 1440) {
      notify("Choose a start that keeps this event within one day.");
      return;
    }
    const master = localMaster(item) || item;
    const moved = await commitLocalEvent(
      item,
      {
        title: item.title,
        calendar: item.calendar,
        date: calmWeekDate(slot.day),
        start: timeString(slot.minute),
        end: timeString(slot.minute + duration),
        project: eventProject(item),
        attendees: item.attendees || "",
        meetingUrl: item.meetingUrl || "",
        notes: item.notes || item.description || "",
        repeat: master.repeat || "",
        repeatRule: master.repeatRule || null,
      },
      false,
    );
    if (!moved) return;
    repaintPlan();
    notify("Event moved.");
  } else {
    placePlanTask(event.dataTransfer.getData("text/plain"));
    state.slotVisible = false;
    clearCalendarDrop();
  }
}
function calendarTooltip() {
  let tip = document.getElementById("calendar-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "calendar-tooltip";
    tip.className = "calendar-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}
function hideCalendarTooltip() {
  const tip = document.getElementById("calendar-tooltip");
  if (tip) tip.hidden = true;
  document
    .querySelectorAll('[aria-describedby="calendar-tooltip"]')
    .forEach((el) => el.removeAttribute("aria-describedby"));
}
function showCalendarTooltip(block) {
  if (calendarDrag) return;
  const tip = calendarTooltip();
  tip.textContent = block.getAttribute("aria-label");
  tip.hidden = false;
  block.setAttribute("aria-describedby", "calendar-tooltip");
  const rect = block.getBoundingClientRect();
  tip.style.left =
    Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, rect.left)) + "px";
  tip.style.top =
    (rect.bottom + 8 + tip.offsetHeight < innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - tip.offsetHeight - 8)) + "px";
}
document.addEventListener("pointerover", (event) => {
  const block = event.target.closest(".calendar-block");
  if (block) showCalendarTooltip(block);
});
document.addEventListener("pointerout", (event) => {
  const block = event.target.closest(".calendar-block");
  if (block && !block.contains(event.relatedTarget)) hideCalendarTooltip();
});
document.addEventListener("focusin", (event) => {
  const block = event.target.closest(".calendar-block");
  if (block) showCalendarTooltip(block);
});
document.addEventListener("focusout", (event) => {
  if (event.target.closest(".calendar-block")) hideCalendarTooltip();
});
document.addEventListener("click", hideCalendarTooltip);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    stopCalendarDrag();
    hideCalendarTooltip();
  }
});
document.addEventListener("dragend", stopCalendarDrag);
document.addEventListener("drop", stopCalendarDrag);

document.addEventListener(
  "dragover",
  (event) => {
    if (calendarDrag) {
      calendarDrag.x = event.clientX;
      calendarDrag.y = event.clientY;
    }
  },
  true,
);
