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

test("a looked-up product is matched to a label-checked built-in only when brand and distinctive words agree", () => {
  const { PRODUCTS } = require("../js/products.js");
  const m = (name, brand) => { const r = S.matchBuiltin({ name, brand }, PRODUCTS); return r && r.id; };
  assert.equal(m("Head & Shoulders Classic Clean", "Procter & Gamble, Head & Shoulders"), "head-shoulders-classic-clean");
  assert.equal(m("Classic Clean 2in1 Shampoo + Conditioner", "Head & Shoulders"), null);   // a different product
  assert.equal(m("Pro-V Daily Moisture Renewal 2 in 1", "Pantene"), "pantene-daily-moisture-2in1");
  assert.equal(m("Pro-V Daily Moisture Renewal Shampoo", "Pantene"), null);              // we don't have the plain shampoo
  assert.equal(m("Ultra Sheer Dry-Touch Sunscreen SPF 70", "Neutrogena"), null);         // different SPF, different formula
  assert.equal(m("Hydro Boost Fragrance Free Gel Cream", "Neutrogena"), "neutrogena-hydro-boost-fragrance-free");
  assert.equal(m("Hydro Boost Water Gel", "Neutrogena"), "neutrogena-hydro-boost-water-gel");
  assert.equal(m("Deodorant Cucumber & Mint", "Native"), null);                          // different scent
  assert.equal(m("Moisturizing Cream for Normal to Dry Skin", "CeraVe"), "cerave-moisturizing-cream");
  assert.equal(m("Baby Moisturizing Cream", "CeraVe"), null);
  assert.equal(m("Bedtime Baby Lotion", "Johnson's"), null);                              // a different lotion
  assert.equal(m("Baby Lotion 500 ml", "Johnson's"), "johnsons-baby-lotion");
  assert.equal(m("Moisturizing Cream", "Some Other Brand"), null);
});

test("built-in barcodes match UPC-A and EAN-13 forms of the same code", () => {
  const catalog = [{ id: "x", barcodes: ["037000862246"] }];
  assert.equal(S.builtinByBarcode("0037000862246", catalog).id, "x");
  assert.equal(S.builtinByBarcode("37000862246", catalog).id, "x");
  assert.equal(S.builtinByBarcode("037000862247", catalog), null);
});

test("category guesses", () => {
  assert.equal(S.guessCategory(["en:shampoos"], ""), "Shampoo");
  assert.equal(S.guessCategory(["en:hair-conditioners"], ""), "Conditioner");
  assert.equal(S.guessCategory([], "Antiperspirant stick"), "Deodorant");
  assert.equal(S.guessCategory([], "Baby lotion"), "Baby lotion");
  assert.equal(S.guessCategory([], "Petroleum jelly"), "Ointment");
  assert.equal(S.guessCategory([], "Something"), "Body wash");
});
