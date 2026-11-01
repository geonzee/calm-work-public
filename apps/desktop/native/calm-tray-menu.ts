import { ipcMain, Menu } from 'electron';
import { closeWinAndQuit, getWin } from './main-window';

interface AgendaItem {
  id: string;
  title: string;
  time: string;
  kind: 'task' | 'event';
}
interface TrayState {
  active: {
    id: string;
    title: string;
    running: boolean;
    minutes: number;
  } | null;
  agenda: AgendaItem[];
}
let state: TrayState = { active: null, agenda: [] };
let registered = false;
let hasCalmState = false;
export const getCalmTrayStatus = (fallback = 'Calm Work'): string =>
  !hasCalmState
    ? fallback || 'Calm Work'
    : state.active
      ? `${state.active.running ? 'Recording' : 'Paused'} · ${state.active.title} · ${state.active.minutes} min`
      : 'Calm Work';
const label = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/[\r\n\t]/g, ' ').slice(0, 180) : '';

// Accept only the main app renderer. The isolated task iframe cannot send IPC directly.
export const initCalmTrayBridge = (refresh: (status: string) => void): void => {
  if (registered) return;
  registered = true;
  ipcMain.on('calm-tray-state', (event, value: unknown) => {
    const win = getWin();
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      return;
    if (!value || typeof value !== 'object') return;
    const input = value as Partial<TrayState>;
    if (!Array.isArray(input.agenda)) return;
    hasCalmState = true;
    state = {
      active:
        input.active && typeof input.active === 'object' && label(input.active.id)
          ? {
              id: label(input.active.id),
              title: label(input.active.title),
              running: input.active.running === true,
              minutes: Number.isFinite(input.active.minutes)
                ? Math.max(0, Math.floor(input.active.minutes))
                : 0,
            }
          : null,
      agenda: input.agenda
        .slice(0, 200)
        .filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            (item.kind === 'task' || item.kind === 'event') &&
            label(item.id),
        )
        .map((item) => ({
          id: label(item.id),
          title: label(item.title),
          time: label(item.time),
          kind: item.kind,
        })),
    };
    refresh(getCalmTrayStatus());
  });
};
const action = (type: string, id?: string): void => {
  getWin()?.webContents.send('calm-tray-action', { type, id });
};

// Native close handshake persists and pauses; hiding deliberately keeps recording.
export const createCalmTrayMenu = (show: () => void, quit: () => void): Menu => {
  const active = state.active;
  return Menu.buildFromTemplate([
    {
      id: 'calm-title',
      label: active
        ? `${active.running ? '● Recording' : 'Ⅱ Paused'} · ${active.minutes} min`
        : 'Calm Work',
      enabled: false,
    },
    ...(active
      ? [
          { label: active.title, enabled: false },
          {
            id: 'calm-toggle',
            label: active.running ? 'Pause recording' : 'Resume recording',
            click: () => action('toggle', active?.id),
          },
          {
            id: 'calm-complete',
            label: 'Complete task',
            click: () => action('complete', active?.id),
          },
        ]
      : []),
    { type: 'separator' },
    { label: 'Today · planned tasks and events', enabled: false },
    ...(state.agenda.length
      ? state.agenda.map((item, index) => ({
          id: `calm-agenda-${index}`,
          label: `${item.time || 'Any time'} · ${item.title}${item.kind === 'event' ? ' (event)' : ''}`,
          ...(item.kind === 'event'
            ? {
                click: () => {
                  show();
                  action('event', item.id);
                },
              }
            : {
                submenu: [
                  {
                    label: active?.id === item.id ? 'Resume recording' : 'Start tracking',
                    enabled: !(active?.id === item.id && active.running),
                    click: () => action('start', item.id),
                  },
                  {
                    label: 'Show in Track',
                    click: () => {
                      show();
                      action('task', item.id);
                    },
                  },
                ],
              }),
        }))
      : [{ label: 'Nothing planned for today', enabled: false }]),
    { type: 'separator' },
    { id: 'calm-open', label: 'Open Calm Work', click: show },
    { id: 'calm-hide', label: 'Hide Calm Work', click: () => getWin()?.hide() },
    { type: 'separator' },
    {
      id: 'calm-quit',
      label: 'Quit Calm Work',
      click: () => closeWinAndQuit(quit),
    },
  ]);
};
