"use client";

import { useState, useEffect } from "react";

type Preview = {
  persona?: { name: string; emoji: string; bandLabel: string; style: string };
  trading?: { label: string; allowed: string; split: { cold: number; fast: number; emergency: number } };
  strengthen?: { element: string; wealth: string };
  avoid?: string[];
  goodStocks?: Array<{ ticker: string; name: string; element: string }>;
  goodAssets?: Array<{ ticker: string; name: string; element: string }>;
};

const EL_COLOR: Record<string, string> = { ไม้: "#4caf50", ไฟ: "#ef5350", ดิน: "#a1887f", ทอง: "#d4af37", น้ำ: "#42a5f5" };
const TIERS = [
  { id: "free", label: "🆓 ฟรี", price: "฿0", open: ["การ์ดตัวตน 1 หน้า"], locked: ["มุมมองดวง", "จัดสรรเงิน", "พอร์ตเด่น", "Life Map", "วันมงคล"] },
  { id: "99", label: "💵 ฿99", price: "฿99", open: ["การ์ด", "มุมมองดวง", "จัดสรรเงิน"], locked: ["พอร์ตเด่น", "สินค้าแนะนำ", "Life Map", "วันมงคล"] },
  { id: "490", label: "⭐ ฿490", price: "฿490", open: ["การ์ด", "มุมมองดวง", "จัดสรรเงิน", "พอร์ตเด่น", "สินค้าแนะนำ"], locked: ["Life Map", "วันมงคล"] },
  { id: "790", label: "👑 ฿790/เดือน", price: "฿790/เดือน", open: ["ทุกส่วน — ฉบับเต็ม 6 ส่วน"], locked: [] },
];

/** สร้างสินค้า PDF — เฉพาะเจ้าของ (ยังไม่ deploy → ไม่มีรหัส) · live preview การ์ดลูกค้า */
export default function AdminPdfPage() {
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [kind, setKind] = useState("full");
  const [tier, setTier] = useState("490");
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

  async function generate() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const params = new URLSearchParams({ birthDate, birthTime: birthTime || "12:00", gender, province, kind, tier });
      const res = await fetch(`/api/product-pdf?${params}`);
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
            เฉพาะเจ้าของ · กรอกวันเกิดลูกค้า → เลือกแบบ+ราคา → สร้าง PDF (ส่วนที่ยังไม่จ่าย = เบลอ/ล็อก)
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
              📄 รายงานคู่ดวง (เบลอตามที่จ่าย)
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
                    {tk.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <button className="btn" onClick={generate} disabled={busy || !birthDate} style={{ marginTop: 16, width: "100%", fontSize: 15, padding: "12px" }}>
            {busy ? "⏳ กำลังสร้าง..." : "📥 สร้าง PDF (ด่วน)"}
          </button>
          <a
            className="btn secondary"
            href={`/report/print?birthDate=${birthDate || "1993-11-24"}&birthTime=${birthTime || "15:12"}&gender=${gender}&province=${province}&tier=${tier}`}
            target="_blank"
            rel="noopener"
            style={{ marginTop: 8, width: "100%", fontSize: 14, padding: "11px", display: "block", textAlign: "center" }}
          >
            🖨️ เปิดรายงานคุณภาพ (HTML → พิมพ์ PDF)
          </a>
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
              {tierInfo.label} <span style={{ color: "#d4af37" }}>({tierInfo.price})</span> — ลูกค้าได้อะไร:
            </p>
            <div style={{ fontSize: 12, lineHeight: 1.8 }}>
              {tierInfo.open.map((o) => (
                <p key={o} style={{ margin: 0, color: "#8fd4a0" }}>
                  ✅ {o}
                </p>
              ))}
              {tierInfo.locked.map((l) => (
                <p key={l} style={{ margin: 0, color: "#9a937f" }}>
                  🔒 {l} — <span style={{ color: "#d4af37" }}>ปลดล็อกด้วย tier ถัดไป</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
