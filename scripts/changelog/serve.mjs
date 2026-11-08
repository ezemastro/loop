#!/usr/bin/env node
// Static server for an `expo export --platform web` output, used by the changelog capture.
// Resolution order: exact path, path + ".html", path + "/index.html", then "/index.html" (SPA
// fallback for dynamic routes). Usage: node scripts/changelog/serve.mjs <dir> <port>
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [dirArg, portArg] = process.argv.slice(2);
if (!dirArg || !portArg) {
  console.error("Usage: serve.mjs <dir> <port>");
  process.exit(2);
}
const root = path.resolve(dirArg);
const port = Number(portArg);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

function resolveFile(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const base = path.join(root, clean);
  if (!base.startsWith(root)) return null;
  const candidates = [
    base,
    `${base}.html`,
    path.join(base, "index.html"),
    path.join(root, "index.html"),
  ];
  return candidates.find(isFile) ?? null;
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const file = resolveFile(pathname);
    if (!file) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, "0.0.0.0", () => console.log(`Serving ${root} on http://0.0.0.0:${port}`));
