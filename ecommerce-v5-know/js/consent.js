"use strict";

// Permission, browser storage and anonymous context are separate concepts.
// This is a teaching control, not a production CMP or legal advice.
let memoryConsent = "unset";
let pageConsentOverride = null;
const visitorCookiePath = location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1);

function readAnalyticsConsent() {
  if (pageConsentOverride !== null) return pageConsentOverride;
  try {
    const stored = localStorage.getItem(SHOP_CONFIG.consentKey);
    return stored === "granted" || stored === "denied" ? stored : "unset";
  } catch (error) {
    return memoryConsent; // An explicit choice can still work on this page.
  }
}

function readVisitorCookie() {
  const prefix = SHOP_CONFIG.visitorCookie + "=";
  const cookie = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  const value = cookie ? cookie.slice(prefix.length) : "";
  return /^vis_[a-f0-9-]{36}$/.test(value) ? value : null;
}

function writeVisitorCookie(value, maxAge) {
  // First-party cookie describes storage/sending, not data provenance or a person.
  document.cookie = SHOP_CONFIG.visitorCookie + "=" + value + "; Path=" + visitorCookiePath +
    "; Max-Age=" + maxAge + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
}

function clearAnalyticsIdentity() {
  try { writeVisitorCookie("", 0); } catch (error) { /* Cookie access may be blocked. */ }
  try { sessionStorage.removeItem(SHOP_CONFIG.sessionKey); } catch (error) { /* Storage may be blocked. */ }
  clearProfileContext();
}

function analyticsIdentity() {
  if (readAnalyticsConsent() !== "granted") {
    clearAnalyticsIdentity();
    return null;
  }
  try {
    let visitorId = readVisitorCookie();
    if (!visitorId) {
      writeVisitorCookie("vis_" + crypto.randomUUID(), 60 * 60 * 24 * 180);
      visitorId = readVisitorCookie();
    }
    let sessionId = sessionStorage.getItem(SHOP_CONFIG.sessionKey);
    if (!/^ses_[a-f0-9-]{36}$/.test(sessionId)) {
      sessionId = "ses_" + crypto.randomUUID();
      sessionStorage.setItem(SHOP_CONFIG.sessionKey, sessionId);
    }
    // Fail closed if required storage is unavailable; commerce is independent.
    if (!visitorId || sessionStorage.getItem(SHOP_CONFIG.sessionKey) !== sessionId) return null;
    return { run_id: exerciseRunId, visitor_id: visitorId, session_id: sessionId, user_id: knownAnalyticsUser(visitorId) };
  } catch (error) {
    return null;
  }
}

function renderPrivacyContext() {
  const identity = analyticsIdentity();
  document.getElementById("run-id").textContent = exerciseRunId;
  document.getElementById("consent-state").textContent = readAnalyticsConsent();
  document.getElementById("session-id").textContent = identity ? identity.session_id : "null";
  document.getElementById("visitor-id").textContent = identity ? identity.visitor_id : "null";
  document.getElementById("user-id").textContent = identity && identity.user_id ? identity.user_id : "null";
}

function setAnalyticsConsent(choice) {
  if (choice !== "granted" && choice !== "denied") return;
  memoryConsent = choice;
  try {
    localStorage.setItem(SHOP_CONFIG.consentKey, choice);
    pageConsentOverride = null;
  } catch (error) {
    // A failed write must never let an old grant override an explicit withdrawal.
    pageConsentOverride = choice;
    try { localStorage.removeItem(SHOP_CONFIG.consentKey); } catch (failure) { /* Storage unavailable. */ }
  }
  if (choice !== "granted") clearAnalyticsIdentity();
  renderPrivacyContext();
  document.getElementById("privacy-preferences").hidden = true;
  document.getElementById("privacy-open").focus();
  // Intentionally do not replay page views or any pre-consent interactions.
}

function initializePrivacyControls() {
  renderPrivacyContext();
  const preferences = document.getElementById("privacy-preferences");
  preferences.hidden = readAnalyticsConsent() !== "unset";
  document.getElementById("privacy-open").onclick = () => {
    preferences.hidden = false;
    document.getElementById("analytics-grant").focus();
  };
  document.getElementById("privacy-close").onclick = () => {
    preferences.hidden = true;
    document.getElementById("privacy-open").focus();
  };
  document.getElementById("analytics-grant").onclick = () => setAnalyticsConsent("granted");
  document.getElementById("analytics-deny").onclick = () => setAnalyticsConsent("denied");
}

// Another tab can withdraw permission; subsequent calls also re-read the choice.
window.addEventListener("storage", event => {
  if (event.key === SHOP_CONFIG.consentKey || event.key === null) renderPrivacyContext();
});
