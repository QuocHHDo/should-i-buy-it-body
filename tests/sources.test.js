const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/sources.js");

const ok = body => async () => ({ ok: true, status: 200, json: async () => body });

test("barcode lookup: found, no ingredients, not found, network error", async () => {
  const found = await S.byBarcode("3600523614455", ok({ status: 1, product: { product_name: "Gel douche", brands: "Brand A, Parent", ingredients_text: "Aqua, Sodium Laureth Sulfate", categories_tags: ["en:shower-gels"] } }));
  assert.equal(found.status, "found");
  assert.equal(found.product.brand, "Brand A");
  assert.equal(found.product.category, "Body wash");
  assert.equal(found.product.sourceUrl, "https://world.openbeautyfacts.org/product/3600523614455");
  const noIng = await S.byBarcode("012345678905", ok({ status: 1, product: { product_name: "Sunscreen SPF 30" } }));
  assert.equal(noIng.status, "no-ingredients");
  assert.equal(noIng.product.category, "Sunscreen");
  assert.equal((await S.byBarcode("012345678905", ok({ status: 0 }))).status, "not-found");
  assert.equal((await S.byBarcode("012345678905", async () => { throw new Error("offline"); })).status, "error");
  assert.equal((await S.byBarcode("12", ok({}))).status, "not-found");
});

test("search returns normalized products and reports failures", async () => {
  const r = await S.search("cerave", ok({ products: [{ code: "301871239012", product_name: "Moisturizing Cream", brands: "CeraVe", ingredients_text_en: "Aqua, Glycerin", categories_tags: ["en:body-creams"] }] }));
  assert.equal(r.status, "ok");
  assert.equal(r.products[0].name, "Moisturizing Cream");
  assert.equal(r.products[0].category, "Cream");
  assert.equal((await S.search("x", async () => { throw new Error("offline"); })).status, "error");
});

test("lookups use the documented endpoints, fields and a 9-second timeout", async () => {
  let seen = "";
  await S.byBarcode("012345678905", async url => { seen = url; return { ok: true, status: 200, json: async () => ({ status: 0 }) }; });
  assert.equal(seen, "https://world.openbeautyfacts.org/api/v2/product/012345678905.json?fields=code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,categories_tags,image_front_small_url");
  await S.search("dove soap", async url => { seen = url; return { ok: true, status: 200, json: async () => ({ products: [] }) }; });
  assert.match(seen, /\/cgi\/search\.pl\?action=process&search_simple=1&json=1&page_size=12&.*search_terms=dove%20soap$/);
  assert.equal(S.TIMEOUT_MS, 9000);
});

test("category guesses", () => {
  assert.equal(S.guessCategory(["en:shampoos"], ""), "Shampoo");
  assert.equal(S.guessCategory(["en:hair-conditioners"], ""), "Conditioner");
  assert.equal(S.guessCategory([], "Antiperspirant stick"), "Deodorant");
  assert.equal(S.guessCategory([], "Baby lotion"), "Baby lotion");
  assert.equal(S.guessCategory([], "Petroleum jelly"), "Ointment");
  assert.equal(S.guessCategory([], "Something"), "Body wash");
});
