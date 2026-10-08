"use strict";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function moneyFor(catalog, value) {
  return formatMoney(value, catalog.store.currency, catalog.store.locale);
}

function productUrl(id) {
  return "product.html?id=" + encodeURIComponent(id);
}

function visualHtml(product, catalog, large = false) {
  // Only relative images are used: the catalog cannot introduce remote services.
  const path = typeof product.image === "string" ? product.image.trim() : "";
  const safePath = path && !/^[\/\\]/.test(path) && !/[\\:]/.test(path);
  return `<div class="product-visual ${large ? "large" : ""}">
    <span class="visual-mark" aria-hidden="true">↗</span>
    <span class="visual-label">${escapeHtml(categoryName(catalog, product.category))}</span>
    ${safePath ? `<img src="${escapeHtml(path)}" alt="${escapeHtml(product.name)}">` : ""}</div>`;
}

function handleBrokenImages(root) {
  root.querySelectorAll(".product-visual img").forEach(img => {
    img.addEventListener("error", () => img.remove());
    if (img.complete && !img.naturalWidth) img.remove();
  });
}

function renderMessage(root, title, message, href = "index.html", label = "Volver al catálogo") {
  root.innerHTML = `<section class="empty-state"><p class="eyebrow">RUNNORTE</p><h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p><a class="button" href="${escapeHtml(href)}">${escapeHtml(label)}</a></section>`;
}

function renderCatalog(catalog, root) {
  root.innerHTML = `<section class="hero"><div><p class="eyebrow">AIRE LIBRE. A TU RITMO.</p>
    <h1>Tu próxima salida<br>empieza aquí.</h1><p>Lo esencial para correr, explorar y disfrutar del camino.</p>
    <a class="button" href="#products">Explorar colección <span aria-hidden="true">↗</span></a></div>
    <div class="hero-art" aria-hidden="true"><span class="trail-line"></span><span class="art-caption">SIGUE TU CAMINO</span></div></section>
    <section id="products"><div class="section-heading"><h2>Listos para salir</h2><span>${catalog.products.length} productos</span></div>
    <div class="product-grid">${catalog.products.map(product => `<article class="product-card">
      <a class="visual-link" href="${escapeHtml(productUrl(product.id))}" aria-label="Ver ${escapeHtml(product.name)}">${visualHtml(product, catalog)}</a>
      <p class="eyebrow">${escapeHtml(categoryName(catalog, product.category))}</p>
      <h3><a href="${escapeHtml(productUrl(product.id))}">${escapeHtml(product.name)}</a></h3>
      <div class="card-bottom"><strong>${escapeHtml(moneyFor(catalog, product.price))}</strong>
      <a href="${escapeHtml(productUrl(product.id))}">Ver producto <span aria-hidden="true">↗</span></a></div>
    </article>`).join("")}</div></section>`;
  handleBrokenImages(root);
  track("view_item_list", catalog, measurementItems(catalog.products.map(product => ({ product, quantity: 1 }))));
  root.querySelectorAll(".product-card a").forEach(link => link.addEventListener("click", event => {
    // Measure selection on the catalog link, not every unrelated DOM click.
    if (event.button !== 0) return;
    const id = new URL(link.href).searchParams.get("id");
    const product = catalog.products.find(item => item.id === id);
    if (product) track("select_item", catalog, measurementItems([{ product, quantity: 1 }]));
  }));
}

function renderProduct(catalog, root) {
  const id = new URLSearchParams(window.location.search).get("id");
  const product = catalog.products.find(item => item.id === id);
  if (!product) {
    renderMessage(root, "Producto no encontrado", "Puedes encontrar otros productos en nuestra colección.");
    return;
  }
  document.title = product.name + " · " + catalog.store.name;
  root.innerHTML = `<a class="back-link" href="index.html">← Volver a la colección</a>
    <div class="product-detail">${visualHtml(product, catalog, true)}<section>
    <p class="eyebrow">${escapeHtml(categoryName(catalog, product.category))}${product.brand ? " · " + escapeHtml(product.brand) : ""}</p>
    <h1>${escapeHtml(product.name)}</h1><p class="detail-price">${escapeHtml(moneyFor(catalog, product.price))}</p>
    <p class="description">${escapeHtml(product.description || "Un esencial para tu próxima salida.")}</p>
    <form id="add-form"><label for="quantity">Cantidad</label>
    <input id="quantity" type="number" min="1" max="99" step="1" value="1" required>
    <button class="button" type="submit">Añadir al carrito</button></form>
    <p id="cart-status" role="status" aria-live="polite"></p><a href="cart.html">Ver carrito →</a>
    </section></div>`;
  handleBrokenImages(root);
  track("view_item", catalog, measurementItems([{ product, quantity: 1 }]));
  document.getElementById("add-form").addEventListener("submit", event => {
    event.preventDefault();
    const status = document.getElementById("cart-status");
    try {
      addToCart(product.id, Number(document.getElementById("quantity").value));
      updateCartCount();
      status.className = "success";
      status.textContent = "Añadido al carrito. Puedes seguir explorando o finalizar tu pedido.";
      const quantity = Number(document.getElementById("quantity").value);
      track("add_to_cart", catalog, measurementItems([{ product, quantity }]), Math.round(product.price * 100) * quantity / 100);
    } catch (error) {
      status.className = "error";
      status.textContent = "No se pudo añadir. El límite es 99 unidades por producto y el navegador debe permitir el almacenamiento de esta pestaña.";
    }
  });
}

function summaryHtml(catalog, summary) {
  return `<ul class="summary-list">${summary.items.map(item => `<li><span>${escapeHtml(item.product.name)} × ${item.quantity}</span>
    <strong>${escapeHtml(moneyFor(catalog, Math.round(item.product.price * 100) * item.quantity / 100))}</strong></li>`).join("")}</ul>
    <div class="total-row"><span>Total</span><strong>${escapeHtml(moneyFor(catalog, summary.total))}</strong></div>`;
}

function renderCart(catalog, root, measureView = true) {
  const cart = readCart();
  const summary = cartSummary(catalog);
  if (measureView) track("view_cart", catalog, measurementItems(summary.items), summary.total);
  if (!cart.length) {
    renderMessage(root, "Tu carrito está vacío", "Elige algo para acompañarte en tu próxima salida.", "index.html", "Explorar colección");
    return;
  }
  root.innerHTML = `<p class="eyebrow">TUS ESENCIALES</p><h1>Tu carrito</h1>
    <p id="cart-error" class="error" role="alert">${summary.unavailable ? "Hay productos no disponibles. Elimínalos para continuar." : ""}</p>
    <div class="cart-layout"><section class="cart-items">${cart.map(entry => {
      const product = catalog.products.find(item => item.id === entry.product_id);
      return `<article class="cart-item"><div><h2>${product ? `<a href="${escapeHtml(productUrl(product.id))}">${escapeHtml(product.name)}</a>` : "Producto no disponible"}</h2>
        <p class="muted">${product ? escapeHtml(moneyFor(catalog, product.price)) + " / unidad" : escapeHtml(entry.product_id)}</p></div>
        <label>Cantidad<input class="cart-quantity" data-id="${escapeHtml(entry.product_id)}" type="number" min="1" max="99" step="1" value="${entry.quantity}"></label>
        <strong>${product ? escapeHtml(moneyFor(catalog, Math.round(product.price * 100) * entry.quantity / 100)) : "—"}</strong>
        <button class="text-button remove-item" data-id="${escapeHtml(entry.product_id)}" aria-label="Eliminar ${escapeHtml(product ? product.name : entry.product_id)}">Eliminar</button></article>`;
    }).join("")}</section><aside class="panel"><h2>Resumen</h2>
      <p class="muted">Recogida de demostración · Gratis</p><div class="total-row"><span>Total</span><strong>${escapeHtml(moneyFor(catalog, summary.total))}</strong></div>
      ${summary.unavailable ? "<p>Elimina los productos no disponibles para pagar.</p>" : '<a class="button" href="checkout.html">Continuar al pago →</a>'}
      <a class="continue-link" href="index.html">Seguir explorando</a></aside></div>`;
  function changeQuantity(id, quantity) {
    try {
      const previous = readCart().find(item => item.product_id === id);
      const product = catalog.products.find(item => item.id === id);
      setCartQuantity(id, quantity);
      if (previous && product && quantity !== previous.quantity) {
        const difference = Math.abs(quantity - previous.quantity);
        track(quantity < previous.quantity ? "remove_from_cart" : "add_to_cart", catalog,
          measurementItems([{ product, quantity: difference }]), Math.round(product.price * 100) * difference / 100);
      }
      updateCartCount();
      renderCart(catalog, root, false);
    } catch (error) {
      document.getElementById("cart-error").textContent = "No se pudo actualizar. Usa una cantidad de 1 a 99 y permite el almacenamiento de esta pestaña.";
    }
  }
  root.querySelectorAll(".cart-quantity").forEach(input => input.addEventListener("change", () => {
    if (input.checkValidity()) changeQuantity(input.dataset.id, Number(input.value));
    else input.reportValidity();
  }));
  root.querySelectorAll(".remove-item").forEach(button => button.addEventListener("click", () => changeQuantity(button.dataset.id, 0)));
}

function renderConfirmation(root) {
  const order = readOrder();
  if (!order) {
    renderMessage(root, "Todavía no hay un pedido", "Completa una compra de demostración para ver su confirmación.");
    return;
  }
  root.innerHTML = `<section class="confirmation"><span class="success-mark" aria-hidden="true">✓</span>
    <p class="eyebrow">PEDIDO CONFIRMADO</p><h1>¡Nos vemos en el camino!</h1><p>Tu compra de demostración se ha completado.</p>
    <div class="panel"><dl class="order-details"><dt>Referencia del pedido</dt><dd><code>${escapeHtml(order.transaction_id)}</code></dd>
    <dt>Fecha</dt><dd><time datetime="${escapeHtml(order.created_at)}">${escapeHtml(new Date(order.created_at).toLocaleString("es-ES"))}</time></dd></dl>
    <ul class="summary-list">${order.items.map(item => `<li><span>${escapeHtml(item.item_name)} × ${item.quantity}</span>
    <strong>${escapeHtml(formatMoney(Math.round(item.price * 100) * item.quantity / 100, order.currency))}</strong></li>`).join("")}</ul>
    <div class="total-row"><span>Total</span><strong>${escapeHtml(formatMoney(order.value, order.currency))}</strong></div></div>
    <p class="muted">Entrega ficticia en el punto de recogida Demo Norte. No se ha realizado ningún cobro.</p>
    <a class="button" href="index.html">Volver a la colección ↗</a></section>`;
}

async function startShop() {
  const root = document.getElementById("page-content");
  initializePrivacyControls();
  initializeMeasurementControls();
  initializeProfileControls();
  refreshActivation();
  showCollectorStatus(SHOP_CONFIG.collectorUrl ?
    "Collector configurado; inspecciona los envíos en Network." : "Collector sin configurar.");
  updateCartCount();
  const page = document.body.dataset.page;
  // Order confirmation is independent of the current catalog, including its availability.
  if (page === "confirmation") {
    renderConfirmation(root);
    return;
  }
  const catalog = await loadCatalog();
  if (!catalog) {
    renderMessage(root, "La colección no está disponible", "No hemos podido cargar el catálogo. Vuelve a intentarlo en unos instantes.", window.location.href, "Reintentar");
    return;
  }
  document.getElementById("store-name").textContent = catalog.store.name;
  if (page === "catalog") renderCatalog(catalog, root);
  if (page === "product") renderProduct(catalog, root);
  if (page === "cart") renderCart(catalog, root);
  if (page === "checkout") renderCheckout(catalog, root);
}

startShop();
// Back/forward can restore stale HTML after payment; rebuild from the current cart.
window.addEventListener("pageshow", event => { if (event.persisted) startShop(); });
