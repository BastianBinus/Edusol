// Minimaler statischer Server für _site, inkl. Pfad-Präfix und 404-Seite.
// Direkt ausführbar (Lighthouse CI) oder als Modul (Prüfskripte).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleContact } from "../lib/contact.js";

// Lokaler Ersatz für die Vercel-Funktion /api/contact: echte Logik, Versand nur simuliert.
export const sentMails = [];

const ROOT = path.resolve("_site");
export const PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/?$/, "/");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath.startsWith(PREFIX)) urlPath = "/" + urlPath.slice(PREFIX.length);

    if (urlPath === "/api/contact") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const request = new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await handleContact(request, {
        send: async (mail) => sentMails.push(mail),
        config: { to: "test@edusol.invalid", from: "website@edusol.invalid" },
        log: { error() {} },
      });
      const location = response.headers.get("location");
      res.writeHead(response.status, {
        ...Object.fromEntries(response.headers),
        ...(location?.startsWith("/") ? { location: `${PREFIX.slice(0, -1)}${location}` } : {}),
      });
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    let filePath = path.join(ROOT, urlPath);
    const info = await stat(filePath).catch(() => null);
    if (info?.isDirectory()) filePath = path.join(filePath, "index.html");
    // cleanUrls wie auf Vercel: /kontakt → kontakt.html
    else if (!info && (await stat(`${filePath}.html`).catch(() => null))) filePath = `${filePath}.html`;
    try {
      const body = await readFile(filePath);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(filePath)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end(await readFile(path.join(ROOT, "404.html")));
    }
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => {
      const base = `http://127.0.0.1:${server.address().port}${PREFIX.slice(0, -1)}`;
      resolve({ server, base });
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { base } = await startServer(Number(process.env.PORT || 8080));
  console.log(`Server läuft auf ${base}/`);
}
