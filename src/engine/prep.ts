import { baseById, ingById } from "./data";

/** 备料里的一份料 */
export interface PrepMat {
  id: string;
  zh: string;
  amount: number; // g
  unit?: string;
}

export interface PrepProfile {
  /** 产物体积 ml */
  out: number;
  /** 产物酒精度 %vol */
  abv: number;
  /** 产物糖 g/100mL */
  sugar: number;
  /** 产物总酸 g/L（以柠檬酸计） */
  acid: number;
  /** 被料吸收/带走、没进产物的溶剂 ml */
  loss: number;
}

/**
 * 按投料与溶剂算「技法产物」的酒精度与糖酸。
 *
 * 三条来自数据表的假设，界面必须标明是估算：
 *  1. 料里的水会稀释酒——果肉含水 90%，1:1 浸渍后产物被拉低到 30% 上下
 *  2. 只有 leach 那一部分糖/酸溶出来（1:1、常温、30 min 的典型值）
 *  3. 滤渣会带走一部分溶剂，按料重的 0.6 倍扣
 */
export function prepProfile(
  mats: PrepMat[],
  solventMl: number,
  spiritId: string
): PrepProfile {
  const spirit = baseById.get(spiritId);
  const spiritAbv = spirit?.abv ?? 40;

  let waterG = 0;
  let sugarG = 0;
  let acidG = 0;
  let solidG = 0;

  for (const m of mats) {
    const ing = ingById.get(m.id);
    if (!ing) continue;
    const g = Math.max(0, m.amount);
    solidG += g;
    const water = (ing.water ?? 85) / 100;
    const leach = ing.leach ?? 0.6;
    waterG += g * water * leach; // 只有被「泡出来」的那部分水进了产物
    sugarG += (g * (ing.sugar ?? 0) * leach) / 100; // sugar 是 g/100g
    acidG += (g * (ing.acid ?? 0) * leach) / 100;
  }

  // 滤渣吸附：湿料最多吃掉三成半溶剂，且不超过料重的 0.5 倍
  const loss = Math.min(solventMl * 0.35, solidG * 0.5);
  const ethanolMl = (solventMl * spiritAbv) / 100;
  const out = Math.max(1, solventMl + waterG - loss);
  const abv = (ethanolMl / out) * 100;
  const sugar = (sugarG / out) * 100;
  const acid = (acidG / out) * 1000;

  return {
    out: Math.round(out),
    abv: Math.round(abv * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    acid: Math.round(acid * 10) / 10,
    loss: Math.round(loss),
  };
}
