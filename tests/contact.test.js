import { test } from "node:test";
import assert from "node:assert/strict";
import { handleContact, buildMail, MAX_BODY_BYTES } from "../lib/contact.js";

const URL_BASE = "https://edusol.example/api/contact";
const config = { to: "info@edusol.example", from: "website@edusol.example" };
const silent = { error() {} };

const valid = {
  name: "Max Muster",
  email: "max@schule.ch",
  thema: "NPO-Beratung",
  nachricht: "Hallo EDUSOL",
};

function request(fields = valid, { origin = "https://edusol.example", accept = "application/json", method = "POST" } = {}) {
  const body = method === "POST" ? new URLSearchParams(fields) : undefined;
  const headers = { accept };
  if (origin) headers.origin = origin;
  return new Request(URL_BASE, { method, body, headers });
}

async function run(req) {
  const sent = [];
  const res = await handleContact(req, { send: async (m) => sent.push(m), config, log: silent });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { res, body, sent };
}

test("gültige Anfrage wird gesendet (JSON)", async () => {
  const { res, body, sent } = await run(request());
  assert.equal(res.status, 200);
  assert.deepEqual(body, { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, config.to);
  assert.equal(sent[0].from, config.from, "Absender ist immer die eigene Adresse");
  assert.equal(sent[0].replyTo.address, "max@schule.ch");
  assert.match(sent[0].text, /Hallo EDUSOL/);
});

test("ohne JavaScript: Weiterleitung auf /danke bzw. /kontakt-fehler", async () => {
  const ok = await run(request(valid, { accept: "text/html" }));
  assert.equal(ok.res.status, 303);
  assert.equal(ok.res.headers.get("location"), "/danke");
  const bad = await run(request({ ...valid, email: "" }, { accept: "text/html" }));
  assert.equal(bad.res.status, 303);
  assert.equal(bad.res.headers.get("location"), "/kontakt-fehler");
});

test("nur POST erlaubt", async () => {
  const { res, sent } = await run(request(valid, { method: "GET" }));
  assert.equal(res.status, 405);
  assert.equal(sent.length, 0);
});

test("fremde oder fehlende Origin wird abgelehnt", async () => {
  for (const origin of ["https://evil.example", null]) {
    const { res, sent } = await run(request(valid, { origin }));
    assert.equal(res.status, 403, `Origin ${origin}`);
    assert.equal(sent.length, 0);
  }
});

test("Pflichtfelder und Formate werden serverseitig geprüft", async () => {
  const { res, body, sent } = await run(request({ name: "", email: "keine-mail", nachricht: "", telefon: "abc", thema: "Hack" }));
  assert.equal(res.status, 422);
  assert.deepEqual(Object.keys(body.errors).sort(), ["email", "nachricht", "name", "telefon", "thema"]);
  assert.equal(sent.length, 0);
});

test("zu lange Felder und zu grosse Anfragen werden abgelehnt", async () => {
  const long = await run(request({ ...valid, nachricht: "x".repeat(5001) }));
  assert.equal(long.res.status, 422);
  const big = await run(request({ ...valid, nachricht: "x".repeat(MAX_BODY_BYTES + 10) }));
  assert.equal(big.res.status, 413);
  assert.equal(big.sent.length, 0);
});

test("Honeypot: Bot erhält Erfolg, es wird nichts gesendet", async () => {
  const { res, sent } = await run(request({ ...valid, _gotcha: "http://spam" }));
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});


test("Zeilenumbrüche in Einzeilern werden entfernt", async () => {
  const { sent } = await run(request({ ...valid, name: "Eve\r\nBcc: victim@example.com" }));
  assert.equal(sent.length, 1);
  assert.ok(!/[\r\n]/.test(sent[0].subject), "Betreff ohne Zeilenumbruch");
  assert.ok(!/[\r\n]/.test(sent[0].replyTo.name), "Reply-To-Name ohne Zeilenumbruch");
});

test("fehlende Konfiguration → 503, Versandfehler → 502", async () => {
  const noConfig = await handleContact(request(), { send: async () => {}, config: {}, log: silent });
  assert.equal(noConfig.status, 503);
  const failing = await handleContact(request(), {
    send: async () => { throw Object.assign(new Error("smtp"), { code: "EAUTH" }); },
    config,
    log: silent,
  });
  assert.equal(failing.status, 502);
});
