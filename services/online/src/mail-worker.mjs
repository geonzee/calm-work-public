import { createHmac } from "node:crypto";
import { digest } from "./domain.mjs";
const escapeIcs = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (value) =>
  new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function fold(line) {
  let result = "",
    column = 0;
  for (const character of line) {
    const width = Buffer.byteLength(character);
    if (column + width > 75) {
      result += "\r\n ";
      column = 1;
    }
    result += character;
    column += width;
  }
  return result;
}
export function bookingIcs(
  booking,
  { origin, from, method = "REQUEST", now = Date.now() },
) {
  const host = new URL(origin).hostname;
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Calm Work//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:" + method,
      "BEGIN:VEVENT",
      `UID:${booking.id}@${host}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(booking.start)}`,
      `DTEND:${stamp(booking.end)}`,
      `SEQUENCE:${(booking.sequence || 0) + (method === "CANCEL" ? 1 : 0)}`,
      `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
      `SUMMARY:${escapeIcs(booking.title)}`,
      `ORGANIZER:mailto:${from}`,
      `ATTENDEE;CN="${escapeIcs(booking.name).replace(/"/g, "'")}";RSVP=TRUE:mailto:${booking.email}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
/** At-most-one automatic attempt: ambiguous SMTP outcomes require an explicit organizer resend. */
export class MailWorker {
  constructor({
    store,
    transport,
    from,
    origin,
    ownerToken,
    now = () => Date.now(),
  }) {
    this.store = store;
    this.transport = transport;
    this.from = from;
    this.origin = origin;
    this.ownerToken = ownerToken;
    this.now = now;
    this.running = null;
  }
  tick() {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => (this.running = null));
    return this.running;
  }
  desired(booking) {
    if (booking.cancelled) {
      return Object.values(booking.mail || {}).some(
        (mail) =>
          ["sent", "uncertain"].includes(mail.state) &&
          mail.method === "REQUEST",
      )
        ? { id: "cancel:" + (booking.sequence || 0), method: "CANCEL" }
        : null;
    }
    if (
      booking.cancelRequested ||
      (booking.destination && booking.state !== "confirmed")
    )
      return null;
    return { id: "confirm:" + (booking.sequence || 0), method: "REQUEST" };
  }
  async drain() {
    const snapshot = await this.store.read("booking-host");
    if (!snapshot) return;
    for (const saved of snapshot.bookings) {
      if (
        Object.values(saved.mail || {}).some(
          (message) =>
            message.state === "sending" && message.until <= this.now(),
        )
      ) {
        await this.store.change("booking-host", (host) => {
          const booking = host.bookings.find((row) => row.id === saved.id);
          for (const message of Object.values(booking.mail || {}))
            if (message.state === "sending" && message.until <= this.now())
              message.state = "uncertain";
          Object.assign(saved, structuredClone(booking));
        });
      }
      const desired = this.desired(saved);
      if (!desired) continue;
      const claimed = await this.store.change("booking-host", (host) => {
        const booking = host.bookings.find((b) => b.id === saved.id);
        const current = this.desired(booking);
        if (!current || current.id !== desired.id) return null;
        booking.mail ||= {};
        const message = booking.mail[desired.id];
        if (message?.state === "sending") {
          if (message.until <= this.now()) message.state = "uncertain";
          return null;
        }
        if (message && !["queued"].includes(message.state)) return null;
        booking.mail[desired.id] = {
          state: "sending",
          method: desired.method,
          until: this.now() + 120000,
        };
        return structuredClone(booking);
      });
      const booking = claimed.result;
      if (!booking) continue;
      const cancelToken = createHmac("sha256", this.ownerToken)
        .update(booking.idempotencyKey + ":" + booking.fingerprint)
        .digest("base64url");
      const cancelUrl =
        this.origin + "/cancel/" + booking.id + "#token=" + cancelToken;
      const messageId =
        "<" +
        digest(booking.id + ":" + desired.id) +
        "@" +
        new URL(this.origin).hostname +
        ">";
      let state = "sent";
      try {
        const result = await this.transport.sendMail({
          from: this.from,
          to: { name: booking.name, address: booking.email },
          subject:
            (desired.method === "CANCEL" ? "Cancelled: " : "Confirmed: ") +
            booking.title.replace(/[\r\n]/g, " "),
          messageId,
          text:
            desired.method === "CANCEL"
              ? `Your booking has been cancelled.\n${booking.title}\n${booking.start}`
              : `Your booking is confirmed.\n${booking.title}\n${booking.start} – ${booking.end}\nCancel: ${cancelUrl}`,
          icalEvent: {
            filename:
              desired.method === "CANCEL"
                ? "cancellation.ics"
                : "invitation.ics",
            method: desired.method,
            content: bookingIcs(booking, {
              origin: this.origin,
              from: this.from,
              method: desired.method,
              now: this.now(),
            }),
          },
          disableFileAccess: true,
          disableUrlAccess: true,
        });
        if (!result.accepted?.includes(booking.email)) state = "failed";
      } catch (error) {
        state =
          error.responseCode >= 500 && error.responseCode < 600
            ? "failed"
            : "uncertain";
      }
      await this.store.change("booking-host", (host) => {
        const current = host.bookings.find((b) => b.id === booking.id);
        current.mail[desired.id] = {
          state,
          method: desired.method,
          messageId,
          updatedAt: this.now(),
        };
      });
    }
  }
}
