import basesRaw from "../../data/bases.json";
import ingredientsRaw from "../../data/ingredients.json";
import compoundsRaw from "../../data/compounds.json";
import structuresRaw from "../../data/structures.json";
import reactionsRaw from "../../data/reactions.json";
import type { Base, Ingredient, Compound, Facet, StructureItem, Reaction } from "./types";

export const bases: Base[] = (basesRaw as any).items as Base[];
export const ingredients: Ingredient[] = (ingredientsRaw as any).items as Ingredient[];
export const compounds: Compound[] = (compoundsRaw as any).compounds as Compound[];
export const facets: Facet[] = (compoundsRaw as any).facets as Facet[];
export const structures: StructureItem[] = (structuresRaw as any).items as StructureItem[];
export const reactions: Reaction[] = (reactionsRaw as any).reactions as Reaction[];

export const baseById = new Map(bases.map((b) => [b.id, b]));
export const ingById = new Map(ingredients.map((i) => [i.id, i]));
export const compoundById = new Map(compounds.map((c) => [c.id, c]));
export const facetById = new Map(facets.map((f) => [f.id, f]));

export const FAMILY_ZH: Record<string, string> = {
  fruit: "水果",
  vegetable: "蔬菜",
  herb: "香草",
  spice: "香料",
  flower: "花与茶",
  dried: "干果蜜饯",
  nut: "坚果",
  dairy: "乳制品",
  spirit: "烈酒",
  wine: "发酵酒",
  beer: "啤酒苹果酒",
  bubble: "气泡",
  water: "无酒精",
  milk: "乳",
  sweet: "甜味",
};

export const ROLE_ZH: Record<string, string> = {
  base: "基酒",
  modifier: "调味",
  dilution: "稀释",
  sweetener: "甜味",
  texture: "质地",
};
