import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
  viewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IS_ELECTRON } from '../../app.constants';
import { ExecBeforeCloseService } from '../../core/electron/exec-before-close.service';
import { Log } from '../../core/log';
import { DomSanitizer } from '@angular/platform-browser';
import { CalmWorkspaceService } from './calm-workspace.service';
import { CalmRequest, CalmSharedRow, CalmSharedConnection } from './calm-runtime.model';
import { firstValueFrom } from 'rxjs';
import { DataInitStateService } from '../../core/data-init/data-init-state.service';
import { GlobalConfigService } from '../config/global-config.service';
import { CalmGoogleService, CalmMainStatus } from './calm-google.service';
import { CalmCaldavService } from './calm-caldav.service';
import { CalmSyncService } from './calm-sync.service';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

@Component({
  selector: 'calm-shell',
  templateUrl: './calm-shell.component.html',
  styleUrl: './calm-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.height.px]': 'viewportHeight()', '[style.top.px]': 'viewportTop()', '[attr.data-keyboard]': 'keyboardVisible()' },
})
export class CalmShellComponent implements OnInit, OnDestroy {
  private readonly _close = inject(ExecBeforeCloseService);
  private readonly _init = inject(DataInitStateService);
  private readonly _config = inject(GlobalConfigService);
  private readonly _destroy = inject(DestroyRef);
  private _loaded = false;
  private readonly _tray = (
    window as Window & {
      calmTray?: {
        update: (value: unknown) => void;
        onAction: (
          listener: (action: { type: string; id?: string }) => void,
        ) => () => void;
      };
    }
  ).calmTray;
  private _removeTrayListener?: () => void;
  private _closingRequest = '';
  private readonly _reference =
    new URLSearchParams(location.search).get('reference') === '1' ||
    location.hash.includes('reference=1');
  private readonly _workspace = inject(CalmWorkspaceService);
  private readonly _google = inject(CalmGoogleService);
  private readonly _caldav = inject(CalmCaldavService);
  private readonly _sync = inject(CalmSyncService);
  private _lastCalendarStatus: CalmMainStatus | null = null;
  private readonly _sanitizer = inject(DomSanitizer);
  private readonly _frame = viewChild<ElementRef<HTMLIFrameElement>>('renderer');
  readonly error = signal('');
  readonly viewportHeight = signal<number | null>(null);
  readonly viewportTop = signal<number | null>(null);
  readonly keyboardVisible = signal(false);
  private _storageCheck?: Promise<string>;
  readonly rendererUrl = this._sanitizer.bypassSecurityTrustResourceUrl(
    'assets/calm/keyboard-review.html' + (this._reference ? '?reference=1' : ''),
  );
  private _queue: Promise<void> = Promise.resolve();

  private readonly _team = (
    window as Window & {
      calmTeam?: { command(value: unknown): Promise<unknown> };
    }
  ).calmTeam;
  private readonly _teamPending = new Map<
    string,
    {
      connection: CalmSharedConnection | null;
      rows: CalmSharedRow[];
      result: unknown;
      action: string;
      connectionId: string;
    }
  >();
  private _local<T>(work: () => Promise<T>): Promise<T> {
    const result = this._queue.catch(() => undefined).then(work);
    this._queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  /**
   * Calendar commands: Google sign-in/out and tokens go through SP's plugin
   * (CalmGoogleService); everything else runs in the main-process engine, which
   * gets the SP-held Google tokens per command. Results merge SP's Google
   * events with the engine's Microsoft events.
   */
  private async _calendarCommand(raw: unknown): Promise<unknown> {
    const bridge = (
      window as Window & {
        calmCalendar?: { command(value: unknown): Promise<unknown> };
      }
    ).calmCalendar;
    if (!bridge) return { error: 'Calendar bridge unavailable.' };
    const input = { ...((raw || {}) as Record<string, unknown>) };
    if (this._caldav.owns(input)) {
      try {
        const action = String(input['action'] || '');
        const ref = (input['ref'] || {}) as { calendarId?: string; eventId?: string };
        if (action === 'event-get') {
          const event = await this._caldav.eventGet(ref);
          return { ...(await this._mainCalendar(bridge, { action: 'status' }) as object), event };
        }
        if (action === 'event-create') await this._caldav.eventCreate((input['event'] || {}) as Record<string, unknown>);
        else if (action === 'event-update')
          await this._caldav.eventUpdate(ref, (input['changes'] || {}) as Record<string, unknown>, input['scope']);
        else if (action === 'event-delete') await this._caldav.eventDelete(ref, input['scope']);
        else await this._caldav.apply(input);
        return this._mainCalendar(bridge, { action: 'status' });
      } catch (e) {
        return { error: e instanceof Error ? e.message : 'Calendar request failed.' };
      }
    }
    const isGoogleSlot =
      input['provider'] === 'google' &&
      ['google', 'google-2'].includes(String(input['accountId'] || 'google'));
    try {
      if (isGoogleSlot && (input['action'] === 'connect' || input['action'] === 'configure')) {
        const slot = String(input['accountId'] || 'google');
        if (input['action'] === 'configure' && !String(input['clientId'] || '').trim())
          return { ...((await this._mainCalendar(bridge, { action: 'status' })) as object) };
        await this._google.connect(
          slot,
          input['action'] === 'configure' || input['clientId'] !== undefined
            ? {
                clientId: String(input['clientId'] || ''),
                clientSecret: String(input['clientSecret'] || ''),
              }
            : undefined,
        );
        return this._mainCalendar(bridge, { action: 'refresh', provider: 'google', accountId: slot });
      }
      if (isGoogleSlot && input['action'] === 'disconnect') {
        await this._google.disconnect(String(input['accountId'] || 'google'));
      }
      const result = await this._mainCalendar(bridge, input);
      const touched = (input['ref'] || input['event']) as { accountId?: string } | undefined;
      const action = String(input['action'] || '');
      const googleWrite =
        ['event-create', 'event-update', 'event-delete'].includes(action) &&
        String(touched?.accountId || '').startsWith('google') &&
        !(result as { error?: string }).error;
      if (googleWrite && !(result as { conflict?: unknown }).conflict)
        this._google.noteWrite(input as Record<string, unknown>);
      if (googleWrite) {
        const base = (
          Array.isArray((result as CalmMainStatus).accounts)
            ? result
            : this._lastCalendarStatus || { accounts: [], events: [] }
        ) as CalmMainStatus;
        const extra = result as { event?: unknown; conflict?: unknown; saved?: unknown };
        return {
          ...this._merge(base),
          ...(extra.event !== undefined ? { event: extra.event } : {}),
          ...(extra.conflict !== undefined ? { conflict: extra.conflict } : {}),
          ...(extra.saved !== undefined ? { saved: extra.saved } : {}),
        };
      }
      if (
        (isGoogleSlot && input['action'] === 'refresh') ||
        (input['action'] === 'calendar-select' && String(input['accountId'] || '').startsWith('google'))
      )
        this._google.refreshEvents();
      return result;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Calendar request failed.' };
    }
  }

  private async _mainCalendar(
    bridge: { command(value: unknown): Promise<unknown> },
    input: Record<string, unknown>,
  ): Promise<unknown> {
    const result = (await bridge.command({
      ...input,
      google: await this._google.tokens(),
    })) as CalmMainStatus & { error?: string; event?: unknown; conflict?: unknown; saved?: unknown };
    if (result?.error) return result;
    const base = Array.isArray(result?.accounts) ? result : this._lastCalendarStatus || { accounts: [], events: [] };
    if (Array.isArray(result?.accounts)) this._lastCalendarStatus = result;
    await this._google.syncReadCalendars(base).catch(() => undefined);
    const custom = await this._google.hasCustomClient().catch(() => ({}));
    return {
      ...this._merge(base),
      googleCustomClient: custom,
      ...(result.event !== undefined ? { event: result.event } : {}),
      ...(result.conflict !== undefined ? { conflict: result.conflict } : {}),
      ...(result.saved !== undefined ? { saved: result.saved } : {}),
    };
  }

  private _merge(status: CalmMainStatus): CalmMainStatus {
    const google = this._google.toRendererEvents(this._google.latest(), status);
    return this._caldav.overlay({
      ...status,
      events: [...((status.events as unknown[]) || []), ...google],
    });
  }

  private async _runTeam(
    frame: HTMLIFrameElement,
    request: {
      requestId: string;
      input: { action: string; connectionId?: string; [key: string]: unknown };
    },
  ): Promise<void> {
    try {
      const input = request.input;
      let rows: CalmSharedRow[] = [];
      if (input.connectionId)
        rows = await this._local(() => this._workspace.sharedRows(input.connectionId!));
      const result = (await this._team?.command({
        ...input,
        ...(['sync', 'resolve'].includes(input.action) ? { rows } : {}),
      })) as {
        error?: string;
        connections?: CalmSharedConnection[];
        activeConnectionId?: string;
      };
      if (!result || result.error)
        throw new Error(result?.error || 'Shared workspace bridge unavailable.');
      if (['status', 'open'].includes(input.action)) {
        frame.contentWindow?.postMessage(
          {
            channel: 'calm-work-v1',
            requestId: request.requestId,
            team: result,
          },
          '*',
        );
        return;
      }
      const connectionId = input.connectionId || result.activeConnectionId || '';
      const connection =
        result.connections?.find((connection) => connection.id === connectionId) || null;
      if (!input.connectionId && connectionId)
        rows = await this._local(() => this._workspace.sharedRows(connectionId));
      if (this._teamPending.size >= 100)
        this._teamPending.delete(this._teamPending.keys().next().value!);
      this._teamPending.set(request.requestId, {
        connection,
        rows,
        result,
        action: input.action,
        connectionId,
      });
      frame.contentWindow?.postMessage(
        {
          channel: 'calm-work-v1',
          event: 'team-ready',
          requestId: request.requestId,
          team: result,
          connectionId,
        },
        '*',
      );
    } catch (error) {
      frame.contentWindow?.postMessage(
        {
          channel: 'calm-work-v1',
          requestId: request.requestId,
          team: {
            error:
              error instanceof Error
                ? error.message
                : 'Shared workspace operation failed.',
          },
        },
        '*',
      );
    }
  }
  private _post(message: Record<string, unknown>): void {
    this._frame()?.nativeElement.contentWindow?.postMessage(
      { channel: 'calm-work-v1', ...message },
      '*',
    );
  }

  private async _syncCommand(input: { action?: string; code?: unknown }): Promise<unknown> {
    try {
      switch (input.action) {
        case 'connect':
          return { sync: await this._sync.connect(input.code) };
        case 'now':
          return { sync: await this._sync.syncNow() };
        case 'disconnect':
          return { sync: await this._sync.disconnect() };
        case 'export-code':
          return { code: await this._sync.exportCode(), sync: await this._sync.status() };
        default:
          return { sync: await this._sync.status() };
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Sync request failed.',
        sync: await this._sync.status().catch(() => null),
      };
    }
  }

  ngOnInit(): void {
    // Safari resizes only the visual viewport when its keyboard opens.
    // The renderer iframe must shrink with it; dvh alone does not do this.
    const viewport = window.visualViewport;
    const touch = window.matchMedia('(pointer: coarse)');
    const fitViewport = (): void => {
      if (!viewport || !touch.matches) {
        this.viewportHeight.set(null);
        this.viewportTop.set(null);
        return;
      }
      if (viewport.scale !== 1) return;
      this.keyboardVisible.set(viewport.height < document.documentElement.clientHeight * 0.75);
      this.viewportHeight.set(viewport.height);
      this.viewportTop.set(viewport.offsetTop);
    };
    viewport?.addEventListener('resize', fitViewport);
    viewport?.addEventListener('scroll', fitViewport);
    window.addEventListener('pageshow', fitViewport);
    window.addEventListener('resize', fitViewport);
    fitViewport();
    this._destroy.onDestroy(() => {
      viewport?.removeEventListener('resize', fitViewport);
      viewport?.removeEventListener('scroll', fitViewport);
      window.removeEventListener('pageshow', fitViewport);
      window.removeEventListener('resize', fitViewport);
    });
    if (!this._reference) {
      // Sync runs on every platform (desktop and the phone web app).
      this._sync.status$
        .pipe(
          map((status) => JSON.stringify(status)),
          distinctUntilChanged(),
          takeUntilDestroyed(this._destroy),
        )
        .subscribe((status) => this._post({ event: 'sync-status', sync: JSON.parse(status) }));
      // Another device's changes reached the store: tell the renderer to reload when idle.
      this._sync.remoteChange$
        .pipe(takeUntilDestroyed(this._destroy))
        .subscribe(() => {
          if (this._loaded) this._post({ event: 'external-update' });
        });
    }
    if (!IS_ELECTRON || this._reference) return;
    this._removeTrayListener = this._tray?.onAction((action) => {
      this._frame()?.nativeElement.contentWindow?.postMessage(
        { channel: 'calm-work-v1', event: 'tray-action', action },
        '*',
      );
    });
    void firstValueFrom(this._init.isAllDataLoadedInitially$).then(() => {
      if (!this._destroy.destroyed && !this._config.misc()?.isMinimizeToTray)
        this._config.updateSection('misc', { isMinimizeToTray: true }, true);
    });
    this._close.schedule('CALM_WORK_LOCAL_SAVE');
    // SP's Google provider polls on its own; push each new result into Plan.
    this._google.events$
      .pipe(debounceTime(300), takeUntilDestroyed(this._destroy))
      .subscribe(() => {
        if (!this._lastCalendarStatus) return;
        void this._calendarCommand({ action: 'status' })
          .then((calendar) =>
            this._frame()?.nativeElement.contentWindow?.postMessage(
              { channel: 'calm-work-v1', event: 'calendar-update', calendar },
              '*',
            ),
          )
          .catch(() => undefined);
      });
    this._close.onBeforeClose$
      .pipe(takeUntilDestroyed(this._destroy))
      .subscribe((ids) => {
        if (!ids.includes('CALM_WORK_LOCAL_SAVE')) return;
        if (!this._loaded) {
          this._close.setDone('CALM_WORK_LOCAL_SAVE');
          return;
        }
        this._closingRequest = crypto.randomUUID();
        this._frame()?.nativeElement.contentWindow?.postMessage(
          {
            channel: 'calm-work-v1',
            event: 'prepare-close',
            requestId: this._closingRequest,
          },
          '*',
        );
      });
  }
  ngOnDestroy(): void {
    this._removeTrayListener?.();
    if (IS_ELECTRON) this._close.unschedule('CALM_WORK_LOCAL_SAVE');
  }

  @HostListener('window:message', ['$event'])
  onMessage(event: MessageEvent<unknown>): void {
    const frame = this._frame()?.nativeElement;
    if (!frame || event.source !== frame.contentWindow) return;
    const allowedOrigin =
      location.protocol === 'file:' ? ['null', 'file://'] : [location.origin];
    if (!allowedOrigin.includes(event.origin)) return;
    const envelope = event.data as {
      channel?: string;
      event?: string;
      state?: unknown;
    } | null;
    if (
      IS_ELECTRON &&
      !this._reference &&
      envelope?.channel === 'calm-work-v1' &&
      envelope?.event === 'tray-state'
    ) {
      this._tray?.update(envelope.state);
      return;
    }
    const calendarRequest = event.data as {
      command?: string;
      requestId?: string;
      input?: unknown;
    };
    if (
      IS_ELECTRON &&
      !this._reference &&
      envelope?.channel === 'calm-work-v1' &&
      calendarRequest.command === 'calendar' &&
      typeof calendarRequest.requestId === 'string'
    ) {
      void this._calendarCommand(calendarRequest.input)
        .then((result) =>
          frame.contentWindow?.postMessage(
            {
              channel: 'calm-work-v1',
              requestId: calendarRequest.requestId,
              calendar: result,
            },
            '*',
          ),
        )
        .catch(() =>
          frame.contentWindow?.postMessage(
            {
              channel: 'calm-work-v1',
              requestId: calendarRequest.requestId,
              calendar: { error: 'Calendar request failed.' },
            },
            '*',
          ),
        );
      return;
    }
    const teamRequest = event.data as {
      command?: string;
      requestId?: string;
      input?: { action: string; connectionId?: string; [key: string]: unknown };
    };
    if (
      IS_ELECTRON &&
      !this._reference &&
      envelope?.channel === 'calm-work-v1' &&
      typeof teamRequest.requestId === 'string'
    ) {
      if (
        teamRequest.command === 'team' &&
        teamRequest.input &&
        typeof teamRequest.input.action === 'string'
      ) {
        void this._runTeam(frame, {
          requestId: teamRequest.requestId,
          input: teamRequest.input,
        });
        return;
      }
      if (teamRequest.command === 'team-apply') {
        const pending = this._teamPending.get(teamRequest.requestId);
        if (!pending) return;
        this._teamPending.delete(teamRequest.requestId);
        void this._local(async () => {
          try {
            const document =
              pending.action === 'disconnect'
                ? await this._workspace.detachShared(pending.connectionId)
                : pending.connection
                  ? await this._workspace.applyShared(pending.connection, pending.rows)
                  : await this._workspace.load();
            if (
              pending.connection &&
              !pending.connection.error &&
              pending.action !== 'disconnect'
            )
              await this._team?.command({
                action: 'ack',
                connectionId: pending.connectionId,
                rows: await this._workspace.sharedRows(pending.connectionId),
              });
            frame.contentWindow?.postMessage(
              {
                channel: 'calm-work-v1',
                requestId: teamRequest.requestId,
                event: 'team-applied',
                team: pending.result,
                document,
              },
              '*',
            );
          } catch (error) {
            frame.contentWindow?.postMessage(
              {
                channel: 'calm-work-v1',
                requestId: teamRequest.requestId,
                event: 'team-applied',
                team: {
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Shared changes could not be applied.',
                },
              },
              '*',
            );
          }
        });
        return;
      }
    }
    const syncRequest = event.data as {
      command?: string;
      requestId?: string;
      input?: { action?: string; code?: unknown };
    } | null;
    if (
      !this._reference &&
      envelope?.channel === 'calm-work-v1' &&
      syncRequest?.command === 'sync' &&
      typeof syncRequest.requestId === 'string'
    ) {
      const requestId = syncRequest.requestId;
      void this._syncCommand(syncRequest.input || {}).then((result) =>
        this._post({ requestId, ...(result as object) }),
      );
      return;
    }
    const data = event.data as Partial<CalmRequest> | null;
    if (
      !data ||
      data.channel !== 'calm-work-v1' ||
      typeof data.requestId !== 'string' ||
      !['load', 'save', 'seed', 'restore', 'refresh', 'backfill', 'backfill-undo'].includes(
        data.command || '',
      )
    )
      return;
    this._queue = this._queue
      .catch(() => undefined)
      .then(async () => {
        try {
          if (data.command === 'backfill' || data.command === 'backfill-undo') {
            const result =
              data.command === 'backfill'
                ? await this._workspace.backfillEstimates(data.apply === true, data.scope)
                : { reverted: await this._workspace.undoEstimateBackfill(data.scope) };
            frame.contentWindow?.postMessage(
              { channel: 'calm-work-v1', requestId: data.requestId, backfill: result },
              '*',
            );
            return;
          }
          const document =
            data.command === 'load'
              ? await this._workspace.load(true)
              : data.command === 'refresh'
                ? await this._workspace.load(false)
                : data.command === 'restore'
                ? await this._workspace.restore(data.archive)
                : await this._workspace.save(data.document, data.command === 'seed');
          frame.contentWindow?.postMessage(
            { channel: 'calm-work-v1', requestId: data.requestId, document },
            '*',
          );
          if (data.command === 'load' && !IS_ELECTRON) {
            this._storageCheck ||= (async () => {
              try {
                if (!navigator.storage?.persisted || !navigator.storage?.persist) return 'unavailable';
                return (await navigator.storage.persisted()) || (await navigator.storage.persist())
                  ? 'persistent' : 'best-effort';
              } catch { return 'unavailable'; }
            })();
            void this._storageCheck.then((storage) => this._post({ event: 'storage-status', storage }));
          }
          this._loaded = true;
          this.error.set('');
          if (IS_ELECTRON && data.requestId === this._closingRequest)
            this._close.setDone('CALM_WORK_LOCAL_SAVE');
        } catch (error) {
          Log.err(
            'Calm workspace bridge failed',
            error instanceof Error ? error.name : 'Unknown error',
          );
          this.error.set(
            'A local change could not be saved. Your draft remains available; retry after checking local storage.',
          );
          frame.contentWindow?.postMessage(
            {
              channel: 'calm-work-v1',
              requestId: data.requestId,
              error: true,
              reason:
                data.command === 'restore' && error instanceof Error
                  ? error.message
                  : undefined,
            },
            '*',
          );
        }
      });
  }
}
