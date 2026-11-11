export type Level = "dominant" | "high" | "mid" | "low";

export interface Base {
  id: string;
  zh: string;
  en: string;
  fam: string;
  abv: number;
  sugar: number; // g/100 mL
  acid: number; // g/L
  density: number; // g/mL
  bubbles: "none" | "weak" | "strong";
  role: "base" | "modifier" | "dilution" | "sweetener" | "texture";
  note?: string;
}

export interface Ingredient {
  id: string;
  zh: string;
  en: string;
  fam: string;
  season?: string;
  ph?: number;
  sugar?: number; // g/100 g
  acid?: number; // g/100 g
  aroma?: [string, Level][];
  actives?: string[];
  texture?: string;
  prep?: string;
  tech?: string[];
  pairs?: string[];
  /** 获取难度：easy 超市常年 / mid 当季或网购 / hard 专业渠道 */
  avail?: { lv: "easy" | "mid" | "hard"; where: string };
  /** 含水 %：决定浸渍时会不会把酒「冲淡」 */
  water?: number;
  /** 1:1 浸渍时可溶性固形物的浸出率（0–1） */
  leach?: number;
  risk?: string;
  note?: string;
}

export interface Compound {
  id: string;
  zh: string;
  en: string;
  formula?: string;
  cas?: string;
  bpC?: number | null;
  logP?: number | null;
  odorMgL?: number | null;
  tLayer: "top" | "heart" | "base" | "none";
  facets: string[];
  from?: string[];
  conf?: "lit" | "est";
  note?: string;
  kind?: string;
}

export interface Facet {
  id: string;
  zh: string;
  en: string;
  color: string;
  glyph: string;
}

export interface StructureItem {
  id: string;
  zh: string;
  en: string;
  cls: string;
  cas?: string;
  formula?: string;
  effect: string;
  cond?: string;
  from?: string[];
  tech?: string[];
  conf?: string;
  tox?: { lv: number; note?: string };
  sol?: { w: number; e: number; o: number };
}

export interface Reaction {
  id: string;
  no: string;
  zh: string;
  en: string;
  mode: "chemical" | "physical" | "equilibrium";
  condText: string;
  rate: "instant" | "minutes" | "hours" | "days" | "weeks";
  reversible: boolean;
  verdict: "desired" | "contextual" | "avoid";
  reactants: string[];
  products: { match: string; sensoryDelta: string }[];
  mechanism: string;
  teaching?: string;
  avoid?: string;
  evidence?: string;
}
