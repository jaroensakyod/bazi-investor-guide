"use client";

import { useState, useEffect, useCallback } from "react";
import { get } from "../lib/api";
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

  async function showDetail(ticker: string) {
    setLoadingDetail(true);
    setError("");
    const r = await get<StockDetail>(`/api/stock?ticker=${encodeURIComponent(ticker)}`);
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
        <div className="card" style={{ borderColor: "#d4af37" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h2>
              {detail.name} ({detail.ticker}){" "}
              <span style={{ color: ELEMENT_COLOR[elKey(detail.primaryElement)] ?? "#d4af37" }}>{t(`el.${elKey(detail.primaryElement)}` as never)}</span>{" "}
              <span className="tag">{detail.market}</span> <span className="tag">{detail.tier}</span>
              {detail.risingStar ? <span className="tag good">⭐ rising star</span> : ""}
            </h2>
            <button className="btn secondary" style={{ fontSize: 12 }} onClick={() => setDetail(null)}>
              ✕
            </button>
          </div>
          <p style={{ fontSize: 13.5, marginTop: 6 }}>
            🏭 <b>{detail.sector}</b> — {detail.business}
          </p>
          <p style={{ fontSize: 13, color: "#9a937f" }}>
            🌍 {detail.country} · 💱 {detail.currency} · 📅 จดทะเบียน {detail.listedDate ?? "-"} · 🎯 {detail.growthStage}
            {detail.isHighLiquidity ? " · 💧 สภาพคล่องสูง" : ""}
          </p>
          <p style={{ fontSize: 13, color: "#9a937f" }}>🔮 {detail.elementReason}</p>
          {detail.theme.length ? (
            <p style={{ fontSize: 12.5 }}>
              {detail.theme.map((th) => (
                <span key={th} className="tag">
                  {th}
                </span>
              ))}
            </p>
          ) : null}
          <p style={{ marginTop: 8 }}>
            💰 ราคา: <b>{detail.price != null ? `${detail.price.toLocaleString()} ${detail.currency}` : "-"}</b>{" "}
            <span style={{ color: (detail.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(detail.changePct)}</span>
            {detail.updatedAt ? <span style={{ color: "#9a937f", fontSize: 12 }}> · อัปเดต {detail.updatedAt.slice(0, 16)}</span> : ""}
          </p>
          {detail.fundamentals && (
            <p style={{ fontSize: 13, color: "#9a937f" }}>
              📊 ROE {detail.fundamentals.roe != null ? `${detail.fundamentals.roe}%` : "-"} · Buffett {detail.fundamentals.buffettScore}/10
            </p>
          )}
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
                <tr key={s.ticker} onClick={() => showDetail(s.ticker)} style={{ cursor: "pointer" }}>
                  <td>
                    <b>{s.ticker}</b>
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
              ))}
            </tbody>
          </table>
        )}
        {data && data.count > 300 && <p style={{ color: "#9a937f", fontSize: 12.5, marginTop: 6 }}>แสดง 300 จาก {data.count} — ใช้ค้นหา/เลือกตลาดเพื่อแคบลง</p>}
      </div>
    </div>
  );
}
