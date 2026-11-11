import { baseById, ingById } from "./data";
import type { Line, Reading } from "./calc";

export type Tone = "up" | "down" | "mix" | "warn";

export interface Hint {
  id: string;
  tag: string;
  tone: Tone;
  title: string;
  text: string;
  impact: number;
  evidence: "文献" | "机理" | "共识";
}

const has = (arr: string[] | undefined, ...kw: string[]) =>
  (arr ?? []).some((a) => kw.some((k) => a.includes(k)));

function flags(lines: Line[]) {
  const f = {
    anyAroma: false,
    dairy: false,
    tannin: false,
    acid: false,
    spice: false,
    bubble: false,
    strong: false,
    whiteSpirit: false,
    citrus: false,
  };
  for (const l of lines) {
    if (!l.amount) continue;
    if (l.kind === "ing") {
      const i = ingById.get(l.refId);
      if (!i) continue;
      if ((i.aroma ?? []).length) f.anyAroma = true;
      if (i.fam === "dairy") f.dairy = true;
      if (has(i.actives, "单宁", "多酚")) f.tannin = true;
      if ((i.acid ?? 0) > 0.5 || (i.ph ?? 7) < 4) f.acid = true;
      if (has(i.actives, "辣椒素", "姜辣", "胡椒碱")) f.spice = true;
      if (has([i.zh], "柠檬", "青柠")) f.citrus = true;
      if ((i.fam === "herb" || i.fam === "spice") && (i.aroma ?? []).length) f.anyAroma = true;
    } else {
      const b = baseById.get(l.refId);
      if (!b) continue;
      if (b.role === "texture") f.dairy = true;
      if (b.bubbles !== "none") f.bubble = true;
      if (b.abv >= 50) f.strong = true;
      if (b.zh === "白酒") f.whiteSpirit = true;
    }
  }
  return f;
}

export function interactions(lines: Line[], r: Reading): Hint[] {
  const f = flags(lines);
  const out: Hint[] = [];

  if (r.abv > 25 && f.anyAroma) {
    out.push({
      id: "abv-aroma",
      tag: "抑制",
      tone: "down",
      title: "乙醇 过高 · 果香被压住",
      text: "乙醇超过 25% 会明显压低酯类与萜烯的逸出——香气还在杯里，就是上不来。想保住果香，把总酒精度降到 18–20%。",
      impact: 3,
      evidence: "文献",
    });
  }

  if (r.sugarG100 > 12 && f.anyAroma) {
    out.push({
      id: "sugar-aroma",
      tag: "抑制",
      tone: "down",
      title: "糖 过高 · 香气被压",
      text: `现在 ${r.sugarG100.toFixed(1)} g/100mL，超过 12 会明显压香。糖降到 10 以下，同一杯会显得更「香」，不会更甜。`,
      impact: 2,
      evidence: "共识",
    });
  }

  if (f.dairy && f.spice) {
    out.push({
      id: "fat-capsaicin",
      tag: "掩蔽",
      tone: "mix",
      title: "脂肪 · 掩蔽辣感",
      text: "辣椒素是脂溶性的，乳脂会把它从受体上带走。同一份辣椒，有奶时「辣度」大约掉一半，但刺激的余味还在。",
      impact: 2,
      evidence: "文献",
    });
  }

  if (f.bubble && r.acidGL > 2.5) {
    out.push({
      id: "co2-acid",
      tag: "协同",
      tone: "up",
      title: "气泡 · 把酸感抬高约一成",
      text: "CO₂ 在口腔转成碳酸，同时把香气送进鼻腔后段。同一配方带气会比不带气显得更酸、更「清亮」——所以气泡要最后加，别提前倒。",
      impact: 2,
      evidence: "文献",
    });
  }

  if (f.dairy && f.acid && r.ph < 4.6) {
    out.push({
      id: "casein",
      tag: "协同",
      tone: "up",
      title: "酸 + 乳 · 已经到等电点了",
      text: `pH ${r.ph.toFixed(1)} < 4.6，酪蛋白会开始絮凝。这就是奶洗：静置后滤掉絮状物，能得到清澈、香气更干净的酒。不滤就会喝到絮状颗粒。`,
      impact: 3,
      evidence: "文献",
    });
  } else if (f.dairy && f.acid) {
    out.push({
      id: "casein-near",
      tag: "注意",
      tone: "warn",
      title: "酸 + 乳 · 还没到等电点",
      text: `pH ${r.ph.toFixed(1)} 仍在 4.6 以上，乳蛋白还稳着。想奶洗得把 pH 压到 4.6 以下，否则只是「加了奶的酒」。`,
      impact: 2,
      evidence: "文献",
    });
  }

  if (f.tannin && f.dairy) {
    out.push({
      id: "tannin-protein",
      tag: "协同",
      tone: "mix",
      title: "单宁 + 蛋白 · 会互相拖下去",
      text: "单宁与蛋白结合会同时降低涩感和乳的「厚度」。想保留涩感就别加乳；想要顺滑就用它当澄清手段。",
      impact: 2,
      evidence: "机理",
    });
  }

  if (r.dilutionPct > 8) {
    out.push({
      id: "ice-dilution",
      tag: "稀释",
      tone: "mix",
      title: `冰融 · 已稀释 ${r.dilutionPct.toFixed(0)}%`,
      text: `入杯 ${Math.round(r.totalIn)} ml，成品 ${Math.round(r.volumeMl)} ml。上面的 ABV 与酸度都是按稀释后算的——冰不满，成品会更烈也更酸。`,
      impact: 1,
      evidence: "共识",
    });
  }

  if (r.acidGL >= 3 && r.acidGL <= 8 && r.sugarG100 >= 4 && r.sugarG100 <= 14) {
    out.push({
      id: "balance",
      tag: "平衡",
      tone: "up",
      title: "糖酸比 · 落在常见 Sour 区间",
      text: `糖 ${r.sugarG100.toFixed(1)} g/100mL、酸 ${r.acidGL.toFixed(1)} g/L，糖酸比约 ${(r.sugarG100 / Math.max(r.acidGL / 10, 0.01)).toFixed(1)}。这个比例下两头都不会抢戏。`,
      impact: 1,
      evidence: "共识",
    });
  }

  if (f.strong && f.anyAroma) {
    out.push({
      id: "strong-spirit",
      tag: "注意",
      tone: "warn",
      title: "高度酒 · 入口先烧后香",
      text: "50% 以上的基酒在前 2 秒会压住所有香气，香气是「后返」的。想让香气先到，先降温再稀释。",
      impact: 2,
      evidence: "共识",
    });
  }

  return out.sort((a, b) => b.impact - a.impact).slice(0, 5);
}
