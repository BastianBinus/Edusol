# EDUSOL Website

Statische Website von EDUSOL, gebaut mit [Eleventy](https://www.11ty.dev/) und ausgeliefert über Vercel.

## Entwicklung

```bash
npm ci
npm start          # Dev-Server mit Live-Reload auf http://localhost:8080
npm test           # Build + HTML + Links + Security-Header + axe + Formular- und UI-E2E
npx @lhci/cli@0.15.1 autorun   # Lighthouse mit Budgets (LCP ≤ 2,5 s, CLS ≤ 0,1, JS ≤ 20 KB …)
```

Für axe, Formular-Test und Lighthouse wird Chromium benötigt (`npx playwright install chromium`
bzw. `CHROMIUM_PATH=…` / `CHROME_PATH=…`).

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/_data/site.js` | **Stammdaten**: E-Mail, Adresse, Akut-Telefon und -Zeiten, WhatsApp, Formular-Endpoint, `security.txt`-Ablauf |
| `src/_data/fields.json` | Inhalte und Farben der fünf Wirkungsfelder (erzeugt je eine Seite) |
| `src/_data/team.json` | Team-Profile (Rolle, Wirkungsfelder) für „Wir sind EDUSOL“ |
| `src/_data/finder.json`, `stories.json`, `steps.json` | „Wo steht ihr gerade?“, Einblicke, Ablauf-Schritte |
| `src/_includes/` | Basis-Layout, Header, Footer, JSON-LD |
| `src/*.njk` | Seiten (Startseite, Über uns, Kontakt, Datenschutz, Impressum, 404, robots, sitemap, security.txt) |
| `src/assets/` | CSS (Design-Tokens), JS, Bilder, OG-Bild |
| `src/static/` | Favicons im Webroot |
| `scripts/` | Prüfskripte und Icon-Generator (`npm run icons`) |

Navbar und Footer existieren nur einmal (`src/_includes/partials/`).

**CSP:** Die Content-Security-Policy steht zweimal – als HTTP-Header in `vercel.json` und als Meta-Tag in
`src/_includes/layouts/base.njk`. Beide immer gemeinsam ändern; `npm run check:headers` bricht bei Abweichungen ab.
Inline-Styles sind per `html-validate` verboten, damit die CSP ohne `'unsafe-inline'` auskommt.
Das CSS (`src/assets/css/main.css`, ohne Framework) wird beim Build mit Lightning CSS minifiziert
und als `assets/css/site.css` ausgeliefert.

**Fotos:** Solange keine Bilder vorliegen, zeigen gestrichelte Rahmen „Foto … folgt“ an
(`partials/photo-slot.njk`). `npm run check:placeholders` listet sie zusammen mit den Text-Platzhaltern auf.

## Deployment

### Vercel (empfohlen)

`vercel.json` enthält Build-Einstellungen, `cleanUrls` (auch für Links/Canonical/Sitemap massgebend) und die Security-Header (CSP inkl. `frame-ancestors`, HSTS,
`nosniff`, `Permissions-Policy` …). Einrichtung einmalig im Vercel-Dashboard:

1. *Add New → Project* → Repository `BastianBinus/Edusol` importieren (Framework: *Other*; der Rest kommt aus `vercel.json`).
2. Deployen. Jeder Push auf `main` geht live, jeder Pull Request bekommt ein Preview (automatisch `noindex`).
3. Eigene Domain unter *Settings → Domains* hinzufügen. `SITE_URL` nur setzen, falls die Domain nicht die
   Produktions-Domain des Projekts ist.

**Speed Insights (optional, kostenpflichtig):** In Vercel aktivieren und zusätzlich die Umgebungsvariable
`SPEED_INSIGHTS=true` setzen, dann neu deployen. Script und Datenschutz-Absatz erscheinen erst dann.

**Web Analytics:** In Vercel unter *Analytics → Enable* aktivieren. Das Script `/_vercel/insights/script.js`
wird nur beim Build auf Vercel eingebunden (cookielos, gleiche Domain, keine CSP-Ausnahmen nötig).

Hinweis: Der Hobby-Plan ist nur für nicht-kommerzielle Nutzung erlaubt – für EDUSOL braucht es Pro.
Die Datenschutzerklärung nennt beim Build auf Vercel automatisch Vercel als Hoster.

### Kontaktformular (eigene Funktion statt Formspree)

`api/contact.js` (Vercel Function, Region Frankfurt) prüft die Anfrage serverseitig und sendet sie per SMTP
direkt ins Postfach – ohne Formularanbieter, ohne CAPTCHA. Logik: `lib/contact.js`, Tests: `tests/`.

> **Status: noch nicht aktiv – wartet auf ein eigenes Postfach.** Bis dahin läuft das Formular über Formspree.
> Die Mails von edusol.ch liegen bei **Hostpoint** (`info@edusol.ch`). Geplant ist ein eigenes Postfach
> `form@edusol.ch` nur für den Versand. Offen:
>
> - [ ] Klären, ob wir bei Hostpoint ein zusätzliches Postfach anlegen dürfen (Kunde/Abo).
> - [ ] `form@edusol.ch` als **eigenen Mailaccount** anlegen – *keine* „alternative Adresse“ (Alias von info@),
>       sonst läuft der SMTP-Login weiter mit dem Passwort von info@.
> - [ ] Starkes, einmaliges Passwort vergeben; in form@ eine Weiterleitung an info@ einrichten (Bounces).
> - [ ] Hostpoint Control Panel → *Domains → Bearbeiten → E-Mail-Sicherheit konfigurieren*: DKIM aktiv,
>       DMARC gesetzt, genau ein SPF-Eintrag.
>
> Das Passwort von info@ nicht in Vercel hinterlegen: Ein Leck würde das ganze Hauptpostfach offenlegen.

Werte für Hostpoint:

| Variable | Wert |
|---|---|
| `SMTP_HOST` | `asmtp.mail.hostpoint.ch` |
| `SMTP_PORT` | `587` (STARTTLS) – alternativ `465` (SSL) |
| `SMTP_USER` | `form@edusol.ch` |
| `SMTP_PASS` | Passwort von form@ (in Vercel als *Sensitive* markieren) |
| `MAIL_FROM` | `EDUSOL Website <form@edusol.ch>` |
| `MAIL_TO` | `info@edusol.ch` |
| `CONTACT_BACKEND` | `vercel` |

Variablen nur für *Production* setzen – sonst verschicken Preview-Deployments echte Mails.

Aktivieren in Vercel → *Settings → Environment Variables* (Vorlage: `.env.example`):

1. SMTP-Zugang vom E-Mail-Anbieter eintragen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
   (am besten ein eigenes Konto/App-Passwort nur für die Website).
2. `MAIL_TO` (Empfänger) und `MAIL_FROM` (Absender, muss zum SMTP-Konto passen) setzen.
3. `CONTACT_BACKEND=vercel` setzen und neu deployen. Ohne diese Variable bleibt Formspree aktiv.
4. Empfohlen: in Vercel unter *Firewall → Rules* ein Rate-Limit für `/api/contact`
   (z. B. 5 Anfragen pro Minute und IP).
5. Test: Formular auf der Live-Seite absenden; danach Formspree-Konto kündigen.

Schutzmassnahmen: nur `POST`, nur von der eigenen Domain (Origin-Check), Grössenlimit 20 KB, Honeypot,
Längen- und Formatprüfung, keine Zeilenumbrüche in Mail-Headern, Absender immer die eigene Adresse
(`Reply-To` = anfragende Person), keine Inhalte in Logs, keine automatische Bestätigungsmail
(sonst liesse sich die Funktion missbrauchen, um Dritte anzuschreiben).

### Prüfungen

`.github/workflows/ci.yml` prüft jeden Push und Pull Request (Build, HTML, Links, axe, Formular, Lighthouse).
Veröffentlicht wird ausschliesslich über Vercel.

**Rollback:** In Vercel unter *Deployments* ein früheres Deployment „Promote to Production“ – oder den Commit auf `main` reverten.

## Vor dem Go-live

- [ ] Platzhalter in `src/_data/site.js` ersetzen (`npm run check:placeholders -- --strict`)
- [ ] Datenschutzerklärung und Impressum rechtlich prüfen lassen
- [ ] Auftragsbearbeitungsvertrag (DPA) mit Formspree abschliessen
- [ ] Kontaktformular auf eigene Funktion umstellen (siehe *Kontaktformular*: Postfach `form@edusol.ch` bei Hostpoint)
- [ ] `securityTxtExpires` jährlich erneuern (Kalendereintrag!)
