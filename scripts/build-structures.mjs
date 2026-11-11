// 由 data/structures.json 生成 samples/10-结构分子表.html
// 用法： node scripts/build-structures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data/structures.json"), "utf8"));
const ingredients = JSON.parse(readFileSync(join(root, "data/ingredients.json"), "utf8"));
const bases = JSON.parse(readFileSync(join(root, "data/bases.json"), "utf8"));

// 表 A / 表 B 里没有、但结构分子表需要提及的条目（添加剂、器具、未收录食材）
const EXTRA = {
  "ing-agar": "琼脂", "ing-alginate": "海藻酸钠", "ing-beetroot": "甜菜根", "ing-cabbage": "卷心菜",
  "ing-calcium-lactate": "乳酸钙", "ing-carrageenan": "卡拉胶", "ing-citrus-peel": "柑橘皮",
  "ing-copper": "铜器", "ing-dragonfruit": "火龙果", "ing-edamame": "毛豆", "ing-eggwhite": "蛋白",
  "ing-flour": "面粉", "ing-gelatin": "明胶", "ing-gellan": "结冷胶", "ing-horseradish": "辣根",
  "ing-iron": "铁器", "ing-kombucha": "康普茶", "ing-licorice": "甘草", "ing-longpepper": "荜拨",
  "ing-matcha": "抹茶", "ing-mineral-water": "矿泉水", "ing-oak": "橡木", "ing-pomegranate": "石榴",
  "ing-potato": "土豆", "ing-quince": "榅桲", "ing-quinoa": "藜麦", "ing-redwine": "干红",
  "ing-rhubarb": "大黄", "ing-rice": "米", "ing-salt": "盐", "ing-soymilk": "豆乳",
  "ing-spinach": "菠菜", "ing-vinegar": "醋", "ing-wine": "葡萄酒", "ing-xanthan": "黄原胶",
  "ing-sichuan-pepper": "花椒", "ing-jasmine-tea": "茉莉花茶", "ing-milk": "牛奶",
  "ing-onion": "洋葱", "ing-caper": "刺山柑", "ing-papaya": "木瓜"
};
const ingName = {
  ...EXTRA,
  ...Object.fromEntries(bases.items.map(i => [i.id, i.zh])),
  ...Object.fromEntries(ingredients.items.map(i => [i.id, i.zh])),
};
const labelOf = id => ingName[id] || id.replace(/^(ing|base)-/, "");

const SOL = ["不", "微", "可", "易"];
const LV = [["安全", "ok"], ["注意", "warn"], ["限量", "bad"]];
const solCell = it => (["w", "e", "o"]).map(k => {
  const v = it.sol?.[k] ?? 0;
  return `<i class="s s${v}" title="${k === "w" ? "水" : k === "e" ? "乙醇" : "油"}：${["不溶","微溶","可溶","易溶"][v]}">${SOL[v]}</i>`;
}).join("·");
const clsOf = Object.fromEntries(data.classes.map(c => [c.id, c]));

const byCls = {};
for (const it of data.items) (byCls[it.cls] ||= []).push(it);

const rows = list => list.map(it => `
        <tr>
          <td class="nm"><b>${it.zh}</b><s>${it.en}</s></td>
          <td class="fx">${it.formula}</td>
          <td class="sl">${solCell(it)}</td>
          <td class="ef">${it.effect}</td>
          <td class="cd">${it.cond}</td>
          <td class="tx">${(it.tox?.lv ?? 0) === 0 && !it.tox?.note ? `<i class="dash">—</i>` : `<em class="lv ${LV[it.tox?.lv ?? 0][1]}">${LV[it.tox?.lv ?? 0][0]}</em>${it.tox?.note || ""}`}</td>
          <td class="fr">${it.from.map(id => `<span>${labelOf(id)}</span>`).join("")}</td>
          <td class="tc">${it.tech.join(" ")}</td>
        </tr>`).join("");

const block = c => {
  const list = byCls[c.id] || [];
  return `
      <section class="blk" style="--cc:${c.color}">
        <header>
          <i class="dot">${c.glyph}</i>
          <h3>${c.zh}</h3><s>${c.en}</s><em>${list.length}</em>
        </header>
        <table>
          <thead><tr>
            <th class="nm">名称</th><th class="fx">分子式</th><th class="sl">水/醇/油</th>
            <th class="ef">作用</th><th class="cd">条件</th><th class="tx">限量与风险</th><th class="fr">来自</th><th class="tc">技法</th>
          </tr></thead>
          <tbody>${rows(list)}</tbody>
        </table>
      </section>`;
};

const lit = data.items.filter(i => i.conf === "lit").length;

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>结构分子表 · 分子特调</title>
<style>
  :root{--paper:#F4EFE3;--ink:#2B2620;--ink2:#5A5145;--ink3:#8A7F6C;--copper:#8C5A2B;
        --green:#3E5C4B;--red:#A33B2B;--line:#C9BEA6}
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1440px;background:var(--paper);color:var(--ink);
       font:12px/1.6 "Songti SC",SimSun,serif;-webkit-font-smoothing:antialiased}
  .top{display:flex;align-items:flex-end;gap:14px;padding:22px 30px 12px;border-bottom:2px solid var(--ink)}
  .top h1{font-size:22px;font-weight:600;letter-spacing:.1em}
  .top s{text-decoration:none;font:9.5px/1 Georgia,serif;letter-spacing:.22em;color:var(--copper);padding-bottom:4px}
  .top .sum{margin-left:auto;display:flex;gap:20px;font:9.5px/1 Consolas;color:var(--ink2);padding-bottom:4px}
  .top .sum b{font-weight:400;color:var(--copper)}
  .sub{padding:9px 30px 0;font-size:10px;color:var(--ink3);letter-spacing:.03em;line-height:1.9}
  .sub b{font-weight:400;color:var(--ink2)}
  .sub u{text-decoration:none;border-bottom:1px dotted var(--copper);color:var(--ink2)}
  .board{padding:12px 30px 26px;display:flex;flex-direction:column;gap:12px}
  .blk section,.blk{border:1px solid var(--line);background:rgba(255,255,255,.42)}
  .blk header{display:flex;align-items:center;gap:8px;padding:7px 12px 6px;border-bottom:1px solid var(--line);
              border-left:3px solid var(--cc);background:rgba(251,247,236,.7)}
  .blk .dot{width:15px;height:15px;border-radius:50%;background:var(--cc);color:#FBF7EC;
            font-size:8px;line-height:15px;text-align:center;flex:none}
  .blk h3{font-size:13px;font-weight:400;letter-spacing:.04em}
  .blk header s{text-decoration:none;font:8px/1 Georgia,serif;letter-spacing:.2em;color:var(--ink3)}
  .blk header em{margin-left:auto;font-style:normal;font-family:Consolas;font-size:9.5px;color:var(--ink3)}
  table{width:100%;border-collapse:collapse}
  thead th{font-weight:400;font-size:9px;letter-spacing:.12em;color:var(--ink3);text-align:left;
           padding:4px 8px;border-bottom:1px solid var(--line);background:rgba(201,190,166,.14)}
  tbody td{padding:5px 8px;border-bottom:1px dotted rgba(201,190,166,.75);vertical-align:top;font-size:10.5px;line-height:1.55}
  tbody tr:last-child td{border-bottom:0}
  .nm{width:146px}
  .nm b{display:block;font-weight:400;font-size:11.5px;letter-spacing:.02em}
  .nm s{display:block;text-decoration:none;font:8.5px/1.4 Georgia,serif;letter-spacing:.04em;color:var(--ink3)}
  .fx{width:100px;font-family:Consolas;font-size:9.5px;color:var(--ink2)}
  .sl{width:64px;font-family:Consolas;letter-spacing:.14em}
  .sl i{font-style:normal;font-size:9.5px;color:var(--ink3)}
  .sl i.s3{color:var(--green)} .sl i.s0{color:var(--red)}
  .tx{width:236px;font-size:9.5px;color:var(--ink2);line-height:1.5}
  .tx em{font-style:normal;font-size:8.5px;letter-spacing:.06em;padding:0 4px;border:1px solid currentColor;margin-right:4px;white-space:nowrap}
  .tx em.ok{color:var(--green)} .tx em.warn{color:var(--copper)} .tx em.bad{color:var(--red)}
  .tx s{text-decoration:none;display:inline}
  .tx .dash{font-style:normal;color:var(--ink3)}
  .ef{width:206px}
  .cd{width:192px;color:var(--ink2);font-size:10px}
  .fr{width:132px;font-size:9.5px;color:var(--ink2)}
  .fr span{display:inline-block;margin:0 5px 1px 0;border-bottom:1px dotted var(--line)}
  .tc{width:62px;font-family:Consolas;font-size:9px;color:var(--copper);letter-spacing:.02em}
  .foot{padding:0 30px 22px;font-size:9.5px;color:var(--ink3);line-height:1.8}
  .foot b{font-weight:400;color:var(--ink2)}
  .foot u{text-decoration:none;border-bottom:1px dotted var(--copper)}
</style></head>
<body>
  <div class="top">
    <h1>结构分子表</h1><s>STRUCTURAL COMPOUNDS · TABLE C</s>
    <div class="sum">
      <span><b>${data.items.length}</b> 个条目</span><span><b>${data.classes.length}</b> 个类</span>
      <span>文献值 <b>${lit}</b> / 估算 <b>${data.items.length - lit}</b></span>
      <span>与 143 条挥发分子<b>互补、不重复</b></span>
    </div>
  </div>
  <div class="sub">
    这张表收的是<b>闻不到的那一半</b>：决定颜色、涩感、浑浊、凝胶、辣、酸度与离子反应的分子和离子。它们大多不挥发或阈值极高，但在杯子里做的每一件事都比香气更明显。<br>
    <u>水溶性</u>：不溶 / 微溶 / 可溶 / 易溶（决定它进果汁还是进油）；<u>条件</u>：它什么时候发作——这是能不能用技法的判据；<u>技法</u>编号见 03 技法工作台（T1 慢煮 … T20 冷熏）。
  </div>
  <div class="board">${data.classes.map(block).join("")}
  </div>
  <div class="foot">
    数据：<b>data/structures.json</b> · <b>data/ingredients.json</b> ｜ 生成：<b>node scripts/build-structures.mjs</b> ｜ 本页由脚本生成，不要手改 HTML<br>
    自我限制：<b>分子式为示意</b>（多酚、蛋白、多糖多为混合物，给不出单一体；写了「—」的就是没有单体），CAS 仅对单一化合物有效；<u>溶解度是水/醇/油三档粗估</u>，不是实测值；<u>限量只是定性提示</u>，不是毒理阈值，不用于安全判定；<b>酶是「工具」不是「成分」</b>，条目里写的是它的工作条件而不是含量；「来自」只列了表 A/B 里出现过的食材，不代表其他食材没有。
  </div>
</body></html>`;

writeFileSync(join(root, "samples/10-结构分子表.html"), html, "utf8");
console.log(`written samples/10-结构分子表.html  items=${data.items.length} classes=${data.classes.length}`);
