#!/usr/bin/env node
// Apply the small tracked Angular overlay to the pinned, full-history checkout.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const upstream = path.join(root, "output/upstream");
const pin = JSON.parse(
  fs.readFileSync(path.join(root, "upstream.json")),
).commit;
// The build shell verifies the same pin first and passes it through. This
// avoids nested git child processes in locked-down Linux build environments.
const currentCommit =
  process.env.CALM_VERIFIED_UPSTREAM_COMMIT ||
  execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: upstream,
    encoding: "utf8",
  }).trim();
if (currentCommit !== pin)
  throw new Error(
    "Upstream pin differs; inspect the checkout before applying the overlay.",
  );
execFileSync(
  process.execPath,
  [path.join(root, "scripts/prepare-reviewed-renderer.cjs")],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  [path.join(root, "scripts/prepare-desktop.cjs")],
  { stdio: "inherit" },
);
const source = path.join(root, "apps/desktop/calm-shell");
const target = path.join(upstream, "src/app/features/calm-shell");
fs.mkdirSync(target, { recursive: true });
for (const name of fs.readdirSync(source))
  if (/\.(ts|html|scss)$/.test(name) && name !== "calm-tokens.scss")
    fs.copyFileSync(path.join(source, name), path.join(target, name));
function edit(relative, transform) {
  const file = path.join(upstream, relative);
  fs.writeFileSync(file, transform(fs.readFileSync(file, "utf8")));
}
edit("src/app/app.routes.ts", (text) =>
  text.includes("path: 'calm'")
    ? text
    : text.replace(
        "export const APP_ROUTES: Routes = [",
        `export const APP_ROUTES: Routes = [\n  { path: '', pathMatch: 'full', redirectTo: 'calm' },\n  { path: 'calm', loadComponent: () => import('./features/calm-shell/calm-shell.component').then(m => m.CalmShellComponent), data: { page: 'calm' } },`,
      ),
);
edit("src/app/app.component.ts", (text) =>
  text.includes("readonly calmRouter")
    ? text
    : text
        .replace(
          "import { ActivatedRoute, RouterOutlet }",
          "import { ActivatedRoute, Router, RouterOutlet }",
        )
        .replace("export class AppComponent", "export class AppComponent")
        .replace(
          "  private _taskService = inject(TaskService);",
          "  readonly calmRouter = inject(Router);\n  private _taskService = inject(TaskService);",
        ),
);
edit("src/app/app.component.html", (text) =>
  text.includes("calmRouter.url.startsWith('/calm')")
    ? text
    : text.replace(
        "@if (isShowFocusOverlay()) {",
        "@if (calmRouter.url.startsWith('/calm')) {\n  <router-outlet></router-outlet>\n} @else if (isShowFocusOverlay()) {",
      ),
);
// The dedicated Calm host starts empty, without changing other upstream hosts.
edit("src/app/core/example-tasks/example-tasks.service.ts", (text) =>
  text.includes("dataset.calmHost")
    ? text
    : text.replace(
        "  constructor() {",
        "  constructor() {\n    if (document.documentElement.dataset.calmHost === 'true') return;",
      ),
);
// Before the initial redirect resolves, do not briefly render the upstream shell.
edit("src/app/app.component.html", (text) =>
  text.replace(
    "@if (calmRouter.url.startsWith('/calm')) {",
    "@if (calmRouter.url === '/' || calmRouter.url.startsWith('/calm')) {",
  ),
);
const languagePath = path.join(upstream, "src/assets/i18n/en.json");
const language = JSON.parse(fs.readFileSync(languagePath));
language.CALM = JSON.parse(fs.readFileSync(path.join(source, "en.json")));
fs.writeFileSync(languagePath, JSON.stringify(language, null, 2) + "\n");
execFileSync(process.execPath, ["tools/extract-i18n-single.js"], {
  cwd: upstream,
  stdio: "ignore",
});
fs.copyFileSync(
  path.join(source, "calm-tokens.scss"),
  path.join(upstream, "src/styles/_calm-tokens.scss"),
);
edit("src/styles.scss", (text) =>
  text.includes("@use './styles/calm-tokens'")
    ? text
    : "@use './styles/calm-tokens';\n" + text,
);
edit("src/app/features/tasks/store/task-ui.effects.ts", (text) =>
  text.includes("Calm renderer owns capture feedback")
    ? text.replace(
        "!this._router.url.startsWith('/calm')",
        "!this._router.url?.startsWith('/calm')",
      )
    : text.replace(
        "ofType(TaskSharedActions.addTask),\n        // Skip the created snack",
        "ofType(TaskSharedActions.addTask),\n        // Calm renderer owns capture feedback; retain upstream feedback elsewhere.\n        filter(() => !this._router.url?.startsWith('/calm')),\n        // Skip the created snack",
      ),
);
// Calm Work owns contextual project feedback; upstream routes keep theirs.
edit("src/app/features/project/store/project.effects.ts", (text) => {
  if (!text.includes("private _calmRouter"))
    text =
      "import { Router } from '@angular/router';\n" +
      text.replace(
        "export class ProjectEffects {",
        "export class ProjectEffects {\n  private _calmRouter = inject(Router, { optional: true });",
      );
  if (!text.includes("Calm renderer owns project feedback"))
    text = text
      .replace(
        "filter((a) => !a.isSkipSnack),",
        "filter((a) => !a.isSkipSnack),\n        // Calm renderer owns project feedback.\n        filter(() => !this._calmRouter?.url?.startsWith('/calm')),",
      )
      .replace(
        "ofType(addProject.type),",
        "ofType(addProject.type),\n        filter(() => !this._calmRouter?.url?.startsWith('/calm')),",
      );
  return text;
});
const wiki = path.join(upstream, "docs/wiki/Calm-Work-Core.md");
edit("src/app/core-ui/shortcut/shortcut.service.ts", (text) =>
  text.includes("if (this._router.url.startsWith('/calm')) return;")
    ? text
    : text.replace(
        "  async handleKeyDown(ev: KeyboardEvent): Promise<void> {",
        "  async handleKeyDown(ev: KeyboardEvent): Promise<void> {\n    if (this._router.url.startsWith('/calm')) return;",
      ),
);
edit("src/app/app.component.html", (text) =>
  text.replaceAll(
    "@if (layoutService.isShowAddTaskBar()) {",
    "@if (layoutService.isShowAddTaskBar() && !calmRouter.url.startsWith('/calm')) {",
  ),
);
edit("src/app/app.component.html", (text) =>
  text.replace(
    "@if (onboardingHintService.currentStep()) {",
    "@if (onboardingHintService.currentStep() && !calmRouter.url.startsWith('/calm')) {",
  ),
);
fs.copyFileSync(path.join(root, "docs/PRODUCT.md"), wiki);
for (const [file, marker] of [
  ["src/app/app.routes.ts", "path: 'calm'"],
  ["src/app/app.component.ts", "readonly calmRouter"],
  [
    "src/app/app.component.html",
    "layoutService.isShowAddTaskBar() && !calmRouter.url.startsWith('/calm')",
  ],
  [
    "src/app/core-ui/shortcut/shortcut.service.ts",
    "if (this._router.url.startsWith('/calm')) return;",
  ],
]) {
  if (!fs.readFileSync(path.join(upstream, file), "utf8").includes(marker))
    throw new Error("Overlay marker missing: " + file);
}

// Calm owns attention and tracking; retain upstream prompts for upstream hosts only.
for (const [relative, entry] of [
  [
    "src/app/features/take-a-break/take-a-break.service.ts",
    "  constructor() {",
  ],
  [
    "src/app/features/tracking-reminder/tracking-reminder.service.ts",
    "  init(): void {",
  ],
  ["src/app/features/reminder/reminder.service.ts", "  init(): void {"],
]) {
  edit(relative, (text) =>
    text.includes("// Calm host owns reminders")
      ? text
      : text.replace(
          entry,
          entry +
            "\n    // Calm host owns reminders; keep upstream implementation available.\n    if (document.documentElement.dataset.calmHost === 'true') return;",
        ),
  );
}
edit("src/app/features/idle/store/idle.effects.ts", (text) => {
  if (!text.includes("// Calm host owns idle accounting"))
    text = text.replace(
      "!isEnableIdleTimeTracking\n",
      "// Calm host owns idle accounting; never subtract time or interrupt its renderer.\n          (document.documentElement.dataset.calmHost === 'true' || !isEnableIdleTimeTracking)\n",
    );
  for (const action of ["triggerIdle"]) {
    const original = `ofType(${action}),`;
    const guarded =
      original +
      "\n      filter(() => document.documentElement.dataset.calmHost !== 'true'),";
    if (!text.includes(guarded)) text = text.replace(original, guarded);
  }
  text = text.replace(
    "filter(() => !this._isDialogOpen),",
    "filter(() => document.documentElement.dataset.calmHost !== 'true' && !this._isDialogOpen),",
  );
  return text;
});
// Calm reports browser storage protection in its own nonblocking UI.
edit("src/app/core/startup/startup.service.ts", (text) =>
  (text.includes("// Calm owns browser storage feedback") ? text : text.replace(
    "  private _requestPersistence(): void {",
    "  private _requestPersistence(): void {\n    // Calm owns browser storage feedback; keep upstream behavior elsewhere.\n    if (document.documentElement.dataset.calmHost === 'true') return;",
  )).replace("'storage' in navigator && 'estimate' in navigator.storage", "navigator.storage && 'estimate' in navigator.storage"),
);
console.log("Prepared Calm Work Angular overlay at pinned upstream commit.");
