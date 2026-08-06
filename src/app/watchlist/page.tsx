"use client";

import { useState, useEffect, useCallback } from "react";
import { get, post, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";
import Link from "next/link";

type WatchRow = { entry: string; kind: "stock" | "asset"; ticker: string; name: string; market: string; element: string; price: number | null; changePct: number | null };
type WatchData = { entries: string[]; rows: WatchRow[]; updatedAt: string | null };

const ELMAP: Record<string, string> = { ไม้: "wood", ไฟ: "fire", ดิน: "earth", ทอง: "metal", น้ำ: "water" };
const ELEMENT_COLOR: Record<string, string> = { wood: "#4a9c6d", fire: "#c2574a", earth: "#b08a3e", metal: "#c9a227", water: "#3e6fb0" };

export default function WatchlistPage() {
  const t = useT();
  const [data, setData] = useState<WatchData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await get<WatchData>(`/api/watchlist?userId=${myUserId()}`);
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(entry: string) {
    const r = await post<{ entries: string[] }>(`/api/watchlist?userId=${myUserId()}&action=remove&entry=${encodeURIComponent(entry)}`, {});
    if (r.ok) load();
    else setError(r.error);
  }

  const elKey = (e: string) => ELMAP[e] ?? e;
  const pct = (v: number | null) => (v == null ? "-" : `${v >= 0 ? "+" : ""}${v}%`);

  return (
    <div>
      <div className="card">
        <h2>⭐ {t("watchlist.title")}</h2>
        {error && <p style={{ color: "#d48f8f" }}>{error}</p>}
        {!error && data && data.rows.length === 0 && (
          <p style={{ color: "#9a937f" }}>{t("watchlist.empty")}</p>
        )}
      </div>

      {data && data.rows.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>{t("stocks.ticker")}</th>
                <th>ชื่อ</th>
                <th>ธาตุ</th>
                <th>ราคา</th>
                <th>%วันนี้</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.entry}>
                  <td>
                    <b>{r.ticker}</b> <span style={{ fontSize: 11, color: "#9a937f" }}>{r.market}</span>
                  </td>
                  <td style={{ fontSize: 13 }}>{r.name}</td>
                  <td>
                    <span style={{ color: ELEMENT_COLOR[elKey(r.element)] ?? "#d4af37", fontWeight: 700 }}>{t(`el.${elKey(r.element)}` as never)}</span>
                  </td>
                  <td>{r.price != null ? r.price.toLocaleString() : "-"}</td>
                  <td style={{ color: (r.changePct ?? 0) >= 0 ? "#8fd4a0" : "#d48f8f" }}>{pct(r.changePct)}</td>
                  <td>
                    <Link href={`/report?ticker=${encodeURIComponent(r.ticker)}`} className="btn secondary" style={{ fontSize: 11.5, marginRight: 6 }}>
                      📑 {t("report.title").slice(0, 4)}
                    </Link>
                    <button className="btn secondary" style={{ fontSize: 11.5 }} onClick={() => remove(r.entry)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
