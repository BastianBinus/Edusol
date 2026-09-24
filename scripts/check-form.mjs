// E2E-Test des Kontaktformulars – je nach Build gegen Formspree (simuliert)
// oder gegen die eigene Funktion /api/contact (echte Logik im lokalen Testserver).
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { startServer, sentMails } from "./serve.mjs";

const html = await readFile("_site/kontakt.html", "utf8");
const backend = /action="[^"]*\/api\/contact"/.test(html) ? "vercel" : "formspree";

const { server, base } = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
const expect = (cond, msg) => cond || failures.push(msg);

async function scenario(name, status) {
  const page = await browser.newPage();
  const requests = [];
  await page.route("https://formspree.io/**", (route) => {
    requests.push(route.request().headers().accept);
    route.fulfill({ status, contentType: "application/json", body: "{}" });
  });
  await page.goto(`${base}/kontakt.html?thema=npo`);
  expect(await page.isChecked('input[data-slug="npo"]'), `${name}: ?thema-Vorauswahl greift nicht`);

  // Leeres Formular: Fehler als Text, Fokus auf erstem Fehler, kein Request
  await page.click('button[type="submit"]');
  expect((await page.getAttribute("#name", "aria-invalid")) === "true", `${name}: aria-invalid fehlt`);
  expect((await page.textContent("#name-error")).includes("Vor- und Nachname"), `${name}: Fehlertext fehlt`);
  expect((await page.evaluate(() => document.activeElement.id)) === "name", `${name}: Fokus nicht auf erstem Fehler`);
  expect(requests.length === 0, `${name}: Request trotz Fehler`);

  // Optionale Felder erst auf Klick
  expect(await page.isHidden("#telefon"), `${name}: Telefon nicht eingeklappt`);
  await page.click("#more-toggle");
  expect(await page.isVisible("#telefon"), `${name}: Telefon lässt sich nicht einblenden`);

  // Thema per Tastatur wählbar (Radio), Akut-Hinweis bei Krisenmanagement
  await page.check('input[data-slug="krisenmanagement"]');
  expect(await page.isVisible("#crisis-hint"), `${name}: Akut-Hinweis fehlt`);

  await page.fill("#name", "Max Muster");
  await page.fill("#email", "max@schule.ch");
  await page.fill("#nachricht", "Test");
  await Promise.all([
    status === 403
      ? page.waitForURL(/formspree\.io/)
      : page.waitForFunction(() => !document.getElementById("form-success").hidden || !document.getElementById("form-status").textContent.startsWith("Bitte")),
    page.click('button[type="submit"]'),
  ]);
  return { page, requests };
}

if (backend === "vercel") {
  // Erfolg über die echte Funktion
  {
    const page = await browser.newPage();
    await page.goto(`${base}/kontakt.html?thema=npo`);
    await page.fill("#name", "Max Muster");
    await page.fill("#email", "max@schule.ch");
    await page.fill("#nachricht", "Test über die eigene Funktion");
    await Promise.all([page.waitForSelector("#form-success", { state: "visible" }), page.click('button[type="submit"]')]);
    const mail = sentMails.at(-1);
    expect(mail?.replyTo?.address === "max@schule.ch", "API: Mail nicht mit Reply-To erzeugt");
    expect(/Thema: NPO-Beratung/.test(mail?.text ?? ""), "API: Thema fehlt in der Mail");
    await page.close();
  }
  // Serverseitiger Feldfehler (Telefon wird im Browser nicht geprüft)
  {
    const page = await browser.newPage();
    await page.goto(`${base}/kontakt.html`);
    await page.fill("#name", "Max Muster");
    await page.fill("#email", "max@schule.ch");
    await page.fill("#nachricht", "Test");
    await page.click("#more-toggle");
    await page.fill("#telefon", "abc<script>");
    const before = sentMails.length;
    await page.click('button[type="submit"]');
    await page.waitForSelector("#telefon-error", { state: "visible" });
    expect((await page.getAttribute("#telefon", "aria-invalid")) === "true", "API 422: Feld nicht als ungültig markiert");
    expect((await page.evaluate(() => document.activeElement.id)) === "telefon", "API 422: Fokus nicht auf dem Fehlerfeld");
    expect(sentMails.length === before, "API 422: trotzdem gesendet");
    await page.close();
  }
  // Ohne JavaScript: normales Absenden, Weiterleitung auf /danke
  {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`${base}/kontakt.html`);
    await page.fill("#name", "Ohne JS");
    await page.fill("#email", "nojs@schule.ch");
    await page.fill("#nachricht", "Test ohne JavaScript");
    await Promise.all([page.waitForURL(/\/danke/), page.click('button[type="submit"]')]);
    expect(sentMails.at(-1)?.replyTo?.address === "nojs@schule.ch", "API ohne JS: nicht gesendet");
    await context.close();
  }
} else {
{
  const { page, requests } = await scenario("Erfolg", 200);
  expect(requests[0] === "application/json", "Erfolg: kein JSON-Request");
  expect(await page.isVisible("#form-success"), "Erfolg: keine Bestätigung");
  expect(await page.isHidden("#contact-form"), "Erfolg: Formular noch sichtbar");
}
  {
  const { page } = await scenario("Validierungsfehler", 422);
  expect((await page.textContent("#form-status")).includes("nicht gesendet"), "422: keine Fehlermeldung");
  expect((await page.inputValue("#nachricht")) === "Test", "422: Eingaben gelöscht");
}
  {
  const { page, requests } = await scenario("Fallback", 403);
  expect(requests.length === 2, "403: kein nativer POST als Fallback");
  expect(page.url().startsWith("https://formspree.io/"), "403: keine Weiterleitung zu Formspree");
}

}

// Mobil: Versand über den Assistenten (Weiter / Anfrage senden in der Aktionsleiste)
{
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.route("https://formspree.io/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  const before = sentMails.length;
  await page.goto(`${base}/kontakt.html?thema=npo`);
  const next = page.locator("[data-wizard-next]");
  expect((await next.textContent()).trim() === "Weiter", "Mobil: mit Vorauswahl nicht «Weiter»");
  await next.click();
  await page.fill("#name", "Mobil Muster");
  await page.fill("#email", "mobil@schule.ch");
  await next.click();
  await next.click();
  expect((await page.getAttribute("#nachricht", "aria-invalid")) === "true", "Mobil: leere Nachricht nicht gemeldet");
  await page.fill("#nachricht", "Test über den Assistenten");
  await Promise.all([page.waitForSelector("#form-success", { state: "visible" }), next.click()]);
  expect(await page.isHidden("[data-wizard-progress]"), "Mobil: Fortschritt nach Erfolg noch sichtbar");
  if (backend === "vercel") expect(sentMails.length === before + 1, "Mobil: Mail nicht gesendet");
  await page.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.map((f) => `✖ ${f}`).join("\n"));
  process.exit(1);
}
console.log(`Formular-E2E ok (${backend}): Validierung, Erfolg (auch mobil), Fehler und ${backend === "vercel" ? "Versand ohne JavaScript" : "Fallback"}.`);
