/**
 * 技法配方：把「参数」翻译成「一份能照做的东西」。
 *
 * 参数只说明范围（65℃ / 90 min / 1:1），配方要说明
 *   主料多少、溶剂用什么、多少量、几步做完、出多少、怎么存。
 *
 * 每个技法给一份 recipe；没写的技法退回通用模板（诚实标注「通用步骤」）。
 */

export interface RecipeCtx {
  mainZh: string;
  mainG: number;      // 主料克数
  solventMl: number;  // 溶剂毫升数（按料液比）
  totalG: number;
  out: number;        // 出品毫升
  matsText: string;   // 「草莓 200 g ＋ 菠萝 25 g」
  vals: Record<string, number>;
}

export interface Recipe {
  solvent: string;             // 建议溶剂
  lines: [string, string][];   // 关键比例行
  steps: string[];             // 操作步骤
  note: string;                // 一句提醒
  generic?: boolean;           // 是否通用模板
}

const g = (n: number) => `${Math.round(n)} g`;
const ml = (n: number) => `${Math.round(n)} ml`;
const pick = (v: Record<string, number>, k: string, d: number) =>
  typeof v[k] === "number" ? v[k] : d;

export function buildRecipe(id: string, c: RecipeCtx): Recipe {
  const v = c.vals;
  const m = c.mainZh;
  const made: Record<string, Recipe> = {
    T1: {
      solvent: "伏特加 40%（或金酒、中性烈酒）",
      lines: [
        ["主料 : 溶剂", `1 : ${pick(v, "ratio", 1)}`],
        ["投料", c.matsText],
        ["溶剂", ml(c.solventMl)],
        ["温度 × 时间", `${pick(v, "tempC", 65)}℃ × ${pick(v, "timeMin", 90)} min`],
      ],
      steps: [
        `${m}洗净去蒂，切成 1–2 cm 块——表面积越大，色素和糖出得越快`,
        `和 ${ml(c.solventMl)} 伏特加一起装进真空袋，尽量摊平（薄层比厚块渗透快一倍）`,
        `抽真空封口；没有真空机就用密封袋水排法，袋内留的气越少越不容易氧化`,
        `水浴 ${pick(v, "tempC", 65)}℃ 浸 ${pick(v, "timeMin", 90)} min，中途翻一次袋`,
        `捞出立刻冰浴降到 10℃ 以下，这一步是「停手」——不降温它会继续往熟味走`,
        `双层滤布过滤，轻压不要拧；滤液静置 2 h 再取上清，弃掉底部细渣`,
      ],
      note: "出 ${c.out} ml 左右；4℃ 冷藏 2 周内用完，超过会开始氧化变褐。",
    },

    T2: {
      solvent: "中性植物油（葵花籽 / 葡萄籽），不要用初榨橄榄",
      lines: [
        ["油 : 酒", `1 : ${Math.round(100 / Math.max(5, pick(v, "fatRatio", 20)) * 10) / 10}`],
        ["油量", `${Math.round((c.solventMl * pick(v, "fatRatio", 20)) / 100)} ml`],
        ["温度 × 时间", `${pick(v, "tempC", 22)}℃ × ${pick(v, "timeMin", 120)} min`],
      ],
      steps: [
        `${ml(c.solventMl)} 高度酒倒进罐里，${pick(v, "tempC", 22)}℃ 静置`,
        `另取 ${Math.round((c.solventMl * pick(v, "fatRatio", 20)) / 100)} ml 植物油，加热到 60℃ 后冷却（去掉生油味）`,
        `把油缓慢倒入酒中，边倒边搅——高速搅 3 分钟能形成更好的乳化`,
        `${pick(v, "timeMin", 120)} min 内每小时摇一次，让油脂里的香味物质进到酒精里`,
        `冷冻 2 h 让油层变硬，用勺整块挑起撇掉`,
        `剩下的混浊层用咖啡滤纸过一遍，得到清亮油洗酒`,
      ],
      note: "油洗带的是坚果、香料、烈酒的脂溶性香，水溶性果香会损失大半。",
    },

    T3: {
      solvent: "金酒 / 伏特加（风味中性的最好）",
      lines: [
        ["主料 : 溶剂", `1 : ${pick(v, "ratio", 1)}`],
        ["溶剂", ml(c.solventMl)],
        ["时间", `${pick(v, "timeSec", 90)} 秒 × ${pick(v, "charges", 1)} 次`],
      ],
      steps: [
        `${m}切薄片或撕碎，装进虹吸瓶`,
        `倒入 ${ml(c.solventMl)} 冷酒（提前冰到 4℃，冷的能保住青绿香）`,
        `装 1 颗 N₂O 弹，横向用力摇 10 秒`,
        `泄压后立刻开盖、立刻过滤——晚 30 秒苦味就出来了`,
        `滤液冰镇保存，当天用完`,
      ],
      note: "香气保留最高（约 92%），代价是衰减极快：第二天只剩甜味。",
    },

    T4: {
      solvent: "伏特加 40% 或白朗姆",
      lines: [
        ["主料 : 溶剂", `1 : ${pick(v, "ratio", 1)}`],
        ["温度 × 时间", `${pick(v, "tempC", 6)}℃ × ${pick(v, "timeH", 12)} h`],
      ],
      steps: [
        `${m}处理好放进密封罐，倒入 ${ml(c.solventMl)} 酒`,
        `盖紧，${pick(v, "tempC", 6)}℃ 冷藏 ${pick(v, "timeH", 12)} h（中途摇一次）`,
        `过滤，滤液回冰箱再静置 2 h`,
        `取上层清液，底部细渣弃掉`,
      ],
      note: "慢，但几乎不产生熟味；茶、咖啡、低酸植物最合适。",
    },

    T5: {
      solvent: "先浸渍再用：70% 酒精浸渍液",
      lines: [
        ["温度 / 压力", `${pick(v, "tempC", 45)}℃ / ${pick(v, "mbar", 150)} mbar`],
        ["时间", `${pick(v, "timeMin", 40)} min`],
      ],
      steps: [
        `先用 70% 酒精把 ${m}浸 24 h，滤出浸渍液`,
        `浸渍液倒入旋蒸瓶，水浴 ${pick(v, "tempC", 45)}℃，真空 ${pick(v, "mbar", 150)} mbar`,
        `冷凝回收酒精；瓶里剩的就是「去酒精的香气浓缩液」`,
        `按需加回 5–10% 酒精帮助香气释放`,
      ],
      note: "酒精被抽走，香气留下；但设备门槛高，没真空泵做不了。",
    },

    T6: {
      solvent: "不需要额外溶剂，直接用浸渍液/果汁",
      lines: [
        ["温度 × 时间", `${pick(v, "tempC", -18)}℃ × ${pick(v, "timeH", 12)} h`],
        ["循环", `${pick(v, "cycles", 1)} 次`],
      ],
      steps: [
        `把 ${m}的汁或浸渍液倒进浅盘`,
        `${pick(v, "tempC", -18)}℃ 冻 ${pick(v, "timeH", 12)} h 到完全结冰`,
        `倒扣在滤网上，室温收集滴下来的第一批液体（约 1/3），这部分的香气浓度最高`,
        `剩下的冰弃掉；${pick(v, "cycles", 1)} 次循环能再浓一档`,
      ],
      note: "糖和香气一起浓缩，酸也会跟着变尖；不适合做清爽型。",
    },

    T7: {
      solvent: "不需要；先做成泥再脱水",
      lines: [
        ["温度 × 时间", `${pick(v, "tempC", 55)}℃ × ${pick(v, "timeH", 8)} h`],
        ["筛目", `${pick(v, "mesh", 80)} 目`],
      ],
      steps: [
        `${m}打成泥（可加 2% 麦芽糊精帮助分散）`,
        `薄薄抹在硅胶垫上，约 2 mm 厚`,
        `${pick(v, "tempC", 55)}℃ 风干 ${pick(v, "timeH", 8)} h 至脆`,
        `打粉，过 ${pick(v, "mesh", 80)} 目筛，密封防潮`,
      ],
      note: "水去掉后香气浓度约为鲜料的 8–10 倍，但对热敏感的香也会一起损失。",
    },

    T8: {
      solvent: "牛奶 / 淡奶油（脂肪 3% 以上才好澄清）",
      lines: [
        ["牛奶 : 酸液", `1 : ${Math.round(100 / Math.max(5, pick(v, "milkPct", 15)) * 10) / 10}`],
        ["牛奶量", `${Math.round((c.solventMl * pick(v, "milkPct", 15)) / 100)} ml`],
        ["pH", `${pick(v, "ph", 4.5)}（必须 < 4.6）`],
        ["静置", `${pick(v, "timeMin", 60)} min`],
      ],
      steps: [
        `${m}加酸（柠檬汁）调到 pH ${pick(v, "ph", 4.5)}，低于 4.6 酪蛋白才会凝结`,
        `另取 ${Math.round((c.solventMl * pick(v, "milkPct", 15)) / 100)} ml 冷牛奶`,
        `把酸液倒进牛奶里（不是反过来），轻轻搅两下就停`,
        `${pick(v, "timeMin", 60)} min 后见絮状沉淀`,
        `咖啡滤纸/滤布过滤 4–8 h，滤液应清亮透明`,
      ],
      note: "澄清靠的是等电点，不是「加奶」；pH 不到 4.6 一滴都不会沉淀。",
    },

    T9: {
      solvent: "在成品酒里直接处理",
      lines: [
        ["明胶", `${pick(v, "gelatin", 0.6)} g/L`],
        ["体积", ml(c.solventMl)],
        ["温度 × 时间", `${pick(v, "tempC", 6)}℃ × ${pick(v, "timeH", 12)} h`],
      ],
      steps: [
        `明胶按 ${pick(v, "gelatin", 0.6)} g/L 称好，用 10 倍冷水泡 20 min 泡开`,
        `隔水加热到 50℃ 化开（不要沸腾，超过 70℃ 会失去澄清力）`,
        `倒进 ${ml(c.solventMl)} 酒里搅匀`,
        `${pick(v, "tempC", 6)}℃ 静置 ${pick(v, "timeH", 12)} h`,
        `虹吸取上层清液，底层絮状物弃掉`,
      ],
      note: "单宁高的酒效果好；酒精度太高（>25%）明胶会析出。",
    },

    T10: {
      solvent: "在成品酒里直接处理",
      lines: [
        ["琼脂", `${pick(v, "agar", 0.5)} g/L`],
        ["溶解温度", `${pick(v, "tempC", 88)}℃`],
        ["静置", `${pick(v, "timeH", 4)} h`],
      ],
      steps: [
        `琼脂 ${pick(v, "agar", 0.5)} g/L 与 1/5 的酒混合，加热到 ${pick(v, "tempC", 88)}℃ 完全溶解`,
        `倒回剩余冷酒中快速搅匀`,
        `${pick(v, "timeH", 4)} h 冷藏凝固`,
        `把凝住的胶块用滤布包起来，让它自然滴滤一晚`,
      ],
      note: "适合果汁和糖浆；带气泡的酒不要用，会把气抽空。",
    },

    T11: {
      solvent: "在成品酒里直接处理",
      lines: [
        ["酶用量", `${pick(v, "dose", 0.05)} %w/w`],
        ["pH", `${pick(v, "ph", 4)}`],
        ["温度 × 时间", `${pick(v, "tempC", 45)}℃ × ${pick(v, "timeMin", 45)} min`],
      ],
      steps: [
        `${ml(c.solventMl)} 液体调到 pH ${pick(v, "ph", 4)}`,
        `按 ${pick(v, "dose", 0.05)} %w/w 加入果胶酶，搅匀`,
        `${pick(v, "tempC", 45)}℃ 保温 ${pick(v, "timeMin", 45)} min`,
        `加热到 80℃ 保持 5 min 灭活（否则酶会一直作用到发苦）`,
        `冷藏静置后过滤`,
      ],
      note: "灭活这一步最常被忘；酶灭不掉，两周后酒会变稀、发苦。",
    },

    T12: {
      solvent: "—",
      lines: [
        ["离心力", `${pick(v, "g", 6000)} g`],
        ["温度 × 时间", `${pick(v, "tempC", 5)}℃ × ${pick(v, "timeMin", 8)} min`],
      ],
      steps: [
        `液体先过粗滤（滤布），去掉大颗粒`,
        `配平后 ${pick(v, "g", 6000)} g / ${pick(v, "tempC", 5)}℃ 离心 ${pick(v, "timeMin", 8)} min`,
        `小心吸取中层清液，避开上层浮沫和底部沉淀`,
      ],
      note: "离心比过滤快几十倍，但家里基本没设备；替代方案是冷冻+滤纸。",
    },

    T13: {
      solvent: "海藻酸钠浴 + 乳酸钙浴（两个容器）",
      lines: [
        ["海藻酸钠", `${pick(v, "alginate", 0.7)} %`],
        ["乳酸钙", `${pick(v, "calcium", 1)} %`],
        ["原料 pH", `${pick(v, "ph", 4)}（低于 3.5 不成胶）`],
      ],
      steps: [
        `把 ${m}汁与 ${pick(v, "alginate", 0.7)}% 海藻酸钠用料理机打到无颗粒，静置消泡 30 min`,
        `另配 ${pick(v, "calcium", 1)}% 乳酸钙浴`,
        `用小勺滴入钙浴，停留 30 秒成膜后捞出`,
        `清水冲洗，立刻用；放久会变硬`,
      ],
      note: "pH 低于 3.5 海藻酸钠不凝胶——高酸果汁要先做「反向球化」。",
    },

    T14: {
      solvent: "—",
      lines: [
        ["琼脂 / 明胶 / 结冷胶", `${pick(v, "agar", 0.5)} / ${pick(v, "gelatin", 1.5)} / ${pick(v, "gellan", 0.15)} %`],
        ["凝固温度", `${pick(v, "tempC", 45)}℃`],
      ],
      steps: [
        `按比例称胶，与 1/4 的液体预混成糊（直接倒进全量会结块）`,
        `加热到 85℃ 完全溶解，边加热边搅`,
        `降温到 ${pick(v, "tempC", 45)}℃ 后倒入模具或注入杯中`,
        `冷藏 2 h 定型`,
      ],
      note: "琼脂脆、明胶软、结冷胶悬浮——三种口感完全不同，别互换。",
    },

    T15: {
      solvent: "N₂O 上膛，不用酒精",
      lines: [
        ["N₂O", `${pick(v, "charges", 1)} 颗`],
        ["稳定剂", `${pick(v, "stabilizer", 0.5)} %`],
        ["摇", `${pick(v, "shakes", 12)} 次`],
      ],
      steps: [
        `液体加 ${pick(v, "stabilizer", 0.5)}% 稳定剂（卵磷脂 / 甲基纤维素）`,
        `过滤后装虹吸瓶，装 ${pick(v, "charges", 1)} 颗 N₂O`,
        `用力摇 ${pick(v, "shakes", 12)} 次`,
        `倒置，轻压出泡`,
      ],
      note: "CO₂ 出的是气泡口感，N₂O 出的才是绵密泡沫——别用错弹。",
    },

    T16: {
      solvent: "—",
      lines: [
        ["油", `${pick(v, "oilPct", 15)} %`],
        ["卵磷脂", `${pick(v, "lecithin", 0.5)} %`],
        ["剪切", `${pick(v, "shear", 2)} 级`],
      ],
      steps: [
        `油与卵磷脂先混合，静置 20 min`,
        `缓慢倒入水相，边倒边高速搅`,
        `过均质机或高速破壁 ${Math.max(1, pick(v, "shear", 2))} 级`,
        `静置消泡，冷藏 2 h 稳定`,
      ],
      note: "油超过 20% 就很难稳定了，需要更多卵磷脂或胶体。",
    },

    T17: {
      solvent: "中性烈酒（50–60 vol），酒精度低会发霉",
      lines: [
        ["橡木片", `${pick(v, "oak", 10)} g/L`],
        ["温度 × 时间", `${pick(v, "tempC", 45)}℃ × ${pick(v, "timeH", 12)} h`],
      ],
      steps: [
        `橡木片 ${pick(v, "oak", 10)} g/L，先 150℃ 烤 30 min 提香（可选）`,
        `与 ${ml(c.solventMl)} 酒一起装进密封罐`,
        `${pick(v, "tempC", 45)}℃ 保温 ${pick(v, "timeH", 12)} h，每 2 h 摇一次`,
        `过滤掉木片；尝一下，苦了就立刻停`,
      ],
      note: "高温陈化容易过：12 h 相当于自然陈一年的木味浓度。",
    },

    T18: {
      solvent: "—（用气泡水机直接打）",
      lines: [
        ["碳酸化", `${pick(v, "vol", 3)} vol`],
        ["温度 × 时间", `${pick(v, "tempC", 2)}℃ × ${pick(v, "timeH", 6)} h`],
      ],
      steps: [
        `液体冰到 ${pick(v, "tempC", 2)}℃（越冷二氧化碳溶得越多）`,
        `确认酒精度 < 15%，且不含果肉颗粒`,
        `打到 ${pick(v, "vol", 3)} vol，冷藏 ${pick(v, "timeH", 6)} h 让气泡稳定`,
        `开瓶前不要摇，倒的时候沿杯壁`,
      ],
      note: "2–3 vol 是碳酸饮料级，4 vol 以上需要耐压瓶，普通瓶会炸。",
    },

    T19: {
      solvent: "酸溶液（柠檬酸 / 苹果酸 / 乳酸 按风味选）",
      lines: [
        ["目标总酸", `${pick(v, "ta", 6)} g/L`],
        ["目标 pH", `${pick(v, "ph", 3.2)}`],
        ["缓冲盐", `${pick(v, "buffer", 0.3)} %`],
      ],
      steps: [
        `先测现有总酸与 pH——两者不是一回事，先补酸再调 pH`,
        `按 ${pick(v, "ta", 6)} g/L 目标补酸（柠檬酸偏尖，苹果酸偏闷，乳酸偏圆）`,
        `用 ${pick(v, "buffer", 0.3)}% 缓冲盐（柠檬酸钠）微调 pH 到 ${pick(v, "ph", 3.2)}`,
        `每加一次都尝一口，别一次加到位`,
      ],
      note: "总酸决定「酸多少」，pH 决定「酸多尖」；只测一个必然翻车。",
    },

    T20: {
      solvent: "—",
      lines: [
        ["烟熏温度", `< ${pick(v, "tempC", 22)}℃（冷熏）`],
        ["时间", `${pick(v, "timeMin", 25)} min`],
        ["木种", `${pick(v, "wood", 2)} 级（苹果木 / 樱桃木）`],
      ],
      steps: [
        `把 ${m}摊在烤网上，容器密封`,
        `发烟器点燃木屑，用导管把烟引进容器`,
        `保持 ${pick(v, "tempC", 22)}℃ 以下熏 ${pick(v, "timeMin", 25)} min`,
        `取出冷藏 2 h 让烟味固定`,
      ],
      note: "超过 30℃ 就不是冷熏而是热熏了，香气会变成「烤」。",
    },
  };

  if (made[id]) {
    // 文案里用了模板占位，统一填空
    const r = made[id];
    const r2: Recipe = {
      ...r,
      note: r.note
        .replace("${c.out}", String(Math.round(c.out)))
        .replace(/\$\{c\.out\}/g, String(Math.round(c.out))),
    };
    return r2;
  }

  return {
    solvent: "按技法参数自选溶剂",
    lines: [
      ["投料", c.matsText],
      ["溶剂", ml(c.solventMl)],
    ],
    steps: [
      `${m}处理好，与 ${ml(c.solventMl)} 溶剂混合`,
      `按左侧参数执行`,
      `过滤或分离，得到成品`,
    ],
    note: "这条技法还没写专门配方，先用通用步骤。",
    generic: true,
  };
}
