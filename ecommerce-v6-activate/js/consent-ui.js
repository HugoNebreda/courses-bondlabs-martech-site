"use strict";

// V6 consent presentation. Existing consent/identity/measurement rules stay in consent.js.
(() => {
  const open = document.getElementById("privacy-open");
  const preferences = document.getElementById("privacy-preferences");
  const lab = document.getElementById("how-to-open");
  const toolbar = document.createElement("div");
  toolbar.className = "v6-tools";
  const controls = document.createElement("div");
  controls.className = "v6-consent-controls";
  const summary = document.createElement("span");
  summary.id = "privacy-summary";
  summary.setAttribute("role", "status");
  summary.setAttribute("aria-live", "polite");
  open.textContent = "Gestionar consentimiento";
  open.className = "v6-consent-open";
  open.setAttribute("aria-haspopup", "dialog");
  open.setAttribute("aria-controls", "consent-dialog");
  open.setAttribute("aria-expanded", "false");
  controls.append(open, summary);
  toolbar.append(lab, controls);
  document.querySelector(".site-header").append(toolbar);

  const dialog = document.createElement("dialog");
  dialog.id = "consent-dialog";
  dialog.className = "v6-consent-dialog";
  dialog.setAttribute("aria-labelledby", "consent-title");
  dialog.setAttribute("aria-describedby", "consent-intro");
  const title = document.createElement("h2");
  title.id = "consent-title";
  title.textContent = "Tú decides qué recuerda esta tienda";
  const intro = preferences.querySelector("p");
  intro.id = "consent-intro";
  intro.textContent = "El carrito y la compra funcionan siempre. La analítica es opcional y puedes cambiar tu elección en cualquier momento.";
  preferences.prepend(title);
  const choices = document.createElement("div");
  choices.className = "v6-consent-choices";
  for (const [id, heading, explanation] of [
    ["analytics-grant", "Si aceptas", "Las nuevas acciones instrumentadas podrán medirse con un identificador anónimo del navegador y otro de sesión. No identifican a una persona. El resumen de actividad se conserva en este navegador al volver. No se recuperan las acciones anteriores al permiso."],
    ["analytics-deny", "Si rechazas o retiras el permiso", "Las siguientes acciones no generan medición analítica opcional y se eliminan los identificadores analíticos y el resumen de actividad de este navegador. Puedes seguir comprando. Esto no borra datos ya recibidos por el servicio."]
  ]) {
    const section = document.createElement("section");
    const headingNode = document.createElement("h3");
    headingNode.textContent = heading;
    const text = document.createElement("p");
    text.textContent = explanation;
    section.append(headingNode, text, document.getElementById(id));
    choices.append(section);
  }
  intro.after(choices);
  const close = document.getElementById("privacy-close");
  close.textContent = "Cerrar sin cambiar";
  dialog.append(preferences);
  document.body.append(dialog);
  preferences.hidden = true;

  function renderSummary() {
    const labels = { unset: "Pendiente", granted: "Aceptada", denied: "Rechazada" };
    const consent = readAnalyticsConsent();
    summary.textContent = "Analítica: " + labels[consent];
    summary.dataset.consent = consent;
  }
  const renderContext = renderPrivacyContext;
  renderPrivacyContext = function () {
    renderContext();
    renderSummary();
  };
  const setConsent = setAnalyticsConsent;
  setAnalyticsConsent = function (choice) {
    const result = setConsent(choice);
    if ((choice === "granted" || choice === "denied") && dialog.open) dialog.close();
    return result;
  };
  function openConsent() {
    const labDialog = document.getElementById("how-to-dialog");
    if (labDialog.open) labDialog.close();
    preferences.hidden = false;
    dialog.showModal();
    open.setAttribute("aria-expanded", "true");
    close.focus();
  };
  function bindControls() {
    open.onclick = openConsent;
    close.onclick = () => dialog.close();
  }
  const initializeControls = initializePrivacyControls;
  initializePrivacyControls = function () {
    initializeControls();
    preferences.hidden = !dialog.open;
    bindControls();
  };
  bindControls();
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const buttons = [...dialog.querySelectorAll("button")];
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener("close", () => {
    preferences.hidden = true;
    open.setAttribute("aria-expanded", "false");
    open.focus();
  });
  renderSummary();
})();
