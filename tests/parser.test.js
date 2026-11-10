const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("../js/ingredients.js");

const names = p => p.items.map(i => i.name);
const ids = p => p.items.map(i => i.entry && i.entry.id);
const find = (p, re) => p.items.find(i => re.test(i.name));

test("strips 'Ingredients:' and keeps label order", () => {
  const p = parse("Ingredients: Water, Glycerin, Fragrance.");
  assert.deepEqual(names(p), ["Water", "Glycerin", "Fragrance"]);
  assert.deepEqual(p.items.map(i => i.pos), [1, 2, 3]);
});

test("Drug Facts headings, purpose words and percentages", () => {
  const p = parse("Active Ingredient & Concentration: Pyrithione Zinc (1 %), Anti-dandruff. Inactive Ingredients: Water, Sodium Laureth Sulfate, Fragrance");
  assert.equal(p.hasActives, true);
  assert.equal(p.hasInactives, true);
  assert.deepEqual(names(p), ["Pyrithione Zinc", "Water", "Sodium Laureth Sulfate", "Fragrance"]);
  assert.equal(p.items[0].pct, 1);
  assert.equal(p.items[0].active, true);
  assert.equal(p.items[0].rank, 0);
  assert.equal(p.items[1].rank, 1);
});

test("percentages before or after the name: 'Zinc Oxide 9.0%' and '7.5% Octinoxate'", () => {
  const p = parse("Active Ingredients: Zinc Oxide 9.0%, 7.5% Octinoxate. Inactive Ingredients: Water, Glycerin, Phenoxyethanol");
  assert.deepEqual(names(p).slice(0, 2), ["Zinc Oxide", "Octinoxate"]);
  assert.equal(p.items[0].pct, 9);
  assert.equal(p.items[1].pct, 7.5);
});

test("drops Drug Facts purpose words (Sunscreen, Antiseptic, Skin Protectant)", () => {
  const p = parse("Active Ingredients: Avobenzone (3 %), Sunscreen.; Homosalate (10 %), Sunscreen. Inactive Ingredients: Water, Silica, Benzalkonium Chloride, Antiseptic");
  assert.deepEqual(names(p), ["Avobenzone", "Homosalate", "Water", "Silica", "Benzalkonium Chloride"]);
});

test("splits on top-level commas only; a parenthesized sublist shares one position", () => {
  const p = parse("Soap (Sodium Tallowate, Sodium Cocoate or Sodium Palm Kernelate), Water, Glycerin");
  const soap = p.items.filter(i => i.sub);
  assert.deepEqual(soap.map(i => i.name), ["Sodium Tallowate", "Sodium Cocoate", "Sodium Palm Kernelate"]);
  assert.ok(soap.every(i => i.pos === 1));
  assert.equal(find(p, /^Water$/).pos, 2);
  assert.equal(p.positions, 3);
});

test("'A or B' and 'and/or' are alternatives sharing a position (incl. French 'Et/Ou')", () => {
  const p = parse("Water, Sodium C12-13 Alketh Sulfate And/or Et/Ou Sodium Laureth Sulfate, Mica or Titanium Dioxide, Glycerin");
  const alt = p.items.filter(i => i.alt);
  assert.deepEqual(alt.map(i => i.name), ["Sodium C12-13 Alketh Sulfate", "Sodium Laureth Sulfate", "Mica", "Titanium Dioxide"]);
  assert.deepEqual(alt.map(i => i.pos), [2, 2, 3, 3]);
  assert.equal(find(p, /^Glycerin$/).pos, 4);
});

test("Water/Aqua/Eau is one ingredient, but Caprylic/Capric Triglyceride stays whole", () => {
  const p = parse("Water/Aqua/Eau, Caprylic/Capric Triglyceride, Fragrance/Parfum, Aqua (Water, Eau)");
  assert.deepEqual(ids(p), ["water", "caprylic-capric-triglyceride", "fragrance", "water"]);
  assert.equal(p.positions, 4);
});

test("'May contain (+/-):' marks the items after it", () => {
  const p = parse("Water, Glycerin, Mica. May contain (+/-): CI 77491, Red 40, Blue 1");
  assert.deepEqual(p.items.filter(i => i.may).map(i => i.name), ["CI 77491", "Red 40", "Blue 1"]);
  assert.ok(p.items.filter(i => !i.may).every(i => i.rank !== null));
});

test("D&C Green No. 8 does not split at the period", () => {
  const p = parse("Water, Sodium Laureth Sulfate, D&C Green No. 8, FD&C Yellow No. 5, Fragrance");
  assert.deepEqual(names(p), ["Water", "Sodium Laureth Sulfate", "D&C Green No. 8", "FD&C Yellow No. 5", "Fragrance"]);
  assert.equal(find(p, /Green/).entry.group, "dye");
});

test("parenthesis aliases: Shea Butter, CI 77891, Parfum", () => {
  const p = parse("Butyrospermum Parkii (Shea) Butter, Titanium Dioxide (CI 77891), Fragrance (Parfum), Glycine Soja (Soybean) Oil");
  assert.deepEqual(ids(p), ["shea-butter", "titanium-dioxide", "fragrance", "soybean-oil"]);
});

test("strips *, 'organic' and footnotes after the list", () => {
  const p = parse("Organic Coconut Oil(a)*, Organic Palm Oil(a)*, Sodium Hydroxide(b), Water, Organic Olive Oil*, Limonene. (a)Regenerative Organic Certified. *Certified Fair Trade. (b)None Remains After Saponifying Oils Into Soap & Glycerin.");
  assert.deepEqual(names(p), ["Organic Coconut Oil", "Organic Palm Oil", "Sodium Hydroxide", "Water", "Organic Olive Oil", "Limonene"]);
  assert.deepEqual(ids(p), ["coconut-oil", "palm-oil", "sodium-hydroxide", "water", "olive-oil", "limonene"]);
  const q = parse("Water*, Glycerin*, Fragrance, Titanium Dioxide*. * Naturally-Derived Ingredients.");
  assert.deepEqual(names(q), ["Water", "Glycerin", "Fragrance", "Titanium Dioxide"]);
});

test("real-label noise: ', USP', batch codes, '1,2-Hexanediol', 'Alcohol Denat.', 'Ext. Violet 2'", () => {
  assert.deepEqual(names(parse("Active Ingredients: White Petrolatum, USP (100 %), Skin Protectant.")), ["White Petrolatum"]);
  assert.deepEqual(names(parse("2021506 4 - Ingredients: Aqua/Water/Eau, Glycerin, Cetyl Alcohol, Ethylhexylglycerin. Code F.I.L. D214633/3.")), ["Aqua/Water/Eau", "Glycerin", "Cetyl Alcohol", "Ethylhexylglycerin"]);
  assert.deepEqual(names(parse("Aqua/Water/Eau, Glycerin, Phytosphingosine, Ethylhexylglycerin (Code F,I,L, D229186/1).")), ["Aqua/Water/Eau", "Glycerin", "Phytosphingosine", "Ethylhexylglycerin"]);
  const h = parse("Water, 1,2-Hexanediol, Glycerin");
  assert.deepEqual(names(h), ["Water", "1,2-Hexanediol", "Glycerin"]);
  assert.equal(find(parse("Water, Glycerin, Alcohol Denat., Cetearyl Alcohol"), /Denat/).entry.group, "drying-alcohol");
  assert.equal(find(parse("Aqua (Water, Eau), Glycerin, Sodium Chloride., Alcohol, CI 60730 (Ext. Violet 2)"), /Violet/).entry.group, "dye");
});

test("incomplete lists: ellipsis, 'and other ingredients', 'see package', actives only, two or fewer", () => {
  assert.deepEqual(parse("Water, Glycerin, Fragrance…").incomplete, ["truncated"]);
  assert.ok(parse("Water, Glycerin, Cetyl Alcohol and other ingredients").incomplete.includes("truncated"));
  assert.ok(parse("Water, Glycerin, Dimethicone. See package for full list").incomplete.includes("truncated"));
  assert.ok(parse("Active Ingredients: Zinc Oxide 20%, Sunscreen").incomplete.includes("actives-only"));
  assert.ok(parse("Water, Glycerin").incomplete.includes("too-short"));
  assert.ok(parse("").incomplete.includes("empty"));
  assert.deepEqual(parse("White Petrolatum 100%").incomplete, []);
  assert.deepEqual(parse("Water, Glycerin, Fragrance").incomplete, []);
});
