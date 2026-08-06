"use client";

import { useState, useEffect } from "react";
import { get, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type SearchItem = { kind: "stock" | "asset"; ticker: string; name: string; market: string; element: string };

type ReportData =
  | {
      kind?: "stock";
      stock: { ticker: string; name: string; element: string; tier: string };
      verdict: {
        invest: string[];
        avoid: string[];
        score: { verdict: string; score: number; reasons: string[] };
        persona: { emoji: string; name: string };
        timeline: Array<{ ageRange: string; verdict: string; advice: string }>;
      } | null;
      buffett: { score: number; checks: Array<{ label: string; status: "pass" | "warn" | "fail" }> } | null;
    }
  | {
      kind: "asset";
      asset: { ticker: string; name: string; type: string; sector: string | null; element: string; riskTier: string; elementReason: string };
      price: number | null;
      changePct: number | null;
      verdict: { verdict: string; score: number; reasons: string[]; capped: boolean } | null;
    };

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };
const VD_EMOJI: Record<string, string> = { "very-good": "✅✅", good: "✅", neutral: "🟡", avoid: "⛔" };

export default function ReportPage() {
  const t = useT();
  const [ticker, setTicker] = useState("KBANK");
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ค้นอัตโนมัติ (debounce 250ms) — หุ้น + สินทรัพย์
  useEffect(() => {
    const q = ticker.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const h = setTimeout(async () => {
      const r = await get<{ stocks: SearchItem[]; assets: SearchItem[] }>(`/api/search?q=${encodeURIComponent(q)}`);
      if (r.ok) setSuggestions([...(r.data.stocks ?? []), ...(r.data.assets ?? [])].slice(0, 12));
    }, 250);
    return () => clearTimeout(h);
  }, [ticker]);

  async function load(manual?: string) {
    const tk = (manual ?? ticker).trim().toUpperCase();
    if (!tk) return;
    setBusy(true);
    setError("");
    const r = await get<ReportData>(`/api/report?ticker=${encodeURIComponent(tk)}&userId=${myUserId()}`);
    setBusy(false);
    if (r.ok) setData(r.data);
    else setError(r.error);
    setSuggestions([]);
  }

  async function downloadPdf() {
    if (data?.kind === "asset") return;
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

  const elKey = (e: string) => ELMAP[e] ?? e;
  const el = (e: string) => t(`el.${elKey(e)}` as never);
  const vd = (v: string) => (["very-good", "good", "neutral", "avoid"].includes(v) ? t(`vd.${v}` as never) : v);
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>{t("report.title")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder={t("report.ticker")}
              list="report-suggest"
              style={{ margin: 0, width: "100%" }}
            />
            <datalist id="report-suggest">
              {suggestions.map((s) => (
                <option key={s.kind + s.ticker} value={s.ticker}>
                  {s.name} · {s.market} · {s.element}
                </option>
              ))}
            </datalist>
            {suggestions.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {suggestions.map((s) => (
                  <button
                    key={s.kind + s.ticker}
                    className="chip"
                    onClick={() => {
                      setTicker(s.ticker);
                      load(s.ticker);
                    }}
                    style={{ marginRight: 6, marginBottom: 4 }}
                  >
                    {s.kind === "asset" ? "💰" : "📈"} {s.ticker} — {s.name.slice(0, 22)} · {s.market}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn" onClick={() => load()} disabled={busy}>
            {busy ? "..." : t("report.analyze")}
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#9a937f", marginTop: 6 }}>
          {t("report.hint")}
        </p>
        {error && <p style={{ color: "#d48f8f", marginTop: 10 }}>{error}</p>}
      </div>

      {data && data.kind === "asset" && (
        <>
          <div className="card" style={{ borderColor: "#d4af37" }}>
            <h2>
              💰 {data.asset.name} ({data.asset.ticker}){" "}
              <span style={{ color: ELEMENT_COLOR[elKey(data.asset.element)] ?? "#d4af37" }}>{el(data.asset.element)}</span>{" "}
              <span className="tag">{t(`at.${data.asset.type}` as never)}</span>{" "}
              <span className="tag">{t(`tier.${data.asset.riskTier}` as never)}</span>
            </h2>
            {data.verdict ? (
              <>
                <p>
                  {t("report.verdict")}: <b>{VD_EMOJI[data.verdict.verdict] ?? ""} {vd(data.verdict.verdict)}</b> ({data.verdict.score}){" "}
                  {data.verdict.capped ? <span className="tag avoid">⚠️ เกินกำลังดวง</span> : ""}
                </p>
                {data.verdict.reasons.map((r, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#9a937f" }}>
                    • {r}
                  </p>
                ))}
              </>
            ) : (
              <p style={{ color: "#9a937f", fontSize: 13 }}>{t("assets.needprofile")}</p>
            )}
            <p style={{ fontSize: 13, color: "#9a937f" }}>🔮 {data.asset.elementReason}</p>
            <p style={{ marginTop: 8 }}>
              💰 ราคา: <b>{data.price != null ? `$${data.price.toLocaleString()}` : "-"}</b>{" "}
              <span style={{ color: (data.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(data.changePct)}</span>
            </p>
          </div>
          <div className="card" style={{ fontSize: 12.5, color: "#9a937f" }}>
            {t("report.pdfnote")} · {t("disclaimer")}
          </div>
        </>
      )}

      {data && data.kind !== "asset" && (
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
