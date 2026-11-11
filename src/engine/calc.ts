import { baseById, ingById, compoundById } from "./data";
import type { Level } from "./types";

export type Kind = "base" | "ing";
export interface Line {
  key: string;
  kind: Kind;
  refId: string;
  amount: number; // ml for base, g for ing
  /** 覆盖显示名：技法产物（备料）用，例如「慢煮浸渍液 280 ml」 */
  label?: string;
  /** 覆盖副标题，例如「技法产物 · 草莓 200 g + 菠萝 25 g」 */
  sub?: string;
  /** 备料行继承的原料：风味与结构按这些食材算，因为它们已经「溶进」产物里了 */
  carry?: { id: string; g: number }[];
  /** 备料行的实测/估测值覆盖：产物酒精度、糖、酸（优先于 base 表） */
  ov?: { abv?: number; sugar?: number; acid?: number };
}

export interface Reading {
  volumeMl: number;
  totalIn: number;
  dilutionPct: number;
  contractionPct: number;
  abv: number;
  sugarG100: number;
  acidGL: number;
  ph: number;
  massG: number;
  bubbles: number;
}

const ING_DENSITY = 1.02; // 果汁/果泥近似

/** 乙醇-水体积收缩（v/v %，近似值，见 docs/15） */
const CONTRACTION: [number, number][] = [
  [0, 0],
  [10, 0.006],
  [20, 0.018],
  [30, 0.03],
  [40, 0.036],
  [50, 0.038],
  [60, 0.034],
  [70, 0.028],
  [80, 0.02],
];

export function contractionAt(abvApprox: number): number {
  const a = Math.max(0, Math.min(80, abvApprox));
  for (let i = 1; i < CONTRACTION.length; i++) {
    const [x0, y0] = CONTRACTION[i - 1];
    const [x1, y1] = CONTRACTION[i];
    if (a <= x1) {
      const t = (a - x0) / (x1 - x0 || 1);
      return y0 + (y1 - y0) * t;
    }
  }
  return 0.02;
}

export interface MixOptions {
  ice: boolean; // 满冰杯，按 20% 稀释
}

export function computeMix(lines: Line[], opts: MixOptions): Reading {
  let ethanolG = 0;
  let sugarG = 0;
  let acidG = 0;
  let massG = 0;
  let volIn = 0;
  let bubbleSum = 0;

  // pH：按体积加权 H+（取各料自身 pH）
  let hMol = 0;
  let hVol = 0;

  for (const l of lines) {
    const amt = Math.max(0, l.amount || 0);
    if (!amt) continue;
    if (l.kind === "base") {
      const b = baseById.get(l.refId);
      if (!b) continue;
      const abv = l.ov?.abv ?? b.abv;
      const sug = l.ov?.sugar ?? b.sugar;
      const acd = l.ov?.acid ?? b.acid;
      const m = amt * b.density;
      massG += m;
      volIn += amt;
      ethanolG += amt * (abv / 100) * 0.789;
      sugarG += (amt * sug) / 100;
      acidG += (amt * acd) / 1000;
      if (b.bubbles === "strong") bubbleSum += amt;
      else if (b.bubbles === "weak") bubbleSum += amt * 0.4;
      hMol += amt * Math.pow(10, -6.5);
      hVol += amt;
    } else {
      const i = ingById.get(l.refId);
      if (!i) continue;
      const m = amt;
      massG += m;
      const ml = m / ING_DENSITY;
      volIn += ml;
      sugarG += (m * (i.sugar ?? 0)) / 100;
      acidG += (m * (i.acid ?? 0)) / 100;
      hMol += ml * Math.pow(10, -(i.ph ?? 5.5));
      hVol += ml;
    }
  }

  const iceMl = opts.ice ? volIn * 0.2 : 0;
  const abvApprox = volIn > 0 ? ((ethanolG / 0.789) / (volIn + iceMl)) * 100 : 0;
  const contraction = contractionAt(abvApprox);
  const volume = (volIn + iceMl) * (1 - contraction);
  const ethanolMl = ethanolG / 0.789;

  const hFromPh = hVol > 0 ? hMol / hVol : Math.pow(10, -6.5);
  // 有机酸解离近似：pH ≈ 0.5*(pKa - log C)，柠檬酸 pKa1 3.13；与原料自身 pH 取几何平均（缓冲）
  const acidM = volume > 0 ? acidG / volume : 0; // g/mL
  const acidMolL = (acidM * 1000) / 192;
  const hFromAcid = acidMolL > 0 ? Math.sqrt(7.4e-4 * acidMolL) : 0;
  const h = hFromAcid > 0 ? Math.sqrt(hFromPh * hFromAcid) : hFromPh;
  const ph = Math.max(2.6, -Math.log10(Math.max(h, 1e-7)));

  return {
    volumeMl: volume,
    totalIn: volIn,
    dilutionPct: volIn > 0 ? (iceMl / volIn) * 100 : 0,
    contractionPct: contraction * 100,
    abv: volume > 0 ? (ethanolMl / volume) * 100 : 0,
    sugarG100: volume > 0 ? (sugarG / volume) * 100 : 0,
    acidGL: volume > 0 ? (acidG / volume) * 1000 : 0,
    ph,
    massG,
    bubbles: volIn > 0 ? (bubbleSum / volIn) * 3.2 : 0,
  };
}

/* ---------------- 风味轮廓 ---------------- */

export const AXES = ["甜", "酸", "苦", "鲜", "辛", "香", "醇厚", "收敛"] as const;
export type Axis = (typeof AXES)[number];

const LEVEL_W: Record<Level, number> = { dominant: 1, high: 0.7, mid: 0.4, low: 0.2 };

const has = (arr: string[] | undefined, ...kw: string[]) =>
  (arr ?? []).some((a) => kw.some((k) => a.includes(k)));

export function computeFlavor(lines: Line[], r: Reading): Record<Axis, number> {
  let aroma = 0;
  let bitter = 0;
  let fresh = 0;
  let spice = 0;
  let tannin = 0;
  let body = 0;

  // 备料行：把它的来源原料当作「已溶入」的食材计入风味
  const expanded: Line[] = [];
  for (const l of lines) {
    expanded.push(l);
    for (const c of l.carry ?? [])
      expanded.push({ key: `${l.key}-c-${c.id}`, kind: "ing", refId: c.id, amount: c.g });
  }

  for (const l of expanded) {
    const amt = Math.max(0, l.amount || 0);
    if (!amt) continue;
    if (l.kind === "ing") {
      const i = ingById.get(l.refId);
      if (!i) continue;
      const w = Math.min(1, amt / 60);
      for (const [cid, lv] of i.aroma ?? []) {
        const c = compoundById.get(cid);
        // 阈值越低，同样含量越「冒头」：用 1/log 反比加权
        const thr = c?.odorMgL ?? 0.1;
        aroma += LEVEL_W[lv] * w * (0.5 + Math.min(1.5, Math.log10(1 / Math.max(thr, 1e-6)) / 6));
      }
      if (has(i.actives, "单宁", "多酚")) tannin += 0.6 * w;
      if (has(i.actives, "苦", "咖啡因", "生物碱")) bitter += 0.7 * w;
      if (has(i.actives, "谷氨酸", "氨基酸", "鲜")) fresh += 0.8 * w;
      if (has(i.actives, "辣椒素", "姜辣", "胡椒碱", "肉桂醛", "丁香酚", "姜烯酚")) spice += 0.9 * w;
      if (has(i.actives, "果胶", "淀粉", "纤维")) body += 0.35 * w;
    } else {
      const b = baseById.get(l.refId);
      if (!b) continue;
      const w = Math.min(1, amt / 60);
      if (b.abv > 30) aroma *= 1 + 0.02;
      if (b.role === "texture") body += 0.5 * w;
      if (has([b.zh], "金巴利", "汤力")) bitter += 0.9 * w;
      if (has([b.zh], "味美思", "黄酒", "米酒")) fresh += 0.6 * w;
      if (has([b.zh], "雪莉", "波本", "威士忌")) body += 0.5 * w;
    }
  }

  const clamp = (v: number) => Math.max(0, Math.min(5, v));
  return {
    甜: clamp(r.sugarG100 / 2.4),
    酸: clamp(r.acidGL / 1.8),
    苦: clamp(bitter + r.abv / 40),
    鲜: clamp(fresh),
    辛: clamp(spice),
    香: clamp(aroma * 2.2),
    醇厚: clamp(r.abv / 8 + r.sugarG100 / 9 + body),
    收敛: clamp(tannin),
  };
}

/* ---------------- 时间层 / 香族分布 ---------------- */

export function aromaProfile(lines: Line[]): { facet: string; score: number }[] {
  const acc: Record<string, number> = {};
  const expanded: Line[] = [];
  for (const l of lines) {
    expanded.push(l);
    for (const c of l.carry ?? [])
      expanded.push({ key: `${l.key}-a-${c.id}`, kind: "ing", refId: c.id, amount: c.g });
  }
  for (const l of expanded) {
    if (l.kind !== "ing" || !l.amount) continue;
    const i = ingById.get(l.refId);
    if (!i) continue;
    const w = Math.min(1, l.amount / 60);
    for (const [cid, lv] of i.aroma ?? []) {
      const c = compoundById.get(cid);
      if (!c) continue;
      const f = c.facets?.[0] ?? "other";
      acc[f] = (acc[f] ?? 0) + LEVEL_W[lv] * w;
    }
  }
  return Object.entries(acc)
    .map(([facet, score]) => ({ facet, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/* ---------------- 配方结构判读 ---------------- */

export interface Structure {
  skeleton: string;
  key: "highball" | "sour" | "built" | "oldfashioned" | "mocktail" | "strong" | "none";
  roles: { label: string; ok: boolean }[];
  layers: { label: string; n: number }[];
  missing: string;
}

export function judgeStructure(lines: Line[]): Structure {
  let hasBase = false;
  let hasAcid = false;
  let hasSweet = false;
  let hasBubble = false;
  let hasDairy = false;
  let hasTannin = false;
  let hasModifier = false;

  for (const l of lines) {
    if (!l.amount) continue;
    if (l.kind === "base") {
      const b = baseById.get(l.refId);
      if (!b) continue;
      if (b.role === "base" && b.abv > 0) hasBase = true;
      if (b.role === "sweetener") hasSweet = true;
      if (b.role === "texture") hasDairy = true;
      if (b.role === "modifier") hasModifier = true;
      if (b.bubbles !== "none") hasBubble = true;
    } else {
      const i = ingById.get(l.refId);
      if (!i) continue;
      if ((i.acid ?? 0) > 0.5 || (i.ph ?? 7) < 4) hasAcid = true;
      if ((i.sugar ?? 0) > 8) hasSweet = true;
      if ((i.actives ?? []).some((a) => a.includes("单宁") || a.includes("多酚"))) hasTannin = true;
      if (i.fam === "dairy") hasDairy = true;
    }
  }

  const dilution = lines.some((l) => {
    if (!l.amount || l.kind !== "base") return false;
    const b = baseById.get(l.refId);
    return !!b && b.role === "dilution";
  });

  let skeleton = "还看不出骨架";
  let key: "highball" | "sour" | "built" | "oldfashioned" | "mocktail" | "strong" | "none" = "none";
  if (hasBase && hasAcid && hasSweet && hasBubble) {
    skeleton = "Highball（烈酒 + 酸 + 甜 + 气泡）";
    key = "highball";
  } else if (hasBase && hasAcid && hasSweet) {
    skeleton = "Sour（烈酒 + 酸 + 甜）";
    key = "sour";
  } else if (hasBase && hasBubble) {
    skeleton = "Built（烈酒 + 气泡，直调）";
    key = "built";
  } else if (hasBase && hasModifier && !hasAcid) {
    skeleton = "Old Fashioned 型（烈酒 + 调味，不加酸）";
    key = "oldfashioned";
  } else if (!hasBase && hasAcid && hasSweet) {
    skeleton = "Mocktail（无酒精，酸 + 甜）";
    key = "mocktail";
  } else if (hasBase) {
    skeleton = "烈酒为主，还没有配平";
    key = "strong";
  }

  const layers = { top: 0, heart: 0, base: 0 } as Record<"top" | "heart" | "base", number>;
  for (const l of lines) {
    if (!l.amount || l.kind !== "ing") continue;
    const i = ingById.get(l.refId);
    for (const [cid] of i?.aroma ?? []) {
      const c = compoundById.get(cid);
      if (!c) continue;
      if (c.tLayer === "top") layers.top++;
      else if (c.tLayer === "heart") layers.heart++;
      else if (c.tLayer === "base") layers.base++;
    }
  }

  const missing: string[] = [];
  if (!hasBase) missing.push("没有基酒（会是一杯无酒精）");
  if (!hasAcid) missing.push("没有酸（结构会偏平）");
  if (!hasSweet) missing.push("没有甜（酸会显得尖）");
  if (!dilution && !hasBubble) missing.push("没有稀释或气泡（入口会冲）");

  return {
    skeleton,
    key,
    roles: [
      { label: "基酒", ok: hasBase },
      { label: "酸", ok: hasAcid },
      { label: "甜", ok: hasSweet },
      { label: "稀释/气泡", ok: dilution || hasBubble },
      { label: "乳/脂肪", ok: hasDairy },
      { label: "单宁", ok: hasTannin },
    ],
    layers: [
      { label: "前调", n: layers.top },
      { label: "中调", n: layers.heart },
      { label: "后调", n: layers.base },
    ],
    missing: missing.join("；") || "四件齐了",
  };
}

/* ---------------- 做法生成 ---------------- */

export function buildMethod(lines: Line[], st: Structure, r: Reading): { n: number; t: string }[] {
  const live = lines.filter((l) => l.amount > 0);
  const bases = live.filter((l) => l.kind === "base");
  const ings = live.filter((l) => l.kind === "ing");
  const bubble = bases.filter((l) => (baseById.get(l.refId)?.bubbles ?? "none") !== "none");
  const solid = bases.filter((l) => !bubble.includes(l));
  const dairy = bases.some((l) => baseById.get(l.refId)?.role === "texture") || ings.some((l) => ingById.get(l.refId)?.fam === "dairy");
  const acid = r.acidGL > 2;
  const nm = (l: Line) =>
  l.label ??
  ((l.kind === "base" ? baseById.get(l.refId)?.zh : ingById.get(l.refId)?.zh) ?? "");
  const sugar = solid.filter((l) => baseById.get(l.refId)?.role === "sweetener");
  const hard = solid.filter((l) => !sugar.includes(l));

  const steps: { n: number; t: string }[] = [];
  let n = 1;

  if (bubble.length) {
    steps.push({ n: n++, t: "杯型：高球杯装满冰，先空杯冰 30 s。冰要满——化得慢，稀释才可控。" });
    const order = [...sugar, ...ings, ...hard].map(nm).filter(Boolean);
    steps.push({
      n: n++,
      t: order.length
        ? `杯中依次倒入：${order.join("、")}。糖浆和果汁先，酒其次——气泡最后，永远不摇。`
        : "先把有味道的材料倒进杯里。",
    });
    steps.push({ n: n++, t: `补 ${bubble.map(nm).join("、")}，表面轻推一次让液层合上——不要搅拌，气会跑。` });
  } else if (dairy) {
    steps.push({ n: n++, t: "杯型：古典杯一块大冰。这杯要靠静置和过滤，杯型可以后定。" });
    steps.push({ n: n++, t: `把 ${[...solid, ...ings].map(nm).filter(Boolean).join("、")} 混合，静置 10–20 min。` });
    steps.push({ n: n++, t: "pH 低于 4.6 时酪蛋白会絮凝——絮凝后过双层滤纸，得到清澈、香气更干净的一杯（T8 奶洗）。" });
  } else if (acid) {
    steps.push({ n: n++, t: "杯型：摇和，滤入已冰镇的浅碟杯，不加冰（避免二次稀释）。" });
    steps.push({ n: n++, t: `入壶：${[...sugar, ...ings, ...hard].map(nm).filter(Boolean).join("、")}。糖浆先、果汁次、酒最后。` });
    steps.push({ n: n++, t: "加冰摇 10–12 s：听到冰碎声变闷就够。摇过头会多稀释 10–15%。" });
    steps.push({ n: n++, t: "双重过滤入杯——滤掉碎冰，口感会干净一档。" });
  } else {
    steps.push({ n: n++, t: "杯型：古典杯，一块大冰，直调。" });
    steps.push({ n: n++, t: `杯中依次倒入 ${[...hard, ...sugar, ...ings].map(nm).filter(Boolean).join("、")}，搅拌 15 s。` });
    steps.push({ n: n++, t: "不加柑橘、不加蛋的配方，搅拌比摇和更清澈。" });
  }

  const g = ings.length ? ingById.get(ings[0].refId) : undefined;
  if (g) {
    steps.push({
      n: n++,
      t: `装饰：取一片${g.zh}${g.fam === "fruit" ? "，切薄片贴在杯壁" : "，轻拍出香后放杯口"}。先用鼻子确认它和上面的香气是同一个方向。`,
    });
  }

  return steps;
}