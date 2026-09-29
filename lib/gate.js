// «Bald online»-Sperre (ohne Vercel-Abhängigkeit, dadurch testbar).
// Solange die Website nicht freigegeben ist, bekommt jede Anfrage an eine öffentliche
// Adresse (edusol.ch, www.edusol.ch, <projekt>.vercel.app …) diese Seite – egal welcher Pfad.
// Offen bleiben nur die eindeutigen Deployment-URLs, die Vercel per Login schützt.
// Freigabe: in Vercel SITE_PUBLIC=true setzen und neu deployen (siehe README).
import site from "../src/_data/site.js";

export const STYLE_PATH = "/bald-online.css";

// Einzige Dateien, die auch gesperrt ausgeliefert werden: Logo, Schrift, Favicons.
const ASSETS = new Set([
  "/favicon.ico",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/assets/img/logo.svg",
  "/assets/fonts/poppins-latin-400-normal.woff2",
  "/assets/fonts/poppins-latin-600-normal.woff2",
]);

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

const PAGE = `<!DOCTYPE html>
<html lang="de-CH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${site.name} – Bald online</title>
  <link rel="stylesheet" href="${STYLE_PATH}">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
</head>
<body>
  <main>
    <img src="/assets/img/logo.svg" width="240" height="61" alt="${site.name}">
    <h1>Unsere Website ist bald online.</h1>
    <p>Wir arbeiten gerade daran. Bis dahin erreicht ihr uns per E-Mail:
      <a href="mailto:${site.email}">${site.email}</a></p>
  </main>
</body>
</html>
`;

const STYLE = `@font-face{font-family:Poppins;font-weight:400;font-display:swap;src:url(/assets/fonts/poppins-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Poppins;font-weight:600;font-display:swap;src:url(/assets/fonts/poppins-latin-600-normal.woff2) format("woff2")}
*{box-sizing:border-box}
html{height:100%}
body{margin:0;min-height:100%;display:grid;place-items:center;padding:24px;background:#f4f8fb;color:#1a1a1a;font:400 1rem/1.7 Poppins,system-ui,sans-serif}
main{max-width:34rem;text-align:center}
img{width:min(240px,70vw);height:auto}
h1{margin:2rem 0 1rem;color:#1a3a50;font-size:clamp(1.5rem,4vw,2rem);font-weight:600;line-height:1.25}
p{margin:0 0 1rem;color:#555}
a{color:#2e6687;font-weight:600}
`;

const isOpen = (hostname, env) =>
  env.SITE_PUBLIC === "true" || [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).includes(hostname);

// Gibt die Antwort der Sperre zurück oder undefined, wenn die Anfrage normal weiterlaufen darf.
export function gate(request, env = {}) {
  const url = new URL(request.url);
  if (isOpen(url.hostname, env)) return undefined;
  const readOnly = request.method === "GET" || request.method === "HEAD";
  if (readOnly && ASSETS.has(url.pathname)) return undefined;
  if (readOnly && url.pathname === STYLE_PATH) {
    return new Response(STYLE, { headers: { ...HEADERS, "Content-Type": "text/css; charset=utf-8" } });
  }
  return new Response(PAGE, { status: 503, headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" } });
}
