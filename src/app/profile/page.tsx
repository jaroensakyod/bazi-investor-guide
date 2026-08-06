"use client";

import { useState } from "react";
import { post, myUserId } from "../lib/api";
import { useT } from "../lib/i18n";

export default function ProfilePage() {
  const t = useT();
  const [birthDate, setBirthDate] = useState("1993-11-24");
  const [birthTime, setBirthTime] = useState("15:12");
  const [gender, setGender] = useState("male");
  const [province, setProvince] = useState("Bangkok");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ chartHash: string; userId: string } | null>(null);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const r = await post<{ chartHash: string; userId: string }>("/api/profile", { userId: myUserId(), birthDate, birthTime, gender, province });
    setSaving(false);
    if (r.ok) setResult(r.data);
    else setError(r.error);
  }

  return (
    <div>
      <div className="card">
        <h2>{t("profile.title")}</h2>
        <p style={{ fontSize: 13, color: "#9a937f", marginBottom: 14 }}>{t("profile.desc")}</p>
        <label>{t("profile.birth")}</label>
        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        <label>{t("profile.time")}</label>
        <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
        <label>{t("profile.gender")}</label>
        <select value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="male">{t("profile.gender.male")}</option>
          <option value="female">{t("profile.gender.female")}</option>
        </select>
        <label>{t("profile.province")}</label>
        <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="Bangkok" />
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? t("profile.saving") : t("profile.save")}
        </button>
        {error && <p style={{ color: "#d48f8f", marginTop: 10 }}>{error}</p>}
      </div>
      {result && (
        <div className="card">
          <h2>{t("profile.saved")}</h2>
          <p>
            {t("profile.charthash")}: <b>{result.chartHash}</b> · {t("profile.user")}: {result.userId}
          </p>
          <a className="btn" href="/chat" style={{ marginTop: 12 }}>
            {t("profile.gochat")}
          </a>
        </div>
      )}
    </div>
  );
}
