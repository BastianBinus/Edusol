// Vercel Routing Middleware: läuft vor jeder Anfrage, auch vor statischen Dateien und /api.
// Logik und Tests: lib/gate.js, tests/gate.test.js.
import { gate } from "./lib/gate.js";

export default function middleware(request) {
  return gate(request, process.env);
}
