"use client";

import { useState, useEffect, useCallback } from "react";
import { get, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type IpoRow = {
  ticker: string;
  name: string;
  market?: string;
  country?: string;
  exchange?: string;
  ipoDate?: string;
  priceRange?: string;
  currency?: string;
  status?: string;
  element: string;
  elementReason: string;
  fit: "good" | "neutral" | "avoid" | "drain" | null;
};

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };

export default function IpoPage() {
  const t = useT();
  const [rows, setRows] = useState<IpoRow[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await get<{ list: IpoRow[] }>(`/api/ipo?userId=${myUserId()}`);
    if (r.ok) setRows(r.data.list);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const elKey = (e: string) => ELMAP[e] ?? e;
  const fitText = (f: IpoRow["fit"]) =>
    f === "good" ? <b style={{ color: "#8fd4a0" }}>✅ ตรงดวง</b> : f === "avoid" ? <b style={{ color: "#d48f8f" }}>⛔ ขัดดวง</b> : f === "drain" ? <b style={{ color: "#d4a06a" }}>⚠️ ดูดพลัง</b> : f === "neutral" ? <span style={{ color: "#9a937f" }}>🟡 กลาง</span> : <span style={{ color: "#9a937f" }}>— (ไม่มีโปรไฟล์)</span>;

  return (
    <div>
      <div className="card">
        <h2>🚀 {t("ipo.title")}</h2>
        <p style={{ fontSize: 12.5, color: "#9a937f" }}>{t("ipo.sub")}</p>
        {error && <p style={{ color: "#d48f8f" }}>{error}</p>}
      </div>

      {rows.map((e) => (
        <div key={e.ticker} className="card" style={{ padding: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer", flexWrap: "wrap" }} onClick={() => setOpen(open === e.ticker ? null : e.ticker)}>
            <span>
              <b>{e.ticker}</b> <span style={{ color: "#9a937f", fontSize: 13 }}>{e.name}</span>
            </span>
            <span style={{ whiteSpace: "nowrap" }}>
              <span style={{ color: ELEMENT_COLOR[elKey(e.element)] ?? "#d4af37", fontWeight: 700 }}>{t(`el.${elKey(e.element)}` as never)}</span>{" "}
              {fitText(e.fit)} <span style={{ color: "#9a937f", fontSize: 12 }}>{open === e.ticker ? "▲" : "▼"}</span>
            </span>
          </div>
          {open === e.ticker && (
            <div style={{ fontSize: 12.5, color: "#cfcabe", marginTop: 8, borderTop: "1px solid #262a34", paddingTop: 8 }}>
              <p>
                📅 {t("ipo.date")}: <b>{e.ipoDate ?? "-"}</b> · 🏛️ {t("ipo.exchange")}: <b>{e.exchange ?? e.market ?? "-"}</b> ({e.country ?? "-"}) · 💰 {t("ipo.price")}: <b>{e.priceRange ?? "-"}</b> {e.currency ?? ""} · {t("ipo.status")}: <b>{e.status ?? "-"}</b>
              </p>
              <p style={{ marginTop: 4 }}>
                🧭 {t("ipo.element")}: <b style={{ color: ELEMENT_COLOR[elKey(e.element)] ?? "#d4af37" }}>{e.element}</b> — {e.elementReason}
              </p>
            </div>
          )}
        </div>
      ))}
      {rows.length === 0 && !error && <div className="card" style={{ fontSize: 13, color: "#9a937f" }}>— {t("ipo.empty")}</div>}

      <div className="card" style={{ fontSize: 12, color: "#9a937f" }}>
        ⚠️ {t("ipo.disclaimer")}
      </div>
    </div>
  );
}
