// Cache only the UI shell, never authenticated API responses or member capabilities.
const shell = "calm-online-shell-v2";
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(shell)
      .then((cache) => cache.addAll(["/", "/app.js", "/style.css"])),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) => key.startsWith("calm-online-shell-") && key !== shell,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    url.origin !== self.location.origin ||
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
  } else if (["/app.js", "/style.css"].includes(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(shell);
            await cache.put(url.pathname, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(url.pathname)),
    );
  }
});
