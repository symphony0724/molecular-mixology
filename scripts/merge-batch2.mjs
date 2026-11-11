/**
 * 第二批数据：分子补充 + 获取难度 + 含水/浸出率
 *
 *   node scripts/merge-batch2.mjs            # 预演
 *   node scripts/merge-batch2.mjs --write    # 写回 data/ingredients.json
 *
 * 校验：分子 id / level、avail 两元组、water 0–100、leach 0–1；合并后每条 ≥6 个分子。
 */
import { readFileSync, writeFileSync } from "node:fs";

const WRITE = process.argv.includes("--write");

const ingDoc = JSON.parse(readFileSync("data/ingredients.json", "utf8"));
const cps = JSON.parse(readFileSync("data/compounds.json", "utf8")).compounds;
const extra = JSON.parse(readFileSync("data/ingredients-extra2.json", "utf8"));

const CP = new Map(cps.map((c) => [c.id, c]));
const LEVELS = new Set(["dominant", "high", "mid", "low"]);
const AVAIL = new Set(["easy", "mid", "hard"]);
const W = { dominant: 3, high: 2, mid: 1, low: 0.5 };

const errors = [];
let added = 0;

const items = ingDoc.items.map((ing) => {
  const x = extra[ing.id];
  if (!x) {
    errors.push(`[缺补丁] ${ing.id} ${ing.zh}`);
    return ing;
  }
  const cur = new Map((ing.aroma ?? []).map(([cid, lv]) => [cid, lv]));
  for (const [cid, lv] of x.aroma ?? []) {
    if (!CP.has(cid)) errors.push(`[坏 id] ${ing.zh} → ${cid}`);
    else if (!LEVELS.has(lv)) errors.push(`[坏 level] ${ing.zh} → ${cid}=${lv}`);
    else if (!cur.has(cid)) {
      cur.set(cid, lv);
      added++;
    }
  }
  const aroma = [...cur.entries()].sort((a, b) => {
    const d = W[b[1]] - W[a[1]];
    if (d) return d;
    return (CP.get(a[0])?.odorMgL ?? 1e9) - (CP.get(b[0])?.odorMgL ?? 1e9);
  });
  if (aroma.length < 6) errors.push(`[太薄] ${ing.zh} 只有 ${aroma.length} 个分子`);

  const [lv, where] = x.avail ?? [];
  if (!AVAIL.has(lv)) errors.push(`[坏 avail] ${ing.zh} = ${lv}`);
  if (typeof where !== "string" || !where) errors.push(`[缺 where] ${ing.zh}`);

  if (!(x.water >= 0 && x.water <= 100)) errors.push(`[坏 water] ${ing.zh} = ${x.water}`);
  if (!(x.leach > 0 && x.leach <= 1)) errors.push(`[坏 leach] ${ing.zh} = ${x.leach}`);

  return {
    ...ing,
    aroma,
    avail: { lv, where },
    water: x.water,
    leach: x.leach,
  };
});

const ingIds = new Set(ingDoc.items.map((i) => i.id));
for (const k of Object.keys(extra))
  if (!k.startsWith("_") && !ingIds.has(k)) errors.push(`[多余补丁] ${k}`);

const dist = {};
for (const i of items) dist[(i.aroma ?? []).length] = (dist[(i.aroma ?? []).length] ?? 0) + 1;
const avg = items.reduce((s, i) => s + (i.aroma ?? []).length, 0) / items.length;

console.log(`食材 ${items.length}｜新增分子 ${added}｜平均 ${avg.toFixed(2)} 个`);
console.log("分子数分布", JSON.stringify(dist));
const byLv = {};
for (const i of items) byLv[i.avail.lv] = (byLv[i.avail.lv] ?? 0) + 1;
console.log("获取难度", JSON.stringify(byLv));
console.log(
  "含水与浸出率：",
  items
    .slice(0, 4)
    .map((i) => `${i.zh} ${i.water}% / ${i.leach}`)
    .join("  ")
);

if (errors.length) {
  console.log(`\n问题 ${errors.length} 条：`);
  for (const e of errors.slice(0, 20)) console.log("  " + e);
}
if (WRITE && !errors.length) {
  ingDoc._meta.count = items.length;
  ingDoc._meta.fields.avail = "获取难度 [easy|mid|hard, 说明]";
  ingDoc._meta.fields.water = "含水 %";
  ingDoc._meta.fields.leach = "1:1 浸渍时可溶性固形物的浸出率（0–1）";
  writeFileSync(
    "data/ingredients.json",
    JSON.stringify({ ...ingDoc, items }, null, 1) + "\n",
    "utf8"
  );
  console.log("\n已写回");
} else if (WRITE) console.log("\n有问题，不写回。");
