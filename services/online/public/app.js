const root = document.getElementById("app"),
  notice = document.getElementById("notice");
const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const id = () => crypto.randomUUID();
const say = (value) => (notice.textContent = value);
const date = (value) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
let ownerToken = "",
  workspace = null,
  teamToken = "",
  teamId = "",
  teamCacheScope = "",
  pollOrganizer = "",
  cancelSecret = "";
let sharedSyncPromise = null;
const [kind, resourceId] = location.pathname.split("/").filter(Boolean);
function consumeSecret() {
  if (!location.hash) return;
  const secret = new URLSearchParams(location.hash.slice(1));
  teamToken = secret.get("member") || "";
  pollOrganizer = secret.get("organizer") || "";
  cancelSecret = secret.get("token") || "";
  history.replaceState(null, "", location.pathname);
}
consumeSecret();
window.addEventListener("hashchange", () => {
  consumeSecret();
  void guard(() =>
    kind === "poll" ? poll() : kind === "cancel" ? cancelBookingView() : team(),
  )();
});
async function api(path, method = "GET", body, token = "") {
  const response = await fetch(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || "Request failed.");
    error.status = response.status;
    throw error;
  }
  return result;
}
const guard = (action) => async (event) => {
  event?.preventDefault();
  const button =
    event?.submitter ||
    (event?.currentTarget?.matches?.("button") ? event.currentTarget : null);
  if (button) button.disabled = true;
  try {
    await action(event);
  } catch (error) {
    say(error.message);
  } finally {
    if (button) button.disabled = false;
  }
};
function localInput(name, label, type = "text", value = "") {
  return `<label>${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" required></label>`;
}
function download(name, value) {
  const url = URL.createObjectURL(
      new Blob([value], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function booking() {
  const page = await api("/api/pages/" + resourceId);
  const deliveryNote = page.emailEnabled
    ? "Email confirmation is queued after the booking is confirmed."
    : "No invitation email is sent.";
  root.innerHTML = `<h1>${esc(page.title)}</h1><p>${page.durationMinutes} minutes · ${esc(page.timeZone)}</p><p class="subtle">${page.providerBacked ? "Availability is verified against the host calendar; confirmation waits for calendar creation. " + deliveryNote : "Service booking calendar. No Google/Microsoft event is created. " + deliveryNote}</p><form id="range">${localInput("from", "Choose a day", "date", new Date().toISOString().slice(0, 10))}<button>Show available times</button></form><div id="slots" class="slots"></div><div id="reserve"></div>`;
  document.getElementById("range").onsubmit = guard(async (event) => {
    const from = new Date(new FormData(event.target).get("from") + "T00:00:00"),
      until = new Date(+from + 86400000);
    const result = await api(
      `/api/pages/${resourceId}/slots?from=${encodeURIComponent(from.toISOString())}&until=${encodeURIComponent(until.toISOString())}`,
    );
    const target = document.getElementById("slots");
    target.innerHTML = "";
    if (!result.slots.length)
      target.textContent = "No available times on this day.";
    for (const start of result.slots) {
      const button = document.createElement("button");
      button.textContent = new Date(start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      button.onclick = () => choose(start, page);
      target.append(button);
    }
  });
  document.getElementById("range").requestSubmit();
}
function choose(start, page) {
  const target = document.getElementById("reserve");
  const key = id();
  target.innerHTML = `<h2>${esc(date(start))}</h2><form>${localInput("name", "Your name")}${localInput("email", "Email", "email")}<button class="primary">Confirm booking</button></form>`;
  target.querySelector("form").onsubmit = guard(async (event) => {
    const fields = new FormData(event.target);
    const result = await api(`/api/pages/${resourceId}/reserve`, "POST", {
      start,
      name: fields.get("name"),
      email: fields.get("email"),
      idempotencyKey: key,
    });
    target.innerHTML = `<h2 id="booking-state">Booking ${esc(result.state)}</h2><p>${esc(date(start))} · ${page.durationMinutes} minutes</p><p>Keep this page open to cancel, or save your cancellation details.</p><div class="actions"><button id="save-cancel">Save cancellation details</button><button id="cancel">Cancel booking</button></div>`;
    const details = {
      bookingId: result.bookingId,
      cancelToken: result.cancelToken,
      service: location.origin,
    };
    document.getElementById("save-cancel").onclick = () =>
      download("calm-booking.json", JSON.stringify(details, null, 2));
    if (["pending", "cancel-pending"].includes(result.state))
      pollBooking(result.bookingId, result.cancelToken, target);
    document.getElementById("cancel").onclick = guard(async () => {
      const cancellation = await api(
        "/api/bookings/" + result.bookingId + "/cancel",
        "POST",
        {},
        result.cancelToken,
      );
      if (cancellation.state === "cancel-pending") {
        target.querySelector("#booking-state").textContent =
          "Cancellation pending";
        pollBooking(result.bookingId, result.cancelToken, target);
      } else target.innerHTML = "<h2>Booking cancelled</h2>";
    });
  });
}
async function poll() {
  const p = await api("/api/polls/" + resourceId),
    secretKey = "calm-poll:" + resourceId;
  pollOrganizer =
    pollOrganizer || sessionStorage.getItem(secretKey + ":organizer") || "";
  if (pollOrganizer)
    sessionStorage.setItem(secretKey + ":organizer", pollOrganizer);
  let ownVote = null;
  const participantSecret = sessionStorage.getItem(secretKey);
  if (participantSecret)
    try {
      ownVote = await api(
        "/api/polls/" + resourceId + "/participant",
        "GET",
        null,
        participantSecret,
      );
    } catch {}
  const closed =
    p.closed || p.finalized || Date.parse(p.expiresAt) <= Date.now();
  const selected = p.options.find((option) => option.id === p.finalized);
  root.innerHTML = `<h1>${esc(p.title)}</h1><p>${p.finalized ? "A time has been selected: " + esc(date(selected.start)) + " – " + esc(date(selected.end)) + ". No invitations were sent." : closed ? "This poll is closed." : "Choose your availability. Times below use your device time zone."}</p><form id="vote">${localInput("name", "Your name", "text", ownVote?.name || "")}<div class="poll-options">${p.options.map((o) => `<label>${esc(date(o.start))} – ${esc(date(o.end))}<small>${p.totals[o.id].yes} yes · ${p.totals[o.id].ifNeeded} if needed</small><select name="${o.id}" ${closed ? "disabled" : ""}>${["yes", "if-needed", "no"].map((value) => `<option value="${value}" ${ownVote?.votes.some((v) => v.optionId === o.id && v.availability === value) ? "selected" : ""}>${value === "yes" ? "Yes" : value === "no" ? "No" : "If needed"}</option>`).join("")}</select></label>`).join("")}</div><button ${closed ? "disabled" : ""}>Save availability</button></form>${pollOrganizer && !closed ? '<section><h2>Choose the final time</h2><div id="final-options" class="actions"></div><button id="close-poll" class="secondary">Close without choosing</button></section>' : ""}`;
  document.getElementById("vote").onsubmit = guard(async (event) => {
    const fields = new FormData(event.target);
    const result = await api(
      "/api/polls/" + resourceId + "/vote",
      "POST",
      {
        name: fields.get("name"),
        votes: p.options.map((o) => ({
          optionId: o.id,
          availability: fields.get(o.id),
        })),
      },
      sessionStorage.getItem(secretKey) || "",
    );
    if (result.participantToken)
      sessionStorage.setItem(secretKey, result.participantToken);
    say("Availability saved. You can edit it again in this browser session.");
    await poll();
  });
  const close = document.getElementById("close-poll");
  if (close)
    close.onclick = guard(async () => {
      await api(
        "/api/polls/" + resourceId + "/close",
        "POST",
        {},
        pollOrganizer,
      );
      await poll();
    });
  const final = document.getElementById("final-options");
  if (final)
    for (const option of p.options) {
      const button = document.createElement("button");
      button.textContent = date(option.start);
      button.onclick = guard(async () => {
        await api(
          "/api/polls/" + resourceId + "/finalize",
          "POST",
          { optionId: option.id, expectedRevision: p.revision },
          pollOrganizer,
        );
        await poll();
      });
      final.append(button);
    }
}
async function admin() {
  if (!ownerToken) {
    root.innerHTML = `<h1>Optional services</h1><p>Booking, group polls and shared projects live here, separate from your personal workspace.</p><form id="login">${localInput("token", "Organizer access token", "password")}<button>Open organizer tools</button></form>`;
    document.getElementById("login").onsubmit = guard(async (event) => {
      ownerToken = new FormData(event.target).get("token");
      await admin();
    });
    return;
  }
  const info = await api("/api/admin", "GET", null, ownerToken);
  const calendarInfo = await api("/api/calendar", "GET", null, ownerToken);
  const destinations = [];
  for (const account of calendarInfo.accounts.filter(
    (account) => account.connected && calendarInfo.enabled,
  )) {
    try {
      destinations.push(
        ...(
          await api(
            `/api/calendar/${account.provider}/calendars`,
            "GET",
            null,
            ownerToken,
          )
        ).calendars,
      );
    } catch (error) {
      say(error.message);
    }
  }
  root.innerHTML = `<h1>Organizer tools</h1><p>Only published fields enter this service. Share guest links explicitly.</p><section><h2>Service calendar connections</h2><p>These accounts belong to the always-on booking service, separate from desktop read-only calendars. Publishing a provider-backed page enables writes to its selected calendar.</p>${calendarInfo.accounts.map((account) => `<p>${esc(account.provider)} · ${account.connected ? "Connected" : account.configured ? "Ready to connect" : "Web registration missing"} <button data-provider-connect="${account.provider}" ${account.configured ? "" : "disabled"}>Connect</button></p>`).join("") || "<p>Provider booking is not configured.</p>"}<button id="refresh-connections">Refresh connections</button><div id="provider-auth-link"></div></section><section><h2>Booking pages</h2><div id="pages">${info.pages.map((p) => `<p><a href="/book/${p.id}">${esc(p.title)}</a> · ${p.active ? `Published <button data-unpublish="${p.id}">Unpublish</button>` : "Disabled"}</p>`).join("")}</div><details><summary>New booking page</summary><form id="page-form">${localInput("title", "Title")}${localInput("duration", "Duration in minutes", "number", "30")}<label>Booking destination<select name="destination"><option value="">Service booking calendar</option>${destinations.map((calendar) => `<option value="${esc(JSON.stringify({ provider: calendar.provider, calendarId: calendar.calendarId }))}">${esc(calendar.provider + " · " + calendar.name)}</option>`).join("")}</select></label>${localInput("zone", "Time zone", "text", Intl.DateTimeFormat().resolvedOptions().timeZone)}${localInput("start", "Weekday start", "time", "09:00")}${localInput("end", "Weekday end", "time", "17:00")}<button>Publish booking page</button></form></details></section><section><h2>Bookings</h2>${info.bookings.map((b) => `<p>${esc(date(b.start))} · ${esc(b.name)} · ${esc(b.state || (b.cancelled ? "Cancelled" : "Confirmed"))}${b.lastError ? ` · ${esc(b.lastError)}` : ""} ${Object.values(b.mail || {}).some((message) => ["uncertain", "failed"].includes(message.state)) ? `<button data-mail-review="${b.id}">Review email delivery</button>` : ""}${b.state === "review" ? `<button data-provider-review="${b.id}">Review provider event</button><button data-provider-retry="${b.id}">Retry reconciliation</button>` : ""}</p>`).join("") || "<p>No bookings yet.</p>"}</section><section><h2>Group polls</h2><div id="organizer-polls"></div><form id="poll-form">${localInput("title", "Title")}${localInput("first", "First option", "datetime-local")}${localInput("second", "Second option", "datetime-local")}<div id="extra-poll-options"></div><button id="add-poll-option" type="button" class="secondary">Add another time</button><label>Duration (minutes)<input name="poll-duration" type="number" min="5" max="480" value="30" required></label><button>Publish poll</button></form><div id="poll-result"></div></section><section><h2>Team workspaces</h2><div id="organizer-teams"></div><form id="team-form">${localInput("name", "Workspace name")}<button>Create workspace</button></form><div id="team-result"></div></section><button id="logout">Lock organizer tools</button>`;
  void Promise.all([
    organizerResources("poll", "organizer-polls"),
    organizerResources("team", "organizer-teams"),
  ]).catch((error) => say(error.message));
  root.querySelectorAll("[data-mail-review]").forEach(
    (button) =>
      (button.onclick = () => {
        const target = document.getElementById("provider-auth-link");
        target.innerHTML =
          '<p>The prior message may already have been accepted. Resending can send a duplicate.</p><button id="mail-resend-confirm">Resend this booking email anyway</button>';
        target.querySelector("button").onclick = guard(async () => {
          await api(
            `/api/bookings/${button.dataset.mailReview}/mail/retry`,
            "POST",
            { confirmResend: true },
            ownerToken,
          );
          await admin();
        });
        target.scrollIntoView({ block: "center" });
      }),
  );
  root.querySelectorAll("[data-unpublish]").forEach((button) => {
    button.onclick = guard(async () => {
      await api(
        "/api/pages/" + button.dataset.unpublish,
        "DELETE",
        null,
        ownerToken,
      );
      await admin();
    });
  });
  document.getElementById("refresh-connections").onclick = guard(admin);
  root.querySelectorAll("[data-provider-connect]").forEach(
    (button) =>
      (button.onclick = guard(async () => {
        const auth = await api(
          `/api/calendar/${button.dataset.providerConnect}/connect`,
          "POST",
          {},
          ownerToken,
        );
        document.getElementById("provider-auth-link").innerHTML =
          `<p><a href="${esc(auth.url)}" target="_blank" rel="noopener noreferrer">Authorize calendar in a new tab</a>, then refresh connections.</p>`;
      })),
  );
  root.querySelectorAll("[data-provider-retry]").forEach(
    (button) =>
      (button.onclick = guard(async () => {
        await api(
          `/api/bookings/${button.dataset.providerRetry}/retry`,
          "POST",
          {},
          ownerToken,
        );
        await admin();
      })),
  );
  root.querySelectorAll("[data-provider-review]").forEach(
    (button) =>
      (button.onclick = guard(async () => {
        const event = await api(
          `/api/bookings/${button.dataset.providerReview}/provider`,
          "GET",
          null,
          ownerToken,
        );
        const target = document.getElementById("provider-auth-link");
        if (event.missing) {
          target.textContent =
            "Provider event not found. Retry reconciliation; uncertain outcomes stay held for review.";
          return;
        }
        target.innerHTML = `<p>Provider event: ${esc(event.title)} · ${esc(event.start.dateTime)} – ${esc(event.end.dateTime)}</p><button id="acknowledge-provider">Keep this provider version and continue</button>`;
        target.querySelector("button").onclick = guard(async () => {
          await api(
            `/api/bookings/${button.dataset.providerReview}/acknowledge-provider`,
            "POST",
            { revision: event.revision },
            ownerToken,
          );
          await admin();
        });
        target.scrollIntoView({ block: "center" });
      })),
  );
  document.getElementById("logout").onclick = () => {
    ownerToken = "";
    void admin();
  };
  document.getElementById("page-form").onsubmit = guard(async (event) => {
    const f = new FormData(event.target),
      result = await api(
        "/api/pages",
        "POST",
        {
          title: f.get("title"),
          ...(f.get("destination")
            ? { destination: JSON.parse(f.get("destination")) }
            : {}),
          durationMinutes: Number(f.get("duration")),
          timeZone: f.get("zone"),
          availability: [1, 2, 3, 4, 5].map((weekday) => ({
            weekday,
            start: f.get("start"),
            end: f.get("end"),
          })),
        },
        ownerToken,
      );
    await admin();
    say("Published: " + result.publicUrl);
  });
  let optionCount = 2;
  document.getElementById("add-poll-option").onclick = () => {
    if (document.querySelectorAll("#extra-poll-options input").length >= 98) return say("Use at most 100 options.");
    optionCount++;
    const row = document.createElement("div");
    row.className = "poll-extra-option";
    row.innerHTML =
      localInput(
        "option-" + optionCount,
        "Option " + optionCount,
        "datetime-local",
      ) + '<button type="button" class="secondary">Remove</button>';
    row.querySelector("button").onclick = () => row.remove();
    document.getElementById("extra-poll-options").append(row);
    row.querySelector("input").focus();
  };
  document.getElementById("poll-form").onsubmit = guard(async (event) => {
    const f = new FormData(event.target),
      result = await api(
        "/api/polls",
        "POST",
        {
          title: f.get("title"),
          expiresAt: new Date(Date.now() + 14 * 86400000).toISOString(),
          options: [...f.keys()]
            .filter(
              (key) =>
                ["first", "second"].includes(key) || key.startsWith("option-"),
            )
            .map((key) => {
              const start = new Date(f.get(key));
              return {
                start: start.toISOString(),
                end: new Date(
                  +start + Number(f.get("poll-duration")) * 60000,
                ).toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              };
            }),
        },
        ownerToken,
      );
    document.getElementById("organizer-polls").replaceChildren();
    await organizerResources("poll", "organizer-polls");
    document.getElementById("poll-result").innerHTML =
      `<p>Guest: <a href="${esc(result.publicUrl)}">${esc(result.publicUrl)}</a></p><p>Private organizer: <a href="${esc(result.publicUrl)}#organizer=${esc(result.organizerToken)}">Open organizer view</a>. Save this private link.</p>`;
  });
  document.getElementById("team-form").onsubmit = guard(async (event) => {
    const result = await api(
      "/api/workspaces",
      "POST",
      { name: new FormData(event.target).get("name") },
      ownerToken,
    );
    document.getElementById("organizer-teams").replaceChildren();
    await organizerResources("team", "organizer-teams");
    document.getElementById("team-result").innerHTML =
      `<p><a href="${esc(result.url)}#member=${esc(result.memberToken)}">Open private owner workspace</a>. Save this private link.</p>`;
  });
}
async function organizerResources(kind, targetId) {
  const target = document.getElementById(targetId);
  async function load(after = "") {
    const result = await api(
      "/api/admin/resources?kind=" +
        kind +
        (after ? "&after=" + encodeURIComponent(after) : ""),
      "GET",
      null,
      ownerToken,
    );
    target.querySelector("[data-load-more]")?.remove();
    if (!after && !result.items.length)
      target.textContent = "Nothing published yet.";
    for (const item of result.items) {
      const row = document.createElement("div");
      row.className = "organizer-resource";
      row.innerHTML = `<p><a href="${esc(item.publicUrl)}">${esc(item.name)}</a>${item.finalized ? " · Finalized" : item.closed ? " · Closed" : ""}</p><button class="secondary" data-recover>${kind === "poll" ? "Replace private organizer link" : "Recover owner access"}</button><div data-recovery></div>`;
      row.querySelector("[data-recover]").onclick = () => {
        const panel = row.querySelector("[data-recovery]");
        panel.innerHTML = `<p>${kind === "poll" ? "The previous organizer link will stop working. Guest votes and links stay the same." : "This grants a new owner membership. Existing member links stay active; review and revoke unused memberships inside the workspace."}</p><button data-confirm-recovery>Confirm ${kind === "poll" ? "replacement" : "new owner access"}</button><button data-cancel-recovery>Cancel</button>`;
        panel.querySelector("[data-cancel-recovery]").onclick = () =>
          panel.replaceChildren();
        panel.querySelector("[data-confirm-recovery]").onclick = guard(
          async () => {
            const recovered = await api(
              `/api/admin/${kind === "poll" ? "polls" : "workspaces"}/${item.id}/recover`,
              "POST",
              kind === "poll"
                ? { confirmReplace: true }
                : { confirmGrant: true },
              ownerToken,
            );
            const link =
              kind === "poll"
                ? recovered.publicUrl + "#organizer=" + recovered.organizerToken
                : recovered.url + "#member=" + recovered.memberToken;
            panel.innerHTML = `<p><a href="${esc(link)}">Open private ${kind === "poll" ? "organizer" : "owner"} view</a>. Save this private link.</p>`;
          },
        );
      };
      target.append(row);
    }
    if (result.next) {
      const more = document.createElement("button");
      more.dataset.loadMore = "";
      more.textContent = "Load more";
      more.onclick = guard(() => load(result.next));
      target.append(more);
    }
  }
  await load();
}
const cacheKey = () =>
  `calm-shared:${location.origin}:${teamId}:${teamCacheScope}`;
function cache() {
  try {
    return JSON.parse(
      localStorage.getItem(cacheKey()) || '{"snapshot":null,"outbox":[]}',
    );
  } catch {
    return { snapshot: null, outbox: [] };
  }
}
function saveCache(value) {
  localStorage.setItem(cacheKey(), JSON.stringify(value));
}
async function team() {
  teamId = resourceId;
  teamToken =
    teamToken || sessionStorage.getItem("calm-member:" + teamId) || "";
  if (!teamToken) {
    root.innerHTML = `<h1>Shared workspace</h1><form id="access">${localInput("token", "Member access token", "password")}<button>Open workspace</button></form>`;
    document.getElementById("access").onsubmit = guard(async (event) => {
      teamToken = new FormData(event.target).get("token");
      await team();
    });
    return;
  }
  teamCacheScope = [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(teamToken),
      ),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  sessionStorage.setItem("calm-member:" + teamId, teamToken);
  try {
    workspace = await api("/api/workspaces/" + teamId, "GET", null, teamToken);
    const value = cache();
    value.snapshot = workspace;
    saveCache(value);
    document.getElementById("connection").textContent = "Connected";
  } catch (error) {
    if (error.status === 403) {
      workspace = null;
      root.innerHTML =
        '<h1>Access revoked</h1><p>Queued changes remain on this device and can be exported.</p><button id="export-pending">Export pending edits</button>';
      document.getElementById("export-pending").onclick = exportPending;
      throw error;
    }
    workspace = cache().snapshot;
    if (!workspace) throw error;
    document.getElementById("connection").textContent =
      "Offline · local shared copy";
  }
  renderTeam();
}
function exportPending() {
  download("calm-shared-pending.json", JSON.stringify(cache(), null, 2));
}
async function enqueue(operation) {
  const c = cache();
  c.outbox.push({
    id: id(),
    baseRevision: workspace.projectRevision + c.outbox.length,
    ...operation,
  });
  saveCache(c);
  if (
    operation.kind === "task.upsert" &&
    !workspace.projects.some((project) =>
      project.tasks.some((task) => task.id === operation.task.id),
    )
  )
    root
      .querySelector(`[data-add-task="${CSS.escape(operation.projectId)}"]`)
      ?.reset();
  renderTeam();
  await syncTeam();
}
function syncTeam() {
  if (sharedSyncPromise) return sharedSyncPromise;
  sharedSyncPromise = drainSharedOutbox().finally(() => {
    sharedSyncPromise = null;
  });
  return sharedSyncPromise;
}
async function drainSharedOutbox() {
  for (;;) {
    const operation = cache().outbox[0];
    if (!operation) break;
    try {
      const result = await api(
        "/api/workspaces/" + teamId + "/operations",
        "POST",
        operation,
        teamToken,
      );
      const latest = cache();
      latest.outbox = latest.outbox.filter((o) => o.id !== operation.id);
      saveCache(latest);
      workspace.projectRevision = result.projectRevision;
    } catch (error) {
      say(
        error.status === 409
          ? "Shared changes conflict. Refresh and review before retrying; pending edits are retained."
          : error.message,
      );
      renderTeam();
      return;
    }
  }
  await team();
  say("Shared changes saved.");
}
function renderTeam() {
  const formKey = (form) => form.id || form.dataset.addTask;
  const drafts = new Map(
    [...root.querySelectorAll("form")].map((form) => [
      formKey(form),
      [...new FormData(form).entries()],
    ]),
  );
  const member = workspace.members.find(
      (m) => m.id === workspace.currentMember,
    ),
    canEdit = member.role !== "viewer",
    pending = cache().outbox;
  root.innerHTML = `<h1>${esc(workspace.name)}</h1><p>Shared projects only · ${esc(member.role)} · revision ${workspace.projectRevision}</p><div class="actions"><button id="refresh-team">Refresh</button><button id="sync-team">Sync ${pending.length ? `(${pending.length} pending)` : ""}</button><button id="export-pending">Export local shared copy</button></div>${pending.length ? `<section><h2>Pending changes</h2>${pending.map((o) => `<p>${esc(o.task?.title || o.kind)} · waiting for sync</p>`).join("")}<p>Conflicts require review. Rebase retries against the latest revision after you review the current shared project.</p><button id="rebase">Review done, retry pending changes</button></section>` : ""}${workspace.projects.map((p) => `<section><h2>${esc(p.name)}</h2>${p.tasks.map((t) => `<div class="task"><div class="${t.done ? "done" : ""}"><span>${esc(t.title)}</span><small>${t.plannedFor ? esc(date(t.plannedFor)) : esc(t.plannedDate || "")} ${t.estimateMinutes ? `${t.estimateMinutes} min` : ""}</small></div><div class="actions"><button data-details="${esc(t.id)}" data-project="${esc(p.id)}">Details</button>${canEdit ? `<button data-complete="${esc(t.id)}" data-project="${esc(p.id)}">${t.done ? "Reopen" : "Complete"}</button>` : ""}</div></div>`).join("")}${canEdit ? `<form data-add-task="${p.id}">${localInput("title", "Task name")}<button>Add shared task</button></form>` : ""}</section>`).join("")}${
    member.role === "owner"
      ? `<section><h2>New shared project</h2><form id="new-project">${localInput("name", "Project name")}<button>Create project</button></form></section><section><h2>Members</h2>${workspace.members
          .filter((m) => !m.revoked)
          .map(
            (m) =>
              `<p>${esc(m.name)} · ${m.role} ${m.role !== "owner" ? `<button data-revoke="${m.id}">Revoke access</button>` : ""}</p>`,
          )
          .join(
            "",
          )}<form id="invite">${localInput("name", "Member name")}<label>Role<select name="role"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></label><button>Create private access link</button></form><div id="invite-result"></div></section>`
      : ""
  }`;
  root.querySelectorAll("form").forEach((form) => {
    for (const [name, value] of drafts.get(formKey(form)) || []) {
      const input = form.elements.namedItem(name);
      if (input) input.value = value;
    }
  });
  root
    .querySelectorAll("[data-details]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          sharedDetails(button.dataset.project, button.dataset.details)),
    );
  document.getElementById("refresh-team").onclick = guard(team);
  document.getElementById("sync-team").onclick = guard(syncTeam);
  document.getElementById("export-pending").onclick = exportPending;
  const rebase = document.getElementById("rebase");
  if (rebase)
    rebase.onclick = guard(async () => {
      if (sharedSyncPromise) await sharedSyncPromise;
      const latest = await api(
          "/api/workspaces/" + teamId,
          "GET",
          null,
          teamToken,
        ),
        c = cache();
      const remaining = [];
      for (const op of c.outbox) {
        const check = await api(
          "/api/workspaces/" + teamId + "/operations/" + op.id,
          "GET",
          null,
          teamToken,
        );
        if (!check.receipt) remaining.push(op);
      }
      c.outbox = remaining;
      c.outbox.forEach((op, index) => {
        op.baseRevision = latest.projectRevision + index;
      });
      c.snapshot = latest;
      saveCache(c);
      workspace = latest;
      await syncTeam();
    });
  root.querySelectorAll("[data-add-task]").forEach(
    (form) =>
      (form.onsubmit = guard(async (event) => {
        await enqueue({
          kind: "task.upsert",
          projectId: form.dataset.addTask,
          task: {
            id: id(),
            title: new FormData(form).get("title"),
            done: false,
          },
        });
      })),
  );
  root.querySelectorAll("[data-complete]").forEach(
    (button) =>
      (button.onclick = guard(async () => {
        const project = workspace.projects.find(
            (p) => p.id === button.dataset.project,
          ),
          task = project.tasks.find((t) => t.id === button.dataset.complete);
        await enqueue({
          kind: "task.upsert",
          projectId: project.id,
          task: { ...task, done: !task.done },
        });
      })),
  );
  const projectForm = document.getElementById("new-project");
  if (projectForm)
    projectForm.onsubmit = guard(async (event) => {
      await api(
        "/api/workspaces/" + teamId + "/projects",
        "POST",
        { name: new FormData(event.target).get("name") },
        teamToken,
      );
      await team();
    });
  const invite = document.getElementById("invite");
  if (invite)
    invite.onsubmit = guard(async (event) => {
      const f = new FormData(event.target),
        result = await api(
          "/api/workspaces/" + teamId + "/members",
          "POST",
          { name: f.get("name"), role: f.get("role") },
          teamToken,
        );
      await team();
      document.getElementById("invite-result").innerHTML =
        `<p>Private link: <a href="/team/${teamId}#member=${esc(result.memberToken)}">Open member workspace</a>. Copy and share explicitly.</p>`;
    });
  root.querySelectorAll("[data-revoke]").forEach(
    (button) =>
      (button.onclick = guard(async () => {
        await api(
          "/api/workspaces/" + teamId + "/members/" + button.dataset.revoke,
          "DELETE",
          null,
          teamToken,
        );
        await team();
      })),
  );
}
void guard(() =>
  kind === "book"
    ? booking()
    : kind === "poll"
      ? poll()
      : kind === "cancel"
        ? cancelBookingView()
        : kind === "team"
          ? team()
          : admin(),
)();

function sharedDetails(projectId, taskId) {
  const project = workspace.projects.find((p) => p.id === projectId),
    task = project.tasks.find((t) => t.id === taskId),
    member = workspace.members.find((m) => m.id === workspace.currentMember),
    editable = member.role !== "viewer";
  document.getElementById("shared-details")?.remove();
  const panel = document.createElement("aside");
  panel.id = "shared-details";
  panel.setAttribute("aria-label", "Shared task details");
  panel.setAttribute("role", "dialog");
  panel.innerHTML = `<button id="close-details" aria-label="Close task details">Close</button><h2>Task details</h2><form id="edit-shared">${localInput("title", "Task", "text", task.title)}<label>Planned for<input name="plannedFor" type="datetime-local" value="${task.plannedFor ? esc(new Date(Date.parse(task.plannedFor) - new Date(task.plannedFor).getTimezoneOffset() * 60000).toISOString().slice(0, 16)) : ""}"></label><label>Planned day (without a time)<input name="plannedDate" type="date" value="${esc(task.plannedDate || "")}"></label><label>Estimate in minutes<input name="estimate" type="number" min="0" max="100000" step="any" value="${task.estimateMinutes || ""}"></label><label>Assignee<select name="assignee"><option value="">Unassigned</option>${workspace.members
    .filter((m) => !m.revoked)
    .map(
      (m) =>
        `<option value="${m.id}" ${task.assignee === m.id ? "selected" : ""}>${esc(m.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Notes<textarea name="notes">${esc(task.notes)}</textarea></label><label>State<select name="done"><option value="false" ${!task.done ? "selected" : ""}>Open</option><option value="true" ${task.done ? "selected" : ""}>Completed</option></select></label>${editable ? "<button>Save changes</button>" : ""}</form><section><h3>Comments</h3>${project.comments
    .filter((c) => c.taskId === taskId)
    .map(
      (c) =>
        `<p>${esc(workspace.members.find((m) => m.id === c.memberId)?.name || "Member")}: ${esc(c.text)}</p>`,
    )
    .join(
      "",
    )}${editable ? '<form id="comment-shared"><label>Comment<textarea name="text" required maxlength="5000"></textarea></label><button>Add comment</button></form><button id="delete-shared">Delete task</button>' : ""}</section>`;
  document.body.append(panel);
  panel.querySelector("#close-details").onclick = () => {
    panel.remove();
    root.querySelector(`[data-details="${CSS.escape(taskId)}"]`)?.focus();
  };
  panel.onkeydown = (event) => {
    if (event.key === "Escape") {
      panel.querySelector("#close-details").click();
    }
    if (event.key === "Tab") {
      const controls = [
        ...panel.querySelectorAll("button,input,select,textarea"),
      ].filter((el) => !el.disabled);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  panel.querySelector('[name="plannedFor"]').oninput = (event) => {
    if (event.target.value)
      panel.querySelector('[name="plannedDate"]').value = "";
  };
  panel.querySelector('[name="plannedDate"]').oninput = (event) => {
    if (event.target.value)
      panel.querySelector('[name="plannedFor"]').value = "";
  };
  if (!editable)
    panel
      .querySelectorAll("input,select,textarea")
      .forEach((input) => (input.disabled = true));
  panel.querySelector("#edit-shared").onsubmit = guard(async (event) => {
    if (!editable) return;
    const f = new FormData(event.target);
    await enqueue({
      kind: "task.upsert",
      projectId,
      task: {
        ...task,
        title: f.get("title"),
        notes: f.get("notes"),
        done: f.get("done") === "true",
        assignee: f.get("assignee") || null,
        estimateMinutes: f.get("estimate") ? Number(f.get("estimate")) : null,
        plannedDate: f.get("plannedFor") ? null : f.get("plannedDate") || null,
        plannedFor: f.get("plannedFor")
          ? new Date(f.get("plannedFor")).toISOString()
          : null,
      },
    });
    panel.remove();
  });
  const comment = panel.querySelector("#comment-shared");
  if (comment)
    comment.onsubmit = guard(async (event) => {
      await enqueue({
        kind: "comment.add",
        projectId,
        taskId,
        text: new FormData(event.target).get("text"),
      });
      panel.remove();
    });
  const remove = panel.querySelector("#delete-shared");
  if (remove)
    remove.onclick = guard(async () => {
      await enqueue({ kind: "task.delete", projectId, taskId });
      panel.remove();
    });
  panel.querySelector("#close-details").focus();
}

if ("serviceWorker" in navigator)
  void navigator.serviceWorker.register("/worker.js").catch(() => {});

function pollBooking(bookingId, secret, target) {
  let attempts = 0;
  const tick = async () => {
    if (!target.isConnected || attempts++ > 120) return;
    try {
      const value = await api(
        "/api/bookings/" + bookingId,
        "GET",
        null,
        secret,
      );
      const label = target.querySelector("#booking-state");
      if (label)
        label.textContent =
          value.state === "cancel-pending"
            ? "Cancellation pending"
            : "Booking " + value.state;
      if (!["pending", "cancel-pending"].includes(value.state)) return;
    } catch (error) {
      say(
        "Calendar confirmation is still pending. Keep your cancellation details and retry later.",
      );
    }
    setTimeout(tick, 5000);
  };
  void tick();
}

async function cancelBookingView() {
  const key = "calm-cancel:" + resourceId;
  cancelSecret = cancelSecret || sessionStorage.getItem(key) || "";
  if (!cancelSecret) {
    root.innerHTML = `<h1>Booking access</h1><form id="cancel-access">${localInput("token", "Cancellation token", "password")}<button>Open booking</button></form>`;
    document.getElementById("cancel-access").onsubmit = guard(async (event) => {
      cancelSecret = new FormData(event.target).get("token");
      await cancelBookingView();
    });
    return;
  }
  const value = await api(
    "/api/bookings/" + resourceId,
    "GET",
    null,
    cancelSecret,
  );
  sessionStorage.setItem(key, cancelSecret);
  root.innerHTML = `<h1>${esc(value.title)}</h1><p>${esc(date(value.start))} – ${esc(date(value.end))}</p><section id="cancel-booking-panel"><h2 id="booking-state">Booking ${esc(value.state)}</h2>${value.state !== "cancelled" ? '<button id="guest-cancel">Cancel booking</button>' : ""}</section><button id="reload-booking">Refresh status</button>`;
  document.getElementById("reload-booking").onclick = guard(cancelBookingView);
  const target = document.getElementById("cancel-booking-panel");
  if (["pending", "cancel-pending"].includes(value.state))
    pollBooking(resourceId, cancelSecret, target);
  const button = document.getElementById("guest-cancel");
  if (button)
    button.onclick = guard(async () => {
      await api(
        "/api/bookings/" + resourceId + "/cancel",
        "POST",
        {},
        cancelSecret,
      );
      await cancelBookingView();
    });
}
