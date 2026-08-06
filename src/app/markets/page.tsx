"use client";

import { useState, useEffect, useCallback } from "react";
import { get, post, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

type Row = { name: string; region?: string; ticker?: string; type?: string; element?: string | null; price: number | null; changePct: number | null };
type IndicesData = { updatedAt: string | null; indices: Row[]; forex: Row[]; assets: Row[] };

const REGION_FLAG: Record<string, string> = {
  TH: "🇹🇭", US: "🇺🇸", JP: "🇯🇵", HK: "🇭🇰", KR: "🇰🇷", TW: "🇹🇼", IN: "🇮🇳", AU: "🇦🇺", SG: "🇸🇬", ID: "🇮🇩", MY: "🇲🇾", PH: "🇵🇭", VN: "🇻🇳",
  DE: "🇩🇪", GB: "🇬🇧", FR: "🇫🇷", EU: "🇪🇺", BR: "🇧🇷", MX: "🇲🇽", SA: "🇸🇦", PK: "🇵🇰", FX: "💱",
};

export default function MarketsPage() {
  const t = useT();
  const [data, setData] = useState<IndicesData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await get<IndicesData>("/api/indices");
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  const Table = ({ rows, showFlag = true }: { rows: Row[]; showFlag?: boolean }) => (
    <table>
      <thead>
        <tr>
          <th>ชื่อ</th>
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
      </div>

      <div className="card">
        <h2>📈 {t("markets.indices")}</h2>
        {data && data.indices.length > 0 ? <Table rows={data.indices} /> : <p style={{ color: "#9a937f" }}>{t("markets.noindex")}</p>}
      </div>

      <div className="card">
        <h2>💰 {t("markets.assets")}</h2>
        {data && data.assets.length > 0 ? <Table rows={data.assets} showFlag={false} /> : <p style={{ color: "#9a937f" }}>{t("markets.noindex")}</p>}
      </div>

      <div className="card">
        <h2>💱 {t("markets.forex")}</h2>
        {data && data.forex.length > 0 ? <Table rows={data.forex} /> : <p style={{ color: "#9a937f" }}>{t("markets.noindex")}</p>}
      </div>
    </div>
  );
}
