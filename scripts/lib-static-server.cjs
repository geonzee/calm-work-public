// Tiny static server for the staged phone build.
// extensionless URLs resolve to .html, unknown paths fall back to index.html.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain",
};
function serve(dir, port = 0) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    const candidates = [url, url + ".html", path.join(url, "index.html")];
    let file = null;
    for (const item of candidates) {
      const full = path.join(dir, item);
      if (full.startsWith(dir) && fs.existsSync(full) && fs.statSync(full).isFile()) {
        file = full;
        break;
      }
    }
    const isAsset = /\.[a-z0-9]+$/i.test(url);
    if (!file && isAsset) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    file ||= path.join(dir, "index.html");
    // Match Pages asset CORS so sandboxed upstream plugins can read manifests in WebKit.
    const headers = { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" };
    if (/ngsw/.test(file)) headers["Cache-Control"] = "no-cache";
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port })),
  );
}
module.exports = { serve };
