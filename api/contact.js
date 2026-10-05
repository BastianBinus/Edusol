// Vercel Function: POST /api/contact – leitet Anfragen per SMTP ins EDUSOL-Postfach.
// Konfiguration über Umgebungsvariablen in Vercel (siehe README).
import nodemailer from "nodemailer";
import { handleContact } from "../lib/contact.js";

let transporter;

const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_PORT || "465") === "465",
    requireTLS: true,
    // Kurze Timeouts (Standard: bis 2 bzw. 10 Minuten), damit ein hängender Mailserver
    // rasch als Fehler endet und das Formular /kontakt-fehler zeigt statt zu warten.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const handler = (request) =>
  handleContact(request, {
    send: (mail) => getTransporter().sendMail(mail),
    config: { to: process.env.MAIL_TO, from: process.env.MAIL_FROM },
  });

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
