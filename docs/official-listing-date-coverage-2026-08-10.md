# สถานะวันเข้าตลาดหุ้นต่างประเทศและเอกสารส่งต่อระบบ

วันที่ตรวจ: 10 สิงหาคม 2569  
ขอบเขต: หลักทรัพย์ต่างประเทศที่ใช้วิจัยจริง 5,877 ตัว  
สถานะ: workflow หลักฐานครบ 100%; วันที่ทางการยังไม่ครบ 100%; commercial data gate ยังไม่ผ่าน

## ข้อสรุปสำหรับผู้บริหาร

คำว่า **100% ที่ทำเสร็จแล้ว** หมายถึงหลักทรัพย์ทุกตัวมีสถานะปลายทางและเส้นทางหาหลักฐานที่ตรวจย้อนหลังได้ ไม่ได้หมายถึงมีวันเข้าตลาดครบทุกตัว

| ตัวชี้วัด | ผลตรวจล่าสุด |
|---|---:|
| จัดสถานะหลักฐานครบ | **5,877/5,877 (100.00%)** |
| ไม่จัดหมวด | **0** |
| มี listing/first-trading date จากหลักฐานทางการ | **4,233/5,877 (72.03%)** |
| ยังไม่มีวันทางการ | **1,644 (27.97%)** |
| มีเวลาเริ่มซื้อขายที่ยืนยันได้ | **0/5,877** |
| US current venue identity | **1,093/1,094 (99.91%)** |
| กลุ่ม catalog เดิม `NYSE/NASDAQ` ที่แยกตลาดได้ | **1,039/1,040 (99.90%)** |

ระบบไม่ใช้วันแรกของกราฟราคา ไม่ยืมวัน common share ให้ preferred/share class อื่น และไม่สมมติเวลาเปิดตลาดเป็นเวลาเริ่มซื้อขายของหลักทรัพย์

## 1,644 ตัวที่ยังขาดถูกแจกแจงครบอย่างไร

| สถานะปลายทาง | จำนวน | สัดส่วนทั้ง universe | วิธีปิดช่องว่าง |
|---|---:|---:|---|
| ต้องใช้แหล่งข้อมูลที่มีสัญญา | 928 | 15.79% | ซื้อ licence/API/security master ที่มี historical listing date และสิทธิ์ paid use |
| ต้องค้นเอกสาร issuer/exchange รายตัว | 585 | 9.95% | เก็บ prospectus, listing announcement, Form 8-A/25 หรือ issuer history |
| official adapter จับคู่ไม่สำเร็จ | 71 | 1.21% | ทำ symbol lifecycle, ISIN และ share-class reconciliation |
| ต้องเก็บหลักฐานทางการด้วยมือ | 33 | 0.56% | ใช้บัญชี/กุญแจ API/ขั้นตอนที่ตลาดอนุญาต โดยไม่ bypass access control |
| provider candidate รอ official verification | 26 | 0.44% | เทียบ candidate กับ exchange/issuer ก่อน promote |
| ต้องยืนยัน venue/policy เพิ่ม | 1 | 0.02% | ติดตาม EA จาก issuer/Nasdaq/SEC โดยไม่อนุมานจากการหายไปของ symbol directory |
| **รวม** | **1,644** | **27.97%** | ตรงกับ `missingOfficialDate` ทุกตัว |

กลุ่ม `licensed_source_required` เป็นคิวที่ปิดช่องว่างได้มากที่สุด แต่ต้องมีงบประมาณ สัญญา และ data-rights review ก่อนนำไปใช้ในรายงานชำระเงิน

## Coverage รายตลาดที่ยังไม่ครบ

| ตลาดใน catalog | มีวันทางการ | ทั้งหมด | ยังขาด | เส้นทางหลัก |
|---|---:|---:|---:|---|
| NYSE/NASDAQ เดิม | 0 | 1,040 | 1,040 | แยก current venue แล้ว 1,039 ตัว; historical date ยังต้องใช้ licensed Daily List/issuer filings |
| TSX | 186 | 400 | 214 | public issuer workbook และ public bulletin archive ถูกใช้ครบแล้ว; ส่วนที่เหลือต้องใช้ licensed security master/ค้นเอกสารเก่า |
| EPA/Euronext Paris | 0 | 127 | 127 | Euronext Advanced Reference Data/licensed reference data |
| BMV | 0 | 89 | 89 | official database/Web Services พร้อมสิทธิ์ที่เหมาะสม |
| KSE/PSX | 26 | 93 | 67 | reconcile current directory กับ Listings History/issuer records |
| KRX | 201 | 234 | 33 | preferred/security classes ผ่าน KRX Data Marketplace/Open API ที่ผู้ใช้ได้รับอนุญาต |
| NYSE | 2 | 35 | 33 | issuer/exchange filings รายตัว |
| TADAWUL | 73 | 87 | 14 | profile ที่ไม่เผย Listing Date ต้องหา announcement/prospectus |
| HKEX | 282 | 293 | 11 | exact identity/lifecycle และ official verification |
| NASDAQ | 8 | 19 | 11 | historical listing evidence/licensed Daily List |
| SGX | 92 | 97 | 5 | corporate information ที่วันหายหรือ alias ยังไม่ชัด |
| **รวม** | **870** | **2,514** | **1,644** | ตลาดที่ครบอีก 16 ตลาดมี 3,363/3,363 |

ตลาดที่ครบใน universe ปัจจุบัน: TSE 411, HOSE/HNX 351, SSE 324, SZSE 308, NSE 297, LSE 275, ASX 247, XETR 239, TWSE 188, IDX 149, BURSA 117, SWX 117, BOVESPA 101, BIST 100, PSE 85 และ JSE 54

## สิ่งที่เพิ่มในรอบ 10 สิงหาคม

1. **TWSE ครบ 188/188** — เติม `2002A` จากหน้า ISIN Classification ทางการ พร้อม ISIN และวันที่ 1974-12-26
2. **IDX ครบ 149/149** — เติม `XSPI` จากประกาศ KSEI ทางการ วันที่ 2019-07-04
3. **TSX public bulletin archive** — crawl New Company Listings ตั้งแต่ archive สาธารณะเริ่มต้น รวม 2,397 bulletin IDs; exact target 12 รายการถูกเทียบกับ issuer workbook และความต่าง 12 รายการถูกแจ้งเตือนโดยไม่เขียนทับเงียบ ๆ
4. **US current venue resolver** — ใช้ Nasdaq Trader Symbol Directory แยกตลาดปัจจุบัน 1,093/1,094 ตัว; reconcile `SLB` และ `WAB` ด้วยหลักฐานชื่อจาก issuer และยืนยัน `CBOE` อยู่ Cboe BZX; พบ catalog mismatch 1 ตัวและเก็บเป็น audit fact ไม่เปลี่ยนเป็น listing date
5. **terminal evidence policy** — KRX และ TSX ที่ใช้แหล่งสาธารณะครบแล้วถูกย้ายเป็นสถานะที่บอกอุปสรรคจริง (`manual_official_research_required`/`licensed_source_required`) แทนคำว่า adapter ยังทำไม่เสร็จ
6. **Trust Center** — แสดง 72.03% วันที่จริงกับ 100% workflow แยกกัน พร้อมยอด 1,644 ที่รวมตรงทุกหมวด

## แหล่งทางการหลักและข้อจำกัด

- [TWSE ISIN Classification](https://isin.twse.com.tw/isin/class_main.jsp?owncode=2002A&stockname=&isincode=&market=1&issuetype=A&industry_code=&Page=1&chklike=Y) — ยืนยัน `2002A`, ISIN และวันเข้าตลาด
- [KSEI announcement สำหรับ XSPI](https://web.ksei.co.id/Announcement/Files/100312_ksei_5906_dir_0619_201906201753.pdf) — ยืนยัน listing date ของ security class นี้
- [TSX New Company Listings archive](https://www.tsx.com/en/news/new-company-listings) — archive สาธารณะเริ่มปี 2014 จึงไม่ใช่ historical master ครบทุกหลักทรัพย์
- [Nasdaq Symbol Directory definitions](https://www.nasdaqtrader.com/trader.aspx?id=symboldirdefs) และ [Symbol Lookup](https://www.nasdaqtrader.com/Trader.aspx?id=symbollookup) — ใช้ยืนยัน current venue เท่านั้น ไม่ได้อ้างว่าเป็น historical listing date
- [SLB Investor FAQs](https://investorcenter.slb.com/investor-resources/investor-faqs/) และ [Wabtec issuer filing](https://ir.wabteccorp.com/static-files/cc7c7fd9-f979-4fb7-a1a2-dde6956111a3) — ใช้ bridge ชื่อเดิม/ชื่อกฎหมายของ `SLB` และ `WAB` แบบ exact เท่านั้น
- [EA FY26 results](https://investors.ea.com/press-releases/press-release-details/2026/Electronic-Arts-Reports-Q4-and-FY26-Results/default.aspx) — หลักฐาน issuer ล่าสุดที่ตรวจพบ ณ รอบนี้ยังกล่าวถึงการรอปิดธุรกรรม; การไม่มี `EA` ใน current Symbol Directory จึงถูกคงเป็น unknown ไม่ถูกตีความว่า delist หรือ merger เสร็จแล้ว
- [SEC guidance for automated EDGAR access](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) — การดึง filing ต้องมี User-Agent ที่ระบุผู้รับผิดชอบและทำตาม fair-access policy
- [KRX Data Marketplace terms](https://data.krx.co.kr/contents/MDC/INFO/informationController/MDCINFO003.cmd) — ห้ามสร้าง automation ที่ข้ามบัญชี การอนุมัติ หรือเงื่อนไขของตลาด

ข้อมูลที่เข้าถึงได้สาธารณะไม่ได้แปลว่ามีสิทธิ์นำข้อมูลดิบไปแสดงหรือขาย ระบบจึงแยก `verification` ออกจาก `displayRights` และ fail closed สำหรับ paid/public use ที่สิทธิ์ยังไม่ชัด

## ไฟล์ที่ต้องย้ายเครื่อง

ย้าย repository ทั้งชุดเพื่อรักษา code, tests และ provenance โดยไฟล์สำคัญขั้นต่ำคือ:

- `package.json`, `package-lock.json`, `requirements-research.txt`
- `data/stocks/` — universe และ canonical identity
- `data/security-events.json` — canonical lifecycle/listing events
- `data/staging/` — compact official snapshots, hashes, US venue snapshot และ evidence ledger
- `data/curated/` — supplement ที่มี source URL และ strict parser
- `data/cache/` — fundamentals/EOD/research snapshots ปัจจุบัน หากต้องการให้ audit หลังย้ายเครื่องได้ตัวเลขเท่าเดิม
- `src/lib/research/`, `scripts/`, `tests/` — adapters, importer, ledger, audit และ regression tests
- `src/app/trust/` — UI ที่แสดงตัวเลขจาก audit จริง
- `docs/official-listing-date-coverage-2026-08-10.md` และ `UPDATE.md` — จุดส่งมอบล่าสุด

ห้ามย้ายเฉพาะ `data/security-events.json` แล้วทิ้ง staging/curated เพราะจะสูญเสียหลักฐานว่าตัวเลขเกิดจากแหล่งใดและรันซ้ำอย่างไร

## คำสั่งตรวจหลังย้ายเครื่อง

```powershell
npm ci
npm.cmd run research:foreign-date-ledger
npm.cmd run research:audit
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

ผลขั้นต่ำที่ต้องได้จาก canonical snapshot ชุดนี้:

- foreign ledger: `total=5877`, `classified=5877`, `unclassified=0`
- official date: `4233/5877 (72.03%)`, missing `1644`
- exact first-trade time: `0`
- US current venue: `1093/1094`; legacy combined resolved `1039/1040`
- global researchable: `6142`; global official listing date `4498/6142 (73.23%)`
- Thailand current official date: `265/265`

## คำสั่งรวม official snapshots กลับเข้า canonical store

คำสั่งนี้เป็น additive, preview/apply และ conflict-safe; เมื่อ canonical store ตรงกับ snapshot แล้วการรันซ้ำล่าสุดได้ `added=0`, `alreadyPresent=4790`, `refreshed=0`, `correctedDates=0` และ `conflicts=[]`:

```powershell
npm.cmd run research:stage-official-foreign-events -- --jpx-input=data/staging/jpx-company-dates.json --lse-input=data/staging/lse-instrument-dates.json --pse-input=data/staging/pse-company-dates.json --tadawul-input=data/staging/tadawul-company-dates.json --idx-input=data/staging/idx-company-dates.json --vietnam-input=data/staging/vietnam-company-dates.json --sgx-input=data/staging/sgx-company-dates.json --hkex-input=data/staging/hkex-company-dates.json --b3-input=data/staging/b3-company-dates.json --psx-input=data/staging/psx-listing-dates.json --six-input=data/staging/six-listing-dates.json --xetra-input=data/staging/xetra-listing-dates.json --xetra-instrument-input=data/staging/xetra-instrument-dates.json --tsx-input=data/staging/tsx-listing-dates.json --tsx-bulletin-input=data/staging/tsx-exchange-bulletin-dates.json --bist-input=data/staging/bist-listing-dates.json --jse-input=data/staging/jse-listing-dates.json --apply
npm.cmd run research:foreign-date-ledger
npm.cmd run research:audit
```

การ refresh US current venue จากต้นทาง:

```powershell
npm.cmd run research:fetch-us-current-venues
npm.cmd run research:foreign-date-ledger
```

snapshot นี้เก็บเฉพาะ records ที่ใช้ตรวจ identity พร้อม SHA-256 ของ source ไม่เก็บสำเนาไฟล์ดิบจำนวนมาก

## QA ณ จุดส่งมอบ

- `npm.cmd run research:fetch-pse-security-dates`: PSE `85/85`, unresolved 0 และไม่ fetch ซ้ำเมื่อ snapshot ครบ
- official stage apply ซ้ำ: `officialListingDates=4107`, `added=0`, `alreadyPresent=4790`, `refreshed=0`, `correctedDates=0`, `conflicts=[]`
- foreign ledger integrity: 5,877 records, classified 5,877, unclassified 0, status sum 5,877, official 4,233, missing 1,644
- `npm.cmd test`: **81 test files / 445 tests ผ่าน**
- `npm.cmd run typecheck`: ผ่าน
- `npm.cmd run lint`: ผ่าน 0 errors / 0 warnings
- `npm.cmd run build`: Next.js 16.3 production build ผ่าน และ prerender `/trust` สำเร็จ
- `git diff --check`: ผ่าน มีเฉพาะคำเตือน LF/CRLF ของ Windows ไม่มี whitespace error
- Browser QA `/trust` จากข้อมูล audit จริงผ่านบน desktop และ viewport 390×844: 72.03% กับ 100% แยกชัด, US venue 1,093/1,094, ไม่มีข้อความทับ, root ไม่มี horizontal overflow, ตารางมี scroll hint และ console ไม่มี error/warning

## Definition of Done ของเฟสข้อมูลวันที่

- [x] ทุก foreign security มี security ID ไม่ซ้ำและ terminal evidence status
- [x] status sum เท่ากับ universe และ `unclassified=0`
- [x] official evidence แยกจาก provider candidate
- [x] event type แยก incorporation, admission และ first trading day
- [x] importer idempotent และ conflict-safe
- [x] Trust UI ไม่สื่อว่า date coverage เป็น 100%
- [x] มี compact snapshots/curated evidence สำหรับย้ายเครื่อง
- [ ] official date 100% — ต้องมี licence/credentials/issuer research เพิ่ม ไม่สามารถทำให้ถูกต้องด้วยโค้ดล้วน
- [ ] commercial display/paid-report rights — ต้องผ่านสัญญาและ legal review
- [ ] exact first-trade time — ปัจจุบัน 0 และห้ามเดา

## ผลต่อเว็บและ PDF

เฟสนี้ทำให้เว็บตอบได้อย่างโปร่งใสว่า “มีหลักฐานแค่ไหนและขาดเพราะอะไร” แต่ยังไม่ทำให้ paid PDF พร้อมขายทั่วโลก เนื่องจาก global fundamentals มีเพียง 351/6,142 (5.71%), daily EOD มี 275/6,142 (4.48%), exact first-trade time เป็น 0 และสิทธิ์ข้อมูลเชิงพาณิชย์ยังไม่ครบ

ลำดับถัดไปที่สร้างมูลค่าจริงคือทำนโยบาย data licence, เติม fundamentals/EOD/corporate actions, ทำ symbol lifecycle, walk-forward backtest พร้อม benchmark/transaction cost และ legal review จากนั้น PDF ทุก tier จึงอ่าน immutable ResearchSnapshot เดียวกับเว็บโดยไม่ให้คำตอบขัดกัน
