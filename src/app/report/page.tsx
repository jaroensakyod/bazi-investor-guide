"use client";

import { useState } from "react";
import { get, myUserId } from "../lib/api";

type ReportData = {
  stock: { ticker: string; name: string; element: string; tier: string };
  verdict: {
    invest: string[];
    avoid: string[];
    score: { score: number; verdict: string; reasons: string[] };
    persona: { emoji: string; name: string };
    timeline: Array<{ ageRange: string; verdict: string; advice: string }>;
  } | null;
  buffett: { score: number; checks: Array<{ label: string; pass: boolean }> } | null;
};

export default function ReportPage() {
  const [ticker, setTicker] = useState("KBANK");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    const r = await get<ReportData>(`/api/report?ticker=${encodeURIComponent(ticker)}&userId=${myUserId()}`);
    setBusy(false);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }

  return (
    <div>
      <div className="card">
        <h2>📑 รายงานหุ้น: ดวง + พื้นฐาน + Buffett</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="KBANK" style={{ margin: 0, flex: 1 }} />
          <button className="btn" onClick={load} disabled={busy}>
            {busy ? "..." : "วิเคราะห์"}
          </button>
        </div>
        {error && <p style={{ color: "#d48f8f", marginTop: 10 }}>{error}</p>}
      </div>

      {data && (
        <>
          <div className="card">
            <h2>
              {data.stock.name} ({data.stock.ticker}) <span className="tag">ธาตุ{data.stock.element}</span>
              <span className="tag">{data.stock.tier}</span>
            </h2>
            {data.verdict && (
              <>
                <p>
                  🎯 ดวง: <b>{data.verdict.score.verdict}</b> (คะแนน {data.verdict.score.score}) — {data.verdict.persona.emoji} {data.verdict.persona.name}
                </p>
                <p style={{ fontSize: 13.5 }}>
                  ควร (invest): {data.verdict.invest.join("/")} · เลี่ยง (avoid): {data.verdict.avoid.join("/")}
                </p>
                {data.verdict.score.reasons.slice(0, 2).map((r, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#9a937f" }}>
                    • {r}
                  </p>
                ))}
                {data.verdict.timeline.map((t, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#9a937f" }}>
                    📅 {t.ageRange} ({t.verdict}): {t.advice}
                  </p>
                ))}
              </>
            )}
          </div>
          {data.buffett && (
            <div className="card">
              <h2>🧠 Buffett score: {data.buffett.score}/10</h2>
              {data.buffett.checks.map((c, i) => (
                <p key={i} style={{ fontSize: 13.5, marginBottom: 2 }}>
                  {c.pass ? "✅" : "❌"} {c.label}
                </p>
              ))}
            </div>
          )}
          <div className="card" style={{ fontSize: 12.5, color: "#9a937f" }}>
            💾 PDF รายงานฉบับเต็ม — กำลังพัฒนา (Phase 3) · ⚠️ บทวิเคราะห์อ้างอิง ไม่ใช่คำแนะนำการลงทุน
          </div>
        </>
      )}
    </div>
  );
}
