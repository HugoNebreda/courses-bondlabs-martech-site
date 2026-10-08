"use strict";

function getExerciseRunId() {
  // Exercise locator for this tab only. This is not visitor/person identity.
  try {
    const existing = sessionStorage.getItem(SHOP_CONFIG.runKey);
    if (/^R[A-F0-9]{8}$/.test(existing)) return existing;
  } catch (error) {
    // The visible locator still works in memory if tab storage is unavailable.
  }
  const id = "R" + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  try { sessionStorage.setItem(SHOP_CONFIG.runKey, id); } catch (error) { /* Memory only. */ }
  return id;
}

const exerciseRunId = getExerciseRunId();
