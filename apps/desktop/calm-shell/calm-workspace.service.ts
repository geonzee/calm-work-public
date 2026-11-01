import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, filter, take } from 'rxjs';
import { TaskService } from '../tasks/task.service';
import { TaskMultiSelectService } from '../tasks/task-multi-select.service';
import { Task, TaskReminderOptionId } from '../tasks/task.model';
import { ProjectService } from '../project/project.service';
import { INBOX_PROJECT } from '../project/project.const';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { DateService } from '../../core/date/date.service';
import { ClientIdService } from '../../core/util/client-id.service';
import { selectIsTaskDataLoaded } from '../tasks/store/task.selectors';
import { PlannerActions } from '../planner/store/planner.actions';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { OperationWriteFlushService } from '../../op-log/sync/operation-write-flush.service';
import { selectPluginUserDataFeatureState } from '../../plugins/store/plugin-user-data.reducer';
import {
  upsertPluginUserData,
  deletePluginUserData,
} from '../../plugins/store/plugin.actions';
import {
  decodeFromPersist,
  encodeForPersist,
} from '../../plugins/util/plugin-data-codec';
import { MAX_PLUGIN_DATA_SIZE } from '../../plugins/plugin-persistence.model';
import { TaskRepeatCfgService } from '../task-repeat-cfg/task-repeat-cfg.service';
import { calmRepeatConfig, calmRepeatFromNative } from './calm-repeat';
import { plannedFields, taskPlannedDate, taskPlannedTime } from './calm-task-view';
import {
  CalmSharedRow,
  CalmSharedConnection,
  CalmSharedTaskData,
  CalmTask,
  CalmRepeatRule,
  CalmClock,
  CalmDocument,
  CalmEvent,
  CalmSession,
} from './calm-runtime.model';
import { validateCalmDocument } from './calm-runtime-validation';
import { prepareCalmRestore } from './calm-restore';
import {
  applyLinkEdits,
  diffLinkMap,
  LINK_MAP_NAMES,
  LinkEdits,
  LinkMap,
  LinkMapName,
  parseLinkMap,
} from './calm-link-merge';
import {
  BACKFILL_MINUTES,
  EstimateBackfillPlan,
  EstimateBackfillScope,
  planEstimateBackfill,
} from './calm-estimate-backfill';

interface TaskMeta {
  kind: 'task';
  nativeId: string;
  alias: string;
  rank: number;
  repeat: string;
  repeatRule?: CalmRepeatRule | null;
  calendar?: string;
  actualKey: string | null;
}
interface SessionMeta {
  kind: 'session';
  nativeId: string;
  value: CalmSession;
}
interface EventMeta {
  kind: 'event';
  value: CalmEvent;
}
interface ClockMeta {
  kind: 'clock';
  value: CalmClock | null;
}
interface DraftMeta {
  kind: 'drafts';
  value: CalmDocument['drafts'];
}
/** One project–calendar link or one event's project choice, synced as its own record. */
interface LinkMeta {
  kind: 'link';
  map: LinkMapName;
  key: string;
  value: unknown;
}
/** Marks the one-time 15 minute estimate backfill and keeps what it changed, to undo it. */
interface BackfillMeta {
  kind: 'estimate-backfill';
  minutes: number;
  completed: boolean;
  appliedAt: number;
  tasks: { nativeId: string; alias: string; title: string }[];
}
interface SharedProjectMeta {
  kind: 'shared-project';
  name?: string;
  connectionId: string;
  projectId: string;
  nativeId: string;
  active: boolean;
}
interface SharedTaskMeta {
  kind: 'shared-task';
  creating?: boolean;
  base?: CalmSharedTaskData | null;
  connectionId: string;
  projectId: string;
  taskId: string;
  nativeId: string;
  alias: string;
  assignee: string | null;
  detached: boolean;
}
interface RestoreMeta {
  kind: 'restore';
  hash: string;
  completed: boolean;
}
type Meta =
  | TaskMeta
  | SessionMeta
  | EventMeta
  | ClockMeta
  | DraftMeta
  | LinkMeta
  | BackfillMeta
  | RestoreMeta
  | SharedProjectMeta
  | SharedTaskMeta;
const PREFIX = 'calm-work-v1:';

@Injectable({ providedIn: 'root' })
export class CalmWorkspaceService {
  private readonly _tasks = inject(TaskService);
  private readonly _feedback = inject(TaskMultiSelectService);
  private readonly _projects = inject(ProjectService);
  private readonly _store = inject(Store);
  private readonly _date = inject(DateService);
  private readonly _init = inject(DataInitStateService);
  private readonly _client = inject(ClientIdService);
  private readonly _writes = inject(OperationWriteFlushService);
  private readonly _repeat = inject(TaskRepeatCfgService);
  private _deviceKey = '';
  private _applyingShared = false;
  private _records = new Map<string, Meta>();

  private async _ready(): Promise<void> {
    await firstValueFrom(this._init.isAllDataLoadedInitially$);
    await firstValueFrom(
      this._store.select(selectIsTaskDataLoaded).pipe(filter(Boolean), take(1)),
    );
    if (!this._deviceKey) {
      // New local profiles may not have an upstream client id yet. The upstream
      // resolver generates one only after confirming both stores are readable.
      const id = await this._client.getOrGenerateClientId();
      this._deviceKey = PREFIX + 'clock:' + id;
    }
    const rows = await firstValueFrom(
      this._store.select(selectPluginUserDataFeatureState),
    );
    this._records.clear();
    for (const row of rows.filter((item) => item.id.startsWith(PREFIX))) {
      const raw = await decodeFromPersist(row.data);
      this._records.set(row.id, JSON.parse(raw) as Meta);
    }
    for (const [key, record] of this._records) {
      if (
        record.kind === 'shared-project' &&
        record.active &&
        !record.nativeId &&
        record.name
      ) {
        const project = this._projects
          .list()
          .find((project) => project.title === record.name);
        if (project) await this._put(key, { ...record, nativeId: project.id });
      }
    }
  }

  private async _put(id: string, value: Meta): Promise<void> {
    const data = JSON.stringify(value);
    if (JSON.stringify(this._records.get(id)) === data) return;
    if (new TextEncoder().encode(data).length > MAX_PLUGIN_DATA_SIZE)
      throw new Error('Record too large');
    const encoded = await encodeForPersist(data);
    this._store.dispatch(upsertPluginUserData({ pluginUserData: { id, data: encoded } }));
    this._records.set(id, structuredClone(value));
  }

  async load(recoverClock = false): Promise<CalmDocument> {
    await this._ready();
    const nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    const repeatConfigs = await firstValueFrom(this._repeat.taskRepeatCfgs$);
    const nativeProjects = this._projects
      .list()
      .filter((project) => project.id !== INBOX_PROJECT.id);
    const metadata = [...this._records.values()];
    const taskMeta = metadata.filter(
      (record): record is TaskMeta => record.kind === 'task',
    );
    const sessions = metadata
      .filter((record): record is SessionMeta => record.kind === 'session')
      .filter((record) => nativeTasks.some((task) => task.id === record.nativeId))
      .map((record) => record.value);
    const clock = this._records.get(this._deviceKey) as ClockMeta | undefined;
    let restoredClock = clock?.value || null;
    if (restoredClock) {
      const nativeId = taskMeta.find(
        (meta) => meta.alias === restoredClock?.active,
      )?.nativeId;
      const task = nativeTasks.find((item) => item.id === nativeId);
      if (!task || task.isDone) restoredClock = null;
      else if (restoredClock.running && recoverClock) {
        const dailyMs = { ...restoredClock.dailyMs };
        for (const [day, amount] of Object.entries(task.timeSpentOnDay))
          dailyMs[day] = Math.max(
            dailyMs[day] || 0,
            amount - (restoredClock.nativeStartDays?.[day] || 0),
          );
        restoredClock = {
          ...restoredClock,
          running: false,
          elapsedMs: Math.max(
            restoredClock.elapsedMs,
            task.timeSpent - restoredClock.nativeStartMs,
          ),
          dailyMs,
        };
        if (this._tasks.currentTaskId() === nativeId) this._tasks.setCurrentId(null);
      }
    }
    return {
      recoveryPending:
        (this._records.get(PREFIX + 'restore') as RestoreMeta | undefined)?.completed ===
        false,
      today: this._date.todayStr(),
      tasks: nativeTasks
        .filter((task) => !task.parentId)
        .map((task) => {
          const meta = taskMeta.find((record) => record.nativeId === task.id);
          return {
            id: meta?.alias || task.id,
            shared: (() => {
              const ref = metadata.find(
                (record): record is SharedTaskMeta =>
                  record.kind === 'shared-task' &&
                  record.nativeId === task.id &&
                  !record.detached,
              );
              return ref
                ? {
                    connectionId: ref.connectionId,
                    projectId: ref.projectId,
                    taskId: ref.taskId,
                  }
                : undefined;
            })(),
            title: task.title,
            project:
              nativeProjects.find((project) => project.id === task.projectId)?.title ||
              '',
            date: taskPlannedDate(task),
            schedule: taskPlannedTime(task),
            estimate: task.timeEstimate ? task.timeEstimate / 60000 : null,
            done: task.isDone,
            today:
              this._date.isToday(task.dueWithTime || 0) ||
              task.dueDay === this._date.todayStr(),
            notes: task.notes || '',
            repeat:
              meta?.repeat ??
              calmRepeatFromNative(
                repeatConfigs.find((config) => config.id === task.repeatCfgId),
              ).repeat,
            repeatRule: meta
              ? meta.repeatRule || null
              : calmRepeatFromNative(
                  repeatConfigs.find((config) => config.id === task.repeatCfgId),
                ).repeatRule,
            calendar: meta?.calendar || '',
            actual:
              sessions.find((session) => session.sessionKey === meta?.actualKey) || null,
            nativeMs: task.timeSpent || 0,
            nativeDays: { ...task.timeSpentOnDay },
            rank: meta?.rank ?? 100000,
          };
        })
        .sort((a, b) => a.rank - b.rank),
      sharedProjects: metadata
        .filter(
          (record): record is SharedProjectMeta =>
            record.kind === 'shared-project' && record.active,
        )
        .map(
          (record) =>
            nativeProjects.find((project) => project.id === record.nativeId)?.title || '',
        )
        .filter(Boolean),
      projects: nativeProjects.map((project) => project.title),
      sessions,
      events: metadata
        .filter((record): record is EventMeta => record.kind === 'event')
        .map((record) => record.value),
      clock: restoredClock ? structuredClone(restoredClock) : null,
      drafts: this._draftsWithLinks(),
    };
  }

  private _linkId(name: LinkMapName, key: string): string {
    return PREFIX + 'link:' + name + ':' + encodeURIComponent(key);
  }

  /** Links held on this device: the per-link records over any legacy copy in `drafts`. */
  private _linkMap(name: LinkMapName): LinkMap {
    const drafts =
      (this._records.get(PREFIX + 'drafts') as DraftMeta | undefined)?.value || {};
    const legacy = parseLinkMap(drafts['$' + name]?.['json']) || {};
    const result: LinkMap = { ...legacy };
    for (const record of this._records.values())
      if (record.kind === 'link' && record.map === name) result[record.key] = record.value;
    return result;
  }

  private _draftsWithLinks(): CalmDocument['drafts'] {
    const drafts = {
      ...((this._records.get(PREFIX + 'drafts') as DraftMeta | undefined)?.value || {}),
    };
    for (const name of LINK_MAP_NAMES) {
      delete drafts['$' + name];
      const map = this._linkMap(name);
      if (Object.keys(map).length) drafts['$' + name] = { json: JSON.stringify(map) };
    }
    return drafts;
  }

  private async _applyLinkEdits(name: LinkMapName, edits: LinkEdits): Promise<void> {
    // First move any legacy copy into records, so nothing exists only in the shared blob.
    const stored = this._linkMap(name);
    for (const [key, value] of Object.entries(stored))
      if (!this._records.has(this._linkId(name, key)))
        await this._put(this._linkId(name, key), { kind: 'link', map: name, key, value });
    const next = applyLinkEdits(stored, edits);
    for (const key of Object.keys(stored)) {
      if (key in next) continue;
      const id = this._linkId(name, key);
      this._store.dispatch(deletePluginUserData({ pluginId: id }));
      this._records.delete(id);
    }
    for (const [key, value] of Object.entries(next))
      await this._put(this._linkId(name, key), { kind: 'link', map: name, key, value });
  }

  /**
   * The one-time estimate backfill. Without `apply` it only reports what would change.
   * With `apply` it records the affected tasks first (so it can be undone), writes an
   * estimate only where a task still has none, and never runs a second time.
   */
  async backfillEstimates(
    apply = false,
    scope: EstimateBackfillScope = 'open',
  ): Promise<{ plan: EstimateBackfillPlan; applied: number; alreadyApplied: boolean }> {
    await this._ready();
    const document = await this.load();
    const key = PREFIX + (scope === 'done' ? 'estimate-backfill-done' : 'estimate-backfill');
    const marker = this._records.get(key) as BackfillMeta | undefined;
    const nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    // Tasks that are calendar events (imported by a calendar issue provider) are never changed.
    const events = new Set<string>();
    for (const task of nativeTasks) {
      if (!task.issueId && !task.issueType && !task.issueProviderId) continue;
      const meta = [...this._records.values()].find(
        (record): record is TaskMeta => record.kind === 'task' && record.nativeId === task.id,
      );
      events.add(meta?.alias || task.id);
    }
    const plan = planEstimateBackfill(document, BACKFILL_MINUTES, { scope, events });
    if (marker?.completed) return { plan, applied: 0, alreadyApplied: true };
    if (!apply || document.recoveryPending) return { plan, applied: 0, alreadyApplied: false };
    const targets = plan.tasks
      .map((item) => {
        const meta = [...this._records.values()].find(
          (record): record is TaskMeta => record.kind === 'task' && record.alias === item.id,
        );
        const nativeId = meta?.nativeId || item.id;
        return { nativeId, alias: item.id, title: item.title };
      })
      .filter((item) => {
        const task = nativeTasks.find((candidate) => candidate.id === item.nativeId);
        return (
          !!task &&
          !task.timeEstimate &&
          !task.timeSpent &&
          !task.issueId &&
          !task.issueType &&
          task.isDone === (scope === 'done')
        );
      });
    const meta = (completed: boolean): BackfillMeta => ({
      kind: 'estimate-backfill',
      minutes: BACKFILL_MINUTES,
      completed,
      appliedAt: Date.now(),
      tasks: targets,
    });
    await this._put(key, meta(false));
    await this._writes.flushPendingWrites();
    for (const item of targets)
      this._tasks.update(item.nativeId, { timeEstimate: BACKFILL_MINUTES * 60000 });
    await this._put(key, meta(true));
    await this._writes.flushPendingWrites();
    return { plan, applied: targets.length, alreadyApplied: false };
  }

  /** Undo the backfill: clear the estimate only where it is still exactly the backfilled one. */
  async undoEstimateBackfill(scope: EstimateBackfillScope = 'open'): Promise<number> {
    await this._ready();
    const key = PREFIX + (scope === 'done' ? 'estimate-backfill-done' : 'estimate-backfill');
    const marker = this._records.get(key) as BackfillMeta | undefined;
    if (!marker) return 0;
    const nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    let reverted = 0;
    for (const item of marker.tasks) {
      const task = nativeTasks.find((candidate) => candidate.id === item.nativeId);
      if (task && task.timeEstimate === marker.minutes * 60000 && !task.timeSpent) {
        this._tasks.update(task.id, { timeEstimate: 0 });
        reverted++;
      }
    }
    await this._put(key, { ...marker, completed: true, tasks: [] });
    await this._writes.flushPendingWrites();
    return reverted;
  }

  private _sharedTask(
    view: CalmTask,
    assignee: string | null,
    base?: CalmSharedTaskData | null,
  ): CalmSharedTaskData {
    const original = base?.plannedFor ? new Date(base.plannedFor) : null;
    const originalDay = original
      ? original.getFullYear() +
        '-' +
        String(original.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(original.getDate()).padStart(2, '0')
      : '';
    const originalTime = original
      ? String(original.getHours()).padStart(2, '0') +
        ':' +
        String(original.getMinutes()).padStart(2, '0')
      : '';
    return {
      id: view.shared?.taskId || view.id,
      title: view.title,
      done: view.done,
      plannedFor:
        view.date && view.schedule
          ? originalDay === view.date && originalTime === view.schedule
            ? base!.plannedFor
            : new Date(view.date + 'T' + view.schedule + ':00').toISOString()
          : null,
      plannedDate: view.date && !view.schedule ? view.date : null,
      estimateMinutes: view.estimate || null,
      notes: view.notes || '',
      assignee,
    };
  }
  async sharedRows(connectionId: string): Promise<CalmSharedRow[]> {
    const document = await this.load();
    return [...this._records.values()]
      .filter(
        (record): record is SharedTaskMeta =>
          record.kind === 'shared-task' &&
          record.connectionId === connectionId &&
          !record.detached,
      )
      .filter(
        (ref) => !ref.creating || document.tasks.some((task) => task.id === ref.alias),
      )
      .map((ref) => {
        const task = document.tasks.find((task) => task.id === ref.alias);
        return {
          projectId: ref.projectId,
          taskId: ref.taskId,
          ...('base' in ref ? { base: ref.base } : {}),
          task: task
            ? {
                ...this._sharedTask(task, ref.assignee, ref.base),
                id: ref.taskId,
              }
            : null,
        };
      });
  }
  async applyShared(
    connection: CalmSharedConnection,
    startRows: CalmSharedRow[],
    resolution?: { key: string; choice: string },
  ): Promise<CalmDocument> {
    const document = await this.load();
    if (document.recoveryPending || connection.error) return document;
    const refs = [...this._records.entries()].filter(
      (entry): entry is [string, SharedTaskMeta] =>
        entry[1].kind === 'shared-task' &&
        entry[1].connectionId === connection.id &&
        !entry[1].detached,
    );
    const start = new Map(
      startRows.map((row) => [row.projectId + ':' + row.taskId, row.task]),
    );
    const preserve = new Set([
      ...(connection.preserveKeys || []),
      ...connection.conflicts.map((conflict) => conflict.key),
    ]);
    const equal = (a: unknown, b: unknown): boolean =>
      JSON.stringify(a) === JSON.stringify(b);
    const existingProjects = [...this._records.values()].filter(
      (record): record is SharedProjectMeta =>
        record.kind === 'shared-project' &&
        record.connectionId === connection.id &&
        record.active,
    );
    const incoming = new Set(
      connection.snapshot.projects.flatMap((project) =>
        project.tasks.map((task) => project.id + ':' + task.id),
      ),
    );
    for (const [metaKey, ref] of refs) {
      const key = ref.projectId + ':' + ref.taskId;
      if (
        connection.ignored.includes(key) ||
        (!incoming.has(key) && !preserve.has(key))
      ) {
        const task = document.tasks.find((task) => task.id === ref.alias);
        if (task && !connection.ignored.includes(key) && start.has(key)) {
          const current = {
            ...this._sharedTask(task, ref.assignee, ref.base),
            id: ref.taskId,
          };
          if (!equal(current, start.get(key))) continue;
        }
        if (task) {
          task.project = '';
          if (!connection.ignored.includes(key)) task.done = true;
        }
        await this._put(metaKey, { ...ref, detached: true });
      }
    }
    const projectNames = new Map<string, string>();
    const pendingRefs: {
      key: string;
      projectId: string;
      task: CalmSharedTaskData;
      alias: string;
      name: string;
    }[] = [];
    if (!['owner', 'editor'].includes(connection.role)) return document;
    for (const project of connection.snapshot.projects) {
      const mapped = existingProjects.find((meta) => meta.projectId === project.id);
      let name = mapped
        ? this._projects.list().find((project) => project.id === mapped.nativeId)
            ?.title ||
          mapped.name ||
          ''
        : '';
      if (!name) {
        const base = 'Shared · ' + connection.name + ' / ' + project.name;
        name = base;
        for (let n = 2; document.projects.includes(name); n++)
          name = base + ' (' + n + ')';
        document.projects.push(name);
      }
      projectNames.set(project.id, name);
      if (!mapped)
        await this._put(PREFIX + 'shared-project:' + connection.id + ':' + project.id, {
          kind: 'shared-project',
          connectionId: connection.id,
          projectId: project.id,
          nativeId: '',
          name,
          active: true,
        });
      for (const remote of project.tasks) {
        const key = project.id + ':' + remote.id;
        if (connection.ignored.includes(key) || preserve.has(key)) continue;
        const ref = refs.find(
          ([, meta]) => meta.projectId === project.id && meta.taskId === remote.id,
        )?.[1];
        let local = ref
          ? document.tasks.find((task) => task.id === ref.alias)
          : undefined;
        if (ref && !local && !ref.creating) continue; // Explicit local deletion is an outgoing command, never a reason to recreate a task.
        const canonical = (value: CalmSharedTaskData | null | undefined) =>
          value
            ? {
                id: value.id,
                title: value.title,
                done: value.done,
                plannedFor: value.plannedFor || null,
                plannedDate: value.plannedDate || null,
                estimateMinutes: value.estimateMinutes ?? null,
                notes: value.notes || '',
                assignee: value.assignee || null,
              }
            : null;
        if (
          local &&
          start.has(key) &&
          !equal(
            canonical({
              ...this._sharedTask(local, ref?.assignee || null, ref?.base),
              id: remote.id,
            }),
            canonical(start.get(key)),
          )
        )
          continue;
        let alias = ref?.alias || 'shared:' + connection.id + ':' + remote.id;
        if (!local && !ref && document.tasks.some((task) => task.id === alias))
          alias += ':' + crypto.randomUUID();
        const date = remote.plannedFor ? new Date(remote.plannedFor) : null;
        const day = date
          ? date.getFullYear() +
            '-' +
            String(date.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(date.getDate()).padStart(2, '0')
          : remote.plannedDate || '';
        const time = date
          ? String(date.getHours()).padStart(2, '0') +
            ':' +
            String(date.getMinutes()).padStart(2, '0')
          : '';
        const fields = {
          title: remote.title,
          project: name,
          date: day,
          schedule: time,
          estimate: remote.estimateMinutes,
          done: remote.done,
          today: day === this._date.todayStr(),
          notes: remote.notes,
        };
        if (local) Object.assign(local, fields);
        else {
          local = { id: alias, ...fields };
          document.tasks.push(local);
        }
        if (!ref)
          await this._put(PREFIX + 'shared:' + connection.id + ':' + key, {
            kind: 'shared-task',
            connectionId: connection.id,
            projectId: project.id,
            taskId: remote.id,
            nativeId: alias,
            alias,
            assignee: remote.assignee,
            base: remote,
            detached: false,
            creating: true,
          });
        pendingRefs.push({
          key,
          projectId: project.id,
          task: remote,
          alias,
          name,
        });
      }
    }
    await this._writes.flushPendingWrites();
    this._applyingShared = true;
    try {
      await this.save(document);
    } finally {
      this._applyingShared = false;
    }
    for (const project of connection.snapshot.projects) {
      const native = this._projects
        .list()
        .find((item) => item.title === projectNames.get(project.id));
      if (native)
        await this._put(PREFIX + 'shared-project:' + connection.id + ':' + project.id, {
          kind: 'shared-project',
          connectionId: connection.id,
          projectId: project.id,
          nativeId: native.id,
          active: true,
          name: projectNames.get(project.id),
        });
    }
    for (const ref of pendingRefs) {
      const task = [...this._records.values()].find(
        (record): record is TaskMeta =>
          record.kind === 'task' && record.alias === ref.alias,
      );
      if (task)
        await this._put(PREFIX + 'shared:' + connection.id + ':' + ref.key, {
          kind: 'shared-task',
          connectionId: connection.id,
          projectId: ref.projectId,
          taskId: ref.task.id,
          nativeId: task.nativeId,
          alias: ref.alias,
          assignee: ref.task.assignee,
          base: ref.task,
          creating: false,
          detached: false,
        });
    }
    await this._writes.flushPendingWrites();
    return this.load();
  }
  async detachShared(connectionId: string): Promise<CalmDocument> {
    const document = await this.load();
    for (const [key, record] of this._records) {
      if (
        record.kind === 'shared-task' &&
        record.connectionId === connectionId &&
        !record.detached
      ) {
        const task = document.tasks.find((task) => task.id === record.alias);
        if (task) task.project = '';
        await this._put(key, { ...record, detached: true });
      }
      if (record.kind === 'shared-project' && record.connectionId === connectionId)
        await this._put(key, { ...record, active: false });
    }
    return this.save(document);
  }

  async restore(input: unknown): Promise<CalmDocument> {
    const prepared = await prepareCalmRestore(input);
    const current = await this.load();
    const key = PREFIX + 'restore';
    const receipt = this._records.get(key) as RestoreMeta | undefined;
    if (receipt?.hash === prepared.hash && receipt.completed) return current;
    if (
      receipt?.hash !== prepared.hash &&
      (current.tasks.length ||
        current.projects.length ||
        current.sessions.length ||
        current.events.length ||
        current.clock ||
        Object.keys(current.drafts).some((name) =>
          Object.values(current.drafts[name]).some(Boolean),
        ))
    )
      throw new Error(
        'Restore needs an empty workspace. Export your current work and use a fresh profile.',
      );
    await this._put(key, {
      kind: 'restore',
      hash: prepared.hash,
      completed: false,
    });
    await this._writes.flushPendingWrites();
    const restored = await this.save(prepared.document, true);
    // Reconcile authoritative imported totals after replay, including interrupted session metadata writes.
    const native = await firstValueFrom(this._tasks.allTasks$);
    for (const [alias, days] of Object.entries(prepared.totals)) {
      const meta = [...this._records.values()].find(
        (record) => record.kind === 'task' && record.alias === alias,
      ) as TaskMeta | undefined;
      const task = native.find((task) => task.id === meta?.nativeId);
      if (task) this._tasks.update(task.id, { timeSpentOnDay: days });
    }
    if (restored.clock) {
      const active = restored.tasks.find((task) => task.id === restored.clock?.active);
      restored.clock.nativeStartDays = { ...prepared.totals[active?.id || ''] };
      restored.clock.nativeStartMs = Object.values(restored.clock.nativeStartDays).reduce(
        (sum, ms) => sum + ms,
        0,
      );
      await this._put(this._deviceKey, {
        kind: 'clock',
        value: restored.clock,
      });
    }
    await this._put(key, {
      kind: 'restore',
      hash: prepared.hash,
      completed: true,
    });
    await this._writes.flushPendingWrites();
    return this.load();
  }

  async save(input: unknown, seed = false): Promise<CalmDocument> {
    // The shared renderer supplies one contextual confirmation; background native
    // scheduling must not stack a second toast over the user's current work.
    this._feedback.setBulkFeedbackSuppressed(true);
    try {
      return await this._save(input, seed);
    } finally {
      this._feedback.setBulkFeedbackSuppressed(false);
    }
  }

  private async _save(input: unknown, seed: boolean): Promise<CalmDocument> {
    const document = validateCalmDocument(input);
    // Validate every plan before dispatching any task action.
    const schedules = document.tasks.map((task) =>
      plannedFields(task.date, task.schedule),
    );
    await this._ready();
    if (
      !seed &&
      (this._records.get(PREFIX + 'restore') as RestoreMeta | undefined)?.completed ===
        false
    )
      throw new Error('Finish workspace recovery before making changes.');
    let nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    if (!seed) {
      const sharedProjects = [...this._records.values()].filter(
        (record): record is SharedProjectMeta =>
          record.kind === 'shared-project' && record.active,
      );
      for (const oldName of Object.keys(document.projectRenames || {}))
        if (
          sharedProjects.some(
            (record) =>
              this._projects.list().find((project) => project.id === record.nativeId)
                ?.title === oldName,
          )
        )
          throw new Error('Rename shared projects through the shared workspace.');
      for (const view of document.tasks) {
        const ref = [...this._records.values()].find(
          (record): record is SharedTaskMeta =>
            record.kind === 'shared-task' && !record.detached && record.alias === view.id,
        );
        if (ref) {
          const expected = sharedProjects.find(
            (project) =>
              project.connectionId === ref.connectionId &&
              project.projectId === ref.projectId,
          );
          const name = this._projects
            .list()
            .find((project) => project.id === expected?.nativeId)?.title;
          if (name && view.project !== name)
            throw new Error(
              'Keep a private copy before moving a shared task to a personal project.',
            );
        }
      }
    }
    for (const [oldName, newName] of Object.entries(document.projectRenames || {})) {
      const project = this._projects.list().find((item) => item.title === oldName);
      if (project && newName.trim())
        this._projects.update(project.id, { title: newName.trim() });
    }
    const projectIds = new Map(
      this._projects.list().map((project) => [project.title, project.id]),
    );
    for (const name of document.projects
      .concat(document.tasks.map((task) => task.project))
      .filter(Boolean)) {
      if (!projectIds.has(name))
        projectIds.set(name, this._projects.add({ title: name }));
    }
    const aliases = new Map(
      [...this._records.values()]
        .filter((record): record is TaskMeta => record.kind === 'task')
        .map((record) => [record.alias, record.nativeId]),
    );
    for (const task of nativeTasks)
      if (!aliases.has(task.id)) aliases.set(task.id, task.id);
    for (const alias of document.deletedTaskIds || []) {
      const nativeId = aliases.get(alias);
      const task = nativeTasks.find((item) => item.id === nativeId);
      if (!task || !nativeId) continue;
      if (this._tasks.currentTaskId() === nativeId) this._tasks.setCurrentId(null);
      if (task.repeatCfgId) this._repeat.deleteTaskRepeatCfg(task.repeatCfgId);
      this._tasks.removeMultipleTasks([nativeId]);
      for (const [key, record] of this._records) {
        if (
          (record.kind === 'task' || record.kind === 'session') &&
          record.nativeId === nativeId
        ) {
          this._store.dispatch(deletePluginUserData({ pluginId: key }));
          this._records.delete(key);
        }
      }
      for (const [key, record] of this._records) {
        if (record.kind === 'clock' && record.value?.active === alias)
          await this._put(key, { kind: 'clock', value: null });
      }
    }
    nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    const nextActive = document.clock?.active ? aliases.get(document.clock.active) : null;
    const previousActive = this._tasks.currentTaskId();
    // Flush native tracking before reconciling completed/edited intervals.
    if (previousActive && (!document.clock?.running || previousActive !== nextActive))
      this._tasks.setCurrentId(null);
    for (const [index, viewTask] of document.tasks.entries()) {
      let nativeId = aliases.get(viewTask.id);
      const current = nativeTasks.find((task) => task.id === nativeId);
      const fields = {
        title: viewTask.title.trim(),
        projectId: projectIds.get(viewTask.project) || INBOX_PROJECT.id,
        notes: viewTask.notes || '',
        timeEstimate: (viewTask.estimate || 0) * 60000,
      };
      if (!current) {
        nativeId = this._tasks.add(
          fields.title,
          false,
          {
            ...fields,
            ...schedules[index],
            isDone: viewTask.done,
            ...(seed || this._applyingShared ? { id: viewTask.id } : {}),
            ...(seed && viewTask.nativeDays
              ? { timeSpentOnDay: viewTask.nativeDays }
              : {}),
          },
          true,
          true,
        );
        aliases.set(viewTask.id, nativeId);
      } else {
        const changed = Object.entries(fields).some(
          ([key, value]) => current[key as keyof Task] !== value,
        );
        if (changed) this._tasks.update(current.id, fields);
        const schedule = schedules[index];
        if (
          (current.dueDay || null) !== schedule.dueDay ||
          (current.dueWithTime || null) !== schedule.dueWithTime
        ) {
          if (schedule.dueWithTime)
            this._tasks.scheduleTask(
              current,
              schedule.dueWithTime,
              TaskReminderOptionId.DoNotRemind,
            );
          else if (schedule.dueDay)
            this._store.dispatch(
              PlannerActions.planTaskForDay({
                task: current,
                day: schedule.dueDay,
              }),
            );
          else
            this._store.dispatch(
              TaskSharedActions.unscheduleTask({
                id: current.id,
                isSkipToast: true,
              }),
            );
        }
        if (current.isDone !== viewTask.done)
          this._tasks.update(current.id, { isDone: viewTask.done });
      }
      if (!nativeId) throw new Error('Task identity unavailable');
      if (
        !this._applyingShared &&
        ![...this._records.values()].some(
          (record) => record.kind === 'shared-task' && record.nativeId === nativeId,
        )
      ) {
        const mapped = [...this._records.values()].find(
          (record): record is SharedProjectMeta =>
            record.kind === 'shared-project' &&
            record.active &&
            record.nativeId === fields.projectId,
        );
        if (mapped) {
          const taskId = 'local-' + nativeId;
          await this._put(
            PREFIX +
              'shared:' +
              mapped.connectionId +
              ':' +
              mapped.projectId +
              ':' +
              taskId,
            {
              kind: 'shared-task',
              connectionId: mapped.connectionId,
              projectId: mapped.projectId,
              taskId,
              nativeId,
              alias: viewTask.id,
              assignee: null,
              base: null,
              detached: false,
            },
          );
        }
      }

      const previous = this._records.get(PREFIX + 'task:' + nativeId) as
        | TaskMeta
        | undefined;
      const repeat = viewTask.repeat || '';
      const repeatChanged =
        repeat !== (previous?.repeat || '') ||
        JSON.stringify(viewTask.repeatRule || null) !==
          JSON.stringify(previous?.repeatRule || null);
      const templateChanged =
        !current ||
        ['title', 'projectId', 'notes', 'timeEstimate'].some(
          (key) => current[key as keyof Task] !== fields[key as keyof typeof fields],
        );
      if (repeatChanged || (repeat && templateChanged))
        await this._configureRepeat(nativeId, viewTask, fields.projectId, repeatChanged);
      await this._put(PREFIX + 'task:' + nativeId, {
        kind: 'task',
        nativeId,
        alias: viewTask.id,
        rank: index,
        repeat,
        repeatRule: viewTask.repeatRule || null,
        calendar: viewTask.calendar || '',
        actualKey: viewTask.actual?.sessionKey || null,
      });
    }
    nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    for (const session of document.sessions) {
      const nativeId = aliases.get(session.id);
      const task = (await firstValueFrom(this._tasks.allTasks$)).find(
        (item) => item.id === nativeId,
      );
      if (!task || !nativeId) throw new Error('Session task unavailable');
      const key = PREFIX + 'session:' + session.sessionKey;
      const old = this._records.get(key) as SessionMeta | undefined;
      const newMs = Math.round(session.focusedSeconds * 1000);
      if (
        !old ||
        old.value.focusedSeconds !== session.focusedSeconds ||
        old.value.date !== session.date
      ) {
        const days = { ...task.timeSpentOnDay };
        const oldDaily =
          old?.value.dailyMs ||
          (old ? { [old.value.date]: Math.round(old.value.focusedSeconds * 1000) } : {});
        for (const [day, amount] of Object.entries(oldDaily))
          days[day] = Math.max(0, (days[day] || 0) - amount);
        if (!old && !seed && session.nativeStartDays) {
          for (const [day, amount] of Object.entries(task.timeSpentOnDay)) {
            const nativeDelta = Math.max(0, amount - (session.nativeStartDays[day] || 0));
            days[day] = Math.max(0, (days[day] || 0) - nativeDelta);
          }
        } else if (!old && !seed && session.nativeStartMs != null) {
          const nativeDelta = Math.max(0, task.timeSpent - session.nativeStartMs);
          days[session.date] = Math.max(0, (days[session.date] || 0) - nativeDelta);
        }
        const newDaily = session.dailyMs || { [session.date]: newMs };
        for (const [day, amount] of Object.entries(newDaily))
          days[day] = (days[day] || 0) + amount;
        this._tasks.update(task.id, { timeSpentOnDay: days });
      }
      await this._put(key, { kind: 'session', nativeId, value: session });
    }
    for (const event of document.events)
      await this._put(PREFIX + 'event:' + event.id, {
        kind: 'event',
        value: event,
      });
    // Links are saved as edits against what this device last saw, never as a whole map,
    // so an empty or stale map here cannot delete links another device made.
    const draftsValue = { ...document.drafts };
    for (const name of LINK_MAP_NAMES) {
      const mine = parseLinkMap(draftsValue['$' + name]?.['json']);
      delete draftsValue['$' + name];
      const base = parseLinkMap(document.mergeBase?.[name]);
      await this._applyLinkEdits(name, diffLinkMap(mine, base, this._linkMap(name)));
    }
    await this._put(PREFIX + 'drafts', {
      kind: 'drafts',
      value: draftsValue,
    });
    await this._put(this._deviceKey, { kind: 'clock', value: document.clock });
    const activeId = document.clock?.active ? aliases.get(document.clock.active) : null;
    if (document.clock?.running && activeId && this._tasks.currentTaskId() !== activeId)
      this._tasks.setCurrentId(activeId);
    if (!document.clock?.running && this._tasks.currentTaskId())
      this._tasks.setCurrentId(null);
    await this._deleteProjects(document.deletedProjects || []);
    await this._writes.flushPendingWrites();
    return this.load();
  }

  /**
   * Remove projects whose tasks the renderer already moved to Inbox or deleted in
   * this same save. Refuses if a task would be lost, and never removes Inbox or a
   * shared project.
   */
  private async _deleteProjects(names: string[]): Promise<void> {
    if (!names.length) return;
    await this._writes.flushPendingWrites();
    const nativeTasks = await firstValueFrom(this._tasks.allTasks$);
    for (const name of names) {
      const project = this._projects.list().find((item) => item.title === name);
      if (!project) continue;
      if (project.id === INBOX_PROJECT.id) throw new Error('Inbox cannot be deleted.');
      if (
        [...this._records.values()].some(
          (record) =>
            record.kind === 'shared-project' &&
            record.active &&
            record.nativeId === project.id,
        )
      )
        throw new Error('Disconnect the shared workspace before deleting this project.');
      const remaining = nativeTasks.filter((task) => task.projectId === project.id);
      if (remaining.length)
        throw new Error('Move or delete this project\'s tasks before deleting it.');
      const listed = [...project.taskIds, ...project.backlogTaskIds].filter((id) =>
        nativeTasks.some((task) => task.id === id),
      );
      if (listed.length)
        throw new Error('Project still lists tasks; it was not deleted.');
      await this._projects.remove(project);
      await this._put(PREFIX + 'drafts', {
        kind: 'drafts',
        value: Object.fromEntries(
          Object.entries(
            (this._records.get(PREFIX + 'drafts') as DraftMeta | undefined)?.value || {},
          ).filter(([key]) => key !== 'project:' + name),
        ),
      });
    }
  }

  private async _configureRepeat(
    id: string,
    viewTask: CalmTask,
    projectId: string,
    ruleChanged: boolean,
  ): Promise<void> {
    const task = await firstValueFrom(this._tasks.getByIdOnce$(id));
    const config = calmRepeatConfig(viewTask, this._date.todayStr());
    if (!config) {
      if (task.repeatCfgId) this._repeat.deleteTaskRepeatCfg(task.repeatCfgId);
      return;
    }
    const existing = task.repeatCfgId
      ? await firstValueFrom(
          this._repeat.getTaskRepeatCfgByIdAllowUndefined$(task.repeatCfgId),
        )
      : undefined;
    // Use the native persistent actions, never the import-only upsert (which is
    // deliberately absent from the operation log). Keep the current occurrence's
    // explicit plan after the native repeat editor's scheduling side effects.
    let repeatId = task.repeatCfgId;
    if (existing && repeatId) {
      this._repeat.updateTaskRepeatCfg(
        repeatId,
        ruleChanged
          ? { ...config, projectId }
          : {
              title: config.title,
              notes: config.notes,
              projectId,
              defaultEstimate: config.defaultEstimate,
            },
      );
    } else repeatId = this._repeat.addTaskRepeatCfgToTask(id, projectId, config);
    await this._writes.flushPendingWrites();
    if (ruleChanged && repeatId) {
      const anchor = viewTask.date || this._date.todayStr();
      this._repeat.updateTaskRepeatCfg(repeatId, {
        lastTaskCreationDay: anchor,
        lastTaskCreation: new Date(`${anchor}T12:00:00`).getTime(),
      });
      this._tasks.update(id, {
        created: new Date(`${anchor}T12:00:00`).getTime(),
      });
    }
    const latest = await firstValueFrom(this._tasks.getByIdOnce$(id));
    const schedule = plannedFields(viewTask.date, viewTask.schedule);
    if (
      (latest.dueDay || null) !== schedule.dueDay ||
      (latest.dueWithTime || null) !== schedule.dueWithTime
    ) {
      if (schedule.dueWithTime)
        this._tasks.scheduleTask(
          latest,
          schedule.dueWithTime,
          TaskReminderOptionId.DoNotRemind,
        );
      else if (schedule.dueDay)
        this._store.dispatch(
          PlannerActions.planTaskForDay({ task: latest, day: schedule.dueDay }),
        );
      else
        this._store.dispatch(TaskSharedActions.unscheduleTask({ id, isSkipToast: true }));
    }
  }
}
