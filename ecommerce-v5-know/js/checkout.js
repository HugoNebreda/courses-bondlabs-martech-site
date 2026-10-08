"use strict";

function renderCheckout(catalog, root) {
  const summary = cartSummary(catalog);
  if (!summary.items.length || summary.unavailable) {
    renderMessage(root, "Revisa tu carrito", summary.unavailable ?
      "Un producto ya no está disponible. Elimínalo del carrito para continuar." :
      "Añade algún producto antes de continuar con el pago.", "cart.html", "Ir al carrito");
    return;
  }
  root.innerHTML = `<p class="eyebrow">UN PASO MÁS</p><h1>Finaliza tu pedido</h1>
    <div class="checkout-layout"><form id="payment-form" class="panel">
      <h2>Entrega</h2><label class="delivery"><input type="radio" name="delivery" checked>
      Punto de recogida Demo Norte · Gratis</label>
      <p class="muted">Compra de demostración. No necesitamos datos personales.</p>
      <h2>Pago de demostración</h2><label for="payment-code">Código de pago</label>
      <input id="payment-code" type="text" inputmode="numeric" autocomplete="off" maxlength="8" required aria-describedby="payment-hint payment-error">
      <p id="payment-hint" class="muted">Usa el código ficticio <strong>42424242</strong>.</p>
      <p id="payment-error" class="error" role="alert"></p>
      <button class="button" type="submit">Pagar ${escapeHtml(moneyFor(catalog, summary.total))}</button>
      <p class="muted">No se realiza ningún cobro real.</p>
    </form><aside class="panel"><h2>Tu pedido</h2>${summaryHtml(catalog, summary)}
      <a href="cart.html">Editar carrito</a></aside></div>`;
  track("begin_checkout", catalog, measurementItems(summary.items), summary.total);
  const form = document.getElementById("payment-form");
  const code = document.getElementById("payment-code");
  const error = document.getElementById("payment-error");
  form.addEventListener("submit", event => {
    event.preventDefault();
    error.textContent = "";
    if (code.value !== "42424242") {
      error.textContent = "Código incorrecto. Introduce 42424242 para completar esta compra de demostración.";
      code.setAttribute("aria-invalid", "true");
      code.focus();
      return;
    }
    code.removeAttribute("aria-invalid");
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      // Re-read the cart at payment time. The demo code is never passed to the order.
      const order = createOrder(catalog, cartSummary(catalog));
      code.value = "";
      reportCompletedOrder(order);
      window.location.assign("confirmation.html");
    } catch (failure) {
      error.textContent = "No se pudo guardar el pedido. Comprueba que el navegador permite el almacenamiento de esta pestaña y revisa el carrito.";
      button.disabled = false;
    }
  });
}
