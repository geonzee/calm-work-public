import { inject, Injectable } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { combineLatest, firstValueFrom, fromEvent, merge, Observable, timer } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  throttleTime,
} from 'rxjs/operators';
import { GlobalConfigService } from '../config/global-config.service';
import { SyncConfig } from '../config/global-config.model';
import { SyncConfigService } from '../../imex/sync/sync-config.service';
import { SyncWrapperService } from '../../imex/sync/sync-wrapper.service';
import { SyncProviderManager } from '../../op-log/sync-providers/provider-manager.service';
import { SuperSyncStatusService } from '../../op-log/sync/super-sync-status.service';
import { SyncProviderId } from '../../op-log/sync-exports';
import { bulkApplyOperations } from '../../op-log/apply/bulk-hydration.action';
import { loadAllData } from '../../root-store/meta/load-all-data.action';
import {
  CalmSyncCredentials,
  encodeCalmSyncCode,
  parseCalmSyncCode,
} from './calm-sync-code';

export interface CalmSyncStatus {
  /** A SuperSync account is saved on this device. */
  configured: boolean;
  /** Sync is switched on. */
  enabled: boolean;
  baseUrl: string;
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncAt: number | null;
  /** Local changes still waiting to leave this device. */
  pending: boolean;
  error: string;
}

type SuperSyncPrivate = {
  baseUrl?: string;
  accessToken?: string;
  encryptKey?: string;
  isEncryptionEnabled?: boolean;
};

/**
 * Calm Work's thin front for Super Productivity's own SuperSync client. Config,
 * encryption, upload, download and conflict handling stay upstream; this only
 * saves the account from a setup code and reports status to the renderer.
 */
@Injectable({ providedIn: 'root' })
export class CalmSyncService {
  private readonly _config = inject(SyncConfigService);
  private readonly _wrapper = inject(SyncWrapperService);
  private readonly _providers = inject(SyncProviderManager);
  private readonly _global = inject(GlobalConfigService);
  private readonly _pending = inject(SuperSyncStatusService);
  private readonly _actions = inject(Actions);

  private _lastSyncAt: number | null = null;
  private _error = '';

  /** Fires after remote operations or a full remote state reached the store. */
  readonly remoteChange$: Observable<void> = this._actions.pipe(
    filter((action) => action.type === bulkApplyOperations.type || action.type === loadAllData.type),
    debounceTime(350),
    map(() => undefined),
  );

  constructor() {
    merge(
      this._providers.syncStatus$.pipe(
        distinctUntilChanged(),
        filter((status) => status === 'IN_SYNC'),
      ),
      this.remoteChange$,
    ).subscribe(() => {
      this._lastSyncAt = Date.now();
      this._error = '';
    });
    // Upstream syncs a web client when it is hidden, not when it returns. A phone that was
    // in the background has missed the websocket, so catch up as soon as it is visible.
    merge(
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible'),
      ),
      fromEvent<PageTransitionEvent>(window, 'pageshow').pipe(filter((event) => event.persisted)),
    )
      .pipe(throttleTime(5000))
      .subscribe(() => void this._syncOnReturn());
  }

  private async _syncOnReturn(): Promise<void> {
    const status = await this.status();
    if (status.enabled && status.state !== 'syncing') await this.syncNow();
  }

  readonly status$: Observable<CalmSyncStatus> = combineLatest([
    this._global.sync$,
    this._providers.currentProviderPrivateCfg$.pipe(startWith(null)),
    this._providers.syncStatus$,
    this._wrapper.isSyncInProgress$.pipe(startWith(false)),
    timer(0, 3000),
  ]).pipe(
    map(([sync, provider, status, busy]) => {
      const saved =
        provider?.providerId === SyncProviderId.SuperSync
          ? (provider.privateCfg as SuperSyncPrivate | null)
          : null;
      const configured = !!(saved?.accessToken && saved?.baseUrl);
      const enabled = !!sync?.isEnabled && sync?.syncProvider === SyncProviderId.SuperSync;
      const syncing = busy || status === 'SYNCING';
      return {
        configured,
        enabled,
        baseUrl: saved?.baseUrl || '',
        state: !enabled
          ? 'off'
          : syncing
            ? 'syncing'
            : status === 'ERROR' || this._error
              ? 'error'
              : 'idle',
        lastSyncAt: this._lastSyncAt,
        pending: enabled && !this._pending.hasNoPendingOps(),
        error: enabled ? this._error : '',
      } as CalmSyncStatus;
    }),
  );

  async status(): Promise<CalmSyncStatus> {
    return firstValueFrom(this.status$);
  }

  async connect(code: unknown): Promise<CalmSyncStatus> {
    const credentials = parseCalmSyncCode(code);
    await this._apply(credentials);
    this._error = '';
    void this.syncNow();
    return this.status();
  }

  async syncNow(): Promise<CalmSyncStatus> {
    if (!(await this.status()).enabled) throw new Error('Sync is not connected.');
    try {
      const result = await this._wrapper.sync(true);
      this._error = result === 'HANDLED_ERROR' ? 'Sync did not finish. Check the connection.' : '';
    } catch (error) {
      this._error = error instanceof Error ? error.message : 'Sync failed.';
    }
    return this.status();
  }

  async disconnect(): Promise<CalmSyncStatus> {
    this._global.updateSection('sync', { isEnabled: false } as SyncConfig);
    this._error = '';
    return this.status();
  }

  /** Rebuilds the setup code from this device's saved account, for a second device. */
  async exportCode(): Promise<string> {
    const provider = await firstValueFrom(this._providers.currentProviderPrivateCfg$);
    const saved =
      provider?.providerId === SyncProviderId.SuperSync
        ? (provider.privateCfg as SuperSyncPrivate | null)
        : null;
    if (!saved?.accessToken || !saved.baseUrl || !saved.encryptKey)
      throw new Error('This device has no complete sync account to share.');
    return encodeCalmSyncCode({
      baseUrl: saved.baseUrl,
      accessToken: saved.accessToken,
      encryptKey: saved.encryptKey,
    });
  }

  private async _apply(credentials: CalmSyncCredentials): Promise<void> {
    const current = this._global.sync();
    await this._config.updateSettingsFromForm(
      {
        ...(current as SyncConfig),
        isEnabled: true,
        syncProvider: SyncProviderId.SuperSync,
        isManualSyncOnly: false,
        isEncryptionEnabled: true,
        encryptKey: credentials.encryptKey,
        superSync: {
          baseUrl: credentials.baseUrl,
          accessToken: credentials.accessToken,
          encryptKey: credentials.encryptKey,
          isEncryptionEnabled: true,
        },
      } as unknown as SyncConfig,
      true,
    );
  }
}
