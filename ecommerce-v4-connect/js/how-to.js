"use strict";

// A local copy with only this version's instructions; no measurement or storage.
(() => {
  const guide = {
  "title": "V4 · Connect",
  "student": [
    "Acepta analítica y activa Traza docente.",
    "Añade un producto al carrito.",
    "Inspecciona Console y window.dataLayer.",
    "Abre Tag Management System y observa rutas/destinos.",
    "Activa ‘Demo: compra medida por vía directa + TMS’.",
    "Completa una compra con 42424242.",
    "Compara dos purchase con el mismo transaction_id y un único ORDERS."
  ],
  "teacher": [
    "dataLayer es la interfaz entre web y distribución.",
    "Tag Management System enruta hacia destinos.",
    "Digital Analytics aquí es un adapter local simulado.",
    "Dos mediciones no son dos ventas: consulta ORDERS."
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
