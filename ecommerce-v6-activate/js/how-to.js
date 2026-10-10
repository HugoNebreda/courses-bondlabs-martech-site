"use strict";

// A local copy with only this version's instructions; no measurement or storage.
(() => {
  const guide = {
  "title": "V6 · Activate",
  "student": [
    "Acepta analítica; puedes validar una cuenta sintética del Club.",
    "Abre un producto road (Carbon Pro) y vuelve a home: running_interest.",
    "Activa Traza docente y observa el GET activation, surface=home y la decisión.",
    "Añade al carrito y visita Carrito: ‘Tu carrito te espera’.",
    "Compra ≥300 EUR (p. ej. tres Carbon Pro) o realiza tres compras; revisa confirmation.",
    "Con el profesor, cambia eligible en ACTIVATION_DECISIONS y llama refreshActivation() en Console.",
    "Repite: decisión live frente a standard; comprueba el Sheet real."
  ],
  "teacher": [
    "¿Qué decisión tomamos para esta audiencia en esta superficie?",
    "AUDIENCE → DECISION REQUEST → DECISION RESPONSE → EXPERIENCE.",
    "Home: running primero; cart: recordatorio; confirmation: reconocimiento.",
    "La decisión remota puede dar standard; timeout/error nunca inventan oferta.",
    "Activar puede personalizar contenido o agradecer una compra, sin descuentos ni anuncios."
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
