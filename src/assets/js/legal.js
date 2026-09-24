// Rechtstexte: mobil als Akkordeon (Überschrift = Schalter), am Desktop vollständig sichtbar.
// Das Zuklappen passiert per CSS (.js + Media Query) schon vor dem ersten Rendern.
(() => {
  const sections = [...document.querySelectorAll("[data-legal-sec]")];
  if (!sections.length) return;
  const mobile = window.matchMedia("(max-width: 47.99rem)");

  const setOpen = (section, open) => {
    section.classList.toggle("is-open", open);
    section.querySelector("h2 > button")?.setAttribute("aria-expanded", String(open));
  };

  const enhance = () => {
    sections.forEach((section) => {
      const heading = section.querySelector("h2");
      const body = section.querySelector(".legal-sec__body");
      if (!heading || !body || heading.querySelector("button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-controls", body.id);
      button.setAttribute("aria-expanded", String(section.classList.contains("is-open")));
      button.append(...heading.childNodes);
      const icon = document.createElement("span");
      icon.className = "legal-sec__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "▼";
      button.append(icon);
      heading.append(button);
      button.addEventListener("click", () => setOpen(section, !section.classList.contains("is-open")));
    });
  };

  const restore = () => {
    sections.forEach((section) => {
      const button = section.querySelector("h2 > button");
      if (!button) return;
      button.querySelector(".legal-sec__icon")?.remove();
      button.replaceWith(...button.childNodes);
    });
  };

  // Sprungmarken (z. B. /datenschutz#kontaktformular) öffnen den passenden Abschnitt.
  const openFromHash = () => {
    const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    const section = target?.closest("[data-legal-sec]");
    if (section) {
      setOpen(section, true);
      target.scrollIntoView();
    }
  };

  const apply = () => (mobile.matches ? enhance() : restore());
  apply();
  openFromHash();
  mobile.addEventListener("change", apply);
  window.addEventListener("hashchange", openFromHash);
})();
