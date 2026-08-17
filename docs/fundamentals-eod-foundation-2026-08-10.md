# Fundamentals + EOD Foundation — 2026-08-10

เอกสารนี้เป็นสถานะ canonical สำหรับย้ายเครื่องและทำงานต่อ หลังปิดฐานข้อมูลวิจัยไทยและตลาดสหรัฐรอบแรกแล้ว

## ผลลัพธ์ที่ทำเสร็จ

| Coverage | ก่อนรอบนี้ | หลังรอบนี้ | หมายเหตุ |
|---|---:|---:|---|
| Fundamentals ใช้ประเมินได้ / ทั้งระบบ | 351 / 6,142 (5.71%) | 1,424 / 6,142 (23.18%) | นับเมื่อมี field ใช้งานได้จริง ไม่ได้นับเพียง API response |
| Fundamentals core ≥3 fields / ทั้งระบบ | 349 / 6,142 (5.68%) | 1,374 / 6,142 (22.37%) | core = ROE, profit margin, revenue growth, D/E |
| EOD / ทั้งระบบ | 275 / 6,142 (4.48%) | 1,359 / 6,142 (22.13%) | 5 ปี, daily, total-return adjustment เมื่อ provider มี |
| Fundamentals / ตลาดสหรัฐ | 20 / 1,094 (1.83%) | 1,093 / 1,094 (99.91%) | เหลือ FISV 1 ตัวเป็น provider gap |
| EOD / ตลาดสหรัฐ | 10 / 1,094 (0.91%) | 1,094 / 1,094 (100%) | 1,090 ตัวมีแท่งล่าสุดตาม freshness; อีก 4 ตัวตรวจ provider ล่าสุดแล้วแต่ไม่มีแท่งใหม่ |
| Commercial-eligible Fundamentals/EOD | 0 | 0 | Yahoo ยังเป็น development-only; ห้ามใช้ paid/public PDF |

หุ้นไทยปัจจุบันยังคงครบ Fundamentals 265/265 และ EOD 265/265 ส่วนตลาดสหรัฐมี core fundamentals 1,045/1,094 (95.52%) และ pattern-ready อย่างน้อย 1,050/1,094 (95.98%)

## พื้นที่จัดเก็บ

- EOD 1,359 ไฟล์ = 37,041,831 bytes หรือประมาณ 35.3 MiB
- Fundamentals cache = 728,618 bytes หรือประมาณ 0.69 MiB
- ถ้าขนาดเฉลี่ยต่อหลักทรัพย์คงเดิม การเก็บ EOD ครบ 6,142 ตัวจะอยู่ราว 160 MiB ไม่ใช่ฐานข้อมูลขนาดใหญ่
- เก็บหนึ่ง gzip ต่อ `securityId + timeframe + adjustment` และ merge ตาม timestamp จึงไม่สร้างกราฟหรือประวัติราคาซ้ำต่อผู้ใช้

## สิ่งที่เพิ่มในระบบ

1. `scripts/fetch-fundamentals.ts`
   - batch ตาม ticker/market/country
   - priority ตามขนาด/สภาพคล่อง
   - refresh window, retry, checkpoint, dry-run และ cooldown สำหรับ no-data/failed
   - ไม่เขียนทับข้อมูล commercial ด้วย Yahoo

2. `scripts/fetch-price-history.ts`
   - batch EOD, concurrency จำกัด, incremental overlap, retry และ resume
   - ป้องกัน global unbounded fetch
   - แยก `fresh endAt` ออกจาก `recently checked` สำหรับหุ้นพักการซื้อขาย
   - แก้ US class/preferred ticker เช่น `BRK.B → BRK-B`, `BAC/PB → BAC-PB`

3. `src/lib/research/market-data-batch.ts`
   - target selector และ deterministic priority
   - atomic operational ledger ที่ `data/staging/research-market-fetch-ledger.json`
   - retry/backoff และ cooldown

4. `scripts/research-market-coverage.ts`
   - snapshot แยก market/country, usable/core/fresh/pattern-ready และ commercial-eligible
   - output ปัจจุบัน: `data/staging/research-market-coverage.json`

5. Issuer-level fundamentals
   - financial statements เป็นข้อมูลระดับบริษัทผู้ออก ไม่ใช่ ratio เฉพาะหุ้นบุริมสิทธิ
   - alias ที่ review แล้วอยู่ใน `data/curated/fundamentals-issuer-aliases.json`
   - 16 preferred/debt securities ถูกเชื่อมกับ issuer พร้อม `scope=issuer` และ `resolution=curated_issuer_alias`
   - materialize ด้วย `npm run research:fundamentals-aliases`

6. Runtime scaling
   - generic research screen ใช้ exact branch-and-bound จากเพดาน Fundamentals แล้วอ่าน EOD เฉพาะหลักทรัพย์ที่ยังมีโอกาสติด Top-N
   - US 1,094 ตัวให้ Top 10 ชุดเดิม แต่ benchmark ในเครื่องนี้ลดจากประมาณ 5.5 วินาทีเหลือ 0.52 วินาที
   - loader แบบตรวจเต็มยังเป็นค่าเริ่มต้นของ ingestion/merge; fast path ใช้เฉพาะ canonical gzip ที่ผ่าน validation และ atomic write แล้ว
   - narrative 6 ภาค reuse dashboard/TH picks/US picks ต่อหนึ่งดวง และ invalidate เมื่อวันหรือไฟล์ market/fundamentals เปลี่ยน

## คำสั่งสร้างซ้ำ

```powershell
npm install
npm run research:history -- --markets=NYSE/NASDAQ,NYSE,NASDAQ --limit=1000 --concurrency=4 --dry-run
npm run research:fundamentals -- --markets=NYSE/NASDAQ,NYSE,NASDAQ --limit=1000 --dry-run
npm run research:fundamentals-aliases -- --no-fetch
npm run research:market-coverage -- --write
npm run research:audit -- --json
npm run typecheck
npm test
npm run lint
npm run build
```

การดึง SEC อัตโนมัติต้องตั้ง `SEC_USER_AGENT` เป็นชื่อองค์กรและอีเมลที่มีผู้ตรวจจริง ห้ามใช้ `example.com`

## สิทธิ์ข้อมูล: สิ่งที่รู้จากแหล่งทางการ

| Candidate | จุดแข็ง | เงื่อนไขที่กระทบสินค้า |
|---|---|---|
| [Twelve Data](https://twelvedata.com/fundamentals) | Fundamentals 300k+ symbols, 50+ countries; EOD/time series และ identifier เช่น FIGI/ISIN ในบางแผน | [Business plan อนุญาต commercial display ภายใต้ exchange licensing; redistribution ต้องมีข้อตกลงแยก](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) |
| [EODHD](https://eodhd.com/pricing) | มี EOD all-world + Fundamentals และแผน Startup/Commercial | [การ display/repackage/redistribute ต้องได้รับอนุมัติเป็นลายลักษณ์อักษร และมีข้อกำหนดลบข้อมูลหลังยกเลิก](https://eodhd.com/financial-apis/terms-conditions) |
| [FMP](https://site.financialmodelingprep.com/developer/docs/stable) | Historical EOD, statements, ratios และ global coverage ใน tier สูง | [การแสดงหรือกระจายข้อมูลต้องมี Data Display and Licensing Agreement เฉพาะ](https://site.financialmodelingprep.com/developer/docs/pricing/) |
| [SEC Company Facts](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | XBRL ทางการของบริษัทที่ยื่น SEC, API ไม่ต้องใช้ key และมี bulk nightly | ครอบคลุม US filings เท่านั้น, ไม่มี EOD, ต้องทำ fair-access + taxonomy normalization + legal review ก่อน paid output |

## ข้อเสนอการจัดซื้อ

ส่ง RFQ ไป Twelve Data Enterprise และ EODHD Commercial ก่อน โดยระบุ use case ตรง ๆ ว่า:

- แสดง derived ratios, scores และกราฟในเว็บสมาชิก
- สร้าง static downloadable PDF ที่ผู้ใช้จ่ายเงิน
- ไม่เปิด raw API และไม่ขาย raw rows
- ต้อง cache EOD/fundamentals เพื่อ backtest และ reproducibility
- ต้องการ 29 ตลาด, adjusted EOD, corporate actions และ historical fundamentals

สัญญาต้องตอบเป็นลายลักษณ์อักษรให้ครบเรื่อง paid PDF, public/member display, derived metrics, cache retention, post-termination deletion, attribution, exchange pass-through fees และประเทศที่ต้องขออนุมัติเพิ่ม จึงค่อยเปลี่ยน registry จาก `unknown` เป็น `approved/restricted`

## Release gate ถัดไป

1. เลือก provider จาก signed commercial terms ไม่ใช่จากราคา API หน้าเว็บอย่างเดียว
2. ทำ licensed pilot 50 หลักทรัพย์ ครอบคลุมอย่างน้อย 10 ตลาด
3. เทียบ provider กับ cache ทดลอง: identifier match, adjustment, missing bars, restatement และ field semantics
4. ต้องได้ EOD ≥98%, applicable fundamentals ≥90%, provenance 100% และ commercial eligibility 100% ของ paid pilot
5. เมื่อ gate ผ่าน จึงย้าย ResearchSnapshot/PDF ไปใช้ licensed dataset; Yahoo cache คงไว้เฉพาะ development regression

## ช่องว่างที่ยังเหลือ

- FISV ไม่มี usable `financialData` จาก Yahoo; ใช้ SEC Company Facts หรือ licensed provider แทน ห้ามปั้นค่า
- ตลาดนอกไทย/สหรัฐยังไม่ได้เติมรอบใหญ่ เพราะควรทดสอบกับ provider ที่มีสิทธิ์ขายก่อน ลดงาน migration ซ้ำ
- ข้อมูล point-in-time และ historical statements ยังต้องเพิ่มสำหรับ backtest ที่ไม่เกิด look-ahead bias
- Commercial fundamentals และ EOD ยังเป็น 0 จึงยังไม่เปิด generic paid research/PDF gate

## QA ปิดรอบ

- US Fundamentals dry-run: selected 1,094, fresh 1,093, pending 0
- US EOD dry-run: selected 1,094, fresh end bar 1,090, recently checked 1,094, pending 0
- 83 test files / 449 tests ผ่าน
- TypeScript, ESLint และ Next.js production build ผ่าน
