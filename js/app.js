// UI for Should I Buy It? Body Care. Everything runs in the browser: built-in products, Open Beauty Facts lookups,
// pasted lists, and the profile in localStorage. Routes: #check, #p=<id>, #i=<share>, #cmp=a,b, #compare, #browse, #skin.
(function () {
  "use strict";
  const W = /** @type {any} */ (window);
  const Ing = W.BodyIngredients, V = W.BodyVerdict, Src = W.BodySources;
  const { PRODUCTS, byId } = W.BodyProducts;
  const CFG = W.BODY_CONFIG || {};
  const $ = id => /** @type {any} */ (document.getElementById(id));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: keep going */ } },
  };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthYear = d => { const m = /^(\d{4})-(\d{2})/.exec(d || ""); return m ? MONTHS[+m[2] - 1] + " " + m[1] : ""; };
  const label = p => ((p.brand ? p.brand + " " : "") + p.name).trim();
  const CAT_ORDER = Object.keys(V.CATEGORIES);

  let profile = V.normalizeProfile(store.get("body.profile", null) || {});
  let current = null;        // { key, product }   key: "p:<id>" or "i:<share>"
  let leaveOverride = null;  // rinse/leave toggle for the current product
  let lastResult = null;
  let tab = "check";
  const cmp = { a: "", b: "" };
  const browse = { cat: "All", sort: "best" };

  if (CFG.mode !== "pages") document.querySelectorAll("[data-pages-only]").forEach(el => el.remove());

  // ---------- share links ----------
  function b64urlEncode(str) {
    const bytes = new TextEncoder().encode(str); let bin = "";
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    return new TextDecoder().decode(Uint8Array.from(atob(s), c => c.charCodeAt(0)));
  }
  function encodeProduct(p, leaveOn) {
    const o = /** @type {any} */ ({ n: p.name, b: p.brand || "", c: p.category, t: p.ingredients });
    if (typeof leaveOn === "boolean") o.l = leaveOn ? 1 : 0;
    if (p.source === "Open Beauty Facts" && p.code) { o.s = "obf"; o.u = p.code; }
    return b64urlEncode(JSON.stringify(o));
  }
  function decodeProduct(s) {
    try {
      const o = JSON.parse(b64urlDecode(s));
      if (!o || typeof o.t !== "string") return null;
      const obf = o.s === "obf" && o.u;
      return {
        product: { id: "i", name: String(o.n || "Pasted list").slice(0, 140), brand: String(o.b || "").slice(0, 80), category: V.CATEGORIES[o.c] ? o.c : "Body wash",
          ingredients: o.t.slice(0, 10000), source: obf ? "Open Beauty Facts" : "Pasted", code: obf ? String(o.u) : "", sourceUrl: obf ? Src.BASE + "/product/" + encodeURIComponent(o.u) : "" },
        leaveOn: o.l === 1 ? true : o.l === 0 ? false : null,
      };
    } catch { return null; }
  }
  const keyHash = key => key.startsWith("p:") ? "p=" + key.slice(2) : "i=" + key.slice(2);
  const keyToken = key => key.startsWith("p:") ? key.slice(2) : "i." + key.slice(2);
  const tokenKey = t => !t ? "" : t.startsWith("i.") ? "i:" + t.slice(2) : "p:" + t;
  function resolveKey(key) {
    if (!key) return null;
    if (key.startsWith("p:")) { const p = byId(key.slice(2)); return p ? { product: p, leaveOn: null } : null; }
    if (key.startsWith("i:")) return decodeProduct(key.slice(2));
    return null;
  }

  // ---------- routing ----------
  function go(hash) {
    if (location.hash.slice(1) === hash) route(); else location.hash = hash;
  }
  function route() {
    const h = location.hash.slice(1);
    if (h.startsWith("p=") || h.startsWith("i=")) { openKey((h[0] === "p" ? "p:" : "i:") + h.slice(2)); showTab("check"); return; }
    if (h.startsWith("cmp=")) { const [a, b] = h.slice(4).split(","); cmp.a = tokenKey(a || ""); cmp.b = tokenKey(b || ""); showTab("compare"); return; }
    if (["compare", "browse", "skin"].includes(h)) { showTab(h); return; }
    showTab("check");
    if (!current) renderWelcome();
  }
  function showTab(t) {
    tab = t;
    document.body.dataset.view = t;
    document.querySelectorAll("#tabs button").forEach(b => { if (b.dataset.tab === t) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    document.querySelectorAll(".view").forEach(v => { v.hidden = v.dataset.view !== t; });
    if (t === "compare") renderCompare();
    if (t === "browse") renderBrowse();
    if (t === "skin") renderSkin();
  }
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    const t = b.dataset.tab;
    if (t === "check") go(current ? keyHash(current.key) : "check");
    else if (t === "compare") go("cmp=" + (cmp.a ? keyToken(cmp.a) : "") + "," + (cmp.b ? keyToken(cmp.b) : ""));
    else go(t);
  });

  // ---------- recent ----------
  function addRecent(key, name) {
    const list = store.get("body.recent", []).filter(r => r && r.key !== key);
    list.unshift({ key, name: name.slice(0, 60) });
    store.set("body.recent", list.slice(0, 8));
    renderRecent();
  }
  function renderRecent() {
    const list = store.get("body.recent", []).filter(r => r && typeof r.key === "string" && resolveKey(r.key));
    const row = $("recentRow");
    row.hidden = !list.length;
    row.innerHTML = '<span class="lbl">Recent</span>' + list.map(r => `<button type="button" class="chip" data-key="${esc(r.key)}">${esc(r.name)}</button>`).join("");
  }
  $("recentRow").addEventListener("click", e => { const b = e.target.closest("[data-key]"); if (b) go(keyHash(b.dataset.key)); });

  // ---------- result card ----------
  function openKey(key) {
    const r = resolveKey(key);
    if (!r) { current = null; $("out").innerHTML = `<div class="notice"><p>That link doesn't match a product. Search for it, or paste its ingredient list.</p></div>`; return; }
    const changed = !current || current.key !== key;
    current = { key, product: r.product };
    if (changed) { leaveOverride = r.leaveOn; addRecent(key, label(r.product)); $("lookup").innerHTML = ""; }
    renderCurrent();
    if (changed) window.scrollTo({ top: 0 });
  }
  function evalCurrent() {
    const p = Object.assign({}, current.product, leaveOverride === null ? {} : { leaveOn: leaveOverride });
    return { p, r: V.evaluate(p, profile) };
  }
  function renderCurrent() {
    if (!current) return;
    const { p, r } = evalCurrent();
    lastResult = r;
    $("out").innerHTML = cardHTML(p, r);
    document.body.classList.add("picked");
  }
  const signed = V.signed;
  const STRENGTH = { gentle: ["Gentle", "good"], moderate: ["Moderate", "warn"], harsh: ["Harsh", "bad"], soap: ["True soap", "warn"] };
  const INCOMPLETE = {
    truncated: "it looks cut off (“…”, “and other ingredients” or “see package”)",
    "actives-only": "it has Drug Facts active ingredients but no inactive list",
    "too-short": "it has two or fewer ingredients",
    empty: "no ingredients were found in it",
  };
  function sourceLine(p) {
    if (p.checked && p.sourceUrl) return `<b>✓ Label checked ${esc(monthYear(p.checked))}</b> · <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">${esc(p.source)} listing</a> · formulas change, compare with your bottle.`;
    if (p.source === "Open Beauty Facts") return `From <a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener">Open Beauty Facts</a> (community data) · compare with your bottle.`;
    return "From the ingredient list you pasted.";
  }
  function cardHTML(p, r) {
    return `<article class="card">
      <div class="result-head">
        ${p.brand ? `<div class="brand">${esc(p.brand)}</div>` : ""}
        <h2>${esc(p.name)}</h2>
        <div class="meta"><span class="cattag">${esc(p.category)}</span>
          <div class="segs" role="group" aria-label="How it's used">
            <button type="button" class="seg" data-leave="0" aria-pressed="${!r.leaveOn}">Rinse-off</button>
            <button type="button" class="seg" data-leave="1" aria-pressed="${r.leaveOn}">Leave-on</button>
          </div>
        </div>
        <p class="src">${sourceLine(p)}</p>
      </div>
      <div class="result">
        <div class="col">${flagsHTML(r)}${verdictHTML(r)}${whyHTML(r)}${notesHTML(r)}${betterHTML(p, r)}</div>
        <div class="col">${glanceHTML(r)}${insideHTML(r)}${actionsHTML()}</div>
      </div>
    </article>`;
  }
  function flagsHTML(r) {
    const hard = r.flags.filter(f => !f.may), may = r.flags.filter(f => f.may);
    let h = "";
    if (hard.length) h += `<div class="flagbox o-flags" role="alert"><p class="ft">⚑ On your avoid list</p>${hard.map(f => `<p><b>${esc(f.label)}:</b> ${esc(f.names.join(", "))}</p>`).join("")}</div>`;
    if (may.length) h += `<div class="flagbox may o-flags"><p class="ft">⚑ May be on your avoid list</p>${may.map(f => `<p><b>${esc(f.label)}:</b> ${esc(f.names.join(", "))}${f.key === "vegan" ? " (can be plant or animal derived)" : " (listed as “may contain”)"}</p>`).join("")}</div>`;
    return h;
  }
  function verdictHTML(r) {
    if (!r.complete) {
      const why = r.incomplete.map(k => INCOMPLETE[k]).filter(Boolean).join("; ");
      return `<div class="tag inc o-verdict"><span class="for">No verdict</span><div class="verdict">Incomplete list</div></div>
        <div class="incbox o-why"><p><b>This list isn't complete:</b> ${esc(why)}.</p><p>A verdict needs every ingredient. Copy the full list from the bottle or the brand's website and paste it here.</p>
        <div><button class="btn small accent" type="button" data-act="edit">Paste the full list</button></div></div>`;
    }
    const top = r.reasons.slice().sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts))[0];
    const hard = r.flags.filter(f => !f.may);
    const line = r.verdict === "skip" ? "On your avoid list: " + hard.map(f => f.label).join(", ") + "."
      : top ? top.text : "No rule added or took away points.";
    return `<div class="tag ${r.verdict} o-verdict"><span class="for">for ${esc(r.forLine)} · score ${signed(r.score)}</span><div class="verdict">${esc(r.label)}</div><p class="why">${esc(line)}</p></div>`;
  }
  function whyHTML(r) {
    if (!r.complete) return "";
    const rows = r.reasons.map(x => `<li class="${x.pts > 0 ? "pos" : "neg"}"><span class="pts">${signed(x.pts)}</span><span>${esc(x.text)}</span></li>`).join("");
    return `<section class="sec o-why"><h3>Why</h3>${rows ? `<ul class="reasons">${rows}</ul>` : `<p class="empty">No rule added or took away points.</p>`}
      <div class="total"><span>Score</span><span>${signed(r.score)}</span></div>
      <p class="fine" style="margin-top:6px">+2 or more is Get it, −1 to +1 is Fine, −2 or less is Think twice. Anything on your avoid list is Skip.</p></section>`;
  }
  function notesHTML(r) {
    if (!r.complete || !r.notes.length) return "";
    return `<section class="sec o-notes"><h3>Good to know</h3><ul class="notes">${r.notes.map(n => `<li>${esc(n.text)}</li>`).join("")}</ul></section>`;
  }
  function betterHTML(p, r) {
    if (!r.complete) return "";
    const alts = V.alternatives(Object.assign({}, p, { id: current && current.key.startsWith("p:") ? current.key.slice(2) : "custom" }), profile, PRODUCTS);
    if (!alts.length) return "";
    return `<section class="sec o-better"><h3>Better for your skin</h3><div class="swaps">${alts.map(a => `<button type="button" class="swap" data-go="p=${esc(a.product.id)}">
      <span class="sn">${esc(label(a.product))}</span><span><span class="vp ${a.result.verdict}">${esc(a.result.label)}</span> ${signed(a.result.score)}</span><span class="sd">${esc(a.reason)}</span></button>`).join("")}</div></section>`;
  }
  function tile(name, val, sub, cls, wide) {
    return `<div class="gtile${wide ? " wide" : ""}"><span class="gname">${esc(name)}</span><span class="gval ${cls || ""}">${esc(val)}</span>${sub ? `<span class="gsub">${esc(sub)}</span>` : ""}</div>`;
  }
  function glanceHTML(r) {
    if (!r.complete) return `<section class="sec o-glance"><h3>At a glance</h3><div class="gtiles">${tile("Ingredients listed", String(r.positions), "Incomplete, so not scored")}</div></section>`;
    const g = r.glance, t = [];
    if (g.filters) {
      const kind = g.filters.chemical.length && g.filters.mineral.length ? "Mineral + chemical" : g.filters.chemical.length ? "Chemical" : g.filters.mineral.length ? "Mineral only" : "None listed";
      t.push(tile("UV filters", kind, [].concat(g.filters.mineral, g.filters.chemical).join(", "), kind === "Mineral only" ? "good" : "", true));
    }
    if (r.wash) {
      const s = g.mainCleanser ? STRENGTH[g.mainCleanser.strength] : null;
      t.push(tile("Main cleanser", s ? s[0] : "No detergent", g.mainCleanser ? g.mainCleanser.name : "A non-foaming, lotion-style cleanser", s ? s[1] : "good", true));
    }
    t.push(tile("Scent", g.scent, g.allergens ? g.allergens + " EU fragrance allergen" + (g.allergens === 1 ? "" : "s") : "", g.scent === "Fragrance-free" ? "good" : "warn"));
    t.push(tile("Moisturizers", String(g.moisturizers.length), g.moisturizers.slice(0, 3).join(", ") + (g.moisturizers.length > 3 ? "…" : ""), g.moisturizers.length ? "good" : ""));
    const bad = g.preservatives.filter(x => x.kind === "mit" || x.kind === "formaldehyde");
    t.push(tile("Preservatives", !g.preservatives.length ? "None listed" : bad.length ? (bad.some(x => x.kind === "mit") ? "MIT/MCI" : "Formaldehyde releaser") : g.preservatives.some(x => x.kind === "paraben") ? "Parabens" : "Common ones",
      g.preservatives.map(x => x.name).join(", "), bad.length ? "bad" : ""));
    t.push(tile("Dyes", g.dyes.length ? String(g.dyes.length) : "None", g.dyes.join(", "), g.dyes.length ? "warn" : "good"));
    t.push(tile("Ingredients", String(g.count), r.unknown.length ? r.unknown.length + " not in the knowledge base" : ""));
    return `<section class="sec o-glance"><h3>At a glance</h3><div class="gtiles">${t.join("")}</div></section>`;
  }
  function insideHTML(r) {
    const chips = r.items.map(i => `<button type="button" class="ich ${i.cls}${i.may ? " may" : ""}" data-idx="${i.idx}" aria-haspopup="dialog"><span class="n">${i.active ? "A" : i.may ? "±" : i.pos}</span>${esc(i.name)}</button>`).join("");
    return `<section class="sec o-inside"><h3>What's inside</h3><div class="ichips">${chips}</div>
      <div class="legend"><span class="helps"><i></i>Helps skin</span><span class="watch"><i></i>Watch</span><span class="problem"><i></i>Common problem</span><span><i></i>Neutral</span><span class="unknown"><i></i>Not in our list</span></div>
      <p class="fine" style="margin-top:6px">Numbers are label order; A is a Drug Facts active. Tap an ingredient to see what it does.</p></section>`;
  }
  function actionsHTML() {
    return `<div class="actions o-actions"><button class="btn small ghost" type="button" data-act="compare">Compare with…</button><button class="btn small ghost" type="button" data-act="share">Share link</button><button class="btn small ghost" type="button" data-act="edit">Edit ingredients</button></div>`;
  }

  $("out").addEventListener("click", e => {
    const t = e.target.closest("button, a"); if (!t) return;
    if (t.dataset.leave != null && current) {
      leaveOverride = t.dataset.leave === "1";
      if (current.key.startsWith("i:")) {
        const key = "i:" + encodeProduct(current.product, leaveOverride);
        current.key = key; history.replaceState(null, "", "#" + keyHash(key));
      }
      renderCurrent(); return;
    }
    if (t.dataset.idx != null) { openIngredient(+t.dataset.idx); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.try) { go("p=" + t.dataset.try); return; }
    const act = t.dataset.act;
    if (act === "edit" && current) openPaste({ name: label(current.product), category: current.product.category, text: current.product.ingredients, title: "Edit ingredients" });
    if (act === "share" && current) share();
    if (act === "compare" && current) { cmp.a = current.key; cmp.b = ""; go("cmp=" + keyToken(cmp.a) + ","); setTimeout(() => $("cmpB").focus(), 0); }
    if (act === "paste") openPaste({});
  });

  async function share() {
    const url = location.href.split("#")[0] + "#" + keyHash(current.key);
    const title = label(current.product) + " — Should I Buy It? Body Care";
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { prompt("Copy this link:", url); }
  }

  // ---------- ingredient dialog ----------
  const SUB = { gentle: "gentle", moderate: "moderate", harsh: "harsh", humectant: "humectant", emollient: "emollient", barrier: "barrier repair", fragrance: "fragrance", allergen: "EU fragrance allergen",
    "essential-oil": "essential oil", paraben: "paraben", isothiazolinone: "isothiazolinone", formaldehyde: "formaldehyde releaser", mineral: "mineral", chemical: "chemical" };
  function openIngredient(idx) {
    const r = lastResult; if (!r) return;
    const i = r.items[idx]; if (!i) return;
    const e = i.entry;
    const sub = e ? e.tags.map(t => SUB[t]).filter(Boolean)[0] : "";
    const groupName = !e ? "Not in our list yet" : (i.group === "neutral" && e.group === "uv-filter") ? "Mineral pigment" : (Ing.GROUPS[i.group || e.group] + (sub ? " · " + sub : ""));
    $("dlgGroup").textContent = groupName;
    $("dlgTitle").textContent = i.name;
    $("dlgNote").textContent = !e ? "This ingredient isn't in the knowledge base yet, so it wasn't scored. Nothing is guessed about it."
      : (i.group === "neutral" && e.group === "uv-filter") ? "A white mineral. Outside a sunscreen it's used as a pigment, not a UV filter." : e.note;
    const more = [];
    more.push(i.active ? "Drug Facts active ingredient" + (i.pct != null ? " (" + i.pct + "%)" : "") + "." : i.may ? "Listed under “may contain” (shade-dependent); not scored." : "Number " + i.pos + " on the label" + (i.alt ? " (one of two alternatives)" : i.sub ? " (part of a group)" : "") + ".");
    if (r.complete) {
      const flags = r.flags.filter(f => f.items.includes(idx));
      if (flags.length) more.push("On your avoid list: " + flags.map(f => f.label).join(", ") + (flags.every(f => f.may) ? " (may)" : "") + ".");
      r.reasons.filter(x => x.items.includes(idx)).forEach(x => more.push(signed(x.pts) + ": " + x.text));
      r.notes.filter(x => x.items.includes(idx)).forEach(x => more.push(x.text));
    }
    $("dlgMore").innerHTML = `<ul>${more.map(m => `<li>${esc(m)}</li>`).join("")}</ul>`;
    const d = $("ingDialog");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  $("dlgClose").addEventListener("click", () => { const d = $("ingDialog"); if (d.close) d.close(); else d.removeAttribute("open"); });
  $("ingDialog").addEventListener("click", e => { if (e.target === $("ingDialog")) $("ingDialog").close(); });

  // ---------- welcome ----------
  function renderWelcome() {
    document.body.classList.remove("picked");
    const tries = ["head-shoulders-classic-clean", "dove-beauty-bar", "cerave-moisturizing-cream", "eltamd-uv-clear-spf46", "johnsons-head-to-toe", "native-deodorant-citrus-musk"].map(byId).filter(Boolean);
    $("out").innerHTML = `<section class="welcome" aria-labelledby="wH">
      <h2 id="wH">How it works</h2>
      <ol><li><b>Search, scan or paste</b> a product's ingredient list.</li><li><b>Get a verdict for your skin:</b> Get it, Fine, Think twice, or Skip if it has something you avoid.</li><li><b>See exactly why:</b> every point comes from a fixed rule you can read.</li></ol>
      <div class="chiprow"><span class="lbl">Try</span>${tries.map(p => `<button type="button" class="chip" data-try="${esc(p.id)}">${esc(label(p))}</button>`).join("")}</div>
      <p class="fine">Set up <a href="#skin">My skin</a> first so verdicts fit you. Nothing you enter leaves your device, except searches sent to Open Beauty Facts.</p>
    </section>`;
  }

  // ---------- search ----------
  function searchBuiltins(q) {
    const toks = Ing.key(q).split(" ").filter(Boolean);
    if (!toks.length) return [];
    return PRODUCTS.map(p => {
      const name = Ing.key(p.brand + " " + p.name);
      const hay = Ing.key([p.brand, p.name, p.category, (p.aliases || []).join(" ")].join(" ")).replace(/'/g, "");
      const ok = toks.every(t => hay.includes(t.replace(/'/g, "")));
      return { p, s: ok ? (name.startsWith(toks[0]) ? 3 : name.includes(toks[0]) ? 2 : 1) : 0 };
    }).filter(x => x.s).sort((a, b) => b.s - a.s || label(a.p).localeCompare(label(b.p))).map(x => x.p);
  }
  let sel = -1, sugg = [];
  function renderSuggest() {
    const q = $("q").value.trim();
    const box = $("suggest");
    if (q.length < 2) { box.hidden = true; $("q").setAttribute("aria-expanded", "false"); return; }
    const hits = searchBuiltins(q).slice(0, 7);
    sugg = hits.map(p => ({ kind: "p", p })).concat([{ kind: "obf" }, { kind: "paste" }]);
    sel = -1;
    box.innerHTML = sugg.map((s, i) => s.kind === "p"
      ? `<li role="option" id="sg${i}" data-i="${i}" aria-selected="false"><span>${esc(label(s.p))}</span><small>${esc(s.p.category)}</small></li>`
      : `<li role="option" id="sg${i}" data-i="${i}" class="action" aria-selected="false">${s.kind === "obf" ? "Search Open Beauty Facts for “" + esc(q) + "”" : "Paste an ingredient list instead"}</li>`).join("");
    box.hidden = false; $("q").setAttribute("aria-expanded", "true");
  }
  function pickSuggest(i) {
    const s = sugg[i]; if (!s) return;
    $("suggest").hidden = true; $("q").setAttribute("aria-expanded", "false");
    if (s.kind === "p") { $("q").value = ""; go("p=" + s.p.id); }
    else if (s.kind === "obf") doSearch($("q").value.trim(), true);
    else openPaste({ name: $("q").value.trim() });
  }
  $("q").addEventListener("input", renderSuggest);
  $("q").addEventListener("keydown", e => {
    const box = $("suggest"); if (box.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + sugg.length) % sugg.length;
      box.querySelectorAll("li").forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
      $("q").setAttribute("aria-activedescendant", "sg" + sel);
    } else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); pickSuggest(sel); }
    else if (e.key === "Escape") { box.hidden = true; $("q").setAttribute("aria-expanded", "false"); }
  });
  $("suggest").addEventListener("mousedown", e => { const li = e.target.closest("li[data-i]"); if (li) { e.preventDefault(); pickSuggest(+li.dataset.i); } });
  document.addEventListener("click", e => { if (!e.target.closest(".search")) $("suggest").hidden = true; });
  $("form").addEventListener("submit", e => { e.preventDefault(); const q = $("q").value.trim(); if (q) doSearch(q, false); });

  let searchSeq = 0;
  async function doSearch(q, obfOnly) {
    $("suggest").hidden = true;
    const local = obfOnly ? [] : searchBuiltins(q);
    const id = ++searchSeq;
    $("lookup").innerHTML = lookupHTML(q, local, null);
    const res = await Src.search(q);
    if (id !== searchSeq) return;
    lastObf = res.products || [];
    $("lookup").innerHTML = lookupHTML(q, local, res);
    if (!local.length && (res.status === "error" || !lastObf.length)) openPaste({ name: q, msg: (res.status === "error" ? res.message + " " : "No match in Open Beauty Facts (its US coverage is thin). ") + "Paste the ingredient list from the bottle or the brand's site." });
  }
  let lastObf = [];
  function lookupHTML(q, local, res) {
    const loc = local.length ? `<h3>Built-in, label checked</h3><ul class="results">${local.map(p => `<li><button type="button" data-go="p=${esc(p.id)}"><span>${esc(label(p))}</span><small>${esc(p.category)}</small></button></li>`).join("")}</ul>` : "";
    let obf;
    if (!res) obf = `<p class="thinking"><span class="dot"></span>Searching Open Beauty Facts…</p>`;
    else if (res.status === "error") obf = `<p class="muted">${esc(res.message)}</p>`;
    else if (!res.products.length) obf = `<p class="muted">No match in Open Beauty Facts.</p>`;
    else obf = `<ul class="results">${res.products.map((p, i) => `<li><button type="button" data-obf="${i}"><span>${esc(label(p))}</span><small>${p.ingredients ? esc(p.category) : "no ingredient list"}</small></button></li>`).join("")}</ul>`;
    return `<section class="panel" aria-label="Search results"><div class="row" style="justify-content:space-between"><h2>Results for “${esc(q)}”</h2><button class="linkbtn" type="button" data-close>Close</button></div>
      ${loc}<h3>Open Beauty Facts <span class="muted" style="font-weight:400">(community data)</span></h3>${obf}
      <p class="muted" style="margin:0">Not here? <button class="linkbtn" type="button" data-act="paste">Paste the ingredient list</button>.</p></section>`;
  }
  $("lookup").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.close != null) { $("lookup").innerHTML = ""; return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.act === "paste") { openPaste({ name: $("q").value.trim() }); return; }
    if (t.dataset.obf != null) openObf(lastObf[+t.dataset.obf]);
  });
  function openObf(p) {
    if (!p) return;
    if (p.ingredients) go("i=" + encodeProduct(p, null));
    else openPaste({ name: label(p), category: p.category, msg: "Open Beauty Facts has “" + label(p) + "” but no ingredient list. Copy it from the bottle or the brand's site and paste it here." });
  }

  // ---------- barcode ----------
  async function lookupBarcode(code) {
    const clean = String(code || "").replace(/\D/g, "");
    $("lookup").innerHTML = `<section class="panel"><p class="thinking" style="margin:0"><span class="dot"></span>Looking up barcode ${esc(clean)}…</p></section>`;
    const res = await Src.byBarcode(clean);
    if (res.status === "found") { $("lookup").innerHTML = ""; go("i=" + encodeProduct(res.product, null)); return; }
    $("lookup").innerHTML = "";
    if (res.status === "no-ingredients") openPaste({ name: label(res.product), category: res.product.category, msg: "Open Beauty Facts has this product but no ingredient list. Paste it from the bottle or the brand's site." });
    else if (res.status === "not-found") openPaste({ msg: "Barcode " + clean + " isn't in Open Beauty Facts yet (its US coverage is thin). Paste the ingredient list from the bottle." });
    else openPaste({ msg: (res.message || "The lookup failed.") + " Paste the ingredient list from the bottle instead." });
  }
  const camera = W.SelfCheckCamera && W.SelfCheckCamera.create({
    ui: { panel: $("scan"), message: $("scanMsg"), button: $("scanBtn"), code: $("code"), reader: "reader" },
    onCode: code => lookupBarcode(code),
    readyText: () => "Point your camera at the barcode and move closer until it fills the box.",
  });
  $("scanBtn").addEventListener("click", () => { closePaste(); if (camera) camera.open(); else $("scan").hidden = false; });
  $("scanClose").addEventListener("click", () => { if (camera) camera.close(); else $("scan").hidden = true; });
  $("codeForm").addEventListener("submit", e => { e.preventDefault(); const c = $("code").value; if (camera) camera.close(); else $("scan").hidden = true; lookupBarcode(c); });

  // ---------- paste ----------
  $("pCat").innerHTML = CAT_ORDER.map(c => `<option>${esc(c)}</option>`).join("");
  function openPaste(o) {
    $("pasteBox").hidden = false; $("pasteToggle").setAttribute("aria-expanded", "true");
    $("pasteTitle").textContent = o.title || "Paste an ingredient list";
    $("pasteMsg").textContent = o.msg || "Copy the full list from the bottle or the brand's site. Drug Facts lists (Active and Inactive ingredients) work too.";
    $("pasteMsg").className = o.msg ? "notice warn" : "muted";
    if (o.name != null) $("pName").value = o.name;
    if (o.category) $("pCat").value = o.category;
    if (o.text != null) $("pText").value = o.text;
    if (tab !== "check") showTab("check");
    $("pasteBox").scrollIntoView({ block: "nearest" });
    $("pText").focus();
  }
  function closePaste() { $("pasteBox").hidden = true; $("pasteToggle").setAttribute("aria-expanded", "false"); }
  $("pasteToggle").addEventListener("click", () => { if ($("pasteBox").hidden) openPaste({}); else closePaste(); });
  $("pasteCancel").addEventListener("click", closePaste);
  $("pasteBox").addEventListener("submit", e => {
    e.preventDefault();
    const text = $("pText").value.trim();
    if (!text) { $("pasteMsg").textContent = "Paste the ingredient list first."; $("pasteMsg").className = "notice warn"; $("pText").focus(); return; }
    const p = { name: $("pName").value.trim() || "Pasted list", brand: "", category: $("pCat").value, ingredients: text, source: "Pasted" };
    closePaste();
    go("i=" + encodeProduct(p, null));
  });

  // ---------- compare ----------
  function options(selected) {
    const extra = [];
    for (const k of [cmp.a, cmp.b, current && current.key]) {
      if (k && k.startsWith("i:") && !extra.includes(k)) extra.push(k);
    }
    const ex = extra.map(k => { const r = resolveKey(k); return r ? `<option value="${esc(k)}"${k === selected ? " selected" : ""}>${esc(label(r.product))} (yours)</option>` : ""; }).join("");
    const groups = CAT_ORDER.map(c => {
      const ps = PRODUCTS.filter(p => p.category === c);
      return ps.length ? `<optgroup label="${esc(c)}">${ps.map(p => `<option value="p:${esc(p.id)}"${"p:" + p.id === selected ? " selected" : ""}>${esc(label(p))}</option>`).join("")}</optgroup>` : "";
    }).join("");
    return `<option value="">Choose a product…</option>${ex ? `<optgroup label="Your products">${ex}</optgroup>` : ""}${groups}`;
  }
  function renderCompare() {
    $("cmpA").innerHTML = options(cmp.a);
    $("cmpB").innerHTML = options(cmp.b);
    const ra = resolveKey(cmp.a), rb = resolveKey(cmp.b);
    if (!ra || !rb) { $("cmpOut").innerHTML = `<p class="muted" style="margin:0">Pick two products to compare. Tip: open a product and tap “Compare with…”.</p>`; return; }
    const pa = Object.assign({}, ra.product, ra.leaveOn === null ? {} : { leaveOn: ra.leaveOn }), pb = Object.assign({}, rb.product, rb.leaveOn === null ? {} : { leaveOn: rb.leaveOn });
    const c = V.compare(pa, pb, profile);
    $("cmpOut").innerHTML = `<p class="cmpans">${esc(c.answer)}</p>
      <div class="ctable-wrap"><table class="ctable"><thead><tr><th scope="col"><span class="vh">Row</span></th><th scope="col">${esc(label(ra.product))}</th><th scope="col">${esc(label(rb.product))}</th></tr></thead>
      <tbody>${c.rows.map(([k, a, b, w]) => `<tr><th scope="row">${esc(k)}</th><td class="${w === "a" ? "win" : ""}">${esc(a)}</td><td class="${w === "b" ? "win" : ""}">${esc(b)}</td></tr>`).join("")}</tbody></table></div>
      <p class="fine">Scored for ${esc(V.describeProfile(profile))}. <button class="linkbtn" type="button" data-open="${esc(cmp.a)}">Open the first</button> · <button class="linkbtn" type="button" data-open="${esc(cmp.b)}">Open the second</button></p>`;
  }
  function cmpChange() {
    cmp.a = $("cmpA").value; cmp.b = $("cmpB").value;
    history.replaceState(null, "", "#cmp=" + (cmp.a ? keyToken(cmp.a) : "") + "," + (cmp.b ? keyToken(cmp.b) : ""));
    renderCompare();
  }
  $("cmpA").addEventListener("change", cmpChange);
  $("cmpB").addEventListener("change", cmpChange);
  $("cmpOut").addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b && b.dataset.open) go(keyHash(b.dataset.open)); });

  // ---------- browse ----------
  function renderBrowse() {
    const counts = {};
    PRODUCTS.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    const cats = ["All"].concat(CAT_ORDER.filter(c => counts[c]));
    $("bcats").innerHTML = cats.map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="${browse.cat === c}">${esc(c)} <span class="muted">${c === "All" ? PRODUCTS.length : counts[c]}</span></button>`).join("");
    $("bsort").innerHTML = '<span class="lbl">Sort</span>' + [["best", "Best for me"], ["worst", "Worst"], ["az", "A–Z"]].map(([k, l]) => `<button type="button" class="chip" data-sort="${k}" aria-pressed="${browse.sort === k}">${l}</button>`).join("");
    const rows = PRODUCTS.filter(p => browse.cat === "All" || p.category === browse.cat).map(p => ({ p, r: V.evaluate(p, profile) }));
    const rank = r => (r.verdict === "skip" ? -1000 : 0) + r.score;
    rows.sort((a, b) => browse.sort === "az" ? label(a.p).localeCompare(label(b.p))
      : (browse.sort === "best" ? rank(b.r) - rank(a.r) : rank(a.r) - rank(b.r)) || label(a.p).localeCompare(label(b.p)));
    $("browseCount").textContent = rows.length + " product" + (rows.length === 1 ? "" : "s");
    $("blist").innerHTML = rows.map(({ p, r }) => `<button type="button" class="bitem" data-go="p=${esc(p.id)}">
      <span><span class="bn">${esc(label(p))}</span><br><span class="bc">${esc(p.category)}</span> · <span class="checked" title="Label checked ${esc(monthYear(p.checked))} at ${esc(p.source)}">✓ label checked</span></span>
      <span class="bright"><span class="vp ${r.verdict}">${esc(r.label)}</span><span class="score">${signed(r.score)}</span></span></button>`).join("");
  }
  $("browseView").addEventListener("click", e => {
    const t = e.target.closest("button"); if (!t) return;
    if (t.dataset.cat) { browse.cat = t.dataset.cat; renderBrowse(); }
    else if (t.dataset.sort) { browse.sort = t.dataset.sort; renderBrowse(); }
    else if (t.dataset.go) go(t.dataset.go);
  });

  // ---------- my skin ----------
  $("avoidBoxes").innerHTML = V.AVOID.map(a => `<label class="tog"><input type="checkbox" data-avoid="${esc(a.key)}"><span class="tc" aria-hidden="true">✓</span>${esc(a.label)}</label>`).join("");
  function renderSkin() {
    document.querySelectorAll("#skinType .seg").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.skin === profile.skin)));
    $("pSens").checked = profile.sensitive; $("pAcne").checked = profile.acne; $("pDand").checked = profile.dandruff;
    document.querySelectorAll("[data-avoid]").forEach(b => { b.checked = profile.avoid.includes(b.dataset.avoid); });
    if (document.activeElement !== $("pCustom")) $("pCustom").value = profile.custom;
    renderLive();
  }
  function renderLive() {
    if (!current) { $("live").innerHTML = `<span>Open a product on Check, then come back: its verdict updates here as you change these.</span>`; return; }
    const { r } = evalCurrent();
    $("live").innerHTML = `<span>Now checking <b>${esc(label(current.product))}</b>:</span>` + (r.complete
      ? `<span class="vp ${r.verdict}">${esc(r.label)}</span><span>score ${signed(r.score)}</span>`
      : `<span class="vp inc">Incomplete list</span>`) + `<button class="linkbtn" type="button" id="liveOpen">See why</button>`;
  }
  $("live").addEventListener("click", e => { if (e.target.id === "liveOpen" && current) go(keyHash(current.key)); });
  function saveProfile(next) {
    profile = V.normalizeProfile(next);
    store.set("body.profile", profile);
    renderSkin();
    if (current) renderCurrent();
  }
  $("skinType").addEventListener("click", e => { const b = e.target.closest("[data-skin]"); if (b) saveProfile(Object.assign({}, profile, { skin: b.dataset.skin })); });
  $("pSens").addEventListener("change", e => saveProfile(Object.assign({}, profile, { sensitive: e.target.checked })));
  $("pAcne").addEventListener("change", e => saveProfile(Object.assign({}, profile, { acne: e.target.checked })));
  $("pDand").addEventListener("change", e => saveProfile(Object.assign({}, profile, { dandruff: e.target.checked })));
  $("avoidBoxes").addEventListener("change", () => saveProfile(Object.assign({}, profile, { avoid: [...document.querySelectorAll("[data-avoid]:checked")].map(b => b.dataset.avoid) })));
  $("pCustom").addEventListener("input", e => saveProfile(Object.assign({}, profile, { custom: e.target.value })));
  $("pReset").addEventListener("click", () => { $("pCustom").value = ""; saveProfile({}); toast("Reset to defaults"); });

  // ---------- misc ----------
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.append(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }
  $("count").textContent = PRODUCTS.length + " products with label-checked ingredient lists, plus Open Beauty Facts.";
  renderRecent();
  route();
  window.addEventListener("hashchange", route);
  if (CFG.mode === "pages" && "serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
