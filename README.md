# Should I Buy It? Body Care

**Live:** https://quochhdo.github.io/should-i-buy-it-body/

Check soap, body wash, shampoo, conditioner, face products, sunscreen, baby products, lotion and deodorant against your own skin. A sibling of the food app [Should I Buy It?](https://github.com/QuocHHDo/should-i-buy-it).

- **Free and private.** No paid APIs, no keys, no server, no account, no AI. Everything runs in your browser; your profile stays in `localStorage`.
- **Fixed rules, not a model.** The same ingredient list and profile always give the same verdict, and every point on the card names the rule that produced it.
- **Listed ingredients only.** A product is judged only on a complete ingredient list. Built-in lists were copied from a retailer or brand page that was actually opened, and each one is dated.

## Features

- **Check:** search the built-in products (brand, name, type, aliases) and Open Beauty Facts; scan a barcode; or paste any ingredient list, including Drug Facts lists. Recent products are kept as chips.
- **Result card:**
  - **Header:** brand and name, type, a rinse-off/leave-on toggle and the source line.
  - **Verdict:** your avoid-list flags, then the verdict ("for dry, sensitive skin · score +2").
  - **Why:** the ± point rows behind the score.
  - **Good to know:** notes that don't change the score.
  - **At a glance:** UV filters, main cleanser, scent, moisturizers, preservatives, dyes and ingredient count.
  - **What's inside:** color-coded ingredient chips (helps skin / watch / common problem / neutral / not in our list). Tap one for a plain-English explanation and the rules that used it.
  - **Better for your skin:** up to three built-ins of the same kind that score higher.
  - **Actions:** Compare, Share (Web Share, then clipboard) and Edit ingredients.
- **Compare:** two products, a one-line answer ("X is the better pick for your skin") and a side-by-side table.
- **Browse:** every built-in product. Filter by type, sort by best for me, worst, or A–Z. Each one is marked ✓ label checked.
- **My skin:** skin type, sensitive/acne/dandruff, an avoid list and custom words. Cards update live as you change it.
- **Offline:** a service worker caches the app and built-in products. Installable as a PWA.
- **Routes:** `#check`, `#p=<id>`, `#i=<share>` (a pasted list encoded in the link), `#cmp=a,b`, `#compare`, `#browse`, `#skin`.

## The scope rule

A verdict needs the **complete** ingredient list, and nothing is ever filled in from memory.

- **Built-in products:** each list is copied exactly from the page in its `sourceUrl`, on the date in `checked`. A product goes in only if a complete list could be found on a page that was actually opened. Cards say "Label checked <month year>" with the source link, plus "formulas change, compare with your bottle".
- **Open Beauty Facts:** used as-is (community data). If a product is missing or has no list, the paste box opens. A lookup is never a dead end.
- **Incomplete-list guard:** no verdict, no reasons and no notes when the list:
  - contains "…", "and other ingredients" or "see package";
  - has Drug Facts actives but no inactive list;
  - has two or fewer ingredients and no "100%".

  The card says **Incomplete list** and asks for the full list from the bottle or the brand's site. The ingredients are still shown. "White Petrolatum 100%" (Vaseline) counts as complete.

## Verdict rules

Score thresholds: **≥ +2 Get it**, **−1 to +1 Fine**, **≤ −2 Think twice**. Anything on your avoid list is **Skip** and is flagged above the verdict.

Rinse-off vs leave-on comes from the type (washes default to rinse-off), and the card has a toggle. Each type belongs to one product family: sun, hair, conditioner, face, baby, deodorant or body.

| Rule | Points | Code key |
|---|---|---|
| Main (first) cleanser is gentle (isethionate, glucoside, betaine, sultaine, sarcosinate, glutamate, taurate, sulfosuccinate, amphoacetate) | +1 | `main-gentle` |
| Harsh cleanser (SLS, ALS, sodium coco-sulfate) in the top 6 | −1; −2 if dry or sensitive | `harsh-top6` |
| Main cleanser is moderate (SLES, other sulfates, olefin sulfonate) | −1 for dry/sensitive only, otherwise a note | `main-moderate` |
| Main cleanser is true soap | −1 for dry/sensitive only, otherwise a note | `main-soap` |
| A bar whose first cleanser is a mild synthetic (Dove) | scored as gentle, not soap | `syndet-bar` (note) |
| Castile label (a plant oil plus sodium/potassium hydroxide in the top 4) | true soap; the oils don't count as moisturizers | `castile` (note) |
| Two or more moisturizers in the top 10 (washes) | +1 | `wash-moisturizers` |
| Conditioner with two or more conditioning agents | +1 | `conditioning` |
| Leave-on: a moisturizer in position 1–2, or three or more in the top 10 | +1 | `leave-on-moisture` |
| Barrier ingredients (ceramides, cholesterol, phytosphingosine, colloidal oatmeal, niacinamide), dry or sensitive skin | +1 | `barrier` |
| Occlusive in the top 5 of a leave-on, dry skin | +1 | `occlusive` |
| Leave-on with no fragrance or essential oils | +1 | `leave-on-unscented` |
| Fragrance | sensitive −2; leave-on or baby −1; rinse-off on normal skin, a note | `fragrance` |
| Essential oils, sensitive skin (fragrance + essential oils capped at −2 total) | −1 | `essential-oils` |
| MIT/MCI (isothiazolinones) | −2 leave-on, −1 rinse-off | `mit` |
| Formaldehyde releaser (DMDM hydantoin, quaternium-15, imidazolidinyl/diazolidinyl urea, bronopol, sodium hydroxymethylglycinate) | −1; −2 if sensitive | `formaldehyde` |
| Parabens, aluminum, talc, cocamide DEA | note only (weak evidence at cosmetic levels; still on the avoid list) | `parabens`, `aluminum`, `talc`, `dea` |
| Dyes, sensitive skin | −1 (otherwise a note) | `dyes` |
| Antibacterial (triclosan, benzalkonium chloride, chloroxylenol…) | −1 (FDA: no better than plain soap for everyday use) | `antibacterial` |
| Drying alcohol in the top 5 of a leave-on, dry/sensitive | −1 (otherwise a note) | `drying-alcohol` |
| Strong acid (AHA) in the top 6, sensitive | −1 | `strong-acid` |
| Salicylic acid / benzoyl peroxide (as the Drug Facts active, or in the top 10), acne-prone ticked | +1 (otherwise a note) | `acne-active` |
| Sunscreen with mineral-only filters, sensitive | +1 (otherwise a note) | `mineral-only` |
| Oxybenzone, sensitive | −1 (otherwise a note) | `oxybenzone` |
| Dandruff active in a shampoo or conditioner, dandruff ticked | +1 (otherwise a note) | `dandruff-active` |
| Coconut oil, cocoa butter, isopropyl myristate/palmitate or lanolin in the top 8 of a leave-on face/sun product, acne-prone | −1 (the evidence is mixed) | `pore-cloggers` |
| Short list (≤ 10) with no fragrance or dyes, sensitive | +1 | `short-list` |

**Always-on notes:**
- Sunscreens: "SPF and broad spectrum come from the front label, not the ingredient list."
- A product labeled "unscented" or "fragrance-free" that lists fragrance.
- Octinoxate or oxybenzone: the Hawaii reef ban.
- How many of the 26 EU fragrance allergens are listed.
- How many ingredients aren't in the knowledge base yet. These are shown and left unscored, never guessed.

**Avoid list:**
- Fragrance (including EU allergen chemicals)
- Essential oils
- Sulfates (a sulfosuccinate is not a sulfate; sodium sulfate is a salt)
- Parabens
- Formaldehyde releasers
- MIT/MCI
- Dyes
- Vegan: tallow, lanolin, beeswax, honey, carmine and animal proteins. Synthetic beeswax doesn't count. Sodium stearate is a "may" flag, which doesn't make a product a Skip.
- Aluminum (antiperspirant salts only)
- Drying alcohol
- Talc
- Oxybenzone
- Your own comma-separated words

### Judgment calls the spec left open

These choices are written into the code and the tests:

- **Positions:** "top N" counts positions in the inactive list. Drug Facts actives count as top, because the label lists them separately with their percentages.
- **UV filters:** count only in a sunscreen, when a filter is a Drug Facts active, or when a chemical filter is present. Otherwise titanium dioxide and zinc oxide are pigments.
- **Antibacterials:** cost a point when listed as the Drug Facts active, or when there's no Active/Inactive split. Listed as an inactive ingredient, it's working as a preservative, so it gets a note.
- **Dandruff active:** counts on hair products only. Native deodorant uses piroctone olamine for odor.
- **Acne active:** counts only when it's the Drug Facts active, or in the top 10 of a list without Drug Facts sections. Lower down, as in CeraVe Hydrating Cream-to-Foam Cleanser, it's a small amount (often there to adjust pH) and gets a note instead.
- **Strong acids:** means AHAs (glycolic, lactic, mandelic, malic, tartaric). Citric acid is a pH adjuster.
- **Benzyl alcohol:** counted as a preservative, not as one of the EU allergens.
- **Allergen-only scent:** when there's no "Fragrance" and no essential oil, listed allergen chemicals count as fragrance. When essential oils are present, the allergens are assumed to come from them and aren't counted twice.
- **Baby products:** the Baby wash and Baby lotion types, or "baby", "newborn" or "infant" in the name.
- **"May contain" items:** not scored. An avoid-list match there is a "may" flag.
- **Better for your skin:** must score higher, have nothing on your avoid list, and not be Think twice itself. For a Skip product, picks must score at least +2.

## Ingredient knowledge base

Every entry in [`js/ingredients.js`](js/ingredients.js) has a group, tags and one plain-English line:
- **Cleansers:** harsh, moderate or gentle.
- **True soap.**
- **Moisturizers:** humectants, emollients/occlusives and barrier ingredients. Fatty alcohols like cetyl and cetearyl are emollients, not drying alcohols.
- **Scent:**
  - fragrance;
  - the EU's 26 allergens;
  - essential oils. These are matched before plant oils, so citrus peel oil counts as scent.
- **Preservatives:** normal, parabens, isothiazolinones, formaldehyde releasers.
- **Dyes:** CI numbers, FD&C/D&C, "Blue 1". CI 77xxx mineral pigments, titanium dioxide and iron oxides are not dyes.
- **Antibacterials.**
- **Drying alcohol:** exact names only.
- **Exfoliant/acne actives.**
- **Aluminum:** antiperspirant salts. Aluminum starch and magnesium aluminum silicate don't count.
- **UV filters:** mineral and chemical.
- **Dandruff actives.**
- **Common neutrals:** water, salt, pH adjusters, chelators, thickeners, PEG/PPG/polysorbate emulsifiers, polymers, plant extracts, and volatile silicones ("feel, not moisture").

The parser:
- Strips "Ingredients:" and Drug Facts headings and drops purpose words ("Sunscreen", "Anti-dandruff").
- Reads percentages before or after a name.
- Splits on top-level commas only. "Soap (A, B or C)" is a sublist sharing one position.
- Treats "A or B", "and/or" and "Et/Ou" as alternatives.
- Keeps "Caprylic/Capric Triglyceride" whole while merging "Water/Aqua/Eau".
- Handles "May contain (+/-):".
- Leaves "D&C Green No. 8", "1,2-Hexanediol" (also "1, 2-Hexanediol") and "Alcohol Denat." intact.
- Resolves parenthesis aliases, including "Aqua [Water]" and "Iron Oxides (CI 77491, 77492, 77499)".
- Strips "*", "organic", footnotes, batch codes, ", USP", HTML entities and foreign headings ("Ingredientes:", "May contain/Peut contenir").
- Reads color and bilingual slash names: "CI 19140/Yellow 5", "Hyaluronic Acid/Acide Hyaluronique".

**Spelling fixes.** Lists photographed from a bottle often come back with OCR errors, and the fixer reads two kinds:
- Words split by spaces ("Isopropyl Pal Mitate").
- One typo, or two on names of 16+ letters ("Steraryl Alcohol", "Pyridoxine HCI", "C 14720").

The fixer only matches exact knowledge-base names. It never accepts a match when the numbers differ ("Benzophenone-2" stays unknown) or when two names are equally close. Every fix is shown on the card ("read as Stearyl Alcohol"), so you can check it against the bottle.

**Coverage.** Checked against 822 real ingredient lists from Open Beauty Facts on 2026-11-09:
- Unknowns fell from 13.1% of ingredients to 3.6% of plausible ingredient names.
- Fully understood lists rose from 23% to 64%.
- Every name seen three or more times is now recognized. `tests/coverage.test.js` keeps it that way, using those 794 names and their counts in `tests/fixtures/common-ingredients.json` (names only, credited to Open Beauty Facts, ODbL).
- Most of what's left is OCR debris, such as addresses, marketing text and merged words, rather than real ingredients.

## Built-in products

62 products. Every list was copied from the linked page on the date shown: 57 from store listings and 5 from brand sites. Your four already-verified products (Head & Shoulders Classic Clean, Pantene 2-in-1, EltaMD UV Clear SPF 46, Johnson's Head-to-Toe 27.1 oz) were re-opened at the same retailers and copied from there.

<details><summary>All 62 products and their sources</summary>

| Product | Type | Source | Checked |
|---|---|---|---|
| Aveeno Baby Calming Comfort Lotion, Lavender & Vanilla | Baby lotion | [Hannaford](https://hannaford.com/groceries/product/aveeno-baby-calming-comfort-lavender-vanilla-scented-lotion-8-oz-sqz/129162) | 2026-11-09 |
| Johnson's Baby Lotion | Baby lotion | [Stop & Shop](https://stopandshop.com/groceries/product/johnsons-baby-lotion-13-6-oz-btl/317621) · barcodes | 2026-11-09 |
| Aveeno Baby Daily Moisture Wash & Shampoo | Baby wash | [Stop & Shop](https://stopandshop.com/groceries/product/aveeno-baby-daily-moisture-lightly-scented-wash-shampoo-pump-18-oz-btl/267741) · barcode | 2026-11-09 |
| Baby Dove Fragrance Free Sensitive Moisture Body Wash | Baby wash | [Hannaford](https://hannaford.com/groceries/product/baby-dove-fragrance-free-sensitive-skin-care-moisture-body-wash-13-oz-btl/222176) | 2026-11-09 |
| Johnson's Head-to-Toe Wash & Shampoo, 27.1 oz | Baby wash | [Hannaford](https://hannaford.com/groceries/product/johnsons-baby-head-to-toe-wash-shampoo-pump-27-1-oz-btl/156988) | 2026-11-09 |
| Dove Original Beauty Bar | Bar soap | [Giant Food](https://giantfood.com/groceries/product/dove-original-beauty-soap-bar-travel-size-2-6-oz-bar/169440) · barcode | 2026-11-09 |
| Dr. Bronner's Pure-Castile Bar Soap, Baby Unscented | Bar soap | [Stop & Shop](https://stopandshop.com/groceries/product/dr-bronners-organic-all-one-baby-unscented-pure-castile-soap-bar-5-oz-bar/143765) | 2026-11-09 |
| Dr. Bronner's Pure-Castile Bar Soap, Hemp Peppermint | Bar soap | [Stop & Shop](https://stopandshop.com/groceries/product/dr-bronners-organic-all-one-hemp-peppermint-pure-castile-soap-bar-5-oz-bar/191070) | 2026-11-09 |
| Ivory Gentle Original Scent Bar Soap | Bar soap | [Hannaford](https://hannaford.com/groceries/product/ivory-gentle-original-scent-soap-bar-10-ct-3-17-oz-bar/395758) | 2026-11-09 |
| Dove Deep Moisture Body Wash | Body wash | [Giant Food](https://giantfood.com/groceries/product/dove-deep-moisture-body-wash-20-oz-btl/151040) | 2026-11-09 |
| Neutrogena Body Clear Body Wash | Body wash | [Giant Food](https://giantfood.com/groceries/product/neutrogena-body-clear-body-wash-with-salicylic-acid-8-5-oz-btl/108500) | 2026-11-09 |
| Old Spice Bearglove Body + Face Wash | Body wash | [Hannaford](https://hannaford.com/groceries/product/old-spice-men-bearglove-body-wash-24-oz-btl/342027) | 2026-11-09 |
| Old Spice Eaglefangs Body + Face Wash | Body wash | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/old-spice-men-eaglefangs-fresh-cloud-scent-body-face-wash-24-oz-btl/361381) | 2026-11-09 |
| Suave Milk & Honey Soothing Body Wash | Body wash | [Food Lion](https://foodlion.com/groceries/product/suave-women-milk-honey-soothing-body-wash-18-oz-btl/398103) | 2026-11-09 |
| Pantene Pro-V Daily Moisture Renewal Conditioner | Conditioner | [Food Lion](https://foodlion.com/groceries/product/pantene-pro-v-daily-moisture-renewal-conditioner-10-4-oz-sqz/321245) | 2026-11-09 |
| CeraVe Moisturizing Cream | Cream | [Stop & Shop](https://stopandshop.com/groceries/product/cerave-moisturizing-cream-normal-to-dry-skin-16-oz-jar/190295) · barcodes | 2026-11-09 |
| Cetaphil Moisturizing Cream | Cream | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/cetaphil-moisturizing-cream-16-oz-jar/320647) | 2026-11-09 |
| Eucerin Original Healing Creme, Fragrance Free | Cream | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/eucerin-original-healing-creme-fragrance-free-16-oz-jar/46202) | 2026-11-09 |
| Vanicream Moisturizing Cream | Cream | [Vanicream (brand site)](https://www.vanicream.com/product/vanicream-moisturizing-cream) | 2026-11-09 |
| Degree Shower Clean Antiperspirant Deodorant | Deodorant | [Food Lion](https://foodlion.com/groceries/product/degree-shower-clean-antiperspirant-deodorant-stick-2-6-oz-pkg/102331) | 2026-11-09 |
| Dove Original Clean Antiperspirant Deodorant | Deodorant | [Hannaford](https://hannaford.com/groceries/product/dove-original-clean-antiperspirant-deodorant-26-oz-2-ct-5-2-oz-pkg/169439) | 2026-11-09 |
| Native Aluminum-Free Deodorant, Citrus & Herbal Musk | Deodorant | [Hannaford](https://hannaford.com/groceries/product/native-citrus-herbal-musk-aluminum-free-deodorant-stick-2-65-oz-pkg/339529) | 2026-11-09 |
| Old Spice Aqua Reef Aluminum Free Deodorant | Deodorant | [Hannaford](https://hannaford.com/groceries/product/old-spice-aqua-reef-cypress-aluminum-free-deodorant-sticks-3oz-2-ct-6-oz-pkg/304670) | 2026-11-09 |
| Secret Powder Fresh Antiperspirant Deodorant Invisible Solid | Deodorant | [Hannaford](https://hannaford.com/groceries/product/secret-powder-fresh-antiperspirant-deodorant-invisible-solid-2-6-oz-pkg/89834) | 2026-11-09 |
| Secret Unscented Antiperspirant Invisible Solid | Deodorant | [Hannaford](https://hannaford.com/groceries/product/secret-unscented-antiperspirant-invisible-solid-2-6-oz-pkg/28094) | 2026-11-09 |
| CeraVe PM Facial Moisturizing Lotion | Face moisturizer | [Hannaford](https://hannaford.com/groceries/product/cerave-pm-facial-moisturizing-lotion-ultra-lightweight-oil-free-3-oz-box/280614) | 2026-11-09 |
| Cetaphil Daily Oil-Free Facial Moisturizer SPF 35 | Face moisturizer | [Giant Food](https://giantfood.com/groceries/product/cetaphil-daily-oil-free-facial-moisturizer-with-sunscreen-spf-35-3-oz-pkg/318334) | 2026-11-09 |
| Neutrogena Hydro Boost Fragrance Free Gel Cream | Face moisturizer | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/neutrogena-hydro-boost-water-gel-fragrance-free-1-7-oz-pkg/352472) | 2026-11-09 |
| Neutrogena Hydro Boost Water Gel | Face moisturizer | [Giant Food](https://giantfood.com/groceries/product/neutrogena-hydro-boost-hyaluronic-acid-water-gel-1-7-oz-pkg/225517) · barcode | 2026-11-09 |
| CeraVe Acne Foaming Cream Cleanser | Face wash | [CeraVe (brand site)](https://www.cerave.com/skincare/cleansers/acne-benzoyl-peroxide-cleanser) | 2026-11-09 |
| CeraVe Hydrating Cream-to-Foam Cleanser | Face wash | [Giant Food](https://giantfood.com/groceries/product/cerave-hydrating-cream-to-foam-cleanser-pump-ceramides-hyaluronic-acid-12-oz-btl/288421) | 2026-11-09 |
| CeraVe Hydrating Facial Cleanser | Face wash | [Giant Food](https://giantfood.com/groceries/product/cerave-hydrating-facial-cleanser-normal-to-dry-skin-pump-hyaluronic-acid-12-oz-btl/189575) · barcodes | 2026-11-09 |
| Cetaphil Gentle Skin Cleanser | Face wash | [Stop & Shop](https://stopandshop.com/groceries/product/cetaphil-gentle-skin-cleanser-dry-to-normal-sensitive-skin-pump-8-oz-btl/319967) · barcode | 2026-11-09 |
| Cetaphil Hydrating Foaming Cream Cleanser | Face wash | [Giant Food](https://giantfood.com/groceries/product/cetaphil-hydrating-foaming-cream-cleanser-16-oz-btl/334965) | 2026-11-09 |
| Clean & Clear Oil-Free Deep Action Cream Cleanser | Face wash | [Hannaford](https://hannaford.com/groceries/product/clean-clear-oil-free-deep-action-cream-cleanser-6-5-oz-sqz/39027) | 2026-11-09 |
| La Roche-Posay Toleriane Hydrating Gentle Facial Cleanser | Face wash | [La Roche-Posay (brand site)](https://www.laroche-posay.us/our-products/face/face-wash/toleriane-hydrating-gentle-facial-cleanser-tolerianehydratinggentlefacialcleanser.html) | 2026-11-09 |
| Neutrogena Oil-Free Acne Wash | Face wash | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/neutrogena-oil-free-acne-wash-salicylic-acid-acne-treatment-pump-6-oz-btl/76677) · barcodes | 2026-11-09 |
| Dial Gold Antibacterial Liquid Hand Soap | Hand soap | [Giant Food](https://giantfood.com/groceries/product/dial-gold-antibacterial-liquid-hand-soap-52-oz-btl/96259) | 2026-11-09 |
| Softsoap Soothing Clean Aloe Vera Liquid Hand Soap | Hand soap | [Giant Food](https://giantfood.com/groceries/product/softsoap-moisturizing-liquid-hand-soap-soothing-clean-aloe-vera-refill-50-oz-btl/172896) | 2026-11-09 |
| Aveeno Daily Moisturizing Body Lotion, Fragrance Free | Lotion | [Hannaford](https://hannaford.com/groceries/product/aveeno-fragrance-free-daily-moisturizing-body-lotion-8-oz-sqz/14930) | 2026-11-09 |
| Aveeno Daily Moisturizing Lotion Sheer Hydration, Fragrance Free | Lotion | [Giant Food](https://giantfood.com/groceries/product/aveeno-daily-moisturizing-lotion-sheer-hydration-dry-skin-fragrance-free-12-oz-btl/251162) | 2026-11-09 |
| Cetaphil Moisturizing Lotion | Lotion | [Stop & Shop](https://stopandshop.com/groceries/product/cetaphil-moisturizing-lotion-16-oz-btl/321868) · barcode | 2026-11-09 |
| Jergens Original Scent Dry Skin Moisturizer | Lotion | [Hannaford](https://hannaford.com/groceries/product/jergens-dry-skin-moisturizer-body-lotion-original-scent-with-cherry-almond-21-oz-btl/38702) | 2026-11-09 |
| Vanicream Moisturizing Lotion | Lotion | [Vanicream (brand site)](https://www.vanicream.com/product/vanicream-moisturizing-lotion) | 2026-11-09 |
| Aquaphor Healing Ointment | Ointment | [Stop & Shop](https://stopandshop.com/groceries/product/aquaphor-healing-ointment-advanced-therapy-1-75-oz-pkg/127532) · barcode | 2026-11-09 |
| Vaseline Petroleum Jelly Original | Ointment | [Stop & Shop](https://stopandshop.com/groceries/product/vaseline-petroleum-jelly-original-13-oz-jar/14572) · barcodes | 2026-11-09 |
| Dove Daily Moisture Damage Therapy Shampoo | Shampoo | [GIANT Food Stores](https://giantfoodstores.com/groceries/product/dove-daily-moisture-damage-therapy-shampoo-28-oz-btl/385396) | 2026-11-09 |
| Dove Intensive Repair Daily Moisture Shampoo | Shampoo | [Hannaford](https://hannaford.com/groceries/product/dove-intensive-repair-daily-moisture-shampoo-18-oz-btl/386305) | 2026-11-09 |
| Head & Shoulders Classic Clean Dandruff Shampoo | Shampoo | [Stop & Shop](https://stopandshop.com/groceries/product/head-shoulders-dandruff-classic-clean-shampoo-20-7-oz-btl/98911) | 2026-11-09 |
| Johnson's Baby Shampoo | Shampoo | [Stop & Shop](https://stopandshop.com/groceries/product/johnsons-baby-shampoo-13-6-oz-btl/28540) | 2026-11-09 |
| Native Moisturizing Shampoo, Sweet Peach & Nectar | Shampoo | [Native (brand site)](https://www.nativecos.com/products/shampoo-moisturizing?variant=47269039571118) | 2026-11-09 |
| OGX Nourishing + Coconut Milk Shampoo | Shampoo | [Giant Food](https://giantfood.com/groceries/product/ogx-nourishing-coconut-milk-shampoo-sulfate-free-13-oz-btl/150288) | 2026-11-09 |
| OGX Renewing + Argan Oil of Morocco Shampoo | Shampoo | [Food Lion](https://foodlion.com/groceries/product/ogx-renewing-argan-oil-of-morocco-shampoo-sulfate-free-13-oz-btl/165002) | 2026-11-09 |
| Pantene Pro-V Daily Moisture Renewal 2-in-1 Shampoo & Conditioner | Shampoo | [Food Lion](https://foodlion.com/groceries/product/pantene-pro-v-daily-moisture-renewal-2-in-1-shampoo-conditioner-12-oz-btl/321244) | 2026-11-09 |
| Selsun Blue Itchy Dry Scalp Anti-Dandruff Shampoo | Shampoo | [Stop & Shop](https://stopandshop.com/groceries/product/selsun-blue-itchy-dry-scalp-anti-dandruff-shampoo-11-oz-btl/176237) | 2026-11-09 |
| Selsun Blue Moisturizing Anti-Dandruff Shampoo | Shampoo | [Food Lion](https://foodlion.com/groceries/product/selsun-blue-moisturizing-anti-dandruff-maximum-strength-shampoo-11-oz-btl/152664) | 2026-11-09 |
| Banana Boat Kids Mineral Sunscreen Lotion Spray SPF 50 | Sunscreen | [Stop & Shop](https://stopandshop.com/groceries/product/banana-boat-kids-mineral-sunscreen-lotion-spray-spf-50-5-oz-can/336361) | 2026-11-09 |
| Banana Boat Sport Ultra Sunscreen Lotion SPF 50 | Sunscreen | [Hannaford](https://hannaford.com/groceries/product/banana-boat-sport-ultra-sunscreen-lotion-water-resistant-spf-50-8-oz-btl/177163) | 2026-11-09 |
| CeraVe Hydrating Mineral Sunscreen SPF 50 (Face) | Sunscreen | [Giant Food](https://giantfood.com/groceries/product/cerave-face-hydrating-mineral-sunscreen-spf-50-2-5-oz-pkg/302258) | 2026-11-09 |
| EltaMD UV Clear Broad-Spectrum SPF 46 | Sunscreen | [Advanced Dermatology shop](https://shop.advancedderm.com/collections/eltamd/products/eltamd-uv-clear-broad-spectrum-spf-46) | 2026-11-09 |
| Neutrogena Pure & Free Baby Sunscreen SPF 50 | Sunscreen | [Stop & Shop](https://stopandshop.com/groceries/product/neutrogena-pure-free-baby-sunscreen-lotion-spf-50-3-0-oz-sqz/186994) | 2026-11-09 |
| Neutrogena Ultra Sheer Dry-Touch Sunscreen SPF 55 | Sunscreen | [Stop & Shop](https://stopandshop.com/groceries/product/neutrogena-ultra-sheer-dry-touch-sunscreen-lotion-water-resistant-spf-55-3-oz-sqz/162530) | 2026-11-09 |

</details>

**Left out** (no complete, clean list on a page that was opened):
- **Banana Boat Sensitive Mineral Enriched SPF 50+:** the store listing has garbled characters ("TriethoxycapryIyIsiIane"), and the brand page shows no ingredient list.
- **Dove Daily Moisture Shampoo & Conditioner box:** it puts two lists in one listing. The standalone Dove Daily Moisture shampoos are included instead.

**Recovered from brand sites:** CeraVe Acne Foaming Cream Cleanser (the store listing split one ingredient with a stray comma) and Native Moisturizing Sweet Peach & Nectar Shampoo (the store listing repeated the list with a note inside it).

## Lookups

[Open Beauty Facts](https://world.openbeautyfacts.org) (free, CORS, no key):
- by barcode: `/api/v2/product/{code}.json?fields=code,product_name,product_name_en,brands,ingredients_text,ingredients_text_en,categories_tags,image_front_small_url`
- search: `/cgi/search.pl?action=process&search_simple=1&json=1&page_size=12&search_terms=…`

Both use a 9-second timeout. US coverage is thin, so every miss, missing list or failure opens the paste box.

**Finding the label-checked version.** A scan tries two things before relying on Open Beauty Facts data:
1. **Built-in barcodes, checked first, instantly and offline.** A built-in carries a barcode only when its Open Beauty Facts entry matches by brand and name, and that entry's ingredient list overlaps the store-copied list by at least 75%. A barcode only covers one size, and the store pages don't show barcodes, so most built-ins don't have one.
2. **Name matching.** When a scanned or searched product's brand and distinctive name words match a built-in, the card, the paste box and the search results offer "Open the label-checked version", with a reminder to compare the name and size.
   - Distinctive words are things like "Classic Clean", "Citrus & Herbal Musk" or "SPF 55".
   - A conflicting word such as "2-in-1", "kids", "sport", "fragrance free" or a different SPF rules the match out.
   - The app never switches products on its own.

## Files

| File | What it does |
|---|---|
| `index.html` | The page and its styles |
| `js/ingredients.js` | Knowledge base and parser |
| `js/verdict.js` | The rules, alternatives and compare |
| `js/products.js` | Built-in products with sources and dates |
| `js/sources.js` | Open Beauty Facts lookups |
| `js/camera.js`, `vendor/html5-qrcode.min.js` | Barcode scanning, copied from the food app (html5-qrcode is Apache-2.0, see `vendor/html5-qrcode.LICENSE`) |
| `js/app.js` | The UI |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline and install |
| `tests/` | `node tests/run.js` (Node's built-in test runner, no dependencies) |
| `scripts/build-single.mjs` | Inlines the JS into one HTML file |
| `scripts/check-labels.js` | Re-checks every built-in list against its source page |
| `.github/workflows/` | Tests on every push; the monthly label check |

Every `js/` file is UMD, so it works in the browser and under `require` in Node.

## Run, test, build

```sh
python -m http.server 8000      # or any static server; open http://localhost:8000
node tests/run.js               # parser, lookups, every rule, products, coverage, determinism
node scripts/build-single.mjs body-care.html
node scripts/check-labels.js    # compare the built-in lists with their source pages (about 3 minutes)
```

## Keeping the lists current

- **Tests** run on GitHub Actions on every push and pull request.
- **Monthly label check:** on the 1st of each month, and on demand from the Actions tab, `scripts/check-labels.js` re-fetches each built-in's source page.
  - It compares the list ingredient by ingredient, so spacing and punctuation don't count.
  - If a list changed, it opens one `label-check` issue (or comments on the open one) listing what was added, removed or reordered, with the new list.
  - Pages it couldn't reach are listed separately and aren't treated as changes.
  - Sites that refuse automated requests (La Roche-Posay) are marked `autoCheck: false`. They're listed under "Check by hand" and never fetched around the block.
  - Nothing is updated automatically. Copy the new list into `js/products.js`, update `checked`, and run the tests.

## Deploy

This is plain static HTML, CSS and JS with no build step. On GitHub: **Settings → Pages → Deploy from a branch → `main` / root**. When you change cached files, bump `CACHE` in `sw.js` so installed copies update.

## Disclaimer

Verdicts are computed by fixed rules, not AI. This is general information, not medical advice. Formulas change, so compare with your bottle.

MIT license.
