"use strict";

// A local copy with only this version's instructions; no measurement or storage.
(() => {
  const guide = {
  "title": "V2 · Collect",
  "student": [
    "Abre DevTools: Console y Network.",
    "Activa Traza docente y abre un producto.",
    "Añádelo al carrito y localiza el POST al collector /exec.",
    "Inspecciona event_name, event_id y parámetros de items.",
    "Busca ese event_id en RAW_EVENTS y EVENT_ITEMS del Sheet del profesor."
  ],
  "teacher": [
    "SUCESO → EVENTO → HTTP → FILA.",
    "Correlaciona por event_id; run_id localiza el ejercicio.",
    "Un request intentado no confirma una fila: compruébala en el Sheet."
  ]
};
  const button = document.createElement("button");
  button.id = "how-to-open";
  button.type = "button";
  button.className = "how-to-open";
  button.textContent = "ⓘ Cómo probar esta versión";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-controls", "how-to-dialog");
  const dialog = document.createElement("dialog");
  dialog.id = "how-to-dialog";
  dialog.className = "how-to-dialog";
  dialog.setAttribute("aria-labelledby", "how-to-title");
  const title = document.createElement("h2");
  title.id = "how-to-title";
  title.textContent = guide.title + " · Cómo probar";
  dialog.append(title);
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
  close.textContent = "Cerrar guía";
  close.autofocus = true;
  dialog.append(close);
  document.querySelector(".site-header").append(button);
  document.body.append(dialog);
  button.addEventListener("click", () => dialog.showModal());
  close.addEventListener("click", () => dialog.close());
  // Native dialog supplies focus containment and Escape, then restores focus.
  dialog.addEventListener("close", () => button.focus());
})();
