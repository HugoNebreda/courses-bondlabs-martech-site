"use strict";

// Static snapshot of decision rows. Segmentation belongs to profiles.js.
const ACTIVATION_DECISIONS = [
  {
    "audience": "cart_abandoner",
    "action": "cart_recovery_reminder",
    "surfaces": [
      "home",
      "cart"
    ],
    "decision_id": "decision_cart_recovery",
    "eligible": true
  },
  {
    "audience": "high_value",
    "action": "loyalty_thank_you",
    "surfaces": [
      "confirmation"
    ],
    "decision_id": "decision_loyalty_thanks",
    "eligible": true
  },
  {
    "audience": "",
    "club_id": "club_norte",
    "action": "club_norte_home",
    "surfaces": [
      "home"
    ],
    "decision_id": "decision_club_norte",
    "eligible": true
  },
  {
    "audience": "",
    "club_id": "club_sur",
    "action": "club_sur_home",
    "surfaces": [
      "home"
    ],
    "decision_id": "decision_club_sur",
    "eligible": true
  },
  {
    "audience": "",
    "club_id": "club_este",
    "action": "club_este_home",
    "surfaces": [
      "home"
    ],
    "decision_id": "decision_club_este",
    "eligible": true
  },
  {
    "audience": "",
    "club_id": "club_oeste",
    "action": "club_oeste_home",
    "surfaces": [
      "home"
    ],
    "decision_id": "decision_club_oeste",
    "eligible": true
  },
  {
    "audience": "running_interest",
    "action": "running_interest_home",
    "surfaces": [
      "home"
    ],
    "decision_id": "decision_running_home",
    "eligible": true
  }
];

function snapshotActivation(input) {
  const row = ACTIVATION_DECISIONS.find(decision => decision.surfaces.includes(input.surface) &&
    (decision.club_id ? input.club_id === decision.club_id : input.audiences.includes(decision.audience)));
  return { request_id: input.request_id, surface: input.surface, audiences: input.audiences.slice(),
    decision_id: row?.eligible === true ? row.decision_id : null,
    action: row?.eligible === true ? row.action : null, eligible: !!row && row.eligible === true };
}
