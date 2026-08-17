"use client";

import Link from "next/link";
import styles from "./home.module.css";
import { useT } from "./lib/i18n";

export default function HomePage() {
  const t = useT();
  const marketItems = [t("home.market.1"), t("home.market.2"), t("home.market.3"), t("home.market.4")];
  const personalItems = [t("home.personal.1"), t("home.personal.2"), t("home.personal.3"), t("home.personal.4")];
  const steps = [
    { title: t("home.loop.1.title"), body: t("home.loop.1.body") },
    { title: t("home.loop.2.title"), body: t("home.loop.2.body") },
    { title: t("home.loop.3.title"), body: t("home.loop.3.body") },
  ];
  const tiers = [
    { price: t("home.tier.free.price"), title: t("home.tier.free.title"), body: t("home.tier.free.body") },
    { price: t("home.tier.99.price"), title: t("home.tier.99.title"), body: t("home.tier.99.body") },
    { price: t("home.tier.490.price"), title: t("home.tier.490.title"), body: t("home.tier.490.body") },
    { price: t("home.tier.790.price"), title: t("home.tier.790.title"), body: t("home.tier.790.body") },
  ];

  return (
    <article className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{t("home.eyebrow")}</p>
          <h1>{t("home.title")}</h1>
          <p className={styles.lead}>{t("home.lead")}</p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/report">{t("home.cta.primary")}</Link>
            <Link className={styles.secondaryAction} href="/trust">{t("home.cta.secondary")}</Link>
          </div>
          <p className={styles.proofLine}>{t("home.proof")}</p>
        </div>

        <aside className={styles.decisionCard} aria-label={t("home.sample.label")}>
          <p className={styles.sampleLabel}>{t("home.sample.label")}</p>
          <div className={styles.securityRow}>
            <h2>SET: ADVANC</h2>
            <span>{t("home.sample.asof")}</span>
          </div>
          <div className={styles.statusRow}>
            <strong>RESEARCH</strong>
            <span>{t("home.sample.status")}</span>
          </div>
          <p className={styles.cardAnswer}>{t("home.sample.answer")}</p>
          <div className={styles.confidenceRow}>
            <span>{t("home.sample.confidence")}</span>
            <strong>68 / 100</strong>
          </div>
          <div className={styles.confidenceTrack} role="img" aria-label={`${t("home.sample.confidence")} 68/100`}><span /></div>
          <ul className={styles.evidenceList}>
            <li><b>{t("home.sample.support")}</b><span>{t("home.sample.supportText")}</span></li>
            <li><b>{t("home.sample.unknown")}</b><span>{t("home.sample.unknownText")}</span></li>
            <li><b>{t("home.sample.review")}</b><span>{t("home.sample.reviewText")}</span></li>
          </ul>
          <div className={styles.cardFooter}>
            <span>decision-protocol-v2</span>
            <span>{t("home.sample.notice")}</span>
          </div>
        </aside>
      </section>

      <section className={styles.rails} aria-labelledby="two-rails-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>01</p>
          <div>
            <h2 id="two-rails-title">{t("home.rails.title")}</h2>
            <p>{t("home.rails.body")}</p>
          </div>
        </div>
        <div className={styles.railGrid}>
          <article className={styles.rail}>
            <p className={styles.railLabel}>Market evidence</p>
            <h3>{t("home.market.title")}</h3>
            <p>{t("home.market.body")}</p>
            <ul>{marketItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <div className={styles.separation}>{t("home.separation")}</div>
          <article className={styles.rail}>
            <p className={styles.railLabel}>Personal decision lens</p>
            <h3>{t("home.personal.title")}</h3>
            <p>{t("home.personal.body")}</p>
            <ul>{personalItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="decision-loop-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>02</p>
          <div>
            <h2 id="decision-loop-title">{t("home.loop.title")}</h2>
            <p>{t("home.loop.body")}</p>
          </div>
        </div>
        <div className={styles.loopGrid}>
          {steps.map((step, index) => (
            <article key={step.title} className={styles.loopStep}>
              <span>0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.tiers} aria-labelledby="tier-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>03</p>
          <div>
            <h2 id="tier-title">{t("home.tiers.title")}</h2>
            <p>{t("home.tiers.body")}</p>
          </div>
        </div>
        <div className={styles.tierGrid}>
          {tiers.map((tier) => (
            <article key={tier.price} className={styles.tier}>
              <span className={styles.tierPrice}>{tier.price}</span>
              <h3>{tier.title}</h3>
              <p>{tier.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.trustStrip}>
        <div>
          <h2>{t("home.trust.title")}</h2>
          <p>{t("home.trust.body")}</p>
        </div>
        <Link href="/trust">{t("home.trust.cta")}</Link>
      </section>
    </article>
  );
}
