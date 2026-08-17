"use client";

import { useState } from "react";

type CardData = {
  persona: { name: string; emoji: string; bandLabel: string; style: string };
  trading: { label: string; allowed: "yes" | "no" | "partial"; split: { cold: number; fast: number; emergency: number } };
  strengthen: { element: string; wealth: string };
  avoid: string[];
  principle: { excessElement?: string; excessCount?: number; desc: string };
  goodStocks: Array<{ ticker: string; name: string; element: string; fit: string }>;
  goodAssets: Array<{ ticker: string; name: string; element: string; fit: string }>;
  disclaimer: string;
};

const EL_COLOR: Record<string, string> = { ไม้: "#4caf50", ไฟ: "#ef5350", ดิน: "#a1887f", ทอง: "#d4af37", น้ำ: "#42a5f5" };

/** เดโมสด: กรอกวันเกิด → การ์ดตัวตนฟรี (HTML น่าแชร์ + PDF) — lead magnet */
export default function DemoPage() {
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState<CardData | null>(null);

  async function generate() {
    setBusy(true);
    setError("");
    setCard(null);
    try {
      const params = new URLSearchParams({ birthDate, birthTime, gender, province });
      const res = await fetch(`/api/card-data?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        setError(j?.error ?? "สร้างการ์ดไม่สำเร็จ");
        return;
      }
      const j = await res.json();
      setCard(j.data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function downloadCard() {
    try {
      const params = new URLSearchParams({ birthDate, birthTime, gender, province });
      const res = await fetch(`/api/card-pdf?${params}`);
      if (!res.ok) return;
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
    }
  }

  const shareText = encodeURIComponent(
    `🃏 ฉันเป็นนักลงทุน ${card?.persona.name ?? ""} (${card?.persona.bandLabel ?? ""}) — ${card?.trading.label ?? ""} คุณล่ะเป็นแบบไหน? ลองฟรี: ${typeof window !== "undefined" ? window.location.origin : ""}/demo`
  );
  const shareUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* ── ฟอร์ม ── */}
      <div className="card" style={{ borderColor: "#d4af37", background: "linear-gradient(135deg,#161a24 0%,#1d2130 100%)", textAlign: "center" }}>
        <h2>🃏 คุณเป็นนักลงทุนธาตุไหน?</h2>
        <p style={{ fontSize: 13, color: "#9a937f" }}>
          กรอกวันเกิด → รับ <b style={{ color: "#d4af37" }}>การ์ดตัวตนการเงินฟรี</b> ทันที — คำนวณจากดวง 60 กะจื่อ ไม่ใช่ดวงเดา
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
        <button className="btn" onClick={generate} disabled={busy} style={{ marginTop: 14, fontSize: 15, padding: "10px 28px" }}>
          {busy ? "⏳ กำลังคำนวณ..." : "🎁 รับการ์ดฟรีทันที"}
        </button>
        {error && <p style={{ color: "#d48f8f", fontSize: 12.5 }}>{error}</p>}
      </div>

      {/* ── การ์ดผลลัพธ์ (HTML — น่าแชร์) ── */}
      {card && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              borderRadius: 16,
              border: "1.5px solid #d4af37",
              overflow: "hidden",
              background: "linear-gradient(160deg,#0f2e1c 0%,#14532d 45%,#1d2130 100%)",
              color: "#fff",
              boxShadow: "0 12px 40px rgba(0,0,0,.45)",
            }}
          >
            <div style={{ padding: "16px 20px", background: "rgba(212,175,55,.14)", borderBottom: "1px solid rgba(212,175,55,.35)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b style={{ fontSize: 15, letterSpacing: 0.5 }}>☯ ดวงนักลงทุน</b>
              <span style={{ fontSize: 10.5, color: "#d4af37", border: "1px solid #d4af37", borderRadius: 20, padding: "2px 10px" }}>LEAD MAGNET · ฟรี</span>
            </div>

            <div style={{ padding: "18px 20px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 34 }}>{card.persona.emoji}</div>
              <h3 style={{ margin: "4px 0 2px", fontSize: 21, color: "#d4af37" }}>{card.persona.name}</h3>
              <p style={{ margin: 0, fontSize: 12.5, color: "#cfe3d4" }}>
                {card.persona.bandLabel} · {card.persona.style}
              </p>
            </div>

            <div style={{ padding: "0 20px 14px" }}>
              <div style={{ background: "rgba(155,44,44,.85)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                <b style={{ fontSize: 13.5 }}>การเทรด: {card.trading.label}</b>
                <div style={{ fontSize: 11.5, color: "#f0dcdc", marginTop: 2 }}>
                  เงินเย็น {card.trading.split.cold}% · เร็ว {card.trading.split.fast}% · ฉุกเฉิน {card.trading.split.emergency}%
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                <span style={{ background: "rgba(212,175,55,.16)", border: "1px solid rgba(212,175,55,.5)", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                  🔥 เสริม: {card.strengthen.element}
                </span>
                <span style={{ background: "rgba(66,165,245,.14)", border: "1px solid rgba(66,165,245,.45)", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                  💧 ธาตุลาภ: {card.strengthen.wealth}
                </span>
                <span style={{ background: "rgba(155,44,44,.14)", border: "1px solid rgba(155,44,44,.5)", borderRadius: 20, padding: "4px 12px", fontSize: 12 }}>
                  ⛔ เลี่ยง: {card.avoid.join("/")}
                </span>
              </div>
              {card.principle.excessElement && (
                <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#f2b8b8" }}>
                  ⚠️ ธาตุ {card.principle.excessElement} มีเกิน ({card.principle.excessCount} ตัว) — อย่าเพิ่ม
                </p>
              )}

              <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 14px", marginBottom: 10 }}>
                <b style={{ fontSize: 12, color: "#d4af37" }}>🟢 หุ้นที่ถูกดวง</b>
                {card.goodStocks.map((s) => (
                  <p key={s.ticker} style={{ margin: "3px 0", fontSize: 12 }}>
                    <span style={{ color: EL_COLOR[s.element] ?? "#fff", fontWeight: 700 }}>{s.ticker}</span> — {s.element} (ตรงดวง) · {s.name}
                  </p>
                ))}
              </div>
              <div style={{ background: "rgba(255,255,255,.06)", borderRadius: 10, padding: "10px 14px" }}>
                <b style={{ fontSize: 12, color: "#d4af37" }}>🟢 สินทรัพย์ที่ถูกดวง</b>
                {card.goodAssets.map((s) => (
                  <p key={s.ticker} style={{ margin: "3px 0", fontSize: 12 }}>
                    <span style={{ color: EL_COLOR[s.element] ?? "#fff", fontWeight: 700 }}>{s.ticker}</span> — {s.element} (ตรงดวง) · {s.name}
                  </p>
                ))}
              </div>
            </div>

            <div style={{ padding: "12px 20px", background: "rgba(212,175,55,.16)", borderTop: "1px solid rgba(212,175,55,.35)" }}>
              <p style={{ margin: 0, fontSize: 12, textAlign: "center" }}>
                🔒 ยังมีอีกมาก: verdict 60 ข้อ · พอร์ตจัดสรร · <b style={{ color: "#d4af37" }}>แผนที่ชีวิต 0-80 ปี</b> · วันมงคลรายเดือน
              </p>
            </div>
          </div>

          {/* ── ปุ่ม: ดาวน์โหลด + แชร์ ── */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            <button className="btn" onClick={downloadCard} style={{ fontSize: 13.5, padding: "9px 20px" }}>
              📄 ดาวน์โหลด PDF (เก็บไว้ดู)
            </button>
            <a
              className="btn secondary"
              href={`https://line.me/R/msg/text/?${shareText}`}
              target="_blank"
              rel="noopener"
              style={{ fontSize: 13.5, padding: "9px 20px" }}
            >
              💬 แชร์ LINE
            </a>
            <a
              className="btn secondary"
              href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
              target="_blank"
              rel="noopener"
              style={{ fontSize: 13.5, padding: "9px 20px" }}
            >
              📘 แชร์ Facebook
            </a>
          </div>

          <p style={{ textAlign: "center", fontSize: 10.5, color: "#777", marginTop: 10 }}>{card.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
