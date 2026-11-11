import { useMemo, useState } from "react";
import { ingredients, facetById, compoundById, bases, FAMILY_ZH } from "../engine/data";

const FAM_ORDER = ["fruit", "vegetable", "herb", "spice", "flower", "dried", "nut", "dairy"];
import { starCompounds, pairFor, LV_ZH, LAYER_ZH, mainAmount } from "../engine/pairing";
import type { Line } from "../engine/calc";
import { pickSkeleton } from "../engine/compose";

const PICK = ["ing-strawberry", "ing-apple", "ing-passionfruit", "ing-banana", "ing-cucumber", "ing-greenplum"];

const LAYERS: { key: "top" | "heart" | "base"; zh: string; sub: string }[] = [
  { key: "top", zh: "前调", sub: "0–5 min" },
  { key: "heart", zh: "中调", sub: "5–30 min" },
  { key: "base", zh: "后调", sub: "30 min +" },
];

/** 时间层 → 横坐标 */
const colX = (k: string) => {
  const i = LAYERS.findIndex((l) => l.key === k);
  if (i < 0) return -100;
  return 200 + i * 300;
};
const W = 980;
/** 阈值 → y 坐标（对数；1e-6 在最上，10 在最下） */
const LOG_MIN = -6;
const LOG_MAX = 1;

const H = 540;
const PAD_T = 26;
const PAD_B = 22;
const yOf = (th: number, lo = LOG_MIN, hi = LOG_MAX) => {
  const v = Math.log10(Math.max(th, 1e-7));
  const t = (v - lo) / (hi - lo);
  return PAD_T + t * (H - PAD_T - PAD_B);
};
const GRID = [1e-5, 1e-4, 1e-3, 0.01, 0.1, 1];

export interface BenchMaterial {
  id: string;
  zh: string;
  amount: number;
  unit: string;
}

export interface BenchCtx {
  mainId: string;
  picks: string[];
  compounds: string[];
  materials: BenchMaterial[];
  spiritId: string;
}

export default function BenchView({
  onTechnique,
  onUse,
}: {
  onTechnique: (ctx: BenchCtx) => void;
  onUse: (lines: Line[]) => void;
}) {
  const [mainId, setMainId] = useState(PICK[0]);
  const [sel, setSel] = useState<string[]>(() => {
    const q = typeof location !== "undefined" ? location.search : "";
    const m = /(?:^|[?&])sel=([^&]*)/.exec(q);
    return m ? decodeURIComponent(m[1]).split(",").filter(Boolean) : [];
  });
  const [spiritId, setSpiritId] = useState("base-gin");
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [mq, setMq] = useState("");

  const main = ingredients.find((i) => i.id === mainId)!;
  const stars = useMemo(() => starCompounds(main, 99), [main]);
  const pairs = useMemo(() => pairFor(mainId, sel), [mainId, sel]);

  // 还没选分子时，右侧不出图也不预选；选了之后默认取前两样，用户点过以用户为准
  const pairIds = pairs.map((p) => p.ing.id);
  const defaultPick = sel.length === 0 ? [] : pairIds.slice(0, 2);
  const picked = (chosen ?? defaultPick).filter((id) => pairIds.includes(id));
  const togglePick = (id: string) => {
    const cur = (chosen ?? defaultPick).filter((x) => pairIds.includes(x));
    setChosen(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  // 右侧加入的材料 → 它们带来的分子（主料已有的不重复画）
  const addedCmps = useMemo(() => {
    const seen = new Map<string, { id: string; from: string }>();
    for (const id of picked) {
      const ing: any =
        ingredients.find((i) => i.id === id) ?? bases.find((b) => b.id === id);
      if (!ing) continue;
      for (const [cid] of (ing.aroma ?? []) as [string, string][]) {
        if (stars.some((x) => x.c.id === cid)) continue;
        if (!compoundById.get(cid)) continue;
        if (!seen.has(cid)) seen.set(cid, { id: cid, from: ing.zh });
      }
    }
    return [...seen.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked.join(","), stars]);

  const domain = useMemo(() => {
    const vs = [
      ...stars.map((x) => Math.log10(Math.max(x.c.odorMgL ?? 1, 1e-7))),
      ...addedCmps.map((a) => Math.log10(Math.max(compoundById.get(a.id)?.odorMgL ?? 1, 1e-7))),
    ];
    const lo = Math.floor(Math.min(...vs) - 0.35);
    const hi = Math.ceil(Math.max(...vs) + 0.35);
    return { lo, hi };
  }, [stars, addedCmps]);
  const gridVals = useMemo(() => {
    const out: number[] = [];
    for (let e = domain.lo; e <= domain.hi; e++) out.push(Math.pow(10, e));
    return out;
  }, [domain]);

  /** 点位布局：点按真实阈值放，标签按最小间距 27px 往下堆，用引线连回 */
  const scatterPoints = useMemo(() => {
    const items: { c: any; from: string; isAdd: boolean }[] = [
      ...stars.map(({ c }) => ({ c, from: "", isAdd: false })),
      ...addedCmps.map((a) => ({
        c: compoundById.get(a.id)!,
        from: a.from,
        isAdd: true,
      })),
    ];
    const groups = new Map<string, typeof items>();
    for (const it of items) {
      const k = `${it.c.tLayer}|${it.isAdd ? 1 : 0}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(it);
    }
    const out: { c: any; from: string; isAdd: boolean; x: number; ty: number; ly: number }[] = [];
    for (const list of groups.values()) {
      const sorted = [...list].sort(
        (a, b) => (b.c.odorMgL ?? 1) - (a.c.odorMgL ?? 1)
      );
      const col = colX(sorted[0].c.tLayer);
      if (col < 0) continue;
      // 同一列里横向错开，避免同列的点排成一条竖线、标签全挤到一个位置
      let prev = -1e9;
      sorted.forEach((it, i) => {
        const x = sorted[0].isAdd
          ? col + 40 + (i % 2) * 76
          : col - 132 + (i % 3) * 54;
        const ty = yOf(it.c.odorMgL ?? 1, domain.lo, domain.hi);
        const ly = Math.max(ty, prev + 27);
        prev = ly;
        out.push({ ...it, x, ty, ly });
      });
    }
    return out;
  }, [stars, addedCmps, domain]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const pickMain = (id: string) => {
    setMainId(id);
    setSel([]);
    setChosen(null);
  };

  const buildLines = (): Line[] => {
    // 按主料的香族挑骨架，而不是一律做成高球
    const facets = (main.aroma ?? [])
      .map(([cid]: [string, string]) => compoundById.get(cid)?.facets?.[0])
      .filter(Boolean) as string[];
    const sk = pickSkeleton(facets, {
      hasSpirit: spiritId !== "none",
      hasDairy: (main.aroma ?? []).some(
        ([cid]) => compoundById.get(cid)?.facets?.[0] === "dairy"
      ),
    });
    const lines: Line[] = [];
    let n = 0;
    const push = (kind: "base" | "ing", refId: string, amount: number) => {
      if (!amount) return;
      lines.push({ key: `b${n++}`, kind, refId, amount });
    };
    if (spiritId !== "none") push("base", spiritId, sk.need.spirit ?? 0);
    push("ing", main.id, sk.need.main ?? 0);
    push("ing", "ing-lime", sk.need.acid ?? 0);
    push("base", "base-honey", sk.need.sweet ?? 0);
    push("base", "base-soda", sk.need.bubble ?? 0);
    for (const e of sk.extra ?? []) push("base", e.id, e.ml);
    for (const p of pairs.filter((x) => picked.includes(x.ing.id))) {
      const isBase = bases.some((b) => b.id === p.ing.id);
      if (isBase) push("base", p.ing.id, 10);
      else push("ing", p.ing.id, 15);
    }
    return lines;
  };

  const sendTech = () => {
    const materials: BenchMaterial[] = [
      { id: main.id, zh: main.zh, amount: mainAmount(main), unit: "g" },
      ...picked.map((pid) => {
        const p = pairs.find((x) => x.ing.id === pid)!;
        return { id: pid, zh: p.ing.zh, amount: p.amount, unit: p.unit };
      }),
    ];
    onTechnique({
      mainId: main.id,
      picks: picked,
      compounds: sel,
      materials,
      spiritId,
    });
  };

  const sendRecipe = () => onUse(buildLines());


  return (
    <div className="bench">
      <aside className="bleft">
        <div className="bh">
          <b>台上的材料</b>
          <s>ON THE BENCH</s>
          <em>只放一样</em>
        </div>

        <div className="bcard">
          <div className="btop">
            <span className="famtag">{facetById.get(main.aroma?.[0]?.[0] ? compoundById.get(main.aroma[0][0])?.facets[0] ?? "" : "")?.zh ?? ""}</span>
            <span className="bseason">{main.season ?? ""}</span>
          </div>
          <h2>{main.zh}</h2>
          <div className="ben">{main.en}</div>
          <div className="bnum">
            <span>pH <b>{main.ph ?? "—"}</b></span>
            <span>糖 <b>{main.sugar ?? "—"}</b></span>
            <span>酸 <b>{main.acid ?? "—"}</b></span>
          </div>
        </div>
        <p className="bnote">台面只放一样——放了第二样，这一步就退化成「勾清单」了。</p>

        <div className="bh">
          <b>它的主角分子</b>
          <s>COMPOUNDS</s>
          <em>{stars.length} 个</em>
        </div>
        <div className="mlist">
          {stars.map(({ c, level }) => {
            const on = sel.includes(c.id);
            const f = facetById.get(c.facets[0] ?? "");
            return (
              <button key={c.id} className={on ? "mrow on" : "mrow"} onClick={() => toggle(c.id)}>
                <i className="dot" style={{ background: f?.color ?? "#999" }}>{f?.glyph ?? "●"}</i>
                <span className="mnm">
                  {c.zh}
                  <s>{c.en}</s>
                </span>
                <em className="mth">{c.odorMgL != null ? c.odorMgL : "—"}</em>
                <b className="mly">{LAYER_ZH[c.tLayer]}</b>
              </button>
            );
          })}
        </div>
        <p className="mnote">
          这是数据里为它收的全部 {stars.length} 个；界面上只画这些，不编数。
        </p>

        <div className="bh" style={{ marginTop: 10 }}>
          <b>换成另一样</b>
          <s>SWAP</s>
        </div>
        <div className="swaps">
          {PICK.map((id) => {
            const g = ingredients.find((i) => i.id === id);
            if (!g) return null;
            return (
              <button key={id} className={id === mainId ? "sw on" : "sw"} onClick={() => pickMain(id)}>
                {g.zh}
              </button>
            );
          })}
        </div>

        <div className="msearch">
          <span>⌕</span>
          <input
            value={mq}
            onChange={(e) => setMq(e.target.value)}
            placeholder={`全部 ${ingredients.length} 样材料`}
          />
        </div>
        <div className="mlist">
          {FAM_ORDER.map((fam) => {
            const rows = ingredients.filter(
              (g) =>
                g.fam === fam &&
                (!mq || g.zh.includes(mq) || g.en.toLowerCase().includes(mq.toLowerCase()))
            );
            if (!rows.length) return null;
            return (
              <div key={fam}>
                <div className="mfam">
                  {FAMILY_ZH[fam] ?? fam}
                  <em>{rows.length}</em>
                </div>
                {rows.map((g) => (
                  <button
                    key={g.id}
                    className={g.id === mainId ? "mrow on" : "mrow"}
                    onClick={() => pickMain(g.id)}
                  >
                    <b>{g.zh}</b>
                    <em className={`av av-${g.avail?.lv ?? "mid"}`}>
                      {g.avail?.lv === "easy" ? "易" : g.avail?.lv === "hard" ? "难" : "中"}
                    </em>
                    <i>{(g.aroma ?? []).length}</i>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      <section className="bmid">
        <div className="bh">
          <b>风味分子台</b>
          <s>COMPOUND BENCH</s>
          <em>点一下选中／再点取消 · 标签只显示已选的，悬停也能看</em>
        </div>

        <svg className="scatter" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ height: "auto", display: "block" }}>
          {LAYERS.map((l, i) => {
            const x = colX(l.key);
            return (
              <g key={l.key}>
                <line x1={x - 150} y1={PAD_T - 8} x2={x - 150} y2={H - PAD_B} stroke="#C9BEA6" strokeDasharray="2 4" />
                <text x={x} y={PAD_T - 14} fontSize="10" fill="#7A7264" textAnchor="middle">
                  {l.zh} <tspan fill="#A79C86">{l.sub}</tspan>
                </text>
              </g>
            );
          })}
          {gridVals.map((g) => (
            <g key={g}>
              <line x1={44} y1={yOf(g, domain.lo, domain.hi)} x2={W - 20} y2={yOf(g, domain.lo, domain.hi)} stroke="#D9CFB8" strokeDasharray="1 3" />
              <text x={38} y={yOf(g, domain.lo, domain.hi) + 3} fontSize="8.5" fill="#A79C86" textAnchor="end">
                {g < 1 ? g.toExponential(0).replace("e-", "e-") : g}
              </text>
            </g>
          ))}
          {scatterPoints.map((p) => {
            const f = facetById.get(p.c.facets[0] ?? "");
            const on = sel.includes(p.c.id);
            const color = f?.color ?? "#2B2620";
            return (
              <g
                key={(p.isAdd ? "add-" : "m-") + p.c.id}
                className="pt"
                onClick={() => toggle(p.c.id)}
                onMouseEnter={() => setHoverId(p.c.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: "pointer" }}
              >
                {(on || hoverId === p.c.id) && Math.abs(p.ty - p.ly) > 1.5 && (
                  <line x1={p.x} y1={p.ty} x2={p.x + 4} y2={p.ly} stroke={color} strokeWidth={0.7} opacity={0.45} />
                )}
                <circle
                  cx={p.x} cy={p.ty} r={on ? 6 : 5}
                  fill={on ? color : "#FBF7EC"}
                  stroke={color}
                  strokeWidth={1.3}
                  strokeDasharray={p.isAdd && !on ? "2 2" : undefined}
                />
                {(on || hoverId === p.c.id) && (
                  <>
                    <text x={p.x + 9} y={p.ly - 0.5} fontSize="9.5" fill={on ? "#2B2620" : "#5C5346"}>
                      {p.c.zh} <tspan fill="#A79C86">{p.c.odorMgL}</tspan>
                    </text>
                    <text x={p.x + 9} y={p.ly + 9} fontSize="8" fill={color}>
                      {f?.glyph} {f?.zh}
                      {p.from ? ` · ${p.from}` : ""}
                    </text>
                  </>
                )}
              </g>
            );
          })}        </svg>

        <div className="blegend">
          <span><i className="lg on" />已选</span>
          <span><i className="lg off" />未选</span>
          <span><i className="lg add" />加入的材料带来的分子</span>
          <span className="lgnote">文字第二行＝香型（颜色与该香族一致）</span>
        </div>
        <div className="bjudge">
          <p>
            草莓的分子横跨三个时间层，所以它自带一套「熟果 → 花香 → 焦糖」的三调结构。
          </p>
          <p>
            已选 <b>{sel.length}</b> 个。
            {sel.length === 0
              ? "先挑你想突出的那个味道——挑完，右边才会开始推荐。"
              : "右边的材料是按「同系叠加 / 补空层 / 补香族」算出来的。"}
          </p>
        </div>
        <div className="bhow">
          <b>怎么读这张图</b>
          <s>HOW TO READ</s>
          <div className="hrows">
            <span>横轴＝多久能闻到：越靠右，留得越久</span>
            <span>纵轴＝多容易闻到：越靠上，阈值越低（1 吨水 1 克）</span>
            <span>空心＝没选，实心＝选中；点一下切换</span>
          </div>
        </div>

      </section>

      <aside className="bright">
        <div className="bh">
          <b>该加什么</b>
          <s>PAIRINGS</s>
          <em>按适配度</em>
        </div>

        {sel.length === 0 && <p className="rempty">← 先在台面上点一个分子</p>}

        {sel.length > 0 && pairs.map((p) => {
          const on = picked.includes(p.ing.id);
          return (
          <div
            className={on ? "pcard on" : "pcard"}
            key={p.ing.id}
            role="button"
            tabIndex={0}
            onClick={() => togglePick(p.ing.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                togglePick(p.ing.id);
              }
            }}
            title={on ? "点一下取消加入" : "点一下加入这杯"}
          >
            <div className="phd">
              <h4>{p.ing.zh}</h4>
              <s>{p.ing.en}</s>
              <em className="pbadge">{p.kindZh}</em>
              <em className="pease">{p.ease}</em>
              <i className="pok">{on ? "✓ 已加入" : "＋ 加入"}</i>
            </div>
            <div className="pline">
              <s>带来</s>
              <p>
                {p.brings.map((b) => (
                  <span key={b.id}>
                    {b.zh}
                    <i>{LV_ZH[b.level]}</i>
                  </span>
                ))}
              </p>
            </div>
            <p className="pwhy">{p.why}</p>
            <div className="pfoot">
              <span>建议 {p.use}</span>
              <span>{p.easeNote}</span>
              <b>{p.score}</b>
            </div>
          </div>
          );
        })}

        <div className="bpick">
          <span>基酒</span>
          <select value={spiritId} onChange={(e) => setSpiritId(e.target.value)}>
            {bases.filter((b) => b.role === "base").map((b) => (
              <option key={b.id} value={b.id}>{b.zh}</option>
            ))}
            <option value="none">不加酒</option>
          </select>
        </div>

        <div className="bacts">
          <button className="b1" disabled={!picked.length} onClick={sendTech}>
            带着这个构成去技法台 →
          </button>
          <button className="blink" disabled={!picked.length} onClick={sendRecipe}>
            或直接去配方台
          </button>
          <p className="bhint">
            {sel.length === 0
              ? "先在上面挑一个分子"
              : picked.length === 0
              ? "右边点一张卡片加入，再送过去"
              : "下一步是技法台——挑分子是为了决定该用什么手法留住它"}
          </p>
        </div>
        <p className="bfoot">
          {main.zh}
          {picked.map((id) => ` · ${pairs.find((p) => p.ing.id === id)?.ing.zh}`).join("")} · 已选 {sel.length} 个分子
        </p>
      </aside>
    </div>
  );
}
