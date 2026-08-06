"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { get, post, myUserId } from "../lib/api";
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
type AssetDetail = {
  kind: "asset";
  asset: { ticker: string; name: string; type: string; sector: string | null; element: string; riskTier: string; elementReason: string };
  price: number | null;
  changePct: number | null;
  verdict: { verdict: string; score: number; reasons: string[]; capped: boolean } | null;
};

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
  const [detail, setDetail] = useState<AssetDetail | null>(null);

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

  async function showDetail(ticker: string) {
    setError("");
    const r = await get<AssetDetail>(`/api/report?ticker=${encodeURIComponent(ticker)}&userId=${myUserId()}`);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    if (r.data.kind === "asset") setDetail(r.data);
    else setError("ไม่พบสินทรัพย์นี้");
  }

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

      {detail && (
        <div className="card" style={{ borderColor: "#d4af37", display: "none" }}>
          {/* คลิก → info แสดงใต้แถว (ด้านล่าง) — การ์ดนี้ถูกย้ายไป inline แล้ว */}
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
                <Fragment key={a.ticker}>
                  <tr onClick={() => showDetail(a.ticker)} style={{ cursor: "pointer" }}>
                    <td>
                      {i + 1}{" "}
                      <button
                        className="btn secondary"
                        style={{ fontSize: 11, padding: "1px 6px", marginLeft: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          post(`/api/watchlist?userId=${myUserId()}&action=add&entry=${encodeURIComponent(`a:${a.ticker}`)}`, {});
                        }}
                      >
                        ☆
                      </button>
                    </td>
                    <td>
                      <b>{a.name}</b>{" "}
                      <span className="tag">{typeLabel(a.type)}</span>
                      <div style={{ fontSize: 11.5, color: "#9a937f" }}>
                        {a.ticker} {a.capped ? "· ⚠️เกินกำลังดวง" : ""}
                      </div>
                    </td>
                    <td>
                      {a.verdict ? (
                        <>
                          {VD_EMOJI[a.verdict] ?? ""} {vdLabel(a.verdict)} <span style={{ color: "#9a937f", fontSize: 12 }}>({a.score})</span>
                        </>
                      ) : (
                        <span style={{ color: "#9a937f" }}>-</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: ELEMENT_COLOR[elKey(a.element)] ?? "#d4af37", fontWeight: 700 }}>{elLabel(a.element)}</span>
                    </td>
                    <td>{tierLabel(a.riskTier)}</td>
                    <td style={{ color: (a.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>
                      {a.changePct != null ? `${a.changePct >= 0 ? "+" : ""}${a.changePct}%` : "-"}
                    </td>
                  </tr>
                  {detail && detail.asset.ticker === a.ticker && (
                    <tr key={`${a.ticker}-info`} style={{ background: "#12151c" }}>
                      <td colSpan={6} style={{ padding: "10px 14px", fontSize: 13 }}>
                        <p>
                          <b>🏭 {detail.asset.sector ?? detail.asset.type}</b> — {detail.asset.elementReason}
                        </p>
                        {detail.verdict ? (
                          <>
                            <p>
                              {t("assets.verdict")}: <b>{VD_EMOJI[detail.verdict.verdict] ?? ""} {vdLabel(detail.verdict.verdict)}</b> ({detail.verdict.score}){" "}
                              {detail.verdict.capped ? <span className="tag avoid">⚠️ เกินกำลังดวง</span> : ""}
                            </p>
                            {detail.verdict.reasons.map((r, j) => (
                              <p key={j} style={{ color: "#9a937f" }}>
                                • {r}
                              </p>
                            ))}
                          </>
                        ) : (
                          <p style={{ color: "#9a937f" }}>{t("assets.needprofile")}</p>
                        )}
                        <p>
                          💰 ราคา: <b>{detail.price != null ? `$${detail.price.toLocaleString()}` : "-"}</b>{" "}
                          <span style={{ color: (detail.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{detail.changePct != null ? `${detail.changePct >= 0 ? "+" : ""}${detail.changePct}%` : "-"}</span>{" "}
                          <button className="btn secondary" style={{ fontSize: 11.5, marginLeft: 8 }} onClick={() => setDetail(null)}>
                            ✕ ปิด
                          </button>
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: "#9a937f" }}>{t("assets.gochat")}</p>
    </div>
  );
}
