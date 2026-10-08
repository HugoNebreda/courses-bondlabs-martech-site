"use strict";

function readOrder() {
  try {
    const order = JSON.parse(sessionStorage.getItem(SHOP_CONFIG.orderKey) || "null");
    if (!order || typeof order.transaction_id !== "string" ||
        !Number.isFinite(Date.parse(order.created_at)) || typeof order.currency !== "string" ||
        !Number.isFinite(order.value) || !Array.isArray(order.items) || order.items.length === 0 ||
        !order.items.every(item => item && typeof item.item_name === "string" &&
          typeof item.item_id === "string" && typeof item.item_category === "string" &&
          Number.isFinite(item.price) && item.price >= 0 && Number.isInteger(item.quantity) && item.quantity > 0)) return null;
    formatMoney(order.value, order.currency);
    return order;
  } catch (error) {
    return null;
  }
}

function createOrder(catalog, summary) {
  if (!summary.items.length || summary.unavailable) throw new Error("Revisa tu carrito antes de pagar.");
  const order = {
    schema_version: "1.0",
    checkout_attempt_id: "chk_" + crypto.randomUUID(),
    transaction_id: "txn_" + crypto.randomUUID(),
    created_at: new Date().toISOString(),
    sandbox_version: "v3-remember",
    store_id: catalog.store.id,
    currency: catalog.store.currency,
    value: summary.total,
    items: summary.items.map(item => ({
      item_id: item.product.id,
      item_name: item.product.name,
      item_brand: item.product.brand || "",
      item_category: item.product.category,
      price: item.product.price,
      quantity: item.quantity
    })),
    run_id: exerciseRunId,
    visitor_id: null,
    session_id: null,
    user_id: null,
    data_origin: "live",
    scenario: "class_live"
  };
  // Commit the operational order locally before attempting any remote writes.
  // Confirmation reads this snapshot; it never creates another transaction.
  sessionStorage.setItem(SHOP_CONFIG.orderKey, JSON.stringify(order));
  sessionStorage.removeItem(SHOP_CONFIG.cartKey);
  return order;
}
