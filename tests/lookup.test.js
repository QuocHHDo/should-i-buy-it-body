const test = require("node:test");
const assert = require("node:assert/strict");
const { lookup, ENTRIES } = require("../js/ingredients.js");

const strength = n => { const e = lookup(n); return e && e.group === "cleanser" ? e.tags.find(t => ["harsh", "moderate", "gentle"].includes(t)) : e && e.group; };

test("cleanser strengths", () => {
  for (const n of ["Sodium Lauryl Sulfate", "Ammonium Lauryl Sulfate", "Sodium Coco-Sulfate"]) assert.equal(strength(n), "harsh", n);
  for (const n of ["Sodium Laureth Sulfate", "Ammonium Laureth Sulfate", "Sodium C14-16 Olefin Sulfonate", "Sodium Myreth Sulfate", "Sodium C12-13 Pareth Sulfate"]) assert.equal(strength(n), "moderate", n);
  for (const n of ["Sodium Cocoyl Isethionate", "Decyl Glucoside", "Cocamidopropyl Betaine", "Cocamidopropyl Hydroxysultaine", "Sodium Lauroyl Sarcosinate",
    "Sodium Cocoyl Glutamate", "Sodium Methyl Cocoyl Taurate", "Disodium Laureth Sulfosuccinate", "Sodium Lauroamphoacetate", "Lauryl Glucoside"]) assert.equal(strength(n), "gentle", n);
});

test("true soap is its own group", () => {
  for (const n of ["Sodium Tallowate", "Sodium Palmate", "Sodium Cocoate", "Potassium Cocoate", "Saponified Organic Coconut Oil"]) assert.equal(lookup(n).group, "soap", n);
  assert.notEqual(lookup("Sodium Carbonate") && lookup("Sodium Carbonate").group, "soap");
});

test("fatty alcohols aren't drying; exact drying alcohols are; benzyl alcohol is a preservative", () => {
  for (const n of ["Cetyl Alcohol", "Cetearyl Alcohol", "Stearyl Alcohol", "Behenyl Alcohol"]) {
    assert.equal(lookup(n).group, "moisturizer", n);
    assert.ok(lookup(n).tags.includes("fatty-alcohol"), n);
  }
  for (const n of ["Alcohol", "Alcohol Denat.", "SD Alcohol 40-B", "Isopropyl Alcohol", "Denatured Alcohol"]) assert.equal(lookup(n).group, "drying-alcohol", n);
  assert.equal(lookup("Benzyl Alcohol").group, "preservative");
  assert.equal(lookup("Phenethyl Alcohol").group, "preservative");
});

test("essential oils are checked before plant oils (citrus peel oil is scent)", () => {
  for (const n of ["Citrus Limon Peel Oil", "Citrus Aurantium Dulcis (Orange) Peel Oil", "Lavandula Angustifolia (Lavender) Oil", "Melaleuca Alternifolia (Tea Tree) Leaf Oil", "Eucalyptus Globulus Leaf Oil"]) {
    const e = lookup(n.replace(/\s*\([^)]*\)\s*/, " "));
    assert.ok(e && e.tags.includes("essential-oil"), n);
  }
  for (const n of ["Helianthus Annuus Seed Oil", "Coconut Oil", "Olive Oil", "Rosa Canina Fruit Oil", "Jojoba Oil"]) {
    const e = lookup(n);
    assert.equal(e.group, "moisturizer", n);
  }
});

test("preservatives by kind", () => {
  const kind = n => lookup(n).tags[0];
  assert.equal(kind("Phenoxyethanol"), "normal");
  assert.equal(kind("Methylparaben"), "paraben");
  assert.equal(kind("Methylisothiazolinone"), "isothiazolinone");
  assert.equal(kind("Methylchloroisothiazolinone"), "isothiazolinone");
  for (const n of ["DMDM Hydantoin", "Quaternium-15", "Imidazolidinyl Urea", "Diazolidinyl Urea", "Bronopol", "Sodium Hydroxymethylglycinate"]) assert.equal(kind(n), "formaldehyde", n);
});

test("sodium sulfate isn't a sulfate cleanser; behentrimonium methosulfate isn't either", () => {
  assert.notEqual(lookup("Sodium Sulfate").group, "cleanser");
  assert.ok(!lookup("Sodium Sulfate").tags.includes("sulfate"));
  assert.notEqual(lookup("Behentrimonium Methosulfate").group, "cleanser");
  assert.notEqual(lookup("Magnesium Sulfate").group, "cleanser");
});

test("dyes vs mineral pigments; titanium dioxide and iron oxides aren't dyes", () => {
  for (const n of ["CI 19140", "FD&C Blue No. 1", "Blue 1", "Red 33", "D&C Red No. 33", "Yellow 5 Lake"]) assert.equal(lookup(n).group, "dye", n);
  for (const n of ["Iron Oxides", "CI 77491", "Mica"]) assert.equal(lookup(n).group, "neutral", n);
  assert.equal(lookup("Titanium Dioxide").group, "uv-filter");
});

test("aluminum means antiperspirant salts only", () => {
  assert.equal(lookup("Aluminum Chlorohydrate").group, "aluminum");
  assert.equal(lookup("Aluminum Zirconium Tetrachlorohydrex Gly").group, "aluminum");
  for (const n of ["Aluminum Starch Octenylsuccinate", "Magnesium Aluminum Silicate", "Aluminum Hydroxide"]) assert.notEqual(lookup(n).group, "aluminum", n);
});

test("sunscreen filters, dandruff actives, barrier and volatile silicones", () => {
  assert.ok(lookup("Zinc Oxide").tags.includes("mineral"));
  assert.ok(lookup("Oxybenzone").tags.includes("oxybenzone"));
  assert.ok(lookup("Octinoxate").tags.includes("reef"));
  for (const n of ["Avobenzone", "Homosalate", "Octisalate", "Octocrylene"]) assert.ok(lookup(n).tags.includes("chemical"), n);
  for (const n of ["Pyrithione Zinc", "Ketoconazole", "Selenium Sulfide", "Piroctone Olamine", "Coal Tar"]) assert.equal(lookup(n).group, "dandruff", n);
  for (const n of ["Ceramide NP", "Cholesterol", "Phytosphingosine", "Colloidal Oatmeal", "Niacinamide"]) assert.ok(lookup(n).tags.includes("barrier"), n);
  assert.equal(lookup("Cyclomethicone").group, "neutral");
  assert.match(lookup("Cyclomethicone").note, /feel, not moisture/i);
});

test("vegan tags: beeswax yes, synthetic beeswax no, sodium stearate may", () => {
  assert.ok(lookup("Beeswax").tags.includes("animal"));
  assert.ok(!lookup("Synthetic Beeswax").tags.includes("animal"));
  assert.ok(lookup("Lanolin").tags.includes("animal"));
  assert.ok(lookup("Sodium Stearate").tags.includes("animal-may"));
  assert.ok(lookup("CI 75470").tags.includes("animal"));
});

test("every knowledge-base entry has a group, a known group name and a plain-English line", () => {
  const groups = new Set(["cleanser", "soap", "moisturizer", "conditioning", "scent", "preservative", "dye", "antibacterial", "drying-alcohol", "active", "aluminum", "uv-filter", "dandruff", "neutral"]);
  for (const [names, group, , note] of ENTRIES) {
    assert.ok(groups.has(group), names);
    assert.ok(note && note.length > 10, names);
  }
});
