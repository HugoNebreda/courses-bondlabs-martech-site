"use strict";

function measurementItems(items) {
  return items.map(item => ({
    item_id: item.product.id,
    item_name: item.product.name,
    item_brand: item.product.brand || "",
    item_category: item.product.category,
    price: item.product.price,
    quantity: item.quantity
  }));
}

function createEvent(eventName, catalog, items, value = null, transactionId = null) {
  const identity = analyticsIdentity();
  if (!identity) return null; // No queue and no historical backfill.
  return {
    schema_version: "1.0",
    event_id: "evt_" + crypto.randomUUID(),
    event_name: eventName,
    event_timestamp: new Date().toISOString(),
    sandbox_version: "v6-activate",
    store_id: catalog.store.id,
    page: { type: document.body.dataset.page, path: location.pathname + location.search },
    identity,
    consent: { analytics: "granted" },
    ecommerce: { currency: catalog.store.currency, value, transaction_id: transactionId, items },
    meta: { data_origin: "live", scenario: "class_live" }
  };
}

function track(eventName, catalog, items, value = null, transactionId = null) {
  try {
    const event = createEvent(eventName, catalog, items, value, transactionId);
    if (!event) return null;
    window.dataLayer.push(event);
    // Deliberate extra DIRECT purchase path, independent of TMS distribution.
    // Distinct event IDs; same transaction_id and value; never a second order.
    if (eventName === "purchase" && duplicateMeasurementEnabled() && readAnalyticsConsent() === "granted") {
      const duplicate = JSON.parse(JSON.stringify(event));
      duplicate.event_id = "evt_" + crypto.randomUUID();
      sendToCollector("event", duplicate);
      renderMeasurementDebug();
    }
    return event;
  } catch (error) {
    // Creating or transporting a measurement never controls shopping success.
    showCollectorStatus("No se pudo medir esta acción; la tienda sigue funcionando.");
    return null;
  }
}

function reportCompletedOrder(order) {
  // This runs only after a local order is committed. Confirmation does not call it.
  try {
    sendToCollector("order", order);
  } catch (error) {
    showCollectorStatus("El espejo remoto falló; tu pedido local está confirmado.");
  }
  try {
    track("purchase", { store: { id: order.store_id, currency: order.currency } },
      order.items, order.value, order.transaction_id);
  } catch (error) {
    showCollectorStatus("La medición falló; tu pedido local está confirmado.");
  }
}
