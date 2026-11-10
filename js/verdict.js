// Verdict rules for Should I Buy It? Body Care. Fixed code rules, no model: the same list and profile always give
// the same verdict, and every point shown comes from one rule below (its `rule` key).
//
// BodyVerdict.evaluate(product, profile) → result
//   product: { name, brand?, category, ingredients, leaveOn?, family? }
//   result: { complete, incomplete, verdict ("get"|"fine"|"think"|"skip"|null), label, score, forLine,
//             reasons: [{ rule, pts, text, items }], notes: [{ rule, text }], flags: [{ key, label, items, may }],
//             glance, items (parsed items with .cls and .idx), leaveOn, family, kind, wash, sun }
// BodyVerdict.alternatives(product, profile, catalog) → up to 3 better built-ins of the same kind
// BodyVerdict.compare(a, b, profile) → { answer, winner, rows }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ingredients.js"));
  else root.BodyVerdict = factory(root.BodyIngredients);
})(/** @type {any} */ (typeof self !== "undefined" ? self : this), function (Ing) {
  const CATEGORIES = {
    "Body wash": { kind: "body-cleanser", family: "body", leaveOn: false, wash: true },
    "Bar soap": { kind: "body-cleanser", family: "body", leaveOn: false, wash: true, bar: true },
    "Hand soap": { kind: "hand-soap", family: "body", leaveOn: false, wash: true },
    "Face wash": { kind: "face-wash", family: "face", leaveOn: false, wash: true },
    "Shampoo": { kind: "shampoo", family: "hair", leaveOn: false, wash: true },
    "Conditioner": { kind: "conditioner", family: "conditioner", leaveOn: false, wash: false },
    "Face moisturizer": { kind: "face-moisturizer", family: "face", leaveOn: true },
    "Sunscreen": { kind: "sunscreen", family: "sun", leaveOn: true },
    "Lotion": { kind: "body-moisturizer", family: "body", leaveOn: true },
    "Cream": { kind: "body-moisturizer", family: "body", leaveOn: true },
    "Ointment": { kind: "body-moisturizer", family: "body", leaveOn: true },
    "Deodorant": { kind: "deodorant", family: "deodorant", leaveOn: true },
    "Baby wash": { kind: "baby-wash", family: "baby", leaveOn: false, wash: true },
    "Baby lotion": { kind: "baby-lotion", family: "baby", leaveOn: true },
  };
  const LABELS = { get: "Get it", fine: "Fine", think: "Think twice", skip: "Skip" };
  const DEFAULT_PROFILE = { skin: "normal", sensitive: false, acne: false, dandruff: false, avoid: [], custom: "" };

  const has = (e, tag) => !!e && e.tags.indexOf(tag) >= 0;
  const AVOID = [
    { key: "fragrance", label: "Fragrance", test: e => e.group === "scent" && (has(e, "fragrance") || has(e, "allergen")) },
    { key: "essential-oils", label: "Essential oils", test: e => has(e, "essential-oil") },
    { key: "sulfates", label: "Sulfates", test: e => has(e, "sulfate") },
    { key: "parabens", label: "Parabens", test: e => has(e, "paraben") },
    { key: "formaldehyde", label: "Formaldehyde releasers", test: e => has(e, "formaldehyde") },
    { key: "mit", label: "MIT / MCI", test: e => has(e, "isothiazolinone") },
    { key: "dyes", label: "Dyes", test: e => e.group === "dye" },
    { key: "vegan", label: "Vegan (no animal ingredients)", test: e => has(e, "animal") ? "yes" : has(e, "animal-may") ? "may" : false },
    { key: "aluminum", label: "Aluminum", test: e => e.group === "aluminum" },
    { key: "drying-alcohol", label: "Drying alcohol", test: e => e.group === "drying-alcohol" },
    { key: "talc", label: "Talc", test: e => has(e, "talc") },
    { key: "oxybenzone", label: "Oxybenzone", test: e => has(e, "oxybenzone") },
  ];

  function normalizeProfile(p) {
    const o = Object.assign({}, DEFAULT_PROFILE, p || {});
    o.skin = ["normal", "dry", "oily"].indexOf(o.skin) >= 0 ? o.skin : "normal";
    o.avoid = Array.isArray(o.avoid) ? o.avoid.filter(k => AVOID.some(a => a.key === k)) : [];
    o.custom = typeof o.custom === "string" ? o.custom : "";
    o.sensitive = !!o.sensitive; o.acne = !!o.acne; o.dandruff = !!o.dandruff;
    return o;
  }
  function customWords(p) { return p.custom.split(",").map(w => Ing.key(w)).filter(w => w.length >= 2); }
  function describeProfile(p) {
    p = normalizeProfile(p);
    const parts = [p.skin];
    if (p.sensitive) parts.push("sensitive");
    if (p.acne) parts.push("acne-prone");
    if (p.dandruff) parts.push("dandruff");
    return parts.join(", ") + " skin";
  }
  const signed = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
  const uniq = arr => arr.filter((x, i) => arr.indexOf(x) === i);
  const names = items => uniq(items.map(i => i.name));
  const list = items => { const n = names(items); return n.length <= 3 ? n.join(", ") : n.slice(0, 3).join(", ") + " +" + (n.length - 3) + " more"; };
  const distinctPos = items => uniq(items.map(i => i.pos)).length;
  const inTop = (i, n) => i.rank !== null && i.rank <= n; // Drug Facts actives have rank 0: always "top"
  const PLANT_OIL = /\b(oil|tallow|lard|butter)\b/i;

  function categoryInfo(cat) { return CATEGORIES[cat] || CATEGORIES["Body wash"]; }

  function evaluate(product, profileIn) {
    const profile = normalizeProfile(profileIn);
    const cat = categoryInfo(product.category);
    const leaveOn = typeof product.leaveOn === "boolean" ? product.leaveOn : cat.leaveOn;
    const family = product.family || cat.family;
    const label = ((product.brand || "") + " " + (product.name || "")).trim();
    const baby = family === "baby" || /\b(baby|babies|newborn|infant)\b/i.test(label);
    const parsed = Ing.parse(product.ingredients);
    const items = parsed.items.map((it, idx) => Object.assign({}, it, { idx }));
    const base = {
      complete: !parsed.incomplete.length, incomplete: parsed.incomplete, leaveOn, family, kind: cat.kind, wash: !!cat.wash, baby,
      forLine: describeProfile(profile), positions: parsed.positions, unknown: parsed.unknown, items,
    };
    if (!base.complete) {
      items.forEach(i => { i.cls = i.entry ? "neutral" : "unknown"; });
      return Object.assign(base, { verdict: null, label: "Incomplete list", score: null, reasons: [], notes: [], flags: [], glance: null, sun: false });
    }

    const S = items.filter(i => i.entry && !i.may); // scored items
    const dry = profile.skin === "dry", sens = profile.sensitive, drySens = dry || sens;
    const sun = family === "sun" || S.some(i => i.active && i.entry.group === "uv-filter") || S.some(i => has(i.entry, "chemical"));
    const group = i => (i.entry.group === "uv-filter" && !sun) ? "neutral" : i.entry.group;
    const reasons = [], notes = [];
    const add = (rule, pts, text, its) => reasons.push({ rule, pts, text, items: (its || []).map(i => i.idx) });
    const note = (rule, text, its) => notes.push({ rule, text, items: (its || []).map(i => i.idx) });

    // Castile label: a plant oil and lye in the top 4 means the oils were made into soap.
    const top4 = S.filter(i => inTop(i, 4) && !i.active);
    const lye = top4.find(i => /^(sodium|potassium) hydroxide$/i.test(i.entry.name));
    const castileOil = top4.find(i => group(i) === "moisturizer" && PLANT_OIL.test(i.name) && !/mineral/i.test(i.name));
    const castile = !!(lye && castileOil);
    const saponified = new Set(castile ? S.filter(i => group(i) === "moisturizer" && /\b(oil|tallow|lard)\b/i.test(i.name) && !/mineral/i.test(i.name)).map(i => i.idx) : []);
    const moist = S.filter(i => group(i) === "moisturizer" && !saponified.has(i.idx));

    // ---- Cleansers (washes) ----
    let main = null;
    if (cat.wash) {
      const first = S.find(i => group(i) === "cleanser" || group(i) === "soap");
      if (castile && (!first || castileOil.pos <= first.pos)) main = { name: "Saponified " + castileOil.name.replace(/^(organic|certified organic)\s+/i, "") + " (castile soap)", strength: "soap", items: [castileOil, lye] };
      else if (first) main = { name: first.name, strength: group(first) === "soap" ? "soap" : has(first.entry, "harsh") ? "harsh" : has(first.entry, "moderate") ? "moderate" : "gentle", items: [first] };
      if (main && main.strength === "gentle") {
        add("main-gentle", 1, "Main cleanser is gentle: " + main.name + ".", main.items);
        if (cat.bar && S.some(i => group(i) === "soap")) note("syndet-bar", "A syndet bar: its first cleanser is a mild synthetic, so it's scored as mild, not as soap.", main.items);
      } else if (main && (main.strength === "moderate" || main.strength === "soap")) {
        const what = main.strength === "soap" ? "Main cleanser is true soap (" + main.name + "): alkaline, pH 9–10" : "Main cleanser is a moderate detergent (" + main.name + ")";
        if (drySens) add("main-" + main.strength, -1, what + ", which can leave " + (dry ? "dry" : "sensitive") + " skin tight.", main.items);
        else note("main-" + main.strength, what + ". Fine for normal or oily skin; it would lose a point for dry or sensitive skin.", main.items);
      }
    }
    const harsh = S.filter(i => group(i) === "cleanser" && has(i.entry, "harsh") && inTop(i, 6));
    if (harsh.length) add("harsh-top6", drySens ? -2 : -1, "Harsh cleanser high on the list: " + list(harsh) + (drySens ? " (strips oils; counts double for dry or sensitive skin)." : " (strips skin oils)."), harsh);

    // ---- Moisture ----
    if (cat.wash) {
      const m10 = moist.filter(i => inTop(i, 10));
      if (distinctPos(m10) >= 2) add("wash-moisturizers", 1, "Moisturizers in the top 10: " + list(m10) + ".", m10);
    }
    if (family === "conditioner") {
      const cond = S.filter(i => group(i) === "conditioning" || has(i.entry, "conditioning"));
      if (distinctPos(cond) >= 2) add("conditioning", 1, "Conditioning agents: " + list(cond) + ".", cond);
    }
    if (leaveOn) {
      const m10 = moist.filter(i => inTop(i, 10));
      const early = moist.filter(i => inTop(i, 2));
      if (early.length || distinctPos(m10) >= 3) add("leave-on-moisture", 1, "Moisturizing: " + list(early.length ? early : m10) + (early.length ? " right at the top." : " in the top 10."), early.length ? early : m10);
    }
    const barrier = S.filter(i => has(i.entry, "barrier"));
    if (barrier.length && drySens) add("barrier", 1, "Barrier-repair ingredients for " + (dry ? "dry" : "sensitive") + " skin: " + list(barrier) + ".", barrier);
    const occl = S.filter(i => has(i.entry, "occlusive") && inTop(i, 5) && !saponified.has(i.idx));
    if (leaveOn && dry && occl.length) add("occlusive", 1, "Seals moisture in for dry skin: " + list(occl) + " in the top 5.", occl);

    // ---- Scent ----
    const eo = S.filter(i => has(i.entry, "essential-oil"));
    const allergens = S.filter(i => has(i.entry, "allergen"));
    const frag = S.filter(i => has(i.entry, "fragrance")).concat(eo.length ? [] : allergens);
    const scented = frag.length > 0 || eo.length > 0;
    if (leaveOn && !scented) add("leave-on-unscented", 1, "No fragrance or essential oils in a leave-on product.", []);
    let fragPts = 0;
    if (frag.length) {
      if (sens) fragPts = -2; else if (leaveOn || baby) fragPts = -1;
      const word = frag.some(i => /^(fragrance|parfum|perfume|aroma)\b/i.test(i.name)); // allergens get their own note
      const what = word ? "Fragrance" : "Fragrance chemicals (" + list(frag) + ")";
      if (fragPts) add("fragrance", fragPts, what + (sens ? ": the most common cause of cosmetic skin allergy." : baby ? " in a baby product." : " in a leave-on product."), frag);
      else note("fragrance", what + " in a rinse-off: a low concern for normal skin. It would cost points if you tick sensitive.", frag);
    }
    if (eo.length) {
      if (sens) {
        const pts = Math.max(-1, -2 - fragPts);
        if (pts) add("essential-oils", pts, "Essential oils (" + list(eo) + ") can irritate sensitive skin.", eo);
        else note("essential-oils", "Essential oils too (" + list(eo) + "); fragrance and essential oils together are capped at −2.", eo);
      } else note("essential-oils", "Essential oils (" + list(eo) + "): natural scent, fine for most skin, but they can irritate sensitive skin.", eo);
    }

    // ---- Preservatives and other watch-outs ----
    const mit = S.filter(i => has(i.entry, "isothiazolinone"));
    if (mit.length) add("mit", leaveOn ? -2 : -1, "MIT/MCI preservative (" + list(mit) + "): a leading cause of skin allergy" + (leaveOn ? ", worst in leave-on products." : "; less exposure in a rinse-off."), mit);
    const fr = S.filter(i => has(i.entry, "formaldehyde"));
    if (fr.length) add("formaldehyde", sens ? -2 : -1, "Formaldehyde releaser (" + list(fr) + "): slowly gives off formaldehyde, a common skin allergen.", fr);
    const parabens = S.filter(i => has(i.entry, "paraben"));
    if (parabens.length) note("parabens", "Parabens (" + list(parabens) + "): very low allergy rate; the hormone evidence is weak at cosmetic levels. No points either way.", parabens);
    const alum = S.filter(i => group(i) === "aluminum");
    if (alum.length) note("aluminum", "Aluminum (" + list(alum) + ") is what makes it an antiperspirant. Major reviews have not linked it to cancer. No points either way.", alum);
    const talc = S.filter(i => has(i.entry, "talc"));
    if (talc.length) note("talc", "Talc: cosmetic talc must be asbestos-free and the cancer link is unproven. No points either way.", talc);
    const dea = S.filter(i => has(i.entry, "dea"));
    if (dea.length) note("dea", "Cocamide DEA is on California's Prop 65 list; exposure from a rinse-off is small. No points either way.", dea);
    const dyes = S.filter(i => group(i) === "dye");
    if (dyes.length) {
      if (sens) add("dyes", -1, "Dyes (" + list(dyes) + ") add nothing for skin and can irritate sensitive skin.", dyes);
      else note("dyes", "Dyes (" + list(dyes) + ") add nothing for skin. They would cost a point for sensitive skin.", dyes);
    }
    const abx = S.filter(i => group(i) === "antibacterial");
    const abxCounted = abx.filter(i => i.active || !parsed.hasInactives);
    if (abxCounted.length) add("antibacterial", -1, "Antibacterial (" + list(abxCounted) + "): the FDA found antibacterial soap no better than plain soap and water for everyday use.", abxCounted);
    else if (abx.length) note("antibacterial", list(abx) + " is listed as an inactive ingredient, so here it works as a preservative. No points.", abx);
    const alc = S.filter(i => group(i) === "drying-alcohol");
    const alcTop = alc.filter(i => inTop(i, 5));
    if (leaveOn && alcTop.length) {
      if (drySens) add("drying-alcohol", -1, "Drying alcohol high on a leave-on list (" + list(alcTop) + "): can dry and sting " + (dry ? "dry" : "sensitive") + " skin.", alcTop);
      else note("drying-alcohol", "Drying alcohol high on a leave-on list (" + list(alcTop) + "). It would cost a point for dry or sensitive skin.", alcTop);
    }
    const acids = S.filter(i => has(i.entry, "aha") && inTop(i, 6));
    if (acids.length && sens) add("strong-acid", -1, "Exfoliating acid high on the list (" + list(acids) + "): can sting sensitive skin.", acids);
    const acne = S.filter(i => has(i.entry, "acne"));
    if (acne.length) {
      if (profile.acne) add("acne-active", 1, "Acne active: " + list(acne) + ".", acne);
      else note("acne-active", "Has an acne active (" + list(acne) + "). It counts as a plus only if you tick acne-prone.", acne);
    }
    const filters = sun ? S.filter(i => i.entry.group === "uv-filter") : [];
    const mineral = filters.filter(i => has(i.entry, "mineral")), chemical = filters.filter(i => has(i.entry, "chemical"));
    if (filters.length && !chemical.length) {
      if (sens) add("mineral-only", 1, "Mineral-only sunscreen filters (" + list(mineral) + "): the gentlest kind for sensitive skin.", mineral);
      else note("mineral-only", "Mineral-only filters (" + list(mineral) + "): the gentlest kind. They earn a point for sensitive skin.", mineral);
    }
    const oxy = S.filter(i => has(i.entry, "oxybenzone"));
    if (oxy.length) {
      if (sens) add("oxybenzone", -1, "Oxybenzone: the US sunscreen filter with the highest allergy rate.", oxy);
      else note("oxybenzone", "Oxybenzone: the US filter with the highest allergy rate; it would cost a point for sensitive skin.", oxy);
    }
    const dd = S.filter(i => group(i) === "dandruff");
    if (dd.length && (family === "hair" || family === "conditioner")) {
      if (profile.dandruff) add("dandruff-active", 1, "Dandruff active: " + list(dd) + ".", dd);
      else note("dandruff-active", "Has a dandruff active (" + list(dd) + "). It counts as a plus only if you tick dandruff.", dd);
    }
    if (profile.acne && leaveOn && (family === "face" || family === "sun")) {
      const pore = S.filter(i => has(i.entry, "pore") && inTop(i, 8) && !saponified.has(i.idx));
      if (pore.length) add("pore-cloggers", -1, "Possible pore-cloggers high on a leave-on face product (" + list(pore) + "). The evidence is mixed: these were rated comedogenic in old rabbit-ear tests.", pore);
    }
    if (parsed.positions <= 10 && !scented && !dyes.length && sens) add("short-list", 1, "Short list (" + parsed.positions + " ingredient" + (parsed.positions === 1 ? "" : "s") + ") with no fragrance or dyes: fewer chances to react.", []);

    // ---- Always-on notes ----
    if (castile) note("castile", "Castile label: oils listed with lye were made into soap, so they don't count as moisturizers.", [castileOil, lye]);
    if (sun) note("spf", "SPF and broad spectrum come from the front label, not the ingredient list.", filters);
    const unscentedLabel = /\b(unscented|fragrance[- ]free|scent[- ]free|without (added )?fragrance|no (added )?fragrance)\b/i.test(label);
    const fragWord = S.filter(i => has(i.entry, "fragrance"));
    if (unscentedLabel && fragWord.length) note("unscented-label", "Labeled “unscented” or “fragrance-free”, but the list includes " + list(fragWord) + " (often a masking fragrance).", fragWord);
    const reef = S.filter(i => has(i.entry, "reef"));
    if (reef.length) note("reef", list(reef) + ": Hawaii bans sunscreens with oxybenzone or octinoxate over coral reef concerns.", reef);
    if (allergens.length) note("eu-allergens", "Lists " + uniq(allergens.map(i => i.entry.id)).length + " of the 26 EU-labeled fragrance allergens: " + names(allergens).join(", ") + ".", allergens);
    const may = items.filter(i => i.may);
    if (may.length) note("may-contain", "May contain: " + names(may).join(", ") + " (shade-dependent; not scored).", may);
    const fixed = items.filter(i => i.entry && i.entry.readAs);
    if (fixed.length) note("spelling", "Read with a spelling fix (check against your bottle): " + fixed.map(i => "“" + i.name + "” as " + i.entry.readAs).join("; ") + ".", fixed);
    if (parsed.unknown.length) note("unknown", parsed.unknown.length + " ingredient" + (parsed.unknown.length === 1 ? " isn't" : "s aren't") + " in the knowledge base yet, so " + (parsed.unknown.length === 1 ? "it wasn't" : "they weren't") + " scored: " + uniq(parsed.unknown).join(", ") + ".", items.filter(i => !i.entry));

    // ---- Avoid list ----
    const words = customWords(profile);
    const flags = [];
    for (const a of AVOID) {
      if (profile.avoid.indexOf(a.key) < 0) continue;
      const hits = items.filter(i => i.entry && a.test(i.entry));
      if (!hits.length) continue;
      const definite = hits.filter(i => !i.may && a.test(i.entry) !== "may");
      flags.push({ key: a.key, label: a.label, items: hits.map(i => i.idx), names: names(hits), may: !definite.length });
    }
    for (const w of words) {
      const hits = items.filter(i => Ing.key(i.name).indexOf(w) >= 0 || (i.entry && Ing.key(i.entry.name).indexOf(w) >= 0));
      if (hits.length) flags.push({ key: "custom:" + w, label: "“" + w + "”", items: hits.map(i => i.idx), names: names(hits), may: hits.every(i => i.may) });
    }
    const flagged = new Set(flags.filter(f => !f.may).flatMap(f => f.items));
    const mayFlagged = new Set(flags.filter(f => f.may).flatMap(f => f.items));

    const score = reasons.reduce((s, r) => s + r.pts, 0);
    let verdict = score >= 2 ? "get" : score <= -2 ? "think" : "fine";
    if (flags.some(f => !f.may)) verdict = "skip";

    // ---- Chip classes ----
    const counted = new Set(abxCounted.map(i => i.idx));
    for (const i of items) {
      if (!i.entry) { i.cls = "unknown"; continue; }
      const e = i.entry, g = group(i);
      let cls = "neutral";
      if (saponified.has(i.idx)) cls = "neutral";
      else if (g === "cleanser") cls = has(e, "harsh") ? "problem" : has(e, "moderate") ? "watch" : "helps";
      else if (g === "soap") cls = "watch";
      else if (g === "moisturizer") cls = "helps";
      else if (g === "conditioning") cls = (family === "hair" || family === "conditioner") ? "helps" : "neutral";
      else if (g === "scent" || g === "dye" || g === "drying-alcohol" || g === "aluminum") cls = "watch";
      else if (g === "preservative") cls = has(e, "isothiazolinone") || has(e, "formaldehyde") ? "problem" : has(e, "paraben") ? "watch" : "neutral";
      else if (g === "antibacterial") cls = counted.has(i.idx) ? "problem" : "watch";
      else if (g === "active") cls = has(e, "acne") && profile.acne ? "helps" : "watch";
      else if (g === "uv-filter") cls = has(e, "mineral") ? "helps" : has(e, "oxybenzone") ? "watch" : "neutral";
      else if (g === "dandruff") cls = profile.dandruff && (family === "hair" || family === "conditioner") ? "helps" : "neutral";
      else if (has(e, "talc") || has(e, "dea")) cls = "watch";
      if (profile.acne && leaveOn && (family === "face" || family === "sun") && has(e, "pore") && !saponified.has(i.idx)) cls = "watch";
      if (mayFlagged.has(i.idx) && cls !== "problem") cls = "watch";
      if (flagged.has(i.idx)) cls = "problem";
      i.cls = cls;
      i.group = g;
    }

    // ---- At a glance ----
    const presv = S.filter(i => group(i) === "preservative" || (group(i) === "antibacterial" && !counted.has(i.idx)));
    const glance = {
      filters: sun ? { mineral: names(mineral), chemical: names(chemical) } : null,
      mainCleanser: cat.wash ? (main ? { name: main.name, strength: main.strength } : null) : null,
      scent: frag.length && eo.length ? "Fragrance + essential oils" : frag.length ? (S.some(i => has(i.entry, "fragrance")) ? "Fragrance" : "Fragrance chemicals") : eo.length ? "Essential oils" : "Fragrance-free",
      allergens: uniq(allergens.map(i => i.entry.id)).length,
      moisturizers: names(moist),
      preservatives: presv.map(i => ({ name: i.name, kind: has(i.entry, "isothiazolinone") ? "mit" : has(i.entry, "formaldehyde") ? "formaldehyde" : has(i.entry, "paraben") ? "paraben" : "ok" })),
      dyes: names(dyes),
      count: parsed.positions,
    };

    return Object.assign(base, { verdict, label: LABELS[verdict], score, reasons, notes, flags, glance, sun, castile });
  }

  // ---------- Better for your skin ----------
  const AVOIDS = { "harsh-top6": "no harsh sulfate up top", fragrance: "fragrance-free", "essential-oils": "no essential oils", mit: "no MIT/MCI", formaldehyde: "no formaldehyde releaser",
    dyes: "no dyes", antibacterial: "no antibacterial", "drying-alcohol": "no drying alcohol up top", "main-soap": "milder cleanser", "main-moderate": "milder cleanser",
    "strong-acid": "no strong acid", oxybenzone: "no oxybenzone", "pore-cloggers": "no pore-cloggers up top" };
  const GAINS = { "main-gentle": "gentle cleanser", "wash-moisturizers": "moisturizers up top", "leave-on-moisture": "moisturizing", barrier: "barrier-repair ingredients",
    "leave-on-unscented": "fragrance-free", occlusive: "seals in moisture", conditioning: "conditioning agents", "mineral-only": "mineral-only filters",
    "dandruff-active": "has a dandruff active", "acne-active": "has an acne active", "short-list": "short, simple list" };
  function reasonFor(me, alt) {
    const parts = [];
    if (me.verdict === "skip") parts.push("nothing on your avoid list");
    const altRules = new Set(alt.reasons.map(r => r.rule));
    const minus = me.reasons.filter(r => r.pts < 0 && !altRules.has(r.rule) && AVOIDS[r.rule]).sort((a, b) => a.pts - b.pts);
    if (minus.length) parts.push(AVOIDS[minus[0].rule]);
    const plus = alt.reasons.filter(r => r.pts > 0 && GAINS[r.rule] && GAINS[r.rule] !== parts[parts.length - 1]).sort((a, b) => b.pts - a.pts);
    if (plus.length && parts.length < 2) parts.push(GAINS[plus[0].rule]);
    const s = parts.slice(0, 2).join(" · ");
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Scores higher for your skin";
  }
  function alternatives(product, profile, catalog) {
    const me = evaluate(product, profile);
    if (!me.complete) return [];
    const bar = me.verdict === "skip" ? Math.min(me.score, 1) : me.score;
    return catalog
      .filter(p => p.id !== product.id && categoryInfo(p.category).kind === me.kind)
      .map(p => ({ product: p, result: evaluate(p, profile) }))
      .filter(x => x.result.complete && x.result.score > bar && x.result.verdict !== "think" && !x.result.flags.length)
      .sort((a, b) => b.result.score - a.result.score || (a.product.brand + a.product.name).localeCompare(b.product.brand + b.product.name))
      .slice(0, 3)
      .map(x => Object.assign(x, { reason: reasonFor(me, x.result) }));
  }

  // ---------- Compare ----------
  const display = p => ((p.brand ? p.brand + " " : "") + p.name).trim();
  function compare(a, b, profile) {
    const ra = evaluate(a, profile), rb = evaluate(b, profile);
    const na = display(a), nb = display(b);
    let answer, winner = null;
    const rank = r => (r.verdict === "skip" ? -1000 : 0) + r.score;
    if (!ra.complete && !rb.complete) answer = "Neither has a complete ingredient list, so neither has a verdict yet.";
    else if (!ra.complete) { answer = na + " has an incomplete list, so only " + nb + " has a verdict."; }
    else if (!rb.complete) { answer = nb + " has an incomplete list, so only " + na + " has a verdict."; }
    else if (ra.verdict === "skip" && rb.verdict === "skip") answer = "Both have something on your avoid list.";
    else if (rank(ra) === rank(rb)) answer = "Both score the same for your skin (" + signed(ra.score) + ").";
    else {
      winner = rank(ra) > rank(rb) ? "a" : "b";
      const [w, l, rw, rl] = winner === "a" ? [na, nb, ra, rb] : [nb, na, rb, ra];
      answer = w + " is the better pick for your skin" + (rl.verdict === "skip" ? ": " + l + " has something on your avoid list." : " (" + signed(rw.score) + " vs " + signed(rl.score) + ").");
    }
    const g = r => r.glance || {};
    const rows = [
      ["Verdict", ra.label, rb.label, winner],
      ["Score", ra.complete ? signed(ra.score) : "—", rb.complete ? signed(rb.score) : "—", winner],
      ["Avoid list", ra.flags ? (ra.flags.map(f => f.label).join(", ") || "Nothing") : "—", rb.flags ? (rb.flags.map(f => f.label).join(", ") || "Nothing") : "—", null],
      ["Main cleanser", g(ra).mainCleanser ? g(ra).mainCleanser.name + " (" + g(ra).mainCleanser.strength + ")" : "—", g(rb).mainCleanser ? g(rb).mainCleanser.name + " (" + g(rb).mainCleanser.strength + ")" : "—", null],
      ["UV filters", g(ra).filters ? [].concat(g(ra).filters.mineral, g(ra).filters.chemical).join(", ") : "—", g(rb).filters ? [].concat(g(rb).filters.mineral, g(rb).filters.chemical).join(", ") : "—", null],
      ["Scent", g(ra).scent || "—", g(rb).scent || "—", null],
      ["Moisturizers", g(ra).moisturizers ? String(g(ra).moisturizers.length) : "—", g(rb).moisturizers ? String(g(rb).moisturizers.length) : "—", null],
      ["Preservatives", g(ra).preservatives ? g(ra).preservatives.map(p => p.name).join(", ") || "None listed" : "—", g(rb).preservatives ? g(rb).preservatives.map(p => p.name).join(", ") || "None listed" : "—", null],
      ["Dyes", g(ra).dyes ? g(ra).dyes.join(", ") || "None" : "—", g(rb).dyes ? g(rb).dyes.join(", ") || "None" : "—", null],
      ["Ingredients", String(ra.positions), String(rb.positions), null],
    ].filter(r => !(r[0] === "Main cleanser" && r[1] === "—" && r[2] === "—") && !(r[0] === "UV filters" && r[1] === "—" && r[2] === "—"));
    return { answer, winner, rows, a: ra, b: rb };
  }

  return { evaluate, alternatives, compare, describeProfile, normalizeProfile, categoryInfo, signed, CATEGORIES, LABELS, AVOID, DEFAULT_PROFILE };
});
