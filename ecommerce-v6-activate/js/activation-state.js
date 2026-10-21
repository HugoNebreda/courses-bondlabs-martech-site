"use strict";

// D-043: one controller for read scheduling, consented cache and visible experience.
(() => {
  const storageKey = "mt_v6_activation_state", positiveTTL = 300000, negativeTTL = 30000;
  const views = new Map(), flights = new Map(), queue = [], legacyReads = new Map();
  let currentScope, generation = 0, activeRead = null, entries = [], loaded = false, painting = false;
  let lastLegacyKey = null, legacyUntil = 0, legacyPending = false, legacySequence = 0, lastCacheTrace = null;
  const clone = value => value === undefined ? null : JSON.parse(JSON.stringify(value));
  const permitted = () => readAnalyticsConsent() === "granted";
  function scope() {
    if (!permitted()) return null;
    const identity = analyticsIdentity();
    return identity ? JSON.stringify({identity,cart:readCart(),endpoint:SHOP_CONFIG.activationUrl,version:"v6"}) : null;
  }
  let active = null, lastInvalidation = "initial", persistedText;
  function persist() {
    if (!currentScope) {
      if (persistedText !== null) try { sessionStorage.removeItem(storageKey); } catch (error) {}
      persistedText=null; return;
    }
    const text=JSON.stringify({version:1,scope:currentScope,entries,active,last_invalidation:lastInvalidation});
    if (text === persistedText) return;
    persistedText=text;
    try { sessionStorage.setItem(storageKey,text); } catch (error) {}
  }
  function debug() {
    window.activationStateDebug = {active,cache_entries:entries.length,pending:flights.size,reading:activeRead?.slot || null,
      positive_ttl_seconds:300,negative_ttl_seconds:30,last_invalidation:lastInvalidation};
    const node = document.getElementById("activation-state-debug"), text = JSON.stringify(window.activationStateDebug,null,2);
    if (node && node.textContent !== text) node.textContent = text;
  }
  function paint() {
    if (painting) return;
    painting = true;
    try {
      const candidates = [...views.entries()].filter(([,view]) => view && (!view.expires_at || view.expires_at > Date.now()));
      candidates.sort((a,b) => b[1].priority - a[1].priority);
      const winner = candidates[0];
      active = winner ? {slot:winner[0],decision_id:winner[1].id,source:winner[1].source || "contextual_simulation",expires_at:winner[1].expires_at || null} : null;
      for (const [slot,view] of views) if (slot !== winner?.[0]) view.apply(false);
      if (winner) winner[1].apply(true);
      persist(); debug();
    } finally { painting = false; }
  }
  function cancel() {
    generation++;
    for (const job of flights.values()) {
      job.done = true; if (job.abort) job.abort();
      job.resolve({value:null,cancelled:true,from_cache:false,expires_at:0});
    }
    flights.clear(); queue.length = 0; activeRead = null; debug();
  }
  function sync() {
    const next = scope();
    if (next === currentScope) return next;
    cancel();
    for (const view of views.values()) view.apply(false);
    views.clear(); active = null; entries = []; lastLegacyKey = null; legacyUntil = 0; legacyPending = false;
    lastInvalidation = next ? "identity_or_cart_changed" : "consent_or_identity_unavailable";
    currentScope = next;
    if (next && !loaded) {
      loaded = true;
      try {
        const raw = sessionStorage.getItem(storageKey);
        const saved = raw && raw.length <= 65536 ? JSON.parse(raw) : null;
        if (saved?.version === 1 && saved.scope === next && Array.isArray(saved.entries) && saved.entries.length <= 8) {
          entries = saved.entries.filter(entry => entry && typeof entry.key === "string" && entry.key.length <= 12000 &&
            Number.isSafeInteger(entry.created_at) && Number.isSafeInteger(entry.expires_at) && entry.created_at <= Date.now() &&
            entry.expires_at > Date.now() && entry.expires_at - entry.created_at <= positiveTTL);
        }
      } catch (error) { entries = []; }
    }
    persist(); debug(); return next;
  }
  function clear(reason = "teacher_refresh") {
    sync(); cancel(); entries = []; lastLegacyKey = null; legacyUntil = 0;
    lastInvalidation = reason;
    for (const view of views.values()) view.apply(false);
    views.clear(); active = null; persist(); debug();
  }
  function setView(slot,view) {
    if (view) views.set(slot,view);
    else { const prior = views.get(slot); views.delete(slot); if (prior) prior.apply(false); }
    paint(); return active?.slot === slot;
  }
  function pump() {
    if (activeRead || !queue.length) return;
    const job = queue.shift();
    if (job.done) { pump(); return; }
    activeRead = job; debug();
    Promise.resolve().then(() => {
      if (job.done || job.generation !== generation || scope() !== currentScope) return null;
      return job.perform(abort => { job.abort = abort; if (job.done) abort(); });
    }).then(value => {
      if (job.done || job.generation !== generation || scope() !== currentScope) return;
      const valid = job.validate(value), stored = valid ? clone(value) : null;
      const ttl = valid && value?.eligible ? positiveTTL : negativeTTL;
      const created = Date.now(), expiry = created + ttl;
      entries = entries.filter(entry => entry.key !== job.key && entry.expires_at > created).slice(-7);
      entries.push({key:job.key,created_at:created,expires_at:expiry,value:stored}); persist();
      job.resolve({value:stored,from_cache:false,expires_at:expiry}); job.done = true;
    }).catch(() => {
      if (!job.done && job.generation === generation) {
        const created = Date.now(); entries = entries.filter(entry => entry.key !== job.key).slice(-7);
        entries.push({key:job.key,created_at:created,expires_at:created+negativeTTL,value:null}); persist();
        job.resolve({value:null,from_cache:false,expires_at:created+negativeTTL}); job.done = true;
      }
    }).finally(() => {
      if (!job.done) { job.done = true; job.resolve({value:null,cancelled:true,expires_at:0}); }
      if (flights.get(job.key) === job) flights.delete(job.key);
      if (activeRead === job) activeRead = null;
      debug(); pump();
    });
  }
  function lookup(slot,key,perform,validate) {
    if (!sync()) return Promise.resolve({value:null,cancelled:true,expires_at:0});
    const fullKey = slot + ":" + key;
    const cached = entries.find(entry => entry.key === fullKey && entry.expires_at > Date.now() && (entry.value === null || validate(entry.value)));
    if (cached) {
      if (lastCacheTrace !== fullKey && typeof teachingTrace === "function") teachingTrace("DECISION CACHE","Se reutiliza una decisión vigente; no se consulta GSheet.",{source:"session_cache",decision_id:cached.value?.decision_id});
      lastCacheTrace = fullKey;
      return Promise.resolve({value:clone(cached.value),from_cache:true,expires_at:cached.expires_at});
    }
    if (flights.has(fullKey)) return flights.get(fullKey).promise;
    let resolve; const promise = new Promise(done => { resolve = done; });
    const job = {slot,key:fullKey,perform,validate,resolve,promise,generation,done:false};
    flights.set(fullKey,job); queue.push(job); pump(); return promise;
  }
  function legacyNodes() {
    return ["activation-club","activation-running","activation-lifetime","activation-loyalty",...(!SHOP_CONFIG.activationUrl ? ["activation-offer"] : [])];
  }
  function legacyView() {
    const variant = window.activationDebug.variant;
    const selected = {running_interest_home:"activation-running",loyalty_thank_you:"activation-loyalty",lifetime_10k_thank_you:"activation-lifetime",cart_recovery_reminder:"activation-offer"}[variant] || (/^club_/.test(variant) ? "activation-club" : null);
    const eligible = selected && !(SHOP_CONFIG.activationUrl && selected === "activation-offer");
    setView("legacy",{id:eligible ? variant : "standard",source:window.activationDebug.cache?.hit ? "session_cache" : window.activationDebug.source,priority:eligible ? (document.body.dataset.page === "confirmation" ? 1000 : 400) : -1,
      expires_at:eligible ? (legacyUntil || null) : 1,
      apply:visible => { for (const id of legacyNodes()) { const node=document.getElementById(id); const hidden=!(visible && eligible && id===selected); if (node && node.hidden !== hidden) node.hidden=hidden; } }});
  }
  const nativeRender = renderActivation, nativeRefresh = refreshActivation;
  let renderedLegacy = null;
  renderActivation = function () {
    const revision=JSON.stringify(window.activationDebug);
    if (revision !== renderedLegacy) { renderedLegacy=revision; nativeRender(); }
    legacyView();
  };
  function validLegacy(value,input) {
    return !!value && (typeof value.error === "string" && ["live_error_standard","live_timeout_standard"].includes(value.error) ||
      value.surface === input.surface && typeof value.eligible === "boolean" &&
      (!value.eligible || /^decision_[a-z0-9_]+$/.test(value.decision_id || "")) &&
      (value.action === null || compatibleActivation(value.action,input)));
  }
  window.MarTechSandbox.receiveActivation = value => {
    const read = legacyReads.get(value?.request_id);
    if (read && validLegacy(value,read.input)) read.finish(value);
  };
  function campaignActive() {
    const values = new URLSearchParams(location.search).getAll("vengodepartede"), allowed=["unamigo","usainbolt","hugo"];
    if (values.length) return values.length === 1 && allowed.includes(values[0]);
    try { return allowed.includes(sessionStorage.getItem("mt_v6_recovery_referrer")); } catch (error) { return false; }
  }
  refreshActivation = function (options = {}) {
    sync();
    if (options.force) clear();
    const input = activationInput(), key = JSON.stringify({input,scope:currentScope,url:SHOP_CONFIG.activationUrl});
    if (!options.force && lastLegacyKey === key && (legacyPending || legacyUntil > Date.now())) return;
    lastLegacyKey = key;
    if (!SHOP_CONFIG.activationUrl) { legacyUntil = Date.now()+positiveTTL; return nativeRefresh(); }
    clearTimeout(activationTimer); if (activationScript) activationScript.remove();
    const requestId = "act_" + (++legacySequence), signature = JSON.stringify(input);
    activationRequest = input ? {input:{...input,request_id:requestId},signature,finished:false} : null;
    const managed = input && (["home","cart"].includes(input.surface) && readCart().length > 0 || input.surface !== "confirmation" && campaignActive());
    if (input && typeof traceProfileProjection === "function") traceProfileProjection(readProfileModel());
    window.activationDebug = {input:activationRequest?.input || null,decision:null,source:managed ? "recovery_managed" : input ? "pending" : "consent_or_context_unavailable",variant:"standard"};
    renderActivation();
    if (!input || managed) { legacyUntil = Date.now()+negativeTTL; if (activationRequest) activationRequest.finished=true; return; }
    legacyPending = true;
    const requestScope = currentScope;
    lookup("legacy",JSON.stringify(input),abort => new Promise(resolve => {
      const id="act_"+(++legacySequence), script=document.createElement("script"); let timer;
      const finish = value => { clearTimeout(timer); legacyReads.delete(id); script.remove(); resolve(value); };
      legacyReads.set(id,{input,finish}); abort(() => finish(null));
      try {
        const url=new URL(SHOP_CONFIG.activationUrl,location.href);
        if (!["https:","http:"].includes(url.protocol)) throw Error("Invalid activation URL");
        const params={operation:"activation",request_id:id,surface:input.surface,audiences:input.audiences.join(","),...(input.club_id ? {club_id:input.club_id} : {})};
        if (input.customer) Object.assign(params,{sandbox_version:"v6-activate",user_id:input.customer.user_id,transaction_id:input.customer.transaction_id});
        for (const [name,value] of Object.entries(params)) url.searchParams.set(name,value);
        script.src=url.href; script.onerror=()=>finish({error:"live_error_standard"}); timer=setTimeout(()=>finish({error:"live_timeout_standard"}),5000); document.head.append(script);
      } catch (error) { finish({error:"live_error_standard"}); }
    }),value=>validLegacy(value,input)).then(result => {
      if (result.cancelled || requestScope !== scope() || key !== lastLegacyKey) return;
      legacyPending=false; legacyUntil=result.expires_at;
      const value=result.value;
      if (activationRequest) activationRequest.finished=true;
      window.activationDebug = {input:{...input,request_id:value?.request_id || requestId},decision:value?.error ? null : value,
        source:value?.error || (value ? "live" : "live_error_standard"),variant:value?.eligible && compatibleActivation(value.action,input) ? value.action : "standard",
        cache:{hit:result.from_cache,expires_at:result.expires_at}};
      renderActivation();
    });
  };
  function noteRecovery(value) {
    if (!["catalog","cart"].includes(document.body.dataset.page) || !SHOP_CONFIG.activationUrl) return;
    const input=activationInput();
    if (activationRequest) activationRequest.signature=JSON.stringify(input);
    window.activationDebug={input:input ? {...input,request_id:value?.request_id || null} : null,decision:value?.eligible !== undefined ? value : null,
      source:value?.source === "live_sheet" ? "live" : "live_error_standard",variant:value?.eligible ? "cart_recovery_reminder" : "standard",cache:value?.cache || null};
    const node=document.getElementById("activation-debug"); if (node) node.textContent=JSON.stringify(window.activationDebug,null,2);
  }
  window.MarTechSandbox.activationState={lookup,sync,cancel,clear,setView,scope,noteRecovery,positiveTTL,negativeTTL};
  document.addEventListener("DOMContentLoaded",()=>{
    const lab=document.getElementById("how-to-dialog"); if (!lab) return;
    const section=document.createElement("section"), heading=document.createElement("h3"), node=document.createElement("pre");
    heading.textContent="Decisión activa y caché"; node.id="activation-state-debug"; section.append(heading,node); lab.querySelector("#how-to-close").before(section); debug();
  });
})();
