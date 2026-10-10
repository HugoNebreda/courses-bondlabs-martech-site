"use strict";

// A local copy with only this version's instructions; no measurement or storage.
(() => {
  const guide = {
  "title": "V3 · Remember",
  "student": [
    "En un contexto nuevo, empieza sin aceptar analítica.",
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
