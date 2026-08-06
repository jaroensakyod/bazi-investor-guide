"use client";

import { useState } from "react";
import { post, myUserId } from "../lib/api";

export default function ProfilePage() {
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ chartHash: string; userId: string } | null>(null);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const r = await post<{ chartHash: string; userId: string }>("/api/profile", { userId: myUserId(), birthDate, birthTime, gender, province });
    setSaving(false);
    if (r.ok) setResult(r.data);
    else setError(r.error);
  }

  return (
    <div>
      <div className="card">
        <h2>☯ ข้อมูลเกิดของคุณ (คำนวณดวง 1 ครั้ง)</h2>
        <p style={{ fontSize: 13, color: "#9a937f", marginBottom: 14 }}>
          ใช้คำนวณธาตุที่ควร/เลี่ยง + เปรียบเทียบกับหุ้น/IPO/ฤกษ์ — เก็บเป็นรหัสแฮช ไม่ส่งข้อมูลส่วนตัว
        </p>
        <label>วันเกิด (ค.ศ.)</label>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <label>เวลาเกิด</label>
        <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
        <label>เพศ</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="male">ชาย</option>
          <option value="female">หญิง</option>
        </select>
        <label>จังหวัดเกิด</label>
        <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Bangkok" />
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "กำลังคำนวณ..." : "บันทึกดวงของฉัน"}
        </button>
        {error && <p style={{ color: "#d48f8f", marginTop: 10 }}>{error}</p>}
      </div>
      {result && (
        <div className="card">
          <h2>✅ บันทึกแล้ว</h2>
          <p>
            รหัสดวง: <b>{result.chartHash}</b> · ผู้ใช้: {result.userId}
          </p>
          <a className="btn" href="/chat" style={{ marginTop: 12 }}>
            ไปลองแชท →
          </a>
        </div>
      )}
    </div>
  );
}
