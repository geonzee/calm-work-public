import type { TeamPort } from '../../../packages/team/src/index.js';

/** Membership/ACL boundary for a future extension of upstream scoped replication. */
export interface TeamHost {
  readonly team: TeamPort;
}
