/**
 * 把 data/aroma-extra.json 里「新增」的分子合并进 data/ingredients.json
 *
 *   node scripts/merge-aroma.mjs            # 预演，只打印统计
 *   node scripts/merge-aroma.mjs --write    # 真正写回
 *
 * 校验：分子 id 必须存在、不能重复、level 只能是四档；合并后每条至少 4 个分子。
 */
import { readFileSync, writeFileSync } from "node:fs";

const WRITE = process.argv.includes("--write");

const ingDoc = JSON.parse(readFileSync("data/ingredients.json", "utf8"));
const cps = JSON.parse(readFileSync("data/compounds.json", "utf8")).compounds;
const extra = JSON.parse(readFileSync("data/aroma-extra.json", "utf8"));

const CP_BY_ID = new Map(cps.map((c) => [c.id, c]));
const LEVELS = new Set(["dominant", "high", "mid", "low"]);
const W = { dominant: 3, high: 2, mid: 1, low: 0.5 };

const errors = [];
const stats = [];
let added = 0;
let upgraded = 0;

const items = ingDoc.items.map((ing) => {
  const add = extra[ing.id];
  if (!add) {
    errors.push(`[缺补丁] ${ing.id} ${ing.zh} 没有新增条目`);
    return ing;
  }
  const cur = new Map((ing.aroma ?? []).map(([cid, lv]) => [cid, lv]));
  for (const [cid, lv] of add) {
    if (!CP_BY_ID.has(cid)) {
      errors.push(`[坏 id] ${ing.id} ${ing.zh} → ${cid} 不在分子表里`);
      continue;
    }
    if (!LEVELS.has(lv)) {
      errors.push(`[坏 level] ${ing.id} ${ing.zh} → ${cid} = ${lv}`);
      continue;
    }
    const old = cur.get(cid);
    if (!old) {
      cur.set(cid, lv);
      added++;
    } else if (W[lv] > W[old]) {
      cur.set(cid, lv);
      upgraded++;
    }
  }
  const aroma = [...cur.entries()].sort((a, b) => {
    const d = W[b[1]] - W[a[1]];
    if (d) return d;
    return (
      (CP_BY_ID.get(a[0])?.odorMgL ?? 1e9) - (CP_BY_ID.get(b[0])?.odorMgL ?? 1e9)
    );
  });
  if (aroma.length < 4) {
    errors.push(`[太薄] ${ing.id} ${ing.zh} 只有 ${aroma.length} 个分子`);
  }
  const facets = [...new Set(aroma.map(([cid]) => CP_BY_ID.get(cid)?.facets?.[0]).filter(Boolean))];
  stats.push({ id: ing.id, zh: ing.zh, n: aroma.length, facets: facets.length, aromas: aroma });
  return { ...ing, aroma };
});

// 补丁里有、食材表里没有的 id 也要报
const ingIds = new Set(ingDoc.items.map((i) => i.id));
for (const k of Object.keys(extra)) {
  if (k.startsWith("_")) continue;
  if (!ingIds.has(k)) errors.push(`[多余补丁] ${k} 在食材表里不存在`);
}

console.log(`食材 ${ingDoc.items.length} 条，补丁 ${Object.keys(extra).length - 1} 条`);
console.log(`新增分子 ${added} 个，提级 ${upgraded} 个`);
const dist = {};
for (const s of stats) dist[s.n] = (dist[s.n] ?? 0) + 1;
console.log("每条分子数分布", JSON.stringify(dist));
console.log(
  "平均每条",
  (stats.reduce((a, s) => a + s.n, 0) / stats.length).toFixed(2),
  "｜平均香族",
  (stats.reduce((a, s) => a + s.facets, 0) / stats.length).toFixed(2)
);
console.log("\n最薄的前 6 条：");
for (const s of [...stats].sort((a, b) => a.n - b.n).slice(0, 6))
  console.log(`  ${s.zh} ${s.n} 个 / ${s.facets} 族`);

if (errors.length) {
  console.log(`\n问题 ${errors.length} 条：`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
}

if (WRITE && errors.length === 0) {
  ingDoc._meta.count = items.length;
  writeFileSync(
    "data/ingredients.json",
    JSON.stringify({ ...ingDoc, items }, null, 1) + "\n",
    "utf8"
  );
  console.log("\n已写回 data/ingredients.json");
} else if (WRITE) {
  console.log("\n有问题，不写回。");
}
