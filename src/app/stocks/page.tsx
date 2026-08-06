"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { get, post, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type StockRow = { ticker: string; name: string; market: string; country: string; sector: string; element: string; tier: string; price: number | null; changePct: number | null };
type StocksData = { count: number; total: number; markets: Record<string, number>; stocks: StockRow[] };
type StockDetail = {
  ticker: string;
  name: string;
  nameEn: string | null;
  market: string;
  country: string;
  currency: string;
  sector: string;
  business: string;
  theme: string[];
  growthStage: string;
  listedDate: string | null;
  elements: string[];
  primaryElement: string;
  elementReason: string;
  tier: string;
  risingStar: boolean;
  isHighLiquidity: boolean;
  price: number | null;
  changePct: number | null;
  updatedAt: string | null;
  fundamentals: { roe: number | null; profitMargin: number | null; revenueGrowth: number | null; debtToEquity: number | null; buffettScore: number } | null;
};

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };

export default function StocksPage() {
  const t = useT();
  const [data, setData] = useState<StocksData | null>(null);
  const [market, setMarket] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [watching, setWatching] = useState<Record<string, boolean>>({});

  async function toggleWatch(ticker: string, market: string) {
    const entry = `s:${market}:${ticker}`;
    const r = await post<{ entries: string[] }>(`/api/watchlist?userId=${myUserId()}&action=add&entry=${encodeURIComponent(entry)}`, {});
    setWatching((w) => ({ ...w, [entry]: r.ok && r.data.entries.includes(entry) }));
  }

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "300" });
    if (market) params.set("market", market);
    if (q.trim()) params.set("q", q.trim());
    const r = await get<StocksData>(`/api/stocks?${params}`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, [market, q]);

  useEffect(() => {
    const h = setTimeout(load, 200);
    return () => clearTimeout(h);
  }, [load]);

  async function showDetail(ticker: string, market: string) {
    setLoadingDetail(true);
    setError("");
    const r = await get<StockDetail>(`/api/stock?ticker=${encodeURIComponent(ticker)}&market=${encodeURIComponent(market)}`);
    setLoadingDetail(false);
    if (r.ok) setDetail(r.data);
    else setError(r.error);
  }

  const elKey = (e: string) => ELMAP[e] ?? e;
  const markets = data ? Object.entries(data.markets).sort((a, b) => b[1] - a[1]) : [];
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>
          {t("stocks.title")} {data ? <span className="tag">{data.total.toLocaleString()} ตัว</span> : ""}
        </h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("stocks.search")} />
        <div className="chips" style={{ marginTop: 8 }}>
          <button className={`chip ${market === "" ? "on" : ""}`} onClick={() => setMarket("")}>
            {t("assets.all")} ({data?.total ?? 0})
          </button>
          {markets.map(([m, n]) => (
            <button key={m} className={`chip ${market === m ? "on" : ""}`} onClick={() => setMarket(m)}>
              {m} ({n})
            </button>
          ))}
        </div>
      </div>

      {error && <p style={{ color: "#d48f8f" }}>{error}</p>}

      {detail && (
        <div className="card" style={{ borderColor: "#d4af37", display: "none" }}>
          {/* คลิก → info แสดงใต้แถว (ด้านล่าง) — การ์ดนี้ถูกย้ายไป inline แล้ว */}
        </div>
      )}
      {loadingDetail && <p style={{ color: "#9a937f" }}>⏳ กำลังโหลด...</p>}

      <div className="card">
        {data && data.stocks.length === 0 ? (
          <p style={{ color: "#9a937f" }}>{t("admin.nodata")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("stocks.ticker")}</th>
                <th>ชื่อ</th>
                <th>ตลาด</th>
                <th>ธาตุ</th>
                <th>{t("assets.risk")}</th>
                <th>ราคา</th>
                <th>%วันนี้</th>
              </tr>
            </thead>
            <tbody>
              {(data?.stocks ?? []).map((s) => (
                <Fragment key={`${s.market}:${s.ticker}`}>
                  <tr onClick={() => showDetail(s.ticker, s.market)} style={{ cursor: "pointer" }}>
                    <td>
                      <b>{s.ticker}</b>{" "}
                      <button
                        className="btn secondary"
                        style={{ fontSize: 11, padding: "1px 6px", marginLeft: 4 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWatch(s.ticker, s.market);
                        }}
                      >
                        {watching[`s:${s.market}:${s.ticker}`] ? "⭐" : "☆"}
                      </button>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {s.name}
                      <div style={{ fontSize: 11.5, color: "#9a937f" }}>{s.sector}</div>
                    </td>
                    <td>
                      {s.market} <span style={{ fontSize: 11, color: "#9a937f" }}>{s.country}</span>
                    </td>
                    <td>
                      <span style={{ color: ELEMENT_COLOR[elKey(s.element)] ?? "#d4af37", fontWeight: 700 }}>{t(`el.${elKey(s.element)}` as never)}</span>
                    </td>
                    <td>{s.tier}</td>
                    <td>{s.price != null ? s.price.toLocaleString() : "-"}</td>
                    <td style={{ color: (s.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(s.changePct)}</td>
                  </tr>
                  {detail && detail.ticker === s.ticker && detail.market === s.market && (
                    <tr key={`${s.market}:${s.ticker}-info`} style={{ background: "#12151c" }}>
                      <td colSpan={7} style={{ padding: "10px 14px", fontSize: 13 }}>
                        <p>
                          🏭 <b>{detail.sector}</b> — {detail.business}
                        </p>
                        <p style={{ color: "#9a937f" }}>
                          🌍 {detail.country} · 💱 {detail.currency} · 📅 จดทะเบียน {detail.listedDate ?? "-"} · 🎯 {detail.growthStage}
                          {detail.isHighLiquidity ? " · 💧 สภาพคล่องสูง" : ""}
                        </p>
                        <p style={{ color: "#9a937f" }}>🔮 {detail.elementReason}</p>
                        {detail.theme.length ? (
                          <p>
                            {detail.theme.map((th) => (
                              <span key={th} className="tag">
                                {th}
                              </span>
                            ))}
                          </p>
                        ) : null}
                        <p>
                          💰 ราคา: <b>{detail.price != null ? `${detail.price.toLocaleString()} ${detail.currency}` : "-"}</b>{" "}
                          <span style={{ color: (detail.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(detail.changePct)}</span>
                          {detail.updatedAt ? <span style={{ color: "#9a937f", fontSize: 12 }}> · อัปเดต {detail.updatedAt.slice(0, 16)}</span> : ""}
                        </p>
                        {detail.fundamentals && (
                          <p style={{ color: "#9a937f" }}>
                            📊 ROE {detail.fundamentals.roe != null ? `${detail.fundamentals.roe}%` : "-"} · Buffett {detail.fundamentals.buffettScore}/10
                          </p>
                        )}
                        <button className="btn secondary" style={{ fontSize: 11.5, marginTop: 4 }} onClick={() => setDetail(null)}>
                          ✕ ปิด
                        </button>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        {data && data.count > 300 && <p style={{ color: "#9a937f", fontSize: 12.5, marginTop: 6 }}>แสดง 300 จาก {data.count} — ใช้ค้นหา/เลือกตลาดเพื่อแคบลง</p>}
      </div>
    </div>
  );
}
