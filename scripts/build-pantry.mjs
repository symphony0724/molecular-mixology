// 生成「07-食材清单」：读 data/ingredients.json + data/bases.json + data/compounds.json
// 用法： node scripts/build-pantry.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ing = JSON.parse(readFileSync(join(root, "data/ingredients.json"), "utf8"));
const bases = JSON.parse(readFileSync(join(root, "data/bases.json"), "utf8"));
const comp = JSON.parse(readFileSync(join(root, "data/compounds.json"), "utf8"));

const cmpName = Object.fromEntries(comp.compounds.map(c => [c.id, c.zh]));
const cmpEn = Object.fromEntries(comp.compounds.map(c => [c.id, c.en]));
const ingName = Object.fromEntries(ing.items.map(i => [i.id, i.zh]));
const baseName = Object.fromEntries(bases.items.map(b => [b.id, b.zh]));

const FAMS = [
  { id: "fruit",     zh: "水果",   en: "FRUIT",     glyph: "●", color: "#B4693A" },
  { id: "vegetable", zh: "蔬菜",   en: "VEGETABLE", glyph: "▲", color: "#4F7A46" },
  { id: "herb",      zh: "香草",   en: "HERB",      glyph: "✚", color: "#5A5145" },
  { id: "spice",     zh: "香料",   en: "SPICE",     glyph: "✳", color: "#A8503A" },
  { id: "flower",    zh: "花与茶", en: "FLOWER",    glyph: "❀", color: "#8A6E92" },
  { id: "nut",       zh: "坚果",   en: "NUT",       glyph: "✲", color: "#8A6A3A" },
  { id: "dairy",     zh: "乳制品", en: "DAIRY",     glyph: "◕", color: "#C08A5E" },
  { id: "dried",     zh: "干果蜜饯", en: "DRIED",   glyph: "◆", color: "#8B6A3F" },
];
const famMap = Object.fromEntries(FAMS.map(f => [f.id, f]));

const LEVEL = { dominant: 3, high: 3, mid: 2, low: 1 };
const dots = n => `<s class="d">${"●".repeat(n)}<u>${"●".repeat(3 - n)}</u></s>`;

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function card(it) {
  const f = famMap[it.fam];
  const aroma = it.aroma.map(([id, lv]) =>
    `<span class="mm" title="${esc(cmpEn[id] || "")}">${dots(LEVEL[lv] || 1)}${esc(cmpName[id] || id)}</span>`).join("");
  const pairs = (it.pairs || []).map(p =>
    `<b class="${p.startsWith("base-") ? "bp" : "ip"}">${esc(ingName[p] || baseName[p] || p)}</b>`).join("");
  return `<article class="card" style="--c:${f.color}">
  <div class="ch">
    <h3><i style="color:${f.color}">${f.glyph}</i>${esc(it.zh)}<s>${esc(it.en)}</s></h3>
    <em>${esc(it.season)}</em>
  </div>
  <div class="aroma">${aroma}</div>
  <div class="act">${it.actives.map(a => `<span>${esc(a)}</span>`).join("")}</div>
  <div class="meta">
    <span class="num">pH ${it.ph}</span>
    <span class="num">糖 ${it.sugar}</span>
    <span class="num">酸 ${it.acid}</span>
    <span class="tech">${it.tech.join(" ")}</span>
  </div>
  <div class="pairs"><s>配</s>${pairs}</div>
  <p class="note">${esc(it.note)}</p>
  <p class="risk">${esc(it.risk)}</p>
</article>`;
}

function section(f) {
  const items = ing.items.filter(i => i.fam === f.id);
  if (!items.length) return "";
  return `<section class="fam" style="--c:${f.color}">
  <div class="fh"><h2><i>${f.glyph}</i>${f.zh}<s>${f.en}</s></h2><em>${items.length}</em></div>
  <div class="grid">${items.map(card).join("")}</div>
</section>`;
}

const baseRows = bases.items.map(b => `<tr>
  <td class="bn"><b>${esc(b.zh)}</b><s>${esc(b.en)}</s></td>
  <td class="num">${b.abv ? b.abv + "%" : "—"}</td>
  <td class="num">${b.sugar || "—"}</td>
  <td class="num">${b.acid || "—"}</td>
  <td class="num">${b.bubbles === "none" ? "—" : b.bubbles === "high" ? "强" : "弱"}</td>
  <td class="num">${Number(b.density).toFixed(3)}</td>
  <td class="role">${{ base: "基酒", modifier: "调味", dilution: "稀释", sweetener: "甜味", texture: "质地" }[b.role] || b.role}</td>
  <td class="bnote">${esc(b.note)}</td>
</tr>`).join("");

const total = ing.items.length;
const counts = FAMS.map(f => `${f.zh} ${ing.items.filter(i => i.fam === f.id).length}`).join(" · ");

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>食材清单 · 表 A 植物性食材 / 表 B 基底液体</title>
<style>
  :root{--paper:#F4EFE3;--paper2:#FBF7EC;--ink:#2B2620;--ink2:#5B5245;--ink3:#8A8072;
        --copper:#8C5A2B;--green:#3E5C4B;--red:#A33B2B;--line:#C9BEA6}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:13px/1.7 "SimSun","Songti SC",serif;
       background-image:linear-gradient(rgba(201,190,166,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(201,190,166,.22) 1px,transparent 1px);
       background-size:26px 26px;padding:26px 30px 60px}
  .top{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--ink);padding-bottom:9px}
  h1{margin:0;font-size:25px;font-weight:400;letter-spacing:.05em}
  h1 s{text-decoration:none;font:11px/1 Georgia,serif;letter-spacing:.28em;color:var(--ink3);margin-left:13px}
  .top em{font-style:normal;font-size:10.5px;color:var(--ink2);letter-spacing:.04em}
  .top em b{font-family:Consolas;color:var(--copper);font-weight:400}
  .lead{margin:10px 0 20px;font-size:11.5px;color:var(--ink2);line-height:1.85}
  .lead u{text-decoration:none;color:var(--copper)}
  .fam{margin-bottom:22px}
  .fh{display:flex;align-items:baseline;gap:9px;border-bottom:1px solid var(--c);padding-bottom:5px;margin-bottom:11px}
  .fh h2{margin:0;font-size:15px;font-weight:400;letter-spacing:.04em;color:var(--c)}
  .fh h2 i{font-style:normal;margin-right:6px}
  .fh h2 s{text-decoration:none;font:9.5px/1 Georgia,serif;letter-spacing:.26em;color:var(--ink3);margin-left:10px}
  .fh em{margin-left:auto;font-style:normal;font-family:Consolas;font-size:10.5px;color:var(--ink3)}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
  .card{border:1px solid rgba(201,190,166,.95);border-left:3px solid var(--c);background:rgba(255,255,255,.5);
        padding:9px 11px 8px;break-inside:avoid}
  .ch{display:flex;align-items:baseline;gap:6px;margin-bottom:5px}
  .ch h3{margin:0;font-size:14px;font-weight:400;letter-spacing:.03em}
  .ch h3 i{font-style:normal;font-size:9px;margin-right:4px;vertical-align:1px}
  .ch h3 s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.18em;color:var(--ink3);margin-left:6px}
  .ch em{margin-left:auto;font-style:normal;font-family:Consolas;font-size:9px;color:var(--ink3)}
  .aroma{display:flex;flex-wrap:wrap;gap:2px 9px;font-size:11px;margin-bottom:3px}
  .mm{color:var(--ink2);white-space:nowrap}
  .mm s{text-decoration:none;color:var(--c);font-size:8.5px;letter-spacing:.06em;margin-right:2px}
  .mm s u{text-decoration:none;opacity:.22}
  .act{display:flex;flex-wrap:wrap;gap:1px 8px;font-size:10px;color:var(--ink3)}
  .act span::before{content:"· ";color:var(--line)}
  .act span:first-child::before{content:""}
  .meta{display:flex;gap:9px;align-items:baseline;margin-top:4px;font-size:9.5px;color:var(--ink3)}
  .meta .num{font-family:Consolas}
  .meta .tech{margin-left:auto;font-family:Consolas;color:var(--copper);letter-spacing:.06em}
  .pairs{font-size:10.5px;color:var(--ink2);margin-top:2px}
  .pairs s{text-decoration:none;color:var(--ink3);margin-right:5px;font-size:9.5px}
  .pairs b{font-weight:400;border-bottom:1px dotted var(--line);margin-right:7px}
  .pairs b.bp{color:var(--green)}
  .note{margin:5px 0 0;font-size:10.5px;color:var(--ink2);line-height:1.6}
  .risk{margin:2px 0 0;font-size:10px;color:var(--red);line-height:1.55}
  .risk::before{content:"⚠ ";font-size:9px}
  /* 表 B */
  .bsec{margin-top:26px}
  .bsec .fh{--c:var(--green)}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{text-align:left;font-weight:400;font-size:9.5px;color:var(--ink3);letter-spacing:.1em;
     border-bottom:1px solid var(--line);padding:5px 7px}
  td{padding:4.5px 7px;border-bottom:1px dotted rgba(201,190,166,.7);vertical-align:baseline}
  td.num{font-family:Consolas;font-size:10.5px;color:var(--ink2);white-space:nowrap}
  td.bn b{font-weight:400;font-size:11.5px}
  td.bn s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.14em;color:var(--ink3);margin-left:6px}
  td.role{font-size:10px;color:var(--copper);white-space:nowrap}
  td.bnote{font-size:10.5px;color:var(--ink2);line-height:1.55}
  tr:hover td{background:rgba(255,255,255,.55)}
  .foot{margin-top:26px;border-top:1px solid var(--line);padding-top:9px;font-size:10px;color:var(--ink3);line-height:1.8}
</style></head><body>

<div class="top">
  <h1>食材清单<s>PANTRY v0.1</s></h1>
  <em>植物性食材 <b>${total}</b> 条 · 6 个科 · 关键分子引用自 143 条分子表</em>
</div>
<p class="lead">
  表 A 是<u>你冰箱和菜市场里真有的东西</u>：${counts}。<br>
  液体基底（32 条）是<u>另一张表</u>：<u>08-基底液体.html</u>，只在「我有什么酒」那一步被勾选——它决定酒体，不参与香调推导。<br>
  阈值与含量均为<u>分级估算</u>，不是实测；分子前的<u>●●●</u>代表它在这一项里是不是主角（强/中/弱），不是绝对含量。<br>数值单位：糖 g/100g、酸 g/100g（以柠檬酸计）、pH 为整果或汁的近似值。
</p>

${FAMS.map(section).join("")}

<p class="foot">
  数据：<code>data/ingredients.json</code> · <code>data/compounds.json</code><br>
  生成：<code>node scripts/build-pantry.mjs</code>　｜　本页由脚本生成，不要手改 HTML<br>
  已知缺口：「覆盆子酮」「辣椒素」「胡椒碱」「大蒜素」「姜辣素」「山楂酸」「茶多酚」等非挥发特征分子不在 143 条分子表里，现在只以「活性成分」文字出现。<br>
  基底液体见另一张表：<u>08-基底液体.html</u>（32 条）
</p>
</body></html>`;

writeFileSync(join(root, "samples/07-食材清单.html"), html, "utf8");
console.log(`written samples/07-食材清单.html  ingredients=${total} bases=${bases.items.length}`);

// ---------- 表 B：基底液体（独立页面） ----------
const baseHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>基底液体 · 表 B</title>
<style>
  :root{--paper:#F4EFE3;--ink:#2B2620;--ink2:#5B5245;--ink3:#8A8072;--copper:#8C5A2B;--green:#3E5C4B;--line:#C9BEA6}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font:13px/1.7 "SimSun",serif;padding:26px 30px 50px;
       background-image:linear-gradient(rgba(201,190,166,.22) 1px,transparent 1px),linear-gradient(90deg,rgba(201,190,166,.22) 1px,transparent 1px);
       background-size:26px 26px}
  .top{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--ink);padding-bottom:9px}
  h1{margin:0;font-size:25px;font-weight:400;letter-spacing:.05em}
  h1 s{text-decoration:none;font:11px/1 Georgia,serif;letter-spacing:.28em;color:var(--ink3);margin-left:13px}
  .top em{font-style:normal;font-size:10.5px;color:var(--ink2)}
  .top em b{font-family:Consolas;color:var(--copper);font-weight:400}
  .lead{margin:10px 0 18px;font-size:11.5px;color:var(--ink2);line-height:1.85}
  .lead u{text-decoration:none;color:var(--copper)}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{text-align:left;font-weight:400;font-size:9.5px;color:var(--ink3);letter-spacing:.1em;
     border-bottom:1px solid var(--green);padding:6px 8px}
  td{padding:5.5px 8px;border-bottom:1px dotted rgba(201,190,166,.75);vertical-align:baseline}
  td.num{font-family:Consolas;font-size:11px;color:var(--ink2);white-space:nowrap}
  td.bn b{font-weight:400;font-size:12px}
  td.bn s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.14em;color:var(--ink3);margin-left:7px}
  td.role{font-size:10px;color:var(--copper);white-space:nowrap}
  td.bnote{font-size:11px;color:var(--ink2);line-height:1.6}
  tbody tr:hover td{background:rgba(255,255,255,.55)}
  .grp td{background:rgba(62,92,75,.05);font-size:10px;letter-spacing:.16em;color:var(--green);padding:6px 8px}
  .foot{margin-top:22px;border-top:1px solid var(--line);padding-top:9px;font-size:10px;color:var(--ink3);line-height:1.8}
</style></head><body>
<div class="top">
  <h1>基底液体<s>BASE LIQUIDS · TABLE B</s></h1>
  <em>共 <b>${bases.items.length}</b> 条 · ABV / 糖 / 酸 / 气泡 / 密度 / 角色</em>
</div>
<p class="lead">
  这张表<u>不参与香调推导</u>，只在「我有什么酒」那一步被勾选：它决定<u>酒体、甜度、酸度、气泡</u>，不决定香型。<br>
  角色说明：<u>基酒</u>给骨架 · <u>调味</u>给方向 · <u>稀释</u>给长度与气泡 · <u>甜味</u>给平衡 · <u>质地</u>给口感。<br>
  密度用于体积换算（1 ml 酒 ≠ 1 g），糖与酸用于读数的实时计算。
</p>
<table>
  <thead><tr><th>名称</th><th>ABV</th><th>糖 g/100ml</th><th>酸 g/L</th><th>气泡</th><th>密度</th><th>角色</th><th>一句话</th></tr></thead>
  <tbody>${baseRows}</tbody>
</table>
<p class="foot">
  数据：<code>data/bases.json</code>　｜　生成：<code>node scripts/build-pantry.mjs</code><br>
  ABV 与糖酸为常见市售品的<u>典型值</u>，同一品类不同品牌可能相差 20% 以上，界面应允许用户手改。
</p>
</body></html>`;

writeFileSync(join(root, "samples/08-基底液体.html"), baseHtml, "utf8");
console.log(`written samples/08-基底液体.html  bases=${bases.items.length}`);