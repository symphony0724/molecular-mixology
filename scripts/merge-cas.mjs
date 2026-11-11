// 把 PubChem 核对结果写回 data/compounds.json
// 用法： node scripts/merge-cas.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");

const data = JSON.parse(readFileSync(join(root, "data/compounds.json"), "utf8"));
const lookup = JSON.parse(readFileSync(join(root, "data/cas-lookup.json"), "utf8"));
const byId = Object.fromEntries(lookup.results.map(r => [r.id, r]));

let changed = 0, filled = 0, kept = 0, missing = 0;
const diff = [];
for (const c of data.compounds) {
  const r = byId[c.id];
  if (!r) { missing++; continue; }
  if (r.status !== "ok" || !r.cas) { kept++; continue; }
  if (!c.cas) { c.cas = r.cas; filled++; changed++; console.log(`  + ${c.id} ${c.zh} → ${r.cas}`); }
  else if (c.cas !== r.cas) {
    // PubChem 取的是 synonyms 里第一个匹配项，未必是我们要的异构体；
    // 默认只记录、不改写，避免把更具体的编号换成通用条目。
    diff.push({ id: c.id, zh: c.zh, en: c.en, local: c.cas, pubchem: r.cas });
    if (force) { c.cas = r.cas; changed++; } else kept++;
  } else kept++;
}

data._meta.updated = new Date().toISOString().slice(0, 10);
data._meta.casChecked = "PubChem PUG REST, " + lookup.generatedAt.slice(0, 10);
data._meta.count = data.compounds.length;
if (diff.length) {
  const lines = ["# CAS 待复核", "", "| id | 名称 | 本地 | PubChem |", "|---|---|---|---|",
    ...diff.map(d => `| ${d.id} | ${d.zh} ${d.en} | ${d.local} | ${d.pubchem} |`), "",
    "> PubChem 只取 synonyms 里第一个 CAS，异构体/通用条目常混在一起；本地值多为更具体的异构体编号，保留待人工确认。"];
  if (!dry) writeFileSync(join(root, "data/cas-review.md"), lines.join("\n") + "\n", "utf8");
}

if (!dry) writeFileSync(join(root, "data/compounds.json"), JSON.stringify(data, null, 1) + "\n", "utf8");
console.log(`\nchanged=${changed} filled=${filled} kept=${kept} diff=${diff.length} missingLookup=${missing} total=${data.compounds.length}${dry ? " (dry run)" : ""}`);
