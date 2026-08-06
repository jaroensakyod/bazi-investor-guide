"use client";

import { useState, useEffect } from "react";
import { useT } from "../lib/i18n";

/** แบนเนอร์ยินยอมคุกกี้ตาม PDPA — เราใช้ localStorage (จำเป็น) ไม่มีคุกกี้บุคคลที่สาม */
const CONSENT_KEY = "duang_cookie_consent";

export default function CookieBanner() {
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#14161d",
        borderTop: "1px solid #d4af37",
        padding: "12px 16px",
        fontSize: 12.5,
        zIndex: 100,
        display: "flex",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <span style={{ color: "#cfcabe", flex: 1, minWidth: 220 }}>
        🍪 {t("cookie.text")}
      </span>
      <span style={{ display: "flex", gap: 8 }}>
        <a href="/legal?p=privacy" style={{ color: "#d4af37", textDecoration: "underline" }}>
          {t("legal.privacy")}
        </a>
        <button className="btn" style={{ fontSize: 12.5, padding: "4px 14px" }} onClick={accept}>
          {t("cookie.accept")}
        </button>
      </span>
    </div>
  );
}
