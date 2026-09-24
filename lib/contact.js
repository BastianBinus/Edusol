// Kontaktformular-Logik (ohne Vercel-Abhängigkeit, dadurch testbar).
// Nimmt eine Web-Request entgegen, prüft sie und übergibt eine Mail an `send`.
import fields from "../src/_data/fields.json" with { type: "json" };

export const MAX_BODY_BYTES = 20_000;

export const LIMITS = {
  name: 200,
  email: 254,
  telefon: 40,
  organisation: 200,
  nachricht: 5000,
};

const TOPICS = new Set([...fields.map((f) => f.title), "Anderes"]);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const PHONE = /^[+()\d\s./-]*$/;

// Steuerzeichen entfernen; Zeilenumbrüche nur in der Nachricht zulassen.
const clean = (value, { multiline = false } = {}) => {
  const text = String(value ?? "").normalize("NFC");
  const stripped = multiline
    ? text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
    : text.replace(/[\u0000-\u001F\u007F]/g, " ");
  return stripped.trim();
};

export function validate(data) {
  const values = {
    name: clean(data.get("name")),
    email: clean(data.get("email")),
    telefon: clean(data.get("telefon")),
    organisation: clean(data.get("organisation")),
    thema: clean(data.get("thema")),
    nachricht: clean(data.get("nachricht"), { multiline: true }),
  };
  const errors = {};

  if (!values.name) errors.name = "Bitte «Vor- und Nachname» ausfüllen.";
  else if (values.name.length > LIMITS.name) errors.name = `Maximal ${LIMITS.name} Zeichen.`;

  if (!values.email) errors.email = "Bitte «E-Mail» ausfüllen.";
  else if (values.email.length > LIMITS.email || !EMAIL.test(values.email)) {
    errors.email = "Bitte eine gültige E-Mail-Adresse angeben, z. B. name@schule.ch.";
  }

  if (values.telefon.length > LIMITS.telefon || !PHONE.test(values.telefon)) {
    errors.telefon = "Bitte eine gültige Telefonnummer angeben.";
  }
  if (values.organisation.length > LIMITS.organisation) errors.organisation = `Maximal ${LIMITS.organisation} Zeichen.`;
  if (values.thema && !TOPICS.has(values.thema)) errors.thema = "Unbekanntes Thema.";

  if (!values.nachricht) errors.nachricht = "Bitte «Eure Nachricht» ausfüllen.";
  else if (values.nachricht.length > LIMITS.nachricht) errors.nachricht = `Maximal ${LIMITS.nachricht} Zeichen.`;

  return { values, errors };
}

export function buildMail(values, { to, from }) {
  const details = [
    `Name: ${values.name}`,
    `E-Mail: ${values.email}`,
    ...(values.telefon ? [`Telefon: ${values.telefon}`] : []),
    ...(values.organisation ? [`Organisation: ${values.organisation}`] : []),
    `Thema: ${values.thema || "–"}`,
  ];
  const lines = [...details, "", values.nachricht, "", "—", "Gesendet über das Kontaktformular der Website."];

  return {
    to,
    from,
    replyTo: { name: values.name, address: values.email },
    subject: `Neue Anfrage${values.thema ? `: ${values.thema}` : ""} – ${values.name}`.slice(0, 160),
    text: lines.join("\n"),
  };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const redirect = (location) => new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });

// Antwortet dem Browser: fetch() bekommt JSON, ein normales Formular eine Weiterleitung.
const respond = (request, status, body, page) =>
  (request.headers.get("accept") ?? "").includes("application/json") ? json(status, body) : redirect(page);

export async function handleContact(request, { send, config, log = console }) {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  // Nur Anfragen von der eigenen Website annehmen (Schutz vor fremden Formularen/Skripten).
  const origin = request.headers.get("origin");
  const host = new URL(request.url).host;
  if (!origin || new URL(origin).host !== host) {
    return json(403, { ok: false, error: "origin" });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });

  let data;
  try {
    const raw = await request.arrayBuffer();
    if (raw.byteLength > MAX_BODY_BYTES) return json(413, { ok: false, error: "too_large" });
    data = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: raw,
    }).formData();
  } catch {
    return respond(request, 400, { ok: false, error: "bad_request" }, "/kontakt-fehler");
  }

  // Honeypot: Bots füllen das versteckte Feld aus – still "Erfolg" melden, nichts senden.
  if (clean(data.get("_gotcha"))) return respond(request, 200, { ok: true }, "/danke");

  const { values, errors } = validate(data);
  if (Object.keys(errors).length) {
    return respond(request, 422, { ok: false, errors }, "/kontakt-fehler");
  }

  if (!config.to || !config.from) {
    log.error("contact: MAIL_TO/MAIL_FROM fehlen");
    return respond(request, 503, { ok: false, error: "not_configured" }, "/kontakt-fehler");
  }

  try {
    await send(buildMail(values, config));
  } catch (error) {
    // Keine Formularinhalte loggen – nur den Fehlertyp.
    log.error("contact: Versand fehlgeschlagen", error?.code ?? error?.name ?? "unknown");
    return respond(request, 502, { ok: false, error: "send_failed" }, "/kontakt-fehler");
  }

  return respond(request, 200, { ok: true }, "/danke");
}
