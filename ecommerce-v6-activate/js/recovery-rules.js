"use strict";

// D-044: fixed-callback snapshots; browser context never asserts audiences.
function validRecoveryPresentation(config, action) {
  if (!config || Object.keys(config).sort().join(",") !== "cta_label,discount_percent,layout,message,min_cart_total,theme,title") return false;
  const min = config.min_cart_total, percent = config.discount_percent;
  return typeof min === "number" && Number.isFinite(min) && min >= 0 && min <= 1000000 &&
    Math.abs(min * 100 - Math.round(min * 100)) < 0.000001 && Number.isInteger(percent) && percent >= 0 && percent <= 100 &&
    (action !== "exit_email" || percent === 0) && (action !== "exit_discount" || percent > 0) &&
    [["title",120],["message",400],["cta_label",60]].every(([key,max]) => typeof config[key] === "string" && config[key].trim().length > 0 && config[key].length <= max) &&
    ["blue","green","orange"].includes(config.theme) && ["compact","split","spotlight"].includes(config.layout);
}
// D-044: network only in prepare(); request() evaluates downloaded rules locally.
(() => {
  const key="mt_v6_recovery_snapshot", ttl=300000, failureTTL=30000;
  const labels=["cart_abandoner","high_value","running_interest"], pending=new Map();
  let sequence=0, generation=0, saved=null, scope, flight=null, listener=()=>{}, storageText=null, firstPreparation=true;
  const surface=()=>document.body.dataset.page === "catalog" ? "home" : document.body.dataset.page;
  const permitted=()=>readAnalyticsConsent() === "granted";
  const audienceScope=()=>permitted() ? JSON.stringify({identity:analyticsIdentity(),endpoint:SHOP_CONFIG.activationUrl}) : null;
  function contextKey() {return permitted() ? JSON.stringify({scope:audienceScope(),surface:surface(),cart:readCart()}) : null;}
  function validSnapshot(value,kind) {
    if (!value || value.contract!=="recovery_snapshot_v1" || value.kind!==kind || typeof value.ok!=="boolean" ||
        typeof value.reason!=="string" || value.reason.length>80) return false;
    if (!value.ok) return value.rules===null && value.audiences===null;
    if (kind==="audiences") return value.rules===null && Array.isArray(value.audiences) && value.audiences.length<=3 &&
      new Set(value.audiences).size===value.audiences.length && value.audiences.every(label=>labels.includes(label));
    return value.audiences===null && Array.isArray(value.rules) && value.rules.length<=100 && value.rules.every(rule=>
      rule && typeof rule.decision_id==="string" && rule.decision_id.length<=100 &&
      Array.isArray(rule.audiences) && rule.audiences.length>0 && rule.audiences.length<=3 && rule.audiences.every(label=>labels.includes(label)) &&
      ["cart_return","exit_intent"].includes(rule.trigger) && typeof rule.eligible==="boolean" && typeof rule.valid==="boolean" &&
      Number.isInteger(rule.priority) && rule.priority>=0 && rule.priority<=10001 &&
      (rule.min_cart_total===null || typeof rule.min_cart_total==="number" && Number.isFinite(rule.min_cart_total) && rule.min_cart_total>=0 && rule.min_cart_total<=1000000 && Math.abs(rule.min_cart_total*100-Math.round(rule.min_cart_total*100))<0.000001) &&
      (!rule.valid ? rule.action===null && rule.config===null :
        /^decision_[a-z0-9_]+$/.test(rule.decision_id) &&
        (rule.trigger==="cart_return" ? rule.action==="cart_recovery_reminder" : ["exit_discount","exit_email"].includes(rule.action)) &&
        validRecoveryPresentation(rule.config,rule.action) && rule.config.min_cart_total===rule.min_cart_total));
  }
  function validEntry(entry,kind) {return entry && Number.isSafeInteger(entry.created_at) && Number.isSafeInteger(entry.expires_at) &&
    entry.created_at<=Date.now() && entry.expires_at>Date.now() && entry.expires_at-entry.created_at<=ttl &&
    (entry.value===null || validSnapshot(entry.value,kind));}
  function persist() {
    try {
      if (!saved) {sessionStorage.removeItem(key);storageText=null;return;}
      const text=JSON.stringify(saved);if (text!==storageText) {sessionStorage.setItem(key,text);storageText=text;}
    } catch (error) { /* In-memory operation still works. */ }
  }
  function diagnostics() {
    window.recoverySnapshotDebug={phase:flight ? "downloading" : "local_evaluation",rules_ready:!!(validEntry(saved?.rules,"rules") && saved.rules.value?.ok),
      audiences_ready:!!(saved?.scope===scope && validEntry(saved?.audiences,"audiences") && saved.audiences.value?.ok),
      downloaded_at:validEntry(saved?.rules,"rules") ? new Date(saved.rules.created_at).toISOString() : null,
      expires_at:validEntry(saved?.rules,"rules") ? new Date(saved.rules.expires_at).toISOString() : null,
      audiences:saved?.audiences?.value?.audiences || [],reason:saved?.audiences?.value?.reason || "not_loaded"};
  }
  function complete(id,value) {const read=pending.get(id);if(!read)return;pending.delete(id);clearTimeout(read.timer);read.script.remove();read.resolve(value);}
  function cancel() {generation++;for(const id of [...pending.keys()])complete(id,null);flight=null;}
  function sync() {
    const next=audienceScope();if(next===scope)return;
    cancel();scope=next;
    if(!next || !SHOP_CONFIG.activationUrl) {saved=null;persist();diagnostics();return;}
    if(!saved) try {const text=sessionStorage.getItem(key);if(text && text.length<=150000) {
      const parsed=JSON.parse(text);if(parsed.version===1 && parsed.endpoint===SHOP_CONFIG.activationUrl)saved=parsed;
    }} catch(error) {saved=null;}
    if(!saved || saved.endpoint!==SHOP_CONFIG.activationUrl) saved={version:1,endpoint:SHOP_CONFIG.activationUrl,rules:null,audiences:null};
    if(saved.scope!==next) saved.audiences=null;
    saved.scope=next;persist();diagnostics();
  }
  window.MarTechSandbox.receiveRecoverySnapshot=value=>{
    const read=pending.get(value?.request_id);
    if(read && read.scope===audienceScope() && read.generation===generation && validSnapshot(value,read.kind))complete(value.request_id,value);
  };
  function download(kind) {
    return new Promise(resolve=>{
      const id="rec_"+(++sequence),script=document.createElement("script");
      const read={kind,script,resolve,scope,generation};pending.set(id,read);
      read.timer=setTimeout(()=>complete(id,null),5000);
      try {
        const url=new URL(SHOP_CONFIG.activationUrl,location.href);if(!["https:","http:"].includes(url.protocol))throw Error("Invalid URL");
        const params={operation:kind==="rules" ? "recovery_config" : "recovery_audiences",request_id:id,sandbox_version:"v6-activate",
          ...(kind==="audiences" ? analyticsIdentity() : {})};
        for(const [name,value]of Object.entries(params))if(value!==null)url.searchParams.set(name,value);
        script.src=url.href;script.onerror=()=>complete(id,null);document.head.append(script);
      }catch(error){complete(id,null);}
    });
  }
  function prepare(force=false) {
    sync();if(!scope || !SHOP_CONFIG.activationUrl)return Promise.resolve(false);
    if(flight && !force)return flight;
    if(force){cancel();saved.rules=null;saved.audiences=null;persist();}
    const kinds=["rules","audiences"].filter(kind=>!validEntry(saved[kind],kind) || kind==="audiences" && firstPreparation);
    firstPreparation=false;
    if(!kinds.length){diagnostics();return Promise.resolve(true);}
    const current=generation, signature=scope;
    const work=(async()=>{
      // Sequential, bounded downloads; never start a read from an exit/cart event.
      for(const kind of kinds) {
        const value=await download(kind);
        if(current!==generation || signature!==audienceScope())return false;
        const now=Date.now();saved[kind]={value,created_at:now,expires_at:now+(value?.ok ? ttl : failureTTL)};persist();
      }
      return true;
    })();
    flight=work;diagnostics();listener();
    return work.finally(()=>{if(flight===work){flight=null;diagnostics();listener();}});
  }
  function evaluate(trigger,cents) {
    sync();diagnostics();
    const result={contract:"recovery_v1",trigger,surface:surface(),eligible:false,decision_id:null,action:null,audiences:[],config:null,
      source:"live_unavailable_standard",evaluation:"local",reason:"configuration_not_ready",cache:{hit:true,expires_at:Date.now()+30000}};
    if(!scope || !["home","cart","product","checkout"].includes(surface()) ||
        !["cart_return","exit_intent"].includes(trigger) || trigger==="cart_return" && !["home","cart"].includes(surface()) ||
        !Number.isSafeInteger(cents) || cents<=0 || cents>999999999) return {...result,reason:"invalid_context"};
    if(!validEntry(saved?.rules,"rules") || !saved.rules.value?.ok)return {...result,reason:flight ? "configuration_loading" : "configuration_unavailable_or_expired"};
    if(!validEntry(saved?.audiences,"audiences") || !saved.audiences.value?.ok)return {...result,reason:flight ? "audiences_loading" : saved?.audiences?.value?.reason || "audiences_unavailable_or_expired"};
    result.request_id=saved.rules.value.request_id;result.source="live_sheet";result.cache.expires_at=Math.min(saved.rules.expires_at,saved.audiences.expires_at);result.audiences=saved.audiences.value.audiences;
    const candidates=saved.rules.value.rules.filter(rule=>rule.trigger===trigger && rule.audiences.every(label=>result.audiences.includes(label)) &&
      (rule.min_cart_total===null || cents>=Math.round(rule.min_cart_total*100))).sort((a,b)=>b.priority-a.priority);
    const rule=candidates[0];if(!rule)return {...result,reason:"no_matching_rule"};
    result.decision_id=rule.decision_id;
    if(!rule.valid)return {...result,reason:"invalid_rule"};
    if(!rule.eligible)return {...result,reason:"rule_disabled"};
    return {...result,eligible:true,action:rule.action,config:rule.config,reason:"matched"};
  }
  function presentation(config,field) {return config[field].replaceAll("{discount}",String(config.discount_percent)).replaceAll("{min_cart_total}",
    new Intl.NumberFormat("es-ES",{maximumFractionDigits:2}).format(config.min_cart_total));}
  function paint(element,config){element.classList.add("recovery-configured");element.dataset.theme=config.theme;element.dataset.layout=config.layout;}
  window.MarTechSandbox.recoveryRules={request:(trigger,cents)=>Promise.resolve(evaluate(trigger,cents)),evaluate,prepare,cancel,contextKey,presentation,paint,
    audienceScope,onChange:callback=>{listener=callback;},validSnapshot};
})();
