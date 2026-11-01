import { app, ipcMain, safeStorage, shell } from "electron";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { getWin } from "./main-window";
import { CalmCalendar } from "./calm-calendar";
/**
 * The launcher points XDG_CONFIG_HOME/XDG_DATA_HOME at the Calm Work profile, which
 * hides the user's default-browser setting from xdg-open. Open sign-in and service
 * pages with the user's real XDG environment so the normal browser is used.
 */
export const openInUserBrowser = async (url: string): Promise<void> => {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new Error("Only web pages can be opened.");
  // Test profiles must never open Ada's browser (e.g. a Google sign-in page).
  if (process.env.CALM_WORK_NO_BROWSER === "1")
    throw new Error("Opening the browser is disabled in this test profile.");
  const hostConfig = process.env.CALM_WORK_HOST_XDG_CONFIG_HOME;
  if (process.platform !== "linux" || !hostConfig) {
    await shell.openExternal(parsed.href);
    return;
  }
  const env: NodeJS.ProcessEnv = { ...process.env, XDG_CONFIG_HOME: hostConfig };
  if (process.env.CALM_WORK_HOST_XDG_DATA_HOME)
    env.XDG_DATA_HOME = process.env.CALM_WORK_HOST_XDG_DATA_HOME;
  else delete env.XDG_DATA_HOME;
  delete env.XDG_CACHE_HOME;
  await new Promise<void>((resolve, reject) => {
    const child = spawn("xdg-open", [parsed.href], { env, detached: true, stdio: "ignore" });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};
let registered = false;
export const initCalmCalendarBridge = (): void => {
  if (registered) return;
  registered = true;
  const calendar = new CalmCalendar({
    directory: join(app.getPath("userData"), "calm-device"),
    vault: {
      available: () =>
        safeStorage.isEncryptionAvailable() &&
        (process.platform !== "linux" ||
          safeStorage.getSelectedStorageBackend() !== "basic_text"),
      encrypt: (value) => safeStorage.encryptString(value),
      decrypt: (value) => safeStorage.decryptString(value),
    },
    openExternal: (url) => openInUserBrowser(url),
  });
  app.on("before-quit", () => calendar.cancel());
  ipcMain.handle("calm-calendar", async (event, input: unknown) => {
    const win = getWin();
    if (
      !win ||
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame
    )
      return { error: "Calendar request rejected." };
    if (!input || typeof input !== "object")
      return { error: "Invalid calendar request." };
    try {
      return await calendar.command(input);
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Calendar request failed.",
      };
    }
  });
};
