"use client";

import { useState, useEffect, useCallback } from "react";
import { get, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type ElementRow = { element: string; strength: string; count: number; pct: number };
type PersonalData = {
  persona: { element: string; band: string; bandLabel: string; name: string; emoji: string; strengths: string; weaknesses: string; style: string; allocation: string };
  elementBalance: ElementRow[];
  strongestElement: { element: string; count: number };
  strengthen: { element: string; businessHint: string; wealth: string };
  avoid: string[];
  trading: { allowed: "no" | "limited" | "yes"; label: string; reason: string; split: { emergency: number; cold: number; fast: number } };
  instruments: { emergency: string[]; cold: string[]; fast: string[] };
  topStocks: Array<{ ticker: string; name: string; market: string; price: number | null; changePct: number | null; score: number }>;
  topAssets: Array<{ ticker: string; name: string; type: string; riskTier: string; price: number | null; changePct: number | null }>;
  auspiciousDays: {
    next14: Array<{ date: string; weekday: string; dayElement: string | null; fit: "good" | "neutral" | "avoid" }>;
    month: { monthElement: string | null; caishenDir: string; goodDays: Array<{ date: string; weekday: string }>; avoidDays: Array<{ date: string; weekday: string }>; goodDayCount: number; avoidDayCount: number };
  };
  disclaimer: string;
};

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };
const TRADING_STYLE = {
  no: { color: "#d48f8f", emoji: "⛔" },
  limited: { color: "#d4af37", emoji: "🟡" },
  yes: { color: "#8fd4a0", emoji: "✅" },
};

export default function PersonalPage() {
  const t = useT();
  const [data, setData] = useState<PersonalData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await get<PersonalData>(`/api/personal?userId=${myUserId()}`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const elKey = (e: string) => ELMAP[e] ?? e;
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>🔮 {t("personal.title")}</h2>
        <p style={{ fontSize: 12.5, color: "#9a937f" }}>{t("personal.sub")}</p>
        {error && <p style={{ color: "#d48f8f" }}>{error}</p>}
      </div>

      {data && (
        <>
          {/* ── ตัวตน + เทรดได้/ไม่ได้ ── */}
          <div className="card" style={{ borderColor: "#d4af37" }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ marginBottom: 2 }}>
                  {data.persona.emoji} {data.persona.name} ({data.persona.bandLabel})
                </h2>
                <p style={{ fontSize: 13, color: "#9a937f", maxWidth: 420 }}>
                  <b>{t("personal.style")}:</b> {data.persona.style} · <b>{data.persona.allocation}</b>
                </p>
                <p style={{ fontSize: 12.5, color: "#9a937f" }}>💪 {data.persona.strengths}</p>
                <p style={{ fontSize: 12.5, color: "#9a937f" }}>⚠️ {data.persona.weaknesses}</p>
              </div>
              <div style={{ textAlign: "center", minWidth: 150 }}>
                <p style={{ fontSize: 12, color: "#9a937f" }}>{t("personal.trading")}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: TRADING_STYLE[data.trading.allowed].color }}>
                  {TRADING_STYLE[data.trading.allowed].emoji} {data.trading.label}
                </p>
              </div>
            </div>
            <p style={{ fontSize: 12.5, marginTop: 8, background: "#12151c", padding: 10, borderRadius: 8, color: "#cfcabe" }}>
              💬 {data.trading.reason}
            </p>
          </div>

          {/* ── ธาตุในดวง ── */}
          <div className="card">
            <h2>⚖️ {t("personal.elements")}</h2>
            {data.elementBalance.map((e) => (
              <div key={e.element} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <b style={{ color: ELEMENT_COLOR[elKey(e.element)] ?? "#d4af37" }}>{t(`el.${elKey(e.element)}` as never)}</b>
                  <span style={{ color: "#9a937f" }}>
                    {e.count} ตัว ({e.pct}%)
                    {e.element === data.strengthen.element ? <b style={{ color: "#8fd4a0" }}> ← ต้องเสริม!</b> : ""}
                    {e.element === data.strongestElement.element && e.element !== data.strengthen.element ? <b style={{ color: "#3e6fb0" }}> ← มากสุด</b> : ""}
                  </span>
                </div>
                <div style={{ background: "#2a2e39", borderRadius: 6, height: 8, marginTop: 3 }}>
                  <div style={{ width: `${e.pct}%`, background: ELEMENT_COLOR[elKey(e.element)] ?? "#d4af37", height: 8, borderRadius: 6 }} />
                </div>
              </div>
            ))}
            <p style={{ fontSize: 12.5, color: "#9a937f", marginTop: 6 }}>
              🎯 {t("personal.strengthen")}: <b style={{ color: ELEMENT_COLOR[elKey(data.strengthen.element)] ?? "#d4af37" }}>{t(`el.${elKey(data.strengthen.element)}` as never)}</b> ({data.strengthen.businessHint}) · 💰 {t("personal.wealth")}: {t(`el.${elKey(data.strengthen.wealth)}` as never)} · ⛔ {t("personal.avoid")}: {data.avoid.map((a) => t(`el.${elKey(a)}` as never)).join("/")}
            </p>
          </div>

          {/* ── วงกลมจัดสรร เงินเร็ว/เงินเย็น ── */}
          <div className="card">
            <h2>🥧 {t("personal.split")}</h2>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  background: `conic-gradient(#3e6fb0 0% ${data.trading.split.cold}%, #c9a227 ${data.trading.split.cold}% ${data.trading.split.cold + data.trading.split.fast}%, #4a9c6d ${data.trading.split.cold + data.trading.split.fast}% 100%)`,
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 38,
                    borderRadius: "50%",
                    background: "#14161d",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#cfcabe",
                  }}
                >
                  {data.trading.allowed === "no" ? "เงินเย็น\n70%" : "จัดสรร\nตามกำลังดวง"}
                </div>
              </div>
              <div style={{ fontSize: 13, flex: 1, minWidth: 220 }}>
                <p>
                  <span style={{ color: "#3e6fb0" }}>■</span> <b>{t("personal.cold")}</b> {data.trading.split.cold}% — {t("personal.coldDesc")}
                </p>
                <p style={{ marginTop: 4 }}>
                  <span style={{ color: "#c9a227" }}>■</span> <b>{t("personal.fast")}</b> {data.trading.split.fast}% — {t("personal.fastDesc")}
                </p>
                <p style={{ marginTop: 4 }}>
                  <span style={{ color: "#4a9c6d" }}>■</span> <b>{t("personal.emergency")}</b> {data.trading.split.emergency}% — {t("personal.emergencyDesc")}
                </p>
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12.5, color: "#9a937f" }}>
              <p>
                <b>🧊 {t("personal.cold")}:</b> {data.instruments.cold.join(" · ")}
              </p>
              <p style={{ marginTop: 3 }}>
                <b>⚡ {t("personal.fast")}:</b> {data.instruments.fast.join(" · ")}
              </p>
              <p style={{ marginTop: 3 }}>
                <b>🛟 {t("personal.emergency")}:</b> {data.instruments.emergency.join(" · ")}
              </p>
            </div>
          </div>

          {/* ── วันมงคล/วันระวัง ── */}
          <div className="card">
            <h2>📅 {t("personal.days")}</h2>
            <p style={{ fontSize: 12.5, color: "#9a937f", marginBottom: 8 }}>
              {t("personal.daysSub")} · {t("personal.legend")}:
              <span style={{ color: "#8fd4a0" }}> {t("personal.good")}</span> · <span style={{ color: "#9a937f" }}>{t("personal.neutral")}</span> · <span style={{ color: "#d48f8f" }}>{t("personal.avoidDay")}</span>
            </p>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
              {data.auspiciousDays.next14.map((x) => (
                <div
                  key={x.date}
                  style={{
                    minWidth: 74,
                    padding: "8px 6px",
                    borderRadius: 8,
                    textAlign: "center",
                    fontSize: 12,
                    background: x.fit === "good" ? "#15231a" : x.fit === "avoid" ? "#241517" : "#191c24",
                    border: `1px solid ${x.fit === "good" ? "#3e7d4e" : x.fit === "avoid" ? "#7d3e3e" : "#2a2e39"}`,
                  }}
                >
                  <div style={{ fontSize: 11, color: "#9a937f" }}>{x.date.slice(5)}</div>
                  <div style={{ fontWeight: 700 }}>{x.weekday}</div>
                  <div style={{ color: ELEMENT_COLOR[elKey(x.dayElement ?? "")] ?? "#d4af37" }}>{x.dayElement ? t(`el.${elKey(x.dayElement)}` as never) : "-"}</div>
                  <div style={{ fontSize: 10.5, color: x.fit === "good" ? "#8fd4a0" : x.fit === "avoid" ? "#d48f8f" : "#9a937f" }}>
                    {x.fit === "good" ? "✅ มงคล" : x.fit === "avoid" ? "⛔ ระวัง" : "—"}
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: "#9a937f", marginTop: 10 }}>
              🗓️ {t("personal.monthFit")}: {t("personal.monthElement")} <b>{data.auspiciousDays.month.monthElement ? t(`el.${elKey(data.auspiciousDays.month.monthElement)}` as never) : "-"}</b> · {t("personal.caishen")} <b>{data.auspiciousDays.month.caishenDir}</b> · ✅ {t("personal.good")} {data.auspiciousDays.month.goodDayCount} {t("personal.daysWord")} ({data.auspiciousDays.month.goodDays.map((g) => g.date.slice(8)).join(", ")}) · ⛔ {t("personal.avoidDay")} {data.auspiciousDays.month.avoidDayCount} {t("personal.daysWord")} ({data.auspiciousDays.month.avoidDays.map((g) => g.date.slice(8)).join(", ")})
            </p>
          </div>

          {/* ── หุ้นเสริมธาตุ + สินทรัพย์เด่น ── */}
          <div className="card">
            <h2>✨ {t("personal.stockPicks")} ({t(`el.${elKey(data.strengthen.element)}` as never)})</h2>
            {data.topStocks.map((s, i) => (
              <div key={s.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #262a34", fontSize: 13 }}>
                <span>
                  <b>{i + 1}. {s.ticker}</b> <span style={{ color: "#9a937f" }}>{s.name}</span>
                </span>
                <span>
                  {s.price != null ? s.price.toLocaleString() : "-"}{" "}
                  <span style={{ color: (s.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(s.changePct)}</span>
                </span>
              </div>
            ))}
            <h2 style={{ marginTop: 14 }}>💰 {t("personal.assetPicks")}</h2>
            {data.topAssets.map((a, i) => (
              <div key={a.ticker} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #262a34", fontSize: 13 }}>
                <span>
                  <b>{i + 1}. {a.name}</b> <span style={{ color: "#9a937f" }}>· {a.ticker}</span>
                </span>
                <span>{a.price != null ? `$${a.price.toLocaleString()}` : "-"}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ fontSize: 12, color: "#9a937f" }}>
            ⚠️ {data.disclaimer}
          </div>
        </>
      )}
    </div>
  );
}
