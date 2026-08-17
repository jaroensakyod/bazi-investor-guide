# Platform Core First — แผนทำระบบให้ครบก่อนกลับไปทำ PDF

> วันที่ตัดสินใจ: 8 สิงหาคม 2569  
> สถานะ: **Canonical product/engineering plan สำหรับงานถัดไป**  
> หลักการ: PDF เป็นปลายทางแสดงผล ไม่ใช่แกนผลิตภัณฑ์ จึงพักงานเพิ่มหน้า ภาพ และรูปเล่มจนกว่า data/research/compliance gates จะผ่าน
>
> ผล pilot ล่าสุด: [`security-data-pilot-th10-2026-08-08.md`](./security-data-pilot-th10-2026-08-08.md)
>
> ผลขยายหุ้นไทยล่าสุด: [`thai-research-data-foundation-2026-08-08.md`](./thai-research-data-foundation-2026-08-08.md)

## 1. ข้อสรุปผู้บริหาร

ระบบควรถูกสร้างเป็น **Research & Risk Intelligence Platform** ก่อน แล้วจึงนำ snapshot เดียวกันไปแสดงบนเว็บ แชท และ PDF

คำถามที่ระบบต้องตอบได้อย่างซื่อสัตย์มี 5 ข้อ:

1. หลักทรัพย์นี้คืออะไร ข้อมูลมาจากไหน และสดแค่ไหน
2. ธุรกิจและฐานะทางการเงินมีจุดแข็ง จุดอ่อน และข้อมูลขาดอะไร
3. ราคาในอดีตอยู่ในภาวะแนวโน้ม/ผันผวนแบบใด และโมเดลเคยแม่นกว่าฐานเปรียบเทียบหรือไม่
4. หลักทรัพย์นี้ทำหน้าที่อะไรในพอร์ตและเพิ่มความเสี่ยงตรงไหน
5. ความเข้ากันตาม BaZi สะท้อนพฤติกรรมอะไร โดยไม่ถูกนำไปเปลี่ยนคะแนนตลาดหรือออกคำสั่งซื้อขาย

ระบบปัจจุบัน **จะไม่** อ้างว่ารู้จุดสูงสุด ไม่ออกคำสั่ง “ซื้อ/ขายตอนนี้” และไม่ใช้ดวงเป็นเหตุให้ทำธุรกรรม หากต้องการฟังก์ชันดังกล่าวในอนาคต ต้องดำเนินงานภายใต้ผู้ประกอบธุรกิจที่ได้รับอนุญาตและผ่าน legal/model governance ก่อน

## 2. ตัวเลขจริงของระบบ ณ วันที่วางแผน

รัน `npm run research:audit` เพื่อสร้างตัวเลขใหม่ได้ทุกเครื่อง

| รายการ | สถานะปัจจุบัน |
|---|---:|
| หลักทรัพย์ใน catalog | 6,229 |
| หลักทรัพย์ปัจจุบันที่เข้า research ได้ | 6,223 (ตัด inactive/alias 6) |
| หุ้นไทย | 265 ปัจจุบัน / 271 แถวใน catalog |
| หุ้นต่างประเทศ | 5,958 |
| ตลาด/venue codes | 29 |
| มีราคาล่าสุด | 5,284 / 6,223 (84.91%) |
| มี fundamentals ใช้ประเมินได้ | 342 / 6,223 (5.50%); หุ้นไทย 265/265 |
| มีวันกำเนิดนิติบุคคล/ผู้สืบทอดแบบ exact date | 217 / 6,223 (3.49%); หุ้นไทย 217/265 |
| มีวันเข้าตลาดจากหลักฐานทางการ | 265 / 6,223 (4.26%); หุ้นไทย 265/265 |
| มีเวลา first trade ที่ยืนยันได้ | 0 / 6,223 |
| มี EOD series สำหรับ pattern/backtest | 265 / 6,223 (4.26%); หุ้นไทย 265/265 |
| หุ้นไทยพร้อม pattern ขั้นต่ำ 252 sessions | 262/265 (98.87%) |

สำหรับหุ้นไทยปัจจุบัน official listing/fundamentals/EOD ครบ 265/265, fundamentals core ≥3 fields 263/265, company origin exact 217/265 และ pattern-ready 262/265; ใช้พื้นที่ EOD gzip รวมประมาณ 4.32 MiB อย่างไรก็ตามข้อมูล Yahoo ยังเป็น development-only และสิทธิ์แสดงข้อมูล SET เชิงพาณิชย์ยังไม่ยืนยัน จึงผ่านเฉพาะ development gate ไม่ผ่าน commercial gate

ดังนั้นการสร้าง PDF เพิ่มตอนนี้จะขยาย presentation ของข้อมูลที่ยังไม่พร้อม แกนข้อมูลต้องมาก่อน

## 3. Product boundary ที่ล็อกแล้ว

### 3.1 สิ่งที่ทำใน research-only mode

- ข้อเท็จจริงย้อนหลัง พร้อม source/as-of/freshness
- หน้าข้อมูลบริษัทและหลักทรัพย์
- Fundamental screen แบบเกณฑ์เดียวกันทุกคน
- Pattern observation จากราคาในอดีต
- Historical scenario range ที่ระบุชัดว่าไม่ใช่ forecast
- Alert จากเกณฑ์ราคาหรือความเสี่ยงที่ผู้ใช้ตั้งเอง
- Portfolio diagnostics และ stress scenario
- BaZi compatibility เป็นกล่องแยก ใช้ด้าน reflection/behavior เท่านั้น

### 3.2 สิ่งที่พัก/บล็อก

- Personalized buy/sell/hold
- ราคาซื้อ ราคาขาย หรือเป้าราคาเฉพาะคน
- การอ้างว่าทำนายจุดสูงสุดได้
- การนำ BaZi ไปจัดอันดับตลาดหรือออก trade signal
- Auto execution หรือเชื่อมส่งคำสั่ง broker
- Public probabilistic forecast ก่อนผ่าน out-of-sample validation และ legal review

ข้อจำกัดนี้ถูกทำเป็น code gate ใน `src/lib/research/research-policy.ts` ไม่ได้พึ่ง disclaimer เพียงอย่างเดียว

## 4. สถาปัตยกรรมเป้าหมาย

```text
Official/licensed sources
        │
        ▼
Security Master + Evidence Registry
        │
        ├── Company fundamentals
        ├── Shared adjusted EOD series
        ├── Corporate actions
        └── Listing/first-trade events
        │
        ▼
Deterministic Research Engines
        ├── data quality
        ├── fundamental/peer analysis
        ├── pattern observation
        ├── walk-forward evaluation
        ├── portfolio risk
        └── user-authored alerts
        │
        ├──────────► BaZi symbolic compatibility (separate; weight = 0)
        │
        ▼
Immutable ResearchSnapshot + model/source versions
        │
        ├── Web/API
        ├── Chat explanation
        └── PDF (ทำทีหลังจาก snapshot เดียวกัน)
```

## 5. ฟังก์ชันหลักและสถานะ

| Domain | Function | สถานะ | Source of truth |
|---|---|---|---|
| Security identity | แยกบริษัท/หุ้น/ADR/cross-listing ด้วย `MARKET:TICKER` | Foundation พร้อม | `src/lib/research/security-birth.ts` |
| Security events | เลือก incorporation/admission/first trade พร้อม A–D confidence | หุ้นไทยปัจจุบันมี official listing 265/265; company origin exact 217/265 | `data/security-events.json` |
| Time uncertainty | ไม่เติมเวลาเอง; date-only ใช้ 12-window sensitivity | พร้อม | `resolveSecurityBirth()` |
| Time-series storage | เก็บ gzip ชุดเดียวต่อ security/timeframe/adjustment | พร้อม | `price-series-store.ts` |
| Retention | EOD เก็บยาว; intraday จำกัด 90–730 วัน | พร้อมเป็น policy | `price-series.ts` |
| Pattern | SMA/ATR/volatility/drawdown/support/resistance/regime | พร้อม | `pattern-engine.ts` |
| Historical scenarios | ช่วงผลตอบแทนในอดีต 5/20/60 sessions | พร้อม; ห้ามเรียก forecast | `pattern-engine.ts` |
| Backtest | Walk-forward ไม่มี look-ahead + เทียบ baseline | พร้อม | `evaluateTrendObservationModel()` |
| Research assessment | Fundamental evidence + pattern + data quality | พร้อม v1 | `stock-research.ts` |
| BaZi separation | ความเข้ากันเชิงสัญลักษณ์ ไม่รวม market score | พร้อม | `bazi-compatibility.ts` |
| User alerts | ตรวจและประเมินเงื่อนไขที่ผู้ใช้ตั้งเอง | rule engine พร้อม; persistence/UI อยู่ Phase E | `user-alerts.ts` |
| Compliance | capability gate + public-language validator | พร้อม foundation | `research-policy.ts` |
| Research API | snapshot รายหุ้น; BaZi เป็น optional separate block | พร้อมสำหรับ dev/internal; production ปิดไว้ | `GET /api/research` |
| Generic research screen | คัดกรองแบบเดียวกันทุกคนและไม่ใช้ BaZi | พร้อม foundation; production ปิดไว้ | `GET /api/research-screen` |
| Immutable snapshot | ล็อก input/source/model/rule versions ด้วย content hash | พร้อม | `research-snapshot.ts` |
| Data readiness | audit coverage/gates ทุกเครื่อง | พร้อม | `npm run research:audit` |
| SET evidence staging | batch factsheet + retry/checkpoint/hash/conflict protection | พร้อม; หุ้นไทยปัจจุบัน 265/265 พร้อม curated override | `npm run research:stage-set-events` |
| Development history adapter | ดึงข้อมูลทดลองเข้า canonical store | พร้อม; หุ้นไทย EOD 265/265 สำหรับ development เท่านั้น | `npm run research:seed-thai-history` |
| Licensed data ingest | provider + commercial contract | **ยังไม่พร้อม** | ต้องเลือก provider |
| Peer valuation | เทียบ sector/country/currency อย่างถูกต้อง | **ยังไม่พร้อม** | Phase ถัดไป |
| Portfolio ownership/auth | ผู้ใช้เห็นเฉพาะข้อมูลตน | มีเฉพาะ report foundation | ต้องทำ database/auth ต่อ |
| PDF | render จาก canonical snapshot | **พัก** | ทำหลัง core gates |

## 6. นโยบายวันและเวลา “เกิดหุ้น”

ระบบเก็บ event หลายชนิดโดยไม่ปะปน:

- `incorporation`: วันเกิดนิติบุคคล ใช้เป็นบริบทธุรกิจ
- `exchange_admission`: วันที่ตลาดรับเข้า
- `first_trading_day`: วันเริ่มซื้อขาย
- `first_trade`: timestamp ของรายการซื้อขายแรกที่ตรวจสอบได้
- `relisting` / `merger_successor`: เหตุการณ์ที่สร้างสายหลักทรัพย์ใหม่

ระดับความเชื่อมั่น:

| Grade | เกณฑ์ | การใช้งาน |
|---|---|---|
| A | exact first-trade time + official/licensed verified source | วิเคราะห์ครบได้ |
| B | official listing/first-trading date แต่เวลาไม่ยืนยัน | ใช้ระดับวัน + sensitivity 12 ช่วง |
| C | incorporation/secondary context | ใช้เป็นบริบทธุรกิจเท่านั้น |
| D | ไม่มีหลักฐาน | ใช้เฉพาะธาตุธุรกิจ |

ห้ามตั้ง 09:30, 12:00 หรือเวลาเปิดตลาดเป็นค่า default เพราะ IPO สามารถ first trade หลังเวลาเปิดตลาดได้

## 7. นโยบายข้อมูลกราฟเพื่อไม่ให้ storage บวม

1. เก็บข้อมูลราคาเพียงชุดเดียวต่อ `securityId + timeframe + adjustment`
2. ไม่เก็บประวัติราคาแยกตามผู้ใช้หรือรายงาน
3. ไม่เก็บ PNG/SVG/PDF ของกราฟเป็น source of truth; วาดใหม่จาก series
4. EOD ใช้ adjusted series และเก็บยาว
5. 1-minute เก็บเฉพาะ universe ที่จำเป็น 90 วัน; aggregate แล้วจึงลบตาม retention
6. ผลโมเดลเก็บเฉพาะ version, input hash, metrics และ audit checkpoint
7. Walk-forward event รายจุดไม่ถูกเก็บโดยค่าเริ่มต้น (`includeEvents=false`)

## 8. ลำดับพัฒนาก่อน PDF

### Phase A — Safety/Core Contract (ทำแล้วในรอบนี้)

- Security event schema และ confidence A–D
- Shared compressed series store
- Pattern observation และ walk-forward evaluation
- Research assessment ที่ไม่รวม BaZi
- User-authored alerts
- Compliance capability/text gates
- Research API และ readiness audit

### Phase B — Data licence + Pilot Universe (ทำต่อทันที)

1. เลือก provider ที่อนุญาต commercial display/derived analytics
2. กำหนด corporate-action adjustment และ ticker history
3. ทำ pilot universe 100–200 หลักทรัพย์ที่ผู้ใช้สนใจจริง
4. เติม official first-trading date ให้ pilot ≥90%
5. เติม adjusted EOD อย่างน้อย 5 ปีให้ pilot ≥98%
6. เก็บ provenance ทุก metric/event

ไม่ควรเริ่มด้วย 6,230 ตัวพร้อมกัน เพราะจะเสียเวลาและค่า data กับหุ้นที่ไม่มีผู้ใช้

### Phase C — Research Quality

- เพิ่มงบย้อนหลังหลายปี ไม่ใช้ snapshot ไตรมาสเดียว
- สร้างกฎเฉพาะอุตสาหกรรม โดยเฉพาะธนาคาร/ประกัน/REIT
- ทำ peer-normalized valuation ตาม sector, market และ currency
- เพิ่ม liquidity, corporate action และ survivorship-bias checks
- ให้ analyst review ตัวอย่างทุกตลาด

### Phase D — Pattern/Model Validation

- Walk-forward ต่อหุ้นและ market regime
- แยก train/validation/test ตามเวลา
- เทียบ simple baseline และ transaction-cost assumptions
- ตรวจ sample size, coverage, calibration และ model drift
- เก็บ model card/version ทุก release
- Forecast ยังคง internal จนผ่าน legal review

### Phase E — Portfolio/User System

- Database, auth, consent และ ownership
- Holdings/transactions import
- Concentration, sector/currency/country risk
- Goal/cash-flow/risk capacity จาก finance engine เดิม
- Alert ที่ผู้ใช้ตั้งเอง และ decision journal
- Audit log และ immutable ResearchSnapshot

### Phase F — Commerce แล้วจึง PDF

- Product/order/entitlement/payment
- Tier manifest ฝั่ง server
- สร้าง web report จาก ResearchSnapshot
- ทดสอบคุณค่าและความถูกต้องกับ pilot users
- สุดท้ายจึงสร้าง PDF renderer จาก View Model เดียวกัน

## 9. Value ladder ที่ไม่พึ่งการเพิ่มจำนวนหน้า

| Tier | คุณค่าหลักของระบบ | สิ่งที่ไม่ควรใช้เป็นตัวต่าง |
|---|---|---|
| Free | ข้อมูลบริษัท, data quality, risk snapshot, ความรู้และ user alert ขั้นพื้นฐาน | หน้าล็อกจำนวนมาก |
| ฿99 | Research dossier ลึกขึ้น, historical context, checklist และ journal | ภาษาสั่งซื้อขาย |
| ฿490 | Portfolio diagnostics, goal/risk capacity, stress scenarios, deep research queue | BaZi เพิ่มคะแนนหุ้น |
| ฿790 | Baseline + monthly delta, portfolio drift, evidence changes และ analyst-reviewed dossier | สัญญาว่าหาจุดสูงสุด |

รายละเอียด tier ต้องผ่าน legal review อีกครั้งก่อนเปิดขาย เพราะ paid ranking/forecast อาจมีผลต่อการตัดสินใจลงทุนแม้ไม่ใช้คำว่า “ซื้อ”

## 10. Definition of Done ก่อนกลับไปทำ PDF

ต้องผ่านทั้งหมด:

- [ ] เลือก market-data provider และมีสิทธิ์ commercial use/derived display ชัดเจน
- [ ] Pilot universe ถูกนิยามและมี stable security IDs
- [ ] Official first-trading date coverage ≥90% ของ pilot
- [ ] Adjusted EOD coverage ≥98% และอย่างน้อย 5 ปีเมื่อหลักทรัพย์มีอายุพอ
- [ ] Fundamentals coverage ≥80% ของ metrics ที่จำเป็นตาม sector
- [ ] Corporate actions และ ticker changes ตรวจย้อนหลังได้
- [ ] Pattern model ผ่าน walk-forward และไม่แย่กว่า baseline
- [ ] BaZi มีน้ำหนัก 0 ใน market score และไม่มี trade-action language
- [ ] Public output ผ่าน compliance text validator
- [ ] Legal review exact flow/copy/business model เสร็จ
- [ ] User/report ownership และ isolation tests ผ่าน
- [ ] ResearchSnapshot มี source/as-of/model/rule versions ครบ
- [ ] Pilot users เข้าใจผลลัพธ์และให้คะแนนประโยชน์ ≥4/5

เมื่อครบจึงเริ่ม PDF โดย renderer ต้องอ่าน ResearchSnapshot เท่านั้น ห้ามคำนวณใหม่หรือเรียก LLM ในเส้นทางส่งมอบ

## 11. คำสั่งตรวจระบบ

```powershell
npm.cmd run research:audit
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Baseline หลังเพิ่ม core foundation รอบนี้:

- TypeScript ผ่าน
- 39 test files ผ่าน
- 261 tests ผ่าน
- Next.js production build ผ่าน
- runtime smoke ผ่านทั้ง API โดยตรงที่ `:8787` และ Next proxy ที่ `:3000`
- global lint ยังติด 18 errors / 1 warning ในไฟล์เดิมนอก research core; แยกเป็นงาน cleanup ไม่ใช่ release gate ที่ผ่านแล้ว

## 12. การตัดสินใจที่ต้องใช้เจ้าของธุรกิจ/ผู้เชี่ยวชาญภายนอก

โค้ดทำต่อได้โดยไม่รอในส่วน schema/adapter/tests แต่ production จะติด 3 เรื่องที่ต้องตัดสินใจ:

1. **Data provider และงบ** — EOD/fundamentals/corporate actions/redistribution rights
2. **Legal operating model** — research-only ต่อ หรือ partner/license สำหรับ personalized advisory
3. **Pilot universe** — หุ้น 100–200 ตัวแรกที่สอดคล้องกับลูกค้าจริง

จนกว่าสามข้อข้างต้นชัดเจน ระบบควรพัฒนาด้วยข้อมูล development และไม่เปิด paid stock ranking/forecast ต่อสาธารณะ

## 13. แหล่งอ้างอิงกำกับดูแลที่ใช้กำหนด product boundary

- [ก.ล.ต. — Responsible Voices สำหรับ Finfluencer (3 มิ.ย. 2568)](https://www.sec.or.th/TH/Template3/Articles/2568/030668.pdf) ระบุให้ระวังการบอกจังหวะซื้อขาย การคาดการณ์ราคารายตัว คำแนะนำเฉพาะบุคคล และการจัด ranking/rating
- [ฐานกฎหมาย ก.ล.ต. — กธ. 1/2560 เรื่องลักษณะการให้คำแนะนำแก่ประชาชน](https://law.sec.or.th/content/3542/5726/1) ใช้เป็นจุดเริ่มตรวจตัวบทและประกาศที่เกี่ยวข้อง

ขอบเขตในเอกสารนี้เป็น **engineering/product risk boundary ไม่ใช่ความเห็นทางกฎหมาย** ต้องให้ทนายตลาดทุนตรวจเวอร์ชันกฎหมายล่าสุด รวมถึง flow, copy, tier และรูปแบบรายได้จริงก่อนเปิด production
