import { openInUserBrowser } from './calm-calendar-bridge';
import { app, ipcMain, safeStorage } from 'electron';
import { join } from 'node:path';
import { getWin } from './main-window';
import { CalmTeam } from './calm-team';
let registered = false;
export function initCalmTeamBridge(): void {
  if (registered) return;
  registered = true;
  const team = new CalmTeam({
    directory: join(app.getPath('userData'), 'calm-device'),
    vault: {
      available: () =>
        safeStorage.isEncryptionAvailable() &&
        (process.platform !== 'linux' ||
          safeStorage.getSelectedStorageBackend() !== 'basic_text'),
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value),
    },
    openExternal: (url) => openInUserBrowser(url),
  });
  ipcMain.handle('calm-team', async (event, input: unknown) => {
    const win = getWin();
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      return { error: 'Shared workspace request rejected.' };
    if (!input || typeof input !== 'object')
      return { error: 'Invalid shared workspace request.' };
    try {
      return await team.command(input);
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : 'Shared workspace request failed.',
      };
    }
  });
}
