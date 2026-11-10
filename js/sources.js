// Open Beauty Facts lookups (free, CORS-enabled, no key). Every miss or failure is reported, never thrown, so the
// app can open the paste box instead of a dead end. US coverage is thin.
//
// BodySources.byBarcode(code) → { status: "found" | "no-ingredients" | "not-found" | "error", product?, message? }
// BodySources.search(terms)   → { status: "ok" | "error", products: [...], message? }
// product: { id, code, brand, name, category, ingredients, image, source, sourceUrl }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BodySources = factory();
})(/** @type {any} */ (typeof self !== "undefined" ? self : this), function () {
  const BASE = "https://world.openbeautyfacts.org";
  const FIELDS = "code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,categories_tags,image_front_small_url";
  const TIMEOUT_MS = 9000;

  async function getJSON(url, fetchImpl) {
    const f = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
    if (!f) throw new Error("no fetch");
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timer;
    const timeout = new Promise((_, fail) => { timer = setTimeout(() => { if (ctrl) ctrl.abort(); fail(Object.assign(new Error("timeout"), { name: "TimeoutError" })); }, TIMEOUT_MS); });
    try {
      const res = await Promise.race([f(url, { signal: ctrl ? ctrl.signal : undefined, headers: { Accept: "application/json" } }), timeout]);
      if (!res.ok && res.status !== 404) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally { clearTimeout(timer); }
  }

  // Our category from OBF category tags and the product name. Body wash when nothing fits; the user can change it.
  function guessCategory(tags, name) {
    const t = (Array.isArray(tags) ? tags.join(" ") : "") + " " + String(name || "").toLowerCase();
    if (/sun|spf|solaire/.test(t)) return "Sunscreen";
    const twoInOne = /2-in-1|2 in 1|shampoo-and-conditioner|shampoo (and|&) conditioner/.test(t);
    if (/conditioner|apres-shampooing|après-shampooing/.test(t) && !twoInOne) return "Conditioner";
    if (/shampoo/.test(t)) return "Shampoo";
    if (/deodorant|antiperspirant|anti-perspirant/.test(t)) return "Deodorant";
    if (/baby|bebe|bébé|infant/.test(t)) return /lotion|cream|creme|crème|balm/.test(t) ? "Baby lotion" : "Baby wash";
    if (/hand-soap|hand-wash|hand soap|hand wash/.test(t)) return "Hand soap";
    if (/shower|body-wash|body wash|douche/.test(t)) return "Body wash";
    if (/face-wash|facial-cleanser|cleanser|face wash/.test(t)) return "Face wash";
    if (/bar|solid-soap|soap/.test(t)) return "Bar soap";
    if (/petroleum|ointment|vaseline|balm/.test(t)) return "Ointment";
    if (/face|facial|day-cream|night-cream|moisturi[sz]er/.test(t)) return "Face moisturizer";
    if (/lotion/.test(t)) return "Lotion";
    if (/cream|creme|crème/.test(t)) return "Cream";
    return "Body wash";
  }

  function normalize(p) {
    if (!p) return null;
    const code = String(p.code || "");
    const name = (p.product_name_en || p.product_name || "").trim();
    const brand = String(p.brands || "").split(",")[0].trim();
    const ingredients = (p.ingredients_text_en || p.ingredients_text || "").trim();
    return {
      id: "obf:" + code, code, brand, name: name || (code ? "Product " + code : "Unnamed product"),
      category: guessCategory(p.categories_tags, name), ingredients, image: p.image_front_small_url || "",
      source: "Open Beauty Facts", sourceUrl: BASE + "/product/" + encodeURIComponent(code),
    };
  }

  async function byBarcode(code, fetchImpl) {
    const clean = String(code || "").replace(/\D/g, "");
    if (clean.length < 6) return { status: "not-found", message: "That doesn't look like a barcode." };
    try {
      const j = await getJSON(BASE + "/api/v2/product/" + clean + ".json?fields=" + FIELDS, fetchImpl);
      if (!j || j.status === 0 || !j.product) return { status: "not-found", code: clean };
      const product = normalize(Object.assign({ code: clean }, j.product));
      return { status: product.ingredients ? "found" : "no-ingredients", product, code: clean };
    } catch (e) {
      return { status: "error", code: clean, message: e && e.name === "TimeoutError" ? "Open Beauty Facts didn't answer in 9 seconds." : "Couldn't reach Open Beauty Facts." };
    }
  }

  async function search(terms, fetchImpl) {
    const q = String(terms || "").trim();
    if (!q) return { status: "ok", products: [] };
    try {
      const j = await getJSON(BASE + "/cgi/search.pl?action=process&search_simple=1&json=1&page_size=12&fields=" + FIELDS + "&search_terms=" + encodeURIComponent(q), fetchImpl);
      const products = ((j && j.products) || []).map(normalize).filter(p => p && p.code);
      return { status: "ok", products };
    } catch (e) {
      return { status: "error", products: [], message: e && e.name === "TimeoutError" ? "Open Beauty Facts didn't answer in 9 seconds." : "Couldn't reach Open Beauty Facts." };
    }
  }

  return { byBarcode, search, normalize, guessCategory, BASE, FIELDS, TIMEOUT_MS };
});
