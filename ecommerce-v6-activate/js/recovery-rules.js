"use strict";

// D-042: fixed-callback, read-only decisions. Browser context never asserts audiences.
function validRecoveryPresentation(config, action) {
  if (!config || Object.keys(config).sort().join(",") !== "cta_label,discount_percent,layout,message,min_cart_total,theme,title") return false;
  const min = config.min_cart_total, percent = config.discount_percent;
  return typeof min === "number" && Number.isFinite(min) && min >= 0 && min <= 1000000 &&
    Math.abs(min * 100 - Math.round(min * 100)) < 0.000001 && Number.isInteger(percent) && percent >= 0 && percent <= 100 &&
    (action !== "exit_email" || percent === 0) && (action !== "exit_discount" || percent > 0) &&
    [["title",120],["message",400],["cta_label",60]].every(([key,max]) => typeof config[key] === "string" && config[key].trim().length > 0 && config[key].length <= max) &&
    ["blue","green","orange"].includes(config.theme) && ["compact","split","spotlight"].includes(config.layout);
}
(() => {
  let sequence = 0;
  const pending = new Map();
  const surface = () => document.body.dataset.page === "catalog" ? "home" : document.body.dataset.page;
  function contextKey() {
    if (readAnalyticsConsent() !== "granted") return null;
    return JSON.stringify({identity:analyticsIdentity(),surface:surface(),cart:readCart(),url:SHOP_CONFIG.activationUrl});
  }
  function complete(id, result) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id); clearTimeout(request.timer); request.script.remove(); request.resolve(result);
  }
  function cancel() { for (const id of [...pending.keys()]) complete(id,null); }
  window.MarTechSandbox.receiveRecoveryActivation = result => {
    const request = pending.get(result?.request_id);
    if (!request || contextKey() !== request.signature || result.contract !== "recovery_v1" ||
        result.trigger !== request.trigger || result.surface !== request.surface || typeof result.eligible !== "boolean" ||
        !Array.isArray(result.audiences) || result.audiences.some(value => !["cart_abandoner","high_value","running_interest"].includes(value)) ||
        typeof result.reason !== "string" || result.reason.length > 80) return;
    if (result.eligible && (!/^decision_[a-z0-9_]+$/.test(result.decision_id || "") ||
        !(request.trigger === "cart_return" ? result.action === "cart_recovery_reminder" : ["exit_discount","exit_email"].includes(result.action)) ||
        !validRecoveryPresentation(result.config,result.action) || Math.round(result.config.min_cart_total * 100) > request.cents)) return;
    if (!result.eligible && (result.action !== null || result.config !== null)) return;
    complete(result.request_id, {...result, source:"live_sheet"});
  };
  function validDecision(result,trigger,cents) {
    return !!result && result.contract === "recovery_v1" && result.trigger === trigger &&
      ["home","cart","product","checkout"].includes(result.surface) && typeof result.eligible === "boolean" &&
      Array.isArray(result.audiences) && result.audiences.every(value => ["cart_abandoner","high_value","running_interest"].includes(value)) &&
      typeof result.reason === "string" && result.reason.length <= 80 && (!result.eligible ? result.action === null && result.config === null :
        /^decision_[a-z0-9_]+$/.test(result.decision_id || "") &&
        (trigger === "cart_return" ? result.action === "cart_recovery_reminder" : ["exit_discount","exit_email"].includes(result.action)) &&
        validRecoveryPresentation(result.config,result.action) && Math.round(result.config.min_cart_total * 100) <= cents);
  }
  function request(trigger, cents) {
    const signature = contextKey(), identity = signature ? analyticsIdentity() : null;
    if (!SHOP_CONFIG.activationUrl || !identity || !Number.isSafeInteger(cents) || cents <= 0 || cents > 999999999 ||
        !["home","cart","product","checkout"].includes(surface()) || !["cart_return","exit_intent"].includes(trigger)) return Promise.resolve(null);
    const state = window.MarTechSandbox.activationState;
    const perform = abort => new Promise(resolve => {
      const id = "rec_" + (++sequence), script = document.createElement("script");
      const read = {resolve,script,signature,trigger,surface:surface(),cents};
      pending.set(id,read); if (abort) abort(() => complete(id,null));
      read.timer = setTimeout(() => complete(id,null),5000);
      try {
        const url = new URL(SHOP_CONFIG.activationUrl,location.href);
        if (!["https:","http:"].includes(url.protocol)) throw Error("Invalid activation URL");
        const params = {operation:"recovery_activation",request_id:id,trigger,surface:read.surface,
          sandbox_version:"v6-activate",...identity,cart_cents:String(cents)};
        for (const [key,value] of Object.entries(params)) if (value !== null) url.searchParams.set(key,value);
        script.src = url.href; script.onerror = () => complete(id,null); document.head.append(script);
      } catch (error) { complete(id,null); }
    });
    if (!state) return perform();
    // Current backend applies the same trigger rules on all allowed shop surfaces.
    // Cached answers keep their original response surface/provenance unchanged.
    return state.lookup("recovery",JSON.stringify({trigger,cents}),perform,value=>validDecision(value,trigger,cents)).then(answer => {
      if (answer.cancelled) return null;
      const cache = {hit:answer.from_cache,expires_at:answer.expires_at};
      return answer.value ? {...answer.value,cache} : {source:"live_unavailable_standard",eligible:false,reason:"service_unavailable",cache};
    });
  }
  function presentation(config, field) {
    return config[field].replaceAll("{discount}",String(config.discount_percent)).replaceAll("{min_cart_total}",
      new Intl.NumberFormat("es-ES",{maximumFractionDigits:2}).format(config.min_cart_total));
  }
  function paint(element,config) {
    element.classList.add("recovery-configured"); element.dataset.theme = config.theme; element.dataset.layout = config.layout;
  }
  window.MarTechSandbox.recoveryRules = {request,cancel,contextKey,presentation,paint};
})();
