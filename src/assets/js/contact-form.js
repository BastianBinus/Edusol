// Kontaktformular: Vorauswahl per ?thema=, optionale Felder, Akut-Hinweis,
// barrierefreie Validierung und Versand per fetch mit nativem Fallback.
(() => {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");
  const success = document.getElementById("form-success");
  if (!form || !status) return;

  // Thema aus der URL vorauswählen (z. B. von einer Wirkungsfeld-Seite)
  const crisisHint = document.getElementById("crisis-hint");
  const topics = [...form.querySelectorAll('input[name="thema"]')];
  const updateCrisisHint = () => {
    const checked = topics.find((t) => t.checked);
    if (crisisHint) crisisHint.hidden = checked?.dataset.slug !== "krisenmanagement";
  };
  const preset = new URLSearchParams(location.search).get("thema");
  const presetInput = topics.find((t) => t.dataset.slug === preset);
  if (presetInput) presetInput.checked = true;
  topics.forEach((t) => t.addEventListener("change", updateCrisisHint));
  updateCrisisHint();

  // Telefon & Organisation erst auf Wunsch einblenden
  const moreToggle = document.getElementById("more-toggle");
  const moreFields = document.getElementById("more-fields");
  if (moreToggle && moreFields) {
    moreToggle.hidden = false;
    moreToggle.setAttribute("aria-expanded", "false");
    moreFields.hidden = true;
    moreToggle.addEventListener("click", () => {
      moreFields.hidden = false;
      moreToggle.setAttribute("aria-expanded", "true");
      moreToggle.hidden = true;
      document.getElementById("telefon")?.focus();
    });
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const submitLabel = submitButton.textContent;
  const fallbackEmail = form.dataset.fallbackEmail;

  const labelText = (field) => form.querySelector(`label[for="${field.id}"]`)?.textContent.replace(/^\d+\.\s*/, "").trim() ?? "dieses Feld";

  const setError = (field, text) => {
    const error = document.getElementById(`${field.id}-error`);
    if (text) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
    if (error) {
      error.textContent = text ?? "";
      error.hidden = !text;
    }
  };

  const validate = (field) => {
    if (field.validity.valid) {
      setError(field, null);
      return true;
    }
    setError(
      field,
      field.validity.typeMismatch
        ? "Bitte eine gültige E-Mail-Adresse angeben, z. B. name@schule.ch."
        : `Bitte «${labelText(field)}» ausfüllen.`,
    );
    return false;
  };

  const required = [...form.querySelectorAll("[required]")];
  required.forEach((field) => {
    field.addEventListener("blur", () => field.value !== "" && validate(field));
    field.addEventListener("input", () => field.getAttribute("aria-invalid") === "true" && validate(field));
  });

  // Mobil: Formular als Assistent in drei Schritten (Fortschritt oben, Aktionen unten).
  const mobile = window.matchMedia("(max-width: 47.99rem)");
  const steps = [...form.querySelectorAll("[data-step]")];
  const wizardNav = form.querySelector("[data-wizard-nav]");
  const backButton = form.querySelector("[data-wizard-back]");
  const nextButton = form.querySelector("[data-wizard-next]");
  const progress = document.querySelector("[data-wizard-progress]");
  const count = document.querySelector("[data-wizard-count]");
  const bar = document.querySelector("[data-wizard-bar]");
  const topicLabel = form.querySelector("[data-wizard-topic]");
  let current = 1;

  const stepOf = (field) => Number(field.closest("[data-step]")?.dataset.step ?? steps.length);

  const nextLabel = () => {
    if (current === steps.length) return "Anfrage senden";
    if (current === 1 && !topics.some((t) => t.checked)) return "Überspringen";
    return "Weiter";
  };

  const showStep = (n, { focus = false } = {}) => {
    current = n;
    form.dataset.current = String(n);
    if (count) count.textContent = `Schritt ${n} von ${steps.length}`;
    if (bar) bar.style.width = `${(n / steps.length) * 100}%`;
    if (backButton) backButton.hidden = n === 1;
    if (nextButton) nextButton.textContent = nextLabel();
    const checked = topics.find((t) => t.checked);
    if (topicLabel) {
      topicLabel.hidden = !checked;
      topicLabel.textContent = checked ? `Thema: ${checked.value}` : "";
    }
    if (focus && mobile.matches) {
      const title = steps[n - 1].querySelector(".form-step__title");
      title?.setAttribute("tabindex", "-1");
      title?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  };

  if (steps.length && wizardNav && nextButton) {
    topics.forEach((t) => t.addEventListener("change", () => (nextButton.textContent = nextLabel())));
    backButton?.addEventListener("click", () => showStep(Math.max(1, current - 1), { focus: true }));
    nextButton.addEventListener("click", () => {
      if (current < steps.length) {
        const invalid = required.filter((field) => stepOf(field) === current && !validate(field));
        if (invalid.length) {
          invalid[0].focus();
          return;
        }
        showStep(current + 1, { focus: true });
        return;
      }
      form.requestSubmit();
    });
    showStep(1);
  }

  const setStatus = (type, text) => {
    status.className = `form-status form-status--${type}`;
    status.textContent = text;
    status.hidden = false;
  };

  const setBusy = (busy) => {
    submitButton.disabled = busy;
    if (nextButton) {
      nextButton.disabled = busy;
      nextButton.textContent = busy ? "Wird gesendet …" : nextLabel();
    }
    submitButton.textContent = busy ? "Wird gesendet …" : submitLabel;
    form.setAttribute("aria-busy", String(busy));
  };

  if (!window.fetch) return;
  form.noValidate = true;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const invalid = required.filter((field) => !validate(field));
    if (invalid.length) {
      if (steps.length) showStep(stepOf(invalid[0]));
      setStatus("error", `Bitte ${invalid.length === 1 ? "ein Feld" : `${invalid.length} Felder`} ergänzen.`);
      invalid[0].focus();
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        form.reset();
        form.hidden = true;
        if (progress) progress.hidden = true;
        status.hidden = true;
        if (success) {
          success.hidden = false;
          success.focus();
        }
        return;
      }
      // Formspree: Lehnt der Dienst die AJAX-Übermittlung ab, klassisch absenden.
      const external = new URL(form.action, location.href).origin !== location.origin;
      if (external && response.status !== 422) {
        HTMLFormElement.prototype.submit.call(form);
        return;
      }

      // Eigene Funktion: Feldfehler vom Server direkt an den Feldern anzeigen.
      const result = await response.json().catch(() => ({}));
      const fieldErrors = Object.entries(result.errors ?? {})
        .map(([name, message]) => [form.elements.namedItem(name), message])
        .filter(([field]) => field instanceof HTMLElement && field.id);
      if (fieldErrors.length) {
        const more = document.getElementById("more-fields");
        if (steps.length) showStep(Math.min(...fieldErrors.map(([field]) => stepOf(field))));
        fieldErrors.forEach(([field, message]) => {
          if (more?.contains(field)) more.hidden = false;
          setError(field, message);
        });
        setStatus("error", "Bitte prüft die markierten Angaben.");
        fieldErrors[0][0].focus();
        return;
      }
      setStatus("error", `Die Nachricht konnte gerade nicht gesendet werden. Bitte versucht es später erneut oder schreibt direkt an ${fallbackEmail}.`);
    } catch {
      setStatus("error", `Die Verbindung ist fehlgeschlagen. Bitte versucht es später erneut oder schreibt direkt an ${fallbackEmail}.`);
    } finally {
      setBusy(false);
    }
  });
})();
