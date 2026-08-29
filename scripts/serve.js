// Tiny static server, so you can open the dashboard over http:// if you prefer.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 5173);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml" };

http
  .createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(ROOT, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`KCC Grand Prix → http://localhost:${PORT}`));
