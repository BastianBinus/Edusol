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

// Akut-Seitenreiter (Mobile): unteres Drittel, kein horizontales Scrollen
{
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto(`${base}/`);
  const box = await page.locator(".akut-tab").boundingBox();
  expect(box && box.y > 800 / 2, "Akut-Tab mobil: nicht im unteren Bereich");
  await page.locator(".akut-tab__toggle").click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Akut-Tab mobil: offenes Panel erzeugt horizontales Scrollen");
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
console.log("UI-Tests ok: Akut-Seitenreiter (Desktop/Mobile, Tastatur), 404.");
