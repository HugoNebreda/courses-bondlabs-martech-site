"use strict";

const SHOP_CONFIG = {
  catalogUrls: ["../catalogs/current.json", "./data/catalog.json"],
  cartKey: "mt_v6_cart",
  orderKey: "mt_v6_order",
  runKey: "mt_v6_run",
  consentKey: "mt_v6_consent",
  sessionKey: "mt_v6_session",
  visitorCookie: "mt_v6_visitor",
  // Paste the deployed teaching collector /exec URL here. Empty means no transport.
  collectorUrl: "",
  // Empty uses bundled offers.js; optional Apps Script read endpoint, never a secret.
  activationUrl: ""
};
