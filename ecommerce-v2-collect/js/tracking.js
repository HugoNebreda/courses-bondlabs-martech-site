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
  // The business fact is defined here; its transport is in collector.js.
  return {
    schema_version: "1.0",
    event_id: "evt_" + crypto.randomUUID(),
    event_name: eventName,
    event_timestamp: new Date().toISOString(),
    sandbox_version: "v2-collect",
    store_id: catalog.store.id,
    page: { type: document.body.dataset.page, path: location.pathname + location.search },
    identity: { run_id: exerciseRunId, visitor_id: null, session_id: null, user_id: null },
    // This is a contract placeholder, not a consent choice or consent mechanism.
    consent: { analytics: "not_applicable" },
    ecommerce: { currency: catalog.store.currency, value, transaction_id: transactionId, items },
    meta: { data_origin: "live", scenario: "class_live" }
  };
}

function track(eventName, catalog, items, value = null, transactionId = null) {
  try {
    const event = createEvent(eventName, catalog, items, value, transactionId);
    sendToCollector("event", event);
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
    track("purchase", { store: { id: order.store_id, currency: order.currency } },
      order.items, order.value, order.transaction_id);
  } catch (error) {
    showCollectorStatus("La medición falló; tu pedido local está confirmado.");
  }
}
