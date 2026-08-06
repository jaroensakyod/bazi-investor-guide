"use client";

import { useState, useEffect, useCallback } from "react";
import { get } from "../lib/api";
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

  const load = useCallback(async () => {
    const r = await get<DashboardData>("/api/dashboard");
    if (r.ok) setData(r.data);
    else setError(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
