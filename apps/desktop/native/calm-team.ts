import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
interface TeamTask {
  id: string;
  title: string;
  done: boolean;
  plannedFor: string | null;
  plannedDate: string | null;
  estimateMinutes: number | null;
  notes: string;
  assignee: string | null;
}
interface Project {
  id: string;
  name: string;
  tasks: TeamTask[];
}
interface Workspace {
  id: string;
  name: string;
  currentMember: string;
  projectRevision: number;
  projects: Project[];
  members: { id: string; role: string; revoked: boolean }[];
}
interface LocalRow {
  base?: TeamTask | null;
  projectId: string;
  taskId: string;
  task: TeamTask | null;
}
interface Connection {
  id: string;
  origin: string;
  workspaceId: string;
  memberToken: string;
  snapshot: Workspace;
  bases: Record<string, TeamTask | null>;
  ignored: string[];
  conflicts: Record<
    string,
    {
      projectId: string;
      taskId: string;
      local: TeamTask | null;
      remote: TeamTask | null;
    }
  >;
  pending: Record<
    string,
    {
      id: string;
      baseRevision: number;
      projectId: string;
      kind: string;
      task?: TeamTask;
      taskId?: string;
      desired: TeamTask | null;
    }
  >;
  updatedAt: string;
  error: string;
  preserveKeys?: string[];
}
interface Dependencies {
  directory: string;
  vault: {
    available(): boolean;
    encrypt(value: string): Buffer;
    decrypt(value: Buffer): string;
  };
  fetch?: typeof fetch;
  openExternal(url: string): Promise<unknown>;
}
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const keyOf = (projectId: string, taskId: string): string => projectId + ':' + taskId;
const validId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value);
function normalize(task: TeamTask | null): TeamTask | null {
  return task
    ? {
        id: task.id,
        title: task.title,
        done: task.done === true,
        plannedFor: task.plannedFor || null,
        plannedDate: task.plannedDate || null,
        estimateMinutes: task.estimateMinutes ?? null,
        notes: task.notes || '',
        assignee: task.assignee || null,
      }
    : null;
}
const same = (a: TeamTask | null | undefined, b: TeamTask | null | undefined): boolean =>
  JSON.stringify(normalize(a || null)) === JSON.stringify(normalize(b || null));
function workspace(value: unknown, id: string): Workspace {
  const w = value as Workspace;
  if (
    !w ||
    w.id !== id ||
    typeof w.name !== 'string' ||
    !validId(w.currentMember) ||
    !Number.isInteger(w.projectRevision) ||
    !Array.isArray(w.projects) ||
    !Array.isArray(w.members) ||
    w.projects.length > 500 ||
    w.members.length > 10000
  )
    throw new Error('Invalid shared workspace response.');
  let count = 0;
  for (const project of w.projects) {
    if (
      !validId(project.id) ||
      typeof project.name !== 'string' ||
      !Array.isArray(project.tasks)
    )
      throw new Error('Invalid shared project.');
    for (const task of project.tasks) {
      if (
        !validId(task.id) ||
        typeof task.title !== 'string' ||
        !task.title.trim() ||
        typeof task.done !== 'boolean' ||
        typeof task.notes !== 'string' ||
        task.title.length > 500 ||
        task.notes.length > 20000
      )
        throw new Error('Invalid shared task.');
      if (task.plannedFor && !Number.isFinite(Date.parse(task.plannedFor)))
        throw new Error('Invalid shared plan.');
      if (task.plannedDate && !/^\d{4}-\d{2}-\d{2}$/.test(task.plannedDate))
        throw new Error('Invalid shared date.');
      if (
        task.estimateMinutes !== null &&
        (!Number.isFinite(task.estimateMinutes) || task.estimateMinutes < 0)
      )
        throw new Error('Invalid shared estimate.');
      if (++count > 10000) throw new Error('Shared workspace is too large.');
    }
  }
  return w;
}
function remoteTask(w: Workspace, projectId: string, taskId: string): TeamTask | null {
  return normalize(
    w.projects.find((p) => p.id === projectId)?.tasks.find((t) => t.id === taskId) ||
      null,
  );
}
/** Native encrypted connection/outbox only; the upstream task engine remains the local authority. */
export class CalmTeam {
  private connections: Record<string, Connection> = {};
  private loaded = false;
  private queue: Promise<unknown> = Promise.resolve();
  private fetcher: typeof fetch;
  constructor(private readonly deps: Dependencies) {
    this.fetcher = deps.fetch || fetch;
  }
  private async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.deps.vault.available())
      throw new Error(
        'Unlock operating-system credential storage before connecting shared workspaces.',
      );
    try {
      this.connections = JSON.parse(
        this.deps.vault.decrypt(await readFile(join(this.deps.directory, 'team-vault'))),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('Shared-workspace vault could not be opened.');
    }
    this.loaded = true;
  }
  private async save(): Promise<void> {
    if (!this.deps.vault.available())
      throw new Error('Shared-workspace credential storage is unavailable.');
    await mkdir(this.deps.directory, { recursive: true, mode: 0o700 });
    const file = join(this.deps.directory, 'team-vault');
    await writeFile(
      file + '.tmp',
      this.deps.vault.encrypt(JSON.stringify(this.connections)),
      { mode: 0o600 },
    );
    await rename(file + '.tmp', file);
  }
  private status(): unknown {
    return {
      connections: Object.values(this.connections).map((c) => ({
        id: c.id,
        origin: c.origin,
        workspaceId: c.workspaceId,
        name: c.snapshot.name,
        role:
          c.snapshot.members.find((m) => m.id === c.snapshot.currentMember)?.role ||
          'viewer',
        snapshot: c.snapshot,
        ignored: c.ignored,
        updatedAt: c.updatedAt,
        error: c.error,
        pendingCount: Object.keys(c.pending).length,
        preserveKeys: c.preserveKeys || [],
        conflicts: Object.entries(c.conflicts).map(([key, value]) => ({
          key,
          ...value,
        })),
      })),
    };
  }
  private async request(c: Connection, path: string, body?: unknown): Promise<any> {
    let response: Response;
    try {
      response = await this.fetcher(
        c.origin + '/api/workspaces/' + c.workspaceId + path,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            Authorization: 'Bearer ' + c.memberToken,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      );
    } catch {
      throw new Error(
        'Shared workspace is offline. Local changes remain on this device.',
      );
    }
    if (!response.ok) {
      const error = new Error(
        response.status === 403
          ? 'Shared workspace access was revoked or is read-only. Local changes are retained.'
          : response.status === 409
            ? 'Shared project changed; review the conflicting edits.'
            : 'Shared workspace request failed. Local changes are retained.',
      );
      Object.assign(error, { status: response.status });
      throw error;
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Empty shared workspace response.');
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 20 * 1024 * 1024) {
        await reader.cancel();
        throw new Error('Shared response exceeds the device limit.');
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  async command(input: {
    action?: string;
    link?: unknown;
    connectionId?: unknown;
    rows?: unknown;
    key?: unknown;
    choice?: unknown;
  }): Promise<unknown> {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        await this.load();
        if (input.action === 'status') return this.status();
        if (input.action === 'connect') {
          if (typeof input.link !== 'string' || input.link.length > 3000)
            throw new Error('Paste a private shared-workspace member link.');
          const url = new URL(input.link),
            match = /^\/team\/([A-Za-z0-9_-]{1,120})\/?$/.exec(url.pathname),
            memberToken = new URLSearchParams(url.hash.slice(1)).get('member');
          if (
            !match ||
            !memberToken ||
            !/^[A-Za-z0-9_-]{32,200}$/.test(memberToken) ||
            url.username ||
            url.password ||
            url.search ||
            (url.protocol !== 'https:' &&
              !(
                url.protocol === 'http:' &&
                ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
              ))
          )
            throw new Error(
              'Use an HTTPS member link, or loopback HTTP for a local service.',
            );
          const id = hash(url.origin + ':' + match[1]).slice(0, 32),
            previous = this.connections[id];
          const c: Connection = {
            id,
            origin: url.origin,
            workspaceId: match[1],
            memberToken,
            snapshot: null as unknown as Workspace,
            bases: previous?.bases || {},
            ignored: previous?.ignored || [],
            conflicts: previous?.conflicts || {},
            pending: previous?.pending || {},
            updatedAt: '',
            error: '',
          };
          c.snapshot = workspace(await this.request(c, ''), c.workspaceId);
          this.connections[id] = c;
          c.updatedAt = new Date().toISOString();
          await this.save();
          return { ...(this.status() as object), activeConnectionId: id };
        }
        const c = this.connections[String(input.connectionId)];
        if (!c) throw new Error('Connect this shared workspace first.');
        if (input.action === 'ack') {
          if (!Array.isArray(input.rows) || input.rows.length > 10000)
            throw new Error('Invalid shared acknowledgement.');
          for (const row of input.rows as LocalRow[]) {
            const key = keyOf(row.projectId, row.taskId);
            if (
              !c.pending[key] &&
              !c.conflicts[key] &&
              !c.ignored.includes(key) &&
              Object.prototype.hasOwnProperty.call(row, 'base') &&
              same(row.task, row.base) &&
              same(row.base, remoteTask(c.snapshot, row.projectId, row.taskId))
            ) {
              c.bases[key] = normalize(row.base || null);
            }
          }
          await this.save();
          return this.status();
        }
        if (input.action === 'open') {
          await this.deps.openExternal(
            c.origin + '/team/' + c.workspaceId + '#member=' + c.memberToken,
          );
          return this.status();
        }
        if (input.action === 'disconnect') {
          if (Object.keys(c.pending).length || Object.keys(c.conflicts).length)
            throw new Error(
              'Resolve or retain pending shared changes before disconnecting.',
            );
          delete this.connections[c.id];
          await this.save();
          return this.status();
        }
        if (input.action === 'resolve') {
          const key = String(input.key),
            conflict = c.conflicts[key];
          if (!conflict) throw new Error('Shared conflict is no longer present.');
          if (Array.isArray(input.rows)) {
            const row = (input.rows as LocalRow[]).find(
              (row) => keyOf(row.projectId, row.taskId) === key,
            );
            if (row && !same(row.task, conflict.local)) {
              conflict.local = normalize(row.task);
              await this.save();
              throw new Error(
                'Your local task changed again. Review the latest changes before resolving.',
              );
            }
          }
          if (input.choice !== 'private') {
            const latest = workspace(await this.request(c, ''), c.workspaceId);
            const value = remoteTask(latest, conflict.projectId, conflict.taskId);
            if (!same(value, conflict.remote)) {
              conflict.remote = value;
              c.snapshot = latest;
              await this.save();
              throw new Error(
                'The shared task changed again. Review the latest version before resolving.',
              );
            }
            c.snapshot = latest;
          }
          c.preserveKeys = (c.preserveKeys || []).filter((value) => value !== key);
          if (input.choice === 'remote') {
            c.bases[key] = normalize(conflict.local);
            delete c.pending[key];
          } else if (input.choice === 'local') {
            if (conflict.remote === null)
              throw new Error(
                'This shared task was deleted. Keep a private copy or create a new shared task.',
              );
            c.bases[key] = normalize(conflict.remote);
            delete c.pending[key];
            c.preserveKeys.push(key);
          } else if (input.choice === 'private') {
            c.ignored.push(key);
            delete c.bases[key];
            delete c.pending[key];
          } else throw new Error('Choose how to resolve the shared task.');
          delete c.conflicts[key];
          await this.save();
          return {
            ...(this.status() as object),
            resolution: { connectionId: c.id, key, choice: input.choice },
          };
        }
        if (
          input.action !== 'sync' ||
          !Array.isArray(input.rows) ||
          input.rows.length > 10000
        )
          throw new Error('Invalid shared synchronization request.');
        const rows = input.rows as LocalRow[];
        if (
          rows.some(
            (row) =>
              !validId(row.projectId) ||
              !validId(row.taskId) ||
              (row.task &&
                (!validId(row.task.id) ||
                  row.task.id !== row.taskId ||
                  typeof row.task.title !== 'string' ||
                  typeof row.task.notes !== 'string')),
          )
        )
          throw new Error('Invalid local shared task.');
        try {
          let remote = workspace(await this.request(c, ''), c.workspaceId);
          const role = remote.members.find(
            (m) => m.id === remote.currentMember && !m.revoked,
          )?.role;
          if (!['owner', 'editor'].includes(role || '')) {
            c.snapshot = remote;
            c.error =
              'Viewer workspaces remain read-only; use the shared workspace view.';
            await this.save();
            return this.status();
          }
          c.preserveKeys = [];
          for (const row of rows) {
            const key = keyOf(row.projectId, row.taskId);
            if (c.ignored.includes(key)) continue;
            if (c.conflicts[key]) {
              c.conflicts[key].local = normalize(row.task);
              c.conflicts[key].remote = remoteTask(remote, row.projectId, row.taskId);
              continue;
            }
            const local = normalize(row.task),
              base =
                c.bases[key] === undefined
                  ? Object.prototype.hasOwnProperty.call(row, 'base')
                    ? normalize(row.base || null)
                    : remoteTask(c.snapshot, row.projectId, row.taskId)
                  : c.bases[key];
            let current = remoteTask(remote, row.projectId, row.taskId);
            if (c.bases[key] === undefined) c.bases[key] = normalize(base);
            // A command whose response was lost is reconciled before any new command ID is generated.
            const pending = c.pending[key];
            if (pending) {
              const receipt = await this.request(c, '/operations/' + pending.id);
              if (receipt.receipt) {
                c.bases[key] = normalize(pending.desired);
                delete c.pending[key];
                await this.save();
                if (same(local, pending.desired)) continue;
              }
            }
            const acknowledged = c.bases[key] === undefined ? base : c.bases[key];
            if (same(local, acknowledged)) {
              c.bases[key] = normalize(acknowledged);
              continue;
            }
            if (same(local, current)) {
              c.bases[key] = current;
              delete c.pending[key];
              continue;
            }
            if (!same(current, acknowledged)) {
              c.conflicts[key] = {
                projectId: row.projectId,
                taskId: row.taskId,
                local,
                remote: current,
              };
              continue;
            }
            const operation = c.pending[key] || {
              id: randomUUID(),
              baseRevision: remote.projectRevision,
              projectId: row.projectId,
              kind: local ? 'task.upsert' : 'task.delete',
              ...(local ? { task: local } : { taskId: row.taskId }),
              desired: local,
            };
            c.pending[key] = operation;
            await this.save();
            try {
              const { desired, ...body } = operation;
              await this.request(c, '/operations', body);
              c.bases[key] = normalize(desired);
              delete c.pending[key];
              if (!same(local, desired)) c.preserveKeys.push(key);
              await this.save();
              remote = workspace(await this.request(c, ''), c.workspaceId);
            } catch (error) {
              if ((error as { status?: number }).status === 409) {
                remote = workspace(await this.request(c, ''), c.workspaceId);
                current = remoteTask(remote, row.projectId, row.taskId);
                c.conflicts[key] = {
                  projectId: row.projectId,
                  taskId: row.taskId,
                  local,
                  remote: current,
                };
              } else throw error;
            }
          }
          c.snapshot = remote;
          c.updatedAt = new Date().toISOString();
          c.error = '';
          await this.save();
        } catch (error) {
          c.error =
            error instanceof Error
              ? error.message
              : 'Shared sync failed. Local changes remain available.';
          await this.save();
        }
        return this.status();
      });
    this.queue = task;
    return task;
  }
}
