const test = require("node:test");
const assert = require("node:assert/strict");
const { parse } = require("../js/ingredients.js");
const V = require("../js/verdict.js");
const { PRODUCTS, byId } = require("../js/products.js");

test("every built-in parses completely with zero unknown ingredients", () => {
  for (const p of PRODUCTS) {
    const r = parse(p.ingredients);
    assert.deepEqual(r.unknown, [], p.id + " unknown: " + r.unknown.join(", "));
    assert.deepEqual(r.incomplete, [], p.id + " incomplete");
  }
});

test("every built-in has an https source URL, a source name and a valid checked date", () => {
  for (const p of PRODUCTS) {
    assert.match(p.sourceUrl, /^https:\/\/[^\s]+$/, p.id);
    assert.ok(p.source && p.source.length > 2, p.id);
    assert.match(p.checked, /^\d{4}-\d{2}-\d{2}$/, p.id);
    const d = new Date(p.checked + "T00:00:00Z");
    assert.ok(!isNaN(d) && d.toISOString().slice(0, 10) === p.checked, p.id + " date");
  }
});

test("ids are unique, categories are known, and nothing is a made-up example", () => {
  const ids = PRODUCTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of PRODUCTS) {
    assert.ok(V.CATEGORIES[p.category], p.id + " category " + p.category);
    assert.ok(!/example/i.test(p.name + " " + p.brand), p.id);
  }
});

test("the four products verified on 2026-11-09 are kept with their sources", () => {
  const expect = [
    ["head-shoulders-classic-clean", "Stop & Shop"],
    ["pantene-daily-moisture-2in1", "Food Lion"],
    ["eltamd-uv-clear-spf46", "Advanced Dermatology shop"],
    ["johnsons-head-to-toe", "Hannaford"],
  ];
  for (const [id, source] of expect) {
    const p = byId(id);
    assert.ok(p, id);
    assert.equal(p.source, source);
    assert.equal(p.checked, "2026-11-09");
  }
});

test("coverage: every product type the app promises has at least one verified product", () => {
  const cats = new Set(PRODUCTS.map(p => p.category));
  for (const c of ["Bar soap", "Body wash", "Hand soap", "Shampoo", "Conditioner", "Face wash", "Face moisturizer", "Sunscreen", "Baby wash", "Baby lotion", "Lotion", "Cream", "Ointment", "Deodorant"]) assert.ok(cats.has(c), c);
  const sun = PRODUCTS.filter(p => p.category === "Sunscreen").map(p => V.evaluate(p, {}).glance.filters);
  assert.ok(sun.some(f => f.mineral.length && !f.chemical.length), "a mineral-only sunscreen");
  assert.ok(sun.some(f => f.chemical.length && !f.mineral.length), "a chemical sunscreen");
  const deo = PRODUCTS.filter(p => p.category === "Deodorant").map(p => V.evaluate(p, {}));
  assert.ok(deo.some(r => r.items.some(i => i.entry.group === "aluminum")), "an antiperspirant");
  assert.ok(deo.some(r => !r.items.some(i => i.entry.group === "aluminum")), "an aluminum-free deodorant");
});
