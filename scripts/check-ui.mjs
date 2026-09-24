// Interaktions-Tests: Akut-Seitenreiter und Navigation (Tastatur & Maus).
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const { server, base } = await startServer();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const failures = [];
const expect = (cond, msg) => cond || failures.push(msg);

// Akut-Seitenreiter (Desktop)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${base}/`);
  const toggle = page.locator(".akut-tab__toggle");
  const cta = page.locator(".akut-tab__cta");

  expect(await toggle.isVisible(), "Akut-Tab: Reiter nicht sichtbar");
  expect((await toggle.getAttribute("aria-expanded")) === "false", "Akut-Tab: nicht eingeklappt beim Laden");
  expect(!(await cta.isVisible()), "Akut-Tab: Link sichtbar, obwohl eingeklappt");

  // Eingeklappt darf der Link per Tab nicht erreichbar sein
  await page.focus("body");
  let reachedHiddenCta = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.classList.contains("akut-tab__cta"))) reachedHiddenCta = true;
  }
  expect(!reachedHiddenCta, "Akut-Tab: versteckter Link ist per Tab fokussierbar");

  await toggle.click();
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "true", "Akut-Tab: aria-expanded nach Klick nicht true");
  expect(await cta.isVisible(), "Akut-Tab: Link nach Öffnen nicht sichtbar");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "false", "Akut-Tab: Escape schliesst nicht");
  expect(await page.evaluate(() => document.activeElement?.classList.contains("akut-tab__toggle")), "Akut-Tab: Fokus nach Escape nicht zurück");

  await toggle.click();
  await page.mouse.click(200, 700);
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "false", "Akut-Tab: Klick ausserhalb schliesst nicht");

  await page.goto(`${base}/akut.html`);
  expect((await page.locator("[data-akut-tab]").count()) === 0, "Akut-Tab: auf der Akut-Seite nicht ausgeblendet");
  await page.close();
}

// Mobile: Akut-Knopf statt Seitenreiter, kein horizontales Scrollen
{
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(`${base}/`);
  expect(!(await page.locator(".akut-tab").isVisible()), "Mobil: Seitenreiter sichtbar statt Akut-Knopf");
  const fab = page.locator(".akut-fab");
  expect(await fab.isVisible(), "Mobil: Akut-Knopf nicht sichtbar");
  const box = await fab.boundingBox();
  expect(box && box.y > 800 / 2, "Mobil: Akut-Knopf nicht im unteren Bereich");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobil: horizontales Scrollen auf der Startseite");

  // Bottom-Sheet-Menü
  const toggle = page.locator(".nav-toggle");
  await toggle.click();
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "true", "Menü mobil: aria-expanded nicht true");
  expect(await page.locator(".site-nav .mega__item").first().isVisible(), "Menü mobil: Wirkungsfelder nicht sichtbar");
  expect(!(await fab.isVisible()), "Menü mobil: Akut-Knopf liegt über dem Menü");
  expect(await page.evaluate(() => document.querySelector(".site-nav").contains(document.activeElement)), "Menü mobil: Fokus nicht im Menü");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "false", "Menü mobil: Escape schliesst nicht");
  expect(await page.evaluate(() => document.activeElement?.classList.contains("nav-toggle")), "Menü mobil: Fokus nach Escape nicht zurück");
  await toggle.click();
  await page.waitForTimeout(400);
  await page.mouse.click(200, 40);
  await page.waitForTimeout(400);
  expect((await toggle.getAttribute("aria-expanded")) === "false", "Menü mobil: Klick auf Hintergrund schliesst nicht");

  // Wirkungsfeld: Aktionsleiste unten, Akut-Knopf darüber
  await page.goto(`${base}/krisenmanagement.html`);
  const bar = await page.locator(".bottom-bar").boundingBox();
  const fabBox = await page.locator(".akut-fab").boundingBox();
  expect(bar && bar.y + bar.height >= 799, "Wirkungsfeld mobil: Aktionsleiste nicht am unteren Rand");
  expect(bar && fabBox && fabBox.y + fabBox.height <= bar.y, "Wirkungsfeld mobil: Akut-Knopf überdeckt die Aktionsleiste");
  const more = page.locator("[data-clamp-toggle]");
  await more.click();
  expect((await more.getAttribute("aria-expanded")) === "true", "Wirkungsfeld mobil: Weiterlesen klappt nicht auf");

  // Kontakt: Assistent in drei Schritten
  await page.goto(`${base}/kontakt.html`);
  const next = page.locator("[data-wizard-next]");
  expect(await page.locator("[data-step='1']").isVisible(), "Assistent: Schritt 1 nicht sichtbar");
  expect(!(await page.locator("[data-step='2']").isVisible()), "Assistent: Schritt 2 zu früh sichtbar");
  expect((await next.textContent()).trim() === "Überspringen", "Assistent: ohne Thema nicht «Überspringen»");
  await next.click();
  expect(await page.locator("#name").isVisible(), "Assistent: Schritt 2 erscheint nicht");
  await next.click();
  expect((await page.locator("#name").getAttribute("aria-invalid")) === "true", "Assistent: leerer Name wird nicht gemeldet");
  await page.fill("#name", "Test Person");
  await page.fill("#email", "test@example.ch");
  await next.click();
  expect(await page.locator("#nachricht").isVisible(), "Assistent: Schritt 3 erscheint nicht");
  expect((await next.textContent()).trim() === "Anfrage senden", "Assistent: letzter Schritt nicht «Anfrage senden»");
  await page.locator("[data-wizard-back]").click();
  expect(await page.locator("#name").isVisible(), "Assistent: Zurück funktioniert nicht");

  // Rechtstexte: Akkordeon, Sprungmarke öffnet den Abschnitt
  await page.goto(`${base}/datenschutz.html`);
  const sectionButton = page.locator("#grundlagen > button");
  expect((await sectionButton.getAttribute("aria-expanded")) === "false", "Akkordeon: Abschnitt nicht zugeklappt");
  expect(!(await page.locator("#grundlagen-text").isVisible()), "Akkordeon: Text sichtbar, obwohl zugeklappt");
  await sectionButton.click();
  expect(await page.locator("#grundlagen-text").isVisible(), "Akkordeon: Text nach Klick nicht sichtbar");
  await page.goto(`${base}/datenschutz.html#kontaktformular`);
  expect(await page.locator("#kontaktformular-text").isVisible(), "Akkordeon: Sprungmarke öffnet den Abschnitt nicht");
  await page.close();
}

// 404: Eulen-Maske geladen
{
  const page = await browser.newPage();
  const res = await page.goto(`${base}/gibt-es-nicht`);
  expect(res.status() === 404, "404: falscher Statuscode");
  const mask = await page.evaluate(() => getComputedStyle(document.querySelector(".nf-code__owl")).maskImage);
  expect(/silhouette\.svg/.test(mask ?? ""), "404: Eulen-Maske fehlt");
  await page.close();
}

await browser.close();
server.close();

if (failures.length) {
  console.error(failures.map((f) => `✖ ${f}`).join("\n"));
  process.exit(1);
}
console.log("UI-Tests ok: Akut-Seitenreiter, mobiles Menü, Akut-Knopf, Aktionsleiste, Formular-Assistent, Akkordeon, 404.");
