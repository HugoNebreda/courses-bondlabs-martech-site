"use strict";

// Synthetic fixtures, not authentication credentials or a production identity graph.
const DEMO_ACCOUNTS = {
  "runner_01": {
    "user_id": "u_101",
    "club_id": "club_norte",
    "code": "1101"
  },
  "runner_02": {
    "user_id": "u_102",
    "club_id": "club_norte",
    "code": "1102"
  },
  "runner_03": {
    "user_id": "u_201",
    "club_id": "club_sur",
    "code": "1201"
  },
  "runner_04": {
    "user_id": "u_202",
    "club_id": "club_sur",
    "code": "1202"
  },
  "runner_05": {
    "user_id": "u_301",
    "club_id": "club_este",
    "code": "1301"
  },
  "runner_06": {
    "user_id": "u_302",
    "club_id": "club_este",
    "code": "1302"
  },
  "runner_07": {
    "user_id": "u_401",
    "club_id": "club_oeste",
    "code": "1401"
  },
  "runner_08": {
    "user_id": "u_402",
    "club_id": "club_oeste",
    "code": "1402"
  }
};
const CLUB_AFFINITIES = {
  "club_norte": "Trail, montaña y clima frío",
  "club_sur": "Running ligero, calor e hidratación",
  "club_este": "Road y running urbano",
  "club_oeste": "Outdoor, viento y lluvia"
};
function clubForUser(user) { return Object.values(DEMO_ACCOUNTS).find(account => account.user_id === user)?.club_id || null; }
const MODEL_KEY = "mt_v5_model";
function emptyProfileModel() { return { RAW_EVENTS: [], IDENTITY_LINKS: [], PROFILES: [], AUDIENCES: [] }; }
function readProfileModel() {
  if (readAnalyticsConsent() !== "granted") return emptyProfileModel();
  try {
    const model = JSON.parse(sessionStorage.getItem(MODEL_KEY) || "null");
    return model && Array.isArray(model.RAW_EVENTS) && Array.isArray(model.IDENTITY_LINKS) ? model : emptyProfileModel();
  } catch (error) { return emptyProfileModel(); }
}

function deriveProfiles(model) {
  const profiles = new Map();
  for (const link of model.IDENTITY_LINKS) {
    if (link.evidence !== "synthetic_code_validated" || link.link_reason !== "authenticated_session") continue;
    const club = clubForUser(link.user_id);
    if (!profiles.has(link.user_id)) profiles.set(link.user_id, {profile_key:link.user_id, user_id:link.user_id, club_id:club, affinities:CLUB_AFFINITIES[club] || null, road_evidence:[], visitor_ids:[], observed_cart_quantity:0, running_interest:false, observed_revenue:0, transactions:[]});
  }
  for (const event of model.RAW_EVENTS) {
    const link = model.IDENTITY_LINKS.find(item => item.visitor_id === event.identity.visitor_id &&
      item.link_reason === "authenticated_session" && item.evidence === "synthetic_code_validated");
    const key = link ? link.user_id : event.identity.visitor_id;
    if (!profiles.has(key)) profiles.set(key, { profile_key: key, user_id: link ? link.user_id : null,
      club_id: link ? clubForUser(link.user_id) : null, affinities: link ? CLUB_AFFINITIES[clubForUser(link.user_id)] || null : null, road_evidence: [],
      visitor_ids: [], observed_cart_quantity: 0, running_interest: false, observed_revenue: 0, transactions: [] });
    const profile = profiles.get(key);
    if (!profile.visitor_ids.includes(event.identity.visitor_id)) profile.visitor_ids.push(event.identity.visitor_id);
    if (["view_item", "select_item", "add_to_cart"].includes(event.event_name) &&
        event.ecommerce.items.some(item => item.item_category === "road")) {
      for (const item of event.ecommerce.items.filter(item => item.item_category === "road")) {
        const key = event.event_name + ":" + item.item_id;
        if (item.item_id && !profile.road_evidence.includes(key)) profile.road_evidence.push(key);
      }
      profile.running_interest = profile.road_evidence.length >= 3 && new Set(profile.road_evidence.map(key => key.split(":")[1])).size >= 2;
    }
    const quantity = event.ecommerce.items.reduce((sum, item) => sum + item.quantity, 0);
    if (event.event_name === "add_to_cart") profile.observed_cart_quantity += quantity;
    if (event.event_name === "remove_from_cart") profile.observed_cart_quantity = Math.max(0, profile.observed_cart_quantity - quantity);
    if (event.event_name === "purchase") {
      profile.observed_cart_quantity = 0;
      // Raw evidence stays intact; this projection counts stable transactions once.
      if (!profile.transactions.includes(event.ecommerce.transaction_id)) {
        profile.transactions.push(event.ecommerce.transaction_id);
        profile.observed_revenue += event.ecommerce.value;
      }
    }
  }
  model.PROFILES = Array.from(profiles.values());
  model.AUDIENCES = model.PROFILES.map(profile => ({ profile_key: profile.profile_key,
    audiences: [profile.observed_cart_quantity > 0 ? "cart_abandoner" : null,
      profile.running_interest ? "running_interest" : null,
      profile.observed_revenue >= 200 ? "high_value" : null].filter(Boolean) }));
  return model;
}

function saveProfileModel(model) {
  if (readAnalyticsConsent() !== "granted") return;
  sessionStorage.setItem(MODEL_KEY, JSON.stringify(deriveProfiles(model)));
  renderProfileDebug();
}
function recordProfileEvent(event) {
  if (readAnalyticsConsent() !== "granted") return;
  const model = readProfileModel();
  model.RAW_EVENTS.push(JSON.parse(JSON.stringify(event)));
  saveProfileModel(model);
}
function knownAnalyticsUser(visitorId) {
  const model = readProfileModel();
  const link = model.IDENTITY_LINKS.find(item => item.visitor_id === visitorId &&
    item.link_reason === "authenticated_session" && item.evidence === "synthetic_code_validated");
  return link ? link.user_id : null;
}
function linkDemoAccount(alias, code) {
  const account = DEMO_ACCOUNTS[alias];
  if (!Object.hasOwn(DEMO_ACCOUNTS, alias) || code !== account.code) return { ok: false, message: "Alias o código ficticio incorrecto." };
  const identity = analyticsIdentity();
  if (!identity) return { ok: false, message: "El enlace analítico requiere permiso y almacenamiento. Puedes comprar como invitado." };
  const model = readProfileModel();
  const existing = model.IDENTITY_LINKS.find(link => link.visitor_id === identity.visitor_id);
  if (existing && existing.user_id !== account.user_id) return { ok: false, message: "Este contexto ya pertenece a otra cuenta sintética. Retira y vuelve a aceptar el permiso para cambiar de grupo." };
  if (!model.IDENTITY_LINKS.some(link => link.visitor_id === identity.visitor_id)) {
    model.IDENTITY_LINKS.push({ visitor_id: identity.visitor_id, user_id: account.user_id,
      link_reason: "authenticated_session", evidence: "synthetic_code_validated",
      linked_at: new Date().toISOString(), session_id: identity.session_id });
  }
  saveProfileModel(model);
  renderPrivacyContext();
  return { ok: true, message: "Usuario demo: " + alias + " · " + account.club_id.replace("club_", "Club ") + ". No es autenticación de producción." };
}
function clearProfileContext() {
  try { sessionStorage.removeItem(MODEL_KEY); } catch (error) { /* Fail closed. */ }
  renderProfileDebug();
}
function renderProfileDebug() {
  const badge = document.getElementById("club-profile-info");
  if (badge) {
    const visitor = typeof readVisitorCookie === "function" ? readVisitorCookie() : null;
    const link = readProfileModel().IDENTITY_LINKS.find(row => row.visitor_id === visitor);
    const account = Object.entries(DEMO_ACCOUNTS).find(([, value]) => value.user_id === link?.user_id);
    badge.hidden = !account;
    badge.textContent = account ? "Usuario demo: " + account[0] + " · " + account[1].club_id.replace("club_", "Club ") + " · Afinidad ficticia: " + CLUB_AFFINITIES[account[1].club_id] : "";
  }
  const surface = document.getElementById("profile-debug");
  if (surface) surface.textContent = JSON.stringify(deriveProfiles(readProfileModel()), null, 2);
}
function initializeProfileControls() {
  const form = document.getElementById("demo-signin");
  if (form) form.onsubmit = event => {
    event.preventDefault();
    const code = document.getElementById("demo-code");
    try {
      const result = linkDemoAccount(document.getElementById("demo-alias").value, code.value);
      document.getElementById("signin-status").textContent = result.message;
    } catch (error) { document.getElementById("signin-status").textContent = "El enlace no se pudo guardar. La tienda sigue disponible."; }
    code.value = ""; // Never retain/transmit even this synthetic verification input.
  };
  renderProfileDebug();
}
