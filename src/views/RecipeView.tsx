import { useMemo, useState } from "react";
import { bases, ingredients, baseById, ingById, facetById, FAMILY_ZH, ROLE_ZH } from "../engine/data";
import { COCKTAILS, type Cocktail } from "../engine/compose";
import { computeMix, computeFlavor, aromaProfile, judgeStructure, buildMethod, AXES, type Line } from "../engine/calc";
import { interactions } from "../engine/rules";

const INIT: Line[] = [
  { key: "k1", kind: "base", refId: "base-gin", amount: 50 },
  { key: "k2", kind: "ing", refId: "ing-cucumber", amount: 30 },
  { key: "k3", kind: "ing", refId: "ing-lime", amount: 15 },
  { key: "k4", kind: "base", refId: "base-honey", amount: 12 },
  { key: "k5", kind: "base", refId: "base-soda", amount: 60 },
];

let seq = 100;

export default function RecipeView({ initial, prep }: { initial?: Line[]; prep?: string }) {
  const [lines, setLines] = useState<Line[]>(() => initial ?? INIT);
  const [ice, setIce] = useState(true);
  const [mode, setMode] = useState<"base" | "ing">("ing");
  const [q, setQ] = useState("");

  const reading = useMemo(() => computeMix(lines, { ice }), [lines, ice]);
  const flavor = useMemo(() => computeFlavor(lines, reading), [lines, reading]);
  const facets = useMemo(() => aromaProfile(lines), [lines]);
  const hints = useMemo(() => interactions(lines, reading), [lines, reading]);
  const st = useMemo(() => judgeStructure(lines), [lines]);
  const steps = useMemo(() => buildMethod(lines, st, reading), [lines, st, reading]);

  const add = (kind: "base" | "ing", refId: string) => {
    setLines((prev) => {
      const hit = prev.find((l) => l.kind === kind && l.refId === refId);
      if (hit) return prev.map((l) => (l === hit ? { ...l, amount: l.amount + (kind === "base" ? 15 : 10) } : l));
      return [
        ...prev,
        { key: "k" + seq++, kind, refId, amount: kind === "base" ? 45 : 30 } as Line,
      ];
    });
  };

  const setAmount = (key: string, amount: number) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, amount } : l)));

  const remove = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const pool = (mode === "base" ? bases : ingredients).filter((x) => {
    const s = q.trim();
    if (!s) return true;
    return x.zh.includes(s) || x.en.toLowerCase().includes(s.toLowerCase());
  });

  const totalLines = lines.filter((l) => l.amount > 0);
  const title = "未命名特调";

  /** 按一个经典框架重排这一杯：保留基酒与主料，其余按模板给量 */
  const applySkeleton = (t: Cocktail) => {
    const spiritLine = lines.find(
      (l) => l.kind === "base" && (baseById.get(l.refId)?.abv ?? 0) > 0
    );
    const spiritId = spiritLine?.refId ?? "base-gin";
    const mainLine =
      lines.find((l) => l.kind === "ing" && l.refId !== "ing-lime" && l.amount > 0) ??
      lines.find((l) => l.kind === "ing" && l.refId !== "ing-lime");
    const mainId = mainLine?.refId ?? "ing-cucumber";
    const next: Line[] = [];
    let n = 0;
    const push = (kind: "base" | "ing", refId: string, amount: number) => {
      if (!amount) return;
      next.push({ key: `sk${n++}`, kind, refId, amount });
    };
    if (t.need.spirit) push("base", spiritId, t.need.spirit);
    if (t.need.main) push("ing", mainId, t.need.main);
    if (t.need.acid) push("ing", "ing-lime", t.need.acid);
    if (t.need.sweet) push("base", "base-honey", t.need.sweet);
    if (t.need.bubble)
      push("base", t.bubbleId ?? "base-soda", t.need.bubble);
    for (const e of t.extra ?? []) push("base", e.id, e.ml);
    if (next.length) setLines(next);
  };

  return (
    <div className="recipe">
      {/* 左：经典框架 */}
      <div className="picker">
        <div className="ph">
          <b>经典框架</b>
          <s>SKELETONS</s>
          <em>{COCKTAILS.length}</em>
        </div>
        <div className="sknote">
          点一个，把这杯按它的比例重排（基酒与主料不变）。现在判定为「{st.skeleton}」。
        </div>
        <div className="plist sklist">
          {COCKTAILS.map((t) => {
            const map: Record<string, string> = {
              highball: "highball",
              built: "highball",
              sour: "sour",
              oldfashioned: "short",
              mocktail: "mocktail",
            };
            const cur = (map[st.key] ?? "") === t.id;
            const bits = [
              t.need.spirit ? `酒 ${t.need.spirit}` : "",
              t.need.main ? `主料 ${t.need.main}` : "",
              t.need.acid ? `酸 ${t.need.acid}` : "",
              t.need.sweet ? `甜 ${t.need.sweet}` : "",
              t.need.bubble
                ? `${t.bubbleId ? baseById.get(t.bubbleId)?.zh ?? "汽水" : "气泡"} ${t.need.bubble}`
                : "",
              ...(t.extra ?? []).map((e) => `${baseById.get(e.id)?.zh ?? e.id} ${e.ml}`),
            ].filter(Boolean);
            return (
              <div
                className={cur ? "prow sk on" : "prow sk"}
                key={t.id}
                onClick={() => applySkeleton(t)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") applySkeleton(t);
                }}
              >
                <b>
                  {t.zh}
                  {cur && <i className="curmark">现在</i>}
                </b>
                <s>{t.en}</s>
                <em>{bits.join(" · ")}</em>
                <u>{t.abv[0]}–{t.abv[1]}%</u>
              </div>
            );
          })}
        </div>
      </div>

      {/* 中：配方 */}
      <div className="mid">
        <div className="mhead">
          <h1>{title}</h1>
          <s>RECIPE</s>
          <div className="sub">
            {totalLines.length} 样 · 入杯 {Math.round(reading.totalIn)} ml
            {ice ? ` + 冰融 ${Math.round(reading.totalIn * 0.2)}` : ""}
          </div>
        </div>

        {prep && (
          <div className="prepchip">
            <span>含备料</span>
            <b>{prep}</b>
            <em>浓度与保存按技法台的参数估的，配方台不重算</em>
          </div>
        )}

        {totalLines.length === 0 && (
          <div className="empty">左边点两样加进来。<br />读数会跟着变——这是这一版真正在算的东西。</div>
        )}

        {totalLines.map((l) => {
          const isBase = l.kind === "base";
          const b = isBase ? baseById.get(l.refId) : undefined;
          const i = !isBase ? ingById.get(l.refId) : undefined;
          const max = isBase ? 150 : 200;
          return (
            <div className="line" key={l.key}>
              <div className="nm">
                <b className={l.label ? "prepn" : undefined}>{l.label ?? (b?.zh ?? i?.zh)}</b>
                <s>
                  {l.sub ??
                    (l.label
                      ? "技法产物"
                      : (b?.en ?? i?.en) +
                        (b ? ` · ${b.abv}%` : i?.ph ? ` · pH ${i.ph}` : ""))}
                </s>
              </div>
              <input
                type="range"
                min={0}
                max={max}
                step={isBase ? 1 : 1}
                value={l.amount}
                onChange={(e) => setAmount(l.key, Number(e.target.value))}
              />
              <div className="v">
                {l.amount}
                <s>{isBase ? "ml" : "g"}</s>
              </div>
              <button className="x" onClick={() => remove(l.key)} title="移除">
                ✕
              </button>
            </div>
          );
        })}

        <div className="sh" style={{ marginTop: 12 }}>
          <b>配方结构</b>
          <s>STRUCTURE</s>
          <em>按角色判读</em>
        </div>
        <div className="skel">{st.skeleton}</div>
        <div className="roles">
          {st.roles.map((r) => (
            <span className={r.ok ? "r ok" : "r"} key={r.label}>
              {r.ok ? "✓" : "✗"} {r.label}
            </span>
          ))}
        </div>
        <div className="lay3">
          {st.layers.map((l) => (
            <span key={l.label}>
              {l.label} <b className="num">{l.n}</b>
            </span>
          ))}
          <span className="miss">{st.missing}</span>
        </div>
        <div className="sh" style={{ marginTop: 14 }}>
          <b>做法</b>
          <s>METHOD</s>
          <em>按结构自动生成</em>
        </div>
        <ol className="steps">
          {steps.map((s) => (
            <li key={s.n}>
              <span className="num">{s.n}</span>
              <p>{s.t}</p>
            </li>
          ))}
        </ol>
        <div className="addrow">
          <label style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={ice} onChange={(e) => setIce(e.target.checked)} /> 满冰杯（按 20%
            稀释计入）
          </label>
        </div>

        <div className="note">
          这一版只做「配方」：所有数字来自 data/ 下的五张表，改任一滑块都会重算。
          ABV / 糖 / 酸 / 体积按质量折体积并计入乙醇-水体积收缩（R12）；pH 为估算，算法见 docs/15。
        </div>
      </div>

      {/* 右：读数 */}
      <div className="side">
        <div className="sh">
          <b>读数</b>
          <s>READINGS</s>
          <em>实时计算</em>
        </div>

        <div className="grid6">
          <div className="g6">
            <s>ABV</s>
            <b>{reading.abv.toFixed(1)}</b>
            <i>%vol</i>
          </div>
          <div className="g6">
            <s>糖</s>
            <b>{reading.sugarG100.toFixed(1)}</b>
            <i>g/100</i>
          </div>
          <div className="g6">
            <s>总酸</s>
            <b>{reading.acidGL.toFixed(1)}</b>
            <i>g/L</i>
          </div>
          <div className="g6">
            <s>pH</s>
            <b>{reading.ph.toFixed(1)}</b>
            <i>估</i>
          </div>
          <div className="g6">
            <s>成品</s>
            <b>{Math.round(reading.volumeMl)}</b>
            <i>ml</i>
          </div>
          <div className="g6">
            <s>质量</s>
            <b>{Math.round(reading.massG)}</b>
            <i>g</i>
          </div>
        </div>

        <div className="sh" style={{ marginTop: 10 }}>
          <b>风味轮廓</b>
          <s>PROFILE</s>
          <em>0–5 估算</em>
        </div>
        {AXES.map((a) => (
          <div className="fbar" key={a}>
            <span>{a}</span>
            <div className="t">
              <i style={{ width: `${(flavor[a] / 5) * 100}%` }} />
            </div>
            <em>{flavor[a].toFixed(1)}</em>
          </div>
        ))}

        {facets.length > 0 && (
          <>
            <div className="sh" style={{ marginTop: 10 }}>
              <b>香味族</b>
              <s>FAMILY</s>
              <em>来自香气分子</em>
            </div>
            {facets.map((f) => {
              const meta = facetById.get(f.facet);
              return (
                <div className="fam" key={f.facet}>
                  <span className="d" style={{ background: meta?.color ?? "#999" }} />
                  <span>{meta ? `${meta.zh}` : f.facet}</span>
                  <em>{f.score.toFixed(1)}</em>
                </div>
              );
            })}
          </>
        )}

        <div className="sh" style={{ marginTop: 10 }}>
          <b>交互提示</b>
          <s>INTERACTIONS</s>
          <em>共 {hints.length} 条</em>
        </div>
        {hints.length === 0 && <div className="empty">加两三样有味道的东西，这里会出现提示。</div>}
        {hints.map((h) => (
          <div className={`hint tone-${h.tone}`} key={h.id}>
            <div className="t">
              <span className="tag">{h.tag}</span>
              <b>{h.title}</b>
              <em>{h.evidence}</em>
            </div>
            <p>{h.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
