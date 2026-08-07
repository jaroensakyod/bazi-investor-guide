"use client";

import { useState } from "react";
import { useT } from "../lib/i18n";

/** เดโมสด: กรอกวันเกิด → การ์ดตัวตนฟรี (PDF 1 หน้า) — lead magnet */
export default function DemoPage() {
  const t = useT();
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function downloadCard() {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams({ birthDate, birthTime, gender, province });
      const res = await fetch(`/api/card-pdf?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "สร้างการ์ดไม่สำเร็จ");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `การ์ดตัวตน-${birthDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div className="card" style={{ borderColor: "#d4af37", background: "linear-gradient(135deg,#161a24 0%,#1d2130 100%)", textAlign: "center" }}>
        <h2>🃏 คุณเป็นนักลงทุนธาตุไหน?</h2>
        <p style={{ fontSize: 13, color: "#9a937f" }}>
          กรอกวันเกิด → รับ <b style={{ color: "#d4af37" }}>การ์ดตัวตนการเงินฟรี</b> ทันที (PDF 1 หน้า) — คำนวณจากดวง 60 กะจื่อ ไม่ใช่ดวงเดา
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14, textAlign: "left" }}>
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

        <button className="btn" onClick={downloadCard} disabled={busy} style={{ marginTop: 14, fontSize: 15, padding: "10px 28px" }}>
          {busy ? "⏳ กำลังสร้าง..." : "🎁 รับการ์ดฟรีทันที"}
        </button>
        {error && <p style={{ color: "#d48f8f", fontSize: 12.5 }}>{error}</p>}

        <div style={{ marginTop: 16, fontSize: 11.5, color: "#9a937f", borderTop: "1px solid #262a34", paddingTop: 10 }}>
          การ์ดนี้เป็นเพียงตัวอย่าง 1 หน้า — ฉบับเต็มมี verdict 60 ข้อ · พอร์ตจัดสรร · แผนที่ชีวิต 0-80 ปี · วันมงคลรายเดือน
          <br />
          <span style={{ color: "#8d6e63" }}>📢 ยังไม่ใช่คำแนะนำการลงทุน — จัดทำตามหลักโหราศาสตร์เพื่อการศึกษา/บันเทิง</span>
        </div>
      </div>
    </div>
  );
}
