import { useMemo, useState } from "react";
import techRaw from "../../data/techniques.json";
import { FAMILY_ZH, ingredients, compoundById } from "../engine/data";
import type { BenchCtx } from "./BenchView";
import { buildRecipe } from "../engine/recipe";
import { prepProfile } from "../engine/prep";
import type { Line } from "../engine/calc";

interface ParamSpec {
  key: string; label: string; unit: string;
  min: number; max: number; step: number; default: number;
  safe: [number, number]; danger: [number, number][]; note?: string;
}
interface Phase { from: number; to: number; zh: string; note: string }
interface Tech {
  id: string; no: string; zh: string; en: string; family: string;
  oneLiner: string; params: ParamSpec[]; phases: Phase[];
  output: { name: string; keep: string; note: string };
  equipment: string[]; failures: string[]; tech: string[];
}

const TECHS = (techRaw as any).items as Tech[];
const FAMS = (techRaw as any).families as { id: string; zh: string }[];
const FAM_GLYPH: Record<string, string> = {
  extraction: "◍", clarification: "◇", structure: "◆", aging: "◼",
};

export default function TechniqueView({
  ctx,
  onUse,
}: {
  ctx?: BenchCtx | null;
  onUse: (lines: Line[], prepNote: string) => void;
}) {
  const [id, setId] = useState("T1");
  const [vals, setVals] = useState<Record<string, number>>(() =>
    Object.fromEntries(TECHS.find((t) => t.id === "T1")!.params.map((p) => [p.key, p.default]))
  );
  const [stockId, setStockId] = useState("ing-strawberry");

  const tech = TECHS.find((t) => t.id === id)!;

  /** 从分子台带过来的构成 → 该先看哪几条技法 */
  const sug = useMemo(() => {
    if (!ctx) return [] as { id: string; why: string }[];
    const cmps = ctx.compounds
      .map((cid) => compoundById.get(cid))
      .filter(Boolean) as any[];
    const facets = new Set<string>(cmps.flatMap((c) => c.facets ?? []));
    const layers = new Set<string>(cmps.map((c) => c.tLayer));
    const main = ingredients.find((i) => i.id === ctx.mainId) as any;
    const out: { id: string; why: string }[] = [];
    if (facets.has("green"))
      out.push({ id: "T3", why: "你选的青绿香在 65℃ 以上基本留不住，只有 90 秒的快速浸渍能保住" });
    if (facets.has("caramel") || layers.has("base"))
      out.push({ id: "T1", why: "后调的焦糖/木质要靠 65℃ 左右的长时间慢煮，高温快出只会烤糊它" });
    if (facets.has("floral"))
      out.push({ id: "T4", why: "花香最怕氧化和高温，4℃ 冷萃 12 h 是最稳的保香方式" });
    if (main && (main.actives ?? []).some((a: string) => a.includes("果胶")))
      out.push({ id: "T11", why: `${main.zh}带果胶，酶澄清 40–50℃ / 30 min 能把浑浊变成透明` });
    if (!out.length)
      out.push({ id: "T1", why: "没有特别脆弱或特别顽固的香型，低温慢煮是最稳的起点" });
    return out.slice(0, 3);
  }, [ctx]);

  const pick = (t: Tech) => {
    setId(t.id);
    setVals(Object.fromEntries(t.params.map((p) => [p.key, p.default])));
  };

  /** 时间轴：以本次设置的主时间参数为准，看落在哪个阶段 */
  const timeParam = tech.params.find((p) => /time/i.test(p.key)) ?? tech.params[1] ?? tech.params[0];
  const tNow = vals[timeParam.key] ?? timeParam.default;

  const warn = useMemo(() => {
    const out: string[] = [];
    for (const p of tech.params) {
      const v = vals[p.key] ?? p.default;
      for (const [a, b] of p.danger) {
        if (v >= a && v <= b) out.push(`${p.label} ${v}${p.unit} 落在危险区（${a}–${b}${p.unit}）`);
      }
      if (p.safe && (v < p.safe[0] || v > p.safe[1]) && !p.danger.some(([a, b]) => v >= a && v <= b)) {
        out.push(`${p.label} ${v}${p.unit} 低于推荐区间（${p.safe[0]}–${p.safe[1]}${p.unit}）`);
      }
    }
    return out.slice(0, 3);
  }, [tech, vals]);

  const pct = (v: number, min: number, max: number) => ((v - min) / (max - min)) * 100;

  /** 这批料：总投料 → 溶剂 → 备料量（料液比来自参数，缺省 1:1） */
  const batch = useMemo(() => {
    const mats = ctx?.materials ?? [];
    const totalG = mats.reduce((s2, m) => s2 + m.amount, 0);
    const rk = tech.params.find((p) => /ratio/i.test(p.key))?.key;
    const ratio = rk ? vals[rk] ?? 1 : 1;
    const solvent = Math.round(totalG * ratio);
    return { mats, totalG, solvent, out: Math.round(solvent * 1.12) };
  }, [ctx, tech, vals]);
  /** 具体配方：把参数翻译成一份能照做的东西 */
  const rec = useMemo(() => {
    const mats = ctx?.materials ?? [];
    const totalG = mats.reduce((s2, m) => s2 + m.amount, 0);
    const rk = tech.params.find((p) => /ratio/i.test(p.key))?.key;
    const ratio = rk ? vals[rk] ?? 1 : 1;
    const solvent = Math.round(totalG * ratio);
    return buildRecipe(tech.id, {
      mainZh: mats[0]?.zh ?? "草莓",
      matsText: mats.length
        ? mats.map((m) => `${m.zh} ${m.amount}${m.unit}`).join(" ＋ ")
        : "草莓 200 g",
      mainG: mats[0]?.amount ?? 200,
      solventMl: solvent || 200,
      totalG,
      out: Math.round((solvent || 200) * 1.12),
      vals,
    });
  }, [ctx, tech, vals]);

  const send = () => {
    // 送进配方台的是「技法产物」，不是原材料。
    // 一杯 45 ml 产物 + 补酸 + 补气泡；原材料的重量已经在技法的配方里了。
    const lines: Line[] = [];
    const matsTxt = batch.mats.length
      ? batch.mats.map((m) => `${m.zh} ${m.amount}${m.unit}`).join(" + ")
      : "";
    const prepName = tech.output.name;
    const prof = prepProfile(
      batch.mats.map((m) => ({ id: m.id, zh: m.zh, amount: m.amount })),
      batch.solvent ?? 250,
      ctx?.spiritId || "base-gin"
    );
    const prepLabel = `${prepName} ${prof.out} ml`;
    lines.push({
      key: "p0",
      kind: "base",
      refId: ctx?.spiritId || "base-gin",
      amount: 45,
      label: prepLabel,
      sub: `技法产物 · ${prof.abv}% ABV · 糖 ${prof.sugar} g/100mL${matsTxt ? ` · ${matsTxt}` : ""}`,
      ov: { abv: prof.abv, sugar: prof.sugar, acid: prof.acid },
      // 一杯用 1/5 批次，所以风味也只继承 1/5 的料，避免整批味道都被算进一杯
      carry: batch.mats.map((m) => ({ id: m.id, g: Math.max(1, Math.round(m.amount / 5)) })),
    });
    lines.push({ key: "p1", kind: "ing", refId: "ing-lime", amount: 20 });
    lines.push({ key: "p2", kind: "base", refId: "base-soda", amount: 50 });
    const paramTxt = tech.params
      .slice(0, 2)
      .map((p) => `${p.label} ${vals[p.key] ?? p.default}${p.unit}`)
      .join(" · ");
    const matTxt = batch.mats.length
      ? "｜" + batch.mats.map((m) => `${m.zh} ${m.amount}${m.unit}`).join(" + ")
      : "";
    onUse(lines, `${tech.zh}（${paramTxt}）${matTxt}`);
  };

  return (
    <div className="tech">
      <aside className="tleft">
        <div className="bh">
          <b>技法库</b><s>TECHNIQUES</s><em>{TECHS.length}</em>
        </div>
        {FAMS.map((f) => (
          <div key={f.id}>
            <div className="tfam">
              <i>{FAM_GLYPH[f.id]}</i>
              {f.zh}
              <em>{TECHS.filter((t) => t.family === f.id).length}</em>
            </div>
            {TECHS.filter((t) => t.family === f.id).map((t) => (
              <button key={t.id} className={t.id === id ? "trow on" : "trow"} onClick={() => pick(t)}>
                <s>{t.no}</s>
                <b>{t.zh}</b>
                <em>{t.en.toLowerCase()}</em>
              </button>
            ))}
          </div>
        ))}
        <p className="tnote">技法不是菜单——它是「在同一批材料上，你还能做什么」。</p>
      </aside>

      <section className="tmid">
        <div className="thd">
          <div className="thl">
            <div className="tno">No. {tech.no}</div>
            <h2>
              {tech.zh} <s>{tech.en}</s>
            </h2>
            <p>{tech.oneLiner}</p>
          </div>
          <div className="thr">
            <div>
              <s>FAMILY</s>
              <b>{FAMS.find((f) => f.id === tech.family)?.zh}</b>
            </div>
            <div>
              <s>PARAMS</s>
              <b>{tech.params.length}</b>
            </div>
            <div>
              <s>OUTPUT</s>
              <b>{tech.output.name}{batch.out > 0 ? ` ${batch.out} ml` : ""}</b>
            </div>
          </div>
        </div>

        {ctx && (
          <div className="tctx">
            <div className="tctxrow">
              <b>来自分子台</b>
              <span>
                {ingredients.find((i) => i.id === ctx.mainId)?.zh ?? ""}
                {ctx.picks
                  .map((pid) => ` + ${ingredients.find((i) => i.id === pid)?.zh ?? ""}`)
                  .join("")}
              </span>
              <em>已选 {ctx.compounds.length} 个分子</em>
            </div>
            <div className="tsug">
              <s>按这个构成，先看这几条</s>
              {sug.map((g) => {
                const t = TECHS.find((x) => x.id === g.id);
                if (!t) return null;
                return (
                  <button
                    key={g.id}
                    className={g.id === id ? "sg on" : "sg"}
                    onClick={() => pick(t)}
                    title={g.why}
                  >
                    <b>
                      {t.zh} {g.id}
                    </b>
                    <i>{g.why}</i>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="tparams">
          {tech.params.map((p) => {
            const v = vals[p.key] ?? p.default;
            const bad = p.danger.some(([a, b]) => v >= a && v <= b);
            return (
              <div className={bad ? "tparam bad" : "tparam"} key={p.key}>
                <div className="pl">
                  <b>{p.label}</b>
                  <s>{p.unit}</s>
                  <em>
                    {v}
                    {p.unit}
                  </em>
                </div>
                <div className="sl">
                  <span className="band safe" style={{ left: `${pct(p.safe[0], p.min, p.max)}%`, width: `${pct(p.safe[1], p.min, p.max) - pct(p.safe[0], p.min, p.max)}%` }} />
                  {p.danger.map(([a, b], i) => (
                    <span key={i} className="band dgr" style={{ left: `${pct(a, p.min, p.max)}%`, width: `${pct(b, p.min, p.max) - pct(a, p.min, p.max)}%` }} />
                  ))}
                  <input
                    type="range" min={p.min} max={p.max} step={p.step} value={v}
                    onChange={(e) => setVals((s) => ({ ...s, [p.key]: Number(e.target.value) }))}
                  />
                </div>
                <div className="pscale">
                  <span>{p.min}</span>
                  <span className="ok">推荐 {p.safe[0]}–{p.safe[1]}</span>
                  <span>{p.max}</span>
                </div>
                {p.note && <div className="pnote">{p.note}</div>}
              </div>
            );
          })}
        </div>

        <div className="bh" style={{ paddingLeft: 0 }}>
          <b>配方</b><s>RECIPE</s>
          <em>{rec.generic ? "通用步骤" : "按当前参数算的具体比例"}</em>
        </div>
        <div className="trecipe">
          <div className="trhead">
            <b>{tech.zh} · {ctx?.materials?.[0]?.zh ?? "草莓"}</b>
            <span>{rec.solvent}</span>
          </div>
          <div className="trlines">
            {rec.lines.map(([k, v]) => (
              <div key={k}>
                <s>{k}</s>
                <b>{v}</b>
              </div>
            ))}
          </div>
          <ol className="trsteps">
            {rec.steps.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
          <p className="trnote">{rec.note}</p>
        </div>
        <div className="bh" style={{ paddingLeft: 0 }}>
          <b>化学过程</b><s>WHAT HAPPENS</s>
          <em>横轴＝{timeParam.label}（{timeParam.unit}）· 当前 {tNow}{timeParam.unit}</em>
        </div>
        <div className="tphase">
          {tech.phases.map((ph) => {
            const cur = tNow >= ph.from && tNow < ph.to;
            return (
              <div className={cur ? "ph cur" : "ph"} key={ph.zh}>
                <div className="phbar" />
                <b>{ph.zh}</b>
                <s>{ph.from}–{ph.to} {timeParam.unit}</s>
                <p>{ph.note}</p>
              </div>
            );
          })}
        </div>

        <div className="tfail">
          <div className="bh" style={{ paddingLeft: 0 }}>
            <b>失败模式</b><s>FAILURE MODES</s>
          </div>
          {tech.failures.map((f) => (
            <div className="fl" key={f}>×　{f}</div>
          ))}
        </div>
        <div className="tchain">
          <span className="cn">用这批料</span>
          <b>
            {batch.mats.length
              ? batch.mats.map((m) => `${m.zh} ${m.amount}${m.unit}`).join(" ＋ ")
              : "草莓 200 g"}
          </b>
          <i>→</i>
          <span className="cw">{tech.zh} {vals["tempC"] ?? ""}℃ · {tNow}{timeParam.unit}</span>
          <i>→</i>
          <b>{tech.output.name}{batch.out > 0 ? ` ${batch.out} ml` : ""}</b>
          <i>＋</i>
          <span className="cn2">可继续：{[...new Set(tech.tech.filter(Boolean))].join(" / ") || "—"}</span>
        </div>

        <div className="tcmp">
          <div className="bh" style={{ paddingLeft: 0 }}>
            <b>同族对比</b><s>SAME FAMILY</s><em>时间 / 香气保留 / 适合</em>
          </div>
          <div className="cmp">
            <div className="chr"><span>技法</span><span>时间</span><span>香气保留</span><span>设备</span><span>适合</span></div>
            {[
              { id: "T1", t: "90 min", k: "78%", e: "慢煮机 + 真空袋", s: "大批量、批次稳定" },
              { id: "T3", t: "90 s", k: "92%", e: "虹吸瓶 N₂O", s: "现做现用、香气最活" },
              { id: "T4", t: "12 h", k: "96%", e: "冰箱", s: "茶 / 咖啡 / 低酸植物" },
            ].map((r) => {
              const cur = r.id === tech.id;
              return (
                <div className={cur ? "cr cur" : "cr"} key={r.id}>
                  <span>{cur ? "· " : ""}{TECHS.find((x) => x.id === r.id)?.zh} {r.id}</span>
                  <span>{r.t}</span>
                  <span>{r.k}</span>
                  <span>{r.e}</span>
                  <span>{r.s}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tcont">
          <span>产物还能继续加工</span>
          {tech.tech.map((tid) => {
            const t = TECHS.find((x) => x.id === tid);
            return t ? (
              <button key={tid} className="cc" onClick={() => pick(t)}>
                {t.zh} {tid}
              </button>
            ) : null;
          })}
        </div>

      </section>

      <aside className="tright">
        <div className="bh">
          <b>产物</b><s>OUTPUT</s><em>估</em>
        </div>

        <div className="tout">
          <div className="tohd">备料 · PREP</div>
          <h3>{tech.output.name}</h3>
          <div className="tomata">
            {tech.params.slice(0, 3).map((p) => (
              <span key={p.key}>
                {p.label} <b>{vals[p.key] ?? p.default}{p.unit}</b>
              </span>
            ))}
          </div>
          <div className="tokeep">{tech.output.keep}</div>
          <p className="tonote">{tech.output.note}</p>
          {batch.totalG > 0 && (
            <div className="tbatch">
              投料 <b>{batch.totalG} g</b> · 溶剂 <b>{batch.solvent} ml</b> · 得 <b>{batch.out} ml</b>
              <span className="tglasses">（每杯 45 ml，约够 <b>{Math.max(1, Math.floor(batch.out / 45))}</b> 杯）</span>
            </div>
          )}
        </div>

        {warn.length > 0 && (
          <div className="twarn">
            <b>这套参数有问题</b>
            {warn.map((w) => (
              <span key={w}>· {w}</span>
            ))}
          </div>
        )}

        <div className="bh" style={{ paddingLeft: 0 }}>
          <b>设备</b><s>EQUIPMENT</s>
        </div>
        <div className="tequ">{tech.equipment.map((e) => <span key={e}>{e}</span>)}</div>

        <div className="bh" style={{ paddingLeft: 0 }}>
          <b>这批能做什么</b><s>USE IT</s>
          <em>{batch.out > 0 ? `每杯 45 ml · 约够 ${Math.max(1, Math.floor(batch.out / 45))} 杯` : "—"}</em>
        </div>
        <div className="tdose">
          <div><span>Highball</span><b>45 ml</b></div>
          <div><span>Sour（替代部分基酒）</span><b>50 ml</b></div>
          <div><span>气泡（＋苏打 60 ml）</span><b>30 ml</b></div>
          <div><span>淋冰淇淋 / 直饮</span><b>15 ml</b></div>
        </div>

        <div className="tstock">
          <span>用这批料</span>
          {batch.mats.length > 0 ? (
            <div className="tstocklist">
              {batch.mats.map((m) => (
                <em key={m.id}>
                  {m.zh} <b>{m.amount}</b> {m.unit}
                </em>
              ))}
              <i>合计 {batch.totalG} g</i>
            </div>
          ) : (
            <select value={stockId} onChange={(e) => setStockId(e.target.value)}>
              <option value="ing-strawberry">草莓 200 g</option>
              <option value="ing-raspberry">覆盆子 200 g</option>
              <option value="ing-pineapple">菠萝 200 g</option>
            </select>
          )}
        </div>

        <div className="tacts">
          <button className="b1" onClick={send}>做成备料，送进配方台 →</button>
        </div>
      </aside>
    </div>
  );
}
