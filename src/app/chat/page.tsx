"use client";

import { useState, useRef, useEffect } from "react";
import { post, myUserId } from "../lib/api";
import { useT, useLocale } from "../lib/i18n";

type Msg = { role: "user" | "bot"; text: string; intent?: string; llm?: boolean };

export default function ChatPage() {
  const t = useT();
  const { locale } = useLocale();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [needProfile, setNeedProfile] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send(text: string) {
    const t2 = text.trim();
    if (!t2 || busy) return;
    setMsgs((m) => [...m, { role: "user", text: t2 }]);
    setInput("");
    setBusy(true);
    const r = await post<{ reply: string; intent: string; llm: boolean; disclaimer: string }>("/api/chat", {
      userId: myUserId(),
      message: t2,
      useLlm: true,
      locale,
    });
    setBusy(false);
    if (r.ok) {
      setMsgs((m) => [...m, { role: "bot", text: r.data.reply, intent: r.data.intent, llm: r.data.llm }]);
    } else {
      if (r.error.includes("โปรไฟล์")) setNeedProfile(true);
      setMsgs((m) => [...m, { role: "bot", text: `❌ ${r.error}` }]);
    }
  }

  const suggestions = ["หุ้นวันนี้ตัวไหนเด่น", "วันนี้ดวงเราเป็นยังไง", "สัปดาห์นี้ IPO ตัวไหนเหมาะกับดวง", "เดือนนี้ลงทุนกับอะไรดี", "วิเคราะห์ KBANK ให้หน่อย"];

  return (
    <div>
      <div className="chips">
        {suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>
            {s}
          </button>
        ))}
      </div>
      {needProfile && (
        <div className="card" style={{ borderColor: "#d4af37" }}>
          {t("chat.needprofile")} <a href="/profile">→</a>
        </div>
      )}
      <div className="chatbox">
        {msgs.length === 0 && (
          <div className="msg bot">
            <span className="badge">{t("chat.botname")}</span>
            {t("chat.welcome")}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "bot" && (
              <span className="badge">
                {t("chat.botname")}
                {m.llm ? " · AI" : ""}
                {m.intent ? ` · ${m.intent}` : ""}
              </span>
            )}
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="msg bot">
            <span className="badge">{t("chat.analyzing")}</span>⏳
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="chatinput">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
          placeholder={t("chat.placeholder")}
        />
        <button className="btn" onClick={() => send(input)} disabled={busy}>
          {t("chat.send")}
        </button>
      </div>
    </div>
  );
}
