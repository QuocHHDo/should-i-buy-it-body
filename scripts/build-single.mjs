#!/usr/bin/env node
// Builds one self-contained HTML file (all scripts inlined) for hosts that serve a single file.
//   node scripts/build-single.mjs out.html
// Pages-only bits (manifest, icons, service worker, footer links) are left out.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const [out] = process.argv.slice(2);
if (!out) { console.error("usage: node scripts/build-single.mjs out.html"); process.exit(1); }

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const safe = s => s.replace(/<\/script/gi, "<\\/script");
const single = html
  .split("\n").filter(l => !(/data-pages-only/.test(l) && /^\s*<(meta|link)\b/.test(l))).join("\n")
  .replace(/<script>window\.BODY_CONFIG[^<]*<\/script>/, `<script>window.BODY_CONFIG = { mode: "single" };</script>`)
  .replace(/<script src="([^"]+)"><\/script>/g, (m, src) => `<script>\n${safe(fs.readFileSync(path.join(ROOT, src), "utf8"))}\n</script>`);

fs.writeFileSync(out, single);
console.log(`Wrote ${out} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
