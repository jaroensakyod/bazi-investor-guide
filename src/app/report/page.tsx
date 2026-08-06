"use client";

import { useState } from "react";
import { get, myUserId } from "../lib/api";
import { useT, useLocale } from "../lib/i18n";

type ReportData = {
  stock: { ticker: string; name: string; element: string; tier: string };
  verdict: {
    invest: string[];
    avoid: string[];
    score: { score: number; verdict: string; reasons: string[] };
    persona: { emoji: string; name: string };
    timeline: Array<{ ageRange: string; verdict: string; advice: string }>;
  } | null;
  buffett: { score: number; checks: Array<{ label: string; status: "pass" | "warn" | "fail" }> } | null;
};

export default function ReportPage() {
  const t = useT();
  const { locale } = useLocale();
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

  async function downloadPdf() {
    setBusy(true);
    try {
      const res = await fetch(`/api/report/pdf?ticker=${encodeURIComponent(ticker)}&userId=${myUserId()}`);
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "PDF error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ticker}-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`PDF error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const elMap: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
  const elKey = (e: string) => elMap[e] ?? e;
  const el = (e: string) => t(`el.${elKey(e)}` as never);
  const vd = (v: string) => (["very-good", "good", "neutral", "avoid"].includes(v) ? t(`vd.${v}` as never) : v);

  return (
    <div>
      <div className="card">
        <h2>{t("report.title")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder={t("report.ticker")} style={{ margin: 0, flex: 1 }} />
          <button className="btn" onClick={load} disabled={busy}>
            {busy ? "..." : t("report.analyze")}
          </button>
        </div>
        {error && <p style={{ color: "#d48f8f", marginTop: 10 }}>{error}</p>}
      </div>

      {data && (
        <>
          <div className="card">
            <h2>
              {data.stock.name} ({data.stock.ticker}) <span className="tag">{el(data.stock.element)}</span>
              <span className="tag">{data.stock.tier}</span>
            </h2>
            {data.verdict && (
              <>
                <p>
                  {t("report.verdict")}: <b>{vd(data.verdict.score.verdict)}</b> ({data.verdict.score.score}) — {data.verdict.persona.emoji} {data.verdict.persona.name}
                </p>
                <p style={{ fontSize: 13.5 }}>
                  {t("report.invest")}: {data.verdict.invest.map(el).join("/")} · {t("report.avoid")}: {data.verdict.avoid.map(el).join("/")}
                </p>
                {data.verdict.score.reasons.slice(0, 2).map((r, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#9a937f" }}>
                    • {r}
                  </p>
                ))}
                {data.verdict.timeline.map((ph, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#9a937f" }}>
                    📅 {ph.ageRange} ({ph.verdict}): {ph.advice}
                  </p>
                ))}
              </>
            )}
          </div>
          {data.buffett && (
            <div className="card">
              <h2>
                {t("report.buffett")}: {data.buffett.score}/10
              </h2>
              {data.buffett.checks.map((c, i) => (
                <p key={i} style={{ fontSize: 13.5, marginBottom: 2 }}>
                  {c.status === "pass" ? "✅" : c.status === "warn" ? "🟡" : "❌"} {c.label}
                </p>
              ))}
            </div>
          )}
          <div className="card" style={{ fontSize: 12.5, color: "#9a937f" }}>
            <button className="btn" onClick={downloadPdf} disabled={busy} style={{ marginBottom: 8 }}>
              📄 {t("report.pdf")}
            </button>
            <br />
            {t("report.pdfnote")} · {t("disclaimer")}
          </div>
        </>
      )}
    </div>
  );
}
