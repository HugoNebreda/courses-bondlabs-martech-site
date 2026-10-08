"use strict";

function readCart() {
  try {
    const cart = JSON.parse(sessionStorage.getItem(SHOP_CONFIG.cartKey) || "[]");
    if (!Array.isArray(cart)) return [];
    const ids = new Set();
    return cart.filter(item => {
      if (!item || typeof item.product_id !== "string" || ids.has(item.product_id) ||
          !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return false;
      ids.add(item.product_id);
      return true;
    });
  } catch (error) {
    return [];
  }
}

function writeCart(cart) {
  // Only shopping state is stored, for this tab's session.
  sessionStorage.setItem(SHOP_CONFIG.cartKey, JSON.stringify(cart));
}

function setCartQuantity(productId, quantity) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) {
    throw new Error("Elige una cantidad entre 1 y 99.");
  }
  const cart = readCart().filter(item => item.product_id !== productId);
  if (quantity > 0) cart.push({ product_id: productId, quantity });
  writeCart(cart);
}

function addToCart(productId, quantity) {
  const item = readCart().find(entry => entry.product_id === productId);
  setCartQuantity(productId, (item ? item.quantity : 0) + quantity);
}

function cartSummary(catalog) {
  const cart = readCart();
  const items = [];
  for (const entry of cart) {
    const product = catalog.products.find(item => item.id === entry.product_id);
    if (product) items.push({ product, quantity: entry.quantity });
  }
  const cents = items.reduce((total, item) => total + Math.round(item.product.price * 100) * item.quantity, 0);
  return { items, total: cents / 100, unavailable: cart.length - items.length };
}

function updateCartCount() {
  const count = readCart().reduce((total, item) => total + item.quantity, 0);
  document.getElementById("cart-count").textContent = count;
}
