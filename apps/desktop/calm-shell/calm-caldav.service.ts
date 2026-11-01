import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { firstValueFrom, Observable, race, timer } from 'rxjs';
import { map, skip, take } from 'rxjs/operators';
import { PluginService } from '../../plugins/plugin.service';
import { PluginIssueProviderRegistryService } from '../../plugins/issue-provider/plugin-issue-provider-registry.service';
import { PluginHttpService } from '../../plugins/issue-provider/plugin-http.service';
import { PluginHttp } from '../../plugins/issue-provider/plugin-issue-provider.model';
import { CalendarIntegrationService } from '../calendar-integration/calendar-integration.service';
import { IssueProviderActions } from '../issue/store/issue-provider.actions';
import { issueProvidersFeature } from '../issue/store/issue-provider.reducer';
import { TaskSharedActions } from '../../root-store/meta/task-shared.actions';
import { ISSUE_PROVIDER_DEFAULT_COMMON_CFG } from '../issue/issue.const';
import { IssueProvider, IssueProviderPluginType } from '../issue/issue.model';
import { CalmMainStatus, HeldCalendarChange, calmMeetingLink, holdCalendarChanges } from './calm-google.service';

/**
 * iCloud and other CalDAV calendars through Super Productivity's bundled
 * caldav-calendar-provider. The password stays in that plugin's config.
 */
export const CALDAV_PLUGIN_ID = 'caldav-calendar-provider';
const CALDAV_KEY = 'plugin:caldav-calendar-provider';
const CALDAV_ID = 'calm-caldav-1';
const ACCOUNT_ID = 'caldav';

interface CaldavEvent {
  calendarId: string;
  eventId: string;
  title: string;
  description: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  recurring: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const pad = (n: number): string => String(n).padStart(2, '0');
const localDate = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const hexColor = (value: string): string => {
  const match = String(value || '').trim().match(/^#([0-9a-f]{6})/i);
  return match ? `#${match[1].toLowerCase()}` : '';
};

@Injectable({ providedIn: 'root' })
export class CalmCaldavService {
  private readonly _store = inject(Store);
  private readonly _plugins = inject(PluginService);
  private readonly _registry = inject(PluginIssueProviderRegistryService);
  private readonly _http = inject(PluginHttpService);
  private readonly _calendar = inject(CalendarIntegrationService);
  private _latest: CaldavEvent[] = [];
  private _held: HeldCalendarChange[] = [];
  private _refreshedAt: string | null = null;

  readonly events$: Observable<CaldavEvent[]> = this._calendar.calendarEvents$.pipe(
    map((entries) => {
      const out: CaldavEvent[] = [];
      for (const entry of entries || [])
        for (const item of entry.items || []) {
          if (item.calProviderId !== CALDAV_ID) continue;
          const id = String(item.id);
          const split = id.indexOf('::');
          const startMs = +item.start;
          const duration = item.isAllDay ? Math.max(86400000, item.duration || 0) : item.duration || 0;
          if (!Number.isFinite(startMs) || duration <= 0) continue;
          out.push({
            calendarId: split > 0 ? id.slice(0, split) : id,
            eventId: id,
            title: String(item.title || 'Busy'),
            description: String(item.description || ''),
            startMs,
            endMs: startMs + duration,
            allDay: !!item.isAllDay,
            recurring: id.includes('#occ='),
          });
        }
      this._latest = out;
      this._refreshedAt = new Date().toISOString();
      return out;
    }),
  );

  constructor() {
    this.events$.subscribe();
    this._store.select(issueProvidersFeature.selectAll).subscribe((all) => {
      const found = ((all || []) as IssueProvider[]).find((item) => item.id === CALDAV_ID && item.isEnabled);
      this._cached = (found as IssueProviderPluginType) || null;
    });
  }

  latest(): CaldavEvent[] {
    const applied = holdCalendarChanges(this._latest, this._held);
    this._held = applied.held;
    return applied.events;
  }

  private _hold(change: HeldCalendarChange): void {
    this._held.push(change);
    this.refreshEvents();
  }

  owns(input: Record<string, unknown>): boolean {
    const ref = (input['ref'] || input['event'] || {}) as { accountId?: string };
    return input['provider'] === 'caldav' || input['accountId'] === ACCOUNT_ID || ref.accountId === ACCOUNT_ID;
  }

  refreshEvents(): void {
    this._calendar.triggerRefresh();
  }

  async waitForNextEvents(ms = 8000): Promise<void> {
    this._calendar.triggerRefresh();
    await firstValueFrom(race(this.events$.pipe(skip(1), take(1)), timer(ms)));
  }

  /** Fold this account into the engine status before it reaches Plan. */
  overlay(status: CalmMainStatus): CalmMainStatus {
    const piece = this._piece();
    if (!piece) return status;
    return {
      ...status,
      accounts: [...(status.accounts || []), piece.account] as CalmMainStatus['accounts'],
      calendars: { ...(status.calendars || {}), [ACCOUNT_ID]: piece.calendars },
      events: [...((status.events as unknown[]) || []), ...this._rendererEvents(piece)],
    };
  }

  async apply(input: Record<string, unknown>): Promise<void> {
    const action = String(input['action'] || '');
    if (action === 'connect' || action === 'configure') return this._connect(input);
    if (action === 'disconnect') return this._disconnect();
    if (action === 'refresh') return this.waitForNextEvents();
    if (action === 'calendar-select') return this._setSynced(String(input['calendarId'] || ''), input['enabled'] === true);
    if (action === 'account-name') return this._setName(String(input['name'] || ''));
    if (action === 'calendar-color') return this._setColor(String(input['calendarId'] || ''), String(input['color'] || ''));
    if (action === 'status') return;
    throw new Error('That CalDAV action is not available.');
  }

  async eventGet(ref: { calendarId?: string; eventId?: string }): Promise<Record<string, unknown>> {
    const provider = await this._provider();
    const eventId = String(ref.eventId || '');
    const found = this.latest().find((item) => item.eventId === eventId);
    if (!provider || !found) return { ...ref, accountId: ACCOUNT_ID, removed: true };
    const piece = this._piece();
    const calendar = piece?.calendars.find((item) => item.id === found.calendarId);
    return {
      accountId: ACCOUNT_ID,
      calendarId: found.calendarId,
      eventId: found.eventId,
      title: found.title,
      description: found.description,
      meetingUrl: calmMeetingLink(found.description),
      location: '',
      startMs: found.startMs,
      endMs: found.endMs,
      allDay: found.allDay,
      recurring: found.recurring,
      editable: !!calendar?.canWrite,
      calendar: calendar?.label || calendar?.name || 'CalDAV',
    };
  }

  async eventCreate(event: Record<string, unknown>): Promise<void> {
    const provider = await this._provider();
    if (!provider) throw new Error('Connect iCloud or CalDAV first.');
    const definition = await this._definition();
    const calendarId = String(event['calendarId'] || '');
    const config = { ...(provider.pluginConfig || {}), ...(calendarId ? { writeCalendarId: calendarId } : {}) };
    const http = this._helper(config);
    const title = String(event['title'] || 'New event').slice(0, 500);
    const created = await definition.createIssue(title, config, http);
    const startMs = Number(event['startMs']);
    const endMs = Number(event['endMs']);
    await definition.updateIssue(
      created.issueId,
      {
        summary: title,
        description: String(event['description'] || ''),
        ...(Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
          ? { start_dateTime: new Date(startMs).toISOString(), duration_ms: endMs - startMs }
          : {}),
      },
      config,
      http,
    );
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs)
      this._hold({
        kind: 'create',
        calendarId,
        eventId: `pending-${created.issueId}`,
        title,
        description: String(event['description'] || ''),
        startMs,
        endMs,
        until: Date.now() + 20000,
      });
    else this.refreshEvents();
  }

  async eventUpdate(
    ref: { eventId?: string },
    changes: Record<string, unknown>,
    scope: unknown,
  ): Promise<void> {
    const provider = await this._provider();
    if (!provider) throw new Error('Connect iCloud or CalDAV first.');
    const definition = await this._definition();
    let eventId = String(ref.eventId || '');
    if (eventId.includes('#occ=')) {
      if (scope !== 'series')
        throw new Error(
          'This calendar cannot change one occurrence on its own. Choose all events in the series, or change it in the calendar app.',
        );
      eventId = eventId.replace(/#occ=\d+$/, '');
    }
    const config = provider.pluginConfig || {};
    const next: Record<string, unknown> = {};
    if (typeof changes['title'] === 'string') next['summary'] = changes['title'];
    if (typeof changes['description'] === 'string') next['description'] = changes['description'];
    const startMs = Number(changes['startMs']);
    const endMs = Number(changes['endMs']);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      next['start_dateTime'] = new Date(startMs).toISOString();
      next['duration_ms'] = endMs - startMs;
    }
    if (!Object.keys(next).length) return;
    await definition.updateIssue(eventId, next, config, this._helper(config));
    const start = Number(changes['startMs']);
    const end = Number(changes['endMs']);
    this._hold({
      kind: 'update',
      calendarId: '',
      eventId: String(ref.eventId || eventId),
      ...(typeof changes['title'] === 'string' ? { title: changes['title'] } : {}),
      ...(typeof changes['description'] === 'string' ? { description: changes['description'] } : {}),
      ...(Number.isFinite(start) ? { startMs: start } : {}),
      ...(Number.isFinite(end) ? { endMs: end } : {}),
      until: Date.now() + 20000,
    });
  }

  async eventDelete(ref: { eventId?: string }, scope: unknown): Promise<void> {
    const provider = await this._provider();
    if (!provider) throw new Error('Connect iCloud or CalDAV first.');
    const definition = await this._definition();
    let eventId = String(ref.eventId || '');
    if (eventId.includes('#occ=')) {
      if (scope !== 'series')
        throw new Error(
          'This calendar cannot delete one occurrence on its own. Choose all events in the series, or delete it in the calendar app.',
        );
      eventId = eventId.replace(/#occ=\d+$/, '');
    }
    const config = provider.pluginConfig || {};
    await definition.deleteIssue(eventId, config, this._helper(config));
    this._hold({
      kind: 'delete',
      calendarId: '',
      eventId: String(ref.eventId || eventId),
      until: Date.now() + 20000,
    });
  }

  private async _providers(): Promise<IssueProviderPluginType[]> {
    const all = (await firstValueFrom(this._store.select(issueProvidersFeature.selectAll))) as IssueProvider[];
    return all.filter(
      (p): p is IssueProviderPluginType => p.id === CALDAV_ID && p.issueProviderKey === CALDAV_KEY,
    );
  }

  private async _provider(): Promise<IssueProviderPluginType | undefined> {
    return (await this._providers()).find((item) => item.isEnabled);
  }

  private async _ensurePlugin(): Promise<void> {
    for (let i = 0; i < 150 && !this._plugins.isInitialized(); i++) await sleep(200);
    const state = this._plugins.getAllPluginStates().get(CALDAV_PLUGIN_ID);
    if (!state) throw new Error('CalDAV calendar provider is missing from this build.');
    if (!state.isEnabled || state.status !== 'loaded') await this._plugins.enableAndActivatePlugin(CALDAV_PLUGIN_ID);
    for (let i = 0; i < 100 && !this._registry.hasProvider(CALDAV_KEY); i++) await sleep(100);
    if (!this._registry.hasProvider(CALDAV_KEY)) throw new Error('CalDAV calendar provider did not start.');
  }

  private async _definition(): Promise<{
    getHeaders: (config: Record<string, unknown>) => Record<string, string> | Promise<Record<string, string>>;
    createIssue: (title: string, config: Record<string, unknown>, http: unknown) => Promise<{ issueId: string }>;
    updateIssue: (id: string, changes: Record<string, unknown>, config: Record<string, unknown>, http: unknown) => Promise<void>;
    deleteIssue: (id: string, config: Record<string, unknown>, http: unknown) => Promise<void>;
  }> {
    await this._ensurePlugin();
    const provider = this._registry.getProvider(CALDAV_KEY);
    if (!provider?.definition) throw new Error('CalDAV calendar provider did not start.');
    return provider.definition as never;
  }

  private _helper(config: Record<string, unknown>) {
    const provider = this._registry.getProvider(CALDAV_KEY);
    return this._http.createHttpHelper(
      () => Promise.resolve(provider!.definition.getHeaders(config)),
      { allowPrivateNetwork: true },
    );
  }

  private async _connect(input: Record<string, unknown>): Promise<void> {
    const serverUrl = String(input['serverUrl'] || 'https://caldav.icloud.com').trim();
    const username = String(input['username'] || '').trim();
    const password = String(input['password'] || '');
    const name = String(input['name'] || '').trim().slice(0, 80);
    let parsed: URL;
    try {
      parsed = new URL(serverUrl);
    } catch {
      throw new Error('Enter the CalDAV server address, starting with https://.');
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
      throw new Error('The CalDAV server address must be https, without a password in the URL.');
    if (!username || !password) throw new Error('Enter the email and an app-specific password.');
    await this._ensurePlugin();
    const existing = (await this._providers())[0];
    const previous = existing?.pluginConfig || {};
    const config: Record<string, unknown> = {
      ...previous,
      serverUrl: parsed.href.replace(/\/$/, ''),
      username,
      password,
      syncRangeWeeks: '9',
      isAutoTimeBlock: false,
      ...(name ? { displayName: name } : {}),
    };
    const field = ((this._registry.getConfigFields(CALDAV_KEY) || []) as {
      key?: string;
      loadOptions?: (config: Record<string, unknown>, http: unknown) => Promise<{ label: string; value: string }[]>;
    }[]).find((item) => item.key === 'readCalendarIds');
    if (!field?.loadOptions) throw new Error('CalDAV calendar list is unavailable.');
    const http = this._helper(config);
    let options: { label: string; value: string }[] = [];
    try {
      options = await field.loadOptions(config, http);
    } catch {
      throw new Error('Could not reach that CalDAV server. Check the address, email and app-specific password.');
    }
    if (!options.length) throw new Error('No calendars were found on that account.');
    const names: Record<string, string> = {};
    for (const option of options) names[option.value] = String(option.label || 'Calendar').slice(0, 200);
    const colors = await this._importColors(config, http, options.map((option) => option.value));
    config['readCalendarIds'] = options.map((option) => option.value);
    config['writeCalendarId'] = options[0].value;
    config['calendarNames'] = names;
    config['calendarSourceColors'] = { ...((previous['calendarSourceColors'] as object) || {}), ...colors };
    this._save(existing, config);
    this.refreshEvents();
  }

  private _save(existing: IssueProviderPluginType | undefined, pluginConfig: Record<string, unknown>): void {
    if (existing)
      this._store.dispatch(
        IssueProviderActions.updateIssueProvider({
          issueProvider: { id: CALDAV_ID, changes: { isEnabled: true, pluginConfig } as Partial<IssueProvider> },
        }),
      );
    else
      this._store.dispatch(
        IssueProviderActions.addIssueProvider({
          issueProvider: {
            ...ISSUE_PROVIDER_DEFAULT_COMMON_CFG,
            isAutoPoll: false,
            isAutoAddToBacklog: false,
            id: CALDAV_ID,
            isEnabled: true,
            issueProviderKey: CALDAV_KEY,
            pluginId: CALDAV_PLUGIN_ID,
            pluginConfig,
          } as unknown as IssueProvider,
        }),
      );
  }

  private async _importColors(
    config: Record<string, unknown>,
    http: PluginHttp,
    ids: string[],
  ): Promise<Record<string, string>> {
    const colors: Record<string, string> = {};
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:apple="http://apple.com/ns/ical/"><d:prop><apple:calendar-color/></d:prop></d:propfind>`;
    for (const id of ids.slice(0, 20)) {
      try {
        const xml = await http.request<string>('PROPFIND', id, body, {
          headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
          responseType: 'text',
        });
        const found = hexColor(xml);
        if (found) colors[id] = found;
      } catch {
        // Colour is optional. Settings can set it when the server does not send one.
      }
    }
    return colors;
  }

  private async _disconnect(): Promise<void> {
    if ((await this._providers()).length)
      this._store.dispatch(TaskSharedActions.deleteIssueProvider({ issueProviderId: CALDAV_ID, taskIdsToUnlink: [] }));
    this._latest = [];
  }

  private async _patch(change: (config: Record<string, unknown>) => void): Promise<void> {
    const provider = await this._provider();
    if (!provider) throw new Error('Connect iCloud or CalDAV first.');
    const pluginConfig = { ...(provider.pluginConfig || {}) };
    change(pluginConfig);
    this._save(provider, pluginConfig);
  }

  private async _setName(name: string): Promise<void> {
    const clean = name.trim().slice(0, 80);
    await this._patch((config) => {
      if (clean) config['displayName'] = clean;
      else delete config['displayName'];
    });
  }

  private async _setColor(calendarId: string, color: string): Promise<void> {
    await this._patch((config) => {
      const colors = { ...((config['calendarColors'] as Record<string, string>) || {}) };
      const next = hexColor(color);
      if (next) colors[calendarId] = next;
      else delete colors[calendarId];
      config['calendarColors'] = colors;
    });
  }

  private async _setSynced(calendarId: string, enabled: boolean): Promise<void> {
    await this._patch((config) => {
      const ids = new Set(((config['readCalendarIds'] as string[]) || []).map(String));
      if (enabled) ids.add(calendarId);
      else ids.delete(calendarId);
      config['readCalendarIds'] = [...ids];
    });
    this.refreshEvents();
  }

  /** Last enabled CalDAV provider from the store, so Plan can merge without waiting. */
  private _cached: IssueProviderPluginType | null = null;

  private _piece(): {
    account: Record<string, unknown>;
    calendars: { id: string; name: string; canWrite: boolean; color: string; label: string; synced: boolean }[];
  } | null {
    const provider = this._cached;
    if (!provider?.isEnabled) return null;
    const config = provider.pluginConfig || {};
    const names = (config['calendarNames'] as Record<string, string>) || {};
    const source = (config['calendarSourceColors'] as Record<string, string>) || {};
    const overrides = (config['calendarColors'] as Record<string, string>) || {};
    const read = new Set(((config['readCalendarIds'] as string[]) || []).map(String));
    const ids = [
      ...new Set([...Object.keys(names), ...read, ...this._latest.map((item) => item.calendarId)]),
    ].filter(Boolean);
    const accountName = String(config['displayName'] || config['username'] || 'CalDAV');
    return {
      account: {
        accountId: ACCOUNT_ID,
        provider: 'caldav',
        label: String(config['username'] || ''),
        name: String(config['displayName'] || ''),
        canWrite: true,
        refreshedAt: this._refreshedAt,
        managedBy: 'super-productivity',
        serverUrl: String(config['serverUrl'] || ''),
      },
      calendars: ids.map((id) => {
        const name = String(names[id] || id.split('/').filter(Boolean).pop() || 'Calendar').slice(0, 200);
        const color = hexColor(overrides[id] || '') || hexColor(source[id] || '');
        return {
          id,
          name,
          canWrite: true,
          color,
          label: name.toLowerCase() === accountName.toLowerCase() ? accountName : `${accountName} · ${name}`,
          synced: read.has(id),
        };
      }),
    };
  }

  private _rendererEvents(piece: NonNullable<ReturnType<CalmCaldavService['_piece']>>): unknown[] {
    const events: unknown[] = [];
    for (const item of this.latest()) {
      const calendar = piece.calendars.find((entry) => entry.id === item.calendarId);
      if (calendar && calendar.synced === false) continue;
      const start = new Date(item.startMs);
      const finish = new Date(item.endMs);
      if (!Number.isFinite(+start) || !(finish > start)) continue;
      for (let cursor = new Date(start), part = 0; cursor < finish && part < 8; part++) {
        const midnight = new Date(cursor);
        midnight.setHours(24, 0, 0, 0);
        const stop = new Date(Math.min(+midnight, +finish));
        events.push({
          id: `caldav:${item.eventId}:${part}`,
          title: item.title.slice(0, 500),
          date: localDate(cursor),
          start: item.allDay ? '00:00' : localTime(cursor),
          end: item.allDay ? '24:00' : +stop === +midnight ? '24:00' : localTime(stop),
          calendar: calendar?.label || 'CalDAV',
          meetingUrl: calmMeetingLink(item.description),
          notes: item.description.replace(/<[^>]*>/g, '').slice(0, 10000),
          owned: false,
          busy: true,
          accountId: ACCOUNT_ID,
          calendarId: item.calendarId,
          eventId: item.eventId,
          editable: calendar?.canWrite !== false,
          color: calendar?.color || '',
          recurring: item.recurring,
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
