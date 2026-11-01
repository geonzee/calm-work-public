export type TeamRole = 'owner' | 'editor' | 'viewer';
export interface SharedProjectRef {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly role: TeamRole;
}

/** Future scoped replication service. Personal SuperSync is not team ACL support. */
export interface TeamPort {
  projects(): Promise<readonly SharedProjectRef[]>;
  invite(workspaceId: string, email: string, role: Exclude<TeamRole, 'owner'>): Promise<void>;
  revoke(workspaceId: string, memberId: string): Promise<void>;
}
