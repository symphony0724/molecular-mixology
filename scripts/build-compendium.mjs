// 由 data/compounds.json 生成 samples/06-分子图鉴.html
// 用法： node scripts/build-compendium.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/compounds.json"), "utf8"));

const fac = Object.fromEntries(data.facets.map(f => [f.id, f]));
const layerZh = { top: "前", heart: "中", base: "后", none: "—" };

const fmtTh = v => {
  if (v === null || v === undefined) return "—";
  if (v >= 1) return String(v);
  if (v >= 0.001) return v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  const e = Math.floor(Math.log10(v));
  return `${(v / Math.pow(10, e)).toFixed(0)}e${e}`;
};

const EXT = new Set(["sulfur", "mineral"]);
const mainFacets = data.facets.filter(f => !EXT.has(f.id));
const extFacets = data.facets.filter(f => EXT.has(f.id));
const isExt = c => EXT.has(c.facets[0]);
const mainCompounds = data.compounds.filter(c => !isExt(c));
const extCompounds = data.compounds.filter(isExt);

const byFacet = {};
for (const c of data.compounds) (byFacet[c.facets[0]] ||= []).push(c);

const cnt = k => mainCompounds.filter(c => c.tLayer === k).length;
const lit = data.compounds.filter(c => c.conf === "lit").length;

const card = f => {
  const list = (byFacet[f.id] || []).sort((a, b) => (a.odorMgL ?? 9) - (b.odorMgL ?? 9));
  const rows = list.map(c => `
        <div class="row">
          <b>${c.zh}</b>
          <s>${c.en}</s>
          <em>${fmtTh(c.odorMgL)}</em>
          <i class="t">${layerZh[c.tLayer]}</i>
        </div>`).join("");
  return `
      <section class="card" style="--fc:${f.color}">
        <header>
          <i class="dot">${f.glyph}</i>
          <h3>${f.zh}</h3>
          <s>${f.en}</s>
          <em>${list.length}</em>
        </header>
        <div class="thead"><b>分子</b><s>ENGLISH</s><em>阈值 mg/L</em><i class="t">层</i></div>${rows}
      </section>`;
};

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>分子图鉴 · 分子特调</title>
<style>
  :root{--paper:#F4EFE3;--ink:#2B2620;--ink2:#5A5145;--ink3:#8A7F6C;--copper:#8C5A2B;
        --green:#3E5C4B;--red:#A33B2B;--line:#C9BEA6}
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1440px;background:var(--paper);color:var(--ink);
       font:12px/1.6 "Songti SC",SimSun,serif;-webkit-font-smoothing:antialiased}
  .top{display:flex;align-items:flex-end;gap:14px;padding:22px 30px 12px;border-bottom:2px solid var(--ink)}
  .top h1{font-size:22px;font-weight:600;letter-spacing:.1em}
  .top s{text-decoration:none;font:9.5px/1 Georgia,serif;letter-spacing:.22em;color:var(--copper);padding-bottom:4px}
  .top .sum{margin-left:auto;display:flex;gap:22px;font:9.5px/1 Consolas;color:var(--ink2);padding-bottom:4px}
  .top .sum b{font-weight:400;color:var(--copper)}
  .sub{padding:8px 30px 0;font-size:10px;color:var(--ink3);letter-spacing:.03em}
  .sub b{font-weight:400;color:var(--ink2)}
  .board{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;padding:12px 30px 26px}
  .card{border:1px solid var(--line);background:rgba(255,255,255,.55);border-top:2.5px solid var(--fc);padding:8px 11px 10px}
  .card header{display:flex;align-items:center;gap:7px;padding-bottom:6px;border-bottom:1px solid var(--line)}
  .dot{width:15px;height:15px;border-radius:50%;background:var(--fc);color:#FBF7EC;
       display:inline-flex;align-items:center;justify-content:center;font:9px/1 Georgia,serif;flex:none}
  .card h3{font-size:13px;font-weight:400;letter-spacing:.1em;color:var(--fc)}
  .card header s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.16em;color:var(--ink3)}
  .card header em{margin-left:auto;font:10px/1 Consolas;color:var(--ink3)}
  .thead,.row{display:grid;grid-template-columns:1fr 74px 62px 20px;gap:6px;align-items:baseline}
  .thead{padding:5px 0 3px;font:8px/1 Georgia,serif;letter-spacing:.14em;color:#A99C84}
  .thead em,.thead i{font-style:normal;text-align:right;font:8px/1 Consolas;letter-spacing:.02em}
  .row{padding:3.2px 0;border-bottom:1px dotted rgba(201,190,166,.6);font-size:10.5px}
  .row:last-child{border-bottom:0}
  .row b{font-weight:400}
  .row s{text-decoration:none;font:8px/1.3 Georgia,serif;letter-spacing:.04em;color:#A99C84;
         overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row em{font:9px/1 Consolas;color:var(--copper);text-align:right;font-style:normal}
  .row i{font:8.5px/1 Consolas;color:var(--ink3);text-align:right;font-style:normal}
  .ext{margin:0 30px 4px;border:1px dashed var(--line);background:rgba(255,255,255,.3)}
  .ext summary{list-style:none;cursor:pointer;padding:10px 14px 9px;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
  .ext summary::-webkit-details-marker{display:none}
  .ext summary b{font-weight:400;font-size:12px;letter-spacing:.06em;color:var(--copper)}
  .ext summary s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.18em;color:var(--ink3)}
  .ext summary em{font-style:normal;font:10px/1 Consolas;color:var(--ink2);letter-spacing:.02em}
  .ext summary u{text-decoration:none;flex-basis:100%;font-size:9.5px;line-height:1.6;color:var(--ink3)}
  .ext[open] summary{border-bottom:1px solid var(--line)}
  .extboard{padding:12px 12px 4px}
  .foot{padding:12px 30px 20px;font-size:9px;color:var(--ink3);line-height:1.7}
  .foot b{font-weight:400;color:var(--ink2)}
</style></head><body>
  <div class="top">
    <h1>分子图鉴</h1><s>COMPOUND COMPENDIUM v0.1</s>
    <div class="sum">
      <span><b>${data.compounds.length}</b> 分子</span>
      <span>主族 <b>${mainCompounds.length}</b> · 扩展 <b>${extCompounds.length}</b></span>
      <span>前 <b>${cnt("top")}</b> · 中 <b>${cnt("heart")}</b> · 后 <b>${cnt("base")}</b></span>
      <span>文献值 <b>${lit}</b> / 估算 <b>${data.compounds.length - lit}</b></span>
    </div>
  </div>
  <div class="sub">阈值 = <b>水中的嗅觉阈值</b>，该物质刚可辨认的浓度；数值越小越「一点点就够」。层 = 按挥发速率 + 阈值推的时间层（<b>前 0–5 min / 中 5–30 min / 后 30 min+</b>）。</div>
  <div class="board">${mainFacets.map(card).join("")}</div>
  <details class="ext">
    <summary>
      <b>＋ 展开扩展</b><s>EXTENDED</s>
      <em>硫香 ${byFacet.sulfur?.length ?? 0} · 矿物 / 刺鼻 ${byFacet.mineral?.length ?? 0}</em>
      <u>不属于 12 个主香族：多在「坏掉的时候」才出现，或根本不是气味（盐、氧气、离子）。默认折起来。</u>
    </summary>
    <div class="board extboard">${extFacets.map(card).join("")}</div>
  </details>
  <div class="foot">
    <b>关于数值</b>：阈值来自嗅觉阈值文献的常用引用值，不同文献相差 2–10 倍属正常；标 <b>估算</b> 者按同系物递推，需实测校正。
    <b>关于排序</b>：每族内按阈值升序 —— 越靠前越「一滴就够」，也越容易翻车。
  </div>
</body></html>`;

writeFileSync(join(root, "samples/06-分子图鉴.html"), html, "utf8");
console.log("written samples/06-分子图鉴.html  compounds=" + data.compounds.length);
