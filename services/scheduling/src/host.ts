import type { BookingPort, PollPort } from '../../../packages/scheduling/src/index.js';

/** Optional reachable service. No personal task database is exposed publicly. */
export interface SchedulingHost {
  readonly bookings: BookingPort;
  readonly polls: PollPort;
}
