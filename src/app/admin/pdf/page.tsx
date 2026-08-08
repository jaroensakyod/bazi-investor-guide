"use client";

import { useState, useEffect } from "react";
import { FINANCIAL_PRESETS } from "../../../lib/report/financial-system";
import {
  getReportManifest,
  REPORT_TIER_CONFIGS,
  REPORT_TIERS,
  type ReportTier,
} from "../../../lib/report/product-system";
import { requiredFinancialFieldsForTier } from "../../../lib/report/report-input";

type Preview = {
  persona?: { name: string; emoji: string; bandLabel: string; style: string };
  trading?: { label: string; allowed: string; split: { cold: number; fast: number; emergency: number } };
  strengthen?: { element: string; wealth: string };
  avoid?: string[];
  goodStocks?: Array<{ ticker: string; name: string; element: string }>;
  goodAssets?: Array<{ ticker: string; name: string; element: string }>;
};

const EL_COLOR: Record<string, string> = { ไม้: "#4caf50", ไฟ: "#ef5350", ดิน: "#a1887f", ทอง: "#d4af37", น้ำ: "#42a5f5" };

type FinancialPresetName = keyof typeof FINANCIAL_PRESETS;
type FinancialForm = Record<string, string>;

const TIER_ICON: Record<ReportTier, string> = { free: "🆓", "99": "💵", "490": "⭐", "790": "👑" };
const TIER_HIGHLIGHTS: Record<ReportTier, string[]> = {
  free: ["บุคลิกการเงินและสมดุลธาตุ", "วงจรตัดสินใจ", "แผนเดือนนี้ + 30/90/365 วัน"],
  "99": ["ทุกอย่างใน FREE", "ระบบแบ่งเงินและความเสี่ยง", "Life Map + แบบคัดก่อนลงทุน"],
  "490": ["ทุกอย่างใน ฿99", "ฐานะ เป้าหมาย Allocation และ IPS", "คิววิจัย พอร์ต และสถานการณ์จำลอง"],
  "790": ["ทุกอย่างใน ฿490", "Deep research เปรียบเทียบ 3 บริษัท", "Journal + Baseline + แผนทบทวน 12 เดือน"],
};
const TIERS = REPORT_TIERS.map((id) => ({
  id,
  label: `${TIER_ICON[id]} ${REPORT_TIER_CONFIGS[id].priceLabel}`,
  price: REPORT_TIER_CONFIGS[id].priceLabel,
  pages: getReportManifest(id).pageCount,
  promise: REPORT_TIER_CONFIGS[id].promise,
  open: TIER_HIGHLIGHTS[id],
}));

const FINANCIAL_FIELDS = [
  { key: "monthlyIncome", label: "รายรับสุทธิ/เดือน", group: "basic" },
  { key: "monthlyExpense", label: "รายจ่ายจำเป็น/เดือน", group: "basic" },
  { key: "emergencySavings", label: "เงินสำรองฉุกเฉินปัจจุบัน", group: "basic" },
  { key: "debtBalance", label: "ยอดหนี้คงเหลือ", group: "basic" },
  { key: "debtApr", label: "ดอกเบี้ยหนี้ต่อปี (%)", group: "basic" },
  { key: "horizonYears", label: "ระยะเวลาลงทุน (ปี)", group: "basic" },
  { key: "maxDrawdown", label: "ขาดทุนสูงสุดที่รับได้ (%)", group: "basic" },
  { key: "capital", label: "สินทรัพย์ลงทุนปัจจุบัน", group: "full" },
  { key: "monthly", label: "เงินลงทุนเพิ่ม/เดือน", group: "full" },
  { key: "emergencyMonths", label: "เป้าหมายเงินสำรอง (เดือน)", group: "full" },
  { key: "goalAmount", label: "เป้าหมายเงินก้อน", group: "full" },
  { key: "currentGoalSavings", label: "เงินสะสมเพื่อเป้าหมายแล้ว", group: "full" },
  { key: "goalYears", label: "เวลาถึงเป้าหมาย (ปี)", group: "full" },
  { key: "currentEquityPct", label: "หุ้นปัจจุบัน (%)", group: "full" },
  { key: "currentBondPct", label: "ตราสารหนี้ปัจจุบัน (%)", group: "full" },
  { key: "currentCashPct", label: "เงินสดปัจจุบัน (%)", group: "full" },
] as const;

function presetForm(name: FinancialPresetName): FinancialForm {
  const preset = FINANCIAL_PRESETS[name];
  return Object.fromEntries([
    ...FINANCIAL_FIELDS.map((field) => [field.key, String(preset[field.key])]),
    ["goal", preset.goal],
  ]);
}

/** สร้างสินค้า PDF — เฉพาะเจ้าของ (ยังไม่ deploy → ไม่มีรหัส) · live preview การ์ดลูกค้า */
export default function AdminPdfPage() {
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [kind, setKind] = useState("full");
  const [tier, setTier] = useState<ReportTier>("490");
  const [financeMode, setFinanceMode] = useState<"demo" | "real">("demo");
  const [financePreset, setFinancePreset] = useState<FinancialPresetName>("builder");
  const [financial, setFinancial] = useState<FinancialForm>(() => presetForm("builder"));
  const [entitlement, setEntitlement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pv, setPv] = useState<Preview | null>(null);
  const [pvLoading, setPvLoading] = useState(false);

  // live preview (debounce 400ms)
  useEffect(() => {
    if (!birthDate) return;
    const id = setTimeout(async () => {
      setPvLoading(true);
      try {
        const params = new URLSearchParams({ birthDate, birthTime: birthTime || "12:00", gender, province });
        const res = await fetch(`/api/card-data?${params}`);
        if (res.ok) {
          const j = await res.json();
          setPv(j.data);
        } else setPv(null);
      } catch {
        setPv(null);
      } finally {
        setPvLoading(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [birthDate, birthTime, gender, province]);

  function choosePreset(name: FinancialPresetName) {
    setFinancePreset(name);
    setFinancial(presetForm(name));
    setFinanceMode("demo");
  }

  function reportParams() {
    const params = new URLSearchParams({
      birthDate,
      birthTime: birthTime || "12:00",
      gender,
      province,
      kind,
      tier,
      financePreset,
      profileMode: financeMode,
    });
    for (const [key, value] of Object.entries(financial)) {
      if (value.trim()) params.set(key, value.trim());
    }
    if (entitlement.trim()) params.set("entitlement", entitlement.trim());
    return params;
  }

  function validatePaidInputs(): string | null {
    if (kind !== "full" || tier === "free" || financeMode === "demo") return null;
    const missing = requiredFinancialFieldsForTier(tier).filter((key) => !financial[key]?.trim());
    if (missing.length) return `ข้อมูลการเงินจริงยังไม่ครบ ${missing.length} ช่อง`;
    return null;
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const validationError = validatePaidInputs();
      if (validationError) {
        setError(validationError);
        return;
      }
      const params = reportParams();
      const res = await fetch("/api/product-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(params)),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "สร้างไม่สำเร็จ");
        setBusy(false);
        return;
      }
      const blob = await res.blob();
      const name = kind === "card" ? "การ์ดตัวตน" : "รายงานคู่ดวง";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${birthDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setNote(`✅ สร้างแล้ว: ${name}-${birthDate}.pdf (${TIERS.find((x) => x.id === tier)?.label ?? tier}) — ส่งไฟล์ให้ลูกค้าได้เลย`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openPrintPreview() {
    const validationError = validatePaidInputs();
    if (validationError) {
      setError(validationError);
      return;
    }
    const draftId = crypto.randomUUID();
    localStorage.setItem(`bazi-report-draft:${draftId}`, JSON.stringify(Object.fromEntries(reportParams())));
    window.open(`/report/print?localDraft=${encodeURIComponent(draftId)}`, "_blank", "noopener,noreferrer");
  }

  const tierInfo = TIERS.find((x) => x.id === tier) ?? TIERS[2];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div
        style={{
          background: "linear-gradient(135deg,#0f2e1c 0%,#14532d 55%,#1d2130 100%)",
          borderRadius: 14,
          border: "1px solid #d4af37",
          padding: "18px 22px",
          color: "#fff",
          marginBottom: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2 style={{ margin: 0, color: "#d4af37", fontSize: 20 }}>🛠️ โรงงานสินค้า PDF</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#cfe3d4" }}>
            เฉพาะเจ้าของ · แต่ละราคาคือหนังสือสมบูรณ์ของตัวเอง ไม่มีหน้าเบลอหรือหน้าล็อก
          </p>
        </div>
        <span style={{ fontSize: 11.5, color: "#9a937f", border: "1px solid #3a3f4d", borderRadius: 20, padding: "4px 12px" }}>
          🔓 โหมดพัฒนา — ยังไม่ deploy
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(340px, 1fr)", gap: 14, alignItems: "start" }}>
        {/* ── ซ้าย: ฟอร์ม ── */}
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 10px" }}>📋 ข้อมูลลูกค้า</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ fontSize: 12.5 }}>
              วันเกิด
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 12.5 }}>
              เวลาเกิด
              <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 12.5 }}>
              เพศ
              <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: "100%" }}>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
              </select>
            </label>
            <label style={{ fontSize: 12.5 }}>
              จังหวัด
              <input value={province} onChange={(e) => setProvince(e.target.value)} style={{ width: "100%" }} />
            </label>
          </div>

          <p style={{ fontWeight: 700, fontSize: 13.5, margin: "14px 0 8px" }}>📦 แบบสินค้า</p>
          <div className="chips">
            <button className={`chip ${kind === "full" ? "on" : ""}`} onClick={() => setKind("full")}>
              📄 หนังสือเฉพาะบุคคล (สมบูรณ์ตาม tier)
            </button>
            <button className={`chip ${kind === "card" ? "on" : ""}`} onClick={() => setKind("card")}>
              🃏 การ์ดตัวตนฟรี (lead magnet)
            </button>
          </div>

          {kind === "full" && (
            <>
              <p style={{ fontWeight: 700, fontSize: 13.5, margin: "14px 0 8px" }}>💳 คนนี้จ่ายเท่าไหร่?</p>
              <div className="chips">
                {TIERS.map((tk) => (
                  <button key={tk.id} className={`chip ${tier === tk.id ? "on" : ""}`} onClick={() => setTier(tk.id)}>
                    {tk.label} · {tk.pages} หน้า
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #323845" }}>
                <p style={{ fontWeight: 700, fontSize: 13.5, margin: "0 0 8px" }}>💰 ข้อมูลการเงินที่ใช้คำนวณ</p>
                <div className="chips" style={{ marginBottom: 8 }}>
                  <button className={`chip ${financeMode === "real" ? "on" : ""}`} onClick={() => setFinanceMode("real")}>ข้อมูลลูกค้าจริง</button>
                  <button className={`chip ${financeMode === "demo" ? "on" : ""}`} onClick={() => setFinanceMode("demo")}>ตัวอย่าง QA</button>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 11.5, color: financeMode === "real" ? "#8fd4a0" : "#d4af37" }}>
                  {financeMode === "real"
                    ? "ตัวเลขจะถูกระบุว่าเป็นข้อมูลที่ลูกค้าให้ และใช้สร้างรายงานส่งมอบได้"
                    : "เล่มจะติดป้าย DEMO DATA ชัดเจน และ production จะไม่ยอมส่งมอบ tier แบบชำระเงิน"}
                </p>
                <div className="chips" style={{ marginBottom: 10 }}>
                  {(["starter", "builder", "established"] as FinancialPresetName[]).map((name) => (
                    <button key={name} className={`chip ${financePreset === name ? "on" : ""}`} onClick={() => choosePreset(name)}>
                      QA: {name}
                    </button>
                  ))}
                </div>
                {tier !== "free" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                    {FINANCIAL_FIELDS.filter((field) => field.group === "basic" || tier === "490" || tier === "790").map((field) => (
                      <label key={field.key} style={{ fontSize: 11.5 }}>
                        {field.label}
                        <input
                          inputMode="decimal"
                          value={financial[field.key] ?? ""}
                          onChange={(event) => setFinancial((current) => ({ ...current, [field.key]: event.target.value }))}
                          style={{ width: "100%" }}
                        />
                      </label>
                    ))}
                    {(tier === "490" || tier === "790") && (
                      <label style={{ fontSize: 11.5, gridColumn: "1 / -1" }}>
                        เป้าหมายการเงิน
                        <input value={financial.goal ?? ""} onChange={(event) => setFinancial((current) => ({ ...current, goal: event.target.value }))} style={{ width: "100%" }} />
                      </label>
                    )}
                  </div>
                )}
                <details style={{ marginTop: 10, fontSize: 11.5, color: "#9a937f" }}>
                  <summary>Production entitlement</summary>
                  <label>
                    Token สิทธิ์จากระบบชำระเงิน
                    <input value={entitlement} onChange={(event) => setEntitlement(event.target.value)} placeholder="เว้นว่างได้ในโหมดพัฒนา" style={{ width: "100%" }} />
                  </label>
                </details>
              </div>
            </>
          )}

          <button className="btn" onClick={generate} disabled={busy || !birthDate} style={{ marginTop: 16, width: "100%", fontSize: 15, padding: "12px" }}>
            {busy ? "⏳ กำลังสร้าง..." : "📥 สร้าง PDF (ด่วน)"}
          </button>
          <button
            className="btn secondary"
            onClick={openPrintPreview}
            style={{ marginTop: 8, width: "100%", fontSize: 14, padding: "11px", display: "block", textAlign: "center" }}
          >
            🖨️ เปิดรายงานคุณภาพ (HTML → พิมพ์ PDF)
          </button>
          {note && <p style={{ color: "#8fd4a0", fontSize: 12.5, marginTop: 10 }}>{note}</p>}
          {error && <p style={{ color: "#d48f8f", fontSize: 12.5, marginTop: 10 }}>{error}</p>}
        </div>

        {/* ── ขวา: preview + tier ── */}
        <div>
          {/* mini card preview */}
          <div
            style={{
              borderRadius: 12,
              border: "1.5px solid #d4af37",
              overflow: "hidden",
              background: "linear-gradient(160deg,#0f2e1c 0%,#14532d 45%,#1d2130 100%)",
              color: "#fff",
              minHeight: 150,
            }}
          >
            <div style={{ padding: "10px 14px", background: "rgba(212,175,55,.14)", borderBottom: "1px solid rgba(212,175,55,.35)", display: "flex", justifyContent: "space-between" }}>
              <b style={{ fontSize: 12.5 }}>☯ ดวงนักลงทุน</b>
              <span style={{ fontSize: 10, color: "#d4af37", border: "1px solid #d4af37", borderRadius: 20, padding: "1px 8px" }}>PREVIEW</span>
            </div>
            <div style={{ padding: "14px" }}>
              {pvLoading ? (
                <p style={{ fontSize: 12, color: "#cfe3d4" }}>⏳ คำนวณดวง...</p>
              ) : pv?.persona ? (
                <>
                  <p style={{ margin: 0, fontSize: 15, color: "#d4af37", fontWeight: 700 }}>
                    {pv.persona.emoji} {pv.persona.name} <span style={{ color: "#9a937f", fontWeight: 400 }}>({pv.persona.bandLabel})</span>
                  </p>
                  <p style={{ margin: "4px 0 8px", fontSize: 11.5, color: "#cfe3d4" }}>การเทรด: {pv.trading?.label}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <span style={{ fontSize: 10.5, background: "rgba(212,175,55,.16)", border: "1px solid rgba(212,175,55,.5)", borderRadius: 20, padding: "2px 8px" }}>
                      🔥 เสริม: {pv.strengthen?.element}
                    </span>
                    <span style={{ fontSize: 10.5, background: "rgba(155,44,44,.14)", border: "1px solid rgba(155,44,44,.5)", borderRadius: 20, padding: "2px 8px" }}>
                      ⛔ เลี่ยง: {pv.avoid?.join("/")}
                    </span>
                  </div>
                  {(pv.goodStocks?.length ?? 0) > 0 && (
                    <p style={{ margin: "2px 0", fontSize: 11 }}>
                      🟢 หุ้น: {pv.goodStocks?.map((s) => <b key={s.ticker} style={{ color: EL_COLOR[s.element] ?? "#fff" }}>{s.ticker}</b>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])}
                    </p>
                  )}
                  {(pv.goodAssets?.length ?? 0) > 0 && (
                    <p style={{ margin: "2px 0", fontSize: 11 }}>
                      🟢 สินทรัพย์: {pv.goodAssets?.map((s) => <b key={s.ticker} style={{ color: EL_COLOR[s.element] ?? "#fff" }}>{s.ticker}</b>).reduce<React.ReactNode[]>((a, x, i) => (i ? [...a, ", ", x] : [x]), [])}
                    </p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 12, color: "#9a937f" }}>กรอกวันเกิด → เห็นตัวอย่างการ์ดลูกค้าตรงนี้</p>
              )}
            </div>
          </div>

          {/* tier checklist */}
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 700, fontSize: 13, margin: "0 0 8px" }}>
              {tierInfo.label} <span style={{ color: "#d4af37" }}>· {tierInfo.pages} หน้า</span> — ลูกค้าได้อะไร:
            </p>
            <p style={{ fontSize: 11.5, color: "#cfe3d4", margin: "0 0 7px" }}>{tierInfo.promise}</p>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {tierInfo.open.map((o) => (
                <p key={o} style={{ margin: 0, color: "#8fd4a0" }}>
                  ✅ {o}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
