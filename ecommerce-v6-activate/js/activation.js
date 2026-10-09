"use strict";

window.MarTechSandbox = window.MarTechSandbox || {};
window.activationDebug = { input: null, decision: null, source: "standard", variant: "standard" };
let activationSequence = 0;
let activationRequest = null;
let activationScript = null;
let activationTimer = null;

function activationInput() {
  // Consume the profile/audience projection; never segment raw events here.
  if (readAnalyticsConsent() !== "granted") return null;
  const identity = analyticsIdentity();
  if (!identity) return null;
  const key = identity.user_id || identity.visitor_id;
  const membership = readProfileModel().AUDIENCES.find(row => row.profile_key === key);
  return { profile_key: key, audiences: membership ? membership.audiences.slice() : [] };
}

function renderActivation() {
  const offer = document.getElementById("activation-offer");
  if (offer) offer.hidden = window.activationDebug.variant !== "cart_recovery_reminder";
  const surface = document.getElementById("activation-debug");
  if (surface) surface.textContent = JSON.stringify(window.activationDebug, null, 2);
}

function finishActivation(decision, source) {
  if (!activationRequest || activationRequest.finished) return;
  if (readAnalyticsConsent() !== "granted") return;
  if (!decision || decision.request_id !== activationRequest.input.request_id ||
      typeof decision.eligible !== "boolean" ||
      (decision.action !== null && decision.action !== "cart_recovery_reminder")) return;
  if (JSON.stringify(activationInput()) !== activationRequest.signature) return;
  activationRequest.finished = true;
  clearTimeout(activationTimer);
  window.activationDebug.decision = JSON.parse(JSON.stringify(decision));
  window.activationDebug.source = source;
  window.activationDebug.variant = decision.eligible && decision.action === "cart_recovery_reminder" ?
    "cart_recovery_reminder" : "standard";
  renderActivation();
}

window.MarTechSandbox.receiveActivation = decision => finishActivation(decision, "live");

function refreshActivation() {
  clearTimeout(activationTimer);
  if (activationScript) { activationScript.remove(); activationScript = null; }
  const input = activationInput();
  const signature = JSON.stringify(input);
  const requestId = "act_" + (++activationSequence);
  activationRequest = input ? { input: { ...input, request_id: requestId }, signature, finished: false } : null;
  window.activationDebug = { input: activationRequest ? activationRequest.input : null,
    decision: null, source: input ? "pending" : "consent_or_context_unavailable", variant: "standard" };
  renderActivation();
  if (!input) return;
  if (!SHOP_CONFIG.activationUrl) {
    if (typeof snapshotActivation === "function") finishActivation(snapshotActivation(activationRequest.input), "static_snapshot");
    else { window.activationDebug.source = "snapshot_unavailable"; renderActivation(); }
    return;
  }
  const request = activationRequest;
  function liveFailure(reason) {
    if (activationRequest !== request || request.finished) return;
    request.finished = true;
    clearTimeout(activationTimer);
    window.activationDebug.source = reason;
    window.activationDebug.variant = "standard";
    renderActivation();
    // The bundled offers.js baseline remains available by clearing activationUrl.
    // Configured live-read failure is fail-closed: no unconfirmed live offer.
  }
  try {
    const url = new URL(SHOP_CONFIG.activationUrl, location.href);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid decision URL");
    url.searchParams.set("operation", "activation");
    url.searchParams.set("request_id", requestId);
    // Only consented audience labels go to decisioning, no raw events or identity.
    url.searchParams.set("audiences", input.audiences.join(","));
    activationScript = document.createElement("script");
    activationScript.src = url.href;
    activationScript.onerror = () => liveFailure("live_error_standard");
    activationTimer = setTimeout(() => liveFailure("live_timeout_standard"), 5000);
    document.head.appendChild(activationScript);
  } catch (error) { liveFailure("live_error_standard"); }
}
