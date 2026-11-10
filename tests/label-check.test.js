const test = require("node:test");
const assert = require("node:assert/strict");
const { extract, compare } = require("../scripts/check-labels.js");

test("label check reads the ingredient list from a store page and from a Shopify page", () => {
  const ahold = '<script>{&quot;ingredients&quot;:[0,&quot;Water, Glycerin, Fragrance (Parfum), Sodium Benzoate.&quot;],&quot;warnings&quot;:[0,&quot;&quot;]}</script>';
  assert.equal(extract(ahold), "Water, Glycerin, Fragrance (Parfum), Sodium Benzoate.");
  const shopify = '<div class="metafield-rich_text_field"><p>Active Ingredients:</p><p>9.0% Zinc oxide, 7.5% Octinoxate</p></div>' +
    '<div><p>Ingredient Insights :</p><p>Zinc Oxide: Natural mineral compound that reflects UVA and UVB rays</p></div>' +
    '<div class="metafield-rich_text_field"><p>Inactive Ingredients:</p><p>Purified Water, Niacinamide, Phenoxyethanol.</p></div><p>Free shipping</p>';
  assert.equal(extract(shopify), "Active Ingredients: 9.0% Zinc oxide, 7.5% Octinoxate. Inactive Ingredients: Purified Water, Niacinamide, Phenoxyethanol.");
  assert.equal(extract("<html><body>No list here</body></html>"), null);
});

test("label check compares ingredient by ingredient, ignoring spacing and punctuation", () => {
  assert.equal(compare("Water, Glycerin, Fragrance.", "Water ,Glycerin,  Fragrance").same, true);
  const c = compare("Water, Glycerin, Fragrance, Methylisothiazolinone", "Water, Glycerin, Fragrance, Phenoxyethanol");
  assert.equal(c.same, false);
  assert.deepEqual(c.added, ["phenoxyethanol"]);
  assert.deepEqual(c.removed, ["methylisothiazolinone"]);
  assert.equal(compare("Water, Glycerin, Fragrance", "Water, Fragrance, Glycerin").reordered, true);
});
