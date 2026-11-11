import { useEffect, useMemo, useState } from "react";
import RecipeView from "./views/RecipeView";
import LibraryView from "./views/LibraryView";
import RecommendView from "./views/RecommendView";
import BenchView, { type BenchCtx } from "./views/BenchView";
import TechniqueView from "./views/TechniqueView";
import { bases, ingredients, compounds } from "./engine/data";
import { pairFor, mainAmount } from "./engine/pairing";
import { prepProfile } from "./engine/prep";
import type { Line } from "./engine/calc";

type Tab = "rec" | "bench" | "tech" | "recipe" | "library";

export default function App() {
  const [tab, setTab] = useState<Tab>(() => {
    const h = typeof location !== "undefined" ? location.hash.replace("#", "") : "";
    if (h === "library") return "library";
    if (h === "bench") return "bench";
    if (h === "tech") return "tech";
    if (h === "recipe") return "recipe";
    return "rec";
  });
  const [benchCtx, setBenchCtx] = useState<BenchCtx | null>(() => {
    if (typeof location === "undefined") return null;
    const q = location.search;
    const m = /[?&]main=([^&]*)/.exec(q);
    if (!m) return null;
    const p = /[?&]picks=([^&]*)/.exec(q);
    const c = /[?&]sel=([^&]*)/.exec(q);
    return {
      mainId: decodeURIComponent(m[1]),
      picks: p ? decodeURIComponent(p[1]).split(",").filter(Boolean) : [],
      compounds: c ? decodeURIComponent(c[1]).split(",").filter(Boolean) : [],
      materials: (() => {
        const mainId = decodeURIComponent(m[1]);
        const picks = p ? decodeURIComponent(p[1]).split(",").filter(Boolean) : [];
        const cmps = c ? decodeURIComponent(c[1]).split(",").filter(Boolean) : [];
        const main = ingredients.find((i) => i.id === mainId);
        if (!main) return [];
        const ps = pairFor(mainId, cmps);
        return [
          { id: main.id, zh: main.zh, amount: mainAmount(main), unit: "g" },
          ...picks
            .map((pid) => {
              const q = ps.find((x) => x.ing.id === pid);
              return q
                ? { id: pid, zh: q.ing.zh, amount: q.amount, unit: q.unit }
                : null;
            })
            .filter((x): x is { id: string; zh: string; amount: number; unit: string } => !!x),
        ];
      })(),
      spiritId: "base-gin",
    };
  });
  const [handoff, setHandoff] = useState<{ lines: Line[]; n: number; prep?: string } | null>(() => {
    if (typeof location === "undefined") return null;
    const m = /[?&]prep=([^&]*)/.exec(location.search);
    if (!m) return null;
    const txt = decodeURIComponent(m[1]);
    const mats = [
      { id: "ing-strawberry", zh: "草莓", amount: 200 },
      { id: "ing-pineapple", zh: "菠萝", amount: 25 },
      { id: "ing-raspberry", zh: "覆盆子", amount: 25 },
    ];
    const prof = prepProfile(mats, 250, "base-vodka");
    return {
      lines: [
        {
          key: "p0",
          kind: "base",
          refId: "base-vodka",
          amount: 45,
          label: `${txt} ${prof.out} ml`,
          sub: `技法产物 · ${prof.abv}% ABV · 糖 ${prof.sugar} g/100mL`,
          ov: { abv: prof.abv, sugar: prof.sugar, acid: prof.acid },
          carry: mats.map((m) => ({ id: m.id, g: Math.round(m.amount / 5) })),
        },
        { key: "p1", kind: "ing", refId: "ing-lime", amount: 20 },
        { key: "p2", kind: "base", refId: "base-soda", amount: 50 },
      ],
      n: 0,
      prep: txt,
    };
  });

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace("#", "");
      setTab(h === "library" ? "library" : h === "bench" ? "bench" : h === "tech" ? "tech" : h === "recipe" ? "recipe" : "rec");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    location.hash = t === "rec" ? "" : t;
  };

  const stats = useMemo(
    () => ({ bases: bases.length, ings: ingredients.length, cmps: compounds.length }),
    []
  );

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          分子特调<s>MOLECULAR MIXOLOGY</s>
        </div>
        <nav className="tabs">
          <button className={tab === "rec" ? "on" : ""} onClick={() => go("rec")}>
            推荐<s>RECOMMEND</s>
          </button>
          <button className={tab === "bench" ? "on" : ""} onClick={() => go("bench")}>
            分子<s>BENCH</s>
          </button>
          <button className={tab === "tech" ? "on" : ""} onClick={() => go("tech")}>
            技法<s>TECH</s>
          </button>
          <button className={tab === "recipe" ? "on" : ""} onClick={() => go("recipe")}>
            配方<s>RECIPE</s>
          </button>
          <button className={tab === "library" ? "on" : ""} onClick={() => go("library")}>
            资料<s>LIBRARY</s>
          </button>
        </nav>
        <div className="badge">
          <span>
            基底 <b>{stats.bases}</b>
          </span>
          <span>
            食材 <b>{stats.ings}</b>
          </span>
          <span>
            分子 <b>{stats.cmps}</b>
          </span>
          <span>测试版 v0.2</span>
        </div>
      </header>

      {tab === "rec" && (
        <RecommendView
          onUse={(lines) => {
            setHandoff({ lines, n: Date.now() });
            go("recipe");
          }}
        />
      )}
      {tab === "bench" && (
        <BenchView
          onTechnique={(ctx) => {
            setBenchCtx(ctx);
            go("tech");
          }}
          onUse={(lines) => {
            setHandoff({ lines, n: Date.now() });
            go("recipe");
          }}
        />
      )}
      {tab === "tech" && (
        <TechniqueView
          ctx={benchCtx}
          onUse={(lines, prep) => {
            setHandoff({ lines, n: Date.now(), prep });
            go("recipe");
          }}
        />
      )}
      {tab === "recipe" && (
        <RecipeView key={handoff?.n ?? 0} initial={handoff?.lines} prep={handoff?.prep} />
      )}
      {tab === "library" && <LibraryView />}
    </div>
  );
}
