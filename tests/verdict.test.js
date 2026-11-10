const test = require("node:test");
const assert = require("node:assert/strict");
const V = require("../js/verdict.js");
const P = require("../js/products.js");

const ev = (category, ingredients, profile, extra) => V.evaluate(Object.assign({ name: "Test product", category, ingredients }, extra || {}), profile || {});
const pts = (r, rule) => { const x = r.reasons.find(y => y.rule === rule); return x ? x.pts : 0; };
const hasNote = (r, rule) => r.notes.some(n => n.rule === rule);
const DRY = { skin: "dry" }, SENS = { sensitive: true };

test("thresholds: ≥ +2 Get it, −1..+1 Fine, ≤ −2 Think twice", () => {
  assert.equal(ev("Lotion", "Water, Glycerin, Cetyl Alcohol, Dimethicone, Phenoxyethanol").verdict, "get"); // +1 moisture, +1 unscented
  assert.equal(ev("Body wash", "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Fragrance").verdict, "fine");
  const think = ev("Lotion", "Water, Alcohol Denat., Glycerin, Fragrance, Methylisothiazolinone");
  assert.equal(think.score <= -2, true);
  assert.equal(think.verdict, "think");
  assert.equal(think.label, "Think twice");
});

test("Dove-style syndet bar is scored gentle, not soap", () => {
  const dove = P.byId("dove-beauty-bar");
  for (const prof of [{}, DRY, SENS]) {
    const r = V.evaluate(dove, prof);
    assert.equal(r.glance.mainCleanser.strength, "gentle");
    assert.equal(pts(r, "main-gentle"), 1);
    assert.equal(pts(r, "main-soap"), 0);
  }
  assert.ok(hasNote(V.evaluate(dove, {}), "syndet-bar"));
});

test("castile label (oil + lye in the top 4) is true soap; oils don't count as moisturizers", () => {
  const r = ev("Bar soap", "Organic Coconut Oil, Organic Olive Oil, Potassium Hydroxide, Water, Organic Jojoba Oil, Citric Acid, Tocopherol", DRY);
  assert.equal(r.castile, true);
  assert.equal(r.glance.mainCleanser.strength, "soap");
  assert.equal(pts(r, "main-soap"), -1);
  assert.equal(pts(r, "wash-moisturizers"), 0);
  const bronner = V.evaluate(P.byId("dr-bronners-peppermint-bar"), {});
  assert.equal(bronner.castile, true);
  assert.ok(hasNote(bronner, "main-soap")); // a note, not points, for normal skin
  assert.equal(pts(ev("Bar soap", "Sodium Palmate, Sodium Palm Kernelate, Water, Glycerin, Fragrance", SENS), "main-soap"), -1);
});

test("SLS in the top 6: −1 for normal skin, −2 for dry or sensitive", () => {
  const list = "Water, Sodium Lauryl Sulfate, Cocamidopropyl Betaine, Glycerin, Sodium Chloride, Citric Acid";
  assert.equal(pts(ev("Shampoo", list), "harsh-top6"), -1);
  assert.equal(pts(ev("Shampoo", list, DRY), "harsh-top6"), -2);
  assert.equal(pts(ev("Shampoo", list, SENS), "harsh-top6"), -2);
});

test("moderate main cleanser costs a point only for dry/sensitive skin (else a note)", () => {
  const list = "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Sodium Chloride, Glycerin";
  assert.equal(pts(ev("Body wash", list), "main-moderate"), 0);
  assert.ok(hasNote(ev("Body wash", list), "main-moderate"));
  assert.equal(pts(ev("Body wash", list, DRY), "main-moderate"), -1);
});

test("MIT/MCI: −2 in a leave-on, −1 in a rinse-off (and the toggle switches it)", () => {
  const list = "Water, Glycerin, Cetearyl Alcohol, Dimethicone, Methylchloroisothiazolinone, Methylisothiazolinone";
  assert.equal(pts(ev("Lotion", list), "mit"), -2);
  assert.equal(pts(ev("Body wash", list), "mit"), -1);
  assert.equal(pts(ev("Body wash", list, {}, { leaveOn: true }), "mit"), -2);
  assert.equal(pts(ev("Lotion", list, {}, { leaveOn: false }), "mit"), -1);
});

test("parabens, aluminum, talc and cocamide DEA are notes only", () => {
  const r = ev("Lotion", "Water, Glycerin, Talc, Cetyl Alcohol, Methylparaben, Propylparaben, Cocamide DEA");
  assert.ok(!r.reasons.some(x => /paraben|talc|dea/i.test(x.rule)));
  assert.ok(hasNote(r, "parabens") && hasNote(r, "talc") && hasNote(r, "dea"));
  const ap = V.evaluate(P.byId("dove-original-clean-antiperspirant"), {});
  assert.ok(hasNote(ap, "aluminum"));
  assert.ok(!ap.reasons.some(x => x.rule === "aluminum"));
});

test("avoid list gives Skip; Cetaphil-style sulfosuccinate is NOT a sulfate", () => {
  const avoid = { avoid: ["sulfates"] };
  const sulfo = ev("Face wash", "Water, Glycerin, Cocamidopropyl Betaine, Disodium Laureth Sulfosuccinate, Sodium Cocoamphoacetate, Panthenol, Niacinamide", avoid);
  assert.equal(sulfo.flags.length, 0);
  assert.notEqual(sulfo.verdict, "skip");
  const sles = ev("Face wash", "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Glycerin, Sodium Chloride", avoid);
  assert.equal(sles.verdict, "skip");
  assert.equal(sles.label, "Skip");
  assert.equal(sles.flags[0].key, "sulfates");
  assert.equal(V.evaluate(P.byId("head-shoulders-classic-clean"), { avoid: ["dyes"] }).verdict, "skip");
});

test("vegan: beeswax is a definite hit (Skip); sodium stearate is a 'may' flag (no Skip)", () => {
  const dove = V.evaluate(P.byId("dove-beauty-bar"), { avoid: ["vegan"] });
  assert.equal(dove.flags.length, 1);
  assert.equal(dove.flags[0].may, true);
  assert.notEqual(dove.verdict, "skip");
  const sheer = V.evaluate(P.byId("neutrogena-ultra-sheer-spf55"), { avoid: ["vegan"] });
  assert.equal(sheer.verdict, "skip");
  const synth = V.evaluate(P.byId("neutrogena-hydro-boost-fragrance-free"), { avoid: ["vegan"] });
  assert.equal(synth.flags.length, 0);
});

test("custom avoid words match ingredient names", () => {
  const r = V.evaluate(P.byId("native-deodorant-citrus-musk"), { custom: "coconut, shea" });
  assert.equal(r.verdict, "skip");
  assert.deepEqual(r.flags.map(f => f.key), ["custom:coconut", "custom:shea"]);
  assert.equal(V.evaluate(P.byId("native-deodorant-citrus-musk"), { custom: "almond" }).flags.length, 0);
});

test("'unscented' label that lists fragrance gets a note", () => {
  const r = ev("Lotion", "Water, Glycerin, Petrolatum, Fragrance, Phenoxyethanol", {}, { name: "Unscented Daily Lotion" });
  assert.ok(hasNote(r, "unscented-label"));
  assert.ok(!hasNote(ev("Lotion", "Water, Glycerin, Petrolatum, Phenoxyethanol", {}, { name: "Unscented Daily Lotion" }), "unscented-label"));
});

test("fragrance: −2 sensitive, −1 leave-on or baby, note for a rinse-off on normal skin; EO capped", () => {
  const wash = "Water, Cocamidopropyl Betaine, Decyl Glucoside, Glycerin, Fragrance";
  assert.equal(pts(ev("Body wash", wash), "fragrance"), 0);
  assert.ok(hasNote(ev("Body wash", wash), "fragrance"));
  assert.equal(pts(ev("Body wash", wash, SENS), "fragrance"), -2);
  assert.equal(pts(ev("Lotion", "Water, Glycerin, Cetyl Alcohol, Fragrance"), "fragrance"), -1);
  const both = ev("Lotion", "Water, Glycerin, Cetyl Alcohol, Fragrance, Lavandula Angustifolia Oil", SENS);
  assert.equal(pts(both, "fragrance") + pts(both, "essential-oils"), -2);
  assert.equal(pts(ev("Lotion", "Water, Glycerin, Cetyl Alcohol, Lavandula Angustifolia Oil", SENS), "essential-oils"), -1);
});

test("baby products count fragrance even as a rinse-off", () => {
  const list = "Water, Cocamidopropyl Betaine, Decyl Glucoside, Glycerin, Fragrance";
  assert.equal(pts(ev("Baby wash", list), "fragrance"), -1);
  assert.equal(pts(ev("Body wash", list), "fragrance"), 0);
  assert.equal(pts(ev("Shampoo", list, {}, { name: "Baby Shampoo" }), "fragrance"), -1);
  assert.equal(pts(V.evaluate(P.byId("johnsons-head-to-toe"), {}), "fragrance"), -1);
});

test("acne actives count only with acne-prone ticked", () => {
  const acne = P.byId("neutrogena-oil-free-acne-wash");
  assert.equal(pts(V.evaluate(acne, {}), "acne-active"), 0);
  assert.ok(hasNote(V.evaluate(acne, {}), "acne-active"));
  assert.equal(pts(V.evaluate(acne, { acne: true }), "acne-active"), 1);
  assert.equal(pts(ev("Face wash", "Water, Sodium Cocoyl Isethionate, Glycerin, Benzoyl Peroxide, Sodium Chloride", { acne: true }), "acne-active"), 1);
});

test("dandruff active counts only with dandruff ticked", () => {
  const hs = P.byId("head-shoulders-classic-clean");
  assert.equal(pts(V.evaluate(hs, {}), "dandruff-active"), 0);
  assert.equal(pts(V.evaluate(hs, { dandruff: true }), "dandruff-active"), 1);
  assert.equal(V.evaluate(hs, { dandruff: true }).score, V.evaluate(hs, {}).score + 1);
  assert.equal(pts(V.evaluate(P.byId("native-deodorant-citrus-musk"), { dandruff: true }), "dandruff-active"), 0); // not a hair product
});

test("mineral-only sunscreen gets +1 for sensitive skin; mixed filters don't", () => {
  const mineral = P.byId("cerave-mineral-sunscreen-spf50"), mixed = P.byId("eltamd-uv-clear-spf46");
  assert.equal(pts(V.evaluate(mineral, SENS), "mineral-only"), 1);
  assert.equal(pts(V.evaluate(mineral, {}), "mineral-only"), 0);
  assert.equal(pts(V.evaluate(mixed, SENS), "mineral-only"), 0);
  assert.deepEqual(V.evaluate(mixed, {}).glance.filters, { mineral: ["Zinc oxide"], chemical: ["Octinoxate"] });
});

test("oxybenzone: −1 for sensitive, a note otherwise, and avoidable", () => {
  const list = "Active Ingredients: Avobenzone 3%, Oxybenzone 6%. Inactive Ingredients: Water, Glycerin, Dimethicone, Phenoxyethanol";
  assert.equal(pts(ev("Sunscreen", list, SENS), "oxybenzone"), -1);
  assert.ok(hasNote(ev("Sunscreen", list), "oxybenzone"));
  assert.ok(hasNote(ev("Sunscreen", list), "reef"));
  assert.equal(ev("Sunscreen", list, { avoid: ["oxybenzone"] }).verdict, "skip");
});

test("pore-cloggers count on leave-on face/sun products only, with acne ticked", () => {
  const list = "Water, Cocos Nucifera (Coconut) Oil, Glycerin, Isopropyl Myristate, Cetyl Alcohol, Phenoxyethanol";
  assert.equal(pts(ev("Face moisturizer", list, { acne: true }), "pore-cloggers"), -1);
  assert.match(ev("Face moisturizer", list, { acne: true }).reasons.find(r => r.rule === "pore-cloggers").text, /mixed/);
  assert.equal(pts(ev("Lotion", list, { acne: true }), "pore-cloggers"), 0);
  assert.equal(pts(ev("Face moisturizer", list, {}), "pore-cloggers"), 0);
  assert.equal(pts(ev("Face wash", "Water, Sodium Cocoyl Isethionate, Coconut Oil, Glycerin", { acne: true }), "pore-cloggers"), 0);
});

test("other rules: formaldehyde, antibacterial, drying alcohol, strong acid, barrier, occlusive, conditioner, short list", () => {
  const fr = "Water, Sodium Laureth Sulfate, Cocamidopropyl Betaine, DMDM Hydantoin, Glycerin";
  assert.equal(pts(ev("Shampoo", fr), "formaldehyde"), -1);
  assert.equal(pts(ev("Shampoo", fr, SENS), "formaldehyde"), -2);
  assert.equal(pts(V.evaluate(P.byId("dial-gold-hand-soap"), {}), "antibacterial"), -1);
  const acneWash = V.evaluate(P.byId("neutrogena-oil-free-acne-wash"), {}); // benzalkonium listed as inactive
  assert.equal(pts(acneWash, "antibacterial"), 0);
  assert.ok(hasNote(acneWash, "antibacterial"));
  assert.equal(pts(V.evaluate(P.byId("jergens-original-scent"), DRY), "drying-alcohol"), -1);
  assert.equal(pts(V.evaluate(P.byId("jergens-original-scent"), {}), "drying-alcohol"), 0);
  assert.equal(pts(ev("Face moisturizer", "Water, Glycolic Acid, Glycerin, Cetyl Alcohol, Sodium Hydroxide", SENS), "strong-acid"), -1);
  assert.equal(pts(V.evaluate(P.byId("cerave-moisturizing-cream"), DRY), "barrier"), 1);
  assert.equal(pts(V.evaluate(P.byId("cerave-moisturizing-cream"), {}), "barrier"), 0);
  assert.equal(pts(V.evaluate(P.byId("vaseline-original-jelly"), DRY), "occlusive"), 1);
  assert.equal(pts(V.evaluate(P.byId("pantene-daily-moisture-conditioner"), {}), "conditioning"), 1);
  assert.equal(pts(V.evaluate(P.byId("eucerin-original-healing-creme"), SENS), "short-list"), 1);
});

test("always-on notes: SPF, EU allergens, unknown ingredients", () => {
  assert.ok(hasNote(V.evaluate(P.byId("banana-boat-sport-ultra-spf50"), {}), "spf"));
  const dove = V.evaluate(P.byId("dove-deep-moisture-wash"), {});
  assert.match(dove.notes.find(n => n.rule === "eu-allergens").text, /Lists 6 of the 26/);
  const unk = ev("Lotion", "Water, Glycerin, Florbinox, Fragrance");
  assert.deepEqual(unk.unknown, ["Florbinox"]);
  assert.match(unk.notes.find(n => n.rule === "unknown").text, /^1 ingredient isn't in the knowledge base yet/);
  assert.equal(unk.items.find(i => i.name === "Florbinox").cls, "unknown");
});

test("incomplete lists: no verdict, no reasons, no notes, list still shown", () => {
  for (const list of ["Water, Glycerin, Fragrance…", "Water, Glycerin and other ingredients", "Active Ingredients: Zinc Oxide 20%, Sunscreen", "Water, Glycerin", "Shea butter. See package for full ingredients."]) {
    const r = ev("Lotion", list);
    assert.equal(r.complete, false, list);
    assert.equal(r.verdict, null);
    assert.equal(r.label, "Incomplete list");
    assert.deepEqual(r.reasons, []);
    assert.deepEqual(r.notes, []);
    assert.ok(r.items.length > 0);
  }
  const vas = ev("Ointment", "White Petrolatum 100%");
  assert.equal(vas.complete, true);
  assert.equal(V.evaluate(P.byId("vaseline-original-jelly"), {}).complete, true);
});

test("better for your skin: same kind, higher score, nothing on the avoid list", () => {
  const hs = P.byId("head-shoulders-classic-clean");
  const alts = V.alternatives(hs, SENS, P.PRODUCTS);
  const me = V.evaluate(hs, SENS);
  assert.ok(alts.length >= 1 && alts.length <= 3);
  for (const a of alts) {
    assert.equal(V.categoryInfo(a.product.category).kind, "shampoo");
    assert.ok(a.result.score > me.score);
    assert.equal(a.result.flags.length, 0);
    assert.ok(a.reason.length > 3);
  }
  const sun = V.alternatives(P.byId("banana-boat-sport-ultra-spf50"), SENS, P.PRODUCTS);
  assert.ok(sun.length && sun.every(a => a.product.category === "Sunscreen"));
  assert.ok(V.alternatives(hs, { avoid: ["fragrance"] }, P.PRODUCTS).every(a => !a.result.flags.length));
});

test("compare gives a one-line answer and a table", () => {
  const c = V.compare(P.byId("eltamd-uv-clear-spf46"), P.byId("banana-boat-sport-ultra-spf50"), SENS);
  assert.match(c.answer, /EltaMD UV Clear Broad-Spectrum SPF 46 is the better pick for your skin/);
  assert.equal(c.winner, "a");
  assert.ok(c.rows.length >= 6);
});

test("determinism: the same product evaluates identically twice", () => {
  for (const p of P.PRODUCTS) {
    for (const prof of [{}, { skin: "dry", sensitive: true, acne: true, dandruff: true, avoid: ["fragrance", "vegan"], custom: "coconut" }]) {
      assert.equal(JSON.stringify(V.evaluate(p, prof)), JSON.stringify(V.evaluate(p, prof)), p.id);
    }
  }
});

test("every point shown traces to a named rule", () => {
  for (const p of P.PRODUCTS) {
    const r = V.evaluate(p, { skin: "dry", sensitive: true, acne: true, dandruff: true });
    for (const x of r.reasons) {
      assert.ok(x.rule && typeof x.rule === "string");
      assert.ok(Number.isInteger(x.pts) && x.pts !== 0);
    }
    assert.equal(r.score, r.reasons.reduce((s, x) => s + x.pts, 0));
  }
});
