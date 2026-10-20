"use strict";

// Explicit contextual simulations. Existing audience/live recovery stays in activation.js.
const RECOVERY_REFERRALS = {
  unamigo: {name:"un amigo",percent:10},
  usainbolt: {name:"Usain Bolt",percent:50},
  hugo: {name:"Hugo",percent:80}
};
function cartRecoveryDecision(cents, referrer) {
  if (!Number.isSafeInteger(cents) || cents < 0) return null;
  if (Object.hasOwn(RECOVERY_REFERRALS, referrer || "")) return {kind:"referral",percent:RECOVERY_REFERRALS[referrer].percent,referrer};
  if (!cents) return null;
  return cents > 30000 ? {kind:"exit_discount",percent:10} : {kind:"exit_email",percent:0};
}
(() => {
  // Capture the first catalog request before app.js starts; UI waits for the Lab.
  let catalog = null, uiSync = () => {};
  const originalLoad = loadCatalog;
  loadCatalog = async function (...args) { const result = await originalLoad(...args); catalog = result; uiSync(); return result; };
  document.addEventListener("DOMContentLoaded", () => {
    const referralKey = "mt_v6_recovery_referrer", seenKey = "mt_v6_exit_recovery_seen";
    const queryValues = new URLSearchParams(location.search).getAll("vengodepartede");
    let engaged = false, seen = false, returnFocus = null, lastCampaign = null;
    const read = key => { try { return sessionStorage.getItem(key); } catch (error) { return null; } };
    const store = (key,value) => { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key,value); } catch (error) {} };
    const permitted = () => readAnalyticsConsent() === "granted";
    seen = read(seenKey) === "1";
    function referrer() {
      if (!permitted()) return null;
      if (queryValues.length) {
        const value = queryValues.length === 1 && Object.hasOwn(RECOVERY_REFERRALS,queryValues[0]) ? queryValues[0] : null;
        store(referralKey,value); return value;
      }
      const value = read(referralKey);
      return Object.hasOwn(RECOVERY_REFERRALS,value || "") ? value : null;
    }
    window.cartRecoveryDebug = {source:"contextual_simulation",campaign:null,exit:null};
    const campaign = document.createElement("section"); campaign.id = "recovery-campaign"; campaign.className = "recovery-campaign"; campaign.hidden = true;
    campaign.setAttribute("aria-labelledby","recovery-campaign-title");
    campaign.innerHTML = '<p class="eyebrow">Oferta de demostración</p><h2 id="recovery-campaign-title"></h2><p id="recovery-campaign-copy"></p><p class="muted">Descuento simulado: el total del checkout y del pedido se mantiene.</p><a class="button" id="recovery-campaign-link" href="cart.html">Volver al carrito</a>';
    document.querySelector(".site-header").after(campaign);
    const dialog = document.createElement("dialog"); dialog.id = "recovery-exit-dialog"; dialog.className = "recovery-exit-dialog";
    dialog.setAttribute("aria-labelledby","recovery-exit-title"); dialog.setAttribute("aria-describedby","recovery-exit-intro");
    dialog.innerHTML = '<h2 id="recovery-exit-title"></h2><p id="recovery-exit-intro"></p><a class="button" id="recovery-exit-continue" href="cart.html">Terminar mi compra</a><form id="recovery-email-form"><label for="recovery-email">Dime tu email (ficticio)</label><input id="recovery-email" type="email" autocomplete="off" required placeholder="alumno@example.test" aria-describedby="recovery-email-hint"><p id="recovery-email-hint" class="muted">Usa alumno@example.test. No se guarda ni se envía esta dirección.</p><button class="button" type="submit">Simular guardado del carrito</button></form><p id="recovery-exit-status" role="status" aria-live="polite"></p><button class="text-button" id="recovery-exit-close" type="button">Ahora no</button>';
    document.body.append(dialog);
    const email = document.getElementById("recovery-email"), form = document.getElementById("recovery-email-form"), status = document.getElementById("recovery-exit-status"), continueLink = document.getElementById("recovery-exit-continue");
    const section = document.createElement("section"); section.id = "recovery-lab";
    section.innerHTML = '<h3>Tres casos de recuperación de carrito</h3><ol><li>Audiencia: añade productos y cambia de página. La activación existente puede recordarte terminar la compra.</li><li>Intención de salida: carrito mayor de 300 €, oferta simulada del 10 %; hasta 300 €, solicitud de email ficticio.</li><li>Origen simulado: vengodepartede=unamigo (10 %), usainbolt (50 %) o hugo (80 %).</li></ol><p>Se requiere consentimiento analítico. En escritorio, mueve el cursor fuera por el borde superior; en móvil usa el botón. Es una señal de intención, no una confirmación de abandono.</p><button class="text-button" id="recovery-exit-simulate" type="button">Simular intención de salida</button><p id="recovery-lab-status" role="status" aria-live="polite"></p><p id="recovery-origin-links"></p><p>Una campaña de origen tiene prioridad sobre el popup: no se apilan descuentos. Las ofertas son simuladas y no cambian precios/pedidos. El email no crea un perfil ni envía correos.</p><pre id="recovery-debug"></pre>';
    const lab = document.getElementById("how-to-dialog"); lab.querySelector("#how-to-close").before(section);
    const links = document.getElementById("recovery-origin-links");
    for (const [value,offer] of Object.entries(RECOVERY_REFERRALS)) {
      const link = document.createElement("a"); link.href = "index.html?vengodepartede=" + value; link.textContent = value + " · " + offer.percent + " %"; links.append(link,document.createTextNode(" · "));
    }
    const clear = document.createElement("a"); clear.href = "index.html"; clear.id = "recovery-origin-clear"; clear.textContent = "Quitar campaña"; clear.onclick = () => store(referralKey,null); links.append(clear);
    function trace(action, explanation, surface) {
      if (typeof teachingTrace === "function") teachingTrace("EXPERIENCE",explanation,{source:"contextual_simulation",surface,action,eligible:true});
    }
    function close() { email.value = ""; if (dialog.open) dialog.close(); }
    function debug() { document.getElementById("recovery-debug").textContent = JSON.stringify(window.cartRecoveryDebug,null,2); }
    function synchronize() {
      if (!permitted()) { window.cartRecoveryDebug.exit = null; store(referralKey,null); store(seenKey,null); seen = false; close(); }
      if (!readCart().length) { seen = false; store(seenKey,null); }
      const origin = referrer(), allowedPage = document.body.dataset.page !== "confirmation";
      campaign.hidden = !origin || !allowedPage;
      window.cartRecoveryDebug.campaign = origin && allowedPage ? cartRecoveryDecision(0,origin) : null;
      if (!campaign.hidden) {
        const offer = RECOVERY_REFERRALS[origin];
        document.getElementById("recovery-campaign-title").textContent = "Obtén un " + offer.percent + " % de descuento";
        document.getElementById("recovery-campaign-copy").textContent = "Vienes de parte de " + offer.name + ". Continúa tu compra con esta oferta simulada.";
        const link = document.getElementById("recovery-campaign-link"), hasCart = readCart().length > 0;
        link.href = hasCart ? "cart.html" : "index.html"; link.textContent = hasCart ? "Volver al carrito" : "Ver colección";
        if (lastCampaign !== origin) trace("referral_" + offer.percent,"Oferta simulada por contexto de URL; no prueba un abandono ni modifica el pedido.","campaign");
        close();
      }
      lastCampaign = origin;
      if (dialog.open && (!catalog || !readCart().length)) close();
      debug();
    }
    function showExit(simulated = false) {
      const hint = document.getElementById("recovery-lab-status");
      if (!permitted()) { if (simulated) hint.textContent = "Acepta la analítica en Gestionar consentimiento para probar la activación."; return false; }
      if (referrer()) { if (simulated) hint.textContent = "Hay una campaña de origen activa. Usa Quitar campaña para probar el popup."; return false; }
      if (!catalog || document.body.dataset.page === "confirmation" || document.querySelector("#payment-form button:disabled")) return false;
      const cart = cartSummary(catalog);
      if (!cart.items.length || cart.unavailable || catalog.store.currency !== "EUR") { if (simulated) hint.textContent = "Añade productos disponibles al carrito para probar este caso."; return false; }
      if (dialog.open || (!simulated && (seen || document.visibilityState !== "visible" || document.querySelector("dialog[open]")))) return false;
      if (typeof dialog.showModal !== "function") return false;
      const decision = cartRecoveryDecision(Math.round(cart.total * 100),null);
      window.cartRecoveryDebug.exit = {...decision,trigger:simulated ? "lab_simulation" : "exit_intent",cart_cents:Math.round(cart.total * 100)};
      returnFocus = simulated ? document.getElementById("how-to-open") : document.activeElement;
      if (simulated && lab.open) lab.close();
      const discount = decision.kind === "exit_discount";
      document.getElementById("recovery-exit-title").textContent = discount ? "Obtén un 10 % de descuento" : "¿Te guardamos el carrito?";
      document.getElementById("recovery-exit-intro").textContent = discount ? "Tu carrito supera los 300 €. Oferta simulada para animarte a terminar la compra; el importe del pedido no cambia." : "Dime tu email ficticio para simular un recordatorio de tu carrito. No enviamos correos.";
      form.hidden = discount; email.disabled = discount; email.required = !discount; email.value = discount ? "" : "alumno@example.test";
      continueLink.hidden = !discount; status.textContent = ""; hint.textContent = "";
      seen = true; store(seenKey,"1"); dialog.showModal(); (discount ? continueLink : email).focus();
      trace(decision.kind,"Intención de salida: decisión contextual simulada según el importe actual del carrito, no una compra ni un envío.","exit"); debug(); return true;
    }
    document.getElementById("recovery-exit-simulate").onclick = () => showExit(true);
    document.getElementById("recovery-exit-close").onclick = close;
    continueLink.onclick = close;
    dialog.addEventListener("cancel", () => { email.value = ""; });
    dialog.addEventListener("close", () => { email.value = ""; if (returnFocus?.isConnected) returnFocus.focus(); });
    dialog.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const fields = [...dialog.querySelectorAll("a[href], input, button")].filter(field => !field.disabled && field.getClientRects().length);
      const first = fields[0], last = fields[fields.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    form.onsubmit = event => {
      event.preventDefault();
      if (!permitted() || !dialog.open) { close(); return; }
      if (email.value !== "alumno@example.test") { status.textContent = "Usa solo alumno@example.test para esta demostración, sin datos personales."; email.value = ""; email.focus(); return; }
      email.value = ""; status.textContent = "Simulación completada. Tu carrito sigue en esta pestaña; no se ha guardado una dirección ni enviado ningún correo.";
      trace("exit_email_simulated","Solicitud ficticia completada sin guardar ni transmitir email.","exit");
    };
    document.addEventListener("pointermove", event => { if (event.pointerType === "mouse" && event.clientY > 20) engaged = true; },{passive:true});
    document.addEventListener("mouseout", event => {
      if (engaged && event.relatedTarget === null && event.clientY <= 0 && window.matchMedia("(hover: hover) and (pointer: fine)").matches) showExit();
    });
    const originalWrite = writeCart;
    writeCart = function (cart) { const result = originalWrite(cart); close(); if (!cart.length) { seen = false; store(seenKey,null); } synchronize(); return result; };
    const originalContext = renderPrivacyContext;
    renderPrivacyContext = function () { originalContext(); synchronize(); };
    window.addEventListener("pageshow", () => synchronize());
    uiSync = synchronize;
    synchronize();
  });
})();
