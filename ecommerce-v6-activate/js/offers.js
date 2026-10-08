"use strict";

// Static snapshot of decision rows. Segmentation belongs to profiles.js.
const ACTIVATION_DECISIONS = [
  { decision_id: "decision_cart_recovery", audience: "cart_abandoner",
    action: "cart_recovery_reminder", eligible: true }
];

function snapshotActivation(input) {
  const row = ACTIVATION_DECISIONS.find(decision => input.audiences.includes(decision.audience));
  return { request_id: input.request_id, audiences: input.audiences.slice(),
    decision_id: row ? row.decision_id : null,
    action: row ? row.action : null, eligible: !!row && row.eligible === true };
}
