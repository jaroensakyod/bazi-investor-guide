"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { get, post, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type StockRow = { ticker: string; name: string; market: string; country: string; sector: string; element: string; tier: string; riskTier: string; stockTier: string; stockTierScore: number; price: number | null; changePct: number | null };
type StocksData = { count: number; total: number; markets: Record<string, number>; elementCounts: Record<string, number>; countries: Record<string, number>; stocks: StockRow[] };
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
  const [element, setElement] = useState("");
  const [country, setCountry] = useState("");
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
    if (element) params.set("element", element);
    if (country) params.set("country", country);
    if (q.trim()) params.set("q", q.trim());
    const r = await get<StocksData>(`/api/stocks?${params}&userId=${myUserId()}`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, [market, element, country, q]);

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
  const CTRY: Record<string, string> = { TH: "🇹🇭 ไทย", US: "🇺🇸 สหรัฐฯ", JP: "🇯🇵 ญี่ปุ่น", CN: "🇨🇳 จีน", IN: "🇮🇳 อินเดีย", KR: "🇰🇷 เกาหลี", HK: "🇭🇰 ฮ่องกง", TW: "🇹🇼 ไต้หวัน", VN: "🇻🇳 เวียดนาม", SG: "🇸🇬 สิงคโปร์", ID: "🇮🇩 อินโดนีเซีย", MY: "🇲🇾 มาเลเซีย", PH: "🇵🇭 ฟิลิปปินส์", AU: "🇦🇺 ออสเตรเลีย", CA: "🇨🇦 แคนาดา", GB: "🇬🇧 อังกฤษ", DE: "🇩🇪 เยอรมนี", FR: "🇫🇷 ฝรั่งเศส", CH: "🇨🇭 สวิส", PK: "🇵🇰 ปากีสถาน", SA: "🇸🇦 ซาอุ", BR: "🇧🇷 บราซิล", MX: "🇲🇽 เม็กซิโก", TR: "🇹🇷 ตุรกี", ZA: "🇿🇦 แอฟริกาใต้" };
  const TIER_ICON: Record<string, string> = { gold: "🥇", silver: "🥈", bronze: "🥉", base: "📦" };
  const TIER_COLOR: Record<string, string> = { gold: "#f5c542", silver: "#c0c8d4", bronze: "#d08a4e", base: "#9a937f" };
  const markets = data ? Object.entries(data.markets).sort((a, b) => b[1] - a[1]) : [];
  const countries = data ? Object.entries(data.countries).sort((a, b) => b[1] - a[1]) : [];
  const elements = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>
          {t("stocks.title")} {data ? <span className="tag">{data.total.toLocaleString()} ตัว</span> : ""}
        </h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("stocks.search")} />

        {/* ── กรองตามธาตุ ── */}
        <div className="chips" style={{ marginTop: 8 }}>
          <button className={`chip ${element === "" ? "on" : ""}`} onClick={() => setElement("")}>
            ⚖️ ทั้งหมด ({data ? elements.reduce((a, e) => a + (data.elementCounts[e] ?? 0), 0) : 0})
          </button>
          {elements.map((e) => (
            <button key={e} className={`chip ${element === e ? "on" : ""}`} style={{ color: ELEMENT_COLOR[elKey(e)] ?? "#d4af37" }} onClick={() => setElement(e)}>
              {t(`el.${elKey(e)}` as never)} ({data?.elementCounts[e] ?? 0})
            </button>
          ))}
        </div>

        {/* ── กรองตามประเทศ + ตลาด ── */}
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <select value={country} onChange={(e) => setCountry(e.target.value)} style={{ background: "#1a1d26", color: "#cfcabe", border: "1px solid #2a2e39", borderRadius: 6, padding: "5px 8px", fontSize: 12.5 }}>
            <option value="">🌍 {t("stocks.countryAll")}</option>
            {countries.map(([c, n]) => (
              <option key={c} value={c}>
                {CTRY[c] ?? c} ({n})
              </option>
            ))}
          </select>
          <select value={market} onChange={(e) => setMarket(e.target.value)} style={{ background: "#1a1d26", color: "#cfcabe", border: "1px solid #2a2e39", borderRadius: 6, padding: "5px 8px", fontSize: 12.5 }}>
            <option value="">🏛️ {t("stocks.marketAll")}</option>
            {markets.map(([m, n]) => (
              <option key={m} value={m}>
                {m} ({n})
              </option>
            ))}
          </select>
          {data && (
            <span style={{ fontSize: 12, color: "#9a937f", alignSelf: "center" }}>
              {t("stocks.found")}: {data.count.toLocaleString()} ตัว
            </span>
          )}
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
                <th>🏆 เทียร์</th>
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
                    <td>
                      <span title={`เทียร์ ${TIER_ICON[s.stockTier] ?? "📦"} (คะแนน ${s.stockTierScore}) — ตรงดวง+พื้นฐาน+สภาพคล่อง`}>
                        {TIER_ICON[s.stockTier] ?? "📦"} <span style={{ color: TIER_COLOR[s.stockTier] ?? "#9a937f", fontSize: 12 }}>{s.stockTier}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ color: s.riskTier === "safe" ? "#8fd4a0" : s.riskTier === "risky" ? "#d48f8f" : "#d4af37", fontSize: 12 }}>
                        {s.riskTier === "safe" ? "🟢" : s.riskTier === "risky" ? "🔴" : "🟡"} {s.riskTier === "safe" ? "ปลอดภัย" : s.riskTier === "risky" ? "เสี่ยง" : "ปานกลาง"}
                      </span>{" "}
                      <span style={{ fontSize: 11, color: "#9a937f" }}>({s.tier})</span>
                    </td>
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
