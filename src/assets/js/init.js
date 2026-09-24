// Läuft blockierend im <head>: markiert JavaScript-Unterstützung vor dem ersten Rendern,
// damit mobile Ansichten (Formular-Schritte, Akkordeons) ohne Layout-Sprung starten.
document.documentElement.classList.add("js");
