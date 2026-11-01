const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http");
module.exports = async function startServer(root) {
  const dist = path.join(root, "output/upstream/.tmp/angular-dist/browser");
  const server = http.createServer((request, response) => {
    const url = decodeURIComponent((request.url || "/").split("?")[0]);
    const file = path.resolve(dist, "." + (url === "/" ? "/index.html" : url));
    if (!file.startsWith(dist + "/")) {
      response.writeHead(403).end();
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          }[path.extname(file)] || "application/octet-stream",
      });
      response.end(data);
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};
