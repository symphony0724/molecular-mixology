import { readFileSync, writeFileSync } from "node:fs";
const D = JSON.parse(readFileSync("data/reactions.json", "utf8"));
const R = D.reactions;


const CP = JSON.parse(readFileSync("data/compounds.json", "utf8"));
const CP_ZH = Object.fromEntries(CP.compounds.map(c => [c.id, c.zh]));
const CLASS_ZH = {
  "carboxylic-acid":"羧酸","alcohol":"醇","ester":"酯","reducing-sugar":"还原糖",
  "amino-acid":"氨基酸","pyrazine":"吡嗪类","sugar":"糖","terpene-peroxide":"萜烯过氧化物",
  "quinone-polymer":"醌类聚合物","anthocyanin-red":"花青素（红）","anthocyanin-blue":"花青素（蓝）",
  "anthocyanin-green":"花青素（绿）","acid":"酸","casein-curd":"酪蛋白凝块","nanoemulsion":"纳米乳液",
  "pectin":"果胶","galacturonic-acid":"半乳糖醛酸","polyphenol":"多酚",
  "iron-polyphenol-complex":"铁-多酚络合物","hydrogen-bonded-cluster":"氢键缔合体"
};
const ENZ_ZH = { pectinase:"果胶酶", "polyphenol oxidase":"多酚氧化酶" };
const ION_ZH = { "fe3":"Fe³⁺", "cu2":"Cu²⁺" };

const MANUAL = {
  "water":"水","ethanol":"乙醇","o2":"氧","d-limonene":"d-柠檬烯","carvone":"香芹酮",
  "catechin":"儿茶素","anthocyanin":"花青素","anethole":"反式茴香脑","casein":"酪蛋白",
  "pectin":"果胶","furaneol":"呋喃酮","maltol":"麦芽酚","diacetyl":"双乙酰","polyphenol":"多酚"
};

const name1 = x => {
  if (x.startsWith("class:")) return CLASS_ZH[x.slice(6)] || x.slice(6);
  if (x.startsWith("compound:")) { const k=x.slice(9); return MANUAL[k] || CP_ZH[k] || k; }
  if (x.startsWith("enzyme:")) return ENZ_ZH[x.slice(7)] || x.slice(7);
  if (x.startsWith("ion:")) return ION_ZH[x.slice(4)] || x.slice(4);
  return x;
};

const MODE_ZH = { chemical:"化学", physical:"物理", equilibrium:"平衡" };
const GROUPS = [
  { key:"desired",    title:"想要的",   en:"DESIRED",    color:"#3E5C4B",
    note:"这些反应把「原料」变成「风味」，多数是技法存在的理由。" },
  { key:"contextual", title:"看场合",   en:"CONTEXTUAL", color:"#8C5A2B",
    note:"不是好坏问题，是量的问题——用对了加分，用多了压死一切。" },
  { key:"avoid",      title:"要避免",   en:"AVOID",      color:"#A33B2B",
    note:"它们在后台一直发生，速度由温度、氧、光、pH 决定。技法的一半工作是踩刹车。" },
];

const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const rxc = r => r.reactants.map(name1).join(" + ");
const prd = r => r.products.map(p => p.sensoryDelta).join(" / ");

const row = r => `
  <div class="rx" style="border-left-color:${GROUPS.find(g=>g.key===r.verdict).color}">
    <div class="c1">${r.no}</div>
    <div class="c2"><b>${esc(r.zh)}</b><s>${esc(r.en)}</s></div>
    <div class="c3"><span class="md">${MODE_ZH[r.mode]}</span></div>
    <div class="c4">${esc(r.condText)}</div>
    <div class="c5"><span class="ed">${esc(rxc(r))}</span><i>→</i><span class="pd">${esc(prd(r))}</span></div>
    <div class="c6">${D.rateZh[r.rate]}${r.reversible ? " · 可逆" : ""}</div>
    <div class="c7"><s>机理</s><p>${esc(r.mechanism)}</p></div>
    <div class="c8"><s>调酒里</s><p>${esc(r.teaching)}</p></div>
    ${r.avoid ? `<div class="c9"><s>怎么避免</s><p>${esc(r.avoid)}</p></div>` : ""}
  </div>`;

const group = g => {
  const items = R.filter(r => r.verdict === g.key);
  return `
  <div class="ghead" style="border-left-color:${g.color}">
    <b style="color:${g.color}">${g.title}</b><s>${g.en}</s><em>${items.length} 条</em>
    <span>${g.note}</span>
  </div>
  ${items.map(row).join("")}`;
};

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>反应表 · 分子特调</title>
<style>
  :root{--paper:#F4EFE3;--ink:#2B2620;--ink2:#4C453B;--ink3:#7A7264;
        --copper:#8C5A2B;--green:#3E5C4B;--red:#A33B2B;--line:#C9BEA6}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);
    font-family:"SimSun","Songti SC",serif;
    background-image:linear-gradient(rgba(201,190,166,.16) 1px,transparent 1px),
                     linear-gradient(90deg,rgba(201,190,166,.16) 1px,transparent 1px);
    background-size:26px 26px}
  .wrap{padding:26px 30px 24px}
  header{display:flex;align-items:baseline;gap:14px;border-bottom:2px solid var(--ink);padding-bottom:9px}
  h1{margin:0;font-size:25px;letter-spacing:.09em;font-weight:400}
  h1 em{font:9.5px/1 Georgia,serif;letter-spacing:.28em;color:var(--copper);font-style:normal;margin-left:10px}
  header .meta{margin-left:auto;font-size:10px;color:var(--ink3);letter-spacing:.05em}
  header .meta b{font-family:Consolas;color:var(--ink);font-size:11px}
  .lead{font-size:10.5px;line-height:1.75;color:var(--ink2);padding:8px 0 4px}
  .lead b{color:var(--ink)}
  .lead u{text-decoration:none;border-bottom:1px dotted var(--ink3)}
  .lg{display:inline-block;width:8px;height:8px;margin-right:4px;vertical-align:middle}
  .ghead{display:flex;align-items:baseline;gap:9px;padding:11px 0 5px 9px;margin-top:9px;
    border-left:3px solid;border-bottom:1px solid var(--line)}
  .ghead b{font-size:13px;letter-spacing:.08em;font-weight:400}
  .ghead s{text-decoration:none;font:8.5px/1 Georgia,serif;letter-spacing:.2em;color:var(--ink3)}
  .ghead em{font-style:normal;font:10px/1 Consolas;color:var(--ink3)}
  .ghead span{margin-left:6px;font-size:9.5px;color:var(--ink3)}
  .rx{display:grid;grid-template-columns:44px 176px 46px 150px 1fr 84px;
    grid-template-areas:"n t m c e r" ". . . k1 k1 k1" ". . . k2 k2 k2" ". . . k3 k3 k3";
    border-left:3px solid;border-bottom:1px dotted var(--line);padding:7px 0 7px 9px;align-items:baseline;gap:0 8px}
  .c1{grid-area:n;font:11px/1.5 Consolas;color:var(--ink3)}
  .c2{grid-area:t}.c2 b{font-size:12px;font-weight:400}
  .c2 s{display:block;text-decoration:none;font:8.5px/1.5 Georgia,serif;letter-spacing:.04em;color:var(--ink3)}
  .c3{grid-area:m}.md{font-size:8.5px;color:var(--ink3);border:1px solid var(--line);padding:0 4px}
  .c4{grid-area:c;font-size:10px;color:var(--ink2)}
  .c5{grid-area:e;font-size:10px;line-height:1.6}
  .c5 .ed{color:var(--ink3)}.c5 i{font-style:normal;color:var(--copper);padding:0 5px}
  .c5 .pd{color:var(--ink)}
  .c6{grid-area:r;font-size:9.5px;color:var(--ink3);text-align:right}
  .c7{grid-area:k1}.c8{grid-area:k2}.c9{grid-area:k3}
  .c7,.c8,.c9{display:flex;gap:6px;font-size:9.8px;line-height:1.6;padding-top:2px}
  .c7 s,.c8 s,.c9 s{flex:none;text-decoration:none;font-size:8.5px;color:var(--ink3);width:38px;padding-top:1px}
  .c7 p,.c8 p,.c9 p{margin:0;color:var(--ink2)}
  .c8 p{font-family:"KaiTi","STKaiti",serif;font-size:11px;color:var(--copper)}
  .c9 p{color:var(--red)}
  footer{margin-top:12px;border-top:1px solid var(--line);padding-top:7px;
    font-size:9px;color:var(--ink3);line-height:1.7;display:flex;gap:14px}
</style></head><body><div class="wrap">
<header>
  <h1>反应表<em>REACTIONS · TABLE D</em></h1>
  <div class="meta">共 <b>${R.length}</b> 条 · 化学 ${R.filter(r=>r.mode==="chemical").length} · 物理 ${R.filter(r=>r.mode==="physical").length} · 平衡 ${R.filter(r=>r.mode==="equilibrium").length} · 反向（要避免）${R.filter(r=>r.verdict==="avoid").length} 条</div>
</header>
<div class="lead">
  <b>这不是步骤表，是「在什么条件下会发生什么」。</b>条件写成区间，因为它们是阈值不是开关：pH 从 4.7 降到 4.4，奶洗才真的开始分层。<br>
  <span class="lg" style="background:var(--green)"></span>想要的 &nbsp;
  <span class="lg" style="background:var(--copper)"></span>看场合 &nbsp;
  <span class="lg" style="background:var(--red)"></span>要避免 —
  <u>反应物里的 class: 表示「任意具该类结构的分子」</u>，不是某一种。判定只说明「这反应对成品合不合意」，不说明危险程度。
</div>
${GROUPS.map(group).join("")}
<footer>
  <span>数据：data/reactions.json · data/compounds.json · data/structures.json</span>
  <span>生成：node scripts/build-reactions.mjs</span>
  <span>速率标的是「常温常压下明显发生」所需的时间尺度；温度每升 10℃ 大约快 2 倍</span>
</footer>
</div></body></html>`;

writeFileSync("samples/16-反应表.html", html, "utf8");
console.log("written samples/16-反应表.html", R.length);
