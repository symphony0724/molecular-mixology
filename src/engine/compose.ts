import { bases, ingredients, baseById, ingById, compoundById, facetById } from "./data";
import { computeMix, computeFlavor, judgeStructure, buildMethod, aromaProfile, type Line } from "./calc";
import { interactions } from "./rules";

export type Mood = "清爽" | "浓郁" | "酸甜" | "苦烈" | "温暖";

export interface Combo {
  id: string;
  skeleton: string;
  skeletonEn: string;
  name: string;
  lines: Line[];
  abv: number;
  sugar: number;
  acid: number;
  volume: number;
  score: number;
  parts: { score: number; label: string }[];
  why: string;
  risk: string;
  missing: string;
  method: { n: number; t: string }[];
  borrowed: string[]; // 用了「常备补位」的材料名
  hardBuy: number; // 需要专门去买几样
}

/** 家里常备的补位料：没勾选也可能被用上，但会明确标出来 */
const PANTRY = {
  acid: "ing-lime",
  sweet: "base-honey",
  bubble: "base-soda",
  spirit: "base-gin",
};

const TF: Record<string, number> = {
  rip: 1,
  citrus: 1,
  green: 1,
  floral: 1,
};

interface Template {
  id: string;
  zh: string;
  en: string;
  name: (m: string) => string;
  need: { spirit?: number; acid?: number; sweet?: number; bubble?: number; main?: number };
  /** 气泡位换成别的（骡子用姜汁汽水） */
  bubbleId?: string;
  /** 额外的定型材料（味美思 / 金巴利 / 淡奶油…） */
  extra?: { id: string; ml: number }[];
  /** 这个骨架偏爱的香族：命中就加分，用于「按风味给不同骨架」 */
  facetBias?: Record<string, number>;
  abv: [number, number];
  sugar: [number, number];
  acidGL: [number, number];
}

const TEMPLATES: Template[] = [
  // 气泡类
  { id: "highball", zh: "高球", en: "HIGHBALL", name: (m) => `${m}高球`,
    need: { spirit: 45, acid: 20, sweet: 12, bubble: 60 }, abv: [8, 14], sugar: [1, 5], acidGL: [3, 7],
    facetBias: { green: 8, citrus: 6 } },
  { id: "fizz", zh: "菲士", en: "FIZZ", name: (m) => `${m}菲士`,
    need: { spirit: 45, acid: 20, sweet: 18, bubble: 40 }, abv: [8, 13], sugar: [5, 10], acidGL: [3, 6],
    facetBias: { citrus: 8, floral: 4 } },
  { id: "mule", zh: "骡子", en: "MULE", name: (m) => `${m}骡子`,
    need: { spirit: 45, acid: 15, bubble: 90 }, bubbleId: "base-gingerbeer",
    abv: [7, 12], sugar: [3, 8], acidGL: [2, 6], facetBias: { spice: 10, woody: 6 } },
  { id: "spritz", zh: "斯普里兹", en: "SPRITZ", name: (m) => `${m}斯普里兹`,
    need: { main: 30, bubble: 40 }, extra: [{ id: "base-whitewine", ml: 90 }],
    abv: [4.5, 9], sugar: [3, 8], acidGL: [2, 5], facetBias: { floral: 8, citrus: 6 } },
  // 酸类
  { id: "sour", zh: "酸", en: "SOUR", name: (m) => `${m}酸`,
    need: { spirit: 50, acid: 20, sweet: 15 }, abv: [12, 18], sugar: [6, 12], acidGL: [4, 8],
    facetBias: { ripe: 10, citrus: 6 } },
  { id: "tiki", zh: "提基", en: "TIKI", name: (m) => `${m}提基`,
    need: { main: 50, spirit: 45, acid: 20, sweet: 15 }, abv: [10, 16], sugar: [8, 15], acidGL: [4, 8],
    facetBias: { ripe: 12, caramel: 6 } },
  // 烈类（不加酸不加气）
  { id: "short", zh: "古典", en: "OLD FASHIONED", name: (m) => `${m}古典`,
    need: { spirit: 55, main: 20, sweet: 8 }, abv: [20, 30], sugar: [2, 8], acidGL: [0.5, 3],
    facetBias: { spice: 10, smoke: 10, woody: 8, caramel: 6 } },
  { id: "martini", zh: "马天尼", en: "MARTINI", name: (m) => `${m}马天尼`,
    need: { spirit: 60 }, extra: [{ id: "base-vermouth", ml: 10 }],
    abv: [26, 38], sugar: [0.5, 3], acidGL: [0.5, 3], facetBias: { floral: 10, green: 8, woody: 6 } },
  { id: "negroni", zh: "内格罗尼", en: "NEGRONI", name: (m) => `${m}内格罗尼`,
    need: { spirit: 30 }, extra: [{ id: "base-campari", ml: 30 }, { id: "base-vermouth", ml: 30 }],
    abv: [18, 26], sugar: [6, 14], acidGL: [0.5, 3], facetBias: { bitter: 10, citrus: 6, woody: 4 } },
  { id: "flip", zh: "菲利普", en: "FLIP", name: (m) => `${m}菲利普`,
    need: { spirit: 40, sweet: 15 }, extra: [{ id: "base-cream", ml: 30 }],
    abv: [10, 16], sugar: [8, 16], acidGL: [0.2, 2], facetBias: { dairy: 12, nut: 8, caramel: 8 } },
  // 无酒精
  { id: "mocktail", zh: "无酒精", en: "NO-ABV", name: (m) => `${m}气泡`,
    need: { main: 40, acid: 20, sweet: 15, bubble: 80 }, abv: [0, 0.5], sugar: [4, 10], acidGL: [3, 7],
    facetBias: { green: 6, citrus: 6 } },
];

/** 对外暴露的骨架清单（配方台左侧「经典框架」用） */
export interface Cocktail {
  id: string;
  zh: string;
  en: string;
  need: { spirit?: number; acid?: number; sweet?: number; bubble?: number; main?: number };
  extra?: { id: string; ml: number }[];
  bubbleId?: string;
  abv: [number, number];
}
export const COCKTAILS: Cocktail[] = TEMPLATES.map((t) => ({
  id: t.id,
  zh: t.zh,
  en: t.en,
  need: t.need,
  extra: t.extra,
  bubbleId: t.bubbleId,
  abv: t.abv,
}));

const MOOD_BIAS: Record<Mood, Record<string, number>> = {
  清爽: { highball: 12, fizz: 10, mule: 10, spritz: 8, mocktail: 6, sour: 2, tiki: -2, short: -6, martini: -6, negroni: -6, flip: -10 },
  浓郁: { short: 12, negroni: 10, flip: 10, tiki: 8, sour: 6, martini: 4, highball: -2, fizz: -2, spritz: -4, mocktail: -8 },
  酸甜: { sour: 12, tiki: 10, fizz: 8, mocktail: 6, highball: 2, short: -2, martini: -6, negroni: -4, flip: -2, mule: 2, spritz: 2 },
  苦烈: { negroni: 14, martini: 10, short: 10, sour: 4, highball: 0, fizz: 0, tiki: -4, flip: -8, mocktail: -10, mule: 2, spritz: 0 },
  温暖: { short: 12, flip: 10, tiki: 8, negroni: 4, sour: 6, highball: 2, fizz: 0, martini: -2, mule: 4, spritz: -4, mocktail: -6 },
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function rangeScore(v: number, [lo, hi]: [number, number]) {
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi;
  const span = Math.max(hi - lo, 1);
  return clamp01(1 - d / (span * 1.2));
}

function pick<T>(arr: T[], pred: (x: T) => boolean): T | undefined {
  return arr.find(pred);
}

export interface ComposeInput {
  ings: string[];
  bases: string[];
  mood: Mood;
}

export function compose(input: ComposeInput): Combo[] {
  const selIngs = input.ings.map((id) => ingById.get(id)).filter(Boolean) as any[];
  const selBases = input.bases.map((id) => baseById.get(id)).filter(Boolean) as any[];

  const acidIng =
    pick(selIngs, (i) => (i.acid ?? 0) >= 1.5) ?? ingById.get(PANTRY.acid)!;
  const sweetBase =
    pick(selBases, (b) => b.role === "sweetener") ?? baseById.get(PANTRY.sweet)!;
  const bubbleBase =
    pick(selBases, (b) => b.bubbles !== "none" && b.role === "dilution") ?? baseById.get(PANTRY.bubble)!;
  const spiritBase =
    pick(selBases, (b) => b.role === "base" && b.abv >= 20) ?? baseById.get(PANTRY.spirit)!;

  const main = selIngs.find((i) => (i.aroma ?? []).length) ?? selIngs[0] ?? ingById.get("ing-strawberry")!;

  const inSelection = (id: string) =>
    selIngs.some((i) => i.id === id) || selBases.some((b) => b.id === id);

  const combos: Combo[] = [];
  let seq = 0;

  for (const t of TEMPLATES) {
    // 无酒精模板不需要基酒；其余需要
    const usesSpirit = !!t.need.spirit;
    if (usesSpirit && !spiritBase) continue;

    const lines: Line[] = [];
    const push = (kind: "base" | "ing", refId: string, amount: number) => {
      if (!amount) return;
      lines.push({ key: `c${seq++}`, kind, refId, amount });
    };

    if (t.need.main) {
      push("ing", main.id, t.need.main);
    }
    if (t.need.spirit) {
      push("base", spiritBase.id, t.need.spirit);
    }
    if (t.need.acid) {
      push("ing", acidIng.id, t.need.acid);
    }
    if (t.need.sweet) {
      push("base", sweetBase.id, t.need.sweet);
    }
    if (t.need.bubble) {
      push("base", t.bubbleId ?? bubbleBase.id, t.need.bubble);
    }
    for (const e of t.extra ?? []) {
      if (!e.ml) continue;
      if (!baseById.get(e.id)) continue;
      push("base", e.id, e.ml);
    }

    if (lines.length < 2) continue;

    const borrowed: string[] = [];
    for (const l of lines) {
      if (inSelection(l.refId)) continue;
      const nm = l.kind === "base" ? baseById.get(l.refId)?.zh : ingById.get(l.refId)?.zh;
      if (nm && !borrowed.includes(nm)) borrowed.push(nm);
    }

    const r = computeMix(lines, { ice: true });
    const st = judgeStructure(lines);
    const hints = interactions(lines, r);
    const facets = aromaProfile(lines);

    // 五维打分
    const coverage = clamp01(facets.length / 4);
    const synergy = clamp01(
      (hints.some((h) => h.tone === "up") ? 0.6 : 0.2) +
        (facets.length >= 2 ? 0.2 : 0) +
        (lines.filter((l) => l.kind === "ing").length >= 2 ? 0.2 : 0)
    );
    const balance =
      0.4 * rangeScore(r.abv, t.abv) +
      0.3 * rangeScore(r.sugarG100, t.sugar) +
      0.3 * rangeScore(r.acidGL, t.acidGL);
    const novelty = clamp01(new Set(lines.map((l) => l.refId)).size / 4);
    const method = buildMethod(lines, st, r);
    const simple = clamp01(1 - (method.length - 3) / 4);

    const base = 40 * coverage + 25 * synergy + 20 * balance + 10 * novelty + 5 * simple;
    // 用户勾了酒，却推荐一杯不放酒的 —— 不算错，但要扣分并说明
    const hasAlcoholExtra = (t.extra ?? []).some(
      (e) => (baseById.get(e.id)?.abv ?? 0) > 0
    );
    const bypassSpirit = !!spiritBase && !t.need.spirit && !hasAlcoholExtra;
    const facetHit = Object.entries(t.facetBias ?? {}).reduce(
      (acc, [f, w]) => acc + (facets.some((x) => x.facet === f) ? w : 0),
      0
    );
    // 补位材料里如果有「不好买」的，扣分：推荐的前提是家里能做
    const hardCount = lines.filter((l) => {
      if (inSelection(l.refId)) return false;
      const i = ingById.get(l.refId);
      return i?.avail?.lv === "hard";
    }).length;
    const score = Math.round(
      base +
        (MOOD_BIAS[input.mood][t.id] ?? 0) -
        (bypassSpirit ? 12 : 0) +
        facetHit -
        hardCount * 7
    );

    // 为什么
    const LW: Record<string, number> = { dominant: 3, high: 2, mid: 1, low: 0.5 };
    const star =
      (main.aroma ?? [])
        .map(([cid, lv]: [string, string]) => ({
          c: compoundById.get(cid),
          w: LW[lv] ?? 0.5,
        }))
        .filter((x: any) => !!x.c)
        .sort(
          (a: any, b: any) =>
            b.w - a.w || (a.c.odorMgL ?? 1) - (b.c.odorMgL ?? 1)
        )[0]?.c ?? undefined;
    const facetZh = star ? facetById.get(star.facets?.[0] ?? "")?.zh : undefined;
    const roleBits: string[] = [];
    if (t.need.acid) roleBits.push(`酸来自${acidIng.zh}`);
    if (t.need.sweet)
      roleBits.push(`甜由${sweetBase.zh}兜（${t.need.sweet} ml，超过 15 会压香）`);
    if (t.need.bubble)
      roleBits.push(
        `${baseById.get(t.bubbleId ?? bubbleBase.id)?.zh ?? bubbleBase.zh}只负责把香气顶上去`
      );
    for (const e of t.extra ?? []) {
      const b = baseById.get(e.id);
      if (b) roleBits.push(`${b.zh} ${e.ml} ml 定调（${b.abv}%）`);
    }
    if (t.need.spirit && spiritBase) roleBits.push(`${spiritBase.zh} 只做骨架，不抢香`);
    if (
      !t.need.spirit &&
      !(t.extra ?? []).some((e) => (baseById.get(e.id)?.abv ?? 0) > 0)
    )
      roleBits.push("全程无酒精，全靠香气与气泡");
    const why =
      (star
        ? `「${star.zh}」阈值 ${star.odorMgL} mg/L，${Math.round(t.need.main ?? 0) || 30} g 就撑满整杯「${facetZh ?? "主调"}」；`
        : "") +
      roleBits.join("；") +
      "。";

    // 风险
    const risk =
      (hints[0] ? `${hints[0].title} —— ${hints[0].text}` : "") +
      (main.risk ? `｜${main.risk}` : "");

    // 缺什么
    const miss = bypassSpirit
      ? `你勾了 ${spiritBase.zh}，这杯没放酒——想做有酒精的把「无酒精」关掉。`
      : borrowed.length
      ? `这杯用到了家里常备的 ${borrowed.join("、")}，你没勾——想做得去买/找。`
      : "都在你勾的材料里，不用补。";

    combos.push({
      id: `${t.id}-${main.id}`,
      skeleton: t.zh,
      skeletonEn: t.en,
      name: t.name(main.zh),
      lines,
      abv: r.abv,
      sugar: r.sugarG100,
      acid: r.acidGL,
      volume: r.volumeMl,
      score: Math.max(0, Math.min(99, score)),
      parts: [
        { score: Math.round(coverage * 100), label: "覆盖" },
        { score: Math.round(synergy * 100), label: "协同" },
        { score: Math.round(balance * 100), label: "平衡" },
        { score: Math.round(novelty * 100), label: "新颖" },
        { score: Math.round(simple * 100), label: "简易" },
      ],
      why,
      risk,
      missing: miss,
      method,
      borrowed,
    hardBuy: hardCount,
    });
  }

  return combos.sort((a, b) => b.score - a.score).slice(0, 6);
}

export const ALL_ING = ingredients;
export const ALL_BASE = bases;


/** 按主料香族挑一个经典骨架（分子台 → 配方台用） */
export function pickSkeleton(
  mainFacets: string[],
  opts: { hasSpirit?: boolean; hasDairy?: boolean } = {}
): { id: string; zh: string; need: Record<string, number>; extra?: { id: string; ml: number }[] } {
  const has = (f: string) => mainFacets.includes(f);
  const want = !opts.hasSpirit
    ? "mocktail"
    : opts.hasDairy || has("dairy")
    ? "flip"
    : has("spice") || has("smoke") || has("woody")
    ? "short"
    : has("floral")
    ? "martini"
    : has("ripe") || has("citrus")
    ? "sour"
    : "highball";
  const t = TEMPLATES.find((x) => x.id === want)!;
  return { id: t.id, zh: t.zh, need: t.need as Record<string, number>, extra: t.extra };
}
