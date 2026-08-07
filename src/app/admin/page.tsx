"use client";

import { useState, useEffect, useCallback } from "react";
import { get, post } from "../lib/api";
import { useT } from "../lib/i18n";

type DashboardData = {
  users: Array<{ userId: string; birthDate: string; gender: string; createdAt: string; locale: string }>;
  usage: { totalEvents: number; uniqueUsers: number; byIntent: Record<string, number>; llmCalls: number; last24h: number };
  llmEnabled: boolean;
};

export default function AdminPage() {
  const t = useT();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshOut, setRefreshOut] = useState("");

  const load = useCallback(async () => {
    const r = await get<DashboardData>("/api/dashboard");
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refresh(kind: "ipo" | "prices") {
    setRefreshing(kind);
    setRefreshOut("");
    const r = await post<{ kind: string; output: string; timedOut?: boolean }>(`/api/refresh?kind=${kind}`, {});
    setRefreshing(null);
    if (r.ok) {
      setRefreshOut(`✅ ${r.data.kind}: ${r.data.timedOut ? "(timeout)" : "เสร็จ"}\n${r.data.output}`);
      load();
    } else setRefreshOut(`❌ ${r.error}`);
  }

  async function exportCsv(kind: "assets" | "thai-stocks") {
    const res = await fetch(`/api/export?kind=${kind}`);
    if (!res.ok) {
      setError(`export ล้มเหลว (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "assets" ? "assets-review.csv" : "thai-stocks-review.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const intents = data ? Object.entries(data.usage.byIntent).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];

  return (
    <div>
      <div className="card">
        <h2>
          {t("admin.title")}{" "}
          {data ? <span className="tag">{data.llmEnabled ? t("admin.llmon") : t("admin.llmoff")}</span> : ""}
        </h2>
        <button className="btn secondary" onClick={load} style={{ fontSize: 13 }}>
          {t("admin.refresh")}
        </button>
      </div>
      <div className="card">
        <h2>{t("admin.datarefresh")}</h2>
        <button className="btn" onClick={() => refresh("ipo")} disabled={refreshing !== null} style={{ marginRight: 8 }}>
          🔄 อัปเดต IPO
        </button>
        <button className="btn secondary" onClick={() => refresh("prices")} disabled={refreshing !== null} style={{ marginRight: 8 }}>
          🔄 ดึงราคา
        </button>
        <a className="btn" href="/admin/pdf" style={{ marginRight: 8 }}>
          🛠️ สร้างสินค้า PDF (เฉพาะเจ้าของ)
        </a>
        {refreshOut && (
          <pre style={{ background: "#10131a", padding: 10, borderRadius: 8, fontSize: 12, marginTop: 10, whiteSpace: "pre-wrap" }}>{refreshOut}</pre>
        )}
      </div>
      <div className="card">
        <h2>📤 {t("admin.export")}</h2>
        <p style={{ fontSize: 12.5, color: "#9a937f", marginBottom: 8 }}>{t("admin.exportdesc")}</p>
        <button className="btn" onClick={() => exportCsv("assets")} style={{ marginRight: 8 }}>
          📦 export สินทรัพย์ (113)
        </button>
        <button className="btn secondary" onClick={() => exportCsv("thai-stocks")}>
          🇹🇭 export หุ้นไทย (272)
        </button>
      </div>
      {data && (
        <>
          <div className="card">
            <span className="stat">
              {t("admin.users")} <b>{data.users.length}</b>
            </span>
            <span className="stat">
              {t("admin.events")} <b>{data.usage.totalEvents}</b>
            </span>
            <span className="stat">
              {t("admin.last24h")} <b>{data.usage.last24h}</b>
            </span>
            <span className="stat">
              {t("admin.llm")} <b>{data.usage.llmCalls}</b>
            </span>
          </div>
          <div className="card">
            <h2>{t("admin.intents")}</h2>
            {intents.length ? (
              <table>
                <thead>
                  <tr>
                    <th>intent</th>
                    <th>#</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: "#9a937f", fontSize: 13 }}>{t("admin.nodata")}</p>
            )}
          </div>
          <div className="card">
            <h2>
              {t("admin.userlist")} ({data.users.length})
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{t("admin.uid")}</th>
                  <th>{t("admin.birth")}</th>
                  <th>{t("admin.gender")}</th>
                  <th>{t("admin.lang")}</th>
                  <th>{t("admin.created")}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.slice(0, 20).map((u) => (
                  <tr key={u.userId}>
                    <td>{u.userId}</td>
                    <td>{u.birthDate}</td>
                    <td>{u.gender}</td>
                    <td>{u.locale}</td>
                    <td style={{ fontSize: 12 }}>{u.createdAt.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {error && <p style={{ color: "#d48f8f" }}>{error}</p>}
    </div>
  );
}
