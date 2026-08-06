"use client";

import { useState, useEffect, useCallback } from "react";
import { get, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type PickRow = {
  ticker: string;
  name: string;
  market: string;
  element: string;
  tier: string;
  score: number;
  price: number | null;
  changePct: number | null;
  reasons: string[];
  fundamentals: { roe: number | null; buffett: number | null } | null;
};
type PicksData = {
  market: string;
  label: string;
  desc: string;
  benchmark: { symbol: string; name: string; changePct: number | null; price: number | null };
  updatedAt: string | null;
  picks: PickRow[];
  methodology: string[];
  disclaimer: string;
};

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };
const STRATS = [
  { id: "TH", emoji: "🇹🇭", title: "TH30 — เหนือ SET", sub: "30 หุ้นไทยเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  { id: "US", emoji: "🇺🇸", title: "US30 — เหนือ S&P 500", sub: "30 หุ้นสหรัฐเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  { id: "MID", emoji: "📈", title: "MID30 — หุ้นกลางไทย", sub: "30 หุ้นขนาดกลางไทย (mid/small) ศักยภาพโตในประเทศ+ภูมิภาค" },
];

export default function PicksPage() {
  const t = useT();
  const [market, setMarket] = useState("TH");
  const [data, setData] = useState<PicksData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await get<PicksData>(`/api/picks?market=${market}&userId=${myUserId()}`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, [market]);

  useEffect(() => {
    setData(null);
    setError("");
    load();
  }, [load]);

  const elKey = (e: string) => ELMAP[e] ?? e;
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>🤖 {t("picks.title")}</h2>
        <p style={{ fontSize: 13, color: "#9a937f" }}>{t("picks.sub")}</p>
        <div className="chips" style={{ marginTop: 10 }}>
          {STRATS.map((s) => (
            <button key={s.id} className={`chip ${market === s.id ? "on" : ""}`} onClick={() => setMarket(s.id)}>
              {s.emoji} {s.title}
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#d48f8f" }}>{error}</p>}

      {data && (
        <>
          <div className="card" style={{ borderColor: "#d4af37" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>
                  {data.label} <span className="tag">อัปเดต {data.updatedAt ? data.updatedAt.slice(0, 10) : "-"}</span>
                </h2>
                <p style={{ fontSize: 12.5, color: "#9a937f" }}>{data.desc}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 12, color: "#9a937f" }}>เทียบ benchmark วันนี้</p>
                <p style={{ fontSize: 15 }}>
                  <b style={{ color: "#d4af37" }}>{data.benchmark.name}</b>{" "}
                  <span style={{ color: (data.benchmark.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(data.benchmark.changePct)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            {data.picks.map((p, i) => (
              <div key={p.ticker} style={{ borderBottom: "1px solid #262a34", padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div>
                    <b>
                      #{i + 1} {p.ticker}
                    </b>{" "}
                    <span style={{ color: ELEMENT_COLOR[elKey(p.element)] ?? "#d4af37" }}>{t(`el.${elKey(p.element)}` as never)}</span>{" "}
                    <span className="tag">{p.market}</span> <span className="tag">{p.tier}</span>
                    <div style={{ fontSize: 12.5, color: "#9a937f" }}>{p.name}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <b style={{ color: "#d4af37" }}>{p.score}</b>
                    <div style={{ fontSize: 12.5 }}>
                      {p.price != null ? `${p.price.toLocaleString()}` : "-"}{" "}
                      <span style={{ color: (p.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(p.changePct)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "#9a937f", marginTop: 4 }}>
                  {p.reasons.map((r, j) => (
                    <span key={j}>
                      {j > 0 ? " · " : ""}
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2 style={{ fontSize: 15 }}>📐 {t("picks.method")}</h2>
            {data.methodology.map((m, i) => (
              <p key={i} style={{ fontSize: 12.5, color: "#9a937f" }}>
                {i + 1}. {m}
              </p>
            ))}
            <p style={{ fontSize: 12, color: "#9a937f", marginTop: 8 }}>⚠️ {data.disclaimer}</p>
          </div>
        </>
      )}
    </div>
  );
}
