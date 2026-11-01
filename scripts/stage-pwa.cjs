#!/usr/bin/env node
// Stage a local production web build under output/pwa-public. This script does not upload.
// Some static hosts redirect /file.html to /file. That redirect fails inside the Calm
// renderer iframe, so the staged shell asks for the extensionless URL.
// The Electron app keeps the .html path.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "output/upstream/dist/browser");
const dest = path.join(root, "output/pwa-public");

if (!fs.existsSync(path.join(source, "index.html"))) {
  throw new Error("Missing production web build. Run the productionWeb build first.");
}
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(source, dest, {
  recursive: true,
  filter: (item) => !item.endsWith(".map"),
});

const chunk = fs
  .readdirSync(dest)
  .find((name) => name.startsWith("chunk-") && fs.readFileSync(path.join(dest, name), "utf8").includes("keyboard-review.html"));
if (!chunk) throw new Error("Calm shell chunk was not found.");
const main = fs
  .readdirSync(dest)
  .find((name) => name.startsWith("main-") && fs.readFileSync(path.join(dest, name), "utf8").includes(chunk));
if (!main) throw new Error("Main bundle was not found.");

const nextChunk = "chunk-CALMWEB01.js";
const nextMain = "main-CALMWEB01.js";
fs.writeFileSync(
  path.join(dest, nextChunk),
  fs.readFileSync(path.join(dest, chunk), "utf8").replaceAll(
    "assets/calm/keyboard-review.html",
    "assets/calm/keyboard-review",
  ),
);
fs.rmSync(path.join(dest, chunk));
fs.writeFileSync(
  path.join(dest, nextMain),
  fs.readFileSync(path.join(dest, main), "utf8").replaceAll(`./${chunk}`, `./${nextChunk}`),
);
fs.rmSync(path.join(dest, main));

// Calm Work icon set (apps/mobile/pwa-icons, rendered by scripts/make-pwa-icons.sh).
const iconSource = path.join(root, "apps/mobile/pwa-icons");
const iconTarget = path.join(dest, "assets/icons");
const iconVersion = crypto.createHash("sha256").update(fs.readFileSync(path.join(iconSource, "calm-icon.svg"))).digest("hex").slice(0, 12);
const iconUrls = new Map();
const versionIcon = (name) => name.replace(/(\.[^.]+)$/, `-${iconVersion}$1`);
for (const [from, to] of [
  ["apple-touch-icon.png", "apple-touch-icon.png"],
  ["icon-72.png", "icon-72x72.png"],
  ["icon-96.png", "icon-96x96.png"],
  ["icon-128.png", "icon-128x128.png"],
  ["icon-144.png", "icon-144x144.png"],
  ["icon-192.png", "icon-192x192.png"],
  ["icon-512.png", "icon-512x512.png"],
  ["icon-maskable-512.png", "icon-maskable-512x512.png"],
  ["favicon-16.png", "favicon-16x16.png"],
  ["favicon-32.png", "favicon-32x32.png"],
  ["favicon-192.png", "favicon-192x192.png"],
  ["calm-icon.svg", "calm-icon.svg"],
]) {
  const versioned = versionIcon(to);
  fs.copyFileSync(path.join(iconSource, from), path.join(iconTarget, versioned));
  iconUrls.set(`/assets/icons/${to}`, `/assets/icons/${versioned}`);
}
fs.copyFileSync(path.join(iconSource, "favicon.ico"), path.join(dest, versionIcon("favicon.ico")));
fs.rmSync(path.join(dest, "favicon.ico"), { force: true });
iconUrls.set("/favicon.ico", "/" + versionIcon("favicon.ico"));

let index = fs.readFileSync(path.join(dest, "index.html"), "utf8").replaceAll(main, nextMain);
const release = new Date().toISOString();
index = index.replace('</head>', `<meta name="calm-release" content="${release}"></head>`);
for (const [from, to] of iconUrls) index = index.replaceAll(`href="${from.slice(1)}"`, `href="${to.slice(1)}"`);
// The upstream head carries two theme colours; keep one, in the Calm canvas colour.
index = index.replace(/<meta content="#0b77d2" name="theme-color">\s*/g, "");
index = index.replace(/<meta name="theme-color" content="#131314">\s*/g, "");
if (!index.includes('name="robots"')) {
  index = index.replace(
    "<title>Calm Work</title>",
    `<title>Calm Work</title>
    <meta name="robots" content="noindex, nofollow">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="Calm Work">
    <meta name="theme-color" content="#101010">
    <meta name="format-detection" content="telephone=no">
    <style>html,body{background:#101010!important;margin:0;overscroll-behavior:none}</style>`,
  );
}
// Dark launch images, so a Home Screen start does not flash white. Safari fetches them on install only.
const splashSource = path.join(iconSource, "splash");
const splashLinks = [];
for (const name of fs.readdirSync(splashSource).sort()) {
  const match = name.match(/^launch-(\d+)x(\d+)@(\d)x-(portrait|landscape)\.png$/);
  if (!match) continue;
  const [, width, height, scale, orientation] = match;
  const versioned = versionIcon(name);
  fs.copyFileSync(path.join(splashSource, name), path.join(iconTarget, versioned));
  splashLinks.push(
    `<link rel="apple-touch-startup-image" media="screen and (device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation})" href="assets/icons/${versioned}">`,
  );
}
index = index.replace("</head>", `${splashLinks.join("\n    ")}\n</head>`);
// Paint the last phone screen, saved by the runtime when the app was hidden, until the live renderer is ready.
const launchSnapshot = `<script>(function () {
  try {
    if (!matchMedia("(pointer: coarse)").matches) return;
    var s = JSON.parse(localStorage.getItem("calm-launch-snapshot") || "null");
    if (!s || !s.html || s.viewport[0] !== innerWidth || Math.abs(s.viewport[1] - innerHeight) > 2) return;
    var cover = document.createElement("div");
    cover.setAttribute("aria-hidden", "true");
    cover.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#101010";
    var frame = document.createElement("iframe");
    frame.tabIndex = -1;
    frame.style.cssText = "position:absolute;border:0;top:" + s.rect.top + "px;left:" + s.rect.left + "px;width:" + s.rect.width + "px;height:" + s.rect.height + "px";
    var attrs = s.attrs.map(function (a) { return a[0] + '="' + String(a[1]).replace(/"/g, "&quot;") + '"'; }).join(" ");
    frame.srcdoc = '<!doctype html><html style="zoom:' + (s.zoom || 1) + '"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/calm/keyboard-review.css"></head><body ' + attrs + ">" + s.html + "</body></html>";
    cover.appendChild(frame);
    document.body.appendChild(cover);
    var started = Date.now();
    var poll = setInterval(function () {
      var live = document.querySelector("calm-shell iframe");
      var doc = live && live.contentDocument;
      if ((doc?.documentElement && (doc.documentElement.dataset.calmReady === "true" || doc.querySelector("main[role=alert]"))) || Date.now() - started > 15000) {
        clearInterval(poll);
        requestAnimationFrame(function () { cover.remove(); });
      }
    }, 50);
  } catch (e) {}
})();</script>`;
index = index.replace(/<body([^>]*)>/, (tag) => `${tag}\n${launchSnapshot}`);
// iOS 26 draws a Home Screen app 62pt short when the page has a manifest or a translucent status bar.
// Without them it still opens standalone and fills the screen below an opaque status bar.
index = index.replace(/<link href="manifest.json" rel="manifest">\s*/, "");
fs.writeFileSync(path.join(dest, "index.html"), index);

const manifest = JSON.parse(fs.readFileSync(path.join(dest, "manifest.json"), "utf8"));
manifest.name = "Calm Work";
manifest.short_name = "Calm";
manifest.theme_color = "#101010";
manifest.background_color = "#101010";
manifest.id = "/";
manifest.start_url = "./";
manifest.scope = "./";
manifest.display = "standalone";
manifest.orientation = "any";
manifest.description = "Add tasks, track time and clean up your list. Syncs with Calm Work on your computer.";
manifest.icons = [72, 96, 128, 144, 192, 512].map((size) => ({
  src: `assets/icons/${versionIcon(`icon-${size}x${size}.png`)}`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose: "any",
}));
manifest.icons.push({
  src: `assets/icons/${versionIcon("icon-maskable-512x512.png")}`,
  sizes: "512x512",
  type: "image/png",
  purpose: "maskable",
});
fs.writeFileSync(path.join(dest, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
fs.writeFileSync(path.join(dest, "robots.txt"), "User-agent: *\nDisallow: /\n");
fs.writeFileSync(
  path.join(dest, "_headers"),
  `/*
  X-Robots-Tag: noindex, nofollow
  Referrer-Policy: no-referrer

/ngsw-worker.js
  Cache-Control: no-cache

/ngsw.json
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache
`,
);

const ngswPath = path.join(dest, "ngsw.json");
const ngsw = JSON.parse(fs.readFileSync(ngswPath, "utf8"));
const retarget = (url) => iconUrls.get(url) || url.replaceAll(chunk, nextChunk).replaceAll(main, nextMain);
ngsw.hashTable = Object.fromEntries(Object.entries(ngsw.hashTable).map(([url, hash]) => [retarget(url), hash]));
for (const group of ngsw.assetGroups) group.urls = group.urls.map(retarget);
ngsw.navigationUrls.push({ positive: false, regex: "^\\/assets\\/calm(?:\\/.*)?$" });
// Everything above changed files after Angular hashed them. Re-hash every listed file
// so the service worker does not reject the update as corrupted.
for (const url of Object.keys(ngsw.hashTable)) {
  const file = path.join(dest, decodeURIComponent(url));
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    ngsw.hashTable[url] = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
}
for (const name of [nextChunk, nextMain, "index.html", "manifest.json"]) {
  ngsw.hashTable["/" + name] = crypto.createHash("sha1").update(fs.readFileSync(path.join(dest, name))).digest("hex");
}
// Include every newly named icon in the worker integrity table and offline cache.
const iconAssets = [...iconUrls.values()];
for (const url of iconAssets) ngsw.hashTable[url] = crypto.createHash("sha1").update(fs.readFileSync(path.join(dest, url))).digest("hex");
ngsw.assetGroups.push({ name: "calm-icons", installMode: "prefetch", updateMode: "prefetch", urls: iconAssets, patterns: [] });
fs.writeFileSync(ngswPath, JSON.stringify(ngsw));

// Angular's worker took 2.5 s to start on an iPhone before the page was even requested,
// then routed every chunk through its version logic. This worker keeps the same file name,
// so the upstream registration is unchanged, and serves straight from one cache.
const precache = new Set(["/"]);
for (const group of ngsw.assetGroups) {
  if (group.installMode !== "prefetch") continue;
  for (const url of group.urls) {
    if (url === "/index.html") continue;
    // Pages redirects .html to the extensionless URL, and a redirected response cannot answer a navigation.
    precache.add(url === "/assets/calm/keyboard-review.html" ? "/assets/calm/keyboard-review" : url);
  }
}
for (const name of fs.readdirSync(path.join(dest, "assets/calm"))) {
  if (fs.statSync(path.join(dest, "assets/calm", name)).isFile())
    precache.add(`/assets/calm/${name === "keyboard-review.html" ? "keyboard-review" : name}`);
}
for (const url of precache) {
  const file = url === "/" ? "index.html" : url === "/assets/calm/keyboard-review" ? "assets/calm/keyboard-review.html" : decodeURIComponent(url.slice(1));
  if (!fs.existsSync(path.join(dest, file))) throw new Error(`Precache entry is missing from the build: ${url}`);
}
fs.writeFileSync(
  path.join(dest, "ngsw-worker.js"),
  `// Calm Work offline worker, release ${release}. Generated by scripts/stage-pwa.cjs.
const CACHE = "calm-${release}";
const PRECACHE = ${JSON.stringify([...precache])};
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // Keep the previous release, so a page still running it can load its own chunks.
    const previous = names.filter((name) => name.startsWith("calm-") && name !== CACHE).sort().slice(-1);
    await Promise.all(names.filter((name) => name !== CACHE && !previous.includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});
const fromCache = async (request, key) => {
  const current = await caches.open(CACHE);
  const hit = (await current.match(key, { ignoreSearch: true })) || (await caches.match(key, { ignoreSearch: true }));
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic" && !response.redirected) current.put(key, response.clone());
  return response;
};
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname === "/ngsw-worker.js" || url.pathname === "/ngsw.json") return;
  if (request.mode === "navigate" && !url.pathname.startsWith("/assets/")) {
    event.respondWith(fromCache(request, "/").catch(() => fetch(request)));
    return;
  }
  const key = url.pathname === "/assets/calm/keyboard-review.html" ? "/assets/calm/keyboard-review" : url.pathname;
  event.respondWith(fromCache(request, key));
});
// Answer Angular's SwUpdate, whose update check otherwise waits 8 s before the first sync.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (!["CHECK_FOR_UPDATES", "ACTIVATE_UPDATE"].includes(data.action)) return;
  if (data.action === "CHECK_FOR_UPDATES") self.registration.update().catch(() => {});
  event.source?.postMessage({ type: "OPERATION_COMPLETED", nonce: data.nonce, result: data.action === "ACTIVATE_UPDATE" });
});
`,
);
console.log(`Staged PWA at ${dest}`);
