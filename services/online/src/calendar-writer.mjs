import { digest, fail } from "./domain.mjs";
const property =
  "String {b9cc5ce0-ec7d-4a35-a151-870029ff9254} Name CalmBookingId";
/** Service is the sole writer; creates no attendees and sends no invitations. */
export class CalendarWriter {
  constructor({ oauth, fetcher = fetch }) {
    this.oauth = oauth;
    this.fetcher = fetcher;
  }
  base(destination) {
    const id = encodeURIComponent(destination.calendarId);
    if (destination.provider === "google")
      return `https://www.googleapis.com/calendar/v3/calendars/${id}`;
    if (destination.provider === "microsoft")
      return `https://graph.microsoft.com/v1.0/me/calendars/${id}`;
    fail(400, "Unknown provider destination.");
  }
  async request(
    provider,
    url,
    { method = "GET", body, headers = {}, allow404 = false } = {},
  ) {
    const parsed = new URL(url),
      host =
        provider === "google" ? "www.googleapis.com" : "graph.microsoft.com";
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== host ||
      parsed.port ||
      parsed.username ||
      parsed.password
    )
      throw new Error("Invalid provider request destination.");
    const access = await this.oauth.access(provider);
    let response;
    try {
      response = await this.fetcher(url, {
        method,
        headers: {
          Authorization: "Bearer " + access,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(provider === "microsoft"
            ? { Prefer: 'outlook.timezone="UTC"' }
            : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw Object.assign(
        new Error(
          "Provider request did not complete; reconciliation is required.",
        ),
        { transient: true },
      );
    }
    if (response.status === 404 && allow404) return null;
    if (!response.ok) {
      const retry = response.headers.get("Retry-After") || "30";
      const delay = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now();
      const error = Object.assign(
        new Error(
          response.status === 412
            ? "Provider event was changed externally. Review it before continuing."
            : "Provider calendar request failed.",
        ),
        {
          statusCode:
            response.status === 401 || response.status === 403
              ? 409
              : response.status,
          transient: response.status === 429 || response.status >= 500,
          retryAfterMs: Math.min(3600000, Math.max(1000, Number.isFinite(delay) ? delay : 30000)),
        },
      );
      throw error;
    }
    if (response.status === 204) return {};
    return response.json();
  }
  async calendars(provider) {
    const initial = provider === "google" ? "https://www.googleapis.com/calendar/v3/users/me/calendarList" : "https://graph.microsoft.com/v1.0/me/calendars";
    let next = initial;
    const rows = [];
    for (let page = 0; next && page < 25; page++) {
      const result = await this.request(provider, next);
      const items = provider === "google" ? result.items : result.value;
      if (!Array.isArray(items)) throw new Error("Invalid provider calendars.");
      rows.push(...items);
      if (rows.length > 10000) throw new Error("Provider calendar list is too large.");
      if (provider === "google" && result.nextPageToken) { const url = new URL(initial); url.searchParams.set("pageToken",result.nextPageToken); next = url.href; }
      else next = provider === "microsoft" ? result["@odata.nextLink"] : null;
    }
    if (next) throw new Error("Provider calendar pagination limit reached.");
    return rows
      .filter((calendar) =>
        provider === "google"
          ? calendar.accessRole === "owner"
          : calendar.canEdit === true,
      )
      .map((calendar) => ({
        provider,
        calendarId: calendar.id,
        name: calendar.summary || calendar.name,
      }));
  }
  async find(booking) {
    const d = booking.destination;
    let event;
    if (d.provider === "google")
      event = await this.request(
        d.provider,
        this.base(d) + "/events/" + digest("calm-booking:" + booking.id),
        { allow404: true },
      );
    else {
      const url = new URL(this.base(d) + "/events");
      url.searchParams.set(
        "$filter",
        `singleValueExtendedProperties/Any(ep: ep/id eq '${property}' and ep/value eq '${booking.id}')`,
      );
      url.searchParams.set(
        "$expand",
        `singleValueExtendedProperties($filter=id eq '${property}')`,
      );
      const result = await this.request(d.provider, url.href);
      if (!Array.isArray(result.value) || result.value.length > 1)
        throw new Error("Provider booking identity is ambiguous.");
      event = result.value[0] || null;
    }
    if (!event) return null;
    const owned =
      d.provider === "google"
        ? event.extendedProperties?.private?.calmBookingId === booking.id
        : event.singleValueExtendedProperties?.some(
            (p) => p.id === property && p.value === booking.id,
          );
    if (!owned)
      fail(409, "Provider event ownership does not match this booking.");
    return {
      id: event.id,
      revision: event.etag || event["@odata.etag"],
      event,
    };
  }
  assertRange(booking, remote) {
    const raw = remote.event;
    const utc = (value) =>
      new Date(
        /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
      ).toISOString();
    if (
      utc(raw.start.dateTime) !== booking.start ||
      utc(raw.end.dateTime) !== booking.end
    )
      fail(
        409,
        "Provider booking time was edited externally. Review before continuing.",
      );
  }
  async busy(destination, start, end) {
    if (destination.provider === "google") {
      const result = await this.request(
        "google",
        "https://www.googleapis.com/calendar/v3/freeBusy",
        {
          method: "POST",
          body: {
            timeMin: start,
            timeMax: end,
            items: [{ id: destination.calendarId }],
          },
        },
      );
      const calendar = result.calendars?.[destination.calendarId];
      if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy))
        throw new Error("Provider availability could not be verified.");
      return calendar.busy.map(interval => {
        const start = new Date(interval.start).toISOString(), end = new Date(interval.end).toISOString();
        if (end <= start) throw new Error("Invalid provider availability interval.");
        return {start,end};
      });
    }
    const url = new URL(this.base(destination) + "/calendarView");
    url.searchParams.set("startDateTime", start);
    url.searchParams.set("endDateTime", end);
    url.searchParams.set("$top", "1000");
    let next = url.href,
      rows = [];
    for (let page = 0; next && page < 25; page++) {
      const data = await this.request("microsoft", next);
      if (!Array.isArray(data.value))
        throw new Error("Invalid provider availability.");
      rows.push(...data.value);
      next = data["@odata.nextLink"];
    }
    if (next) throw new Error("Provider availability range is too large.");
    const utc = (value) =>
      new Date(
        /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z",
      ).toISOString();
    return rows
      .filter(
        (event) =>
          !event.isCancelled &&
          !["free", "workingElsewhere"].includes(event.showAs),
      )
      .map((event) => ({
        start: utc(event.start.dateTime),
        end: utc(event.end.dateTime),
      }));
  }
  async create(booking) {
    const existing = await this.find(booking);
    if (existing) {
      this.assertRange(booking, existing);
      return existing;
    }
    const d = booking.destination,
      body =
        d.provider === "google"
          ? {
              id: digest("calm-booking:" + booking.id),
              summary: booking.title,
              description: "Booked through Calm Work.",
              start: { dateTime: booking.start },
              end: { dateTime: booking.end },
              extendedProperties: { private: { calmBookingId: booking.id } },
            }
          : {
              subject: booking.title,
              body: {
                contentType: "text",
                content: "Booked through Calm Work.",
              },
              start: { dateTime: booking.start.slice(0, -1), timeZone: "UTC" },
              end: { dateTime: booking.end.slice(0, -1), timeZone: "UTC" },
              transactionId: digest("calm-booking:" + booking.id),
              singleValueExtendedProperties: [
                { id: property, value: booking.id },
              ],
              attendees: [],
            };
    try {
      await this.request(
        d.provider,
        this.base(d) +
          "/events" +
          (d.provider === "google" ? "?sendUpdates=none" : ""),
        { method: "POST", body },
      );
    } catch (error) {
      if (error.statusCode !== 409) throw error;
    }
    const remote = await this.find(booking);
    if (!remote)
      throw Object.assign(
        new Error("Created event is awaiting reconciliation."),
        { transient: true },
      );
    this.assertRange(booking, remote);
    return remote;
  }
  async remove(booking) {
    const remote = await this.find(booking);
    if (!remote) return { removed: true };
    if (!booking.remote?.revision)
      fail(409, "Provider revision is missing; review cancellation.");
    if (remote.revision !== booking.remote.revision)
      fail(
        409,
        "Provider event changed externally; cancellation needs review.",
      );
    this.assertRange(booking, remote);
    await this.request(
      booking.destination.provider,
      this.base(booking.destination) +
        "/events/" +
        encodeURIComponent(remote.id) +
        (booking.destination.provider === "google" ? "?sendUpdates=none" : ""),
      {
        method: "DELETE",
        headers: { "If-Match": booking.remote.revision },
        allow404: true,
      },
    );
    return { removed: true };
  }
}
