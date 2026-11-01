const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  source = path.join(root, "apps/desktop/ui"),
  runtime = path.join(root, "apps/desktop/calm-shell/runtime"),
  target = path.join(root, "output/upstream/src/assets/calm");
fs.mkdirSync(target, { recursive: true });
// The runnable app and review now share their actual date/data code as well as styles.
const names = [
  "keyboard-review.html",
  "keyboard-review.css",
  "keyboard-date.js",
  "keyboard-calendar.js",
  "keyboard-prototypes.js",
  "keyboard-review.js",
];
for (const name of names)
  fs.copyFileSync(path.join(source, name), path.join(target, name));
fs.copyFileSync(
  path.join(runtime, "runtime-controller.js"),
  path.join(target, "runtime-controller.js"),
);
const html = fs.readFileSync(path.join(source, "keyboard-review.html"), "utf8");
fs.writeFileSync(
  path.join(target, "keyboard-review.html"),
  html
    .replace(
      "<head>",
      `<head><script>if (new URLSearchParams(location.search).get('reference') !== '1') document.documentElement.dataset.calmLoading = 'true';</script><style>html[data-calm-loading] body { visibility: hidden !important; }</style>`,
    )
    .replace(
      '<script src="keyboard-date.js">',
      '<script>window.calmRuntimeMode = true;</script>\n<script src="keyboard-date.js">',
    )
    .replace(
      '<script src="keyboard-review.js"></script>',
      '<script src="keyboard-review.js"></script>\n<script src="runtime-controller.js"></script>',
    ),
);
const hashes = Object.fromEntries(
  names.map((name) => [
    name,
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(source, name)))
      .digest("hex"),
  ]),
);
const states = JSON.parse(
  fs.readFileSync(path.join(source, "keyboard-view-inventory.json")),
).length;
fs.writeFileSync(
  path.join(target, "source-contract.json"),
  JSON.stringify(
    { source: "apps/desktop/ui/keyboard-review.html", hashes, states },
    null,
    2,
  ) + "\n",
);
console.log(
  `Prepared ${states}-state shared renderer without source rewriting.`,
);
