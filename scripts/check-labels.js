#!/usr/bin/env node
// Re-checks every built-in ingredient list against its public source page and reports what changed.
//   node scripts/check-labels.js [--report label-report.md]
// Compares ingredient by ingredient (after parsing), so spacing and punctuation changes don't count.
// Pages that can't be reached are reported separately: they are not treated as changes.
// In GitHub Actions it writes the step summary and sets the output attention=true when anything needs a look.
const fs = require("node:fs");
const Ing = require("../js/ingredients.js");
const { PRODUCTS } = require("../js/products.js");

const UA = "ShouldIBuyItBodyCare/1.0 (+https://github.com/QuocHHDo/should-i-buy-it-body; monthly label check)";
const decode = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\\n/g, " ");
const text = html => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The ingredient list on a source page, or null if it can't be found. */
function extract(html) {
  // Stop & Shop, Food Lion, Hannaford, Giant: the list is in the page data.
  const ahold = html.match(/&quot;ingredients&quot;:\[0,&quot;([\s\S]*?)&quot;\]/);
  if (ahold) return decode(ahold[1]).trim();
  // Shopify product pages (Advanced Dermatology shop): an "Active Ingredients:" heading block, then the list in the next
  // block; same for "Inactive Ingredients:". Reading blocks, not running text, skips marketing paragraphs in between.
  const blocks = decode(html.replace(/<\/?(p|div|li|br|h[1-6]|td|tr|section|ul)\b[^>]*>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n").map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const grab = re => { const i = blocks.findIndex(b => re.test(b)); if (i < 0) return null; return blocks[i].replace(re, "").trim() || blocks[i + 1] || null; };
  const act = grab(/^Active Ingredients?:\s*/i), inact = grab(/^Inactive Ingredients?:\s*/i);
  if (act && inact) return "Active Ingredients: " + act.replace(/\.\s*$/, "") + ". Inactive Ingredients: " + inact;
  return null;
}

const names = list => Ing.parse(list).items.map(i => Ing.key(i.name));
/** { same, added, removed, reordered } between the stored list and the one on the page. */
function compare(stored, current) {
  const a = names(stored), b = names(current);
  const added = b.filter(x => !a.includes(x)), removed = a.filter(x => !b.includes(x));
  const same = a.length === b.length && a.every((x, i) => x === b[i]);
  return { same, added, removed, reordered: !same && !added.length && !removed.length };
}

async function fetchPage(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US" }, redirect: "follow", signal: ctrl.signal });
    return { status: res.status, html: res.ok ? await res.text() : "" };
  } catch (e) {
    return { status: 0, error: e.name === "AbortError" ? "timed out" : e.message, html: "" };
  } finally { clearTimeout(timer); }
}

async function main() {
  const reportPath = process.argv.includes("--report") ? process.argv[process.argv.indexOf("--report") + 1] : null;
  const changed = [], unreachable = [], unchanged = [];
  for (const p of PRODUCTS) {
    const r = await fetchPage(p.sourceUrl);
    const name = p.brand + " " + p.name;
    if (!r.html) unreachable.push(`- ${name} ([${p.source}](${p.sourceUrl})): ${r.error || "HTTP " + r.status}`);
    else {
      const list = extract(r.html);
      if (!list) unreachable.push(`- ${name} ([${p.source}](${p.sourceUrl})): page loaded but no ingredient list was found (layout change, or the listing was removed)`);
      else {
        const c = compare(p.ingredients, list);
        if (c.same) unchanged.push(name);
        else changed.push(`### ${name}\n[${p.source} listing](${p.sourceUrl}) · stored list checked ${p.checked}\n` +
          (c.added.length ? `- **Added:** ${c.added.join(", ")}\n` : "") + (c.removed.length ? `- **Removed:** ${c.removed.join(", ")}\n` : "") +
          (c.reordered ? "- **Same ingredients, new order**\n" : "") + `\n<details><summary>List on the page now</summary>\n\n${list}\n\n</details>\n`);
      }
    }
    console.log((r.html ? "checked " : "failed  ") + p.id);
    await new Promise(ok => setTimeout(ok, 3000)); // polite: one page every few seconds
  }
  const today = new Date().toISOString().slice(0, 10);
  const report = [
    `## Label check, ${today}`,
    `${unchanged.length} of ${PRODUCTS.length} built-in lists match their source page.`,
    changed.length ? `\n## ${changed.length} changed\nCopy the new list into \`js/products.js\` (and update \`checked\`), or remove the product if the listing is gone. Run \`node tests/run.js\` after.\n\n${changed.join("\n")}` : "",
    unreachable.length ? `\n## ${unreachable.length} couldn't be checked\nNot treated as changes. Retry from the Actions tab, or open the page yourself.\n\n${unreachable.join("\n")}` : "",
  ].filter(Boolean).join("\n");
  console.log("\n" + report);
  if (reportPath) fs.writeFileSync(reportPath, report + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `attention=${changed.length || unreachable.length ? "true" : "false"}\n`);
}

module.exports = { extract, compare };
if (require.main === module) main();
