"use strict";

// V3: consented memory of this browser, not a known person or confirmed Sheet receipt.
(() => {
  const key = "mt_v3_browser_memory";
  let storageUnavailable = false;

  function emptyMemory(visitorId) {
    return { schema_version: 1, visitor_id: visitorId, pages: 0, sessions: [], products: [], purchases: [], currency: "EUR" };
  }

  function validMemory(value) {
    const count = n => Number.isSafeInteger(n) && n >= 0;
    return value && value.schema_version === 1 && typeof value.visitor_id === "string" &&
      count(value.pages) && Array.isArray(value.sessions) && value.sessions.every(id => typeof id === "string") &&
      new Set(value.sessions).size === value.sessions.length &&
      Array.isArray(value.products) && value.products.every(p => p && typeof p.id === "string" && typeof p.name === "string" && count(p.views)) &&
      new Set(value.products.map(p => p.id)).size === value.products.length &&
      Array.isArray(value.purchases) && value.purchases.every(p => p && typeof p.transaction_id === "string" && count(p.cents)) &&
      new Set(value.purchases.map(p => p.transaction_id)).size === value.purchases.length &&
      count(value.purchases.reduce((sum, p) => sum + p.cents, 0)) && value.currency === "EUR";
  }

  function readMemory(identity) {
    let stored;
    try { stored = localStorage.getItem(key); }
    catch (error) { storageUnavailable = true; return null; }
    let value;
    try { value = JSON.parse(stored || "null"); } catch (error) { value = null; }
    return validMemory(value) && value.visitor_id === identity.visitor_id ? value : emptyMemory(identity.visitor_id);
  }

  function forgetMemory() {
    try { localStorage.removeItem(key); storageUnavailable = false; }
    catch (error) { storageUnavailable = true; }
  }

  function updateMemory(change) {
    if (readAnalyticsConsent() !== "granted") return;
    const identity = analyticsIdentity();
    if (!identity) return;
    const memory = readMemory(identity);
    if (!memory) { renderMemory(); return; }
    if (!memory.sessions.includes(identity.session_id)) memory.sessions.push(identity.session_id);
    change(memory);
    if (!validMemory(memory)) return;
    try { localStorage.setItem(key, JSON.stringify(memory)); storageUnavailable = false; }
    catch (error) { storageUnavailable = true; }
    renderMemory();
  }

  function rememberEvent(event) {
    if (event.event_name !== "view_item" && event.event_name !== "purchase") return;
    updateMemory(memory => {
      if (event.event_name === "view_item") {
        const item = event.ecommerce.items[0];
        if (!item) return;
        let product = memory.products.find(p => p.id === item.item_id);
        if (!product) { product = { id: item.item_id, name: item.item_name, views: 0 }; memory.products.push(product); }
        product.views++;
      } else {
        const ecommerce = event.ecommerce;
        if (!ecommerce.transaction_id || ecommerce.currency !== memory.currency ||
            !Number.isFinite(ecommerce.value) || ecommerce.value < 0 ||
            memory.purchases.some(p => p.transaction_id === ecommerce.transaction_id)) return;
        memory.purchases.push({ transaction_id: ecommerce.transaction_id, cents: Math.round(ecommerce.value * 100) });
      }
    });
  }

  function renderMemory() {
    const surface = document.getElementById("browser-memory");
    if (!surface) return;
    if (readAnalyticsConsent() !== "granted") {
      forgetMemory();
      surface.textContent = "No sabemos nada de ti (aún…)";
      return;
    }
    const identity = analyticsIdentity();
    const memory = identity ? readMemory(identity) : null;
    if (!memory || storageUnavailable) {
      surface.textContent = "No podemos conservar datos en este navegador.";
      return;
    }
    if (!memory.pages && !memory.products.length && !memory.purchases.length) {
      surface.textContent = "No sabemos nada de ti (aún…). Recordaremos tus próximas acciones con permiso.";
      return;
    }
    const mostViewed = memory.products.reduce((best, product) => !best || product.views > best.views ? product : best, null);
    const total = memory.purchases.reduce((sum, purchase) => sum + purchase.cents, 0);
    const metrics = [
      memory.pages + (memory.pages === 1 ? " página visitada · " : " páginas visitadas · ") + memory.sessions.length + (memory.sessions.length === 1 ? " sesión" : " sesiones"),
      memory.products.length + (memory.products.length === 1 ? " producto visto" : " productos vistos") + (mostViewed ? " · El más visto: " + mostViewed.name + " (" + mostViewed.views + ")" : ""),
      memory.purchases.length + (memory.purchases.length === 1 ? " compra · " : " compras · ") + new Intl.NumberFormat("es-ES", { style: "currency", currency: memory.currency }).format(total / 100)
    ];
    surface.replaceChildren();
    for (const text of metrics) {
      const item = document.createElement("span");
      item.textContent = text;
      surface.append(item);
    }
  }

  const originalTrack = track;
  track = function (...args) {
    const event = originalTrack(...args);
    // Local memory is independent of transport/receipt and must never block commerce.
    try { if (event) rememberEvent(event); } catch (error) { storageUnavailable = true; }
    return event;
  };
  const originalRenderContext = renderPrivacyContext;
  renderPrivacyContext = function () { originalRenderContext(); renderMemory(); };
  window.addEventListener("storage", event => { if (event.key === key) renderMemory(); });
  window.addEventListener("pageshow", event => {
    if (event.persisted) updateMemory(memory => { memory.pages++; });
  });
  // A new document is a page visit. Accepting consent never replays that visit.
  updateMemory(memory => { memory.pages++; });
  document.addEventListener("DOMContentLoaded", () => {
    const surface = document.createElement("div");
    surface.id = "browser-memory";
    surface.className = "v3-browser-memory";
    surface.setAttribute("role", "status");
    surface.setAttribute("aria-live", "polite");
    surface.setAttribute("aria-label", "Memoria de este navegador con consentimiento");
    surface.title = "Memoria local de este navegador: cookie para reconocerlo, session_id para distinguir sesiones y almacenamiento local para conservar el resumen. No prueba recepción en Google Sheet ni identifica a una persona.";
    document.querySelector(".v3-tools").append(surface);
    renderMemory();
  });
})();
