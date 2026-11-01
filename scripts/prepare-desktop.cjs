// Reproducible native identity/tray overlay; retain the pinned upstream lifecycle.
const fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, ".."),
  upstream = path.join(root, "output/upstream");
const ts = require(path.join(upstream, "node_modules/typescript"));
function edit(file, transform) {
  const target = path.join(upstream, file);
  fs.writeFileSync(target, transform(fs.readFileSync(target, "utf8")));
}
fs.copyFileSync(
  path.join(root, "apps/desktop/native/calm-tray-menu.ts"),
  path.join(upstream, "electron/calm-tray-menu.ts"),
);
edit("electron/start-app.ts", (text) =>
  text
    .replace(
      "const APP_DISPLAY_NAME = 'Super Productivity';",
      "const APP_DISPLAY_NAME = 'Calm Work';",
    )
    .replace("openFolderWhenDone: true,", "openFolderWhenDone: false,")
    .replace(
      "const LINUX_DESKTOP_NAME = 'superproductivity.desktop';",
      "const LINUX_DESKTOP_NAME = 'calm-work.desktop';",
    ),
);
// en-GB dates and 24-hour time everywhere, including native date/time pickers.
edit("electron/start-app.ts", (text) =>
  text.includes("appendSwitch('lang', 'en-GB')")
    ? text
    : text.replace(
        "  app.commandLine.appendSwitch('enable-speech-dispatcher');",
        "  app.commandLine.appendSwitch('enable-speech-dispatcher');\n  // Calm Work: en-GB dates and 24-hour time, including native pickers.\n  app.commandLine.appendSwitch('lang', 'en-GB');",
      ),
);
// The Calm host ignores idle time (no idle prompts or idle accounting), so do
// not poll loginctl/xprintidle every 30 seconds for nothing.
edit("electron/start-app.ts", (text) => {
  if (text.includes("CALM_IDLE_POLLING_OFF")) return text;
  const start = "    const stopIdleChecks: () => void = lazySetInterval(async (): Promise<void> => {";
  if (!text.includes(start)) throw new Error("Idle polling hook not found");
  return text
    .replace(
      "    // --------IDLE HANDLING---------",
      "    // --------IDLE HANDLING---------\n    // CALM_IDLE_POLLING_OFF: the Calm host disables idle prompts and idle accounting.\n    const calmIdlePollingOff = true;",
    )
    .replace(
      start,
      "    const stopIdleChecks: () => void = calmIdlePollingOff\n      ? () => undefined\n      : lazySetInterval(async (): Promise<void> => {",
    )
    .replace(
      "      `🚀 Starting idle time tracking (interval: ${CONFIG.IDLE_PING_INTERVAL}ms, threshold: ${CONFIG.MIN_IDLE_TIME}ms)`,",
      "      calmIdlePollingOff\n        ? 'Idle polling off: Calm Work does not use idle prompts.'\n        : `🚀 Starting idle time tracking (interval: ${CONFIG.IDLE_PING_INTERVAL}ms, threshold: ${CONFIG.MIN_IDLE_TIME}ms)`,",
    );
});
edit("electron/main-window.ts", (text) =>
  text.replace(
    "title: IS_DEV ? 'Super Productivity D' : 'Super Productivity',",
    "title: 'Calm Work',",
  ),
);
edit("electron/CONFIG.ts", (text) =>
  text.replace(
    "D_BUS_ID: 'com.super.productivity.service'",
    "D_BUS_ID: 'com.calmwork.desktop'",
  ),
);
edit("electron/protocol-handler.ts", (text) =>
  text
    .replaceAll("'superproductivity'", "'calm-work'")
    .replaceAll("'superproductivity://'", "'calm-work://'"),
);
edit("src/index.html", (text) => {
  text = text.replace(
    "<title>Super Productivity</title>",
    "<title>Calm Work</title>",
  );
  text = text.replace(
    '<html lang="en">',
    '<html lang="en" data-calm-host="true">',
  );
  // Replace only the upstream splash, not the app's storage/bootstrap lifecycle.
  text = text.replace(
    /<style type="text\/css">[\s\S]*?<\/style>/,
    `<style type="text/css">
    html, body { margin: 0; background: #101010; color: #a9a39d; font: 14px system-ui, sans-serif; }
    .calm-boot { display: grid; place-content: center; min-height: 100dvh; margin: 0; font-weight: 400; }
  </style>`,
  );
  text = text.replace(
    /<app-root>[\s\S]*?<\/app-root>/,
    '<app-root><p class="calm-boot" role="status">Opening Calm Work…</p></app-root>',
  );
  text = text.replace(
    /\n    <script>[\s\S]*?<\/script>/,
    `<script>
    if (typeof structuredClone !== 'function') {
      document.querySelector('.calm-boot').textContent = 'Update your browser to open Calm Work.';
    }
  </script>`,
  );
  if (
    !text.includes("<app-root>") ||
    !text.includes('role="status">Opening Calm Work') ||
    text.includes("var productivityTips")
  )
    throw new Error("Calm Work startup overlay did not apply cleanly");
  return text;
});
edit("src/app/core/browser-title/browser-title.service.ts", (text) =>
  text.replace(
    "private readonly _baseTitle = 'Super Productivity';",
    "private readonly _baseTitle = 'Calm Work';",
  ),
);
edit("electron/indicator.ts", (text) => {
  text = text.replace(
    "import { createCalmTrayMenu } from './calm-tray-menu';\n",
    "",
  );
  if (
    !text.includes(
      "import { createCalmTrayMenu, initCalmTrayBridge, getCalmTrayStatus }",
    )
  )
    text =
      "import { createCalmTrayMenu, initCalmTrayBridge, getCalmTrayStatus } from './calm-tray-menu';\n" +
      text;
  if (!text.includes("initCalmTrayBridge((status)"))
    text = text.replace(
      "  initAppListeners(app);",
      `  initCalmTrayBridge((status) => {
    if (tray) {
      tray.setContextMenu(createContextMenu());
      tray.setToolTip(status);
    }
  });
  initAppListeners(app);`,
    );
  const source = ts.createSourceFile(
    "indicator.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const fn = source.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) && node.name?.text === "createContextMenu",
  );
  if (!fn) throw new Error("Native tray menu function missing");
  text =
    text.slice(0, fn.getStart(source)) +
    "function createContextMenu(_msg?: string): Menu {\n  return createCalmTrayMenu(_showApp, _quitApp);\n}" +
    text.slice(fn.end);
  return text
    .replace(
      "indicatorConfig?.showApp();",
      "nextTray.popUpContextMenu(createContextMenu());",
    )
    .replaceAll("setToolTip('')", "setToolTip(getCalmTrayStatus())")
    .replaceAll("setToolTip('Calm Work')", "setToolTip(getCalmTrayStatus())")
    .replaceAll("setToolTip(trayMsg)", "setToolTip(getCalmTrayStatus())")
    .replaceAll(
      "setToolTip(getCalmTrayStatus())",
      "setToolTip(getCalmTrayStatus(trayMsg))",
    );
});
const icon = path.join(root, "apps/desktop/linux/calm-work.png");
fs.copyFileSync(
  icon,
  path.join(upstream, "electron/assets/icons/icon_256x256.png"),
);
for (const name of ["stopped-l", "stopped-d", "running-l", "running-d"])
  for (const suffix of [".png", "@2x.png"])
    fs.copyFileSync(
      path.join(root, "apps/desktop/linux/calm-work-tray" + suffix),
      path.join(upstream, "electron/assets/icons/indicator", name + suffix),
    );
console.log("Prepared Calm Work native identity and Open/Hide/Quit tray menu.");

edit("electron/preload.ts", (text) => {
  if (text.includes("exposeInMainWorld('calmTray'")) return text;
  return (
    text +
    `
// Narrow, isolated bridge for the Calm host; no generic IPC surface.
contextBridge.exposeInMainWorld('calmTray', {
  update: (state: unknown) => ipcRenderer.send('calm-tray-state', state),
  onAction: (listener: (action: { type: string; id?: string }) => void) => {
    const handler = (_event: unknown, action: { type: string; id?: string }): void => listener(action);
    ipcRenderer.on('calm-tray-action', handler);
    return () => ipcRenderer.removeListener('calm-tray-action', handler);
  },
});
`
  );
});

// SP's plugin OAuth (Google Calendar sign-in) must open Ada's normal browser, not
// the profile-scoped XDG default, exactly like Calm Work's own sign-ins.
edit("electron/plugin-oauth.ts", (text) => {
  if (!text.includes("import { openInUserBrowser }"))
    text = "import { openInUserBrowser } from './calm-calendar-bridge';\n" + text;
  return text.replace("    shell.openExternal(url).catch(", "    openInUserBrowser(url).catch(");
});
for (const file of ["calm-calendar.ts", "calm-calendar-bridge.ts"])
  fs.copyFileSync(
    path.join(root, "apps/desktop/native", file),
    path.join(upstream, "electron", file),
  );
edit("electron/indicator.ts", (text) => {
  if (!text.includes("import { initCalmCalendarBridge }"))
    text =
      "import { initCalmCalendarBridge } from './calm-calendar-bridge';\n" +
      text;
  return text.includes("  initCalmCalendarBridge();")
    ? text
    : text.replace(
        "  initCalmTrayBridge((status)",
        "  initCalmCalendarBridge();\n  initCalmTrayBridge((status)",
      );
});
edit("electron/preload.ts", (text) =>
  text.includes("exposeInMainWorld('calmCalendar'")
    ? text
    : text +
      `
contextBridge.exposeInMainWorld('calmCalendar', {
  command: (input: unknown) => ipcRenderer.invoke('calm-calendar', input),
});
`,
);

for (const file of ["calm-team.ts", "calm-team-bridge.ts"])
  fs.copyFileSync(
    path.join(root, "apps/desktop/native", file),
    path.join(upstream, "electron", file),
  );
edit("electron/indicator.ts", (text) => {
  if (!text.includes("import { initCalmTeamBridge }"))
    text = "import { initCalmTeamBridge } from './calm-team-bridge';\n" + text;
  return text.includes("  initCalmTeamBridge();")
    ? text
    : text.replace(
        "  initCalmCalendarBridge();",
        "  initCalmCalendarBridge();\n  initCalmTeamBridge();",
      );
});
edit("electron/preload.ts", (text) =>
  text.includes("exposeInMainWorld('calmTeam'")
    ? text
    : text +
      `
contextBridge.exposeInMainWorld('calmTeam', {
  command: (input: unknown) => ipcRenderer.invoke('calm-team', input),
});
`,
);

// Calm's header/tray own recording controls; never open SP's floating widget.
edit("electron/task-widget/task-widget.ts", (text) => {
  if (!text.includes("  app,\n"))
    text = text.replace(
      "import {\n  BrowserWindow,",
      "import {\n  app,\n  BrowserWindow,",
    );
  const enable =
    "export const updateTaskWidgetEnabled = (isEnabled: boolean): void => {";
  if (!text.includes("// Calm owns compact tracking"))
    text = text.replace(
      enable,
      enable +
        "\n  // Calm owns compact tracking; retain SP widget code for other hosts.\n  if (app.getName() === 'Calm Work') { destroyTaskWidget(); return; }",
    );
  const create = "const createTaskWidgetWindow = (): Promise<void> => {";
  if (!text.includes("// No floating SP window"))
    text = text.replace(
      create,
      create +
        "\n  // No floating SP window, including shortcut and restored-preference paths.\n  if (app.getName() === 'Calm Work') return Promise.resolve();",
    );
  return text;
});
