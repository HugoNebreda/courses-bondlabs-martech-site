"use strict";

// A separate received-history view; local browser memory remains independent.
window.MarTechSandbox = window.MarTechSandbox || {};
(() => {
  const pendingKey = "mt_v6_customer_pending";
  let panel, title, metrics, status, refreshButton;
  let request = null, script = null, timeout = null, scheduled = null;
  let lastEvent = null, confirmed = null, confirmedUser = null, receivedTransaction = null;
  window.MarTechSandbox.customerReceipt = () => {
    const identity = currentCustomer();
    return identity && identity.user_id === confirmedUser && receivedTransaction ? {user_id:confirmedUser,transaction_id:receivedTransaction,eligible:!!confirmed?.totals.some(t => t.currency === "EUR" && t.cents >= 1000000)} : null;
  };
  function notify() { window.dispatchEvent(new Event("customerprofilechange")); }

  function currentCustomer() {
    if (readAnalyticsConsent() !== "granted") return null;
    const identity = analyticsIdentity();
    return identity && identity.user_id && classroomLink(identity) ? identity : null;
  }
  function signature(identity) { return JSON.stringify([identity.user_id, identity.visitor_id, identity.session_id]); }
  function cancelRead() {
    clearTimeout(timeout); clearTimeout(scheduled);
    if (script) script.remove();
    script = null; request = null;
  }
  function pendingPurchase(user) {
    try {
      const value = JSON.parse(sessionStorage.getItem(pendingKey) || "null");
      return value && value.user_id === user && /^txn_[a-f0-9-]{36}$/.test(value.transaction_id) ? value.transaction_id : null;
    } catch (error) { return null; }
  }
  function clearPending() { try { sessionStorage.removeItem(pendingKey); } catch (error) {} }
  function resetCustomer() {
    cancelRead(); clearPending(); lastEvent = null; confirmed = null; confirmedUser = null; receivedTransaction = null; notify();
    if (panel) { panel.hidden = true; metrics.replaceChildren(); status.textContent = ""; }
  }
  function renderProfile(profile) {
    metrics.replaceChildren();
    const totals = profile.totals.map(total => new Intl.NumberFormat("es-ES", {style:"currency",currency:total.currency}).format(total.cents / 100));
    const lines = [
      profile.session_count + (profile.session_count === 1 ? " sesión vinculada" : " sesiones vinculadas"),
      profile.product_count + (profile.product_count === 1 ? " producto visto" : " productos vistos") +
        (profile.most_viewed ? " · El más visto: " + profile.most_viewed.item_name + " (" + profile.most_viewed.views + ")" : ""),
      profile.purchase_count + (profile.purchase_count === 1 ? " compra identificada" : " compras identificadas") + " · " + (totals.join(" + ") || "0,00 €")
    ];
    for (const line of lines) { const item = document.createElement("span"); item.textContent = line; metrics.append(item); }
  }
  function validProfile(value) {
    const count = n => Number.isSafeInteger(n) && n >= 0;
    return value && count(value.session_count) && count(value.product_count) && count(value.total_views) && count(value.purchase_count) &&
      Array.isArray(value.totals) && value.totals.every(total => total && /^[A-Z]{3}$/.test(total.currency) && count(total.cents)) &&
      (value.most_viewed === null || value.most_viewed && typeof value.most_viewed.item_id === "string" &&
        typeof value.most_viewed.item_name === "string" && count(value.most_viewed.views));
  }
  function readFailure(message) {
    if (!request) return;
    request.finished = true; clearTimeout(timeout);
    status.textContent = message;
    refreshButton.disabled = false;
  }
  window.MarTechSandbox.receiveCustomerProfile = result => {
    const identity = currentCustomer();
    if (!request || request.finished || !identity || signature(identity) !== request.signature ||
        !result || result.request_id !== request.id || result.user_id !== identity.user_id) return;
    if (!result.ok) { readFailure("No se pudo recuperar el histórico. Puedes volver a intentarlo."); return; }
    if (result.sandbox_version !== "v6-activate" || result.source !== "received_events" || !validProfile(result.profile) ||
        typeof result.awaited_event_received !== "boolean" || typeof result.awaited_purchase_received !== "boolean" ||
        !Number.isFinite(Date.parse(result.generated_at))) return;
    request.finished = true; clearTimeout(timeout); refreshButton.disabled = false;
    confirmed = result.profile; confirmedUser = identity.user_id;
    renderProfile(confirmed);
    if (result.awaited_purchase_received) {
      receivedTransaction = pendingPurchase(identity.user_id) || receivedTransaction;
      // Keep the received purchase marker in this session for confirmation reloads.
    }
    notify();
    if (result.awaited_event_received && result.awaited_purchase_received) {
      status.textContent = "Histórico recibido del servicio · Solo actividad ya identificada al ocurrir.";
    } else {
      status.textContent = "Histórico recibido; la última actividad todavía no aparece en el servicio.";
      const attempt = request.attempt;
      if (attempt < 3) scheduled = setTimeout(() => refreshProfile(attempt + 1), 2000);
    }
    if (Number.isSafeInteger(result.profile.seed_event_count) && result.profile.seed_event_count > 0)
      status.textContent += " Incluye datos ficticios precargados por el docente.";
  };
  function refreshProfile(attempt = 0) {
    if (!panel) return;
    const identity = currentCustomer();
    if (!identity) { resetCustomer(); return; }
    cancelRead();
    if (confirmedUser !== identity.user_id) { confirmed = null; metrics.replaceChildren(); }
    panel.hidden = false;
    const alias = Object.entries(DEMO_ACCOUNTS).find(([, account]) => account.user_id === identity.user_id)?.[0];
    title.textContent = "Tu perfil de cliente · " + (alias ? alias + " · " : "") + identity.user_id;
    if (!window.CLASSROOM_ENDPOINT) {
      status.textContent = "Histórico remoto sin configurar. La memoria del navegador sigue disponible.";
      refreshButton.disabled = false; return;
    }
    const id = "cp_" + crypto.randomUUID();
    request = {id, signature:signature(identity), finished:false, attempt};
    status.textContent = "Consultando el histórico del usuario…";
    refreshButton.disabled = true;
    try {
      const url = new URL(window.CLASSROOM_ENDPOINT, location.href);
      if (!["https:","http:"].includes(url.protocol)) throw Error("Invalid profile URL");
      url.searchParams.set("operation","customer_profile"); url.searchParams.set("request_id",id);
      url.searchParams.set("sandbox_version","v6-activate"); url.searchParams.set("user_id",identity.user_id);
      if (lastEvent && lastEvent.user_id === identity.user_id) url.searchParams.set("await_event_id",lastEvent.id);
      const transaction = pendingPurchase(identity.user_id);
      if (transaction) url.searchParams.set("await_transaction_id",transaction);
      script = document.createElement("script"); script.src = url.href;
      const active = request;
      script.onerror = () => { if (request === active) readFailure("Servicio no disponible. La compra sigue funcionando."); };
      timeout = setTimeout(() => { if (request === active) readFailure("El histórico ha tardado demasiado. Vuelve a intentarlo."); },10000);
      document.head.append(script);
    } catch (error) { readFailure("No se pudo consultar el histórico. La compra sigue funcionando."); }
  }
  function scheduleRefresh() {
    cancelRead();
    if (panel && !panel.hidden) { status.textContent = "Actualizando el hist\u00f3rico del usuario\u2026"; refreshButton.disabled = true; }
    scheduled = setTimeout(() => refreshProfile(),500);
  }
  window.addEventListener("pageshow", event => { if (event.persisted) scheduleRefresh(); });
  const originalTrack = track;
  track = function (...args) {
    const event = originalTrack(...args);
    if (event && event.identity.user_id) {
      lastEvent = {id:event.event_id,user_id:event.identity.user_id};
      if (event.event_name === "purchase") try {
        sessionStorage.setItem(pendingKey,JSON.stringify({user_id:event.identity.user_id,transaction_id:event.ecommerce.transaction_id}));
      } catch (error) {}
      scheduleRefresh();
    }
    return event;
  };
  const originalLink = linkDemoAccount;
  linkDemoAccount = function (...args) { const result = originalLink(...args); if (result.ok) scheduleRefresh(); return result; };
  const originalRender = renderPrivacyContext;
  renderPrivacyContext = function () { originalRender(); if (!currentCustomer()) resetCustomer(); };
  document.addEventListener("DOMContentLoaded", () => {
    panel = document.createElement("section"); panel.id = "customer-profile"; panel.className = "v6-customer-profile"; panel.hidden = true;
    title = document.createElement("h2"); title.id = "customer-profile-title"; panel.setAttribute("aria-labelledby",title.id);
    metrics = document.createElement("div"); metrics.id = "customer-profile-metrics";
    status = document.createElement("p"); status.id = "customer-profile-status"; status.setAttribute("role","status"); status.setAttribute("aria-live","polite");
    refreshButton = document.createElement("button"); refreshButton.type = "button"; refreshButton.textContent = "Actualizar perfil";
    refreshButton.onclick = () => refreshProfile();
    panel.append(title,metrics,status,refreshButton);
    document.querySelector(".v6-tools").after(panel);
    refreshProfile();
  });
})();
