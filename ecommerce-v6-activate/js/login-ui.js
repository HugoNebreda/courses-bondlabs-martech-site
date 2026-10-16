"use strict";

// Presentation only: keep the existing form, validation and identity semantics.
(() => {
  const form = document.getElementById("demo-signin");
  const status = document.getElementById("signin-status");
  const identityPanel = form.closest("details");
  const controls = document.createElement("div");
  controls.className = "demo-login-controls";
  const open = document.createElement("button");
  open.type = "button"; open.id = "login-open"; open.className = "demo-login-open";
  open.textContent = "Acceso demo";
  open.setAttribute("aria-haspopup", "dialog"); open.setAttribute("aria-controls", "login-dialog"); open.setAttribute("aria-expanded", "false");
  const summary = document.createElement("span"); summary.id = "login-summary";
  summary.setAttribute("role", "status"); summary.setAttribute("aria-live", "polite");
  controls.append(open, summary);
  document.querySelector(".v6-tools").append(controls);

  const dialog = document.createElement("dialog"); dialog.id = "login-dialog"; dialog.className = "demo-login-dialog";
  dialog.setAttribute("aria-labelledby", "login-title"); dialog.setAttribute("aria-describedby", "login-intro");
  const heading = document.createElement("h2"); heading.id = "login-title"; heading.textContent = "Iniciar sesión demo";
  const intro = document.createElement("p"); intro.id = "login-intro";
  intro.textContent = "Elige una cuenta de la tabla e introduce su usuario y código. Son datos ficticios: no utilices datos personales.";
  const permission = document.createElement("p"); permission.className = "demo-login-permission";
  permission.textContent = "El enlace al perfil requiere aceptar la analítica en Gestionar consentimiento. No la aceptamos por ti. Puedes seguir comprando como invitado; las compras anteriores al acceso no se atribuyen después a tu perfil.";
  // Replace only the existing UI account-list paragraph, keeping profile/audience explanations in the Lab.
  const accountList = identityPanel.querySelector("p");
  const accountNote = accountList.nextElementSibling;
  accountList.remove();
  const tableWrap = document.createElement("div"); tableWrap.className = "demo-login-accounts";
  const table = document.createElement("table");
  const caption = document.createElement("caption"); caption.textContent = "Cuentas ficticias para practicar"; table.append(caption);
  const head = document.createElement("thead"), row = document.createElement("tr");
  for (const label of ["Usuario", "Código", "Club"]) { const cell = document.createElement("th"); cell.scope = "col"; cell.textContent = label; row.append(cell); }
  head.append(row); table.append(head);
  const body = document.createElement("tbody");
  for (const [alias, account] of Object.entries(DEMO_ACCOUNTS)) {
    if (account.teacher_only) continue;
    const row = document.createElement("tr");
    for (const value of [alias, account.code, account.club_id.replace("club_", "Club ")]) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
    body.append(row);
  }
  table.append(body); tableWrap.append(table);
  const close = document.createElement("button"); close.id = "login-close"; close.type = "button"; close.className = "text-button"; close.textContent = "Cerrar sin cambiar";
  dialog.append(heading, intro, permission, form, status, tableWrap, accountNote, close);
  document.body.append(dialog);
  const labHint = document.createElement("p"); labHint.textContent = "Para iniciar sesión, usa Acceso demo junto a Laboratorio y Gestionar consentimiento.";
  identityPanel.querySelector("summary").after(labHint);

  function renderSummary() {
    const identity = analyticsIdentity();
    const account = identity && identity.user_id && Object.entries(DEMO_ACCOUNTS).find(([, value]) => value.user_id === identity.user_id);
    summary.textContent = account ? account[0] + " · " + account[1].user_id : "Invitado";
  }
  const renderContext = renderPrivacyContext;
  renderPrivacyContext = function () { renderContext(); renderSummary(); };
  const linkAccount = linkDemoAccount;
  linkDemoAccount = function (...args) {
    const result = linkAccount(...args);
    if (result.ok) { renderSummary(); if (dialog.open) dialog.close(); }
    return result;
  };
  open.onclick = () => {
    for (const id of ["how-to-dialog", "consent-dialog"]) { const other = document.getElementById(id); if (other.open) other.close(); }
    status.textContent = "";
    document.getElementById("demo-code").value = "";
    dialog.showModal(); open.setAttribute("aria-expanded", "true"); document.getElementById("demo-alias").focus();
  };
  close.onclick = () => { document.getElementById("demo-code").value = ""; dialog.close(); };
  dialog.addEventListener("cancel", () => { document.getElementById("demo-code").value = ""; });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const fields = [...dialog.querySelectorAll("input, button")].filter(field => !field.disabled);
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener("close", () => {
    document.getElementById("demo-code").value = "";
    open.setAttribute("aria-expanded", "false"); open.focus();
  });
  renderSummary();
})();
