import { ingredients, compoundById, facetById } from "./data";
import type { Ingredient, Compound } from "./types";

export type PairKind = "same" | "bridge" | "contrast";

export interface PairSuggestion {
  ing: Ingredient;
  score: number;
  kind: PairKind;
  kindZh: string;
  brings: { id: string; zh: string; level: string }[];
  why: string;
  use: string;
  amount: number;
  unit: string;
  ease: "易" | "中" | "难";
  easeNote: string;
}

const LV: Record<string, number> = { dominant: 3, high: 2, mid: 1, low: 0.5 };
const LV_ZH: Record<string, string> = {
  dominant: "主",
  high: "高",
  mid: "中",
  low: "低",
};
const LAYER_ZH: Record<string, string> = {
  top: "前调",
  heart: "中调",
  base: "后调",
  none: "不挥发",
};

export function compoundsOf(ing: Ingredient): { c: Compound; level: string }[] {
  const out: { c: Compound; level: string }[] = [];
  for (const [id, level] of ing.aroma ?? []) {
    const c = compoundById.get(id);
    if (c) out.push({ c, level: level as string });
  }
  return out.sort((a, b) => (LV[b.level] ?? 0) - (LV[a.level] ?? 0));
}

export function starCompounds(ing: Ingredient, n = 7) {
  return compoundsOf(ing).slice(0, n);
}

/** 难度：只有 season 字段可推，如实标成「按季节推测」 */
function ease(ing: Ingredient): { ease: "易" | "中" | "难"; note: string } {
  // 有 avail 字段就用真数据；没有才退回按季节猜
  if (ing.avail) {
    const m = { easy: "易", mid: "中", hard: "难" } as const;
    return { ease: m[ing.avail.lv], note: ing.avail.where };
  }
  const s = ing.season ?? "";
  if (s.includes("全年")) return { ease: "易", note: "超市常年有" };
  if (s) return { ease: "中", note: `${s.replace("月", " 月")}当季` };
  return { ease: "中", note: "季节未标注" };
}

/** 具体用量（数字）：界面上的「20–30 g」是给人看的，这里给引擎算的 */
export function useAmount(ing: Ingredient, level: string): { amount: number; unit: string } {
  if (ing.fam === "spice") return { amount: level === "dominant" ? 0.5 : 1, unit: "g" };
  if (ing.fam === "flower") return { amount: level === "dominant" ? 2 : 1.2, unit: "g" };
  if (ing.fam === "herb") return { amount: 4, unit: "g" };
  if (ing.fam === "dried") return { amount: 9, unit: "g" };
  if (ing.fam === "nut") return { amount: 12, unit: "g" };
  if (ing.fam === "dairy") return { amount: 40, unit: "g" };
  return { amount: level === "dominant" ? 45 : 25, unit: "g" };
}

/** 主料一次备料的量 */
export function mainAmount(ing: Ingredient): number {
  switch (ing.fam) {
    case "fruit": return 200;
    case "vegetable": return 120;
    case "herb": return 8;
    case "spice": return 2;
    case "flower": return 4;
    case "dried": return 40;
    case "nut": return 50;
    case "dairy": return 100;
    default: return 150;
  }
}

function useHint(ing: Ingredient, level: string): string {
  if (ing.fam === "spice") return level === "dominant" ? "1–2 粒 / 0.5 g" : "1 片 / 1 撮";
  if (ing.fam === "flower") return level === "dominant" ? "2 g" : "1–1.5 g";
  if (ing.fam === "herb") return "3–4 片";
  if (ing.fam === "dried") return "8–10 g";
  if (ing.fam === "nut") return "10–15 g";
  if (level === "dominant") return "40–50 g";
  return "20–30 g / 15–20 ml";
}

/**
 * 配对：不查手写规则表，直接用「分子重叠 + 同族跨层 + 香族补空」算。
 * 这是可解释的：每条建议都能指出是哪个分子、哪个香族、哪一层。
 */
export function pairFor(mainId: string, selected: string[]): PairSuggestion[] {
  const main = ingredients.find((i) => i.id === mainId);
  if (!main) return [];

  const sel = new Set(selected);
  const selCompounds = [...sel].map((id) => compoundById.get(id)).filter(Boolean) as Compound[];
  const selLayers = new Set(selCompounds.map((c) => c.tLayer));
  const selFacets = new Set(selCompounds.flatMap((c) => c.facets));
  const mainFacets = new Set(compoundsOf(main).flatMap((x) => x.c.facets));

  const out: PairSuggestion[] = [];

  for (const ing of ingredients) {
    if (ing.id === mainId) continue;
    const list = compoundsOf(ing);
    if (!list.length) continue;

    // ① 同一个分子也在它里面
    let share = 0;
    const shared: { id: string; zh: string; level: string }[] = [];
    for (const { c, level } of list) {
      if (sel.has(c.id)) {
        share += LV[level] ?? 0.5;
        shared.push({ id: c.id, zh: c.zh, level });
      }
    }

    // ② 同族但补的是空着的那一层
    let bridge = 0;
    const bridgeC: { id: string; zh: string; level: string }[] = [];
    for (const { c, level } of list) {
      const sameFacet = c.facets.some((f) => selFacets.has(f));
      if (sameFacet && !selLayers.has(c.tLayer) && c.tLayer !== "none") {
        bridge += (LV[level] ?? 0.5) * 0.8;
        bridgeC.push({ id: c.id, zh: c.zh, level });
      }
    }

    // ③ 带来一个还没出现的香族
    const newFacets = [...new Set(list.flatMap((x) => x.c.facets))].filter(
      (f) => !selFacets.has(f) && !mainFacets.has(f)
    );
    const novelty = newFacets.length ? 1 : 0;

    const score = share * 4 + bridge * 2 + novelty * 1.2;
    if (score < 0.8) continue;

    const kind: PairKind = share > 0 ? "same" : bridge > 0 ? "bridge" : "contrast";
    const kindZh = kind === "same" ? "同系叠加" : kind === "bridge" ? "补空层" : "补香族";

    let why = "";
    if (kind === "same") {
      const top = shared[0];
      const f = facetById.get(compoundById.get(top.id)?.facets[0] ?? "");
      why = `${top.zh} 在这儿也有（${LV_ZH[top.level]}）——同一个分子两条来源，「${f?.zh ?? ""}」会被加厚，不是叠加第二种味道。`;
    } else if (kind === "bridge") {
      const top = bridgeC[0];
      const c = compoundById.get(top.id);
      const hit = c?.facets.find((x) => selFacets.has(x)) ?? c?.facets[0] ?? "";
      const f = facetById.get(hit);
      why = `它带来 ${top.zh}，和已选的 ${f?.zh ?? ""} 同族，但在「${LAYER_ZH[c?.tLayer ?? ""]}」——补的是空着的那一层。`;
    } else {
      const f = facetById.get(newFacets[0] ?? "");
      why = `它不在已选的香族里（${f?.zh ?? ""}），用来给整杯一个别的方向，而不是再加一层同类。`;
    }

    const e = ease(ing);
    out.push({
      ing,
      score,
      kind,
      kindZh,
      brings: (kind === "same" ? shared : kind === "bridge" ? bridgeC : list.slice(0, 2).map((x) => ({ id: x.c.id, zh: x.c.zh, level: x.level }))).slice(0, 3),
      why,
      use: useHint(ing, list[0].level),
      ...useAmount(ing, list[0].level),
      ease: e.ease,
      easeNote: e.note,
    });
  }

  // 同一香族最多留两样，避免推荐变成「全都是柑橘类」
  const top = Math.max(...out.map((o) => o.score), 1);
  for (const o of out) o.score = Math.round((o.score / top) * 92 + 6);

  const seenFacet: Record<string, number> = {};
  return out
    .sort((a, b) => b.score - a.score)
    .filter((p) => {
      const f = p.ing.aroma?.[0] ? compoundById.get(p.ing.aroma[0][0])?.facets[0] ?? "x" : "x";
      seenFacet[f] = (seenFacet[f] ?? 0) + 1;
      return seenFacet[f] <= 2;
    })
    .slice(0, 4);
}

export { LV_ZH, LAYER_ZH };
