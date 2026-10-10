"use strict";

// Structured message interface; the website describes a fact once.
window.dataLayer = [];
window.tmsRouting = [];
window.analyticsDebug = [];
window.collectorDebug = [];
const TMS_EVENTS = ["view_item_list", "select_item", "view_item", "add_to_cart",
  "view_cart", "remove_from_cart", "begin_checkout", "purchase"];
const TMS_RULES = {
  collector: TMS_EVENTS,
  digitalAnalytics: TMS_EVENTS,
  adsConversion: ["purchase"]
};

function duplicateMeasurementEnabled() {
  try { return sessionStorage.getItem("mt_v5_duplicate") === "on"; }
  catch (error) { return false; }
}

function sendDigitalAnalytics(event) {
  // Simulated HTTP destinations, static receipts on this same site; no vendor account.
  window.analyticsDebug.push(JSON.parse(JSON.stringify(event)));
  sendDemoReceipt("analytics", { name: event.event_name, event: event.event_id, revenue: event.ecommerce.value, currency: event.ecommerce.currency });
  recordProfileEvent(event);
}

function sendDemoReceipt(destination, parameters) {
  const url = new URL("demo-sinks/" + destination + ".json", location.href);
  for (const [key, value] of Object.entries(parameters)) if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  fetch(url.href, { credentials: "omit", cache: "no-store" }).catch(() => {});
}
function sendAdsConversion(event) {
  sendDemoReceipt("ads", { conversion: "purchase", event: event.event_id, transaction: event.ecommerce.transaction_id, acquisition: "exclude_converted_demo" });
}

function routeMeasurement(event) {
  if (readAnalyticsConsent() !== "granted" || event.consent?.analytics !== "granted" ||
      !TMS_EVENTS.includes(event.event_name)) return;
  for (const destination of Object.keys(TMS_RULES)) {
    if (!TMS_RULES[destination].includes(event.event_name)) continue;
    const record = { event_id: event.event_id, event: event.event_name, destination, status: "attempted" };
    window.tmsRouting.push(record);
    try {
      if (destination === "collector") sendToCollector("event", event);
      if (destination === "digitalAnalytics") sendDigitalAnalytics(event);
      if (destination === "adsConversion") sendAdsConversion(event);
    } catch (error) { record.status = "failed"; }
  }
  renderMeasurementDebug();
}

// Each new push is processed once; permission changes never replay old messages.
window.dataLayer.push = function (...messages) {
  const length = Array.prototype.push.apply(this, messages);
  for (const message of messages) {
    try { routeMeasurement(message); } catch (error) { /* Commerce remains independent. */ }
  }
  return length;
};

function renderMeasurementDebug() {
  const surface = document.getElementById("measurement-debug");
  if (!surface) return;
  surface.textContent = JSON.stringify({
    dataLayer: window.dataLayer, routing: window.tmsRouting,
    collector: window.collectorDebug, digitalAnalytics: window.analyticsDebug,
    demo: "Digital Analytics / Ads: HTTP GET a recibos estáticos del sitio, sin persistencia ni procesamiento vendor"
  }, null, 2);
}

function initializeMeasurementControls() {
  const control = document.getElementById("duplicate-measurement");
  if (!control) return;
  control.checked = duplicateMeasurementEnabled();
  control.onchange = () => {
    try { sessionStorage.setItem("mt_v5_duplicate", control.checked ? "on" : "off"); }
    catch (error) { control.checked = false; }
  };
  renderMeasurementDebug();
}
