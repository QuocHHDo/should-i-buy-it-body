const test = require("node:test");
const assert = require("node:assert/strict");
const { parse, lookup } = require("../js/ingredients.js");
const V = require("../js/verdict.js");
const { names } = require("./fixtures/common-ingredients.json");

test("every ingredient name seen 3+ times in 822 real Open Beauty Facts lists is recognized", () => {
  const missing = names.filter(([name]) => parse(name).unknown.length).map(([name, n]) => name + " ×" + n);
  assert.deepEqual(missing, []);
  assert.ok(names.length >= 700);
});

test("spelling fixes: split words and one typo are read, shown as 'read as' with the matched name", () => {
  const read = n => { const e = lookup(n); return e && e.readAs; };
  assert.equal(read("Isopropyl Pal Mitate"), "Isopropyl Palmitate");
  assert.equal(read("Hexamethylinda Nopyran"), "Hexamethylindanopyran");
  assert.equal(read("Steraryl Alcohol"), "Stearyl Alcohol");
  assert.equal(read("Cetearyl Alchohol"), "Cetearyl Alcohol");
  assert.equal(read("Glycery! Oleate"), "Glyceryl Oleate"); // "!" is a photo misread of "l"
  assert.equal(lookup("Isopropyl Pal Mitate").group, "moisturizer");
});

test("spelling fixes never guess: different numbers, ties and short names are left unknown", () => {
  assert.equal(lookup("Benzophenone-2"), null);       // one letter from benzophenone-3 and -4, but the number differs
  assert.equal(lookup("Polysilicone-29") && lookup("Polysilicone-29").readAs, undefined);
  assert.equal(lookup("Glycerim"), null);             // under 10 letters: no typo fixing
  assert.ok(lookup("Sodium Laurel Sulfate").tags.includes("harsh")); // a common misspelling of SLS, listed as one
});

test("a spelling fix is noted on the card and the ingredient still scores", () => {
  const r = V.evaluate({ name: "Pasted", category: "Lotion", ingredients: "Water, Glycerin, Isopropyl Pal Mitate, Cetearyl Alchohol, Phenoxyethanol" }, {});
  assert.match(r.notes.find(n => n.rule === "spelling").text, /“Isopropyl Pal Mitate” as Isopropyl Palmitate; “Cetearyl Alchohol” as Cetearyl Alcohol/);
  assert.deepEqual(r.unknown, []);
  assert.ok(r.items.every(i => i.cls === "helps" || i.cls === "neutral"));
});

test("real-world label noise from photos and other languages", () => {
  const names = t => parse(t).items.map(i => i.name);
  const ids = t => parse(t).items.map(i => i.entry && i.entry.group);
  assert.deepEqual(names("Water, 1, 2-Hexanediol, Glycerin"), ["Water", "1, 2-Hexanediol", "Glycerin"]);
  assert.deepEqual(names("Water, Iron Oxides (CI 77491, 77492, 77499), Mica"), ["Water", "Iron Oxides (CI 77491, 77492, 77499)", "Mica"]);
  assert.deepEqual(names("Aqua [Water], Glycerin, Parfum &amp; Fragrance"), ["Aqua (Water)", "Glycerin", "Parfum & Fragrance"]);
  assert.deepEqual(names("Ingredientes: Aqua, Glycerin, Sodium Benzoate"), ["Aqua", "Glycerin", "Sodium Benzoate"]);
  assert.deepEqual(parse("Aqua, Glycerin, Mica. May contain/Peut contenir: CI 77491, CI 77891").items.filter(i => i.may).map(i => i.name), ["CI 77491", "CI 77891"]);
  assert.deepEqual(ids("Pyridoxine HCI, C 14720, Cl 61570, Poliquaternium-10"), ["neutral", "dye", "dye", "conditioning"]);
  assert.deepEqual(ids("Hyaluronic Acid/Acide Hyaluronique, CI 19140/Yellow 5, Maris Sal/Sea Salt/Sel Marin"), ["moisturizer", "dye", "neutral"]);
});

test("new knowledge: perfume materials, EU filters, MIT stabilizers, vitamins, peptides, animal proteins", () => {
  const g = n => { const e = lookup(n); return e && e.group + ":" + e.tags.join("+"); };
  assert.equal(g("Tetramethyl Acetyloctahydronaphthalenes"), "scent:fragrance");
  assert.equal(g("Terpineol"), "scent:fragrance");
  assert.equal(g("Diethylhexyl Butamido Triazone"), "uv-filter:chemical");
  assert.equal(g("Methylene Bis-Benzotriazolyl Tetramethylbutylphenol"), "uv-filter:chemical");
  assert.equal(g("Magnesium Nitrate"), "neutral:salt");
  assert.equal(g("Sodium Ascorbyl Phosphate"), "neutral:antioxidant");
  assert.equal(g("Palmitoyl Tripeptide-1"), "neutral:skin-care");
  assert.equal(g("Sodium Acetylated Hyaluronate"), "moisturizer:humectant");
  assert.ok(lookup("Hydrolyzed Silk").tags.includes("animal"));
  assert.ok(lookup("Cocodimonium Hydroxypropyl Hydrolyzed Keratin").tags.includes("animal"));
  assert.ok(lookup("Goat Milk").tags.includes("animal"));
  assert.equal(g("5-Bromo-5-Nitro-1,3-Dioxane"), "preservative:formaldehyde");
  assert.equal(g("Sodium Sunflowerseedate"), "soap:");
});
