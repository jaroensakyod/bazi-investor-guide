"use client";

import { useState } from "react";
import { useT } from "../../lib/i18n";

/** สร้างสินค้า PDF — เฉพาะเจ้าของ (ยังไม่ deploy → ไม่มีรหัส) · คนอื่นสร้างไม่ได้ (sub รายเดือนค่อยทำ) */
export default function AdminPdfPage() {
  const t = useT();
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [kind, setKind] = useState("full");
  const [tier, setTier] = useState("490"); // free/99/490/790 — คนนี้จ่ายเท่าไหร่
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const params = new URLSearchParams({ birthDate, birthTime, gender, province, kind, tier });
      const res = await fetch(`/api/product-pdf?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "สร้างไม่สำเร็จ");
        setBusy(false);
        return;
      }
      const blob = await res.blob();
      const name = kind === "card" ? "การ์ดตัวตน" : "รายงานคู่ดวงฉบับเต็ม";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-${birthDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setNote(`✅ สร้างแล้ว: ${name}-${birthDate}.pdf — ส่งให้ลูกค้าได้ (ขาย PDF = เจ้าของสร้างเท่านั้น)`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      {/* ── Tools bar ── */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "8px 12px",
          borderRadius: 10,
          background: "#141823",
          border: "1px solid #262a34",
          marginBottom: 12,
          fontSize: 12.5,
        }}
      >
        <b style={{ color: "#d4af37" }}>🧰 Tools</b>
        <button
          className="btn secondary"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => {
            setBirthDate("1993-11-24");
            setBirthTime("15:12");
            setGender("male");
            setProvince("Bangkok");
          }}
        >
          🎯 ตัวอย่างดวง (ทดสอบ)
        </button>
        <button
          className="btn secondary"
          style={{ padding: "5px 12px", fontSize: 12 }}
          onClick={() => {
            setBirthDate("");
            setBirthTime("");
            setGender("male");
            setProvince("Bangkok");
          }}
        >
          🧹 ล้างฟอร์ม
        </button>
        <a className="btn secondary" href="/demo" target="_blank" rel="noopener" style={{ padding: "5px 12px", fontSize: 12 }}>
          🃏 เปิดหน้า demo (สาธารณะ)
        </a>
        <a
          className="btn secondary"
          href={`/api/card-pdf?birthDate=${birthDate || "1993-11-24"}&birthTime=${birthTime || "15:12"}&gender=${gender}&province=${province}`}
          target="_blank"
          rel="noopener"
          style={{ padding: "5px 12px", fontSize: 12 }}
        >
          👁️ ดูตัวอย่างการ์ด (PDF)
        </a>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9a937f" }}>🔓 โหมดพัฒนา — ยังไม่ deploy ไม่ต้องใช้รหัส</span>
      </div>

      <div className="card" style={{ borderColor: "#d4af37" }}>
        <h2>🛠️ สร้างสินค้า PDF (เฉพาะเจ้าของ)</h2>
        <p style={{ fontSize: 12.5, color: "#9a937f" }}>กรอกวันเกิดลูกค้า → เลือกแบบ + ราคาที่จ่าย → สร้าง PDF (ส่วนที่ยังไม่จ่าย = เบลอ/ล็อก — ลูกค้าเห็นแล้วอยากอัปเกรด)</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
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

        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12.5, marginBottom: 4 }}>แบบสินค้า:</p>
          <div className="chips">
            {[
              { id: "full", label: "📄 รายงานคู่ดวง (gen เต็ม → เบลอตามที่จ่าย)" },
              { id: "card", label: "🃏 การ์ดตัวตนฟรี (lead magnet)" },
            ].map((k) => (
              <button key={k.id} className={`chip ${kind === k.id ? "on" : ""}`} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {kind === "full" && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 12.5, marginBottom: 4 }}>💳 คนนี้จ่ายเท่าไหร่? (gen เต็มก่อน → เบลอส่วนที่ยังไม่จ่าย):</p>
            <div className="chips">
              {[
                { id: "free", label: "🆓 ฟรี (ตัวอย่าง — เบลอทุกส่วน)" },
                { id: "99", label: "💵 ฿99 (เปิด 1-2)" },
                { id: "490", label: "⭐ ฿490 (เปิด 1-4)" },
                { id: "790", label: "👑 ฿790/เดือน (เปิดหมด)" },
              ].map((tk) => (
                <button key={tk.id} className={`chip ${tier === tk.id ? "on" : ""}`} onClick={() => setTier(tk.id)}>
                  {tk.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: "#9a937f", marginTop: 6 }}>
              ฟรี = เบลอทั้งหมด · ฿99 = เปิด มุมมองดวง+จัดสรรเงิน · ฿490 = +พอร์ตเด่น+สินค้า · ฿790 = เต็ม (ไทม์ไลน์+วันมงคล)
            </p>
          </div>
        )}

        <button className="btn" onClick={generate} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "⏳ กำลังสร้าง..." : "📥 สร้าง PDF"}
        </button>
        {note && <p style={{ color: "#8fd4a0", fontSize: 12.5, marginTop: 8 }}>{note}</p>}
        {error && <p style={{ color: "#d48f8f", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}
