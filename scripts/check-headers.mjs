// Prüft die Security-Header in vercel.json und dass die CSP im HTML-Meta-Tag
// mit dem HTTP-Header übereinstimmt (Header darf zusätzlich frame-ancestors haben).
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const errors = [];
const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
const global = vercel.headers?.find((h) => h.source === "/(.*)")?.headers ?? [];
const header = (key) => global.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

const required = {
  "Content-Security-Policy": /default-src 'self'/,
  "Strict-Transport-Security": /max-age=(\d+)/,
  "X-Content-Type-Options": /^nosniff$/,
  "X-Frame-Options": /^DENY$/,
  "Referrer-Policy": /^strict-origin-when-cross-origin$/,
  "Permissions-Policy": /camera=\(\)/,
  "Cross-Origin-Opener-Policy": /^same-origin$/,
};
for (const [key, pattern] of Object.entries(required)) {
  const value = header(key);
  if (!value) errors.push(`Header fehlt: ${key}`);
  else if (!pattern.test(value)) errors.push(`Header ${key} hat unerwarteten Wert: ${value}`);
}
const hsts = header("Strict-Transport-Security")?.match(/max-age=(\d+)/);
if (hsts && Number(hsts[1]) < 31536000) errors.push("HSTS max-age unter einem Jahr");
if (/interest-cohort/.test(header("Permissions-Policy") ?? "")) errors.push("Permissions-Policy enthält veraltetes interest-cohort");
for (const legacy of ["X-XSS-Protection", "Public-Key-Pins", "Expect-CT", "Feature-Policy"]) {
  if (header(legacy)) errors.push(`Veralteter Header gesetzt: ${legacy}`);
}

const parse = (csp) =>
  new Map(
    csp
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.split(/\s+/);
        return [name, values.sort().join(" ")];
      }),
  );

const headerCsp = parse(header("Content-Security-Policy") ?? "");
for (const [name, values] of headerCsp) {
  if (/'unsafe-inline'|'unsafe-eval'|(^|\s)\*(\s|$)/.test(values)) errors.push(`CSP ${name} ist zu offen: ${values}`);
}
if (!headerCsp.has("frame-ancestors")) errors.push("CSP-Header ohne frame-ancestors");

const pages = (await readdir("_site")).filter((f) => f.endsWith(".html"));
for (const file of pages) {
  const html = await readFile(path.join("_site", file), "utf8");
  const meta = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  if (!meta) {
    errors.push(`${file}: CSP-Meta-Tag fehlt`);
    continue;
  }
  const metaCsp = parse(meta.replace(/&#39;/g, "'"));
  const names = new Set([...headerCsp.keys(), ...metaCsp.keys()]);
  names.delete("frame-ancestors"); // im Meta-Tag wirkungslos
  for (const name of names) {
    if (headerCsp.get(name) !== metaCsp.get(name)) {
      errors.push(`${file}: CSP ${name} weicht ab – Header «${headerCsp.get(name) ?? "fehlt"}» vs. Meta «${metaCsp.get(name) ?? "fehlt"}»`);
    }
  }
  // Inline-Skripte (ausser JSON-LD) würden von der CSP blockiert
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)) {
    if (!/type="application\/ld\+json"/.test(m[1])) errors.push(`${file}: Inline-Script gefunden`);
  }
}

if (errors.length) {
  console.error([...new Set(errors)].map((e) => `✖ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`Header-Check ok: ${Object.keys(required).length} Pflicht-Header, CSP konsistent auf ${pages.length} Seiten.`);
