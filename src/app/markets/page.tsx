"use client";

import { useState, useEffect, useCallback } from "react";
import { get } from "../lib/api";
import { useT } from "../lib/i18n";

type Row = { ticker?: string; name: string; region?: string; type?: string; element?: string | null; price: number | null; changePct: number | null };
type IndicesData = { updatedAt: string | null; indices: Row[]; forex: Row[]; assets: Row[] };
type AssetsData = { count: number; assets: Row[] };

const REGION_FLAG: Record<string, string> = {
  TH: "🇹🇭", US: "🇺🇸", JP: "🇯🇵", HK: "🇭🇰", KR: "🇰🇷", TW: "🇹🇼", IN: "🇮🇳", AU: "🇦🇺", SG: "🇸🇬", ID: "🇮🇩", MY: "🇲🇾", PH: "🇵🇭", VN: "🇻🇳",
  DE: "🇩🇪", GB: "🇬🇧", FR: "🇫🇷", EU: "🇪🇺", BR: "🇧🇷", MX: "🇲🇽", SA: "🇸🇦", PK: "🇵🇰", FX: "💱",
};

type Tab = "indices" | "commodity" | "etf" | "crypto" | "bond" | "fx";

export default function MarketsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("indices");
  const [data, setData] = useState<IndicesData | null>(null);
  const [assets, setAssets] = useState<Record<string, Row[]>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await get<IndicesData>("/api/indices");
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
    // โหลดแต่ละหมวด (list ล้วน — ไม่ต้องมีโปรไฟล์)
    (["commodity", "etf", "crypto", "bond"] as Tab[]).forEach(async (ty) => {
      const r = await get<AssetsData>(`/api/assets?type=${ty}&limit=60`);
      if (r.ok) setAssets((a) => ({ ...a, [ty]: r.data.assets }));
    });
  }, [load]);

  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "indices", label: `📈 ${t("markets.indices")}` },
    { id: "commodity", label: `🛢️ ${t("markets.commodity")}` },
    { id: "etf", label: `📦 ${t("markets.etf")}` },
    { id: "crypto", label: `🪙 ${t("markets.crypto")}` },
    { id: "bond", label: `🏛️ ${t("markets.bond")}` },
    { id: "fx", label: `💱 ${t("markets.forex")}` },
  ];

  const Table = ({ rows, showFlag = true }: { rows: Row[]; showFlag?: boolean }) => (
    <table>
      <thead>
        <tr>
          <th>{t("assets.all")}</th>
          <th>ราคา</th>
          <th>%วันนี้</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name + (r.ticker ?? "")}>
            <td>
              {showFlag && r.region ? REGION_FLAG[r.region] ?? "" : ""} <b>{r.name}</b>
              {r.ticker ? <span style={{ fontSize: 11, color: "#9a937f" }}> · {r.ticker}</span> : ""}
            </td>
            <td>{r.price != null ? r.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}</td>
            <td style={{ color: (r.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(r.changePct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const current: Row[] = (() => {
    if (!data) return [];
    if (tab === "indices") return data.indices;
    if (tab === "fx") return data.forex;
    return assets[tab] ?? [];
  })();

  return (
    <div>
      <div className="card">
        <h2>🌐 {t("markets.title")}</h2>
        {data?.updatedAt ? (
          <p style={{ fontSize: 12, color: "#9a937f" }}>
            {t("markets.updated")}: {data.updatedAt.slice(0, 16).replace("T", " ")}
          </p>
        ) : null}
        {error && <p style={{ color: "#d48f8f" }}>{error}</p>}
        <div className="chips" style={{ marginTop: 8 }}>
          {TABS.map((tb) => (
            <button key={tb.id} className={`chip ${tab === tb.id ? "on" : ""}`} onClick={() => setTab(tb.id)}>
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {current.length > 0 ? <Table rows={current} showFlag={tab === "indices" || tab === "fx"} /> : <p style={{ color: "#9a937f" }}>{t("markets.noindex")}</p>}
      </div>
    </div>
  );
}
