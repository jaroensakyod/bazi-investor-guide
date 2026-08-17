import type { Metadata } from "next";
import Link from "next/link";
import { PORTFOLIO_LEDGER_SCHEMA_VERSION } from "@/lib/portfolio/portfolio-ledger";
import { DECISION_PROFILE_SCHEMA_VERSION } from "@/lib/profile/decision-profile";
import { buildResearchReadinessAudit } from "@/lib/research/readiness-audit";
import type { ForeignDateEvidenceStatus } from "@/lib/research/foreign-date-coverage-ledger";
import { RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION } from "@/lib/research/research-snapshot-index";
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  DATA_RIGHTS_REGISTRY,
  type DataUse,
  type DatasetRights,
} from "@/lib/trust";
import { MODEL_REGISTRY, type ModelReleaseStatus } from "@/lib/trust/model-registry";
import styles from "./trust.module.css";

export const metadata: Metadata = {
  title: "Trust Center — หลักฐาน ข้อมูล และโมเดล",
  description: "ตรวจ coverage, สิทธิ์ข้อมูล, release gates, model cards และข้อจำกัดของระบบช่วยตัดสินใจลงทุน",
};

const STATUS_LABEL: Record<"ready" | "partial" | "blocked" | "deferred", string> = {
  ready: "พร้อม",
  partial: "พร้อมบางส่วน",
  blocked: "ยังไม่เปิด",
  deferred: "พักไว้ก่อน",
};

const MODEL_STATUS_LABEL: Record<ModelReleaseStatus, string> = {
  production: "Production",
  controlled_preview: "Controlled preview",
  internal_only: "Internal only",
  blocked: "Blocked",
};

const DATA_STATUS_LABEL: Record<DatasetRights["status"], string> = {
  approved: "Approved",
  restricted: "Restricted",
  development_only: "Development only",
  unknown: "Unknown · blocked",
};

const DATA_USE_LABEL: Record<DataUse, string> = {
  internal_research: "วิจัยภายใน",
  derived_metrics: "ตัวชี้วัดที่คำนวณต่อ",
  public_display: "แสดงต่อสาธารณะ",
  paid_report: "รายงานชำระเงิน",
  redistribution: "แจกจ่ายข้อมูลต่อ",
};

const EVIDENCE_STATUS_DETAIL: Record<ForeignDateEvidenceStatus, { label: string; next: string }> = {
  official_date_available: {
    label: "มีวันทางการแล้ว",
    next: "พร้อมใช้เป็นหลักฐานวันเข้าตลาด",
  },
  licensed_source_required: {
    label: "ต้องซื้อหรือทำสัญญาข้อมูล",
    next: "แหล่งสาธารณะหมดช่วงเวลาหรือไม่มีข้อมูลระดับหลักทรัพย์",
  },
  catalog_venue_resolution_required: {
    label: "ต้องยืนยันตลาดที่จด",
    next: "รู้หลักทรัพย์ แต่ยังจับนโยบายแหล่งวันที่กับตลาดปัจจุบันไม่ได้",
  },
  issuer_or_exchange_research_required: {
    label: "ต้องค้นเอกสารบริษัทหรือตลาดเพิ่ม",
    next: "เก็บ announcement, prospectus หรือหน้าประวัติบริษัทแบบรายตัว",
  },
  manual_official_research_required: {
    label: "ต้องเก็บหลักฐานทางการด้วยมือ",
    next: "ต้นทางมีข้อจำกัดบัญชี การค้นหา หรือระบบป้องกันการดึงอัตโนมัติ",
  },
  source_discovery_required: {
    label: "ยังต้องหาแหล่งทางการ",
    next: "ยังไม่มีเส้นทางหลักฐานที่ผ่านนโยบาย",
  },
  provider_candidate_requires_official_verification: {
    label: "มีวันที่ candidate แต่ยังยืนยันไม่ได้",
    next: "ห้ามนำเข้าจนกว่าจะเทียบกับตลาด บริษัท หรือผู้ให้บริการที่มีสิทธิ์",
  },
  official_adapter_no_match: {
    label: "แหล่งทางการมีข้อมูลแต่จับคู่ไม่สำเร็จ",
    next: "แก้ชื่อเดิม share class, ISIN หรือ corporate action แล้วรันใหม่",
  },
  unclassified: {
    label: "ยังไม่จัดหมวด",
    next: "ต้องสร้างเส้นทางหลักฐานก่อนนับว่า workflow ครบ",
  },
};

function number(value: number): string {
  return new Intl.NumberFormat("th-TH").format(value);
}

function coverage(count: number, total: number, pct: number): string {
  return number(count) + " / " + number(total) + " · " + pct.toFixed(2) + "%";
}

function gatesOf(entry: DatasetRights): string {
  const gates = [...new Set(Object.values(entry.requiredGates).flat())];
  return gates.length > 0 ? gates.join(" · ") : "ไม่มี gate เพิ่มเติม";
}

export default function TrustPage() {
  const audit = buildResearchReadinessAudit();
  const globalOfficialMissing = audit.universe.researchableTotal - audit.coverage.officialListingDate.count;
  const foreignOfficialMissing = audit.foreignCoverage.total - audit.foreignCoverage.officialListingDate.count;
  const currentVenue = audit.foreignCoverage.usCurrentVenueIdentity;
  const foreignDateGaps = audit.foreignCoverage.byMarket
    .map((market) => ({
      ...market,
      missing: market.total - market.officialListingDate,
      pct: market.total === 0 ? 0 : Math.round((market.officialListingDate / market.total) * 10_000) / 100,
    }))
    .filter((market) => market.missing > 0)
    .sort((a, b) => b.missing - a.missing || a.market.localeCompare(b.market));
  const evidenceStatusItems = audit.foreignCoverage.evidenceClassification.byStatus
    .filter((item) => item.count > 0 && item.status !== "official_date_available");
  const coverageItems = [
    {
      label: "วันเข้าตลาดทางการ · ทุกตลาด",
      value: coverage(audit.coverage.officialListingDate.count, audit.universe.researchableTotal, audit.coverage.officialListingDate.pct),
      note: `รวมไทยและต่างประเทศ ยังขาด ${number(globalOfficialMissing)} ตัว`,
    },
    {
      label: "เวลาเริ่มซื้อขายที่ยืนยันได้",
      value: coverage(audit.coverage.exactFirstTradeTime.count, audit.universe.researchableTotal, audit.coverage.exactFirstTradeTime.pct),
      note: "ไม่เดาเวลาเปิดตลาดแทนเวลาซื้อขายจริงของหลักทรัพย์",
    },
    {
      label: "ข้อมูลพื้นฐาน · ภายใน/ทดลอง",
      value: coverage(audit.coverage.fundamentals.count, audit.universe.researchableTotal, audit.coverage.fundamentals.pct),
      note: `มีสิทธิ์ใช้ในสินค้าชำระเงิน ${number(audit.coverage.fundamentals.commercialCount)} / ${number(audit.universe.researchableTotal)} ตัว`,
    },
    {
      label: "ประวัติราคารายวัน · ภายใน/ทดลอง",
      value: coverage(audit.coverage.dailyPriceSeries.securities, audit.universe.researchableTotal, audit.coverage.dailyPriceSeries.pct),
      note: `${number(audit.coverage.dailyPriceSeries.files)} canonical files · สิทธิ์ใช้ในสินค้าชำระเงิน ${number(audit.coverage.dailyPriceSeries.commercialSecurities)} / ${number(audit.universe.researchableTotal)} ตัว`,
    },
  ];

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Product Trust · Phase 0</p>
        <h1>เราแสดงทั้งสิ่งที่รู้ สิ่งที่ยังไม่รู้ และเหตุผลที่ยังไม่เปิดใช้</h1>
        <p>
          ข้อมูลตลาดกับ Personal Decision Lens ถูกแยกจากกัน ทุกผลลัพธ์มีแหล่งข้อมูล วันที่
          เวอร์ชัน และเงื่อนไขทบทวน ไม่มีคะแนนดวงที่เปลี่ยน market score
        </p>
        <div className={styles.heroMeta}>
          <span>หลักทรัพย์ในคลัง {number(audit.universe.total)} ตัว</span>
          <span>ใช้วิจัยจริง {number(audit.universe.researchableTotal)} ตัว</span>
          <span>Trading aliases {number(audit.universe.tradingAliases)} รหัส (ไม่นับซ้ำ)</span>
          <span>{audit.universe.markets} ตลาด</span>
          <time dateTime={audit.generatedAt}>
            ตรวจสถานะ {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(audit.generatedAt))}
          </time>
        </div>
      </header>

      <section className={styles.principles} aria-labelledby="trust-principles">
        <div>
          <p className={styles.sectionNo}>01</p>
          <h2 id="trust-principles">คำมั่นด้านความโปร่งใส</h2>
        </div>
        <ol>
          <li><b>หลักฐานตลาดมาก่อนคำอธิบาย</b><span>AI ไม่มีสิทธิ์สร้างตัวเลข แหล่งข้อมูล หรือความแน่นอนที่ต้นทางไม่มี</span></li>
          <li><b>BaZi เป็นเลนส์สะท้อนพฤติกรรม</b><span>ไม่เปลี่ยน market status, score หรือสร้างสัญญาณทำธุรกรรม</span></li>
          <li><b>ไม่พร้อมคือไม่เปิด</b><span>ข้อมูล development-only, สิทธิ์ไม่ชัด หรือโมเดลไม่ผ่าน gate จะถูกปิดใน production</span></li>
          <li><b>ทุกครั้งตรวจย้อนกลับได้</b><span>Decision Object และ ResearchSnapshot มี content hash, model version และ as-of</span></li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="coverage-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>02</p>
          <div>
            <h2 id="coverage-title">Data coverage ตามความจริง</h2>
            <p>แยก “มีวันที่จริง” ออกจาก “จัดเส้นทางทำงานครบ” เพื่อไม่ใช้คำว่า 100% เกินหลักฐาน</p>
          </div>
        </div>
        <div className={styles.coverageVerdict}>
          <article className={styles.verdictFact}>
            <p>วันที่ทางการที่มีจริง · หุ้นต่างประเทศ</p>
            <strong>{audit.foreignCoverage.officialListingDate.pct.toFixed(2)}%</strong>
            <span>
              {number(audit.foreignCoverage.officialListingDate.count)} / {number(audit.foreignCoverage.total)} ตัว
              · ยังขาด {number(foreignOfficialMissing)}
            </span>
            <progress
              aria-label="สัดส่วนหุ้นต่างประเทศที่มีวันเข้าตลาดจากหลักฐานทางการ"
              max={audit.foreignCoverage.total}
              value={audit.foreignCoverage.officialListingDate.count}
            />
          </article>
          <article className={styles.verdictWorkflow}>
            <p>หุ้นที่มีสถานะและเส้นทางหลักฐานครบ</p>
            <strong>{audit.foreignCoverage.evidenceClassification.pct.toFixed(2)}%</strong>
            <span>
              {number(audit.foreignCoverage.evidenceClassification.count)} / {number(audit.foreignCoverage.total)} ตัว
              · ไม่จัดหมวด {number(audit.foreignCoverage.evidenceClassification.unclassified)}
            </span>
            <progress
              aria-label="สัดส่วนหุ้นต่างประเทศที่จัดสถานะเส้นทางหลักฐานครบ"
              max={audit.foreignCoverage.total}
              value={audit.foreignCoverage.evidenceClassification.count}
            />
          </article>
        </div>
        <p className={styles.coverageDefinition}>
          <b>นิยาม 100% ของเฟสนี้:</b> ทุกหลักทรัพย์มีสถานะปลายทางที่ตรวจย้อนหลังได้
          ไม่ใช่มีวันเข้าตลาดครบทุกตัว และไม่ใช่มีเวลาเริ่มซื้อขายครบ
        </p>
        <div className={styles.coverageGrid}>
          {coverageItems.map((item) => (
            <article key={item.label} className={styles.coverageItem}>
              <h3>{item.label}</h3>
              <strong>{item.value}</strong>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
        <div className={styles.coverageTruth}>
          <div>
            <p className={styles.truthLabel}>สิ่งที่ระบบทำสำเร็จแล้ว</p>
            <h3>ปิดรายการไม่ทราบสถานะเหลือ 0 ตัว</h3>
            <p>
              วันที่ยังขาดทั้ง {number(foreignOfficialMissing)} ตัวถูกแจกแจงครบว่าแก้ด้วยแหล่งสาธารณะ
              งานค้นเอกสารรายตัว หรือสัญญาข้อมูล ไม่มีรายการใดถูกนับเป็นวันทางการจากการคาดเดา
            </p>
          </div>
          <p className={styles.truthRule}>
            วันทางการจริงคือ {number(audit.foreignCoverage.officialListingDate.count)} ตัว หรือ {audit.foreignCoverage.officialListingDate.pct.toFixed(2)}%
            — ตัวเลขนี้เท่านั้นที่ใช้บอก date coverage
          </p>
        </div>
        <div className={styles.venueIntegrity}>
          <div>
            <p className={styles.truthLabel}>US venue integrity</p>
            <h3>ยืนยันตลาดปัจจุบัน {number(currentVenue.count)} / {number(currentVenue.usCatalog)} ตัว</h3>
            <p>
              ใช้ Official Nasdaq Symbol Directory เพื่อแยกข้อมูลเดิมที่เขียนรวม NYSE/NASDAQ
              โดยไม่อ้างว่าไฟล์นี้ให้วันเข้าตลาด
            </p>
          </div>
          <dl>
            <div>
              <dt>Coverage ตลาดปัจจุบัน</dt>
              <dd>{currentVenue.pctOfUsCatalog.toFixed(2)}%</dd>
            </div>
            <div>
              <dt>กลุ่มเดิม NYSE/NASDAQ</dt>
              <dd>{number(currentVenue.legacyCombinedResolved)} / {number(currentVenue.legacyCombinedCatalog)}</dd>
            </div>
            <div>
              <dt>ยังไม่ยืนยัน</dt>
              <dd>{number(currentVenue.unresolved)}</dd>
            </div>
            <div>
              <dt>พบตลาดเปลี่ยนจาก catalog</dt>
              <dd>{number(currentVenue.exchangeMismatch)}</dd>
            </div>
          </dl>
        </div>
        <div className={styles.coverageDetails}>
          <div className={styles.tableWrap}>
            <table className={`${styles.gateTable} ${styles.coverageTable}`}>
              <caption>
                ตลาดต่างประเทศที่ยังมีช่องว่าง เรียงจากจำนวนที่ขาดมากที่สุด
                <span className={styles.mobileTableHint}>เลื่อนซ้าย–ขวาเพื่อดูจำนวนที่ขาดและ Coverage</span>
              </caption>
              <thead>
                <tr>
                  <th scope="col">ตลาด</th>
                  <th scope="col">มีวันทางการ</th>
                  <th scope="col">ยังขาด</th>
                  <th scope="col">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {foreignDateGaps.map((market) => (
                  <tr key={market.market}>
                    <th scope="row">{market.market}</th>
                    <td>{number(market.officialListingDate)} / {number(market.total)}</td>
                    <td><strong className={styles.missingCount}>{number(market.missing)}</strong></td>
                    <td>{market.pct.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className={styles.evidenceBreakdown} aria-labelledby="evidence-breakdown-title">
            <h3 id="evidence-breakdown-title">แผนปิดช่องว่าง {number(foreignOfficialMissing)} ตัว</h3>
            <p>ยอดทุกหมวดรวมกันเท่ากับวันที่ยังขาด ไม่มีตัวเลขซ่อนในคำว่า “กำลังทำ”</p>
            <dl>
              {evidenceStatusItems.map((item) => (
                <div key={item.status}>
                  <dt>
                    <b>{EVIDENCE_STATUS_DETAIL[item.status].label}</b>
                    <span>{EVIDENCE_STATUS_DETAIL[item.status].next}</span>
                  </dt>
                  <dd>
                    <strong>{number(item.count)}</strong>
                    <span>{item.pct.toFixed(2)}%</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className={styles.evidenceTotal}>
              เป้าหมายเชิงพาณิชย์ถัดไปคือแก้กลุ่มที่ต้องมีสัญญาข้อมูลก่อน เพราะเป็นช่องว่างใหญ่ที่สุด
            </p>
          </aside>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="gates-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>03</p>
          <div>
            <h2 id="gates-title">Release gates</h2>
            <p>ฟังก์ชันจะไม่เลื่อนสถานะด้วยการตัดสินใจทางการตลาดเพียงอย่างเดียว</p>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.gateTable}>
            <caption>สถานะ gate จาก research readiness audit ล่าสุด</caption>
            <thead>
              <tr>
                <th scope="col">Gate</th>
                <th scope="col">สถานะ</th>
                <th scope="col">หลักฐานสถานะ</th>
              </tr>
            </thead>
            <tbody>
              {audit.gates.map((gate) => (
                <tr key={gate.id}>
                  <th scope="row">{gate.id}</th>
                  <td><span className={styles["status_" + gate.status]}>{STATUS_LABEL[gate.status]}</span></td>
                  <td>{gate.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="data-rights-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>04</p>
          <div>
            <h2 id="data-rights-title">Data-rights registry</h2>
            <p>ระบบแยกคำว่า “มีข้อมูล” ออกจาก “มีสิทธิ์ใช้” และปิดการใช้ใน production เมื่อยังระบุสิทธิ์ไม่ได้</p>
          </div>
        </div>
        <div className={styles.rightsGrid} aria-labelledby="data-rights-title">
          {DATA_RIGHTS_REGISTRY.map((entry) => (
            <article key={entry.datasetId} className={styles.rightsCard}>
              <div className={styles.rightsTitle}>
                <div>
                  <h3>{entry.datasetId}</h3>
                  <p>{entry.provider}</p>
                </div>
                <span className={styles["dataStatus_" + entry.status]}>{DATA_STATUS_LABEL[entry.status]}</span>
              </div>
              <dl>
                <div><dt>อนุญาต</dt><dd>{entry.allowedUses.map((use) => DATA_USE_LABEL[use]).join(" · ") || "ยังไม่มี"}</dd></div>
                <div><dt>ห้าม</dt><dd>{entry.prohibitedUses.map((use) => DATA_USE_LABEL[use]).join(" · ") || "ไม่ระบุ"}</dd></div>
                <div><dt>ต้องผ่าน</dt><dd>{gatesOf(entry)}</dd></div>
              </dl>
              <p className={styles.rightsNote}>{entry.notes[0]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="models-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>05</p>
          <div>
            <h2 id="models-title">Model cards</h2>
            <p>แต่ละโมเดลต้องระบุว่าใช้ทำอะไร ห้ามทำอะไร ตรวจอย่างไร และยังมีข้อจำกัดอะไร</p>
          </div>
        </div>
        <div className={styles.modelList}>
          {MODEL_REGISTRY.map((model) => (
            <article key={model.version} className={styles.modelCard}>
              <div className={styles.modelTitle}>
                <div>
                  <h3>{model.name}</h3>
                  <code>{model.version}</code>
                </div>
                <span>{MODEL_STATUS_LABEL[model.releaseStatus]}</span>
              </div>
              <div className={styles.modelColumns}>
                <div><h4>ใช้สำหรับ</h4><ul>{model.intendedUse.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h4>ห้ามใช้</h4><ul>{model.prohibitedUse.map((item) => <li key={item}>{item}</li>)}</ul></div>
                <div><h4>ข้อจำกัด</h4><ul>{model.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
              </div>
              <p className={styles.modelMeta}>Owner: {model.owner} · reviewed {model.reviewedAt}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="contracts-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionNo}>06</p>
          <div>
            <h2 id="contracts-title">Decision system contracts</h2>
            <p>ฐานข้อมูลสำคัญมี schema version, validation และตัวตนจาก content hash ก่อนต่อเป็น UI หรือ PDF</p>
          </div>
        </div>
        <div className={styles.contractGrid}>
          <article className={styles.contractCard}>
            <code>decision-profile-v{DECISION_PROFILE_SCHEMA_VERSION}</code>
            <h3>Financial readiness & consent</h3>
            <p>เก็บข้อเท็จจริง เป้าหมาย ข้อจำกัด และ consent แยกกัน โดยเก็บ chartHash แทนข้อมูลเกิดดิบเมื่อทำได้</p>
          </article>
          <article className={styles.contractCard}>
            <code>portfolio-ledger-v{PORTFOLIO_LEDGER_SCHEMA_VERSION}</code>
            <h3>Transaction-based portfolio</h3>
            <p>คำนวณเงินสด ต้นทุนเฉลี่ย กำไรขาดทุน และ corporate action จาก ledger ที่ตรวจสอบย้อนหลังได้</p>
          </article>
          <article className={styles.contractCard}>
            <code>snapshot-index-v{RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION}</code>
            <h3>History & material delta</h3>
            <p>เก็บ snapshot แบบ content-addressed และเปรียบเทียบสถานะ ความเสี่ยง หลักฐาน และเวอร์ชันกับครั้งก่อน</p>
          </article>
          <article className={styles.contractCard}>
            <code>audit-event-v{AUDIT_EVENT_SCHEMA_VERSION}</code>
            <h3>Append-only audit chain</h3>
            <p>ทุก event เชื่อมด้วย hash และห้าม metadata ที่เสี่ยงเก็บ PII ดิบ; file store ปัจจุบันเป็น single-process preview</p>
          </article>
        </div>
      </section>

      <section className={styles.boundary} aria-labelledby="boundary-title">
        <p className={styles.sectionNo}>07</p>
        <div>
          <h2 id="boundary-title">ขอบเขตการใช้งานปัจจุบัน</h2>
          <p>
            ระบบอยู่ใน research-only operating model จึงไม่ออกคำสั่งเฉพาะบุคคล ไม่อ้างจุดสูงสุด
            และไม่เปิด probabilistic forecast ต่อสาธารณะจนกว่าจะผ่าน model, data-rights และ legal gate
          </p>
          <div className={styles.links}>
            <Link href="/legal?p=disclaimer">อ่านข้อจำกัดและความเสี่ยง</Link>
            <Link href="/report">ดูหน้ารายงานปัจจุบัน</Link>
          </div>
        </div>
      </section>
    </article>
  );
}
