// Navigation nach dem WAI-ARIA-Disclosure-Muster: Menü (mobil als Bottom-Sheet) und Mega-Menü.
(() => {
  const mobile = window.matchMedia("(max-width: 47.99rem)");
  const navToggle = document.querySelector('[data-toggle="nav"]');
  const nav = navToggle && document.getElementById(navToggle.getAttribute("aria-controls"));
  if (navToggle && nav) {
    const scrim = document.querySelector("[data-nav-scrim]");
    const label = navToggle.querySelector("[data-nav-label]");
    const closeButton = nav.querySelector("[data-nav-close]");
    const focusable = () =>
      [...nav.querySelectorAll("a[href], button:not([disabled])")].filter((el) => el.offsetParent !== null);

    const setNav = (open, { restoreFocus = false } = {}) => {
      navToggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      if (label) label.textContent = open ? "Schliessen" : "Menü";
      const sheet = open && mobile.matches;
      document.documentElement.classList.toggle("nav-open", sheet);
      if (scrim) scrim.hidden = !sheet;
      if (sheet) (closeButton ?? focusable()[0])?.focus();
      if (!open && restoreFocus) navToggle.focus();
    };

    navToggle.addEventListener("click", () => setNav(navToggle.getAttribute("aria-expanded") !== "true"));
    closeButton?.addEventListener("click", () => setNav(false, { restoreFocus: true }));
    scrim?.addEventListener("click", () => setNav(false, { restoreFocus: true }));
    mobile.addEventListener("change", () => setNav(false));

    document.addEventListener("keydown", (event) => {
      if (!nav.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        setNav(false, { restoreFocus: true });
        return;
      }
      // Bottom-Sheet: Fokus bleibt im Menü, solange es offen ist.
      if (event.key === "Tab" && mobile.matches) {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  const menuItem = document.querySelector("[data-menu]");
  const menuButton = menuItem?.querySelector('[data-toggle="menu"]');
  const menu = menuButton && document.getElementById(menuButton.getAttribute("aria-controls"));
  if (!menuItem || !menuButton || !menu) return;

  const setMenu = (open) => {
    menuButton.setAttribute("aria-expanded", String(open));
    menu.hidden = !open;
  };

  menuButton.addEventListener("click", () => setMenu(menuButton.getAttribute("aria-expanded") !== "true"));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuButton.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!menuItem.contains(event.target)) setMenu(false);
  });

  menuItem.addEventListener("focusout", (event) => {
    if (event.relatedTarget && !menuItem.contains(event.relatedTarget)) setMenu(false);
  });
})();

// Akut-Seitenreiter: auf-/zuklappen, Escape und Klick ausserhalb schliessen.
(() => {
  const tab = document.querySelector("[data-akut-tab]");
  const button = tab?.querySelector(".akut-tab__toggle");
  if (!tab || !button) return;

  const setOpen = (open) => {
    tab.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
  };

  button.addEventListener("click", () => setOpen(!tab.classList.contains("is-open")));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && tab.classList.contains("is-open")) {
      setOpen(false);
      button.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (tab.classList.contains("is-open") && !tab.contains(event.target)) setOpen(false);
  });
})();

// "Weiterlesen": lange Texte mobil auf wenige Zeilen kürzen.
(() => {
  document.querySelectorAll("[data-clamp-toggle]").forEach((button) => {
    const text = document.getElementById(button.getAttribute("aria-controls"));
    if (!text) return;
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      text.classList.toggle("is-expanded", open);
      button.textContent = open ? "Weniger anzeigen" : "Weiterlesen";
    });
  });
})();
