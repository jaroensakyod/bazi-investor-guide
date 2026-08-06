"use client";

import { useState, useRef, useEffect } from "react";
import { post, myUserId } from "../lib/api";

type Msg = { role: "user" | "bot"; text: string; intent?: string; llm?: boolean };

const SUGGESTIONS = [
  "หุ้นวันนี้ตัวไหนเด่น",
  "วันนี้ดวงเราเป็นยังไง",
  "วันนี้ดวงกับหุ้นอะไรดี",
  "สัปดาห์นี้ IPO ตัวไหนเหมาะกับดวง",
  "เดือนนี้ลงทุนกับอะไรดี",
  "วิเคราะห์ KBANK ให้หน่อย",
];

export default function ChatPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setBusy(true);
    const r = await post<{ reply: string; intent: string; llm: boolean; disclaimer: string }>("/api/chat", {
      userId: myUserId(),
      message: t,
      useLlm: true,
    });
    setBusy(false);
    if (r.ok) {
      setMsgs((m) => [...m, { role: "bot", text: r.data.reply, intent: r.data.intent, llm: r.data.llm }]);
    } else {
      if (r.error.includes("โปรไฟล์")) setNeedProfile(true);
      setMsgs((m) => [...m, { role: "bot", text: `❌ ${r.error}` }]);
    }
  }

  return (
    <div>
      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>
      {needProfile && (
        <div className="card" style={{ borderColor: "#d4af37" }}>
          ยังไม่มีดวงของคุณ — <a href="/profile">กรอกวันเกิดก่อน</a> แล้วกลับมาแชทได้เลย
        </div>
      )}
      <div className="chatbox">
        {msgs.length === 0 && (
          <div className="msg bot">
            <span className="badge">ผู้ช่วยลงทุนคู่ดวง</span>
            สวัสดีครับ 🙏 ถามได้เลย เช่น "วันนี้ดวงกับหุ้นอะไรดี" "สัปดาห์นี้ IPO ตัวไหนเหมาะกับดวง" หรือ "เดือนนี้ลงทุนกับอะไรดี"
            — ทุกคำตอบเป็นบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม ไม่ใช่คำแนะนำการลงทุน
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "bot" && (
              <span className="badge">
                ผู้ช่วยลงทุนคู่ดวง{m.llm ? " · AI" : ""}
                {m.intent ? ` · ${m.intent}` : ""}
              </span>
            )}
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="msg bot">
            <span className="badge">กำลังวิเคราะห์...</span>
            ⏳
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chatinput">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder="พิมพ์คำถาม เช่น 'เดือนนี้ลงทุนกับอะไรดี'"
        />
        <button className="btn" onClick={() => send(input)} disabled={busy}>
          ส่ง
        </button>
      </div>
    </div>
  );
}
