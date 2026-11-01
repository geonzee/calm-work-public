import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { join } from "node:path";

type Provider = "google" | "microsoft";
interface Credential {
  provider: Provider;
  label?: string;
  clientId: string;
  clientSecret?: string;
  tenant?: string;
  /** Scopes the provider actually granted; older grants without it are read-only. */
  scope?: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  /** Google accounts signed in through SP's google-calendar-provider: token lent per command, never persisted. */
  external?: boolean;
}
/** A Google account whose OAuth, token storage and refresh live in SP's plugin bridge. */
interface ExternalAccount {
  accountId: string;
  accessToken: string;
}
interface CalendarInfo {
  id: string;
  name: string;
  canWrite: boolean;
  color?: string;
  /** Ada's choice in Settings → Calendars; the Calm Work calendar is always synced. */
  synced?: boolean;
  calm?: boolean;
}
/** Outlook's named calendar colours (Graph `color` when `hexColor` is empty). */
const GRAPH_COLORS: Record<string, string> = {
  lightBlue: "#5b9bd5", lightGreen: "#70ad47", lightOrange: "#ed7d31", lightGray: "#a5a5a5",
  lightYellow: "#ffc000", lightTeal: "#4bacc6", lightPink: "#e86fa8", lightBrown: "#a5795a",
  lightRed: "#e05c5c", maxColor: "#7f7f7f", auto: "#4f6bed",
};
interface EventRef {
  accountId: string;
  calendarId: string;
  eventId: string;
}
/** What the user saw and edits: compared with the provider before every write. */
interface RecurrenceRule {
  freq: string;
  interval?: number;
  byDay?: number[];
  weekOfMonth?: number;
}
interface EventView {
  title: string;
  description: string;
  location: string;
  startMs: number;
  endMs: number;
  allDay: boolean;
  recurrence?: RecurrenceRule;
}
interface Registration {
  clientId: string;
  clientSecret?: string;
  tenant?: string;
}
interface WritableCalendar {
  id: string;
  name: string;
  primary?: boolean;
}
/** A planned task block the renderer wants on a calendar. */
interface MirrorBlock {
  taskId: string;
  title: string;
  date: string;
  start: string;
  minutes: number;
  /** "" = default calendar, "none" = keep local, otherwise `${accountId}|${calendarId}`. */
  target: string;
}
interface Projection {
  title: string;
  startMs: number;
  endMs: number;
}
interface MirrorRecord {
  taskId: string;
  accountId: string;
  calendarId: string;
  eventId: string;
  key: string;
  projection: Projection;
  state: "synced" | "conflict";
  conflict?: Projection & { removed?: boolean };
  overwrite?: boolean;
}
interface OutboxEntry {
  taskId: string;
  attempts: number;
  nextAt: number;
  lastError?: string;
}
interface MirrorState {
  enabled: boolean;
  defaultTarget: string;
  desired: Record<string, MirrorBlock>;
  records: Record<string, MirrorRecord>;
  outbox: Record<string, OutboxEntry>;
  generations: Record<string, number>;
  calmCalendars: Record<string, string>;
  errors: Record<string, string>;
}
interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  calendar: string;
  meetingUrl: string;
  notes: string;
  owned: false;
  busy: boolean;
  accountId?: string;
  calendarId?: string;
  eventId?: string;
  location?: string;
  editable?: boolean;
  startMs?: number;
  endMs?: number;
  allDay?: boolean;
  color?: string;
  recurring?: boolean;
  seriesId?: string;
}
interface Dependencies {
  directory: string;
  vault: {
    available(): boolean;
    encrypt(value: string): Buffer;
    decrypt(value: Buffer): string;
  };
  openExternal(url: string): Promise<unknown>;
  fetch?: typeof fetch;
  timeoutMs?: number;
}
/** Example directory shown until someone saves their own tenant. Contoso is Microsoft's documentation name. */
export const DEFAULT_MICROSOFT_TENANT = "contoso.onmicrosoft.com";
/** Preferred Google account for time blocks. Empty means no preferred account. */
export const DEFAULT_MIRROR_ACCOUNT = "";
export const CALM_CALENDAR_NAME = "Calm Work";
const GRAPH_KEY_PROPERTY =
  "String {9d5f6c2e-3b8a-4f7e-9c1d-6a2b4e8f0c31} Name calmWorkKey";
/** SP's verified Google scopes; Calm Work asks for nothing more. */
const GOOGLE_WRITE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_SP_SCOPES = [GOOGLE_WRITE, "https://www.googleapis.com/auth/calendar.calendarlist.readonly"];
const MICROSOFT_WRITE = "https://graph.microsoft.com/Calendars.ReadWrite";
const tenantOf = (value: unknown): string => {
  const tenant = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_MICROSOFT_TENANT;
  if (!/^[A-Za-z0-9.-]{3,100}$/.test(tenant))
    throw new Error("Enter a valid Microsoft tenant ID or domain.");
  return tenant;
};
const providers = {
  google: {
    authorize: (_tenant?: string) => "https://accounts.google.com/o/oauth2/v2/auth",
    token: (_tenant?: string) => "https://oauth2.googleapis.com/token",
    // Sign-in is SP's google-calendar-provider (its public desktop client + PKCE).
    scope: GOOGLE_SP_SCOPES.join(" "),
  },
  microsoft: {
    // Single-tenant registrations reject the shared "organizations" endpoint.
    authorize: (tenant?: string) =>
      `https://login.microsoftonline.com/${tenantOf(tenant)}/oauth2/v2.0/authorize`,
    token: (tenant?: string) =>
      `https://login.microsoftonline.com/${tenantOf(tenant)}/oauth2/v2.0/token`,
    scope: `offline_access ${MICROSOFT_WRITE}`,
  },
};
const emptyMirror = (): MirrorState => ({
  enabled: true,
  defaultTarget: "",
  desired: {},
  records: {},
  outbox: {},
  generations: {},
  calmCalendars: {},
  errors: {},
});
class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
  get transient(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}
const sameProjection = (a: Projection, b: Projection): boolean =>
  a.title === b.title && a.startMs === b.startMs && a.endMs === b.endMs;
const providerOf = (value: unknown): Provider => {
  if (value !== "google" && value !== "microsoft")
    throw new Error("Unknown calendar provider.");
  return value;
};
const safeUrl = (value: unknown): string => {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};
const meetingHost = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
};
const hostIs = (url: string, names: string[]): boolean => {
  const host = meetingHost(url);
  return names.some((item) => host === item || host.endsWith("." + item));
};
const MEETING_HOSTS = ["meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "whereby.com", "webex.com", "gotomeeting.com", "meet.jit.si", "chime.aws", "around.co"];
const CALENDAR_HOSTS = ["calendar.google.com", "outlook.office.com", "outlook.office365.com", "outlook.live.com"];
const DOCUMENT_HOSTS = ["docs.google.com", "drive.google.com", "sites.google.com", "notion.so", "notion.site", "dropbox.com", "github.com", "gitlab.com", "bitbucket.org", "figma.com", "miro.com", "docs.microsoft.com", "wikipedia.org"];
function urlsIn(raw: string): string[] {
  const found: string[] = [];
  for (const match of raw.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const url = safeUrl(match[1]);
    if (url) found.push(url);
  }
  for (const match of raw.replace(/<[^>]+>/g, " ").matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = safeUrl(match[0].replace(/[),.;]+$/, ""));
    if (url) found.push(url);
  }
  return found;
}
function guessPrivateMeetingUrl(text: string): string {
  const plain = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "\n");
  const rows: { url: string; join: boolean }[] = [];
  for (const line of plain.split("\n")) {
    for (const url of urlsIn(line)) {
      if (hostIs(url, CALENDAR_HOSTS) || hostIs(url, MEETING_HOSTS)) continue;
      rows.push({ url, join: /\b(join|meeting|call|hangout)\b/i.test(line) });
    }
  }
  const joined = rows.find((row) => row.join && !hostIs(row.url, DOCUMENT_HOSTS));
  if (joined) return joined.url;
  const open = [...new Set(rows.filter((row) => !hostIs(row.url, DOCUMENT_HOSTS)).map((row) => row.url))];
  return open.length === 1 ? open[0] : "";
}
function meetingUrlFrom(explicit: unknown[], text: unknown[], whole: unknown[] = []): string {
  for (const value of explicit) {
    const url = safeUrl(value);
    if (url && !hostIs(url, CALENDAR_HOSTS)) return url;
  }
  const blob = text.map((item) => String(item || "")).join("\n");
  const known = urlsIn(blob).find((url) => hostIs(url, MEETING_HOSTS));
  if (known) return known;
  const guessed = guessPrivateMeetingUrl(blob);
  if (guessed) return guessed;
  for (const value of whole) {
    const url = safeUrl(String(value || "").trim());
    if (url && !hostIs(url, CALENDAR_HOSTS) && !hostIs(url, DOCUMENT_HOSTS)) return url;
  }
  return "";
}
function eventMeetingUrl(entry: any): string {
  const points = Array.isArray(entry?.conferenceData?.entryPoints) ? entry.conferenceData.entryPoints : [];
  const video = points.find((point: any) => point?.entryPointType === "video" && point?.uri) || points.find((point: any) => point?.uri);
  const location = typeof entry?.location === "string" ? entry.location : entry?.location?.displayName;
  return meetingUrlFrom(
    [entry?.hangoutLink, video?.uri, entry?.onlineMeeting?.joinUrl],
    [entry?.description, entry?.body?.content],
    [location],
  );
}
const localDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

/** Main-process only. Tokens never cross IPC, enter task exports, or use personal sync. */
export class CalmCalendar {
  private credentials: Record<string, Credential> = {};
  private registrations: Partial<Record<Provider, Registration>> = {};
  private cache: Partial<
    Record<
      string,
      {
        events: CalendarEvent[];
        refreshedAt: string;
        writable?: WritableCalendar[];
        calendars?: CalendarInfo[];
        label?: string;
      }
    >
  > = {};
  private mirror: MirrorState = emptyMirror();
  /** Per account: calendars seen so far, the ones Ada chose to sync, a display name and colour overrides. */
  private selection: Record<string, { known: string[]; synced: string[]; name?: string; colors?: Record<string, string> }> = {};
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private serviceOrigin = "";
  private loaded = false;
  private pending: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly fetcher: typeof fetch;
  constructor(private readonly deps: Dependencies) {
    this.fetcher = deps.fetch || fetch;
  }
  private async load(): Promise<void> {
    if (this.loaded) return;
    if (!this.deps.vault.available())
      throw new Error(
        "Unlock the operating-system credential store before connecting calendars.",
      );
    try {
      const bytes = await readFile(join(this.deps.directory, "calendar-vault"));
      const data = JSON.parse(this.deps.vault.decrypt(bytes));
      // Google now signs in through SP's plugin; retired custom Google grants are dropped.
      this.credentials = Object.fromEntries(
        Object.entries((data.credentials || {}) as Record<string, Credential>).filter(
          ([, credential]) => credential.provider === "microsoft",
        ),
      );
      this.registrations = data.registrations || {};
      for (const credential of Object.values(this.credentials))
        this.registrations[credential.provider] ||= {
          clientId: credential.clientId,
          ...(credential.clientSecret
            ? { clientSecret: credential.clientSecret }
            : {}),
        };
      this.cache = data.cache || {};
      this.mirror = { ...emptyMirror(), ...(data.mirror || {}) };
      this.selection = data.selection || {};
      this.serviceOrigin = data.serviceOrigin || "";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("Calendar credential store could not be opened.");
    }
    this.loaded = true;
  }
  private async persist(): Promise<void> {
    if (!this.deps.vault.available())
      throw new Error("Operating-system credential storage is unavailable.");
    await mkdir(this.deps.directory, { recursive: true, mode: 0o700 });
    const file = join(this.deps.directory, "calendar-vault");
    await writeFile(
      file + ".tmp",
      this.deps.vault.encrypt(
        JSON.stringify({
          credentials: Object.fromEntries(
            Object.entries(this.credentials).filter(([, credential]) => !credential.external),
          ),
          registrations: this.registrations,
          cache: this.cache,
          mirror: this.mirror,
          selection: this.selection,
          serviceOrigin: this.serviceOrigin,
        }),
      ),
      { mode: 0o600 },
    );
    await rename(file + ".tmp", file);
  }
  cancel(): void {
    this.pending?.();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
  async command(input: {
    action?: string;
    provider?: unknown;
    accountId?: unknown;
    clientId?: unknown;
    clientSecret?: unknown;
    tenant?: unknown;
    origin?: unknown;
    blocks?: unknown;
    taskId?: unknown;
    choice?: unknown;
    target?: unknown;
    enabled?: unknown;
    google?: unknown;
    ref?: unknown;
    base?: unknown;
    changes?: unknown;
    scope?: unknown;
    event?: unknown;
    calendarId?: unknown;
    name?: unknown;
    color?: unknown;
  }): Promise<unknown> {
    if (input.action === "cancel") {
      this.cancel();
      return this.status();
    }
    // One writer avoids refresh/disconnect races and refresh-token rotation loss.
    const work = this.queue
      .catch(() => undefined)
      .then(async () => {
        await this.load();
        if (Array.isArray(input.google)) {
          this.syncExternal(input.google);
          await this.refreshExternal();
        }
        if (input.action === "status") return this.status();
        if (input.action === "calendar-select") {
          const accountId = String(input.accountId || ""),
            calendarId = String(input.calendarId || "");
          const info = this.cache[accountId]?.calendars?.find((c) => c.id === calendarId);
          if (!this.credentials[accountId] || !info) throw new Error("Unknown calendar.");
          if (info.calm) throw new Error("The Calm Work calendar is always synced.");
          const selection = (this.selection[accountId] ||= { known: [], synced: [] });
          selection.synced = selection.synced.filter((id) => id !== calendarId);
          if (input.enabled === true) selection.synced.push(calendarId);
          info.synced = input.enabled === true;
          if (this.credentials[accountId].provider === "microsoft" && info.synced)
            await this.refresh(accountId);
          await this.persist();
          return this.status();
        }
        if (input.action === "account-name") {
          const accountId = String(input.accountId || "");
          if (!this.credentials[accountId]) throw new Error("That calendar account is not connected.");
          const selection = (this.selection[accountId] ||= { known: [], synced: [] });
          const name = String(input.name || "").trim().slice(0, 80);
          if (name) selection.name = name;
          else delete selection.name;
          await this.persist();
          return this.status();
        }
        if (input.action === "calendar-color") {
          const accountId = String(input.accountId || ""),
            calendarId = String(input.calendarId || ""),
            color = String(input.color || "");
          const info = this.cache[accountId]?.calendars?.find((c) => c.id === calendarId);
          if (!this.credentials[accountId] || !info) throw new Error("Unknown calendar.");
          const selection = (this.selection[accountId] ||= { known: [], synced: [] });
          selection.colors ||= {};
          if (/^#[0-9a-f]{6}$/i.test(color)) selection.colors[calendarId] = color.toLowerCase();
          else delete selection.colors[calendarId];
          await this.persist();
          return this.status();
        }
        if (input.action === "event-get") return { event: await this.eventGet(input.ref) };
        if (input.action === "event-create")
          return { ...(await this.eventCreate(input.event)), ...(this.status() as object) };
        if (input.action === "event-update")
          return {
            ...(await this.eventUpdate(input.ref, input.base, input.changes, input.scope)),
            ...(this.status() as object),
          };
        if (input.action === "event-delete")
          return {
            ...(await this.eventDelete(input.ref, input.base, input.scope)),
            ...(this.status() as object),
          };
        if (input.action === "mirror-sync") {
          this.setDesired(input.blocks);
          // Retry blocks that failed permanently (e.g. Calm Work calendar created since).
          for (const taskId of Object.keys(this.mirror.errors))
            if (this.mirror.desired[taskId]) this.enqueue(taskId);
          await this.persist();
          await this.processOutbox();
          return this.status();
        }
        if (input.action === "mirror-settings") {
          if (typeof input.enabled === "boolean") this.mirror.enabled = input.enabled;
          if (typeof input.target === "string") {
            if (input.target && !this.targetLabel(input.target))
              throw new Error("Choose a calendar you can write to.");
            this.mirror.defaultTarget = input.target;
          }
          for (const taskId of Object.keys(this.mirror.desired)) this.enqueue(taskId);
          await this.persist();
          await this.processOutbox();
          return this.status();
        }
        if (input.action === "mirror-resolve") {
          const taskId = typeof input.taskId === "string" ? input.taskId : "";
          const record = this.mirror.records[taskId];
          if (!record || record.state !== "conflict" || !record.conflict)
            throw new Error("This time block has no calendar change to resolve.");
          let adopted: unknown = null;
          if (input.choice === "plan") {
            record.overwrite = true;
            this.enqueue(taskId, true);
          } else if (input.choice === "calendar") {
            if (record.conflict.removed) delete this.mirror.records[taskId];
            else {
              record.projection = {
                title: record.conflict.title,
                startMs: record.conflict.startMs,
                endMs: record.conflict.endMs,
              };
              record.state = "synced";
            }
            adopted = this.adoptedPlan(record);
            delete record.conflict;
          } else throw new Error("Choose which version to keep.");
          await this.persist();
          await this.processOutbox();
          return { ...(this.status() as object), adopted };
        }
        if (input.action === "open-service") {
          const url = new URL(
            typeof input.origin === "string"
              ? input.origin
              : this.serviceOrigin,
          );
          if (
            url.username ||
            url.password ||
            url.pathname !== "/" ||
            url.search ||
            url.hash ||
            (url.protocol !== "https:" &&
              !(
                url.protocol === "http:" &&
                ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
              ))
          )
            throw new Error(
              "Use an HTTPS service origin, or HTTP loopback for a local service.",
            );
          this.serviceOrigin = url.origin;
          await this.persist();
          await this.deps.openExternal(url.origin);
          return this.status();
        }
        const provider = providerOf(input.provider);
        const accountId =
          typeof input.accountId === "string" ? input.accountId : provider;
        if (
          !(
            provider === "google" ? ["google", "google-2"] : ["microsoft"]
          ).includes(accountId)
        )
          throw new Error("Choose a valid calendar account slot.");
        if (provider === "google" && ["connect", "configure"].includes(String(input.action)))
          throw new Error(
            "Google sign-in is handled by Super Productivity's Google Calendar provider.",
          );
        if (input.action === "connect" || input.action === "configure") {
          const registration: Registration | undefined =
            typeof input.clientId === "string"
              ? {
                  clientId: input.clientId.trim(),
                  clientSecret:
                    typeof input.clientSecret === "string" && input.clientSecret
                      ? input.clientSecret
                      : input.clientId ===
                          this.registrations[provider]?.clientId
                        ? this.registrations[provider]?.clientSecret
                        : "",
                  ...(provider === "microsoft"
                    ? {
                        tenant: tenantOf(
                          input.tenant ?? this.registrations.microsoft?.tenant,
                        ),
                      }
                    : {}),
                }
              : this.registrations[provider];
          if (
            !registration ||
            !/^[A-Za-z0-9._-]{8,300}$/.test(registration.clientId)
          )
            throw new Error(
              "Enter a valid desktop client ID in Calendar setup first.",
            );
          this.registrations[provider] = registration;
          await this.persist();
          if (input.action === "connect")
            await this.connect(
              provider,
              registration.clientId,
              registration.clientSecret || "",
              accountId,
              registration.tenant,
            );
        } else if (input.action === "refresh") {
          // Google events stay on Super Productivity's poll. refresh() for
          // Google only updates the calendar list, so a calendar added later
          // appears in Settings.
          await this.refresh(accountId);
          await this.processOutbox();
        } else if (input.action === "disconnect") {
          delete this.credentials[accountId];
          delete this.cache[accountId];
          // Calendar events stay in the provider; Calm Work just stops managing them.
          for (const [taskId, record] of Object.entries(this.mirror.records))
            if (record.accountId === accountId) delete this.mirror.records[taskId];
          delete this.mirror.calmCalendars[accountId];
          await this.persist();
        } else throw new Error("Unknown calendar action.");
        return this.status();
      });
    this.queue = work;
    return work;
  }
  private status(): unknown {
    return {
      serviceOrigin: this.serviceOrigin,
      registrations: Object.fromEntries(
        Object.entries(this.registrations).map(([provider, value]) => [
          provider,
          {
            clientId: value!.clientId,
            ...(provider === "microsoft"
              ? { tenant: value!.tenant || DEFAULT_MICROSOFT_TENANT }
              : {}),
          },
        ]),
      ),
      accounts: Object.entries(this.credentials).map(([accountId, c]) => ({
        accountId,
        provider: c.provider,
        label: c.label || "",
        name: this.selection[accountId]?.name || "",
        clientId: c!.clientId,
        canWrite: this.canWrite(accountId),
        refreshedAt: this.cache[accountId]?.refreshedAt || null,
        managedBy: c.external ? "super-productivity" : "calm-work",
      })),
      calendars: Object.fromEntries(
        Object.keys(this.credentials).map((accountId) => [
          accountId,
          (this.cache[accountId]?.calendars || []).map((calendar) => ({
            ...calendar,
            color: this.calendarColor(accountId, calendar),
            label: this.calendarLabel(accountId, calendar.name),
          })),
        ]),
      ),
      events: Object.entries(this.cache).flatMap(([accountId, value]) =>
        this.credentials[accountId]?.external
          ? []
          : (value?.events || [])
          .filter(
            (event) =>
              !event.calendarId ||
              !value.calendars ||
              value.calendars.some((c) => c.id === event.calendarId && c.synced !== false),
          )
          .map((event) => {
            const info = value.calendars?.find((c) => c.id === event.calendarId);
            return info
              ? {
                  ...event,
                  color: this.calendarColor(event.accountId, info),
                  calendar: this.calendarLabel(event.accountId, info.name),
                }
              : event;
          }),
      ),
      mirror: this.mirrorStatus(),
    };
  }
  private async token(
    provider: Provider,
    body: URLSearchParams,
    tenant?: string,
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(providers[provider].token(tenant), {
        method: "POST",
        body,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        "Calendar authorization network request failed. Try again.",
      );
    }
    if (!response.ok)
      throw new Error(
        response.status === 400
          ? "Calendar authorization expired or was rejected. Reconnect this account."
          : "Calendar authorization service is unavailable.",
      );
    const data = (await response.json()) as Record<string, unknown>;
    if (
      typeof data.access_token !== "string" ||
      typeof data.expires_in !== "number" ||
      data.expires_in <= 0
    )
      throw new Error("Invalid calendar authorization response.");
    return data;
  }
  private async connect(
    provider: Provider,
    clientId: string,
    clientSecret: string,
    accountId = provider as string,
    tenant?: string,
  ): Promise<void> {
    const verifier = randomBytes(32).toString("base64url"),
      state = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const server = createServer();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectCallback: (reason: Error) => void = () => {};
    const codePromise = new Promise<string>((resolve, reject) => {
      rejectCallback = reject;
      server.on("request", (request, response) => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Content-Security-Policy", "default-src 'none'");
        if (request.method !== "GET" || url.pathname !== "/oauth/callback") {
          response.writeHead(404).end();
          return;
        }
        const actual = Buffer.from(url.searchParams.get("state") || "");
        if (
          url.searchParams.getAll("state").length !== 1 ||
          actual.length !== state.length ||
          !timingSafeEqual(actual, Buffer.from(state))
        ) {
          response.writeHead(400).end("Invalid authorization state.");
          return;
        }
        if (url.searchParams.has("error")) {
          response
            .writeHead(200)
            .end("Authorization cancelled. Return to Calm Work.");
          reject(new Error("Calendar authorization was cancelled."));
          return;
        }
        const code = url.searchParams.get("code");
        if (
          !code ||
          url.searchParams.getAll("code").length !== 1 ||
          code.length > 4096
        ) {
          response.writeHead(400).end("Missing authorization code.");
          return;
        }
        response
          .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
          .end("Calendar authorized. Return to Calm Work.");
        resolve(code);
      });
    });
    // Install rejection handling before opening the browser.
    void codePromise.catch(() => undefined);
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(
          0,
          provider === "microsoft" ? "localhost" : "127.0.0.1",
          resolve,
        );
      });
      const address = server.address();
      if (!address || typeof address === "string")
        throw new Error("Calendar callback could not start.");
      const redirect = `http://${provider === "microsoft" ? "localhost" : "127.0.0.1"}:${address.port}/oauth/callback`;
      const url = new URL(providers[provider].authorize(tenant));
      for (const [key, value] of Object.entries({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: "code",
        scope: providers[provider].scope,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }))
        url.searchParams.set(key, value);
      if (provider === "google") {
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent select_account");
      }
      this.pending = () =>
        rejectCallback(new Error("Calendar authorization was cancelled."));
      timer = setTimeout(
        () =>
          rejectCallback(
            new Error("Calendar authorization timed out. Try again."),
          ),
        this.deps.timeoutMs || 180000,
      );
      await this.deps.openExternal(url.href);
      const code = await codePromise;
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: redirect,
        code_verifier: verifier,
      });
      if (provider === "google" && clientSecret)
        body.set("client_secret", clientSecret);
      const result = await this.token(provider, body, tenant);
      if (typeof result.refresh_token !== "string")
        throw new Error(
          "Offline access was not granted. Reconnect and approve access.",
        );
      this.credentials[accountId] = {
        provider,
        clientId,
        ...(clientSecret ? { clientSecret } : {}),
        ...(provider === "microsoft" ? { tenant: tenantOf(tenant) } : {}),
        scope:
          typeof result.scope === "string"
            ? result.scope
            : providers[provider].scope,
        accessToken: result.access_token as string,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + (result.expires_in as number) * 1000,
      };
      delete this.cache[accountId];
      await this.persist();
      await this.refresh(accountId);
    } finally {
      if (timer) clearTimeout(timer);
      this.pending = null;
      server.close();
      server.closeAllConnections();
    }
  }
  private async access(accountId: string): Promise<string> {
    const credential = this.credentials[accountId];
    const provider = credential?.provider;
    if (!credential) throw new Error("Connect this calendar account first.");
    if (credential.external) {
      if (!credential.accessToken)
        throw new ProviderError("Waiting for the Google sign-in token. Will retry.", 0);
      return credential.accessToken;
    }
    if (credential.expiresAt > Date.now() + 60000)
      return credential.accessToken;
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: credential.clientId,
    });
    if (provider === "google" && credential.clientSecret)
      body.set("client_secret", credential.clientSecret);
    if (provider === "microsoft")
      body.set("scope", credential.scope?.includes(MICROSOFT_WRITE) ? providers.microsoft.scope : "offline_access https://graph.microsoft.com/Calendars.Read");
    const result = await this.token(provider!, body, credential.tenant);
    credential.accessToken = result.access_token as string;
    if (typeof result.scope === "string") credential.scope = result.scope;
    if (typeof result.refresh_token === "string")
      credential.refreshToken = result.refresh_token;
    credential.expiresAt = Date.now() + (result.expires_in as number) * 1000;
    await this.persist();
    return credential.accessToken;
  }
  private async get(accountId: string, url: string): Promise<any> {
    const provider = this.credentials[accountId]?.provider;
    const parsed = new URL(url);
    const host =
      provider === "google" ? "www.googleapis.com" : "graph.microsoft.com";
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== host ||
      parsed.username ||
      parsed.password ||
      parsed.port
    )
      throw new Error("Invalid calendar continuation URL.");
    const token = await this.access(accountId);
    const response = await this.fetcher(parsed.href, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(provider === "microsoft"
          ? { Prefer: 'outlook.timezone="UTC"' }
          : {}),
      },
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Calendar access expired. Reconnect this account."
          : response.status === 429
            ? "Calendar request limit reached. Try again later."
            : "Calendar refresh failed. Cached events are still available.",
      );
    return response.json();
  }
  private async pages(
    accountId: string,
    initial: string,
    key: string,
  ): Promise<any[]> {
    const provider = this.credentials[accountId]?.provider;
    let url = initial;
    const items: any[] = [];
    for (let page = 0; page < 100; page++) {
      const data = await this.get(accountId, url);
      if (!Array.isArray(data[key]))
        throw new Error("Invalid calendar response.");
      items.push(...data[key]);
      if (items.length > 20000) throw new Error("Calendar range is too large.");
      if (provider === "microsoft") {
        url = data["@odata.nextLink"];
        if (!url) return items;
      } else {
        if (!data.nextPageToken) return items;
        const next = new URL(initial);
        next.searchParams.set("pageToken", data.nextPageToken);
        url = next.href;
      }
    }
    throw new Error("Calendar pagination limit reached.");
  }
  private async refresh(accountId: string): Promise<void> {
    const provider = this.credentials[accountId]?.provider;
    if (!provider) throw new Error("Connect this calendar account first.");
    const begin = new Date();
    begin.setDate(begin.getDate() - 7);
    begin.setHours(0, 0, 0, 0);
    const end = new Date(begin);
    end.setDate(end.getDate() + 70);
    const calendars = await this.pages(
      accountId,
      provider === "google"
        ? "https://www.googleapis.com/calendar/v3/users/me/calendarList"
        : "https://graph.microsoft.com/v1.0/me/calendars",
      provider === "google" ? "items" : "value",
    );
    if (provider === "google")
      this.credentials[accountId].label = String(
        calendars.find((calendar) => calendar.primary)?.id || "",
      ).slice(0, 320);
    const editable = (calendar: any) =>
      provider === "google"
        ? ["owner", "writer"].includes(calendar.accessRole)
        : calendar.canEdit === true;
    const infos: CalendarInfo[] = calendars
      .filter((calendar) =>
        provider === "google" ? !["none", "freeBusyReader"].includes(calendar.accessRole) : true,
      )
      .map((calendar) => ({
        id: String(calendar.id),
        name: String(calendar.summaryOverride || calendar.summary || calendar.name || "Calendar").slice(0, 200),
        canWrite: editable(calendar),
        color: String(
          (provider === "google" ? calendar.backgroundColor : calendar.hexColor || GRAPH_COLORS[calendar.color]) || "",
        ).slice(0, 16),
      }));
    const writable: WritableCalendar[] = calendars
      .filter(editable)
      .map((calendar) => ({
        id: String(calendar.id),
        name: String(calendar.summary || calendar.name || "Calendar").slice(0, 200),
        ...(calendar.primary || calendar.isDefaultCalendar ? { primary: true } : {}),
      }));
    if (provider === "google") {
      const own = calendars.find(
        (calendar) =>
          calendar.summary === CALM_CALENDAR_NAME &&
          ["owner", "writer"].includes(calendar.accessRole),
      );
      if (own) this.mirror.calmCalendars[accountId] = String(own.id);
      else delete this.mirror.calmCalendars[accountId];
    }
    // First sign-in syncs the main calendar; calendars discovered later start unticked.
    let selection = this.selection[accountId];
    if (!selection)
      selection = this.selection[accountId] = {
        known: infos.map((c) => c.id),
        synced: (calendars.some((c) => c.primary || c.isDefaultCalendar)
          ? calendars.filter((c) => c.primary || c.isDefaultCalendar)
          : calendars
        ).map((c) => String(c.id)),
      };
    for (const info of infos) if (!selection.known.includes(info.id)) selection.known.push(info.id);
    const calmId = this.mirror.calmCalendars[accountId];
    for (const info of infos) {
      info.calm = info.id === calmId;
      info.synced = info.calm || selection.synced.includes(info.id);
    }
    const syncedIds = new Set(infos.filter((c) => c.synced).map((c) => c.id));
    const events: CalendarEvent[] = [];
    const mirroredIds = new Set(
      Object.values(this.mirror.records)
        .filter((record) => record.accountId === accountId && record.eventId)
        .map((record) => record.eventId),
    );
    // One drawn occurrence per iCal identity. The editable calendar wins.
    const chosen = new Map<string, { entry: any; calendar: any }>();
    // Google events are read by SP's google-calendar-provider (polling, cache, agenda);
    // here Google only needs the calendar list for names, writability and Calm Work.
    for (const calendar of provider === "google"
      ? []
      : calendars.filter((c) => syncedIds.has(String(c.id)))) {
      const id = encodeURIComponent(calendar.id);
      const url = new URL(
        provider === "google"
          ? `https://www.googleapis.com/calendar/v3/calendars/${id}/events`
          : `https://graph.microsoft.com/v1.0/me/calendars/${id}/calendarView`,
      );
      for (const [key, value] of Object.entries(
        provider === "google"
          ? {
              timeMin: begin.toISOString(),
              timeMax: end.toISOString(),
              singleEvents: "true",
              maxResults: "2500",
            }
          : {
              startDateTime: begin.toISOString(),
              endDateTime: end.toISOString(),
              $top: "1000",
              $expand: `singleValueExtendedProperties($filter=id eq '${GRAPH_KEY_PROPERTY}')`,
            },
      ))
        url.searchParams.set(key, value);
      const entries = await this.pages(
        accountId,
        url.href,
        provider === "google" ? "items" : "value",
      );
      for (const entry of entries) {
        if (entry.status === "cancelled" || entry.isCancelled) continue;
        // Calm Work's own time blocks already appear as tasks in Plan.
        if (
          entry.extendedProperties?.private?.calmWork === "1" ||
          (entry.singleValueExtendedProperties || []).some(
            (item: { id?: string }) =>
              String(item.id || "").toLowerCase() === GRAPH_KEY_PROPERTY.toLowerCase(),
          )
        )
          continue;
        const eventId = String(entry.id || "");
        if (!eventId || mirroredIds.has(eventId)) continue;
        const startRaw = String(entry.start?.dateTime || entry.start?.date || "");
        const allDay = entry.isAllDay === true || Boolean(entry.start?.date);
        const identity = String(entry.iCalUId || entry.iCalUID || eventId);
        const key = `${identity}|${allDay ? startRaw.slice(0, 10) : startRaw}`;
        const previous = chosen.get(key);
        if (!previous || (editable(calendar) && !editable(previous.calendar)))
          chosen.set(key, { entry, calendar });
      }
    }
    const addIsoDate = (iso: string, days: number): string => {
      const [year, month, day] = iso.split("-").map(Number);
      return new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + days))
        .toISOString()
        .slice(0, 10);
    };
    for (const { entry, calendar } of chosen.values()) {
        const startRaw = entry.start?.dateTime || entry.start?.date;
        const endRaw = entry.end?.dateTime || entry.end?.date;
        const allDay = entry.isAllDay === true || Boolean(entry.start?.date);
        const providerEventId = String(entry.id || "");
        const googleInstance = /_\d{8}T\d{6}Z$/.test(providerEventId);
        const recurring =
          provider === "google"
            ? Boolean(entry.recurringEventId) || googleInstance
            : entry.type === "occurrence" || entry.type === "exception";
        const seriesId = String(
          (provider === "google" ? entry.recurringEventId : entry.seriesMasterId) ||
            (googleInstance ? providerEventId.replace(/_\d{8}T\d{6}Z$/, "") : ""),
        );
        const utc = (raw: string) =>
          new Date(
            raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)
              ? raw + "T00:00:00"
              : provider === "microsoft" &&
                  raw &&
                  !/[zZ]|[+-]\d\d:\d\d$/.test(raw)
                ? raw + "Z"
                : raw,
          );
        const start = utc(startRaw),
          finish = utc(endRaw);
        if (
          !Number.isFinite(+start) ||
          !Number.isFinite(+finish) ||
          finish <= start
        )
          continue;
        // All-day events are civil dates. Parsing them as UTC instants splits one day
        // across local midnight and draws the same chip twice.
        if (allDay && /^\d{4}-\d{2}-\d{2}/.test(String(startRaw))) {
          const startDay = String(startRaw).slice(0, 10);
          const endDay = String(endRaw || "").slice(0, 10);
          const limit =
            /^\d{4}-\d{2}-\d{2}/.test(endDay) && endDay > startDay
              ? endDay
              : addIsoDate(startDay, 1);
          const dayStart = +new Date(startDay + "T00:00:00");
          const dayEnd = +new Date(limit + "T00:00:00");
          let cursorDay = startDay;
          for (let part = 0; cursorDay < limit && part < 72; part++) {
            events.push({
              id: `provider:${accountId}:${calendar.id}:${entry.id}:${part}`,
              title: String(entry.summary || entry.subject || "Busy").slice(0, 500),
              date: cursorDay,
              start: "00:00",
              end: "24:00",
              calendar: `${provider === "google" ? (accountId === "google-2" ? "Google 2" : "Google 1") : "Microsoft 365"} · ${calendar.summary || calendar.name || "Calendar"}`,
              meetingUrl: eventMeetingUrl(entry),
              notes: String(entry.description || entry.bodyPreview || "")
                .replace(/<[^>]*>/g, "")
                .slice(0, 10000),
              owned: false,
              accountId,
              calendarId: String(calendar.id),
              eventId: String(entry.id),
              location: String(entry.location?.displayName || "").slice(0, 500),
              editable: editable(calendar),
              color: infos.find((c) => c.id === String(calendar.id))?.color || "",
              recurring,
              seriesId,
              startMs: dayStart,
              endMs: dayEnd,
              allDay: true,
              busy:
                provider === "google"
                  ? entry.transparency !== "transparent"
                  : !["free", "workingElsewhere"].includes(entry.showAs),
            });
            cursorDay = addIsoDate(cursorDay, 1);
          }
          continue;
        }
        // Overnight timed events are split into local dates for the existing renderer.
        for (
          let cursor = new Date(start), part = 0;
          cursor < finish && part < 72;
          part++
        ) {
          const midnight = new Date(cursor);
          midnight.setHours(24, 0, 0, 0);
          const stop = new Date(Math.min(+midnight, +finish));
          if (cursor < end && stop > begin)
            events.push({
              id: `provider:${accountId}:${calendar.id}:${entry.id}:${part}`,
              title: String(entry.summary || entry.subject || "Busy").slice(
                0,
                500,
              ),
              date: localDate(cursor),
              start: localTime(cursor),
              end: +stop === +midnight ? "24:00" : localTime(stop),
              calendar: `${provider === "google" ? (accountId === "google-2" ? "Google 2" : "Google 1") : "Microsoft 365"} · ${calendar.summary || calendar.name || "Calendar"}`,
              meetingUrl: eventMeetingUrl(entry),
              notes: String(entry.description || entry.bodyPreview || "")
                .replace(/<[^>]*>/g, "")
                .slice(0, 10000),
              owned: false,
              accountId,
              calendarId: String(calendar.id),
              eventId: String(entry.id),
              location: String(entry.location?.displayName || "").slice(0, 500),
              editable: editable(calendar),
              color: infos.find((c) => c.id === String(calendar.id))?.color || "",
              recurring,
              seriesId,
              startMs: +start,
              endMs: +finish,
              allDay: false,
              busy:
                provider === "google"
                  ? entry.transparency !== "transparent"
                  : !["free", "workingElsewhere"].includes(entry.showAs),
            });
          cursor = stop;
        }
    }
    this.cache[accountId] = {
      events,
      writable,
      calendars: infos,
      refreshedAt: new Date().toISOString(),
      ...(this.credentials[accountId].label ? { label: this.credentials[accountId].label } : {}),
    };
    await this.persist();
  }

  // ---------------------------------------------------------------------------
  // Time-block write-back. Only events this app created are ever changed: each
  // record stores the provider event id plus a private marker/key, and the
  // marker is re-checked on the provider before every update or delete. Edits
  // made in the calendar are never overwritten without an explicit choice.

  private canWrite(accountId: string): boolean {
    const credential = this.credentials[accountId];
    if (!credential?.scope) return false;
    return credential.scope
      .split(/\s+/)
      .includes(credential.provider === "google" ? GOOGLE_WRITE : MICROSOFT_WRITE);
  }
  private accountName(accountId: string): string {
    const custom = this.selection[accountId]?.name?.trim();
    if (custom) return custom;
    const email = this.credentials[accountId]?.label || "";
    if (email.includes("@")) return email;
    return this.credentials[accountId]?.provider === "microsoft"
      ? "Microsoft 365"
      : accountId === "google-2"
        ? "Google 2"
        : "Google 1";
  }
  private calendarLabel(accountId: string, calendarName: string): string {
    const account = this.accountName(accountId);
    const name = calendarName || "Calendar";
    return name.toLowerCase() === account.toLowerCase() ? account : `${account} · ${name}`;
  }
  private calendarColor(accountId: string, calendar: { id: string; color?: string }): string {
    const custom = this.selection[accountId]?.colors?.[calendar.id] || "";
    return /^#[0-9a-f]{6}$/i.test(custom) ? custom.toLowerCase() : calendar.color || "";
  }
  private defaultAccount(): string | null {
    const google = Object.keys(this.credentials).filter(
      (accountId) =>
        this.credentials[accountId]?.provider === "google" && this.canWrite(accountId),
    );
    const wanted = DEFAULT_MIRROR_ACCOUNT.trim().toLowerCase();
    if (wanted)
      return (
        google.find(
          (accountId) => this.credentials[accountId]?.label?.toLowerCase() === wanted,
        ) || null
      );
    return google[0] || null;
  }
  private targets(): { key: string; label: string }[] {
    const list: { key: string; label: string }[] = [];
    for (const accountId of Object.keys(this.credentials)) {
      if (!this.canWrite(accountId)) continue;
      const calendars = [...(this.cache[accountId]?.writable || [])];
      const calm = this.mirror.calmCalendars[accountId];
      if (accountId === this.defaultAccount() && !calm)
        list.push({
          key: `${accountId}|@calm`,
          label: `${this.accountName(accountId)} · ${CALM_CALENDAR_NAME} (create it in Google Calendar first)`,
        });
      const infos = this.cache[accountId]?.calendars;
      for (const calendar of calendars.filter(
        (c) => !infos || c.id === calm || infos.some((i) => i.id === c.id && i.synced !== false),
      ))
        list.push({
          key: `${accountId}|${calendar.id}`,
          label: this.calendarLabel(accountId, calendar.name),
        });
    }
    return list;
  }
  private targetLabel(key: string): string {
    return this.targets().find((target) => target.key === key)?.label || "";
  }
  /** Resolve a block's target to a writable account/calendar, or null to keep it local. */
  private resolveTarget(
    target: string,
  ): { accountId: string; calendarId: string } | null {
    if (!this.mirror.enabled || target === "none") return null;
    let key = target || this.mirror.defaultTarget;
    if (!key) {
      const account = this.defaultAccount();
      if (!account) return null;
      key = `${account}|${this.mirror.calmCalendars[account] || "@calm"}`;
    }
    const split = key.indexOf("|");
    if (split < 1) return null;
    const accountId = key.slice(0, split),
      calendarId = key.slice(split + 1);
    if (!this.canWrite(accountId)) return null;
    if (calendarId === "@calm")
      return this.credentials[accountId]?.provider === "google"
        ? {
            accountId,
            calendarId: this.mirror.calmCalendars[accountId] || "@calm",
          }
        : null;
    if (
      !(this.cache[accountId]?.writable || []).some((item) => item.id === calendarId) &&
      this.mirror.calmCalendars[accountId] !== calendarId
    )
      return null;
    return { accountId, calendarId };
  }
  private setDesired(value: unknown): void {
    if (!Array.isArray(value) || value.length > 5000)
      throw new Error("Invalid time blocks.");
    const next: Record<string, MirrorBlock> = {};
    for (const raw of value) {
      const block = raw as MirrorBlock;
      if (
        !block ||
        typeof block.taskId !== "string" ||
        !block.taskId ||
        block.taskId.length > 200 ||
        typeof block.title !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(block.date) ||
        !/^\d{2}:\d{2}$/.test(block.start) ||
        !Number.isFinite(block.minutes) ||
        block.minutes < 1 ||
        block.minutes > 1440 ||
        typeof block.target !== "string" ||
        block.target.length > 600
      )
        throw new Error("Invalid time block.");
      next[block.taskId] = {
        taskId: block.taskId,
        title: block.title.trim().slice(0, 500) || "Time block",
        date: block.date,
        start: block.start,
        minutes: Math.round(block.minutes),
        target: block.target,
      };
    }
    const before = this.mirror.desired;
    for (const taskId of new Set([...Object.keys(before), ...Object.keys(next)]))
      if (JSON.stringify(before[taskId] || null) !== JSON.stringify(next[taskId] || null))
        this.enqueue(taskId);
    this.mirror.desired = next;
  }
  private enqueue(taskId: string, now = false): void {
    const existing = this.mirror.outbox[taskId];
    this.mirror.outbox[taskId] = {
      taskId,
      attempts: existing?.attempts || 0,
      nextAt: now || !existing ? 0 : Math.min(existing.nextAt, Date.now()),
      ...(existing?.lastError ? { lastError: existing.lastError } : {}),
    };
  }
  private projectionOf(block: MirrorBlock): Projection {
    const start = new Date(`${block.date}T${block.start}:00`);
    return {
      title: block.title,
      startMs: +start,
      endMs: +start + block.minutes * 60000,
    };
  }
  private adoptedPlan(record: MirrorRecord): unknown {
    if (!record.conflict || record.conflict.removed)
      return { taskId: record.taskId, removed: true };
    const start = new Date(record.conflict.startMs);
    return {
      taskId: record.taskId,
      date: localDate(start),
      start: localTime(start),
      minutes: Math.max(
        1,
        Math.round((record.conflict.endMs - record.conflict.startMs) / 60000),
      ),
    };
  }
  private mirrorStatus(): unknown {
    const tasks: Record<string, unknown> = {};
    for (const taskId of new Set([
      ...Object.keys(this.mirror.records),
      ...Object.keys(this.mirror.outbox),
      ...Object.keys(this.mirror.errors),
    ])) {
      const record = this.mirror.records[taskId],
        pending = this.mirror.outbox[taskId];
      tasks[taskId] = {
        state: record?.state === "conflict"
          ? "conflict"
          : pending
            ? "pending"
            : this.mirror.errors[taskId]
              ? "error"
              : "synced",
        calendar: record
          ? this.targetLabel(`${record.accountId}|${record.calendarId}`) ||
            this.accountName(record.accountId)
          : "",
        ...(record?.conflict
          ? {
              conflict: {
                removed: !!record.conflict.removed,
                title: record.conflict.title,
                ...(record.conflict.removed ? {} : this.adoptedPlan(record) as object),
              },
            }
          : {}),
        ...(pending?.lastError ? { retry: pending.attempts, error: pending.lastError } : {}),
        ...(this.mirror.errors[taskId] ? { error: this.mirror.errors[taskId] } : {}),
      };
    }
    const fallback = this.defaultAccount();
    return {
      enabled: this.mirror.enabled,
      defaultTarget: this.mirror.defaultTarget,
      defaultLabel: this.mirror.defaultTarget
        ? this.targetLabel(this.mirror.defaultTarget)
        : fallback && this.canWrite(fallback)
          ? `${this.accountName(fallback)} · ${CALM_CALENDAR_NAME}`
          : "",
      targets: this.targets(),
      pending: Object.keys(this.mirror.outbox).length,
      tasks,
    };
  }
  private scheduleRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const next = Math.min(
      ...Object.values(this.mirror.outbox).map((entry) => entry.nextAt),
    );
    if (!Number.isFinite(next)) return;
    this.retryTimer = setTimeout(
      () => {
        this.retryTimer = null;
        this.queue = this.queue
          .catch(() => undefined)
          .then(() => this.processOutbox())
          .catch(() => undefined);
      },
      Math.max(1000, Math.min(3600000, next - Date.now())),
    );
    (this.retryTimer as { unref?: () => void }).unref?.();
  }
  /** Runs inside the single command queue. */
  private async processOutbox(): Promise<void> {
    const now = Date.now();
    for (const entry of Object.values(this.mirror.outbox)) {
      if (entry.nextAt > now) continue;
      try {
        await this.reconcile(entry.taskId);
        delete this.mirror.outbox[entry.taskId];
        delete this.mirror.errors[entry.taskId];
      } catch (error) {
        const transient = !(error instanceof ProviderError) || error.transient;
        const message =
          error instanceof Error ? error.message : "Calendar update failed.";
        if (transient && entry.attempts < 20) {
          entry.attempts++;
          entry.lastError = message;
          entry.nextAt = Date.now() + Math.min(3600000, 30000 * 2 ** (entry.attempts - 1));
        } else {
          delete this.mirror.outbox[entry.taskId];
          this.mirror.errors[entry.taskId] = message;
        }
      }
      await this.persist();
    }
    this.scheduleRetry();
  }
  private async reconcile(taskId: string): Promise<void> {
    const block = this.mirror.desired[taskId];
    let target = block ? this.resolveTarget(block.target) : null;
    let record = this.mirror.records[taskId];
    if (record) {
      const remote = await this.readOwned(record);
      if (remote === "foreign") {
        // Never touch an event that is not marked as ours.
        delete this.mirror.records[taskId];
        throw new ProviderError("Calendar event is not managed by Calm Work.", 403);
      }
      if (remote === null || !sameProjection(remote, record.projection)) {
        const conflict = remote === null
          ? { ...record.projection, removed: true }
          : remote;
        if (!target && !record.overwrite) {
          // Block removed locally but the event was edited/removed in the calendar: keep Ada's version.
          delete this.mirror.records[taskId];
          return;
        }
        if (!record.overwrite) {
          record.state = "conflict";
          record.conflict = conflict;
          return;
        }
        if (remote === null) {
          delete this.mirror.records[taskId];
          this.mirror.generations[taskId] = (this.mirror.generations[taskId] || 0) + 1;
          record = undefined as unknown as MirrorRecord;
        }
      }
      if (record) {
        const moved =
          target &&
          (target.accountId !== record.accountId ||
            (target.calendarId !== record.calendarId &&
              !(target.calendarId === "@calm" &&
                this.mirror.calmCalendars[record.accountId] === record.calendarId)));
        if (!target || moved) {
          await this.removeEvent(record);
          delete this.mirror.records[taskId];
          this.mirror.generations[taskId] = (this.mirror.generations[taskId] || 0) + 1;
          if (!target) return;
          record = undefined as unknown as MirrorRecord;
        } else {
          const projection = this.projectionOf(block!);
          if (!sameProjection(projection, record.projection) || record.overwrite) {
            await this.patchEvent(record, projection);
            record.projection = projection;
          }
          record.state = "synced";
          delete record.conflict;
          delete record.overwrite;
          return;
        }
      }
    }
    if (!block || !target) return;
    if (target.calendarId === "@calm")
      target = { ...target, calendarId: await this.ensureCalmCalendar(target.accountId) };
    const projection = this.projectionOf(block);
    const generation = this.mirror.generations[taskId] || 0;
    const key = createHash("sha256")
      .update(`calm-work|${target.accountId}|${target.calendarId}|${taskId}|${generation}`)
      .digest("hex")
      .slice(0, 40);
    const eventId = await this.createEvent(target.accountId, target.calendarId, key, projection);
    this.mirror.records[taskId] = {
      taskId,
      accountId: target.accountId,
      calendarId: target.calendarId,
      eventId,
      key,
      projection,
      state: "synced",
    };
  }
  private async api(
    accountId: string,
    method: string,
    url: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ status: number; data: any }> {
    const provider = this.credentials[accountId]?.provider;
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !==
        (provider === "google" ? "www.googleapis.com" : "graph.microsoft.com")
    )
      throw new ProviderError("Invalid calendar URL.", 400);
    const token = await this.access(accountId);
    let response: Response;
    try {
      response = await this.fetcher(parsed.href, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(provider === "microsoft"
            ? { Prefer: 'outlook.timezone="UTC", outlook.body-content-type="text"' }
            : {}),
          ...extraHeaders,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new ProviderError("Calendar is unreachable. Will retry.", 0);
    }
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { status: response.status, data };
  }
  private fail(status: number, action: string): never {
    throw new ProviderError(
      status === 401
        ? "Calendar access expired. Sign in again in Settings."
        : status === 403
          ? `Calendar refused to ${action}. Check that you can edit this calendar.`
          : status === 429
            ? "Calendar request limit reached. Will retry."
            : `Calendar could not ${action}. Will retry.`,
      status,
    );
  }
  private google(calendarId: string, eventId = ""): string {
    return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${eventId ? "/" + encodeURIComponent(eventId) : ""}`;
  }
  private graphEvent(eventId: string): string {
    return `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}?$expand=${encodeURIComponent(`singleValueExtendedProperties($filter=id eq '${GRAPH_KEY_PROPERTY}')`)}`;
  }
  private graphTime(ms: number): { dateTime: string; timeZone: string } {
    return { dateTime: new Date(ms).toISOString().replace("Z", ""), timeZone: "UTC" };
  }
  private remoteProjection(provider: Provider, data: any): Projection {
    const parse = (value: any) => {
      const raw = value?.dateTime || value?.date || "";
      return +new Date(
        provider === "microsoft" && raw && !/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw + "Z" : raw,
      );
    };
    return {
      title: String(data?.summary ?? data?.subject ?? ""),
      startMs: parse(data?.start),
      endMs: parse(data?.end),
    };
  }
  private markedKey(provider: Provider, data: any): string {
    return provider === "google"
      ? data?.extendedProperties?.private?.calmWork === "1"
        ? String(data.extendedProperties.private.calmKey || "")
        : ""
      : String(
          (data?.singleValueExtendedProperties || []).find(
            (item: { id?: string }) =>
              String(item.id || "").toLowerCase() === GRAPH_KEY_PROPERTY.toLowerCase(),
          )?.value || "",
        );
  }
  /** Current provider version of our event, null if removed, "foreign" if not ours. */
  private async readOwned(record: MirrorRecord): Promise<Projection | null | "foreign"> {
    const provider = this.credentials[record.accountId]?.provider;
    if (!provider) throw new ProviderError("Calendar account is disconnected.", 401);
    const { status, data } = await this.api(
      record.accountId,
      "GET",
      provider === "google"
        ? this.google(record.calendarId, record.eventId)
        : this.graphEvent(record.eventId),
    );
    if (status === 404 || status === 410) return null;
    if (status < 200 || status >= 300) this.fail(status, "read the time block");
    if (data?.status === "cancelled" || data?.isCancelled) return null;
    if (this.markedKey(provider, data) !== record.key) return "foreign";
    return this.remoteProjection(provider, data);
  }
  private async createEvent(
    accountId: string,
    calendarId: string,
    key: string,
    projection: Projection,
  ): Promise<string> {
    const provider = this.credentials[accountId]!.provider;
    if (provider === "google") {
      // Deterministic id (base32hex-safe hex) makes a retried create idempotent.
      const body = {
        id: key,
        summary: projection.title,
        description: "Time block from Calm Work.",
        start: { dateTime: new Date(projection.startMs).toISOString() },
        end: { dateTime: new Date(projection.endMs).toISOString() },
        transparency: "opaque",
        reminders: { useDefault: false },
        // spTaskId makes SP's google-calendar-provider treat it as a managed time block and hide it.
        extendedProperties: { private: { calmWork: "1", calmKey: key, spTaskId: `calm-work:${key}` } },
      };
      const { status, data } = await this.api(accountId, "POST", this.google(calendarId), body);
      if (status === 409) {
        const existing = await this.api(accountId, "GET", this.google(calendarId, key));
        if (existing.status === 200 && this.markedKey("google", existing.data) === key)
          return key;
        throw new ProviderError("A different event already uses this id.", 409);
      }
      if (status < 200 || status >= 300) this.fail(status, "add the time block");
      return String(data?.id || key);
    }
    // Microsoft: look for an earlier ambiguous create before creating again.
    const filter = `singleValueExtendedProperties/Any(ep: ep/id eq '${GRAPH_KEY_PROPERTY}' and ep/value eq '${key}')`;
    const found = await this.api(
      accountId,
      "GET",
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events?$filter=${encodeURIComponent(filter)}&$select=id`,
    );
    if (found.status === 200 && Array.isArray(found.data?.value) && found.data.value[0]?.id)
      return String(found.data.value[0].id);
    const { status, data } = await this.api(
      accountId,
      "POST",
      `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        subject: projection.title,
        body: { contentType: "text", content: "Time block from Calm Work." },
        start: this.graphTime(projection.startMs),
        end: this.graphTime(projection.endMs),
        showAs: "busy",
        isReminderOn: false,
        transactionId: key.slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5"),
        singleValueExtendedProperties: [{ id: GRAPH_KEY_PROPERTY, value: key }],
      },
    );
    if (status < 200 || status >= 300 || !data?.id) this.fail(status, "add the time block");
    return String(data.id);
  }
  private async patchEvent(record: MirrorRecord, projection: Projection): Promise<void> {
    const provider = this.credentials[record.accountId]!.provider;
    const { status } = await this.api(
      record.accountId,
      "PATCH",
      provider === "google"
        ? this.google(record.calendarId, record.eventId)
        : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(record.eventId)}`,
      provider === "google"
        ? {
            summary: projection.title,
            start: { dateTime: new Date(projection.startMs).toISOString() },
            end: { dateTime: new Date(projection.endMs).toISOString() },
          }
        : {
            subject: projection.title,
            start: this.graphTime(projection.startMs),
            end: this.graphTime(projection.endMs),
          },
    );
    if (status < 200 || status >= 300) this.fail(status, "move the time block");
  }
  private async removeEvent(record: MirrorRecord): Promise<void> {
    const provider = this.credentials[record.accountId]!.provider;
    const { status } = await this.api(
      record.accountId,
      "DELETE",
      provider === "google"
        ? this.google(record.calendarId, record.eventId)
        : `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(record.eventId)}`,
    );
    if (status === 404 || status === 410) return;
    if (status < 200 || status >= 300) this.fail(status, "remove the time block");
  }
  private async ensureCalmCalendar(accountId: string): Promise<string> {
    const known = this.mirror.calmCalendars[accountId];
    if (known) return known;
    const list = await this.pages(
      accountId,
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      "items",
    );
    const existing = list.find(
      (calendar) =>
        calendar.summary === CALM_CALENDAR_NAME && calendar.accessRole === "owner",
    );
    if (existing) {
      this.mirror.calmCalendars[accountId] = String(existing.id);
      return String(existing.id);
    }
    // SP's verified scopes cannot create calendars. Create it once by hand.
    const accountLabel = this.credentials[accountId]?.label || DEFAULT_MIRROR_ACCOUNT;
    throw new ProviderError(
      `Create a calendar named "${CALM_CALENDAR_NAME}" in Google Calendar${accountLabel ? ` (${accountLabel})` : ""}, then press Refresh.`,
      404,
    );
  }

  // ---------------------------------------------------------------------------
  // Google accounts lent by SP's google-calendar-provider (tokens stay in SP).

  private syncExternal(list: unknown[]): void {
    const seen = new Set<string>();
    for (const item of list.slice(0, 2)) {
      const value = (item || {}) as Partial<ExternalAccount>;
      const accountId = String(value.accountId || "");
      if (!["google", "google-2"].includes(accountId)) continue;
      seen.add(accountId);
      const existing = this.credentials[accountId];
      const accessToken = typeof value.accessToken === "string" ? value.accessToken.slice(0, 4096) : "";
      if (existing?.external) existing.accessToken = accessToken;
      else
        this.credentials[accountId] = {
          provider: "google",
          clientId: "super-productivity",
          scope: GOOGLE_SP_SCOPES.join(" "),
          accessToken,
          refreshToken: "",
          expiresAt: Number.MAX_SAFE_INTEGER,
          external: true,
          ...(this.cache[accountId]?.label ? { label: this.cache[accountId]!.label } : {}),
        };
    }
    for (const [accountId, credential] of Object.entries(this.credentials))
      if (credential.external && !seen.has(accountId)) delete this.credentials[accountId];
  }
  /** Calendar list for newly lent Google accounts (names, writability, Calm Work). */
  private async refreshExternal(): Promise<void> {
    for (const [accountId, credential] of Object.entries(this.credentials))
      if (credential.external && credential.accessToken && !this.cache[accountId]?.calendars)
        try {
          await this.refresh(accountId);
        } catch {
          // Shown on the next explicit refresh; events still come from SP.
        }
  }

  // ---------------------------------------------------------------------------
  // Event editing on calendars Ada can write to. Each write is checked against
  // the version the editor showed and sent with If-Match, so a change made
  // elsewhere comes back as a conflict and is never silently overwritten.

  private eventRef(value: unknown): EventRef {
    const v = (value || {}) as Record<string, unknown>;
    const ref = {
      accountId: String(v.accountId || ""),
      calendarId: String(v.calendarId || ""),
      eventId: String(v.eventId || ""),
    };
    if (!this.credentials[ref.accountId])
      throw new Error("This calendar account is not connected.");
    if (ref.calendarId === "primary" && this.credentials[ref.accountId].label)
      ref.calendarId = this.credentials[ref.accountId].label!;
    if (!ref.calendarId || !ref.eventId || ref.calendarId.length > 1024 || ref.eventId.length > 1024)
      throw new Error("Unknown calendar event.");
    return ref;
  }
  private calendarInfo(accountId: string, calendarId: string): CalendarInfo | undefined {
    return (this.cache[accountId]?.calendars || []).find((item) => item.id === calendarId);
  }
  private assertWritable(accountId: string, calendarId: string): void {
    const info = this.calendarInfo(accountId, calendarId);
    if (!this.canWrite(accountId) || !info?.canWrite)
      throw new ProviderError("This calendar is read-only in Calm Work.", 403);
    if (info.synced === false)
      throw new ProviderError("Turn this calendar on in Settings → Calendars first.", 403);
  }
  private eventUrl(ref: EventRef): string {
    return this.credentials[ref.accountId]!.provider === "google"
      ? this.google(ref.calendarId, ref.eventId)
      : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(ref.calendarId)}/events/${encodeURIComponent(ref.eventId)}`;
  }
  private toView(provider: Provider, data: any) {
    const allDay = provider === "google" ? Boolean(data?.start?.date) : data?.isAllDay === true;
    const parse = (value: any) => {
      const raw = String(value?.dateTime || value?.date || "");
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return +new Date(raw + "T00:00:00");
      if (allDay && provider === "microsoft") return +new Date(raw.slice(0, 10) + "T00:00:00");
      return +new Date(provider === "microsoft" && raw && !/[zZ]|[+-]\d\d:\d\d$/.test(raw) ? raw + "Z" : raw);
    };
    const view: EventView = {
      title: String(data?.summary ?? data?.subject ?? "").slice(0, 500),
      description: String(
        provider === "google" ? data?.description || "" : data?.body?.content || "",
      ).replace(/\r\n/g, "\n").slice(0, 20000),
      location: String(
        provider === "google" ? data?.location || "" : data?.location?.displayName || "",
      ).slice(0, 500),
      startMs: parse(data?.start),
      endMs: parse(data?.end),
      allDay,
    };
    return {
      view,
      meetingUrl: eventMeetingUrl(data),
      etag: String((provider === "google" ? data?.etag : data?.["@odata.etag"]) || ""),
      recurring:
        provider === "google"
          ? Boolean(data?.recurringEventId)
          : ["occurrence", "exception"].includes(data?.type),
      seriesId: String((provider === "google" ? data?.recurringEventId : data?.seriesMasterId) || ""),
      guests: Array.isArray(data?.attendees) ? data.attendees.length : 0,
    };
  }
  private async readEvent(ref: EventRef) {
    const provider = this.credentials[ref.accountId]!.provider;
    const { status, data } = await this.api(ref.accountId, "GET", this.eventUrl(ref));
    if (status === 404 || status === 410) return null;
    if (status < 200 || status >= 300) this.fail(status, "read the event");
    if (data?.status === "cancelled" || data?.isCancelled) return null;
    return this.toView(provider, data);
  }
  private publicView(ref: EventRef, read: NonNullable<Awaited<ReturnType<CalmCalendar["readEvent"]>>>) {
    return {
      ...ref,
      ...read.view,
      recurring: read.recurring,
      seriesId: read.seriesId,
      meetingUrl: read.meetingUrl,
      editable: this.canWrite(ref.accountId) && Boolean(this.calendarInfo(ref.accountId, ref.calendarId)?.canWrite),
      calendar: this.calendarLabel(ref.accountId, this.calendarInfo(ref.accountId, ref.calendarId)?.name || "Calendar"),
    };
  }
  private parseView(value: unknown, partial = false): Partial<EventView> {
    const v = (value || {}) as Record<string, unknown>;
    const out: Partial<EventView> = {};
    for (const key of ["title", "description", "location"] as const)
      if (typeof v[key] === "string") out[key] = (v[key] as string).replace(/\r\n/g, "\n").slice(0, key === "description" ? 20000 : 500);
      else if (!partial) out[key] = "";
    for (const key of ["startMs", "endMs"] as const)
      if (typeof v[key] === "number" && Number.isFinite(v[key])) out[key] = v[key] as number;
    if (typeof v.allDay === "boolean") out.allDay = v.allDay;
    const rawRule = v.recurrence;
    if (rawRule && typeof rawRule === "object") {
      const rule = rawRule as Record<string, unknown>;
      const freq = String(rule.freq || "");
      if (["daily", "weekly", "monthly", "monthlyWeekday"].includes(freq)) {
        out.recurrence = {
          freq,
          interval: Math.max(1, Math.min(52, Number(rule.interval) || 1)),
          ...(Array.isArray(rule.byDay)
            ? { byDay: rule.byDay.map((day) => Number(day)).filter((day) => day >= 0 && day <= 6) }
            : {}),
          ...(rule.weekOfMonth !== undefined && Number.isFinite(Number(rule.weekOfMonth))
            ? { weekOfMonth: Number(rule.weekOfMonth) }
            : {}),
        };
      }
    }
    if (!partial && (out.startMs === undefined || out.endMs === undefined))
      throw new Error("Event times are missing.");
    if (out.startMs !== undefined && out.endMs !== undefined && out.endMs <= out.startMs)
      throw new Error("The event must end after it starts.");
    return out;
  }
  private sameView(a: Partial<EventView>, b: EventView): boolean {
    return (
      (a.title ?? "") === b.title &&
      (a.description ?? "").trim() === b.description.trim() &&
      (a.location ?? "") === b.location &&
      a.startMs === b.startMs &&
      a.endMs === b.endMs
    );
  }
  private eventBody(provider: Provider, view: Partial<EventView>, allDay: boolean, anchorMs?: number): any {
    const body: any = {};
    const times = view.startMs !== undefined && view.endMs !== undefined;
    if (provider === "google") {
      if (view.title !== undefined) body.summary = view.title;
      if (view.description !== undefined) body.description = view.description;
      if (view.location !== undefined) body.location = view.location;
      if (times) {
        body.start = allDay ? { date: localDate(new Date(view.startMs!)) } : { dateTime: new Date(view.startMs!).toISOString() };
        body.end = allDay ? { date: localDate(new Date(view.endMs!)) } : { dateTime: new Date(view.endMs!).toISOString() };
      }
    } else {
      if (view.title !== undefined) body.subject = view.title;
      if (view.description !== undefined) body.body = { contentType: "text", content: view.description };
      if (view.location !== undefined) body.location = { displayName: view.location };
      if (times) {
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        body.isAllDay = allDay;
        body.start = allDay ? { dateTime: localDate(new Date(view.startMs!)) + "T00:00:00", timeZone: zone } : this.graphTime(view.startMs!);
        body.end = allDay ? { dateTime: localDate(new Date(view.endMs!)) + "T00:00:00", timeZone: zone } : this.graphTime(view.endMs!);
      }
    }
    if (view.recurrence && times && !allDay && provider === "google") {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const wall = (ms: number) => `${localDate(new Date(ms))}T${localTime(new Date(ms))}:00`;
      body.start = { dateTime: wall(view.startMs!), timeZone: zone };
      body.end = { dateTime: wall(view.endMs!), timeZone: zone };
    }
    if (view.recurrence)
      Object.assign(body, this.recurrenceFields(provider, view.recurrence, view.startMs ?? anchorMs ?? Date.now()));
    return body;
  }
  private recurrenceFields(provider: Provider, rule: RecurrenceRule, startMs: number): { recurrence: unknown } {
    const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
    const names = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const start = new Date(startMs);
    const interval = Math.max(1, Math.min(52, rule.interval || 1));
    const byDay = (rule.byDay || []).filter((day) => day >= 0 && day <= 6);
    const weekdays = byDay.length ? byDay : [start.getDay()];
    let rrule = interval > 1 ? `RRULE:FREQ=DAILY;INTERVAL=${interval}` : "RRULE:FREQ=DAILY";
    let pattern: Record<string, unknown> = { type: "daily", interval };
    if (rule.freq === "weekly") {
      rrule = `RRULE:FREQ=WEEKLY${interval > 1 ? `;INTERVAL=${interval}` : ""};BYDAY=${weekdays.map((day) => days[day]).join(",")}`;
      pattern = { type: "weekly", interval, daysOfWeek: weekdays.map((day) => names[day]), firstDayOfWeek: "sunday" };
    } else if (rule.freq === "monthly") {
      rrule = "RRULE:FREQ=MONTHLY";
      pattern = { type: "absoluteMonthly", interval: 1, dayOfMonth: start.getDate() };
    } else if (rule.freq === "monthlyWeekday") {
      const day = weekdays[0];
      const index = rule.weekOfMonth || 1;
      const indexName = index === 2 ? "second" : index === 3 ? "third" : index === 4 ? "fourth" : index === -1 ? "last" : "first";
      rrule = `RRULE:FREQ=MONTHLY;BYDAY=${index}${days[day]}`;
      pattern = { type: "relativeMonthly", interval: 1, daysOfWeek: [names[day]], index: indexName };
    }
    if (provider === "google") return { recurrence: [rrule] };
    return {
      recurrence: {
        pattern,
        range: {
          type: "noEnd",
          startDate: localDate(start),
          recurrenceTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    };
  }
  private async afterWrite(accountId: string): Promise<void> {
    // Microsoft events are read here; Google events are re-polled by SP (the shell triggers it).
    if (this.credentials[accountId]?.provider === "microsoft")
      try {
        await this.refresh(accountId);
      } catch {
        // The write succeeded; the next refresh shows it.
      }
  }
  private async conflictFor(ref: EventRef) {
    const fresh = await this.readEvent(ref);
    return { conflict: fresh ? this.publicView(ref, fresh) : { ...ref, removed: true } };
  }
  private async eventGet(refRaw: unknown) {
    const ref = this.eventRef(refRaw);
    const read = await this.readEvent(ref);
    if (!read) return { ...ref, removed: true };
    return this.publicView(ref, read);
  }
  private async createAt(accountId: string, calendarId: string, view: Partial<EventView>, allDay: boolean) {
    const provider = this.credentials[accountId]!.provider;
    const { status, data } = await this.api(
      accountId,
      "POST",
      provider === "google"
        ? this.google(calendarId)
        : `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`,
      this.eventBody(provider, view, allDay),
    );
    if (status < 200 || status >= 300 || !data?.id) this.fail(status, "create the event");
    return { ref: { accountId, calendarId, eventId: String(data.id) }, read: this.toView(provider, data) };
  }
  private async eventCreate(raw: unknown) {
    const v = (raw || {}) as Record<string, unknown>;
    const accountId = String(v.accountId || ""),
      calendarId = String(v.calendarId || "");
    if (!this.credentials[accountId]) throw new Error("This calendar account is not connected.");
    this.assertWritable(accountId, calendarId);
    const view = this.parseView(v) as EventView;
    if (!view.title.trim()) view.title = "New event";
    const { ref, read } = await this.createAt(accountId, calendarId, view, Boolean(view.allDay));
    await this.afterWrite(accountId);
    return { saved: this.publicView(ref, read) };
  }
  private async eventUpdate(refRaw: unknown, baseRaw: unknown, changesRaw: unknown, scopeRaw: unknown) {
    const ref = this.eventRef(refRaw);
    this.assertWritable(ref.accountId, ref.calendarId);
    const provider = this.credentials[ref.accountId]!.provider;
    const current = await this.readEvent(ref);
    if (!current) return { conflict: { ...ref, removed: true } };
    const base = this.parseView(baseRaw, true);
    if (!this.sameView(base, current.view)) return { conflict: this.publicView(ref, current) };
    const rawChanges = (changesRaw || {}) as Record<string, unknown>;
    const changes = this.parseView(rawChanges, true);
    const timeChanged =
      (changes.startMs !== undefined && changes.startMs !== current.view.startMs) ||
      (changes.endMs !== undefined && changes.endMs !== current.view.endMs);
    if (timeChanged) {
      changes.startMs ??= current.view.startMs;
      changes.endMs ??= current.view.endMs;
      if (changes.endMs <= changes.startMs) throw new Error("The event must end after it starts.");
    } else {
      delete changes.startMs;
      delete changes.endMs;
    }
    let recurrenceAnchor = changes.startMs ?? current.view.startMs;
    const destination = {
      accountId: typeof rawChanges.accountId === "string" ? rawChanges.accountId : ref.accountId,
      calendarId: typeof rawChanges.calendarId === "string" ? rawChanges.calendarId : ref.calendarId,
    };
    const moving = destination.accountId !== ref.accountId || destination.calendarId !== ref.calendarId;
    const series = scopeRaw === "series" && current.recurring;
    let target = ref,
      etag = current.etag;
    if (series) {
      if (!current.seriesId) throw new Error("This repeating event has no series to update.");
      target = { ...ref, eventId: current.seriesId };
      const master = await this.readEvent(target);
      if (!master) return { conflict: { ...ref, removed: true } };
      etag = master.etag;
      if (timeChanged) {
        const nextStart = changes.startMs ?? current.view.startMs;
        const nextEnd = changes.endMs ?? current.view.endMs;
        changes.startMs = master.view.startMs + (nextStart - current.view.startMs);
        changes.endMs = master.view.endMs + (nextEnd - current.view.endMs);
      }
      recurrenceAnchor = changes.startMs ?? master.view.startMs;
    }
    if (moving) {
      if (!this.credentials[destination.accountId]) throw new Error("That calendar account is not connected.");
      this.assertWritable(destination.accountId, destination.calendarId);
      if (current.recurring)
        throw new Error("A recurring event stays on its calendar. Move it in Google Calendar or Outlook.");
      if (current.guests > 0 && !(provider === "google" && destination.accountId === ref.accountId))
        throw new Error("Meetings with guests can only move between calendars of the same Google account.");
      if (provider === "google" && destination.accountId === ref.accountId) {
        const moved = await this.api(
          ref.accountId,
          "POST",
          `${this.google(ref.calendarId, ref.eventId)}/move?destination=${encodeURIComponent(destination.calendarId)}`,
          undefined,
          etag ? { "If-Match": etag } : {},
        );
        if (moved.status === 412) return this.conflictFor(ref);
        if (moved.status < 200 || moved.status >= 300) this.fail(moved.status, "move the event");
        target = { ...destination, eventId: String(moved.data?.id || ref.eventId) };
        etag = String(moved.data?.etag || "");
      } else {
        // Different account or Outlook (no move API): copy, then remove the original if unchanged.
        const copy = await this.createAt(
          destination.accountId,
          destination.calendarId,
          { ...current.view, ...changes },
          current.view.allDay,
        );
        const removed = await this.api(ref.accountId, "DELETE", this.eventUrl(ref), undefined, etag ? { "If-Match": etag } : {});
        if (removed.status === 412 || (removed.status >= 300 && removed.status !== 404 && removed.status !== 410)) {
          await this.api(copy.ref.accountId, "DELETE", this.eventUrl(copy.ref));
          if (removed.status === 412) return this.conflictFor(ref);
          this.fail(removed.status, "move the event");
        }
        await this.afterWrite(ref.accountId);
        if (destination.accountId !== ref.accountId) await this.afterWrite(destination.accountId);
        return { saved: this.publicView(copy.ref, copy.read) };
      }
    }
    const body = this.eventBody(provider, changes, current.view.allDay, recurrenceAnchor);
    if (Object.keys(body).length) {
      const { status, data } = await this.api(
        target.accountId,
        "PATCH",
        this.eventUrl(target),
        body,
        etag ? { "If-Match": etag } : {},
      );
      if (status === 412) return this.conflictFor(ref);
      if (status < 200 || status >= 300) this.fail(status, "save the event");
      void data;
    }
    const fresh = series || moving ? await this.readEvent(moving ? target : ref) : await this.readEvent(ref);
    await this.afterWrite(ref.accountId);
    return { saved: fresh ? this.publicView(moving ? target : ref, fresh) : null };
  }
  private async eventDelete(refRaw: unknown, baseRaw: unknown, scopeRaw: unknown) {
    const ref = this.eventRef(refRaw);
    this.assertWritable(ref.accountId, ref.calendarId);
    const current = await this.readEvent(ref);
    if (!current) return { deleted: true };
    const base = this.parseView(baseRaw, true);
    if (!this.sameView(base, current.view)) return { conflict: this.publicView(ref, current) };
    let target = ref,
      etag = current.etag;
    if (scopeRaw === "series" && current.recurring) {
      target = { ...ref, eventId: current.seriesId };
      const master = await this.readEvent(target);
      if (!master) return { deleted: true };
      etag = master.etag;
    }
    const { status } = await this.api(target.accountId, "DELETE", this.eventUrl(target), undefined, etag ? { "If-Match": etag } : {});
    if (status === 412) return this.conflictFor(ref);
    if (status !== 404 && status !== 410 && (status < 200 || status >= 300)) this.fail(status, "delete the event");
    await this.afterWrite(ref.accountId);
    return { deleted: true };
  }
}
