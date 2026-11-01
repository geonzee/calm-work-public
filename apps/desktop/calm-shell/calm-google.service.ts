import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable, race, timer } from 'rxjs';
import { map, skip, take } from 'rxjs/operators';
import { OAuthFlowConfig } from '@super-productivity/plugin-api';
import { IS_ELECTRON } from '../../app.constants';
import { PluginService } from '../../plugins/plugin.service';
import { PluginBridgeService } from '../../plugins/plugin-bridge.service';
import { PluginOAuthBridgeService } from '../../plugins/oauth/plugin-oauth-bridge.service';
import { PluginIssueProviderRegistryService } from '../../plugins/issue-provider/plugin-issue-provider-registry.service';
import { CalendarIntegrationService } from '../calendar-integration/calendar-integration.service';
import { IssueProviderActions } from '../issue/store/issue-provider.actions';
import { issueProvidersFeature } from '../issue/store/issue-provider.reducer';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { ISSUE_PROVIDER_DEFAULT_COMMON_CFG } from '../issue/issue.const';
import { IssueProvider, IssueProviderPluginType } from '../issue/issue.model';
import { applyPluginOAuthOverrides } from '../issue/dialog-edit-issue-provider/plugin-oauth-config-overrides.util';

/**
 * Thin Calm Work layer over Super Productivity's own Google Calendar provider:
 * SP's plugin does the OAuth (its published desktop client + PKCE), keeps the
 * tokens, polls and caches events. Calm Work only maps its two Google slots to
 * two SP issue providers and reshapes events for the Plan view.
 */
export const GOOGLE_PLUGIN_ID = 'google-calendar-provider';
const GOOGLE_KEY = 'plugin:google-calendar-provider';
export const CALM_GOOGLE_SLOTS: Record<string, string> = {
  google: 'calm-google-1',
  'google-2': 'calm-google-2',
};
const SLOT_OF: Record<string, string> = Object.fromEntries(
  Object.entries(CALM_GOOGLE_SLOTS).map(([slot, id]) => [id, slot]),
);

export interface CalmGoogleRawEvent {
  accountId: string;
  calendarId: string;
  eventId: string;
  title: string;
  description: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  recurring?: boolean;
  seriesId?: string;
  repeat?: string;
  repeatRule?: { every?: number; weekdays?: number[]; weekOfMonth?: number } | null;
  project?: string;
}

/** A write shown in Plan until the next poll already contains it. */
export interface HeldCalendarChange {
  kind: 'create' | 'update' | 'delete';
  accountId?: string;
  calendarId: string;
  eventId: string;
  title?: string;
  description?: string;
  startMs?: number;
  endMs?: number;
  allDay?: boolean;
  recurring?: boolean;
  repeat?: string;
  repeatRule?: { every?: number; weekdays?: number[]; weekOfMonth?: number } | null;
  project?: string;
  until: number;
}

interface HoldableEvent {
  accountId?: string;
  calendarId: string;
  eventId: string;
  title: string;
  description: string;
  startMs: number;
  endMs: number;
  allDay?: boolean;
  recurring?: boolean;
  seriesId?: string;
  repeat?: string;
  repeatRule?: { every?: number; weekdays?: number[]; weekOfMonth?: number } | null;
  project?: string;
}

function sameHeldEvent(event: HoldableEvent, item: HeldCalendarChange): boolean {
  return (
    event.eventId === item.eventId &&
    (!item.accountId || !event.accountId || event.accountId === item.accountId)
  );
}

function changeLanded(event: HoldableEvent, item: HeldCalendarChange): boolean {
  if (item.title !== undefined && event.title !== item.title) return false;
  if (item.description !== undefined && event.description !== item.description) return false;
  if (item.startMs !== undefined && event.startMs !== item.startMs) return false;
  if (item.endMs !== undefined && event.endMs !== item.endMs) return false;
  if (item.calendarId && event.calendarId !== item.calendarId) return false;
  return (
    item.title !== undefined ||
    item.description !== undefined ||
    item.startMs !== undefined ||
    item.endMs !== undefined ||
    !!item.calendarId
  );
}

/** Keep a just-written event in the list the poll has not caught up with yet. */
export function holdCalendarChanges<T extends HoldableEvent>(
  events: T[],
  held: HeldCalendarChange[],
  now = Date.now(),
): { events: T[]; held: HeldCalendarChange[] } {
  const keep: HeldCalendarChange[] = [];
  let next = events.map((event) => ({ ...event }));
  for (const item of held) {
    if (item.until <= now) continue;
    if (item.kind === 'delete') {
      if (!next.some((event) => sameHeldEvent(event, item))) continue;
      keep.push(item);
      next = next.filter((event) => !sameHeldEvent(event, item));
      continue;
    }
    if (item.kind === 'update') {
      if (!next.some((event) => sameHeldEvent(event, item))) continue;
      if (next.some((event) => sameHeldEvent(event, item) && changeLanded(event, item))) continue;
      keep.push(item);
      next = next.map((event) =>
        sameHeldEvent(event, item)
          ? {
              ...event,
              ...(item.title !== undefined ? { title: item.title } : {}),
              ...(item.description !== undefined ? { description: item.description } : {}),
              ...(item.startMs !== undefined ? { startMs: item.startMs } : {}),
              ...(item.endMs !== undefined ? { endMs: item.endMs } : {}),
              ...(item.calendarId ? { calendarId: item.calendarId } : {}),
            }
          : event,
      );
      continue;
    }
    const startMs = item.startMs ?? NaN;
    const endMs = item.endMs ?? NaN;
    if (!Number.isFinite(startMs) || !(endMs > startMs)) continue;
    const landed = next.some(
      (event) =>
        event.calendarId === item.calendarId &&
        event.title === (item.title || 'New event') &&
        event.startMs === startMs &&
        (!item.accountId || !event.accountId || event.accountId === item.accountId),
    );
    if (landed) continue;
    keep.push(item);
    next.push({
      accountId: item.accountId || '',
      calendarId: item.calendarId,
      eventId: item.eventId,
      title: item.title || 'New event',
      description: item.description || '',
      startMs,
      endMs,
      allDay: !!item.allDay,
      recurring: !!item.recurring || !!item.repeat,
      seriesId: '',
      ...(item.repeat ? { repeat: item.repeat, repeatRule: item.repeatRule || null } : {}),
      ...(item.project ? { project: item.project } : {}),
    } as T);
  }
  return { events: next, held: keep };
}

/** The create, update or delete command, as a hold Plan can draw immediately. */
export function heldChangeFromCommand(
  input: Record<string, unknown>,
  now = Date.now(),
): HeldCalendarChange | null {
  const action = String(input['action'] || '');
  const ref = (input['ref'] || {}) as Record<string, unknown>;
  const event = (input['event'] || {}) as Record<string, unknown>;
  const changes = (input['changes'] || {}) as Record<string, unknown>;
  const accountId = String(ref['accountId'] || event['accountId'] || '');
  const until = now + 20000;
  if (action === 'event-delete') {
    const eventId = String(ref['eventId'] || '');
    return eventId
      ? { kind: 'delete', accountId, calendarId: String(ref['calendarId'] || ''), eventId, until }
      : null;
  }
  if (action === 'event-update') {
    const eventId = String(ref['eventId'] || '');
    const startMs = Number(changes['startMs']);
    const endMs = Number(changes['endMs']);
    const change: HeldCalendarChange = {
      kind: 'update',
      accountId,
      calendarId: typeof changes['calendarId'] === 'string' ? changes['calendarId'] : '',
      eventId,
      ...(typeof changes['title'] === 'string' ? { title: changes['title'] } : {}),
      ...(typeof changes['description'] === 'string' ? { description: changes['description'] } : {}),
      ...(Number.isFinite(startMs) ? { startMs } : {}),
      ...(Number.isFinite(endMs) ? { endMs } : {}),
      until,
    };
    const hasField =
      change.title !== undefined ||
      change.description !== undefined ||
      change.startMs !== undefined ||
      change.endMs !== undefined ||
      !!change.calendarId;
    if (!eventId || !hasField) return null;
    return change;
  }
  if (action === 'event-create') {
    const startMs = Number(event['startMs']);
    const endMs = Number(event['endMs']);
    if (!Number.isFinite(startMs) || !(endMs > startMs)) return null;
    const repeat = typeof event['repeat'] === 'string' ? event['repeat'] : '';
    const repeatRule =
      event['repeatRule'] && typeof event['repeatRule'] === 'object'
        ? (event['repeatRule'] as HeldCalendarChange['repeatRule'])
        : null;
    return {
      kind: 'create',
      accountId,
      calendarId: String(event['calendarId'] || 'primary'),
      eventId: `pending-${now}`,
      title: String(event['title'] || 'New event'),
      description: String(event['description'] || ''),
      startMs,
      endMs,
      ...(repeat ? { repeat, repeatRule, recurring: true } : {}),
      ...(typeof event['project'] === 'string' && event['project'] ? { project: event['project'] } : {}),
      until,
    };
  }
  return null;
}
interface CalendarInfo {
  id: string;
  name: string;
  canWrite: boolean;
  label?: string;
  color?: string;
  synced?: boolean;
}
export interface CalmMainStatus {
  accounts?: { accountId?: string; provider?: string; label?: string; name?: string }[];
  calendars?: Record<string, CalendarInfo[]>;
  events?: unknown[];
  [key: string]: unknown;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const pad = (n: number): string => String(n).padStart(2, '0');
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const MEETING_HOSTS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com', 'whereby.com', 'webex.com', 'gotomeeting.com', 'meet.jit.si', 'chime.aws', 'around.co'];
const CALENDAR_HOSTS = ['calendar.google.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.live.com'];
const DOCUMENT_HOSTS = ['docs.google.com', 'drive.google.com', 'sites.google.com', 'notion.so', 'notion.site', 'dropbox.com', 'github.com', 'gitlab.com', 'bitbucket.org', 'figma.com', 'miro.com', 'docs.microsoft.com', 'wikipedia.org'];

function hostIs(url: URL, names: string[]): boolean {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  return names.some((item) => host === item || host.endsWith('.' + item));
}

function httpsUrls(text: string): string[] {
  const raw = String(text || '');
  const found: string[] = [];
  for (const match of raw.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    try {
      const url = new URL(match[1]);
      if (url.protocol === 'https:') found.push(url.href);
    } catch {
      /* Ignore text that only looks like a URL. */
    }
  }
  for (const match of raw.replace(/<[^>]+>/g, ' ').matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    try {
      const url = new URL(match[0].replace(/[),.;]+$/, ''));
      if (url.protocol === 'https:') found.push(url.href);
    } catch {
      /* Ignore text that only looks like a URL. */
    }
  }
  return found;
}

/** Join link from a calendar description. Calendar pages and document hosts are not calls. */
export function calmMeetingLink(text: string): string {
  const raw = String(text || '');
  const known = httpsUrls(raw).find((url) => hostIs(new URL(url), MEETING_HOSTS));
  if (known) return known;
  const plain = raw.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '\n');
  const rows: { url: string; join: boolean }[] = [];
  for (const line of plain.split('\n')) {
    for (const url of httpsUrls(line)) {
      const parsed = new URL(url);
      if (hostIs(parsed, CALENDAR_HOSTS) || hostIs(parsed, MEETING_HOSTS)) continue;
      rows.push({ url, join: /\b(join|meeting|call|hangout)\b/i.test(line) });
    }
  }
  const joined = rows.find((row) => row.join && !hostIs(new URL(row.url), DOCUMENT_HOSTS));
  if (joined) return joined.url;
  const open = [...new Set(rows.filter((row) => !hostIs(new URL(row.url), DOCUMENT_HOSTS)).map((row) => row.url))];
  return open.length === 1 ? open[0] : '';
}

@Injectable({ providedIn: 'root' })
export class CalmGoogleService {
  private readonly _store = inject(Store);
  private readonly _plugins = inject(PluginService);
  private readonly _bridge = inject(PluginBridgeService);
  private readonly _oauth = inject(PluginOAuthBridgeService);
  private readonly _registry = inject(PluginIssueProviderRegistryService);
  private readonly _calendar = inject(CalendarIntegrationService);
  private _latest: CalmGoogleRawEvent[] = [];
  private _held: HeldCalendarChange[] = [];

  /** SP's polled, cached agenda events for Calm Work's Google slots. */
  readonly events$: Observable<CalmGoogleRawEvent[]> = this._calendar.calendarEvents$.pipe(
    map((entries) => {
      const out: CalmGoogleRawEvent[] = [];
      for (const entry of entries || [])
        for (const item of entry.items || []) {
          const slot = SLOT_OF[item.calProviderId];
          if (!slot) continue;
          const split = String(item.id).indexOf('::');
          const startMs = +item.start;
          const duration = item.isAllDay
            ? Math.max(86400000, item.duration || 0)
            : item.duration || 0;
          const eventId = split > 0 ? String(item.id).slice(split + 2) : String(item.id);
          const googleInstance = /_\d{8}T\d{6}Z$/.test(eventId);
          out.push({
            accountId: slot,
            calendarId: split > 0 ? String(item.id).slice(0, split) : 'primary',
            eventId,
            title: String(item.title || 'Busy'),
            description: String(item.description || ''),
            startMs,
            endMs: startMs + duration,
            allDay: !!item.isAllDay,
            recurring: googleInstance,
            seriesId: googleInstance ? eventId.replace(/_\d{8}T\d{6}Z$/, '') : '',
          });
        }
      this._latest = out;
      return out;
    }),
  );

  latest(): CalmGoogleRawEvent[] {
    const applied = holdCalendarChanges(this._latest, this._held);
    this._held = applied.held;
    return applied.events;
  }

  /** Remember a successful write and refresh in the background. Plan does not wait for the poll. */
  noteWrite(input: Record<string, unknown>): void {
    const change = heldChangeFromCommand(input);
    if (change) this._held.push(change);
    this.refreshEvents();
  }

  refreshEvents(): void {
    this._calendar.triggerRefresh();
  }

  /** Wait (briefly) for SP's next poll result after a write. */
  async waitForNextEvents(ms = 8000): Promise<void> {
    this._calendar.triggerRefresh();
    await firstValueFrom(race(this.events$.pipe(skip(1), take(1)), timer(ms)));
  }

  private async _providers(): Promise<IssueProviderPluginType[]> {
    const all = (await firstValueFrom(
      this._store.select(issueProvidersFeature.selectAll),
    )) as IssueProvider[];
    return all.filter(
      (p): p is IssueProviderPluginType => !!SLOT_OF[p.id] && p.issueProviderKey === GOOGLE_KEY,
    );
  }

  private async _ensurePlugin(): Promise<void> {
    for (let i = 0; i < 150 && !this._plugins.isInitialized(); i++) await sleep(200);
    const state = this._plugins.getAllPluginStates().get(GOOGLE_PLUGIN_ID);
    if (!state) throw new Error('Google Calendar provider is missing from this build.');
    if (!state.isEnabled || state.status !== 'loaded')
      await this._plugins.enableAndActivatePlugin(GOOGLE_PLUGIN_ID);
    for (let i = 0; i < 100 && !this._registry.hasProvider(GOOGLE_KEY); i++) await sleep(100);
    if (!this._registry.hasProvider(GOOGLE_KEY))
      throw new Error('Google Calendar provider did not start.');
  }

  private _oauthConfig(): OAuthFlowConfig {
    const field = (this._registry.getConfigFields(GOOGLE_KEY) || []).find(
      (f) => f.type === 'oauthButton' && f.oauthConfig,
    );
    if (!field?.oauthConfig) throw new Error('Google sign-in is unavailable.');
    return field.oauthConfig;
  }

  /** Sign in with SP's Google client (or Ada's own client from the advanced override). */
  async connect(slot: string, override?: { clientId?: string; clientSecret?: string }): Promise<void> {
    const id = CALM_GOOGLE_SLOTS[slot];
    if (!id) throw new Error('Choose a valid Google account slot.');
    await this._ensurePlugin();
    const existing = (await this._providers()).find((p) => p.id === id);
    const clientId = override?.clientId?.trim() || '';
    const clientSecret = override?.clientSecret?.trim() || '';
    const previous = (existing?.pluginConfig?.['oauthOverrides'] || {}) as Record<string, unknown>;
    const oauthOverrides = clientId
      ? { clientId, clientSecret: clientSecret || (previous['clientId'] === clientId ? previous['clientSecret'] : '') || '' }
      : override
        ? undefined
        : (existing?.pluginConfig?.['oauthOverrides'] as Record<string, unknown> | undefined);
    const pluginConfig: Record<string, unknown> = {
      readCalendarIds: ['primary'],
      writeCalendarId: 'primary',
      ...(existing?.pluginConfig || {}),
      syncRangeWeeks: '9',
      showDeclinedEvents: false,
      // Calm Work writes its own time blocks (per-task calendar picker); SP's auto time-blocking stays off.
      isAutoTimeBlock: false,
    };
    if (oauthOverrides && (oauthOverrides as { clientId?: string }).clientId)
      pluginConfig['oauthOverrides'] = oauthOverrides;
    else delete pluginConfig['oauthOverrides'];
    await this._bridge.startOAuthFlow(
      GOOGLE_PLUGIN_ID,
      applyPluginOAuthOverrides(this._oauthConfig(), pluginConfig, IS_ELECTRON),
      id,
    );
    if (existing)
      this._store.dispatch(
        IssueProviderActions.updateIssueProvider({
          issueProvider: { id, changes: { isEnabled: true, pluginConfig } as Partial<IssueProvider> },
        }),
      );
    else
      this._store.dispatch(
        IssueProviderActions.addIssueProvider({
          issueProvider: {
            ...ISSUE_PROVIDER_DEFAULT_COMMON_CFG,
            // Events show in Plan; they are never imported as tasks.
            isAutoPoll: false,
            isAutoAddToBacklog: false,
            id,
            isEnabled: true,
            issueProviderKey: GOOGLE_KEY,
            pluginId: GOOGLE_PLUGIN_ID,
            pluginConfig,
          } as unknown as IssueProvider,
        }),
      );
    this.refreshEvents();
  }

  async disconnect(slot: string): Promise<void> {
    const id = CALM_GOOGLE_SLOTS[slot];
    if (!id) return;
    await this._bridge.clearOAuthToken(GOOGLE_PLUGIN_ID, id);
    if ((await this._providers()).some((p) => p.id === id))
      this._store.dispatch(
        TaskSharedActions.deleteIssueProvider({ issueProviderId: id, taskIdsToUnlink: [] }),
      );
  }

  /** Fresh access tokens from SP's token store, lent to the main process per command. */
  async tokens(): Promise<{ accountId: string; accessToken: string }[]> {
    const out: { accountId: string; accessToken: string }[] = [];
    for (const provider of await this._providers()) {
      if (!provider.isEnabled) continue;
      let accessToken = '';
      try {
        accessToken = (await this._oauth.getOAuthToken(GOOGLE_PLUGIN_ID, undefined, provider.id)) || '';
      } catch {
        accessToken = '';
      }
      out.push({ accountId: SLOT_OF[provider.id], accessToken });
    }
    return out;
  }

  /** SP's own readCalendarIds setting carries Ada's choice from Settings → Calendars. */
  async syncReadCalendars(status: CalmMainStatus): Promise<void> {
    for (const provider of await this._providers()) {
      const calendars = status.calendars?.[SLOT_OF[provider.id]];
      if (!calendars?.length) continue;
      const ids = calendars.filter((c) => c.synced !== false).map((c) => c.id).sort();
      if (!ids.length) continue;
      const current = [...((provider.pluginConfig?.['readCalendarIds'] as string[]) || [])].sort();
      if (JSON.stringify(ids) === JSON.stringify(current)) continue;
      this._store.dispatch(
        IssueProviderActions.updateIssueProvider({
          issueProvider: {
            id: provider.id,
            changes: { pluginConfig: { ...provider.pluginConfig, readCalendarIds: ids } } as Partial<IssueProvider>,
          },
        }),
      );
    }
  }

  async hasCustomClient(): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const provider of await this._providers())
      out[SLOT_OF[provider.id]] = !!(provider.pluginConfig?.['oauthOverrides'] as { clientId?: string } | undefined)?.clientId;
    return out;
  }

  /** Reshape SP events for the Plan renderer (split per local day, like Microsoft events). */
  toRendererEvents(raw: CalmGoogleRawEvent[], status: CalmMainStatus): unknown[] {
    const events: unknown[] = [];
    for (const item of raw) {
      const account = status.accounts?.find((a) => (a.accountId || a.provider) === item.accountId);
      const calendarId =
        item.calendarId === 'primary' && account?.label ? account.label : item.calendarId;
      const info = status.calendars?.[item.accountId]?.find((c) => c.id === calendarId);
      // SP may still hold the previous poll right after a calendar is turned off.
      if (info?.synced === false) continue;
      const slotName = item.accountId === 'google-2' ? 'Google 2' : 'Google 1';
      const accountName =
        account?.name || (account?.label?.includes('@') ? account.label : slotName);
      const calendarName = info?.name || calendarId;
      const start = new Date(item.startMs),
        finish = new Date(item.endMs);
      if (!Number.isFinite(+start) || !(finish > start)) continue;
      for (let cursor = new Date(start), part = 0; cursor < finish && part < 72; part++) {
        const midnight = new Date(cursor);
        midnight.setHours(24, 0, 0, 0);
        const stop = new Date(Math.min(+midnight, +finish));
        events.push({
          id: `google:${item.accountId}:${calendarId}:${item.eventId}:${part}`,
          title: item.title.slice(0, 500),
          date: localDate(cursor),
          start: localTime(cursor),
          end: +stop === +midnight ? '24:00' : localTime(stop),
          calendar:
            info?.label ||
            (calendarName.toLowerCase() === String(accountName).toLowerCase()
              ? accountName
              : `${accountName} · ${calendarName}`),
          meetingUrl: calmMeetingLink(item.description),
          notes: item.description.replace(/<[^>]*>/g, '').slice(0, 10000),
          owned: false,
          busy: true,
          accountId: item.accountId,
          calendarId,
          eventId: item.eventId,
          editable: !!info?.canWrite && !String(item.eventId).startsWith('pending-'),
          color: info?.color || '',
          recurring: !!item.recurring,
          seriesId: item.seriesId || '',
          ...(part === 0 && item.repeat ? { repeat: item.repeat, repeatRule: item.repeatRule || null } : {}),
          ...(item.project ? { project: item.project } : {}),
          allDay: item.allDay,
          startMs: item.startMs,
          endMs: item.endMs,
        });
        cursor = stop;
      }
    }
    return events;
  }
}
