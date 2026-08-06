"use client";

import { useState, useEffect, useCallback } from "react";
import { get, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type AssetRow = {
  ticker: string;
  name: string;
  type: string;
  element: string;
  riskTier: string;
  verdict: "very-good" | "good" | "neutral" | "avoid";
  score: number;
  reasons: string[];
  capped: boolean;
  changePct: number | null;
};
type AssetsData = { count: number; assets: AssetRow[] };
type PortfolioData = { rows: Array<{ element: string; pct: number; assets: string[]; note: string }>; total: number };

const TYPES = ["commodity", "crypto", "etf", "reit", "bond", "deposit", "forex", "fund", "derivative", "real_asset", "lottery", "insurance"] as const;
const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };
const VD_EMOJI: Record<string, string> = { "very-good": "✅✅", good: "✅", neutral: "🟡", avoid: "⛔" };

export default function AssetsPage() {
  const t = useT();
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [type, setType] = useState<string>("all");
  const [error, setError] = useState("");
  const [needProfile, setNeedProfile] = useState(false);

  const load = useCallback(async () => {
    const uid = myUserId();
    const [a, p] = await Promise.all([get<AssetsData>(`/api/assets?userId=${uid}`), get<PortfolioData>(`/api/portfolio?userId=${uid}`)]);
    if (a.ok) setAssets(a.data.assets);
    else {
      if (a.error.includes("โปรไฟล์")) setNeedProfile(true);
      setError(a.error);
    }
    if (p.ok) setPortfolio(p.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const elKey = (e: string) => ELMAP[e] ?? e;
  const shown = type === "all" ? assets : assets.filter((a) => a.type === type);
  const elLabel = (e: string) => t(`el.${elKey(e)}` as never);
  const vdLabel = (v: string) => t(`vd.${v}` as never);
  const tierLabel = (r: string) => t(`tier.${r}` as never);
  const typeLabel = (ty: string) => t(`at.${ty}` as never);

  return (
    <div>
      <div className="card">
        <h2>{t("assets.title")}</h2>
        <p style={{ fontSize: 13, color: "#9a937f" }}>{t("assets.sub")}</p>
        {needProfile && (
          <p style={{ marginTop: 8 }}>
            ⚠️ {t("assets.needprofile")} — <a href="/profile">→</a>
          </p>
        )}
        <div className="chips" style={{ marginTop: 10 }}>
          <button className={`chip ${type === "all" ? "on" : ""}`} onClick={() => setType("all")}>
            {t("assets.all")}
          </button>
          {TYPES.map((ty) => (
            <button key={ty} className={`chip ${type === ty ? "on" : ""}`} onClick={() => setType(ty)}>
              {typeLabel(ty)}
            </button>
          ))}
        </div>
      </div>

      {portfolio && (
        <div className="card">
          <h2>{t("assets.portfolio")}</h2>
          {portfolio.rows.map((r) => (
            <div key={r.element} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <b>
                  {elLabel(r.element)} {r.pct}%
                </b>
                <span style={{ color: "#9a937f" }}>{r.assets.join(" · ")}</span>
              </div>
              <div style={{ background: "#2a2e39", borderRadius: 6, height: 8, marginTop: 4 }}>
                <div
                  style={{
                    width: `${r.pct}%`,
                    background: ELEMENT_COLOR[elKey(r.element)] ?? "#d4af37",
                    height: 8,
                    borderRadius: 6,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        {shown.length === 0 ? (
          <p style={{ color: "#9a937f" }}>{error || t("admin.nodata")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("assets.all")}</th>
                <th>{t("assets.verdict")}</th>
                <th>ธาตุ</th>
                <th>{t("assets.risk")}</th>
                <th>%วันนี้</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a, i) => (
                <tr key={a.ticker}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{a.name}</b>{" "}
                    <span className="tag">{typeLabel(a.type)}</span>
                    <div style={{ fontSize: 11.5, color: "#9a937f" }}>
                      {a.ticker} {a.capped ? "· ⚠️เกินกำลังดวง" : ""}
                    </div>
                  </td>
                  <td>
                    {VD_EMOJI[a.verdict] ?? ""} {vdLabel(a.verdict)} <span style={{ color: "#9a937f", fontSize: 12 }}>({a.score})</span>
                  </td>
                  <td>
                    <span style={{ color: ELEMENT_COLOR[elKey(a.element)] ?? "#d4af37", fontWeight: 700 }}>{elLabel(a.element)}</span>
                  </td>
                  <td>{tierLabel(a.riskTier)}</td>
                  <td style={{ color: (a.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>
                    {a.changePct != null ? `${a.changePct >= 0 ? "+" : ""}${a.changePct}%` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: "#9a937f" }}>{t("assets.gochat")}</p>
    </div>
  );
}
