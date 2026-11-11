import { useMemo, useState } from "react";
import { compounds, facets, facetById, ingredients, ingById } from "../engine/data";

const LY: Record<string, string> = { top: "前", heart: "中", base: "后", none: "—" };

function fmtThreshold(v: number | null | undefined) {
  if (v == null) return "—";
  if (v >= 0.001) return String(v);
  return v.toExponential(0).replace("e-", "e-");
}

export default function LibraryView() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("cmp-rip-01");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return compounds
      .filter((c) => !s || c.zh.includes(s) || c.en.toLowerCase().includes(s) || c.formula?.includes(s))
      .slice()
      .sort((a, b) => (a.odorMgL ?? 9e9) - (b.odorMgL ?? 9e9));
  }, [q]);

  const cur = compounds.find((c) => c.id === sel) ?? list[0];

  // 反查：哪些食材含这个分子
  const inFoods = useMemo(() => {
    if (!cur) return [];
    const out: { id: string; zh: string; level: string }[] = [];
    for (const i of ingredients) {
      const hit = (i.aroma ?? []).find(([cid]) => cid === cur.id);
      if (hit) out.push({ id: i.id, zh: i.zh, level: hit[1] });
    }
    return out;
  }, [cur]);

  const facet = cur ? facetById.get(cur.facets?.[0] ?? "") : undefined;

  return (
    <div className="lib">
      <div className="liblist">
        <div className="search" style={{ margin: "0 0 6px" }}>
          <span style={{ color: "var(--ink3)", fontSize: 11 }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜分子：丁酸 / linalool / C10H16" />
          <em style={{ fontStyle: "normal", fontSize: 9, color: "var(--ink3)" }}>{list.length}</em>
        </div>
        <div className="row" style={{ cursor: "default", borderBottom: "1px solid var(--line)" }}>
          <span style={{ width: 7 }} />
          <b style={{ fontSize: 9, color: "var(--ink3)", letterSpacing: ".1em" }}>名称</b>
          <s style={{ color: "var(--ink3)" }}>ENGLISH</s>
          <span className="th" style={{ fontSize: 8, color: "var(--ink3)" }}>阈值 mg/L</span>
          <span className="ly" style={{ fontSize: 8 }}>层</span>
          <span className="in" style={{ fontSize: 8, color: "var(--ink3)" }}>出现在</span>
        </div>
        {list.map((c) => {
          const f = facetById.get(c.facets?.[0] ?? "");
          const src = (c.from ?? []).slice(0, 4).join(" ");
          return (
            <div className={`row ${c.id === cur?.id ? "on" : ""}`} key={c.id} onClick={() => setSel(c.id)}>
              <span className="dot" style={{ background: f?.color ?? "#999" }} />
              <b>{c.zh}</b>
              <s>{c.en}</s>
              <span className="th">{fmtThreshold(c.odorMgL)}</span>
              <span className="ly">{LY[c.tLayer] ?? "—"}</span>
              <span className="in">{src || "—"}</span>
            </div>
          );
        })}
      </div>

      <div className="detail">
        {!cur && <div className="empty">没有匹配的分子。</div>}
        {cur && (
          <>
            <div className="sh">
              <b>选中</b>
              <s>SELECTED</s>
              <em>
                {facets.find((f) => f.id === cur.facets?.[0])?.zh ?? ""} · {LY[cur.tLayer]}调
              </em>
            </div>
            <h2>{cur.zh}</h2>
            <div className="sub">{cur.en}</div>

            <div className="dt">
              <div>
                <s>分子式</s>
                <b>{cur.formula ?? "—"}</b>
              </div>
              <div>
                <s>CAS</s>
                <b style={{ fontSize: 11 }}>{cur.cas ?? "—"}</b>
              </div>
              <div>
                <s>沸点</s>
                <b>{cur.bpC ?? "—"}{cur.bpC ? " ℃" : ""}</b>
              </div>
              <div>
                <s>logP</s>
                <b>{cur.logP ?? "—"}</b>
              </div>
              <div>
                <s>阈值（水中）</s>
                <b>{fmtThreshold(cur.odorMgL)}</b>
              </div>
              <div>
                <s>时间层</s>
                <b>{LY[cur.tLayer]}{cur.tLayer === "none" ? "" : "调"}</b>
              </div>
            </div>

            {cur.odorMgL != null && cur.odorMgL > 0 && (
              <div className="note" style={{ marginTop: 6 }}>
                换算成人话：<b className="num" style={{ color: "var(--ink)" }}>
                  1 吨水里 {(cur.odorMgL * 1000).toFixed(cur.odorMgL > 0.01 ? 0 : 1)} g
                </b>{" "}
                就能闻到。
              </div>
            )}

            <div className="sec">
              <div className="sh">
                <b>出现在</b>
                <s>FOUND IN</s>
                <em>{inFoods.length} / {ingredients.length}</em>
              </div>
              {inFoods.length ? (
                <div className="chips">
                  {inFoods.map((x) => (
                    <span className="chip" key={x.id}>
                      {x.zh} · {x.level}
                    </span>
                  ))}
                </div>
              ) : (
                <p>表 A 里没有登记它的食材来源（可能是扩展族，或只在基底里出现）。</p>
              )}
            </div>

            <div className="sec">
              <div className="sh">
                <b>香族</b>
                <s>FACETS</s>
              </div>
              <div className="chips">
                {(cur.facets ?? []).map((fid) => {
                  const f = facetById.get(fid);
                  return (
                    <span className="chip" key={fid}>
                      {f ? `${f.glyph} ${f.zh}` : fid}
                    </span>
                  );
                })}
                <span className="chip">{cur.conf === "lit" ? "文献值" : "估算值"}</span>
              </div>
            </div>

            {cur.note && (
              <div className="sec">
                <div className="sh">
                  <b>备注</b>
                  <s>NOTE</s>
                </div>
                <p>{cur.note}</p>
              </div>
            )}

            <div className="note">
              阈值来自文献或同系物估算，误差可达 3–10 倍。时间层是按沸点 / logP / 阈值推算的，不是实测。
              数据源：data/compounds.json（{compounds.length} 条）。
            </div>
          </>
        )}
      </div>
    </div>
  );
}
