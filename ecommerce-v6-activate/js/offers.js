"use strict";

// Static snapshot of decision rows. Segmentation belongs to profiles.js.
const ACTIVATION_DECISIONS = [
  { decision_id: "decision_running_home", audience: "running_interest",
    surfaces: ["home"], action: "running_interest_home", eligible: true },
  { decision_id: "decision_cart_recovery", audience: "cart_abandoner",
    surfaces: ["home", "cart"], action: "cart_recovery_reminder", eligible: true },
  { decision_id: "decision_loyalty_thanks", audience: "high_value",
    surfaces: ["confirmation"], action: "loyalty_thank_you", eligible: true }
];

function snapshotActivation(input) {
  const row = ACTIVATION_DECISIONS.find(decision => decision.surfaces.includes(input.surface) &&
    input.audiences.includes(decision.audience) && decision.eligible === true);
  return { request_id: input.request_id, surface: input.surface, audiences: input.audiences.slice(),
    decision_id: row ? row.decision_id : null,
    action: row ? row.action : null, eligible: !!row && row.eligible === true };
}
