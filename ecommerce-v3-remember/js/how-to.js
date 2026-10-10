"use strict";

// A local copy with only this version's instructions; no measurement or storage.
(() => {
  const guide = {
  "title": "V3 · Remember",
  "student": [
    "Abre Laboratorio → Cómo probar esta versión. Activa DevTools → Preserve log.",
    "Abre un producto y añade al carrito; observa Network.",
    "En Preferencias de privacidad, acepta analítica opcional.",
    "Realiza nuevas acciones; no se recuperan las anteriores.",
    "Inspecciona visitor_id y session_id en contexto y payload.",
    "Retira el permiso, repite y comprueba que puedes seguir comprando."
  ],
  "teacher": [
    "Consentimiento controla la observación opcional.",
    "visitor_id y session_id son contexto anónimo, no una persona.",
    "No hay backfill al aceptar; retirar elimina contexto analítico.",
    "El pedido operativo es independiente de analítica."
  ]
};
  const button = document.createElement("button");
  button.id = "how-to-open";
  button.type = "button";
  button.className = "how-to-open";
  button.textContent = "🧪 Laboratorio";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "how-to-dialog");
  button.setAttribute("aria-expanded", "false");
  const dialog = document.createElement("dialog");
  dialog.id = "how-to-dialog";
  dialog.className = "how-to-dialog";
  dialog.setAttribute("aria-labelledby", "how-to-title");
  dialog.setAttribute("aria-modal", "false");
  const title = document.createElement("h2");
  title.id = "how-to-title";
  title.textContent = guide.title + " · Laboratorio";
  dialog.append(title);
  const helpTitle = document.createElement("h3");
  helpTitle.textContent = "Cómo probar esta versión";
  dialog.append(helpTitle);
  for (const [heading, steps] of [["Para el alumno", guide.student], ["Para el profesor", guide.teacher]]) {
    const section = document.createElement("section");
    const label = document.createElement("h3");
    label.textContent = heading;
    const list = document.createElement("ol");
    for (const text of steps) {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    }
    section.append(label, list);
    dialog.append(section);
  }
  const close = document.createElement("button");
  close.type = "button";
  close.id = "how-to-close";
  close.textContent = "Cerrar laboratorio";
  close.autofocus = true;
  dialog.append(close);
  document.querySelector(".site-header").append(button);
  document.body.append(dialog);
  // Move existing controls without changing their handlers or measurement logic.
  for (const node of document.querySelectorAll("body > .measurement-note")) {
    if (["activation-offer", "activation-running", "activation-loyalty"].includes(node.id)) continue;
    if (node.querySelector("#duplicate-measurement")) {
      const section = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = "Simulaciones";
      const explanation = document.createElement("p");
      explanation.textContent = "Al activar duplicación: 1 pedido operativo, 2 mediciones purchase, mismo transaction_id y diferentes event_id. La ruta normal emite un evento canónico.";
      section.append(heading, explanation, node.querySelector("#duplicate-measurement").closest("label"));
      dialog.append(section);
    }
    dialog.append(node);
  }
  if (document.getElementById("teaching-trace")) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    heading.textContent = "Historial de Traza docente";
    const tip = document.createElement("p");
    tip.textContent = "DevTools → Preserve log mantiene la Console entre páginas. Aquí se conservan las últimas 60 entradas de esta versión y pestaña.";
    const entries = document.createElement("pre");
    entries.id = "teaching-trace-history";
    section.append(heading, tip, entries);
    dialog.append(section);
    if (typeof renderTeachingTraceHistory === "function") renderTeachingTraceHistory();
  }
  button.addEventListener("click", () => { dialog.show(); button.setAttribute("aria-expanded", "true"); close.focus(); });
  close.addEventListener("click", () => dialog.close());
  document.addEventListener("keydown", event => {
    if (dialog.open && event.key === "Escape") { event.preventDefault(); dialog.close(); }
  });
  // Non-modal drawer leaves commerce usable; close restores focus.
  dialog.addEventListener("close", () => { button.setAttribute("aria-expanded", "false"); button.focus(); });
})();
