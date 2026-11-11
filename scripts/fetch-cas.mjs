// 从 PubChem 批量核对 CAS 与分子式
// 用法： node scripts/fetch-cas.mjs [--limit N] [--out data/cas-lookup.json]
// 输出：每条 { id, en, status, cid, cas, formula, formulaMatch }
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const limit = Number(argOf("--limit", "999"));
const out = argOf("--out", "data/cas-lookup.json");

const data = JSON.parse(readFileSync(join(root, "data/compounds.json"), "utf8"));
const list = data.compounds.slice(0, limit);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAS = /^\d{2,7}-\d{2}-\d$/;

async function getJSON(url, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "molecular-mixology/0.1 (local research)" } });
      if (r.status === 404) return null;
      if (!r.ok) { await sleep(800 * (t + 1)); continue; }
      return await r.json();
    } catch { await sleep(800 * (t + 1)); }
  }
  return undefined; // 网络多次失败
}

const GREEK = { "α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ω": "omega", "π": "pi" };
const NAME_FIX = { "TCA": "2,4,6-trichloroanisole" };
const enc = raw => {
  let s = NAME_FIX[raw] || raw;
  s = s.replace(/[αβγδωπ]/g, m => GREEK[m] + "-").replace(/-\s*-/g, "-");
  return encodeURIComponent(s.replace(/[^\x20-\x7E]/g, ""));
};

const results = [];
let i = 0;
for (const c of list) {
  i++;
  const rec = { id: c.id, zh: c.zh, en: c.en, status: "", cid: null, cas: null, formula: null, formulaMatch: null };
  const name = enc(c.en);
  const prop = await getJSON(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${name}/property/MolecularFormula/JSON`);
  await sleep(220);

  if (prop === undefined) { rec.status = "net-fail"; results.push(rec); continue; }
  if (!prop || !prop.PropertyTable?.Properties?.length) { rec.status = "not-found"; results.push(rec); continue; }

  const p = prop.PropertyTable.Properties[0];
  rec.cid = p.CID;
  rec.formula = p.MolecularFormula;
  rec.formulaMatch = (p.MolecularFormula || "") === (c.formula || "");

  const syn = await getJSON(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${p.CID}/synonyms/JSON`);
  await sleep(220);
  if (syn?.InformationList?.Information?.[0]?.Synonym) {
    const all = syn.InformationList.Information[0].Synonym;
    const cas = all.find(s => CAS.test(s));
    rec.cas = cas || null;
  }
  rec.status = rec.cas ? "ok" : "no-cas";
  results.push(rec);
  if (i % 20 === 0) console.log(`  ${i}/${list.length} …`);
}

writeFileSync(join(root, out), JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 1), "utf8");

const ok = results.filter(r => r.status === "ok").length;
const bad = results.filter(r => r.formulaMatch === false).length;
const miss = results.filter(r => r.status === "not-found").length;
console.log(`done: ok=${ok} no-cas=${results.filter(r => r.status === "no-cas").length} not-found=${miss} net-fail=${results.filter(r => r.status === "net-fail").length} formulaMismatch=${bad}`);
