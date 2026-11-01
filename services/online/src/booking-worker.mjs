import { token } from "./domain.mjs";
/** Durable per-booking leases serialize the designated service writer across retries/workers. */
export class BookingWorker {
  constructor({ store, writer, now = () => Date.now() }) {
    this.store = store;
    this.writer = writer;
    this.now = now;
    this.running = null;
  }
  async tick() {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => (this.running = null));
    return this.running;
  }
  async drain() {
    for (let count = 0; count < 10; count++) {
      const lease = token();
      const host = await this.store.read("booking-host");
      if (
        !host ||
        !host.bookings.some(
          (b) =>
            b.destination &&
            ["pending", "cancel-pending"].includes(b.state) &&
            (!b.nextAttempt || b.nextAttempt <= this.now()) &&
            (!b.lease || b.lease.until <= this.now()),
        )
      )
        return;
      const claimed = await this.store.change("booking-host", (host) => {
        const booking = host.bookings.find(
          (b) =>
            b.destination &&
            ["pending", "cancel-pending"].includes(b.state) &&
            (!b.nextAttempt || b.nextAttempt <= this.now()) &&
            (!b.lease || b.lease.until <= this.now()),
        );
        if (!booking) return null;
        booking.lease = { id: lease, until: this.now() + 120000 };
        return structuredClone(booking);
      });
      const booking = claimed.result;
      if (!booking) return;
      try {
        let remote = await this.writer.find(booking);
        const refreshed = await this.store.change("booking-host", (host) => {
          const current = host.bookings.find((b) => b.id === booking.id);
          if (current.lease?.id !== lease) return null;
          current.lease.until = this.now() + 120000;
          return structuredClone(current);
        });
        if (!refreshed.result) continue;
        const current = refreshed.result;
        if (current.cancelRequested) {
          if (!remote && current.providerAttemptedAt && !current.remote)
            throw new Error(
              "Create outcome is uncertain; organizer reconciliation is required before cancellation.",
            );
          if (remote) {
            this.writer.assertRange(current, remote);
            await this.writer.remove({
              ...current,
              remote: current.remote || {
                id: remote.id,
                revision: remote.revision,
              },
            });
          }
          await this.finish(current.id, lease, (b) => {
            b.state = "cancelled";
            b.cancelled = true;
            b.remote = null;
          });
        } else {
          if (remote) this.writer.assertRange(current, remote);
          else {
            const buffer = current.bufferMinutes * 60000;
            const busy = await this.writer.busy(
              current.destination,
              new Date(Date.parse(current.start) - buffer).toISOString(),
              new Date(Date.parse(current.end) + buffer).toISOString(),
            );
            if (
              busy.some(
                (interval) =>
                  Date.parse(interval.start) <
                    Date.parse(current.end) + buffer &&
                  Date.parse(interval.end) > Date.parse(current.start) - buffer,
              )
            ) {
              await this.finish(current.id, lease, (b) => {
                b.state = "unavailable";
                b.cancelled = true;
              });
              continue;
            }
            // Fence immediately before the effect. Lease is longer than each bounded provider request.
            const fence = await this.store.change("booking-host", (host) => {
              const b = host.bookings.find((b) => b.id === current.id);
              if (b.lease?.id !== lease || b.cancelRequested) return false;
              b.lease.until = this.now() + 120000;
              b.providerAttemptedAt ||= this.now();
              return true;
            });
            if (!fence.result) {
              await this.finish(current.id, lease, () => {});
              continue;
            }
            remote = await this.writer.create(current);
          }
          await this.finish(current.id, lease, (b) => {
            b.remote = { id: remote.id, revision: remote.revision };
            b.state = b.cancelRequested ? "cancel-pending" : "confirmed";
            b.providerConfirmedAt = new Date(this.now()).toISOString();
          });
        }
      } catch (error) {
        await this.finish(booking.id, lease, (b) => {
          b.attempts = (b.attempts || 0) + 1;
          b.lastError = error.transient
            ? "Provider request failed; retry/reconciliation pending."
            : "Provider authorization or event changed; organizer review required.";
          b.nextAttempt =
            this.now() +
            Math.max(
              error.retryAfterMs || 0,
              Math.min(3600000, 30000 * 2 ** b.attempts),
            );
          if (!error.transient || b.attempts >= 3) b.state = "review";
        });
      }
    }
  }
  async finish(id, lease, mutate) {
    await this.store.change("booking-host", (host) => {
      const booking = host.bookings.find((b) => b.id === id);
      if (booking?.lease?.id !== lease) return;
      mutate(booking);
      delete booking.lease;
    });
  }
}
