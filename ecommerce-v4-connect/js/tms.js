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
  digitalAnalytics: TMS_EVENTS
};

function duplicateMeasurementEnabled() {
  try { return sessionStorage.getItem("mt_v4_duplicate") === "on"; }
  catch (error) { return false; }
}

function sendDigitalAnalytics(event) {
  // Local Digital Analytics adapter: no SDK, account or remote service required.
  window.analyticsDebug.push(JSON.parse(JSON.stringify(event)));
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
    collector: window.collectorDebug, digitalAnalytics: window.analyticsDebug
  }, null, 2);
}

function initializeMeasurementControls() {
  const control = document.getElementById("duplicate-measurement");
  if (!control) return;
  control.checked = duplicateMeasurementEnabled();
  control.onchange = () => {
    try { sessionStorage.setItem("mt_v4_duplicate", control.checked ? "on" : "off"); }
    catch (error) { control.checked = false; }
  };
  renderMeasurementDebug();
}
