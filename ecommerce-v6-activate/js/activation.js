"use strict";

window.MarTechSandbox = window.MarTechSandbox || {};
window.activationDebug = { input: null, decision: null, source: "standard", variant: "standard" };
let activationSequence = 0;
let activationRequest = null;
let activationScript = null;
let activationTimer = null;
let celebrationTimer = null;

function activationSurface() {
  const page = document.body.dataset.page;
  if (page === "catalog") return "home";
  if (page === "cart") return "cart";
  if (page === "confirmation" && typeof readOrder === "function" && readOrder()) return "confirmation";
  return null;
}

function priorityActivation(input) {
  if (input?.surface === "confirmation") return input.audiences.includes("high_value") ? "loyalty_thank_you" : null;
  if (["home","cart"].includes(input?.surface) && input.audiences.includes("cart_abandoner")) return "cart_recovery_reminder";
  if (input?.surface === "home" && /^club_(norte|sur|este|oeste)$/.test(input.club_id || "")) return input.club_id + "_home";
  if (input?.surface === "home" && input.audiences.includes("running_interest")) return "running_interest_home";
  return null;
}

function compatibleActivation(action, input) {
  if (!input || action !== priorityActivation(input)) return false;
  if (/^club_(norte|sur|este|oeste)_home$/.test(action)) return input.surface === "home" && action === input.club_id + "_home";
  if (action === "running_interest_home") return input.surface === "home" && input.audiences.includes("running_interest");
  if (action === "cart_recovery_reminder") return ["home", "cart"].includes(input.surface) && input.audiences.includes("cart_abandoner");
  if (action === "loyalty_thank_you") return input.surface === "confirmation" && input.audiences.includes("high_value");
  return false;
}

function activationInput() {
  // Consume the profile/audience projection; never segment raw events here.
  if (readAnalyticsConsent() !== "granted") return null;
  const identity = analyticsIdentity();
  if (!identity) return null;
  const surface = activationSurface();
  if (!surface) return null;
  const key = identity.user_id || identity.visitor_id;
  const membership = readProfileModel().AUDIENCES.find(row => row.profile_key === key);
  if (membership && !membership.audiences.every(label => ["cart_abandoner", "running_interest", "high_value"].includes(label))) return null;
  const profile = readProfileModel().PROFILES?.find(row => row.profile_key === key);
  return { profile_key: key, surface, ...(profile?.club_id ? {club_id: profile.club_id} : {}), audiences: membership ? membership.audiences.slice() : [] };
}

function renderActivation() {
  const club = document.getElementById("activation-club");
  if (club) {
    club.hidden = !/^club_(norte|sur|este|oeste)_home$/.test(window.activationDebug.variant);
    const copy = document.getElementById("activation-club-copy");
    if (copy && !club.hidden) copy.textContent = window.activationDebug.input.club_id.replace("club_", "Club ") + " · " + CLUB_AFFINITIES[window.activationDebug.input.club_id];
  }
  const offer = document.getElementById("activation-offer");
  if (offer) offer.hidden = window.activationDebug.variant !== "cart_recovery_reminder";
  const running = document.getElementById("activation-running");
  if (running) running.hidden = window.activationDebug.variant !== "running_interest_home";
  const loyalty = document.getElementById("activation-loyalty");
  if (loyalty) {
    const wasHidden = loyalty.hidden;
    loyalty.hidden = window.activationDebug.variant !== "loyalty_thank_you";
    const confetti = document.getElementById("activation-confetti");
    if (confetti && (loyalty.hidden || wasHidden)) {
      clearTimeout(celebrationTimer);
      confetti.hidden = true;
      if (!loyalty.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        confetti.hidden = false;
        celebrationTimer = setTimeout(() => { confetti.hidden = true; }, 2600);
      }
    }
  }
  const surface = document.getElementById("activation-debug");
  if (surface) surface.textContent = JSON.stringify(window.activationDebug, null, 2);
}

function finishActivation(decision, source) {
  if (!activationRequest || activationRequest.finished) return;
  if (readAnalyticsConsent() !== "granted") return;
  if (!decision || decision.request_id !== activationRequest.input.request_id ||
      decision.surface !== activationRequest.input.surface || typeof decision.eligible !== "boolean" ||
      (decision.eligible && !/^decision_[a-z0-9_]+$/.test(decision.decision_id || "")) ||
      (decision.action !== null && !compatibleActivation(decision.action, activationRequest.input))) return;
  if (JSON.stringify(activationInput()) !== activationRequest.signature) return;
  activationRequest.finished = true;
  clearTimeout(activationTimer);
  window.activationDebug.decision = JSON.parse(JSON.stringify(decision));
  window.activationDebug.source = source;
  window.activationDebug.variant = decision.eligible && compatibleActivation(decision.action, activationRequest.input) ? decision.action : "standard";
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
    url.searchParams.set("surface", input.surface);
    // Only consented audience labels go to decisioning, no raw events or identity.
    url.searchParams.set("audiences", input.audiences.join(","));
    if (input.club_id) url.searchParams.set("club_id", input.club_id);
    activationScript = document.createElement("script");
    activationScript.src = url.href;
    activationScript.onerror = () => liveFailure("live_error_standard");
    activationTimer = setTimeout(() => liveFailure("live_timeout_standard"), 5000);
    document.head.appendChild(activationScript);
  } catch (error) { liveFailure("live_error_standard"); }
}
