"use client";

import { useT } from "./lib/i18n";

export default function HomePage() {
  const t = useT();
  const features = [
    { icon: "🔮", title: t("feat.movers.title"), desc: t("feat.movers.desc") },
    { icon: "🚀", title: t("feat.ipo.title"), desc: t("feat.ipo.desc") },
    { icon: "🗓️", title: t("feat.almanac.title"), desc: t("feat.almanac.desc") },
    { icon: "📑", title: t("feat.report.title"), desc: t("feat.report.desc") },
    { icon: "🏠", title: t("feat.land.title"), desc: t("feat.land.desc") },
    { icon: "📈", title: t("feat.gems.title"), desc: t("feat.gems.desc") },
  ];
  return (
    <div>
      <div className="hero">
        <h1>{t("hero.title")}</h1>
        <p>
          {t("hero.sub")}
          <br />
          <span style={{ fontSize: 13, color: "#9a937f" }}>{t("disclaimer")}</span>
        </p>
        <a className="btn" href="/profile">
          {t("hero.cta1")}
        </a>{" "}
        <a className="btn secondary" href="/chat">
          {t("hero.cta2")}
        </a>
      </div>
      <div className="features">
        {features.map((f) => (
          <div className="feature" key={f.title}>
            <span style={{ fontSize: 22 }}>{f.icon}</span>
            <b>{f.title}</b>
            {f.desc}
          </div>
        ))}
      </div>
    </div>
  );
}
