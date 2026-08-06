"use client";

import { useState, useEffect } from "react";
import { LEGAL } from "../../lib/legal/content";
import { useT } from "../lib/i18n";

const TABS = [
  { id: "disclaimer", labelKey: "legal.disclaimer" },
  { id: "risk", labelKey: "legal.risk" },
  { id: "terms", labelKey: "legal.terms" },
  { id: "privacy", labelKey: "legal.privacy" },
] as const;

type Locale = "th" | "zh" | "en";

export default function LegalPage() {
  const t = useT();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("disclaimer");
  const [loc, setLoc] = useState<Locale>("th");

  // รองรับ ?p=risk จาก footer
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    if (p && TABS.some((tb) => tb.id === p)) setTab(p as typeof tab);
  }, []);

  return (
    <div>
      <div className="card">
        <div className="chips">
          {TABS.map((tb) => (
            <button key={tb.id} className={`chip ${tab === tb.id ? "on" : ""}`} onClick={() => setTab(tb.id)}>
              {t(tb.labelKey as never)}
            </button>
          ))}
          {(["th", "zh", "en"] as Locale[]).map((l) => (
            <button key={l} className={`chip ${loc === l ? "on" : ""}`} onClick={() => setLoc(l)} style={{ marginLeft: 6 }}>
              {l === "th" ? "ไทย" : l === "zh" ? "中文" : "EN"}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "#9a937f", marginTop: 6 }}>ดวงนักลงทุน · เอกสารทางกฎหมาย (3 ภาษา)</p>
      </div>

      <div className="card" style={{ fontSize: 14, lineHeight: 1.75 }}>
        {LEGAL[tab][loc].map((block, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>{block.h}</h2>
            {block.p.map((para, j) => (
              <p key={j} style={{ marginBottom: 8, color: "#cfcabe" }}>
                {para}
              </p>
            ))}
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: "#8a8472", marginTop: 12 }}>
          {t("disclaimer")} · © 2026 ดวงนักลงทุน
        </p>
      </div>
    </div>
  );
}
