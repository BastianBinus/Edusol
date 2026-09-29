import { test } from "node:test";
import assert from "node:assert/strict";
import { gate, STYLE_PATH } from "../lib/gate.js";

const env = {
  VERCEL_URL: "edusol-abc123-team.vercel.app",
  VERCEL_BRANCH_URL: "edusol-git-main-team.vercel.app",
};

const get = (url, method = "GET") => gate(new Request(url, { method }), env);

test("öffentliche Domain zeigt auf jedem Pfad die Sperrseite", async () => {
  for (const path of ["/", "/ueber-uns", "/ueber-uns.html", "/impressum", "/akut.html", "/sitemap.xml", "/robots.txt", "/assets/img/team/thorsten.webp", "/assets/css/site.css", "/gibts-nicht", "/%2e%2e/index.html"]) {
    for (const host of ["https://edusol.ch", "https://www.edusol.ch"]) {
      const res = get(`${host}${path}`);
      assert.equal(res?.status, 503, `${host}${path}`);
      assert.match(await res.text(), /bald online/i);
      assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
      assert.equal(res.headers.get("cache-control"), "no-store");
    }
  }
});

test("Kontakt-API ist über die öffentliche Domain gesperrt", () => {
  assert.equal(gate(new Request("https://edusol.ch/api/contact", { method: "POST", body: "x" }), env)?.status, 503);
});

test("Kurzadresse <projekt>.vercel.app ist ebenfalls gesperrt", () => {
  assert.equal(get("https://edusol.vercel.app/ueber-uns")?.status, 503);
  assert.equal(get("https://edusol-team.vercel.app/")?.status, 503);
});

test("Deployment- und Branch-URL bleiben offen", () => {
  assert.equal(get("https://edusol-abc123-team.vercel.app/ueber-uns"), undefined);
  assert.equal(get("https://edusol-git-main-team.vercel.app/api/contact", "POST"), undefined);
});

test("ohne Vercel-Variablen ist alles gesperrt", () => {
  assert.equal(gate(new Request("https://edusol-abc123-team.vercel.app/"), {})?.status, 503);
});

test("SITE_PUBLIC=true hebt die Sperre auf", () => {
  assert.equal(gate(new Request("https://edusol.ch/ueber-uns"), { SITE_PUBLIC: "true" }), undefined);
  assert.equal(gate(new Request("https://edusol.ch/"), { SITE_PUBLIC: "1" })?.status, 503);
});

test("nur Logo, Schrift und Favicons werden gesperrt ausgeliefert", () => {
  for (const path of ["/assets/img/logo.svg", "/assets/fonts/poppins-latin-600-normal.woff2", "/favicon.ico", "/icon.svg"]) {
    assert.equal(get(`https://edusol.ch${path}`), undefined, path);
  }
  assert.equal(get("https://edusol.ch/assets/img/logo-claim.svg")?.status, 503);
  assert.equal(get("https://edusol.ch/assets/img/logo.svg", "POST")?.status, 503);
});

test("Sperrseite lädt nur Dateien, die auch gesperrt erreichbar sind", async () => {
  const html = await get("https://edusol.ch/").text();
  const css = await get(`https://edusol.ch${STYLE_PATH}`).text();
  const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g), ...css.matchAll(/url\((\/[^)]*)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const ref of refs) {
    const res = get(`https://edusol.ch${ref}`);
    assert.ok(res === undefined || res.status === 200, ref);
  }
  assert.match(html, /mailto:info@edusol\.ch/);
  assert.doesNotMatch(html, /Platzhalter/);
});

test("Stylesheet der Sperrseite wird als CSS ausgeliefert", () => {
  const res = get(`https://edusol.ch${STYLE_PATH}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/css/);
});
