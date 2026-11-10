// Ingredient knowledge base and ingredient-list parser for Should I Buy It? Body Care.
// Pure functions, no network, no randomness: the same list always parses the same way.
//
// BodyIngredients.parse(text) → { items, positions, hasActives, hasInactives, hasHundred, incomplete, unknown }
//   items: [{ name, raw, entry, pos, rank, active, pct, may, alt, sub }] in label order
//     pos  — position on the label (sublists and "A or B" alternatives share one)
//     rank — position among the inactive ingredients (Drug Facts actives get 0, i.e. "top")
//   incomplete: [] or reasons ("truncated", "actives-only", "too-short", "empty")
// BodyIngredients.lookup(name) → entry or null
//   entry: { id, name, group, tags: [...], note }
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.BodyIngredients = factory();
})(/** @type {any} */ (typeof self !== "undefined" ? self : this), function () {
  // ---------- normalization ----------
  // Lowercase, no accents or periods, hyphens as spaces: "D&C Green No. 8" → "d&c green no 8", "PEG-100" → "peg 100".
  function key(s) {
    return String(s || "").toLowerCase()
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[®™©*†‡^°#!]/g, "")
      .replace(/\bhci\b/g, "hcl")
      .replace(/(\d),\s+(\d)/g, "$1,$2")
      .replace(/[‐-―−]/g, "-")
      .replace(/[’‘`]/g, "'")
      .replace(/\./g, "")
      .replace(/-/g, " ")
      .replace(/\s*\/\s*/g, "/")
      .replace(/\s*&\s*/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }
  const slug = s => key(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---------- groups ----------
  const GROUPS = {
    cleanser: "Cleanser", soap: "True soap", moisturizer: "Moisturizer", conditioning: "Conditioning agent",
    scent: "Scent", preservative: "Preservative", dye: "Dye", antibacterial: "Antibacterial",
    "drying-alcohol": "Drying alcohol", active: "Exfoliant / acne active", aluminum: "Antiperspirant (aluminum)",
    "uv-filter": "Sunscreen filter", dandruff: "Dandruff active", neutral: "Common ingredient",
  };

  // ---------- knowledge base ----------
  // [aliases separated by |, group, tags separated by spaces, plain-English line]
  const ENTRIES = [
    // Cleansers: harsh
    ["sodium lauryl sulfate|sls|sodium dodecyl sulfate|sodium laurel sulfate","cleanser", "harsh sulfate", "A strong detergent (SLS). Lathers well but strips skin oils; the most irritating common cleanser."],
    ["ammonium lauryl sulfate|als", "cleanser", "harsh sulfate", "A strong sulfate detergent, close to SLS in how much it strips."],
    ["sodium coco sulfate|sodium coco-sulfate|sodium cocosulfate", "cleanser", "harsh sulfate", "Coconut-derived, but mostly SLS: a strong sulfate detergent."],
    ["tea lauryl sulfate|triethanolamine lauryl sulfate|potassium lauryl sulfate|mea lauryl sulfate", "cleanser", "harsh sulfate", "A lauryl sulfate detergent, similar to SLS."],
    // Cleansers: moderate
    ["sodium laureth sulfate|sles|sodium lauryl ether sulfate", "cleanser", "moderate sulfate", "A sulfate detergent (SLES), milder than SLS but still stripping for dry skin."],
    ["ammonium laureth sulfate", "cleanser", "moderate sulfate", "A sulfate detergent, milder than lauryl sulfates."],
    ["sodium c14 16 olefin sulfonate|sodium olefin sulfonate", "cleanser", "moderate", "A strong-lathering detergent. Not a sulfate, but about as stripping as SLES."],
    ["sodium dodecylbenzenesulfonate|tea dodecylbenzenesulfonate|sodium laurylbenzenesulfonate", "cleanser", "moderate", "A strong synthetic detergent, usually used in small amounts."],
    // Cleansers: gentle
    ["sodium isethionate", "neutral", "salt", "A salt left from making isethionate cleansers; helps the bar hold together."],
    ["cocamidopropyl betaine|capb", "cleanser", "gentle", "A mild coconut-derived cleanser that softens harsher ones. Rarely irritating."],
    ["lauramidopropyl betaine|coco betaine|lauryl betaine", "cleanser", "gentle", "A mild betaine cleanser."],
    ["cocamidopropyl hydroxysultaine|lauryl hydroxysultaine", "cleanser", "gentle", "A mild sultaine cleanser, gentle on skin and eyes."],
    ["sodium cocoyl isethionate|sodium lauroyl isethionate|sodium lauroyl methyl isethionate", "cleanser", "gentle", "A mild cleanser used in syndet bars like Dove. Cleans without the alkalinity of soap."],
    ["decyl glucoside|coco glucoside|lauryl glucoside|caprylyl/capryl glucoside|caprylyl capryl glucoside", "cleanser", "gentle", "A sugar-based cleanser, one of the mildest."],
    ["sodium lauryl glucose carboxylate|sodium lauryl glucose caboxylate", "cleanser", "gentle", "A mild sugar-based cleanser."],
    ["sodium lauroyl sarcosinate|sodium cocoyl sarcosinate", "cleanser", "gentle", "A mild amino-acid cleanser."],
    ["sodium methyl cocoyl taurate|sodium methyl lauroyl taurate|sodium cocoyl taurate", "cleanser", "gentle", "A mild taurate cleanser."],
    ["sodium lauroyl glutamate|sodium cocoyl glutamate|disodium cocoyl glutamate", "cleanser", "gentle", "A mild amino-acid cleanser."],
    ["sodium cocoyl glycinate|potassium cocoyl glycinate", "cleanser", "gentle", "A mild amino-acid cleanser."],
    ["disodium laureth sulfosuccinate|disodium lauryl sulfosuccinate|diethylhexyl sodium sulfosuccinate|disodium cocoyl sulfosuccinate", "cleanser", "gentle", "A mild cleanser. Despite the name, a sulfosuccinate is not a sulfate."],
    ["sodium lauryl sulfoacetate", "cleanser", "gentle", "A milder alternative to sulfates."],
    ["sodium cocoamphoacetate|sodium lauroamphoacetate|disodium cocoamphodiacetate|disodium lauroamphodiacetate", "cleanser", "gentle", "A very mild amphoteric cleanser, common in baby washes."],
    ["lauramine oxide|lauramidopropylamine oxide|myristamidopropylamine oxide|cocamidopropylamine oxide", "cleanser", "gentle", "A mild foaming cleanser."],
    // True soap
    ["sodium tallowate", "soap", "animal", "Soap made from beef fat (tallow). Alkaline, so it can dry skin."],
    ["sodium lardate|sodium beefate", "soap", "animal", "Soap made from animal fat. Alkaline, so it can dry skin."],
    ["sodium stearate", "soap", "animal-may", "A soap; used to make bars and deodorant sticks firm. Can be plant or animal derived."],
    ["sodium palmate|sodium palm kernelate|sodium cocoate|sodium olivate|sodium oleate|sodium laurate|sodium myristate|sodium palmitate|sodium castorate|sodium sunflowerate|sodium shea butterate|sodium babassuate|sodium ricinoleate|sodium hempseedate|sodium soyate|sodium canolate|sodium rapeseedate|sodium avocadoate|potassium cocoate|potassium oleate|potassium palmate|potassium olivate|potassium laurate|potassium myristate|potassium stearate|potassium castorate|potassium sunflowerate", "soap", "", "True soap: oil reacted with lye. Alkaline (pH 9–10), so it can leave dry skin tight."],
    // Moisturizers: humectants
    ["glycerin|glycerine|glycerol", "moisturizer", "humectant", "A humectant: draws water into the top layer of skin. One of the best-proven moisturizers."],
    ["panthenol|d panthenol|dl panthenol|provitamin b5|pro vitamin b5|vitamin b5", "moisturizer", "humectant conditioning", "Provitamin B5. Holds moisture and soothes; also softens hair."],
    ["panthenyl ethyl ether", "moisturizer", "humectant conditioning", "A form of provitamin B5 that holds moisture in skin and hair."],
    ["sodium hyaluronate|hyaluronic acid|hydrolyzed hyaluronic acid|sodium hyaluronate crosspolymer", "moisturizer", "humectant", "Hyaluronic acid: holds water in the skin's surface."],
    ["urea|hydroxyethyl urea", "moisturizer", "humectant", "A humectant that also softens rough, scaly skin."],
    ["sodium pca|pca", "moisturizer", "humectant", "Part of skin's own natural moisturizing factor."],
    ["sodium lactate", "moisturizer", "humectant", "A humectant related to skin's natural moisturizing factor."],
    ["sorbitol|glyceryl glucoside|inositol|saccharide isomerate|polyglutamic acid|sodium polyglutamate", "moisturizer", "humectant", "A humectant that holds water in skin."],
    ["betaine|trimethylglycine", "moisturizer", "humectant", "A humectant from sugar beets (not the betaine cleansers)."],
    ["serine|glycine|alanine|threonine|arginine|proline|lysine|lysine hcl|glutamic acid|histidine|leucine|valine|aspartic acid", "moisturizer", "humectant", "An amino acid, part of skin's natural moisturizing factor."],
    ["fructose|glucose|maltose|trehalose|sucrose|xylitol", "moisturizer", "humectant", "A sugar used as a humectant."],
    ["honey|mel", "moisturizer", "humectant animal", "A humectant. Made by bees, so not vegan."],
    ["sodium chondroitin sulfate", "moisturizer", "humectant", "A humectant."],
    // Moisturizers: emollients and occlusives
    ["petrolatum|white petrolatum|petroleum jelly|vaseline", "moisturizer", "emollient occlusive", "Seals water in. The most effective occlusive known; won't clog pores when pure."],
    ["mineral oil|paraffinum liquidum|white mineral oil|liquid paraffin", "moisturizer", "emollient occlusive", "A light occlusive oil that slows water loss. Very low allergy risk."],
    ["ceresin|paraffin|microcrystalline wax|ozokerite", "moisturizer", "emollient occlusive", "A mineral wax that seals moisture in and thickens balms."],
    ["lanolin|lanolin wax|anhydrous lanolin", "moisturizer", "emollient occlusive animal pore", "Wool grease. A strong occlusive, but an allergen for a few people and not vegan."],
    ["lanolin alcohol|lanolin alcohols|acetylated lanolin alcohol", "moisturizer", "emollient occlusive animal pore", "Part of lanolin (wool grease). Seals moisture; a known allergen for a few people; not vegan."],
    ["lanolin oil", "moisturizer", "emollient animal pore", "The oily part of lanolin. Softens skin; not vegan."],
    ["beeswax|cera alba|cera flava|white beeswax|yellow beeswax", "moisturizer", "emollient occlusive animal", "Wax from bees. Thickens and seals moisture; not vegan."],
    ["synthetic beeswax", "moisturizer", "emollient occlusive", "A lab-made wax that mimics beeswax. Not from bees."],
    ["dimethicone|dimethicone fluid", "moisturizer", "emollient occlusive conditioning", "A silicone that smooths skin and hair and slows water loss. Non-irritating."],
    ["dimethiconol|phenyl trimethicone|caprylyl methicone|ethyl methicone|cetyl dimethicone|stearyl dimethicone|cetearyl methicone", "moisturizer", "emollient conditioning", "A silicone that gives slip and a smooth, non-greasy feel."],
    ["amodimethicone|bis aminopropyl dimethicone|aminopropyl dimethicone", "conditioning", "conditioning", "A silicone that clings to damaged hair to smooth and detangle it."],
    ["caprylic/capric triglyceride|caprylic capric triglyceride|capric/caprylic triglyceride|fractionated coconut oil", "moisturizer", "emollient", "A light oil from coconut. Softens skin; not comedogenic like whole coconut oil."],
    ["isopropyl myristate", "moisturizer", "emollient pore", "A light, fast-absorbing emollient. Rated comedogenic in old rabbit-ear tests; real-world evidence is mixed."],
    ["isopropyl palmitate", "moisturizer", "emollient pore", "A light emollient. Rated comedogenic in old rabbit-ear tests; real-world evidence is mixed."],
    ["c12 15 alkyl benzoate|octyldodecyl neopentanoate|dicaprylyl ether|dicaprylyl carbonate|ethylhexyl stearate|ethylhexyl palmitate|cetyl esters|isononyl isononanoate|isocetyl stearoyl stearate|coco caprylate|coco caprylate/caprate|isodecyl neopentanoate|isohexadecane|diisopropyl adipate|c12 15 alkyl lactate|cetyl ethylhexanoate|cetearyl ethylhexanoate|propylheptyl caprylate|isostearyl isostearate|myristyl myristate|decyl oleate|ethylhexyl isononanoate|neopentyl glycol diheptanoate|triheptanoin", "moisturizer", "emollient", "An emollient ester: makes skin feel soft and smooth."],
    ["butyloctyl salicylate", "moisturizer", "emollient", "An emollient that helps sunscreen filters spread evenly. Not a UV filter itself."],
    ["squalane|polyisobutene|hydrogenated polyisobutene|hydrogenated polydecene", "moisturizer", "emollient", "A lightweight, stable emollient oil."],
    ["stearyl behenate|tribehenin|glyceryl dilaurate|hydrogenated vegetable glycerides|cetyl palmitate|hydrogenated castor oil|castor wax|hydrogenated coco glycerides|hydrogenated rapeseed oil|c10 18 triglycerides", "moisturizer", "emollient", "A waxy emollient that softens skin and gives sticks and creams body."],
    ["jojoba esters|hydrolyzed jojoba esters|hydrogenated jojoba oil|jojoba wax|simmondsia chinensis seed wax", "moisturizer", "emollient", "From jojoba: a wax-like emollient similar to skin's own oils."],
    ["hydrogenated soybean oil|hydrogenated vegetable oil", "moisturizer", "emollient", "A plant oil made solid. Softens skin."],
    ["shea butter|butyrospermum parkii butter|butyrospermum parkii (shea) butter|butyrospermum parkii (shea butter)|shea butter extract", "moisturizer", "emollient occlusive", "A rich plant butter that softens and seals in moisture."],
    ["cocoa butter|theobroma cacao seed butter|theobroma cacao butter|cocoa seed butter", "moisturizer", "emollient occlusive pore", "A rich plant butter. Rated comedogenic in old tests; evidence is mixed."],
    ["coconut oil|cocos nucifera oil|cocos nucifera fruit oil|cocos nucifera (coconut) oil", "moisturizer", "emollient pore", "Softens skin and has some antibacterial effect, but it is rated comedogenic: can clog pores on acne-prone faces."],
    ["sunflower seed oil|helianthus annuus seed oil|helianthus annuus oil", "moisturizer", "emollient", "A light plant oil rich in linoleic acid; supports the skin barrier."],
    ["soybean oil|glycine soja oil|glycine soja seed oil", "moisturizer", "emollient", "A plant oil that softens skin."],
    ["olive oil|olea europaea fruit oil|olea europaea oil", "moisturizer", "emollient", "A plant oil that softens skin. Heavy use can weaken the barrier on eczema-prone skin."],
    ["sweet almond oil|prunus amygdalus dulcis oil|almond oil", "moisturizer", "emollient", "A gentle plant oil that softens skin. Avoid with a tree-nut allergy."],
    ["avocado oil|persea gratissima oil", "moisturizer", "emollient", "A rich plant oil that softens skin."],
    ["jojoba oil|simmondsia chinensis seed oil|simmondsia chinensis oil", "moisturizer", "emollient", "A liquid wax similar to skin's own oils."],
    ["hemp seed oil|cannabis sativa seed oil", "moisturizer", "emollient", "A light plant oil."],
    ["palm oil|elaeis guineensis oil|palm kernel oil|elaeis guineensis kernel oil", "moisturizer", "emollient", "A plant oil. In soap labels it is reacted with lye to make the soap."],
    ["castor oil|ricinus communis seed oil|ricinus communis oil", "moisturizer", "emollient", "A thick plant oil."],
    ["rice bran wax|oryza sativa bran wax|oryza sativa (rice) bran wax|candelilla wax|euphorbia cerifera wax|carnauba wax|copernicia cerifera wax", "moisturizer", "emollient occlusive", "A plant wax that gives sticks and balms their firmness."],
    ["cetyl alcohol|stearyl alcohol|cetearyl alcohol|behenyl alcohol|myristyl alcohol|arachidyl alcohol|lauryl alcohol|oleyl alcohol|isostearyl alcohol|c12 16 alcohols|c14 22 alcohols|octyldodecanol", "moisturizer", "emollient fatty-alcohol", "A fatty alcohol: a waxy emollient that thickens and softens. Not drying, unlike “alcohol”."],
    ["stearic acid|palmitic acid|lauric acid|myristic acid|oleic acid|linoleic acid|behenic acid|isostearic acid|hydroxystearic acid|palm kernel acid|coconut acid|capric acid|caprylic acid", "moisturizer", "emollient fatty-acid", "A fatty acid, like those in skin's own oils. Softens and thickens."],
    ["glyceryl stearate|glyceryl stearate se|glycerol stearate|glyceryl oleate|glyceryl behenate|glyceryl laurate|glyceryl monostearate", "neutral", "emulsifier", "An emulsifier from glycerin and fatty acids that keeps oil and water mixed; also softens."],
    // Moisturizers: barrier
    ["cholesterol", "moisturizer", "barrier", "A lipid the skin barrier is made of; helps repair it."],
    ["phytosphingosine|sphingosine", "moisturizer", "barrier", "A building block of ceramides; supports the barrier."],
    ["colloidal oatmeal|avena sativa kernel flour|avena sativa (oat) kernel flour|oat kernel flour|avena sativa meal|oat flour", "moisturizer", "barrier", "Colloidal oatmeal. FDA-recognized skin protectant that calms itch and dryness."],
    ["niacinamide|nicotinamide|vitamin b3", "moisturizer", "barrier", "Vitamin B3. Helps the skin make ceramides and calms redness."],
    // Conditioning
    ["behentrimonium chloride|behentrimonium methosulfate|cetrimonium chloride|cetrimonium bromide|steartrimonium chloride|distearyldimonium chloride|dicetyldimonium chloride|stearamidopropyl dimethylamine|brassicamidopropyl dimethylamine|behenamidopropyl dimethylamine", "conditioning", "conditioning", "A conditioning agent: clings to hair (or skin) to soften and detangle."],
    ["guar hydroxypropyltrimonium chloride|hydroxypropyl guar hydroxypropyltrimonium chloride|cassia hydroxypropyltrimonium chloride", "conditioning", "conditioning", "A plant-based conditioner that reduces tangles and static."],
    ["acetamidopropyl trimonium chloride|linoleamidopropyl pg dimonium chloride phosphate|cocamidopropyl pg dimonium chloride phosphate|peg 3 dioleoylamidoethylmonium methosulfate|quaternium 80|quaternium 91|quaternium 87", "conditioning", "conditioning", "A conditioning agent that softens hair and skin."],
    ["hydrolyzed soy protein|hydrolyzed wheat protein|hydrolyzed rice protein|hydrolyzed oat protein|hydrolyzed vegetable protein|hydrolyzed pea protein|hydrolyzed quinoa", "conditioning", "conditioning", "Broken-down plant protein that coats and strengthens hair."],
    ["hydrolyzed keratin|keratin|hydrolyzed silk|silk amino acids|hydrolyzed collagen|collagen|hydrolyzed milk protein", "conditioning", "conditioning animal", "An animal protein that coats hair. Not vegan."],
    // Scent
    ["fragrance|parfum|perfume|aroma|flavor|scent|fragrances", "scent", "fragrance", "A blend of scent chemicals (the recipe is a trade secret). The most common cause of cosmetic skin allergy."],
    ["natural fragrance|essential oil blend|essential oils|essential oil", "scent", "essential-oil", "Plant scent oils. Natural, but just as able to irritate sensitive skin as fragrance."],
    // EU-26 fragrance allergens (benzyl alcohol is counted as a preservative here)
    ["limonene|d limonene", "scent", "allergen", "A citrus scent chemical, one of the 26 EU-labeled fragrance allergens (mostly when it oxidizes)."],
    ["linalool", "scent", "allergen", "A floral scent chemical (lavender), one of the 26 EU-labeled fragrance allergens."],
    ["citronellol", "scent", "allergen", "A rose-like scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["geraniol", "scent", "allergen", "A rose/geranium scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["citral", "scent", "allergen", "A lemony scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["coumarin", "scent", "allergen", "A sweet, hay-like scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["eugenol", "scent", "allergen", "A clove scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["isoeugenol", "scent", "allergen", "A clove-like scent chemical, one of the stronger EU-labeled fragrance allergens."],
    ["hexyl cinnamal|hexyl cinnamic aldehyde", "scent", "allergen", "A jasmine-like scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["amyl cinnamal|amylcinnamyl alcohol|amyl cinnamyl alcohol", "scent", "allergen", "A jasmine-like scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["cinnamal|cinnamyl alcohol", "scent", "allergen", "A cinnamon scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["benzyl salicylate|benzyl benzoate|benzyl cinnamate", "scent", "allergen", "A balsamic scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["alpha isomethyl ionone|alpha isometh ionone|alpha iso methyl ionone", "scent", "allergen", "A violet-like scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["hydroxycitronellal", "scent", "allergen", "A floral scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["hydroxyisohexyl 3 cyclohexene carboxaldehyde|lyral", "scent", "allergen", "A floral scent chemical (Lyral), a strong allergen now banned in the EU."],
    ["butylphenyl methylpropional|lilial", "scent", "allergen", "A floral scent chemical (Lilial), now banned in the EU."],
    ["farnesol", "scent", "allergen", "A floral scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["anise alcohol|anisyl alcohol", "scent", "allergen", "A sweet scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["methyl 2 octynoate|methyl heptine carbonate", "scent", "allergen", "A green scent chemical, one of the 26 EU-labeled fragrance allergens."],
    ["evernia prunastri extract|oakmoss extract|evernia furfuracea extract|treemoss extract", "scent", "allergen", "Moss extract used in perfume, one of the strongest EU-labeled fragrance allergens."],
    ["linalyl acetate|vanillin|ethyl vanillin|methyl ionone|menthol|camphor", "scent", "fragrance", "A scent or cooling ingredient. Can sting sensitive skin."],
    ["mentha arvensis|mentha piperita|mentha viridis|mentha spicata", "scent", "essential-oil", "Mint essential oil (as Dr. Bronner's labels it). Tingly; can irritate sensitive skin."],
    // Preservatives
    ["phenoxyethanol", "preservative", "normal", "A common, well-tolerated preservative that keeps the product free of mold and bacteria."],
    ["sodium benzoate|potassium benzoate|benzoic acid", "preservative", "normal", "A mild preservative (also used in food)."],
    ["potassium sorbate|sorbic acid", "preservative", "normal", "A mild preservative (also used in food)."],
    ["benzyl alcohol", "preservative", "normal", "A preservative, not a drying alcohol. Also on the EU fragrance-allergen list, but rarely a problem at preservative levels."],
    ["phenethyl alcohol|phenylethyl alcohol", "preservative", "normal", "A gentle preservative with a faint rose smell. Not a drying alcohol."],
    ["chlorphenesin", "preservative", "normal", "A common preservative."],
    ["ethylhexylglycerin|caprylyl glycol|1,2 hexanediol|pentylene glycol|glyceryl caprylate|glyceryl caprylate/caprate|glyceryl caprate|hydroxyacetophenone|caprylhydroxamic acid|p anisic acid|sodium anisate|sodium levulinate|levulinic acid|gluconolactone|sodium salicylate|dehydroacetic acid|sodium dehydroacetate|ethylhexylglycerine", "preservative", "normal", "A preservative or preservative booster; lets products use less of the stronger preservatives."],
    ["iodopropynyl butylcarbamate|ipbc", "preservative", "normal", "A preservative. An occasional allergen; fine for most people."],
    ["methylparaben|propylparaben|ethylparaben|butylparaben|isobutylparaben|isopropylparaben|parabens", "preservative", "paraben", "A paraben preservative. Very low allergy rate; the hormone concern is weak at cosmetic levels."],
    ["methylisothiazolinone|mit", "preservative", "isothiazolinone", "MIT: a preservative that became a leading cause of skin allergy. Banned in EU leave-on products."],
    ["methylchloroisothiazolinone|mci|methylchloroisothiazolinone/methylisothiazolinone|kathon cg", "preservative", "isothiazolinone", "MCI: a strong allergen preservative, usually paired with MIT."],
    ["benzisothiazolinone|octylisothiazolinone|bit", "preservative", "isothiazolinone", "An isothiazolinone preservative, related to the allergen MIT."],
    ["dmdm hydantoin", "preservative", "formaldehyde", "A formaldehyde releaser: preserves by slowly giving off formaldehyde, a common skin allergen."],
    ["quaternium 15", "preservative", "formaldehyde", "A formaldehyde releaser and a common skin allergen."],
    ["imidazolidinyl urea|diazolidinyl urea", "preservative", "formaldehyde", "A formaldehyde releaser and a common skin allergen."],
    ["2 bromo 2 nitropropane 1,3 diol|bronopol", "preservative", "formaldehyde", "Bronopol, a formaldehyde releaser."],
    ["sodium hydroxymethylglycinate", "preservative", "formaldehyde", "A formaldehyde releaser."],
    // Antibacterials
    ["triclosan", "antibacterial", "", "An antibacterial the FDA banned from consumer soaps in 2016: no better than plain soap."],
    ["triclocarban", "antibacterial", "", "An antibacterial the FDA banned from consumer soaps in 2016."],
    ["benzalkonium chloride", "antibacterial", "", "An antibacterial. FDA: antibacterial soap is no better than plain soap and water for everyday use."],
    ["benzethonium chloride", "antibacterial", "", "An antibacterial, common in hand sanitizer."],
    ["chloroxylenol|pcmx", "antibacterial", "", "An antibacterial (the one in Dettol). Can irritate with frequent use."],
    // Drying alcohols (exact names only)
    ["alcohol|alcohol denat|denatured alcohol|sd alcohol|sd alcohol 40|sd alcohol 40 b|sd alcohol 40b|sd alcohol 39 c|ethanol|ethyl alcohol|isopropyl alcohol|isopropanol", "drying-alcohol", "", "Drying alcohol. Evaporates fast and feels light, but high up a leave-on list it can dry and sting."],
    // Exfoliants / acne actives
    ["salicylic acid|beta hydroxy acid", "active", "acne exfoliant", "Salicylic acid (BHA): unclogs pores. An FDA-approved acne active."],
    ["benzoyl peroxide", "active", "acne", "Kills acne bacteria. FDA-approved acne active; can dry skin and bleach fabric."],
    ["sulfur", "active", "acne dandruff", "A mild acne and dandruff active."],
    ["glycolic acid", "active", "aha exfoliant", "Glycolic acid (AHA): exfoliates. Can sting sensitive skin high on a list."],
    ["lactic acid", "active", "aha exfoliant", "Lactic acid (AHA): a gentle exfoliant and humectant. Low on a list it just adjusts pH."],
    ["mandelic acid|malic acid|tartaric acid", "active", "aha exfoliant", "An AHA exfoliant."],
    // Aluminum (antiperspirant salts only)
    ["aluminum chlorohydrate|aluminium chlorohydrate|aluminum sesquichlorohydrate|aluminum chloride|aluminum zirconium tetrachlorohydrex gly|aluminum zirconium tetrachlorohydex gly|aluminum zirconium trichlorohydrex gly|aluminum zirconium pentachlorohydrex gly|aluminum zirconium octachlorohydrex gly", "aluminum", "", "The antiperspirant active: plugs sweat ducts for a while. Major reviews have not linked it to breast cancer or Alzheimer's."],
    // Sunscreen filters
    ["zinc oxide|ci 77947", "uv-filter", "mineral", "A mineral UV filter that covers UVA and UVB. The gentlest option for sensitive skin."],
    ["titanium dioxide|ci 77891", "uv-filter", "mineral pigment", "A white mineral. In sunscreen it is a UV filter; elsewhere it is just a white pigment."],
    ["avobenzone|butyl methoxydibenzoylmethane", "uv-filter", "chemical", "A chemical UVA filter. Rarely irritating."],
    ["homosalate", "uv-filter", "chemical", "A chemical UVB filter. Under FDA review for more safety data."],
    ["octisalate|ethylhexyl salicylate", "uv-filter", "chemical", "A chemical UVB filter."],
    ["octocrylene", "uv-filter", "chemical", "A chemical UVB filter that stabilizes avobenzone. An occasional allergen."],
    ["octinoxate|ethylhexyl methoxycinnamate|octyl methoxycinnamate", "uv-filter", "chemical reef", "A chemical UVB filter. Banned in Hawaii (with oxybenzone) over coral reef concerns."],
    ["oxybenzone|benzophenone 3", "uv-filter", "chemical oxybenzone reef", "A chemical filter with the highest allergy rate of the US filters; absorbed into the body; banned in Hawaii."],
    ["ensulizole|phenylbenzimidazole sulfonic acid|sulisobenzone|benzophenone 4|ecamsule|meradimate|padimate o|dioxybenzone|bemotrizinol|bisoctrizole|ethylhexyl triazone|diethylamino hydroxybenzoyl hexyl benzoate|bis ethylhexyloxyphenol methoxyphenyl triazine|drometrizole trisiloxane", "uv-filter", "chemical", "A chemical UV filter."],
    ["ethylhexyl methoxycrylene", "neutral", "photostabilizer", "Keeps avobenzone from breaking down in sunlight. Not a UV filter itself."],
    // Dandruff actives
    ["pyrithione zinc|zinc pyrithione", "dandruff", "", "Pyrithione zinc: FDA-approved dandruff active that calms the yeast behind flakes."],
    ["ketoconazole", "dandruff", "", "An antifungal dandruff active."],
    ["selenium sulfide", "dandruff", "", "A strong dandruff active. Can leave a smell and discolor treated hair."],
    ["piroctone olamine", "dandruff", "", "An anti-dandruff and odor-fighting ingredient; also a preservative."],
    ["coal tar", "dandruff", "", "A dandruff and psoriasis active. Smells; can make skin sun-sensitive."],
    ["climbazole", "dandruff", "", "An antifungal dandruff active."],
    // Things that are notes only
    ["talc", "neutral", "talc", "A mineral powder that absorbs moisture. Cosmetic talc must be asbestos-free; the cancer link is unproven."],
    ["cocamide dea|lauramide dea|cocamide diethanolamine", "neutral", "dea foam", "A foam booster. Listed as a possible carcinogen in California; little exposure from a rinse-off."],
    ["cocamide mea|cocamide mipa|lauramide mea", "neutral", "foam", "A foam booster and thickener."],
    // Common neutrals
    ["water|aqua|eau|purified water|deionized water|distilled water|aqua/water/eau|water/aqua/eau|water/eau|aqua/water|water/aqua", "neutral", "solvent", "Water: the base of most lotions and washes."],
    ["sodium chloride|salt|sea salt|maris sal|dead sea salt", "neutral", "salt", "Salt. In washes it thickens the formula."],
    ["citric acid|sodium citrate|trisodium citrate|potassium citrate", "neutral", "ph", "Adjusts pH so the product matches skin's slightly acidic level."],
    ["sodium hydroxide|potassium hydroxide", "neutral", "ph lye", "Lye. In lotions it just adjusts pH; in soap it reacts with oils and none remains."],
    ["triethanolamine|aminomethyl propanol|tromethamine|dimethyl lauramine|sodium bicarbonate|ammonium hydroxide", "neutral", "ph", "Adjusts pH."],
    ["disodium edta|tetrasodium edta|edta|trisodium edta|calcium disodium edta|trisodium ethylenediamine disuccinate|tetrasodium glutamate diacetate|sodium gluconate|tetrasodium etidronate|etidronic acid|sodium phytate|phytic acid|pentasodium pentetate|trisodium dicarboxymethyl alaninate", "neutral", "chelator", "A chelator: binds minerals in tap water so the product stays stable and lathers."],
    ["xanthan gum|carbomer|hydroxyethylcellulose|hydroxypropyl methylcellulose|cellulose gum|microcrystalline cellulose|sodium polyacrylate|polyacrylamide|sodium carbomer|acrylates/c10 30 alkyl acrylate crosspolymer|guar gum|sclerotium gum|gellan gum|carrageenan|hydroxypropyl guar|ammonium acryloyldimethyltaurate/vp copolymer|sodium acrylates copolymer|polyacrylate crosspolymer 6|polyacrylate 13|cellulose|hydroxypropylcellulose|methylcellulose|agar|alginate|sodium alginate|pectin", "neutral", "thickener", "A thickener that gives the product its texture."],
    ["silica|hydrated silica|silica silylate|silica dimethyl silylate", "neutral", "absorbent", "Fine mineral powder that absorbs oil and gives a matte, dry feel."],
    ["tapioca starch|zea mays starch|corn starch|cornstarch|oryza sativa starch|rice starch|sodium hydroxypropyl starch phosphate|aluminum starch octenylsuccinate|potato starch|arrowroot powder|maranta arundinacea root powder", "neutral", "absorbent", "A starch that absorbs moisture and thickens. (Aluminum starch is not an antiperspirant.)"],
    ["magnesium aluminum silicate|bentonite|kaolin|hectorite|disteardimonium hectorite|stearalkonium hectorite|montmorillonite|alumina|aluminum hydroxide|zinc carbonate|magnesium carbonate hydroxide|magnesium carbonate|magnesium oxide|calcium carbonate|sodium magnesium silicate|zinc sulfate|magnesium sulfate|sodium sulfate|potassium sulfate|zinc gluconate|zinc pca|zinc ricinoleate", "neutral", "mineral", "A mineral used to thicken, absorb or control odor. (Not an antiperspirant.)"],
    ["cyclodextrin|triethyl citrate", "neutral", "odor", "Traps or neutralizes odor molecules."],
    ["glycol distearate|glycol stearate|peg 3 distearate", "neutral", "opacifier", "Gives washes a pearly, creamy look."],
    ["sodium xylenesulfonate|ammonium xylenesulfonate|sodium cumenesulfonate", "neutral", "hydrotrope", "Keeps a wash thin and clear. Not a sulfate cleanser."],
    ["propylene glycol|butylene glycol|dipropylene glycol|propanediol|hexylene glycol|glycereth 26|methylpropanediol|1,3 propanediol|isopentyldiol", "neutral", "solvent", "A solvent that helps other ingredients dissolve and spread; a mild humectant."],
    ["isododecane|c13 14 isoparaffin|c18 21 alkane|isohexadecane blend|undecane|tridecane|c15 19 alkane|isobutane|propane|butane|hydrofluorocarbon 152a", "neutral", "volatile", "A light liquid or propellant that evaporates; it carries the formula and adds feel, not moisture."],
    ["cyclomethicone|cyclopentasiloxane|cyclohexasiloxane|cyclotetrasiloxane|trisiloxane|disiloxane|methyl trimethicone", "neutral", "volatile silicone", "A volatile silicone: makes a product glide on, then evaporates. Feel, not moisture."],
    ["sodium lauroyl lactylate|sodium stearoyl lactylate|potassium cetyl phosphate|cetyl phosphate|potassium phosphate|dipotassium phosphate|sodium phosphate|disodium phosphate|cetearyl olivate|sorbitan olivate|sorbitan stearate|sorbitan isostearate|sorbitan oleate|sorbitan laurate|sorbitan sesquioleate|polyglyceryl 3 diisostearate|polyglyceryl 4 isostearate|polyglyceryl 3 polyricinoleate|polyglyceryl 10 laurate|lecithin|hydrogenated lecithin|cetearyl glucoside|arachidyl glucoside|sucrose stearate|sodium stearoyl glutamate|methyl glucose sesquistearate|stearic acid/palmitic acid|lauryl peg 9 polydimethylsiloxyethyl dimethicone", "neutral", "emulsifier", "An emulsifier that keeps oil and water mixed."],
    ["polyhydroxystearic acid|triethoxycaprylylsilane|methyl dihydroabietate|polyester 8|isostearic acid/polyhydroxystearic acid|lauroyl lysine|aluminum stearate|magnesium stearate|zinc stearate|calcium stearate", "neutral", "dispersant", "Helps powders or UV filters spread evenly in the formula."],
    ["polyethylene|nylon 12|nylon 6|polymethylsilsesquioxane|vinyl dimethicone/methicone silsesquioxane crosspolymer|pvp|vp/va copolymer|acrylates copolymer", "neutral", "film", "A polymer that forms a light film or gives a smooth, powdery feel."],
    ["mica|ci 77019|iron oxides|iron oxide|ci 77491|ci 77492|ci 77499|ultramarines|chromium oxide greens|chromium hydroxide green|bismuth oxychloride|tin oxide", "neutral", "pigment", "A mineral pigment for color or shimmer. Not a synthetic dye."],
    ["tocopherol|tocopheryl acetate|vitamin e|vitamin e acetate|mixed tocopherols|tocopheryl linoleate", "neutral", "antioxidant", "Vitamin E: an antioxidant that also keeps oils from going rancid."],
    ["bht|bha|butylated hydroxytoluene|butylated hydroxyanisole|ascorbyl palmitate|rosemary extract antioxidant", "neutral", "antioxidant", "An antioxidant that keeps oils in the product from going rancid."],
    ["aloe barbadensis leaf juice|aloe barbadensis leaf extract|aloe vera|aloe barbadensis (aloe vera) leaf juice|aloe barbadendsis leaf extract|aloe barbadensis leaf juice powder|aloe vera gel", "neutral", "soothing", "Aloe: soothing and lightly hydrating."],
    ["allantoin|bisabolol|alpha bisabolol|dipotassium glycyrrhizate|madecassoside|centella asiatica extract", "neutral", "soothing", "A soothing ingredient that calms irritation."],
    ["capryloyl glycine|undecylenoyl glycine", "neutral", "skin-care", "An amino-acid derivative that helps balance oil and keeps the formula clean."],
    ["adenosine|pantolactone|ectoin|tranexamic acid", "neutral", "skin-care", "A supporting skin-care ingredient."],
    ["avena sativa kernel extract|avena sativa (oat) kernel extract|oat extract", "neutral", "soothing", "Oat extract: soothing."],
    ["cetyl peg/ppg 10/1 dimethicone|peg 3 dioleoylamidoethylmonium", "neutral", "emulsifier", "An emulsifier that keeps oil and water mixed."],
    ["hydroxyethyl acrylate/sodium acryloyldimethyl taurate copolymer|sodium acryloyldimethyl taurate copolymer", "neutral", "thickener", "A thickener that gives lotions a light gel texture."],
    ["hamamelis virginiana water|witch hazel water|hamamelis virginiana (witch hazel) water", "neutral", "extract", "Witch hazel water: a mild astringent."],
    ["rosa damascena flower water|rose water", "neutral", "extract", "Rose water: mostly scent."],
    ["oleth 3 phosphate|oleth 3", "neutral", "emulsifier", "An emulsifier."],
    ["peg 7 trimethylolpropane coconut ether", "neutral", "emulsifier", "A mild emulsifier and solubilizer."],

    // ---- Added from a coverage check against 816 real Open Beauty Facts lists ----
    // Perfume materials beyond the original EU 26 (named on labels more often since the EU widened its list)
    ["tetramethyl acetyloctahydronaphthalenes|tetramethyl acetyloctahydronaphthalene|iso e super|hexamethylindanopyran|galaxolide|terpineol|alpha terpineol|pinene|pinenes|alpha pinene|beta pinene|acetyl cedrene|acetylcedrene|amyl salicylate|hexyl salicylate|cyclohexyl salicylate|geranyl acetate|citronellyl acetate|terpinyl acetate|neryl acetate|isobornyl acetate|isoeugenyl acetate|hexyl acetate|benzyl acetate|dimethyl phenethyl acetate|beta caryophyllene|caryophyllene|carvone|rose ketones|rose ketone|rose ketone 4|damascone|alpha damascone|beta damascone|anethole|terpinolene|benzaldehyde|methyl benzoate|trimethylbenzenepropanol|2 methyl 5 cyclohexylpentanol|dihydromyrcenol|ethylene brassylate|ethyl linalool|methyl dihydrojasmonate|hedione|camphene|myrcene|ocimene|eucalyptol|1,8 cineole|cineole|menthone|nerol|cedrol|sandalore|hexadecanolactone|ambroxan|ambrox|thymol|androstadienone", "scent", "fragrance", "A perfume ingredient: part of the product's scent. Like other fragrance chemicals, it can irritate or sensitize some people."],
    ["menthyl lactate|ethyl menthane carboxamide|menthoxypropanediol|menthone glycerin acetal|methyl diisopropyl propionamide", "scent", "fragrance", "A cooling agent, like menthol. Can sting sensitive skin."],
    // Salts, pH adjusters, solvents
    ["magnesium nitrate|magnesium chloride", "neutral", "salt", "A salt. Often present to stabilize the preservatives MIT/MCI."],
    ["calcium chloride|potassium chloride|ammonium chloride|magnesium hydroxide|zinc sulfate heptahydrate|calcium sulfate|sel marin", "neutral", "salt", "A mineral salt used to thicken or balance the formula."],
    ["acetic acid|phosphoric acid|fumaric acid|hydrochloric acid|formic acid|sodium acetate|potassium bicarbonate|sodium carbonate|sodium borate|acetum|apple cider vinegar|ethanolamine|tetrasodium pyrophosphate|acide citrique|succinic acid", "neutral", "ph", "Adjusts pH."],
    ["triethylene glycol|diethylene glycol|propylene carbonate|isopentane|solketal|dipropylene glycol dibenzoate|ethoxydiglycol|dimethyl isosorbide|benzyl glycol", "neutral", "solvent", "A solvent that helps other ingredients dissolve or spread."],
    // Humectants and amino acids
    ["methyl gluceth 20|methyl gluceth 10|polyglycerin 10|polyglycerin 3|polyglycerin|erythritol|mannitol|biosaccharide gum 1|anhydroxylitol|xylitylglucoside|hydroxyproline|glucosamine|sodium pyruvate|lactobionic acid|hydrolyzed glycosaminoglycans|glyceryl polyacrylate|acetyl glucosamine|sodium hyaluronate (hyaluronic acid)", "moisturizer", "humectant", "A humectant: helps the skin hold water."],
    ["phenylalanine|isoleucine|tyrosine|methionine|taurine|magnesium aspartate|cysteine|tryptophan|asparagine|glutamine|citrulline|ornithine|wheat amino acids|soy amino acids|oat amino acids|rice amino acids|amino acids", "moisturizer", "humectant", "An amino acid, part of skin's natural moisturizing factor."],
    // Animal-derived
    ["keratin amino acids|cocoyl hydrolyzed keratin|cocodimonium hydroxypropyl hydrolyzed keratin|hydrolyzed elastin|elastin|milk protein", "conditioning", "conditioning animal", "An animal-derived protein that coats hair and skin. Not vegan."],
    ["goat milk|caprae lac|lac|milk|goat milk powder|lac caprae", "moisturizer", "emollient animal", "Milk: softening and lightly moisturizing. Not vegan."],
    ["goat fat|tallow|adeps bovis", "moisturizer", "emollient occlusive animal", "Animal fat used as an emollient. Not vegan."],
    ["hydrolyzed pearl|pearl powder", "neutral", "animal", "Powdered pearl, for shimmer. From oysters, so not vegan."],
    ["snail secretion filtrate|snail mucin", "moisturizer", "humectant animal", "Snail mucin: a humectant. Not vegan."],
    ["squalene", "moisturizer", "emollient animal-may", "An emollient oil. Usually from olives now, but it can come from shark liver."],
    // Emollients, waxes, barrier lipids
    ["butylene glycol dicaprylate/dicaprate|propylene glycol dicaprylate/dicaprate|propanediol dicaprylate|propanediol dicaprylate/caprate|neopentyl glycol dicaprate|isoamyl laurate|hexyl laurate|butyloctanol|hexyldecanol|lauryl lactyl lactate|cetyl lactate|myristyl lactate|oleyl erucate|distearyl ether|heptyl undecylenate|dibutyl adipate|diisopropyl sebacate|cocoglycerides|coco glycerides|oleic/linoleic/linolenic polyglycerides|pca glyceryl oleate|lauryl pca|c15 23 alkane|c30 45 olefin|diethylhexyl 2,6 naphthalate|ethylhexyl cocoate|caprylyl caprylate/caprate|isopropyl isostearate|isopropyl lauroyl sarcosinate|phenethyl benzoate|caprylic/capric triglycerides|shea butter ethyl esters|isodecyl isononanoate|c12 13 alkyl lactate", "moisturizer", "emollient", "An emollient: makes skin feel soft and smooth."],
    ["cera microcristallina|copernicia cerifera cera|cera carnauba|hydrogenated microcrystalline wax|synthetic wax|cera microcristallina/microcrystalline wax", "moisturizer", "emollient occlusive", "A wax that thickens and seals in moisture."],
    ["phospholipids|sphingolipids|glycosphingolipids|beta sitosterol|phytosterols|2 oleamido 1,3 octadecanediol|hydroxypropyl bispalmitamide mea|cetyl pg hydroxyethyl palmitamide|cholesteryl macadamiate", "moisturizer", "barrier", "A lipid like those in the skin barrier; helps it hold moisture."],
    // Emulsifiers, thickeners, films
    ["hydrogenated palm glycerides citrate|hydrogenated palm glycerides|glyceryl stearate citrate|hydrogenated vegetable glycerides citrate|glycereth 2 cocoate|pentaerythrityl distearate|trihydroxystearin|glyceryl monostearate|sucrose cocoate|sucrose laurate|sucrose palmitate|sorbitan caprylate|cetearyl wheat straw glycosides|caprylyl/capryl wheat bran/straw glycosides|disteardimonium bentonite|stearate citrate", "neutral", "emulsifier", "An emulsifier or thickener that keeps the formula smooth and stable."],
    ["maltodextrin|pullulan|algin|dextrin|dextrin palmitate|succinoglycan|polyvinyl alcohol|polymethyl methacrylate|trimethylsiloxysilicate|poly c10 30 alkyl acrylate|polyester 7|polyether 1|polyamide 5|nylon 66|ammonium polyacrylate|sodium polymethacrylate|polysilicone 29|polysilicone 11|sodium starch octenylsuccinate|cellulose acetate|aluminum stearates|vp/eicosene copolymer", "neutral", "film", "A polymer, starch or sugar that thickens, binds or forms a light film."],
    ["inulin|fructan|fructooligosaccharides|alpha glucan oligosaccharide|beta glucan|oat beta glucan|glucan", "neutral", "soothing", "A plant sugar (prebiotic or soothing). Mostly harmless."],
    ["calcium sodium borosilicate|calcium aluminum borosilicate|synthetic fluorphlogopite|illite|charcoal powder|charcoal|activated charcoal|zinc neodecanoate|sodium fluoride|hydroxyapatite|silver citrate", "neutral", "mineral", "A mineral used for texture, shimmer, absorbing oil, odor control or (in toothpaste) teeth."],
    ["caramel|caramel color", "neutral", "pigment", "Caramel color: food coloring made from heated sugar. Not a synthetic dye."],
    ["sodium saccharin|saccharin|potassium acesulfame|acesulfame potassium|sucralose|steviol glycosides|denatonium benzoate", "neutral", "flavor", "A sweetener or bitterant, common in lip products and toothpaste."],
    // Vitamins, antioxidants, actives used in small amounts
    ["sodium ascorbyl phosphate|ascorbic acid|magnesium ascorbyl phosphate|ascorbyl glucoside|3 o ethyl ascorbic acid|ethyl ascorbic acid|tetrahexyldecyl ascorbate|ascorbyl tetraisopalmitate|3 laurylglyceryl ascorbate|vitamin c|vitamin c ester", "neutral", "antioxidant", "Vitamin C, or a form of it: an antioxidant that can brighten skin."],
    ["retinyl palmitate|retinyl acetate|retinol|retinal|retinaldehyde|hydroxypinacolone retinoate|vitamin a", "neutral", "retinoid", "A form of vitamin A. Stronger forms (retinol, retinal) can irritate sensitive skin."],
    ["biotin|pyridoxine|vitamin b6|cyanocobalamin|vitamin b12|thiamine|calcium pantothenate|pantothenic acid|riboflavin|folic acid|phytonadione|phytodione|vitamin k1", "neutral", "vitamin", "A vitamin, used in small amounts. Harmless."],
    ["ubiquinone|coenzyme q10|beta carotene|glutathione|ergothioneine|ferulic acid|resveratrol|quercetin|apigenin|bioflavonoids|oryzanol|tocotrienols|astaxanthin|lycopene|idebenone|carnosine|thiotaurine|pentaerythrityl tetra di t butyl hydroxyhydrocinnamate|octadecyl di t butyl 4 hydroxyhydrocinnamate", "neutral", "antioxidant", "An antioxidant: protects skin or the formula from oxidation."],
    ["sodium metabisulfite|sodium sulfite", "neutral", "antioxidant", "A sulfite antioxidant. Rarely a problem on skin, but sulfite-sensitive people may want to know."],
    ["caffeine|kojic acid|alpha arbutin|arbutin|dimethylaminoethanol|dmae|4 t butylcyclohexanol|oleanolic acid|asiaticoside|madecassic acid|asiatic acid|hydroxydecyl ubiquinone", "neutral", "skin-care", "A skin-care ingredient used in small amounts."],
    ["dihydroxyacetone|erythrulose", "neutral", "skin-care", "A self-tanner: browns the top layer of skin for a few days."],
    ["capryloyl salicylic acid", "active", "exfoliant", "A gentle oil-soluble cousin of salicylic acid (LHA). Exfoliates; not an FDA acne active."],
    // Cleansers and foam boosters
    ["laureth sulfate|tipa laureth sulfate|mipa laureth sulfate", "cleanser", "moderate sulfate", "A laureth sulfate detergent, similar to SLES."],
    ["sodium laureth 5 carboxylate|sodium laureth 4 carboxylate|sodium laureth 6 carboxylate|laureth 5 carboxylic acid|sodium lauryl glycol carboxylate|lauroyl/myristoyl methyl glucamide|lauroyl methyl glucamide|capryloyl/caproyl methyl glucamide|cocoyl methyl glucamide|sodium methyltaurate|sodium sesamphoacetate|disodium cocamphodiacetate|sodium cocoyl hydrolyzed wheat protein|potassium cocoyl hydrolyzed oat protein|sodium cocoyl apple amino acids|sodium lauroyl oat amino acids|slsa|poloxamine 1307|sodium cocoyl alaninate|myristoyl methylalanine", "cleanser", "gentle", "A mild cleanser."],
    ["cocamide methyl mea|lauramide mipa|peg 4 rapeseedamide", "neutral", "foam", "A foam booster and thickener."],
    // Sunscreen filters used outside the US, and formula photostabilizers
    ["diethylhexyl butamido triazone|iscotrizinol", "uv-filter", "chemical", "A chemical UVB filter used in Europe (not approved in the US)."],
    ["methylene bis benzotriazolyl tetramethylbutylphenol|tinosorb m", "uv-filter", "chemical", "Tinosorb M: a broad-spectrum UV filter used outside the US. Rarely irritating."],
    ["tris biphenyl triazine|phenylene bis diphenyltriazine|terephthalylidene dicamphor sulfonic acid|disodium phenyl dibenzimidazole tetrasulfonate|bisdisulizole disodium|polysilicone 15|isoamyl p methoxycinnamate|amiloxate|4 methylbenzylidene camphor|enzacamene|ethylhexyl dimethyl paba|sodium phenylbenzimidazole sulfonate|octyl salicylate|benzophenone 5", "uv-filter", "chemical", "A chemical UV filter (several are approved in Europe but not in the US)."],
    ["benzotriazolyl dodecyl p cresol|diethylhexyl syringylidenemalonate", "neutral", "photostabilizer", "Protects the formula (or other UV filters) from light. Not counted as a sunscreen filter."],
    // Antiseptics and more preservatives
    ["octenidine|octenidine dihydrochloride|cetylpyridinium chloride|chlorhexidine|chlorhexidine digluconate", "antibacterial", "", "An antiseptic that kills bacteria. Not needed for everyday washing; can irritate with frequent use."],
    ["5 bromo 5 nitro 1,3 dioxane|bronidox", "preservative", "formaldehyde", "A formaldehyde-releasing preservative (Bronidox)."],
    ["polyaminopropyl biguanide|methylheptylglycerin|decylene glycol|phenylpropanol|ethyl lauroyl arginate|lauric arginate|o cymen 5 ol|isopropyl methylphenol|undecylenic acid|tropolone", "preservative", "normal", "A preservative or preservative booster."],
    // Water, French names
    ["thermal spring water|avene thermal spring water|thermal water|spring water|eau thermale|sea water|maris aqua", "neutral", "solvent", "Water (spring, thermal or sea water): the base of the formula."],
    ["alcool|alcool denat|alcool etilico", "drying-alcohol", "", "Drying alcohol (as labeled in French or Italian). High up a leave-on list it can dry and sting."],
    ["acide lactique", "active", "aha exfoliant", "Lactic acid (AHA), as labeled in French."],
    ["cetostearyl alcohol", "moisturizer", "emollient fatty-alcohol", "Another name for cetearyl alcohol: a waxy fatty alcohol that softens. Not drying."],
    ["triisostearin|neopentyl glycol diethylhexanoate|pentaerythrityl tetraisostearate|diethylhexyl carbonate|bis diglyceryl polyacyladipate 2|diisostearyl malate|octyldodecyl stearoyl stearate|hydrogenated ethylhexyl olivate|coconut alkanes|c13 15 alkane|helianthus annuus seed cera|neopentyl glycol dicaprylate/dicaprate|hydrogenated olive oil unsaponifiables|olive oil unsaponifiables", "moisturizer", "emollient", "An emollient: makes skin feel soft and smooth."],
    ["diglycerin|maltitol|hydroxypropyl tetrahydropyrantriol|pro xylane", "moisturizer", "humectant", "A humectant: helps the skin hold water."],
    ["soluble collagen", "moisturizer", "humectant animal", "Collagen in solution: a humectant film on the skin (it doesn't add collagen to skin). Not vegan."],
    ["sine adipe lac|lac powder|skim milk", "moisturizer", "emollient animal", "Milk (or skim milk): softening. Not vegan."],
    ["c12 13 alketh 9|c20 22 alkyl phosphate|inulin lauryl carbamate|sodium caproyl/lauroyl lactylate|sodium caproyl lactylate", "neutral", "emulsifier", "An emulsifier that keeps oil and water mixed."],
    ["triacontanyl pvp|hydrogenated glyceryl abietate|magnesium myristate", "neutral", "film", "Helps the formula stay put, spread or feel smooth."],
    ["diatomaceous earth|perlite|boron nitride|calcium silicate|kaolin clay|magnesium silicate|aluminum silicate", "neutral", "mineral", "A mineral powder that absorbs oil and gives texture."],
    ["sodium formate|sodium glycolate|aminomethyl propanediol", "neutral", "ph", "Adjusts or buffers pH."],
    ["t butyl alcohol|tert butyl alcohol", "neutral", "solvent", "A denaturant added in tiny amounts. Not a drying alcohol at that level."],
    ["chlorophyllin copper complex|sodium copper chlorophyllin", "dye", "", "A green color made from chlorophyll."],
    ["creatine|1 methylhydantoin 2 imide|creatinine|hesperidin methyl chalcone|silanetriol|protease|papain|bromelain|lactobacillus lysate|lactobacillus ferment|bifida ferment lysate", "neutral", "skin-care", "A skin-care ingredient used in small amounts."],
    ["escin|aescin", "neutral", "soothing", "A soothing plant compound (from horse chestnut)."],
    ["azelaic acid", "active", "exfoliant", "Azelaic acid: calms redness and helps with blemishes. Can tingle at first."],
    ["methyl salicylate", "scent", "fragrance", "Wintergreen oil's main compound: minty scent and a warming feel. Can irritate."],
    ["alpha terpinene|gamma terpinene|terpinene", "scent", "fragrance", "A perfume ingredient: part of the product's scent."],
    ["sodium methyl 2 sulfolaurate|disodium 2 sulfolaurate", "cleanser", "gentle", "A mild cleanser (a sulfolaurate, not a sulfate)."],
    ["lauroyl sarcosine|sodium laureth 11 carboxylate|lauroyl methylalanine|sodium lauroyl methylaminopropionate|disodium tetrapropenyl succinate", "cleanser", "gentle", "A mild cleanser."],
    ["soyamide dea|palm kernelamide dea", "neutral", "dea foam", "A DEA foam booster. Listed as a possible carcinogen in California; little exposure from a rinse-off."],
    ["1 hexadecanol|hexadecanol|coconut alcohol|1 octadecanol", "moisturizer", "emollient fatty-alcohol", "A fatty alcohol: waxy and softening, not drying."],
    ["c18 38 alkyl hydroxystearoyl stearate|castoryl maleate|palmitoyl myristyl serinate|pca ethyl cocoyl arginate", "moisturizer", "emollient", "An emollient: makes skin feel soft and smooth."],
    ["isostearoyl hydrolyzed silk|sodium lauroyl hydrolyzed silk|sericin|potassium cocoyl hydrolyzed collagen|albumen|egg white", "conditioning", "conditioning animal", "An animal-derived protein (silk, collagen or egg). Not vegan."],
    ["dihydroxypropyl arginine hcl|acetyl methionine|methylsilanol mannuronate|pg propyl methylsilanediol|persimmon tannin|cholecalciferol|vitamin d3|calcium lactate", "neutral", "skin-care", "A skin-care ingredient used in small amounts."],
    ["lactose|2,3 butanediol|sodium polystyrene sulfonate|polyimide 1", "neutral", "film", "Helps the formula's texture or stability."],
    ["methylundecanal|aldehyde c 12 mna|undecanal|decanal|octanal", "scent", "fragrance", "A perfume ingredient: part of the product's scent."],
    ["chloramine t", "antibacterial", "", "An antiseptic. Can irritate with frequent use."],
    ["miel", "moisturizer", "humectant animal", "Honey: a humectant. Made by bees, so not vegan."],
  ];

  // Built from ENTRIES: one shared entry object per row, findable by any alias.
  const KB = {};
  const BY_ID = {};
  for (const [names, group, tags, note] of ENTRIES) {
    const aliases = names.split("|");
    const id = slug(aliases[0]);
    const entry = BY_ID[id] || { id, name: titleCase(aliases[0]), group, tags: tags ? tags.split(" ") : [], note };
    BY_ID[id] = entry;
    for (const a of aliases) { const k = key(a); if (!KB[k]) KB[k] = entry; }
  }
  function titleCase(s) {
    return s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(Ci|Peg|Ppg|Edta|Bht|Bha|Pca|Sd|Dea|Mea|Mit|Mci|Ipbc|Pvp)\b/g, m => m.toUpperCase());
  }

  // ---------- patterns (tried in order after exact names) ----------
  // Essential-oil plants: their leaf/flower/peel/bark/root oils are scent, checked BEFORE plant oils so citrus peel oil counts as fragrance.
  const EO_PLANTS = "lavandula|lavender|lavandin|mentha|peppermint|spearmint|eucalyptus|melaleuca|tea tree|rosmarinus|rosemary|citrus|orange|lemon|lime|grapefruit|bergamot|mandarin|tangerine|cymbopogon|lemongrass|citronella|palmarosa|pelargonium|geranium|cananga|ylang|santalum|sandalwood|cedrus|cedarwood|juniperus|juniper|salvia|clary|sage|rosa damascena|rose flower|jasminum|jasmine|anthemis|chamomilla|chamomile|boswellia|frankincense|pogostemon|patchouli|cinnamomum|cinnamon|eugenia|syzygium|clove|thymus|thyme|origanum|oregano|abies|fir|pinus|pine|cupressus|cypress|vetiveria|vetiver|litsea|ocimum|basil|coriandrum|coriander|foeniculum|fennel|zingiber|ginger|piper nigrum|black pepper|illicium|anise|amyris|copaifera|tagetes|nardostachys|myrtus|myrtle|ravensara|cistus|styrax|michelia|aniba|rosewood|laurus|bay";
  const EO_PART = /\b(peel|rind|zest|leaf|leaves|flower|bark|root|rhizome|herb|wood|needle|twig|stem|resin|gum|aerial|bud|berry)\b/;
  const CARRIER_PART = /\b(seed|kernel|nut|fruit|germ|bran|pulp)\b/;
  const P = (re, group, tags, note) => ({ re, group, tags: tags ? tags.split(" ") : [], note });
  const PATTERNS = [
    P(/\b(co|cross)polymer\b|crosspolymer|copolymer/, "neutral", "polymer", "A polymer that thickens, forms a film or gives a smooth feel."),
    P(/^polyquaternium \d+/, "conditioning", "conditioning", "A conditioning polymer that reduces tangles and static."),
    P(/hyaluron/, "moisturizer", "humectant", "A form of hyaluronic acid: holds water in the skin's surface."),
    P(/peptide/, "neutral", "skin-care", "A peptide: a small protein fragment used in anti-aging products. Generally well tolerated."),
    P(/(trimonium|dimonium) (chloride|methosulfate|bromide|phosphate)|hydroxypropyltrimonium|amidopropyl (dimethylamine|diethylamine)$|^silicone quaternium \d+/, "conditioning", "conditioning", "A conditioning agent: clings to hair (or skin) to soften and detangle."),
    P(/\bresinoid\b/, "scent", "fragrance", "A perfume resin: part of the product's scent."),
    P(/^(basic|acid|hc|disperse|direct) (blue|red|yellow|green|orange|violet|brown|black) \d+$/, "dye", "", "A hair or cosmetic dye. Adds color only; an occasional irritant."),
    P(/\b(peg|ppg)\b|^(polysorbate|ceteareth|steareth|laureth|oleth|ceteth|isoceteth|beheneth|trideceth|isosteareth|undeceth|coceth|deceth|nonoxynol|poloxamer)\s?\d|\bpareth\s?\d/, "neutral", "emulsifier", "An emulsifier or solubilizer that keeps oil and water mixed."),
    P(/^poly(ester|ether|amide|silicone|vinyl|methyl methacrylate|urethane)\b|^nylon \d+$/, "neutral", "film", "A polymer that forms a light film or gives a smooth feel."),
    P(/^ceramide\b|\bceramide (np|ap|eop|ns|eos|as|1|2|3|6 ii)\b/, "moisturizer", "barrier", "A ceramide: one of the lipids the skin barrier is built from. Helps repair dry, damaged skin."),
    P(/\bsaponified\b/, "soap", "", "Oils saponified (made into soap) with lye: true soap."),
    P(/essential oil/, "scent", "essential-oil","A plant essential oil: natural scent, but can irritate sensitive skin."),
    P({ test: k => /\boil\b/.test(k) && new RegExp("\\b(" + EO_PLANTS + ")\\b").test(k) && !CARRIER_PART.test(k) && (EO_PART.test(k) || !/\b(hydrogenated|sulfated)\b/.test(k)) }, "scent", "essential-oil", "A plant essential oil: natural scent, but can irritate sensitive skin."),
    P(/\boil\b/, "moisturizer", "emollient", "A plant oil: softens skin."),
    P(/\bbutter\b/, "moisturizer", "emollient occlusive", "A plant butter: softens and seals in moisture."),
    P(/\bwax\b/, "moisturizer", "emollient occlusive", "A wax: thickens and seals in moisture."),
    P(/\b(extract|juice|filtrate|ferment|leaf water|flower water|fruit water|rice water|hydrosol|leaf powder|root powder|seed powder|callus culture|cell culture)\b/,"neutral", "extract", "A plant extract, usually in small amounts. Mostly harmless; any plant can irritate a few people."),
    P(/\bsulfosuccinate\b|\bsulfoacetate\b/, "cleanser", "gentle", "A mild cleanser. Despite the name, not a sulfate."),
    P(/\bisethionate\b|\bglucoside\b|\bsultaine\b|\bbetaine\b|\bsarcosinate\b|\btaurate\b|\bglutamate\b|\bglycinate\b|ampho(di)?acetate\b|amphopropionate\b|\bamine oxide\b|\bglucose carboxylate\b|\bmethyl glucamide\b/,"cleanser", "gentle", "A mild synthetic cleanser."),
    P(/^(sodium|ammonium|tea|potassium|mea) lauryl sulfate$/, "cleanser", "harsh sulfate", "A lauryl sulfate: a strong, stripping detergent."),
    P({ test: k => /^(sodium|ammonium|tea|magnesium|potassium|mea|mipa|disodium) \S.* sulfate$/.test(k) && !/(metho|etho)sulfate$/.test(k) }, "cleanser", "moderate sulfate", "A sulfate detergent: lathers well, can strip dry skin."),
    P(/\bolefin sulfonate\b|\bbenzenesulfonate\b|\bparaffin sulfonate\b/, "cleanser", "moderate", "A strong synthetic detergent (not a sulfate)."),
    P(/^(sodium|potassium) (tallowate|lardate|beefate)$/, "soap", "animal", "Soap made from animal fat."),
    P(/^(sodium|potassium) (\w+ )?\w*(palmate|kernelate|cocoate|olivate|oleate|stearate|laurate|myristate|palmitate|castorate|sunflowerate|butterate|babassuate|ricinoleate|hempseedate|soyate|canolate|rapeseedate|avocadoate|almondate|jojobate|grapeseedate|safflowerate|cottonseedate|macadamiate|ricebranate|arganate|behenate|seedate|murumuruate|branate|kernelate)$/, "soap","","True soap: oil reacted with lye. Alkaline, so it can dry skin."),
    P(/^sd alcohol\b/, "drying-alcohol", "", "Denatured alcohol: drying high up a leave-on list."),
    P(/^(cetyl|stearyl|cetearyl|behenyl|myristyl|arachidyl|lauryl|oleyl|isostearyl|c\d+ \d+) alcohols?$/, "moisturizer", "emollient fatty-alcohol", "A fatty alcohol: waxy and softening, not drying."),
    P(/^(stearic|palmitic|lauric|myristic|oleic|linoleic|linolenic|behenic|arachidic|capric|caprylic|isostearic|palm|coconut|palm kernel) acid$/, "moisturizer", "emollient fatty-acid", "A fatty acid, like those in skin's own oils."),
    // Fatty esters only: acetates, salicylates and cinnamates are often perfume or UV filters, so they're left out on purpose.
    P(/^(isopropyl|ethylhexyl|octyldodecyl|cetyl|cetearyl|isocetyl|isononyl|isodecyl|isostearyl|decyl|myristyl|tridecyl|diisopropyl|dicaprylyl|propylheptyl|butyloctyl|hexyldecyl|hexyl|isoamyl|heptyl|oleyl|lauryl|stearyl|behenyl|octyl|isooctyl|isobutyl|c\d+ \d+ alkyl|coco|(butylene|propylene|neopentyl) glycol|propanediol) (laurate|myristate|palmitate|stearate|isostearate|oleate|behenate|erucate|caprylate|caprate|cocoate|neopentanoate|isononanoate|ethylhexanoate|heptanoate|undecylenate|lactate|adipate|sebacate|succinate|malate|citrate|carbonate|benzoate|dicaprylate|dicaprate|linoleate|ricinoleate)$/, "moisturizer", "emollient", "An emollient ester: softens and smooths skin."),
    P(/(methicone|siloxane|dimethiconol|silsesquioxane)$/, "moisturizer", "emollient conditioning", "A silicone that smooths and slows water loss."),
    P(/^quaternium \d+$/, "conditioning", "conditioning", "A conditioning agent."),
    P(/^hydrolyzed \w+ protein$/, "conditioning", "conditioning", "A broken-down protein that coats and strengthens hair."),
    P(/^ci 75470$|\bcarmine\b|\bcochineal\b/, "dye", "animal", "Carmine: red color made from insects. Not vegan."),
    P(/^ci 77\d{3}$/, "neutral", "pigment", "A mineral pigment (not a synthetic dye)."),
    P(/^ci \d{5}$/, "dye", "", "A synthetic color. Adds nothing for skin; an occasional irritant."),
    P(/^(ext )?(fd&c|d&c)\b|^(ext )?(blue|red|yellow|green|orange|violet|brown) (no )?\d+( lake)?$/, "dye", "", "A synthetic color. Adds nothing for skin; an occasional irritant."),
    P(/(edta|etidronate|disuccinate|phytate|gluconate|pentetate)$/, "neutral", "chelator", "A chelator that keeps the formula stable in hard water."),
    P(/\bgum$|cellulose$|^carbomer|starch\b/, "neutral", "thickener", "A thickener."),
    P(/^sorbitan \w+$|^polyglyceryl \d+ \w+( \w+)*$|^glyceryl \w+$|glycerides citrate$/, "neutral", "emulsifier", "An emulsifier."),
    P(/\biron oxides?\b/, "neutral", "pigment", "A mineral pigment for color. Not a synthetic dye."),
  ];
  // Words that mark an animal source (for the vegan flag) on names matched by a pattern.
  const ANIMAL = /\b(keratin|collagen|elastin|silk|milk|lac|caprae|goat|tallow|lard|honey|lanolin|placenta|snail|pearl|shark|cochineal|carmine|beeswax)\b/;

  /** @returns {any} */
  function patternEntry(k, display) {
    for (const p of PATTERNS) {
      const hit = typeof p.re.test === "function" ? p.re.test(k) : false;
      if (hit) {
        const tags = ANIMAL.test(k) && !/\b(synthetic|vegan|vegetable|phyto)\b/.test(k) && p.tags.indexOf("animal") < 0 ? p.tags.concat("animal") : p.tags;
        return { id: "p:" + slug(k), name: display, group: p.group, tags, note: p.note, pattern: true };
      }
    }
    return null;
  }

  // ---------- spelling fixes (photo-OCR and typos), shown to the user as "read as …" ----------
  // Only exact knowledge-base names are candidates. Two kinds of fix: the same letters with different spacing
  // ("isopropyl pal mitate"), or one typo (two on names of 16+ letters) when the closest name is unique and the
  // numbers match exactly, so "Benzophenone-2" never becomes "Benzophenone-3".
  let SQUASHED = null;
  const squash = s => s.replace(/[^a-z0-9]/g, "");
  const digits = s => s.replace(/[^0-9]/g, "");
  function within(a, b, max) { // Levenshtein distance ≤ max (bounded)
    if (Math.abs(a.length - b.length) > max) return false;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return false;
      prev = cur;
    }
    return prev[b.length] <= max;
  }
  /** @returns {string|null} the knowledge-base name (key) the misspelling was read as */
  function spellFix(k) {
    const sq = squash(k);
    if (sq.length < 8) return null;
    if (!SQUASHED) SQUASHED = Object.keys(KB).map(x => [x, squash(x)]).filter(x => x[1].length >= 6);
    for (const [kk, s] of SQUASHED) if (s === sq) return kk;
    const max = sq.length >= 16 ? 2 : sq.length >= 10 ? 1 : 0;
    for (let d = 1; d <= max; d++) {
      const hits = SQUASHED.filter(([, s]) => digits(s) === digits(sq) && within(sq, s, d) && !within(sq, s, d - 1));
      const entries = hits.map(([kk]) => KB[kk]).filter((e, i, a) => a.indexOf(e) === i);
      if (entries.length === 1) return hits[0][0];
      if (entries.length > 1) return null; // ambiguous: don't guess
    }
    return null;
  }

  // Marketing words that don't change what the ingredient is.
  const MARKETING = /\b(certified organic|organic|org|bio|natural|naturally derived|fair trade|fairtrade|wildcrafted|non gmo|non-gmo|cold[- ]pressed|unrefined|refined|extra virgin|virgin|pure|raw|sustainably sourced|sustainable|kosher|vegan|food grade|cosmetic grade|pharmaceutical grade)\b/gi;

  /** Exact name, then the name without marketing words. */
  function exact(name) {
    const k = key(name);
    if (KB[k]) return KB[k];
    const k2 = key(String(name).replace(MARKETING, " "));
    return KB[k2] || null;
  }
  /** Exact name → pattern → spelling fix. A spelling fix comes back as a copy with readAs set. */
  function lookup(name) {
    if (!name) return null;
    const e = exact(name);
    if (e) return e;
    let k = key(String(name).replace(MARKETING, " "));
    if (!k) return null;
    if (/ hcl$/.test(k) && KB[k.slice(0, -4)]) return KB[k.slice(0, -4)];     // "Pyridoxine HCl"
    k = k.replace(/^c[l1i]?\s?(\d{5})$/, "ci $1")                             // OCR'd "C 14720", "Cl 61570"
      .replace(/^pol[iy] ?qu?a ?ter ?ni ?um\b/, "polyquaternium");              // "Poliquaternium-10", "Polyquaterni um 6"
    if (KB[k]) return KB[k];
    const p = patternEntry(k, String(name).trim());
    if (p) return p;
    const f = spellFix(k);
    return f ? Object.assign({}, KB[f], { readAs: titleCase(f) }) : null;
  }
  // Whole name first (keeps Caprylic/Capric Triglyceride whole); then slashes: "Water/Aqua/Eau" (all the same thing),
  // "CI 19140/Yellow 5" (all colors or all neutral), or a bilingual "Hyaluronic Acid/Acide Hyaluronique".
  const FRENCH = /[éèêàçôû]|\b(acide|huile|beurre|cire|alcool|extrait|eau|sel|glycerine|parfum|marin)\b/i;
  function resolveName(name, exactOnly) {
    const e = exactOnly ? exact(name) : lookup(name);
    if (e) return e;
    if (name.includes("/")) {
      const parts = name.split("/").map(s => s.trim()).filter(Boolean);
      const hits = parts.map(p => exactOnly ? exact(p) : lookup(p));
      if (hits.length > 1 && hits.every(Boolean)) {
        if (hits.every(h => h.id === hits[0].id)) return hits[0];
        if (hits.every(h => h.group === hits[0].group && (h.group === "dye" || h.group === "neutral"))) return hits[0];
      }
      if (parts.length === 2 && hits[0] && !hits[0].readAs && !hits[1] && FRENCH.test(parts[1])) return hits[0];
    }
    return null;
  }

  // ---------- parser ----------
  const PURPOSE = new Set(["sunscreen", "sunscreens", "anti dandruff", "antidandruff", "anti dandruff shampoo", "antidandruff shampoo", "dandruff", "antiseptic", "first aid antiseptic",
    "antibacterial", "antimicrobial", "antiperspirant", "skin protectant", "skin protectant (ointment)", "acne treatment", "acne medication", "external analgesic", "anti itch",
    "antifungal", "purpose", "purposes", "seborrheic dermatitis", "psoriasis", "anticavity", "skin protectant/sunscreen", "uses", "dandruff/seborrheic dermatitis"]);
  const isPurpose = s => { const k = key(s); return PURPOSE.has(k) || PURPOSE.has(k.replace(/\s*\([^)]*\)\s*/g, " ").trim()); };

  /** Split at depth 0 on commas (not "1,2-"), and optionally on " or " / " and/or ". */
  function splitTop(s, alternatives) {
    const out = []; let depth = 0, cur = "";
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth) depth--;
      // Not inside "1,2-Hexanediol" or "1, 2-Hexanediol"
      const inName = /\d/.test(s[i - 1] || "") && (/\d/.test(s[i + 1] || "") || (/(^|[\s(])\d$/.test(cur) && /^\s\d+\s?-/.test(s.slice(i + 1))));
      if (c === "," && depth === 0 && !inName) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    let parts = out.map(x => x.trim()).filter(Boolean);
    if (alternatives) parts = parts.flatMap(p => splitAlternatives(p));
    return parts;
  }
  function splitAlternatives(p) {
    const out = []; let depth = 0, cur = "";
    for (let i = 0; i < p.length; i++) {
      const c = p[i];
      if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth) depth--;
      if (depth === 0) {
        const rest = p.slice(i);
        const m = rest.match(/^\s+(and\/or|or)\s+/i);
        if (m) { out.push(cur); cur = ""; i += m[0].length - 1; continue; }
      }
      cur += c;
    }
    out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  }
  function firstParen(s) {
    const start = s.indexOf("(");
    if (start < 0) return null;
    let depth = 0;
    for (let i = start; i < s.length; i++) {
      if (s[i] === "(") depth++;
      else if (s[i] === ")") { depth--; if (depth === 0) return { start, end: i, inner: s.slice(start + 1, i) }; }
    }
    return { start, end: s.length, inner: s.slice(start + 1) };
  }

  // Drop footnotes and marketing that follow the list ("…Limonene. *Organic", "…Glycerin. Made in USA").
  function cutTail(s) {
    // A list separated only by periods ("Water. Glycerin. Fragrance.") uses them as commas.
    if (!/,/.test(s) && (s.match(/\.\s+\S/g) || []).length >= 2) s = s.replace(/\.\s+(?=\S)/g, ", ");
    let depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === "(" || c === "[") depth++;
      else if ((c === ")" || c === "]") && depth) depth--;
      else if (c === "." && depth === 0) {
        const before = s.slice(0, i), after = s.slice(i + 1);
        if (/\b(no|ext|denat|fl|st|vit|sp|spp|var|ssp|subsp|approx|nr)$/i.test(before)) continue;
        if (/\d$/.test(before) && /^\d/.test(after)) continue;
        const rest = after.trim();
        if (!rest) return before;
        if (/^[*†‡^(]/.test(rest) || !/,/.test(rest)) return before;
        s = before + "," + after; // a period inside the list
      }
    }
    return s;
  }

  const HEAD = /(?:^|[\s.,;:(\-])((?:in)?active\s+ingredients?(?:\s*(?:&|and)\s*concentrations?)?(?:\s*purposes?)?\s*:?|other\s+ingredients?\s*:|ingr[eé]dients?\s*:|may\s+contain\s*:)/gi;

  function parse(text) {
    const src = String(text || "");
    let t = src.replace(/\r\n?|\n|\t| /g, " ");
    t = t.replace(/&quot;?|&#34;/g, '"').replace(/&amp;/g, "&").replace(/&gt;?/g, " ").replace(/&lt;?/g, " ").replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
      .replace(/\[/g, "(").replace(/\]/g, ")")                        // "Aqua [Water]" reads like "Aqua (Water)"
      .replace(/may\s+contain\s*\/\s*peut\s+contenir/gi, "may contain");
    const truncated = /…|\.\.\.|\band (many )?other ingredients\b|\bsee (the )?(package|packaging|label|box|bottle|carton|container|product)\b|\betc\b\.?/i.test(t);
    const hasHundred = /\b100\s*%/.test(t);
    // The truncation phrases themselves aren't ingredients ("Fragrance and other ingredients" → "Fragrance").
    t = t.replace(/\s*(?:,\s*)?(?:\band (?:many )?other ingredients\b|\bsee (?:the )?(?:package|packaging|label|box|bottle|carton|container|product)\b(?: for (?:the )?(?:full|complete) (?:list|ingredients|ingredient list))?|\betc\b\.?|…|\.\.\.)/gi, " ");
    t = t.replace(/[®™©]/g, "").replace(/\s[•·●▪|]\s/g, ", ").replace(/\s+/g, " ")
      .replace(/\(\s*code\b[^)]*\)/gi, " ").replace(/\bD\d{5,}\/\d+\b/g, " ").replace(/\bcode\s+[a-z](?:\s*[.,]\s*[a-z]){1,3}\b\.?/gi, " ")
      .replace(/\band\/or\s+et\/ou\b/gi, " and/or ").replace(/\bet\/ou\b/gi, " and/or ")
      .replace(/may\s+contain\s*[[(]?\s*\+\s*\/\s*-\s*[\])]?\s*:?/gi, " May contain: ")
      .replace(/[[(]\s*\+\s*\/\s*-\s*[\])]\s*:?/g, " May contain: ")
      .replace(/;/g, ",")
      .replace(/,\s*(USP|NF)\b/g, " ").replace(/\b(USP|NF)\b/g, " ")
      .replace(/\.\s*,/g, ",")
      .replace(/\s+/g, " ").trim();

    // Sections: Active / Inactive / Ingredients / May contain.
    const heads = []; let m; HEAD.lastIndex = 0;
    while ((m = HEAD.exec(t))) {
      const h = m[1].toLowerCase();
      const type = /^inactive/.test(h) || /^other/.test(h) ? "inactive" : /^active/.test(h) ? "active" : /^may/.test(h) ? "may" : "plain";
      heads.push({ type, start: m.index + m[0].indexOf(m[1]), end: m.index + m[0].length });
    }
    const sections = [];
    if (!heads.length) sections.push({ type: "plain", text: t });
    else {
      const pre = t.slice(0, heads[0].start).trim();
      if (pre && /,/.test(pre)) sections.push({ type: "plain", text: pre }); // "2021506 4 -" style codes are dropped
      heads.forEach((h, i) => sections.push({ type: h.type, text: t.slice(h.end, i + 1 < heads.length ? heads[i + 1].start : t.length) }));
    }

    const items = [], pieces = []; let pos = 0, rank = 0;
    let hasActives = false, hasInactives = false;
    for (const sec of sections) {
      if (sec.type === "active") hasActives = true;
      if (sec.type === "inactive") hasInactives = true;
      let s = cutTail(sec.text.trim());
      s = s.replace(/\(\s*(?:[a-z]|[ivx]{1,3}|\d)\s*\)/gi, " ").replace(/[*†‡^°]/g, " "); // footnote markers: "Oil(a)*"
      const may = sec.type === "may";
      const active = sec.type === "active";
      splitTop(s, false).forEach((piece, n) => {
        // A leading label we don't know ("Ingredientes: Aqua", "Base contains: Aqua") ends at its colon.
        if (n === 0 && /:/.test(piece)) piece = piece.slice(piece.lastIndexOf(":") + 1);
        pieces.push(piece);
      });
      for (let piece of pieces.splice(0)) {
        piece = piece.replace(/^(and|&)\s+/i, "").replace(/\s*\.$/, "").trim();
        if (!piece) continue;
        let pct = null;
        piece = piece.replace(/\(\s*(\d+(?:\.\d+)?)\s*%\s*(?:w\/w|w\/v|v\/v)?\s*\)/i, (x, n) => { pct = +n; return " "; });
        piece = piece.replace(/(?:^|\s)(\d+(?:\.\d+)?)\s*%(?=\s|$)/, (x, n) => { if (pct == null) pct = +n; return " "; }).replace(/\s+/g, " ").trim();
        if (!piece || isPurpose(piece)) continue;
        const resolved = resolvePiece(piece);
        if (!resolved.length) continue;
        pos++;
        const r = active ? 0 : (may ? null : ++rank);
        const alt = resolved.length > 1 && !resolved.sub;
        for (const it of resolved) {
          items.push({ name: it.name, raw: piece, entry: it.entry, pos, rank: r, active, pct, may, alt: alt || !!it.alt, sub: !!resolved.sub });
        }
      }
    }
    const positions = pos;
    const incomplete = [];
    if (!items.length) incomplete.push("empty");
    else {
      if (truncated) incomplete.push("truncated");
      if (hasActives && !hasInactives && !hasHundred) incomplete.push("actives-only");
      if (positions <= 2 && !hasHundred) incomplete.push("too-short");
    }
    const unknown = items.filter(i => !i.entry).map(i => i.name);
    return { items, positions, hasActives, hasInactives, hasHundred, incomplete, unknown };
  }

  /** One label entry → one or more resolved items. Returns an array (with .sub for "Soap (A, B or C)"). */
  function resolvePiece(piece) {
    const clean = s => s.replace(/\s+/g, " ").replace(/^[\s,.:-]+|[\s,.:-]+$/g, "").trim();
    // "A or B" / "A and/or B" outside parentheses: alternatives sharing one position.
    const alts = splitAlternatives(piece);
    if (alts.length > 1) {
      const out = alts.flatMap(a => resolvePiece(a)).map(x => ({ ...x, alt: true }));
      return out;
    }
    const p = firstParen(piece);
    if (!p) {
      const name = clean(piece);
      return name ? [{ name, entry: resolveName(name, false) }] : [];
    }
    const head = clean(piece.slice(0, p.start)), after = clean(piece.slice(p.end + 1)), inner = clean(p.inner);
    const outer = clean(head + " " + after);
    let innerParts = splitTop(inner, true);
    // "Iron Oxides (CI 77491, 77492, 77499)": bare numbers next to a CI number are CI numbers too.
    if (innerParts.some(x => /^ci\s?\d{5}$/i.test(x))) innerParts = innerParts.map(x => /^\d{5}$/.test(x) ? "CI " + x : x);
    if (innerParts.length > 1) {
      const headHit = outer ? resolveName(outer, false) : null;
      const innerItems = innerParts.flatMap(x => resolvePiece(x));
      // Aliases of the head ("Aqua (Water, Eau)"), or the shades of a color or pigment: one ingredient.
      const same = x => x.entry && (x.entry.id === headHit.id || (x.entry.group === headHit.group && (headHit.group === "dye" || (headHit.group === "neutral" && x.entry.tags.indexOf("pigment") >= 0))));
      if (headHit && innerItems.length && innerItems.every(same)) return [{ name: clean(piece), entry: headHit }];
      const out = /** @type {any} */ ([...(headHit ? [{ name: outer, entry: headHit }] : []), ...innerItems]);
      out.sub = true;
      return out;
    }
    // One alias inside: "Butyrospermum Parkii (Shea) Butter", "Titanium Dioxide (CI 77891)", "Fragrance (Parfum)".
    const name = clean(piece);
    if (!inner) return [{ name: outer || name, entry: resolveName(outer, false) }];
    const candidates = [outer, clean(inner + " " + after), head, inner].filter(Boolean);
    for (const c of candidates) { const e = resolveName(c, true); if (e) return [{ name, entry: e }]; }
    for (const c of candidates) { const e = resolveName(c, false); if (e) return [{ name, entry: e }]; }
    return [{ name, entry: null }];
  }

  return { parse, lookup, key, GROUPS, KB, BY_ID, ENTRIES };
});
