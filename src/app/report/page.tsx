"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DecisionObject } from "../../lib/decision/decision-object";
import type { ResearchReleaseAssessment } from "../../lib/research/research-release-gate";
import type { StockResearchAssessment } from "../../lib/research/stock-research";
import { get, post } from "../lib/api";
import { useLocale, useT } from "../lib/i18n";
import styles from "./report.module.css";

type SearchItem = {
  kind: "stock" | "asset";
  ticker: string;
  name: string;
  market: string;
  element: string;
};

type ResearchData = StockResearchAssessment & {
  decision: DecisionObject;
  releaseGate: ResearchReleaseAssessment;
  persistence: {
    committed: boolean;
    snapshotId: string | null;
    auditEventId: string | null;
  };
  snapshot: {
    schemaVersion: number;
    snapshotId: string;
    createdAt: string;
    contentHash: string;
    versions: Record<string, string | null>;
    sourceAsOf: Array<{
      evidenceId: string;
      datasetId: string;
      asOf: string | null;
      source: string;
      sourceRef: string | null;
      freshness: string;
      license: string;
    }>;
  };
};

const STATUS_LABEL: Record<DecisionObject["status"], string> = {
  research: "ควรวิจัยต่อ",
  watch: "เฝ้าดูอย่างมีเงื่อนไข",
  review: "ทบทวนความเสี่ยงก่อน",
  avoid_for_now: "ยังไม่ควรให้เวลาเพิ่ม",
};

const STANCE_LABEL: Record<DecisionObject["claims"][number]["stance"], string> = {
  supports: "หลักฐานสนับสนุน",
  challenges: "หลักฐานคัดค้าน",
  context: "บริบท",
};

const FRESHNESS_LABEL: Record<string, string> = {
  fresh: "สดตามเกณฑ์",
  stale: "ควรอัปเดต",
  unknown: "ไม่ทราบความสด",
};

const PATTERN_LABEL: Record<string, string> = {
  above_20d_average: "ราคาอยู่เหนือค่าเฉลี่ย 20 วัน",
  below_20d_average: "ราคาอยู่ใต้ค่าเฉลี่ย 20 วัน",
  above_50d_average: "ราคาอยู่เหนือค่าเฉลี่ย 50 วัน",
  below_50d_average: "ราคาอยู่ใต้ค่าเฉลี่ย 50 วัน",
  near_20d_high: "ราคาอยู่ใกล้ขอบบน 20 วัน",
  near_20d_low: "ราคาอยู่ใกล้ขอบล่าง 20 วัน",
  volatility_elevated: "ความผันผวนสูงกว่าปกติ",
  drawdown_elevated: "drawdown อยู่ในระดับที่ต้องระวัง",
};

function hostname(url: string | null | undefined): string {
  if (!url) return "ไม่มีลิงก์ต้นทาง";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "แหล่งข้อมูล";
  }
}

export default function ReportPage() {
  const t = useT();
  const { locale } = useLocale();
  const [ticker, setTicker] = useState("AAPL");
  const [market, setMarket] = useState("");
  const [includeBazi, setIncludeBazi] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchItem[]>([]);
  const [data, setData] = useState<ResearchData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const query = ticker.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await get<{ stocks: SearchItem[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      if (result.ok) setSuggestions((result.data.stocks ?? []).slice(0, 8));
    }, 250);
    return () => clearTimeout(timer);
  }, [ticker]);

  async function load(selection?: SearchItem) {
    const selectedTicker = (selection?.ticker ?? ticker).trim().toUpperCase();
    const selectedMarket = selection?.market ?? market;
    if (!selectedTicker) return;
    setBusy(true);
    setError("");
    const result = await post<ResearchData>("/api/research", {
      ticker: selectedTicker,
      ...(selectedMarket ? { market: selectedMarket } : {}),
      includeBazi: includeBazi ? "1" : "0",
    });
    setBusy(false);
    setSuggestions([]);
    if (result.ok) {
      setTicker(selectedTicker);
      setMarket(result.data.security.exchange);
      setData(result.data);
    } else {
      setData(null);
      setError(result.error);
    }
  }

  const evidenceById = useMemo(
    () => new Map(data?.decision.evidence.map((item) => [item.id, item]) ?? []),
    [data],
  );
  const rightsByEvidence = useMemo(
    () => new Map(data?.releaseGate.evidenceRights.map((item) => [item.evidenceId, item]) ?? []),
    [data],
  );

  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : locale === "zh" ? "zh-CN" : "en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    : "ไม่ระบุ";
  const number = (value: number | null, suffix = "") => value == null
    ? "ยังไม่มีข้อมูล"
    : `${new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 2 }).format(value)}${suffix}`;

  function EvidenceRefs({ ids }: { ids: string[] }) {
    return (
      <span className={styles.evidenceRefs}>
        {ids.map((id) => {
          const index = data?.decision.evidence.findIndex((item) => item.id === id) ?? -1;
          return <span key={id} title={evidenceById.get(id)?.source}>{index >= 0 ? `S${index + 1}` : id}</span>;
        })}
      </span>
    );
  }

  return (
    <article className={styles.page}>
      <header className={styles.searchPanel}>
        <div className={styles.searchIntro}>
          <p className={styles.eyebrow}>Evidence-led security dossier</p>
          <h1>{t("report.title")}</h1>
          <p>
            อ่านหลักฐานตลาด ความไม่แน่นอน และเงื่อนไขที่ควรติดตามในหน้าเดียว
            โดยแยกข้อมูลตลาดออกจากกรอบสะท้อนเชิง BaZi อย่างชัดเจน
          </p>
        </div>

        <form
          className={styles.searchForm}
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <label htmlFor="research-ticker">Ticker หรือชื่อบริษัท</label>
          <div className={styles.inputRow}>
            <input
              id="research-ticker"
              value={ticker}
              onChange={(event) => {
                setTicker(event.target.value.toUpperCase());
                setMarket("");
              }}
              autoComplete="off"
              placeholder={t("report.ticker")}
            />
            <button type="submit" disabled={busy}>{busy ? "กำลังรวบรวม…" : "สร้าง dossier"}</button>
          </div>
          {suggestions.length > 0 && (
            <div className={styles.suggestions} aria-label="ผลการค้นหา">
              {suggestions.map((item) => (
                <button
                  type="button"
                  key={`${item.market}:${item.ticker}`}
                  onClick={() => void load(item)}
                >
                  <strong>{item.ticker}</strong>
                  <span>{item.name}</span>
                  <small>{item.market}</small>
                </button>
              ))}
            </div>
          )}
          <label className={styles.personalToggle}>
            <input
              type="checkbox"
              checked={includeBazi}
              onChange={(event) => setIncludeBazi(event.target.checked)}
            />
            <span>
              <b>เพิ่ม personal reflection lens</b>
              ใช้เพื่อสังเกตพฤติกรรมเท่านั้น และไม่มีสิทธิ์เปลี่ยนคะแนนหรือสถานะตลาด
            </span>
          </label>
          {includeBazi && (
            <p className={styles.profileHint}>ต้องมีข้อมูลที่หน้า <Link href="/profile">โปรไฟล์</Link> ก่อนใช้งาน</p>
          )}
        </form>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </header>

      {!data && !error && (
        <section className={styles.emptyState}>
          <p className={styles.sectionNo}>ก่อนเริ่ม</p>
          <div>
            <h2>รายงานนี้จะไม่ตอบด้วยคำว่า “ซื้อ” หรือ “ขาย” เพียงคำเดียว</h2>
            <p>
              ระบบจะแสดงข้อสรุปที่ตรวจย้อนกลับได้ พร้อมหลักฐานคัดค้าน สิ่งที่ยังไม่รู้
              กรอบราคาจากประวัติ และเงื่อนไขที่ทำให้ต้องเปลี่ยนมุมมอง
            </p>
          </div>
        </section>
      )}

      {data && (
        <div className={styles.dossier}>
          <header className={styles.dossierHeader}>
            <div className={styles.identityBlock}>
              <p className={styles.eyebrow}>{data.security.securityId}</p>
              <h2>{data.security.name}</h2>
              <p>{data.security.exchange} · {data.security.currency} · {data.security.sector || "ยังไม่ระบุ sector"}</p>
            </div>
            <div className={styles.statusBlock} data-status={data.decision.status}>
              <span>สถานะจากหลักฐาน</span>
              <strong>{STATUS_LABEL[data.decision.status]}</strong>
              <small>ข้อมูล ณ {date(data.decision.provenance.dataAsOf)}</small>
            </div>
          </header>

          <section className={styles.executiveSummary}>
            <div>
              <p className={styles.sectionNo}>Executive answer</p>
              <h3>{data.decision.answer}</h3>
              <p className={styles.businessContext}>{data.security.business}</p>
            </div>
            <aside className={styles.confidenceBlock}>
              <div>
                <span>ความเชื่อมั่น</span>
                <strong>{data.decision.confidence.score}<small>/100</small></strong>
              </div>
              <div className={styles.confidenceTrack} aria-label={`confidence ${data.decision.confidence.score}/100`}>
                <span style={{ width: `${data.decision.confidence.score}%` }} />
              </div>
              <p>{data.decision.confidence.level === "high" ? "สูง" : data.decision.confidence.level === "medium" ? "ปานกลาง" : "ต่ำ"}</p>
            </aside>
          </section>

          <section className={styles.lensSection}>
            <div className={styles.marketLens}>
              <p className={styles.lensLabel}>01 · Market evidence</p>
              <h3>ข้อสรุปจากข้อมูลตลาด</h3>
              <p>{data.decision.lenses.market.summary}</p>
              <dl className={styles.factLine}>
                <div><dt>คุณภาพกิจการ</dt><dd>{number(data.marketAssessment.qualityScore, "/100")}</dd></div>
                <div><dt>pattern</dt><dd>{number(data.marketAssessment.patternScore, "/100")}</dd></div>
                <div><dt>ข้อมูลพร้อม</dt><dd>{data.dataQuality.score}/100</dd></div>
              </dl>
            </div>
            <div className={styles.personalLens}>
              <p className={styles.lensLabel}>02 · Personal reflection</p>
              <h3>{data.decision.lenses.personal.available ? "กรอบสะท้อนส่วนบุคคล" : "ยังไม่ใช้ข้อมูลส่วนบุคคล"}</h3>
              <p>{data.decision.lenses.personal.summary}</p>
              <ul>
                {data.decision.lenses.personal.guardrails.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNo}>03</p>
              <div>
                <h3>เหตุผลที่ระบบสรุปแบบนี้</h3>
                <p>ทุกข้อความต้องชี้กลับไปยังหลักฐานด้านล่างได้ ไม่ใช้ดวงแทนข้อมูลตลาด</p>
              </div>
            </div>
            <ol className={styles.claimList}>
              {data.decision.claims.length > 0 ? data.decision.claims.map((claim) => (
                <li key={claim.id} data-stance={claim.stance}>
                  <div>
                    <span>{STANCE_LABEL[claim.stance]}</span>
                    <EvidenceRefs ids={claim.evidenceIds} />
                  </div>
                  <p>{claim.text}</p>
                </li>
              )) : (
                <li data-stance="context"><div><span>ยังสรุปไม่ได้</span></div><p>หลักฐานยังไม่พอสำหรับ claim ที่ตรวจย้อนกลับได้</p></li>
              )}
            </ol>
          </section>

          {data.pattern && (
            <section className={styles.section}>
              <div className={styles.sectionHeading}>
                <p className={styles.sectionNo}>04</p>
                <div>
                  <h3>กรอบสังเกตราคา ไม่ใช่จุดซื้อขาย</h3>
                  <p>อธิบายสิ่งที่เกิดขึ้นในข้อมูลย้อนหลัง เพื่อกำหนดสิ่งที่ต้องเฝ้าดู ไม่ใช่การทำนายยอดสูงสุด</p>
                </div>
              </div>
              <dl className={styles.patternFacts}>
                <div><dt>ภาวะราคา</dt><dd>{data.pattern.regime}</dd></div>
                <div><dt>ราคาล่าสุด</dt><dd>{number(data.pattern.lastPrice)} {data.security.currency}</dd></div>
                <div><dt>ขอบล่าง 20 วัน</dt><dd>{number(data.pattern.levels.recentSupport20)}</dd></div>
                <div><dt>ขอบบน 20 วัน</dt><dd>{number(data.pattern.levels.recentResistance20)}</dd></div>
                <div><dt>ความผันผวน 60 วัน</dt><dd>{number(data.pattern.risk.annualizedVolatility60Pct, "%")}</dd></div>
                <div><dt>drawdown สูงสุด 252 วัน</dt><dd>{number(data.pattern.risk.maxDrawdown252Pct, "%")}</dd></div>
              </dl>
              <div className={styles.observations}>
                {data.pattern.observations.map((item) => <span key={item}>{PATTERN_LABEL[item] ?? item}</span>)}
              </div>
              {data.pattern.scenarios.length > 0 && (
                <div className={styles.scenarios}>
                  <h4>การกระจายผลตอบแทนในอดีตเมื่อบริบทคล้ายกัน</h4>
                  {data.pattern.scenarios.map((scenario) => (
                    <div key={scenario.horizonSessions}>
                      <strong>{scenario.horizonSessions} sessions</strong>
                      <span>ตัวอย่าง {scenario.sampleCount}</span>
                      <span>P10 {number(scenario.lower10Pct, "%")}</span>
                      <span>มัธยฐาน {number(scenario.medianPct, "%")}</span>
                      <span>P90 {number(scenario.upper90Pct, "%")}</span>
                      <span>เป็นบวก {number(scenario.positiveFrequencyPct, "%")}</span>
                    </div>
                  ))}
                  <p>เป็นสถิติย้อนหลัง ไม่ใช่ forecast และห้ามใช้เป็น personalized buy/sell timing</p>
                </div>
              )}
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNo}>05</p>
              <div>
                <h3>ช่องว่างและความเสี่ยงที่ห้ามมองข้าม</h3>
                <p>ส่วนนี้มีน้ำหนักพอ ๆ กับข้อสนับสนุน เพราะช่วยกันความมั่นใจเกินข้อมูล</p>
              </div>
            </div>
            <div className={styles.riskGrid}>
              <div>
                <h4>สิ่งที่ยังไม่รู้</h4>
                <ul>
                  {data.decision.unknowns.length > 0 ? data.decision.unknowns.map((item) => (
                    <li key={item.id}>
                      <span data-impact={item.impact}>{item.impact}</span>
                      <div><b>{item.label}</b><p>ต้องเพิ่ม: {item.requiredEvidence}</p></div>
                    </li>
                  )) : <li><div><b>ไม่มีช่องว่างสำคัญที่ระบบตรวจพบ</b></div></li>}
                </ul>
              </div>
              <div>
                <h4>ความเสี่ยง</h4>
                <ul>
                  {data.decision.risks.length > 0 ? data.decision.risks.map((item) => (
                    <li key={item.id}>
                      <span data-impact={item.severity}>{item.severity}</span>
                      <div><b>{item.label}</b><EvidenceRefs ids={item.evidenceIds} /></div>
                    </li>
                  )) : <li><div><b>ยังไม่มี risk flag จากข้อมูลชุดนี้</b></div></li>}
                </ul>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNo}>06</p>
              <div>
                <h3>อะไรจะทำให้ข้อสรุปเปลี่ยน</h3>
                <p>ใช้เป็นรายการทบทวน ไม่ใช่สัญญาณให้ทำธุรกรรม</p>
              </div>
            </div>
            <div className={styles.changeList}>
              {data.decision.changeConditions.map((item, index) => (
                <div key={item.id}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p><b>{item.description}</b><small>{item.evidenceNeeded}</small></p>
                </div>
              ))}
            </div>
            <div className={styles.nextAction}>
              <span>ขั้นตอนถัดไป</span>
              <strong>{data.decision.nextAction.label}</strong>
              <p>ทบทวนเมื่อ: {data.decision.nextAction.trigger}</p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <p className={styles.sectionNo}>07</p>
              <div>
                <h3>ทะเบียนหลักฐาน</h3>
                <p>แหล่งข้อมูล วันที่ ความสด สิทธิ์การใช้ และ dataset ถูกผูกไว้กับ snapshot เดียวกัน</p>
              </div>
            </div>
            <ol className={styles.sourceList}>
              {data.decision.evidence.map((item, index) => {
                const rights = rightsByEvidence.get(item.id);
                return (
                  <li key={item.id}>
                    <span className={styles.sourceIndex}>S{index + 1}</span>
                    <div>
                      <h4>{item.source}</h4>
                      <p>{item.category} · ข้อมูล ณ {date(item.asOf)} · {FRESHNESS_LABEL[item.freshness] ?? item.freshness}</p>
                      <small>{item.datasetId} · {rights?.reason ?? "ยังไม่ประเมินสิทธิ์สำหรับ request นี้"}</small>
                    </div>
                    {item.sourceRef ? (
                      <a href={item.sourceRef} target="_blank" rel="noreferrer">{hostname(item.sourceRef)} ↗</a>
                    ) : <span className={styles.noLink}>ไม่มีลิงก์</span>}
                  </li>
                );
              })}
            </ol>
          </section>

          <footer className={styles.releaseSection}>
            <div>
              <p className={styles.eyebrow}>Snapshot & release boundary</p>
              <h3>ฉบับนี้บันทึกเพื่อวิจัยแล้ว แต่ยังไม่ใช่สินค้าที่ควรเก็บเงิน</h3>
              <p>
                snapshot {data.snapshot.snapshotId} · {data.decision.protocolVersion} · audit {data.persistence.auditEventId ?? "ยังไม่บันทึก"}
              </p>
            </div>
            <div className={styles.releaseGate}>
              <p><b>Internal gate:</b> {data.releaseGate.allowed ? "ผ่าน" : "ไม่ผ่าน"}</p>
              <p><b>Public / paid gate:</b> {data.decision.release.publicReleaseAllowed ? "ผ่าน" : "ยังไม่ผ่าน"}</p>
              {!data.decision.release.publicReleaseAllowed && (
                <ul>{data.decision.release.blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              )}
            </div>
            <p className={styles.disclosure}>{data.decision.disclosure} · {t("disclaimer")}</p>
          </footer>
        </div>
      )}
    </article>
  );
}
