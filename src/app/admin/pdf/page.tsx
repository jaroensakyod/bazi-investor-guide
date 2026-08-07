"use client";

import { useState } from "react";
import { useT } from "../../lib/i18n";

/** สร้างสินค้า PDF — เฉพาะเจ้าของ (passcode) · คนอื่นสร้างไม่ได้ (sub รายเดือนค่อยทำ) */
export default function AdminPdfPage() {
  const t = useT();
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(() => (typeof window !== "undefined" ? sessionStorage.getItem("owner_pdf") === "1" : false));
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [kind, setKind] = useState("full");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  function unlock() {
    if (pass.trim()) {
      sessionStorage.setItem("owner_pdf", "1");
      setAuthed(true);
    }
  }

  async function generate() {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const params = new URLSearchParams({ pass, birthDate, birthTime, gender, province, kind });
      const res = await fetch(`/api/product-pdf?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "สร้างไม่สำเร็จ (รหัสผิด?)");
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

  if (!authed) {
    return (
      <div style={{ maxWidth: 420, margin: "0 auto" }}>
        <div className="card">
          <h2>🔐 สร้างสินค้า PDF (เฉพาะเจ้าของ)</h2>
          <p style={{ fontSize: 12.5, color: "#9a937f" }}>กรอกรหัสเจ้าของ — คนอื่นสร้าง PDF ไม่ได้</p>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="รหัสเจ้าของ (OWNER_PASS)" style={{ width: "100%" }} />
          <button className="btn" onClick={unlock} style={{ marginTop: 10 }}>
            ปลดล็อก
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="card" style={{ borderColor: "#d4af37" }}>
        <h2>🛠️ สร้างสินค้า PDF (เฉพาะเจ้าของ)</h2>
        <p style={{ fontSize: 12.5, color: "#9a937f" }}>กรอกวันเกิดลูกค้า → เลือกแบบ → สร้าง + ส่งไฟล์ (การขาย PDF = เจ้าของสร้างเท่านั้น)</p>

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
              { id: "full", label: "📄 รายงานคู่ดวง 5 หน้า (฿99)" },
              { id: "card", label: "🃏 การ์ดตัวตนฟรี (lead magnet)" },
            ].map((k) => (
              <button key={k.id} className={`chip ${kind === k.id ? "on" : ""}`} onClick={() => setKind(k.id)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        <button className="btn" onClick={generate} disabled={busy} style={{ marginTop: 14 }}>
          {busy ? "⏳ กำลังสร้าง..." : "📥 สร้าง PDF"}
        </button>
        {note && <p style={{ color: "#8fd4a0", fontSize: 12.5, marginTop: 8 }}>{note}</p>}
        {error && <p style={{ color: "#d48f8f", fontSize: 12.5, marginTop: 8 }}>{error}</p>}
      </div>
    </div>
  );
}
