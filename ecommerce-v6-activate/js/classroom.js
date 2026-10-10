"use strict";

// T-009: explicit classroom integration. Original version logic remains inspectable.
if (window.CLASSROOM_ENDPOINT) SHOP_CONFIG.collectorUrl = window.CLASSROOM_ENDPOINT;
if (window.CLASSROOM_ENDPOINT) SHOP_CONFIG.activationUrl = window.CLASSROOM_ENDPOINT;
let teachingTraceEnabled = new URLSearchParams(location.search).get("trace") === "1";
function teachingTrace(stage, explanation, identifiers = {}) {
  if (!teachingTraceEnabled) return;
  try {
    console.groupCollapsed("[MARTECH TRACE] " + stage + " · " + explanation);
    console.log(identifiers);
    console.groupEnd();
  } catch (error) { /* Console availability never controls commerce. */ }
}
function traceIdentifiers(payload) {
  const result = { run_id: payload.identity?.run_id || payload.run_id };
  if (payload.event_id) result.event_id = payload.event_id;
  const transaction = payload.ecommerce?.transaction_id || payload.transaction_id;
  if (transaction) result.transaction_id = transaction;
  if (payload.identity?.visitor_id) result.visitor_id = payload.identity.visitor_id;
  if (payload.identity?.session_id) result.session_id = payload.identity.session_id;
  if (payload.identity?.user_id) result.user_id = payload.identity.user_id;
  return result;
}
const originalCreateEvent = createEvent;
createEvent = function (...args) {
  const event = originalCreateEvent(...args);
  teachingTrace("CONSENT", event ? "Permiso concedido; se observa esta acción." : "Sin permiso/contexto: no se crea evento ni se recupera después.");
  if (event) teachingTrace("IDENTITY CONTEXT", "Contexto permitido del navegador.", traceIdentifiers(event));
  if (event) teachingTrace("EVENTO", "Se crea " + event.event_name + ".", traceIdentifiers(event));
  return event;
};
const originalTrack = track;
track = function (...args) {
  const explanations = { view_item_list: "Se muestra la colección", select_item: "Se selecciona un producto",
    view_item: "Se abre la ficha", add_to_cart: "Se añade al carrito", view_cart: "Se consulta el carrito",
    remove_from_cart: "Se retira del carrito", begin_checkout: "Se inicia el checkout", purchase: "Se confirma la compra" };
  const names = (args[2] || []).slice(0, 3).map(item => item.item_name).join(", ");
  teachingTrace("SUCESO", (explanations[args[0]] || args[0]) + (names ? ": " + names : "."));
  return originalTrack(...args);
};
const originalSendToCollector = sendToCollector;
sendToCollector = function (operation, payload) {
  if (window.CLASSROOM_ENDPOINT && operation !== "order" && readAnalyticsConsent() !== "granted") {
    teachingTrace("CONSENT", "Envío opcional bloqueado; sin permiso no se intenta HTTP.");
    return;
  }
  if (operation === "event") {
    const path = window.dataLayer.some(event => event.event_id === payload.event_id) ? "A · TMS" : "B · directa";
    teachingTrace("DESTINO", "Collector, vía " + path + ": " + payload.event_name + ". Purchase comparte transaction_id; un pedido.", traceIdentifiers(payload));
  }
  teachingTrace("HTTP / COLLECTOR", SHOP_CONFIG.collectorUrl ?
    "Envío HTTP intentado — verifica el ID en " + (operation === "event" ? "RAW_EVENTS" : operation === "order" ? "ORDERS" : operation.toUpperCase()) + "." :
    "Collector sin configurar; no se intenta HTTP.", { operation, ...traceIdentifiers(payload) });
  if (!window.CLASSROOM_ENDPOINT) return originalSendToCollector(operation, payload);
  try {
    window.collectorDebug.push({ operation, payload: JSON.parse(JSON.stringify(payload)) });
    renderMeasurementDebug();
    const envelope = { operation, transport: "fetch", payload };
    const link = classroomLink(payload.identity);
    if (link && operation !== "identity_link") envelope.identity_link = link;
    fetch(SHOP_CONFIG.collectorUrl, { method: "POST", mode: "no-cors", credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(envelope), keepalive: true })
      .then(() => showCollectorStatus("Envío intentado; verifica las filas en el Sheet. La respuesta opaca no prueba recepción."))
      .catch(() => showCollectorStatus("Servicio no disponible; la tienda sigue funcionando."));
  } catch (error) { showCollectorStatus("No se pudo enviar; la tienda sigue funcionando."); }
};
const originalReportCompletedOrder = reportCompletedOrder;
reportCompletedOrder = function (order) {
  teachingTrace("SUCESO", "Pedido operativo confirmado: 1. Las mediciones purchase no son ventas adicionales.", traceIdentifiers(order));
  return originalReportCompletedOrder(order);
};

const originalSetAnalyticsConsent = setAnalyticsConsent;
setAnalyticsConsent = function (choice) {
  const result = originalSetAnalyticsConsent(choice);
  teachingTrace("CONSENT", "Preferencia efectiva: " + readAnalyticsConsent() + ". Sin repetición de acciones pasadas.");
  return result;
};

const originalDataLayerPush = window.dataLayer.push;
window.dataLayer.push = function (...events) {
  for (const event of events) teachingTrace("DATALAYER", "El evento entra una vez en window.dataLayer.", traceIdentifiers(event));
  return originalDataLayerPush.apply(this, events);
};
const originalRouteMeasurement = routeMeasurement;
routeMeasurement = function (event) {
  if (readAnalyticsConsent() === "granted" && event.consent?.analytics === "granted" && TMS_EVENTS.includes(event.event_name))
    teachingTrace("TMS", "La regla " + event.event_name + " coincide.", traceIdentifiers(event));
  return originalRouteMeasurement(event);
};
const originalSendDigitalAnalytics = sendDigitalAnalytics;
sendDigitalAnalytics = function (event) {
  teachingTrace("DESTINO", "Digital Analytics: adapter local simulado/debug.", traceIdentifiers(event));
  return originalSendDigitalAnalytics(event);
};

function classroomLink(identity) {
  if (!identity || !identity.user_id || readAnalyticsConsent() !== "granted") return null;
  const link = readProfileModel().IDENTITY_LINKS.find(row => row.visitor_id === identity.visitor_id && row.user_id === identity.user_id &&
    row.evidence === "synthetic_code_validated" && row.link_reason === "authenticated_session");
  return link ? { sandbox_version: "v6-activate", identity, consent: { analytics: "granted" },
    link_reason: link.link_reason, evidence: link.evidence, linked_at: link.linked_at } : null;
}
function traceProfileProjection(model) {
  teachingTrace("PROFILE", "Proyección local de hechos observados; no prueba recepción en Sheet.",
    { ...traceIdentifiers(model.RAW_EVENTS.at(-1) || {}), profile_keys: model.PROFILES.map(row => row.profile_key) });
  teachingTrace("AUDIENCE", "Pertenencias locales calculadas antes de cualquier decisión.",
    { ...traceIdentifiers(model.RAW_EVENTS.at(-1) || {}), memberships: model.AUDIENCES.map(row => ({ profile_key: row.profile_key, audiences: row.audiences })) });
}
const originalSaveProfileModel = saveProfileModel;
const tracedLinks = new Set();
saveProfileModel = function (model) {
  for (const link of model.IDENTITY_LINKS) if (!tracedLinks.has(link.visitor_id)) {
    teachingTrace("IDENTITY LINK", "Enlace sintético validado explícitamente.", { visitor_id: link.visitor_id, user_id: link.user_id });
    tracedLinks.add(link.visitor_id);
  }
  const result = originalSaveProfileModel(model);
  if (readAnalyticsConsent() !== "granted") return result;

  if (window.CLASSROOM_ENDPOINT) {
    // Explicit projection requests; the service derives from its own RECEIVED facts.
    const last = model.RAW_EVENTS[model.RAW_EVENTS.length - 1];
    const link = model.IDENTITY_LINKS[model.IDENTITY_LINKS.length - 1];
    const identity = link ? { run_id: exerciseRunId, visitor_id: link.visitor_id, session_id: link.session_id, user_id: link.user_id } : last?.identity;
    if (identity) {
      const context = { sandbox_version: "v6-activate", identity, consent: { analytics: "granted" } };
      const assertion = classroomLink(identity);
      if (assertion) sendToCollector("identity_link", assertion);
      sendToCollector("profile", context);
      sendToCollector("audience", context);
    }
  }
  return result;
};
const originalLinkDemoAccount = linkDemoAccount;
linkDemoAccount = function (...args) {
  const result = originalLinkDemoAccount(...args);
  if (!result.ok) teachingTrace("IDENTITY LINK", "Enlace rechazado; no se asigna identidad conocida.");
  return result;
};

const originalRefreshActivation = refreshActivation;
refreshActivation = function () {
  if (teachingTraceEnabled && readAnalyticsConsent() === "granted") traceProfileProjection(readProfileModel());
  return originalRefreshActivation();
};
const originalRenderActivation = renderActivation;
renderActivation = function () {
  const debug = window.activationDebug;
  const identifiers = { request_id: debug.input?.request_id, surface: debug.input?.surface,
    audiences: debug.input?.audiences, decision_id: debug.decision?.decision_id,
    action: debug.decision?.action, eligible: debug.decision?.eligible, source: debug.source, variant: debug.variant };
  teachingTrace(debug.source === "pending" ? "DECISION REQUEST" : "DECISION RESPONSE",
    "Consulta explícita: " + debug.source + ".", identifiers);
  const result = originalRenderActivation();
  teachingTrace("EXPERIENCE", "Experiencia resultante: " + debug.variant + ".", identifiers);
  return result;
};

const traceControl = document.getElementById("teaching-trace");
if (traceControl) {
  traceControl.checked = teachingTraceEnabled;
  traceControl.onchange = () => { teachingTraceEnabled = traceControl.checked; };
}
