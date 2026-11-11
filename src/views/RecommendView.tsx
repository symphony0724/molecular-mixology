import { useMemo, useState } from "react";
import { ALL_BASE, ALL_ING, compose, type Mood, type Combo } from "../engine/compose";
import { FAMILY_ZH, baseById, ingById, ROLE_ZH } from "../engine/data";
import type { Line } from "../engine/calc";

const MOODS: Mood[] = ["清爽", "浓郁", "酸甜", "苦烈", "温暖"];

export default function RecommendView({ onUse }: { onUse: (lines: Line[]) => void }) {
  // ?main=ing-chenpi&mood=温暖 便于直接看不同风味给出的不同骨架
  const qs = typeof location !== "undefined" ? location.search : "";
  const qMain = /[?&]main=([^&]*)/.exec(qs);
  const qMood = /[?&]mood=([^&]*)/.exec(qs);
  const [mood, setMood] = useState<Mood>(
    (qMood ? (decodeURIComponent(qMood[1]) as Mood) : "清爽") as Mood
  );
  const [ings, setIngs] = useState<string[]>(
    qMain ? [decodeURIComponent(qMain[1])] : ["ing-strawberry"]
  );
  const [bs, setBs] = useState<string[]>(["base-vodka"]);
  const [pick, setPick] = useState<"ing" | "base">("ing");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(true);

  const combos = useMemo(() => compose({ ings, bases: bs, mood }), [ings, bs, mood]);

  const pool = (pick === "ing" ? ALL_ING : ALL_BASE).filter((x: any) => {
    const s = q.trim();
    if (!s) return true;
    return x.zh.includes(s) || x.en.toLowerCase().includes(s.toLowerCase());
  });

  const toggle = (kind: "ing" | "base", id: string) => {
    const [arr, set] = kind === "ing" ? [ings, setIngs] : [bs, setBs];
    set((arr as string[]).includes(id) ? (arr as string[]).filter((x) => x !== id) : [...(arr as string[]), id]);
  };

  const nameOf = (l: Line) => (l.kind === "base" ? baseById.get(l.refId)?.zh : ingById.get(l.refId)?.zh) ?? "?";

  return (
    <div className="rec">
      {/* 左：选材料 */}
      <div className="rleft">
        <div className="ph">
          <b>我的材料</b>
          <s>PICK</s>
          <em>
            {ings.length + bs.length} 样
          </em>
        </div>

        <div className="gh">蔬果香料</div>
        <div className="chips" style={{ padding: "0 12px 6px" }}>
          {ings.length === 0 && <span className="chiphint">还没勾——先勾一两样有味道的</span>}
          {ings.map((id) => (
            <span className="cchip" key={id} onClick={() => toggle("ing", id)}>
              {ingById.get(id)?.zh} ✕
            </span>
          ))}
        </div>

        <div className="gh">酒与气泡</div>
        <div className="chips" style={{ padding: "0 12px 6px" }}>
          {bs.length === 0 && <span className="chiphint">没勾就走无酒精</span>}
          {bs.map((id) => {
            const b = baseById.get(id);
            return (
              <span className="cchip" key={id} onClick={() => toggle("base", id)}>
                {b?.zh} {b?.abv ? `${b.abv}%` : ""} ✕
              </span>
            );
          })}
        </div>

        <div className="segs" style={{ margin: "8px 12px 6px" }}>
          <button className={pick === "ing" ? "on" : ""} onClick={() => setPick("ing")}>
            加食材 {ALL_ING.length}
          </button>
          <button className={pick === "base" ? "on" : ""} onClick={() => setPick("base")}>
            加基底 {ALL_BASE.length}
          </button>
        </div>
        <div className="search" style={{ margin: "0 12px 4px" }}>
          <span style={{ color: "var(--ink3)", fontSize: 11 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索" />
        </div>
        <div className="plist" style={{ maxHeight: 250 }}>
          {pool.map((x: any) => {
            const on = (pick === "ing" ? ings : bs).includes(x.id);
            return (
              <div className="prow" key={x.id} onClick={() => toggle(pick, x.id)}>
                <b style={on ? { color: "var(--copper)" } : undefined}>{x.zh}</b>
                <s>{x.en}</s>
                {pick === "ing" && x.avail && (
                  <i
                    className={`av av-${x.avail.lv}`}
                    title={x.avail.where}
                  >
                    {x.avail.lv === "easy" ? "易" : x.avail.lv === "mid" ? "中" : "难"}
                  </i>
                )}
                <em>
                  {pick === "base" ? `${x.abv}% · ${ROLE_ZH[x.role] ?? ""}` : FAMILY_ZH[x.fam] ?? x.fam}
                </em>
              </div>
            );
          })}
        </div>

        <div className="gh" style={{ marginTop: 6 }}>
          想喝什么
        </div>
        <div className="moods">
          {MOODS.map((m) => (
            <button key={m} className={mood === m ? "on" : ""} onClick={() => setMood(m)}>
              {m}
            </button>
          ))}
        </div>

        <div className="tally">
          {ings.length + bs.length} 样材料 · 可组 <b className="num">{combos.length}</b> 种 · 值得试{" "}
          <b className="num">{Math.min(5, combos.length)}</b> 种
          <br />
          引擎：覆盖 40% · 协同 25% · 平衡 20% · 新颖 10% · 简易 5%
        </div>
      </div>

      {/* 右：方案卡 */}
      <div className="rmain">
        <div className="mhead">
          <h1>推荐组合</h1>
          <s>COMBINATIONS</s>
          <div className="sub">
            按「{mood}」排序 · 共 {combos.length} 杯 · 每杯都写清楚为什么是这几样
          </div>
        </div>

        {combos.length === 0 && (
          <div className="empty">
            现在组不出东西。先勾一样有香气的食材（草莓、柠檬、黄瓜都行），或者勾一瓶酒。
          </div>
        )}

        {combos.map((c, i) => (
          <Card key={c.id} c={c} i={i} onUse={onUse} nameOf={nameOf} />
        ))}
      </div>
    </div>
  );
}

function Card({
  c,
  i,
  onUse,
  nameOf,
}: {
  c: Combo;
  i: number;
  onUse: (l: Line[]) => void;
  nameOf: (l: Line) => string;
}) {
  const [openM, setOpenM] = useState(false);
  return (
    <div className={`card ${i === 0 ? "best" : ""}`}>
      <div className="chd">
        <span className="no num">No.{String(i + 1).padStart(2, "0")}</span>
        <h3>{c.name}</h3>
        <span className="tag">
          {c.skeleton} · {c.skeletonEn}
        </span>
        <span className="abv num">{c.abv.toFixed(1)}%</span>
        <span className="sc num">{c.score}</span>
      </div>

      <div className="cline">
        <s>配比</s>
        <p>
          {c.lines.map((l) => (
            <span key={l.key} className={l.kind === "ing" ? "ii" : ""}>
              {nameOf(l)} {l.amount}
              <i>{l.kind === "base" ? "ml" : "g"}</i>{" "}
            </span>
          ))}
        </p>
      </div>

      <div className="cline">
        <s>为什么</s>
        <p>{c.why}</p>
      </div>

      {c.borrowed.length > 0 && (
        <div className="cline">
          <s>缺什么</s>
          <p className="miss">{c.missing}</p>
        </div>
      )}

      <div className="cline">
        <s>风险</s>
        <p className="risk">{c.risk || "没有特别要提醒的。"}</p>
      </div>

      <div className="parts">
        {c.parts.map((p) => (
          <span key={p.label}>
            {p.label} <b className="num">{p.score}</b>
          </span>
        ))}
        <span style={{ marginLeft: "auto", color: "var(--ink3)" }}>
          成品 {Math.round(c.volume)} ml · 糖 {c.sugar.toFixed(1)} · 酸 {c.acid.toFixed(1)}
        </span>
      </div>

      {openM && (
        <ol className="steps" style={{ margin: "4px 0 2px" }}>
          {c.method.map((s) => (
            <li key={s.n}>
              <span className="num">{s.n}</span>
              <p>{s.t}</p>
            </li>
          ))}
        </ol>
      )}

      <div className="cacts">
        <button className="b2" onClick={() => setOpenM((v) => !v)}>
          {openM ? "收起做法" : "看做法"}
        </button>
        <button className="b1" onClick={() => onUse(c.lines)}>
          送进配方台 →
        </button>
      </div>
    </div>
  );
}
