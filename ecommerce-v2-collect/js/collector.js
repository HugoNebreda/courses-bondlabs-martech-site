"use strict";

function showCollectorStatus(message) {
  const status = document.getElementById("collector-status");
  if (status) status.textContent = message;
}

function sendToCollector(operation, payload) {
  if (!SHOP_CONFIG.collectorUrl) {
    showCollectorStatus("Collector sin configurar: el evento existe, pero no se envía.");
    return;
  }
  try {
    // A simple text/plain POST avoids a CORS preflight for the classroom web app.
    // keepalive lets the request outlive page navigation; it is not a delivery guarantee.
    // An opaque response cannot prove that a workbook row was written.
    const body = JSON.stringify({ operation, transport: "fetch", payload });
    fetch(SHOP_CONFIG.collectorUrl, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true
    }).then(response => {
      showCollectorStatus(response.type === "opaque" ?
        "Envío intentado; comprueba las filas en la hoja." :
        "Solicitud terminada; comprueba las filas en la hoja.");
    }).catch(() => {
      showCollectorStatus("El envío falló; la compra sigue funcionando.");
    });
  } catch (error) {
    showCollectorStatus("El envío falló; la compra sigue funcionando.");
  }
}
