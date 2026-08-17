# ฐานวันหุ้นต่างประเทศ — ส่งต่องานและระบบรองรับฉบับ 9 สิงหาคม 2569

> **เอกสารนี้เป็น snapshot ก่อนเติม Xetra current instrument reference** ตัวเลขล่าสุดและคำสั่ง canonical อยู่ที่ [Foreign Security Date Coverage — 100% Status](./foreign-security-date-coverage-100-status-2026-08-09.md)
>
> ใช้เอกสารนี้เป็นสถานะล่าสุดแทนตัวเลขในฉบับ 8 สิงหาคม และตรวจค่าจริงทุกเครื่องด้วย `npm.cmd run research:audit`

## ผลลัพธ์ที่ได้

ระบบมีวันเข้าตลาดหรือวันซื้อขายจากหลักฐานทางการสำหรับหุ้นต่างประเทศ **3,810/5,958 ตัว (63.95%)** เพิ่มจาก 2,984 ตัวเมื่อวันที่ 8 สิงหาคมจำนวน **826 ตัว** ภาพรวมรวมไทยเป็น **4,075/6,223 ตัว (65.48%)** โดยไม่มีการเลื่อน provider date มาเป็นวันทางการและไม่มีการแต่งเวลาเกิดหุ้น

| ตัวชี้วัด | ผลล่าสุด | ช่องว่าง |
|---|---:|---:|
| Foreign official listing/first-trading date | 3,810/5,958 (63.95%) | 2,148 ตัว |
| Global official listing/first-trading date | 4,075/6,223 (65.48%) | 2,148 ตัว |
| Foreign company-origin exact date | 684/5,958 (11.48%) | 5,274 ตัว |
| Global fundamentals usable | 351/6,223 (5.64%) | 5,872 ตัว |
| Global adjusted EOD series | 275/6,223 (4.42%) | 5,948 ตัว |
| Exact first-trade time จากหลักฐาน | 0/6,223 (0%) | ทั้งหมด |
| Provider candidates ที่กักไว้ | 4,888/5,958 (82.04%) | ใช้ค้นหลักฐานเท่านั้น |

ตัวเลขนี้แก้ปัญหา “วันหุ้นต่างประเทศน้อยเกินไป” ได้มาก แต่ยังไม่ทำให้ระบบพร้อมทำนายจุดซื้อขายหรือกลับไปผลิต PDF แบบเสียเงิน เพราะ fundamentals, ราคา EOD, corporate actions, backtest และสิทธิ์ใช้ข้อมูลเชิงพาณิชย์ยังไม่ผ่านเกณฑ์

## Coverage ที่ยืนยันจากแหล่งทางการ

ตัวเชื่อมต่อ 21 กลุ่มยืนยันหลักทรัพย์ต่างประเทศได้ 3,800 ตัว และ US10 issuer/filing pilot อีก 10 ตัว รวม 3,810 ตัว

| ตลาด/แหล่ง | ยืนยันได้ / catalog | หลักการจับคู่ |
|---|---:|---|
| TWSE | 187/188 | รหัสหลักทรัพย์ตรงจาก OpenAPI |
| NSE India | 294/298 | แยก equity, REIT และ InvIT |
| SSE | 324/327 | Main Board, STAR และ B-share |
| SZSE | 307/307 | ดึงทั้ง A-share `tab1` และ B-share `tab2`; มี regression test กัน B-share หลุด |
| JPX/TSE | 409/411 | detail ทางการและ ticker ตรง |
| LSE | 270/275 | Admission date ตาม TIDM |
| KRX KIND | 201/234 | ไม่ยืมวัน common share ให้ preferred class |
| ASX | 246/251 | Company Directory CSV; license-gated เพราะหน้าตลาดระบุ LSEG/Morningstar |
| PSE EDGE | 72/85 | ไม่ยืมวันให้ preferred share ที่ไม่มีแถวตรง |
| Saudi Exchange | 73/87 | อีก 14 profile ไม่มีวันที่ระดับวัน; company origin 87/87 |
| IDX | 148/149 | ticker ตรงจาก Listed Company Profiles |
| Vietnam | 351/351 | แก้ venue เป็น HOSE 182 + HNX 169 ตามจริง |
| SGX | 92/98 | issuer-level Listed Date & Board; 6 alias/วันที่ไม่ชัดคง unresolved |
| HKEX | 282/293 | รหัสหุ้นและ Listing Date ตรง; 11 ช่องว่างคง unresolved |
| B3/Bovespa | 97/174 | ยืนยัน issuer/share code; ตัด odd-lot alias ลงท้าย `F` 77 ตัว |
| PSX | 24/93 | symbol ตรง 6 และชื่อบริษัททางการตรง 18; ไม่ fuzzy match |
| SIX | 38/117 | IPO History 18 + Sponsored Foreign Shares 20 |
| Xetra | 45/239 | Primary Market Statistics; ปฏิเสธ ticker reuse 4 รายการ |
| TSX | 186/400 | current workbook + historical New Listings; ปฏิเสธ class/root date 2 และ issuer mismatch 1 |
| Borsa Istanbul | 100/100 | Current Code ตรง; เก็บ `.E`/`.G`; มี 101 events เพราะ THYAO มี admission กับ first-trading คนละวัน |
| JSE | 54/54 | AlphaCode + issuer identity + ISIN + ListingDate ตรงทั้งหมด |
| US10 issuer/filing pilot | 10/10 | IR, annual report หรือ filing รายบริษัท |

รอบล่าสุดพบ SZSE เหลือ 301/307 เพราะตัวดึงเคยอ่านเฉพาะ A-share หลังตรวจ API ทางการพบ B-share อยู่คนละ tab จึงแก้ให้โหลดทั้งสองชุดและกลับมาครบ 307/307 โดยไม่เปลี่ยนวันที่ canonical เดิม

## แหล่งหลักของรอบ 9 สิงหาคม

- [HKEX Equities Quote](https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities/Equities-Quote) — profile มี Listing Date แต่หน้าระบุข้อมูลจาก Refinitiv
- [B3 Listed Companies](https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=en-us) — issuer listing date และ detail ของ share code
- [PSX Listings History](https://www.psx.com.pk/psx/resources-and-tools/listings/listings-history) และ [current listings](https://dps.psx.com.pk/listings)
- [SIX IPO History](https://www.six-group.com/en/market-data/shares/ipo-history.html) และ [Sponsored Foreign Shares](https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html)
- [Deutsche Börse New Companies](https://www.cashmarket.deutsche-boerse.com/cash-en/Data-Tech/statistics/New-Companies) — Primary Market Statistics สำหรับ Xetra
- [TSX Current Market Statistics](https://www.tsx.com/en/listings/current-market-statistics) และ [Listed Company Directory](https://www.tsx.com/en/listings/listing-with-us/listed-company-directory)
- [Borsa Istanbul Market Data](https://www.borsaistanbul.com/en/market-data) — `ilkislem.zip` / First Trading Date and Price workbook
- [JSE Listed Companies](https://clientportal.jse.co.za/companies-and-financial-instruments) — issuer และ SharesService ของ Client Portal
- [SZSE Stock List](https://www.szse.cn/market/product/stock/list/index.html) — A-share และ B-share แยก tab

## ตลาดที่พบแหล่งแล้วแต่ยังไม่ควรนำเข้าฝืน

| ตลาด | สิ่งที่พบ | สถานะที่ถูกต้อง |
|---|---|---|
| Euronext Paris | public directory มี symbol/ISIN แต่ `ListingStartDate` อยู่ใน Advanced Reference Data | ต้องซื้อ/ทำสัญญา licensed feed |
| Bursa Malaysia | PDF ISIN Equity ทางการมี Listing Date | ต้องดึงด้วยวิธีที่ตลาดอนุญาตและตรวจ terms; anti-bot ขวาง automation ปัจจุบัน |
| BMV Mexico | profile ราย issuer มี `Fecha de Constitución` และ `Fecha de listado en BMV` | ยังไม่มี bulk/API ที่ผ่านการตรวจและสิทธิ์ commercial; ไม่ใช้ mirror |
| Nasdaq/US ส่วนที่เหลือ | SEC ยืนยัน current identity ได้ แต่ไม่ใช่วันเข้าตลาด; historical First Date Traded เป็นผลิตภัณฑ์ Daily List | ต้องมี licensed source/งบข้อมูล |

## หลักความถูกต้องที่ระบบบังคับ

1. แยก `incorporation`, `listing_admission` และ `first_trading_day` เป็นคนละเหตุการณ์
2. จับคู่ด้วย current ticker/code และตรวจ issuer identity; ใช้ ISIN เมื่อแหล่งมีให้
3. ไม่ใช้ชื่อคล้ายแบบ fuzzy เพื่อเลื่อนเป็น canonical โดยอัตโนมัติ
4. ไม่ยืมวันที่ระหว่าง common/preferred/class/odd-lot/certificate หากไม่มีหลักฐานตรง
5. ไม่ใช้วันแรกของกราฟราคาแทนวันเข้าตลาด
6. ไม่สมมติเวลาเปิดตลาดเป็นเวลาเกิดหุ้น; ข้อมูลทั้งหมดในรอบนี้เป็น `localTime=null`
7. แหล่งทุกชุดมี URL, retrieved time, SHA-256, verification และ display-rights status
8. การ import เป็น additive, idempotent และ conflict-safe; วันที่ขัดกันจะไม่เขียนทับเงียบ ๆ

### จุดที่ต้อง review ต่อ

- BIST มี name warnings 2 รายการ (`TURSG`, `BSOKE`) แต่ current code ตรง จึงเก็บ warning ไว้ให้ตรวจ issuer history
- BIST มี certificate line `DMLKT.G` จึงรักษา suffix ไม่ยุบเป็น common equity
- JSE มีวันที่เก่าก่อนปี 1900 เช่น DRD; parser แปลง .NET timestamp เป็นปฏิทิน Johannesburg แบบ fixed +02:00 ตามรูปแบบ service เพื่อไม่ให้เลื่อนไปวันก่อนหน้า และควรมี manual anomaly review เป็นระยะ
- Xetra ปฏิเสธ ticker ที่ถูกนำกลับมาใช้กับ issuer คนละราย
- TSX ไม่ใช้ issuer-root date แทน share class และไม่เก็บ workbook ดิบไว้ใน repo

## การเก็บข้อมูลโดยไม่ให้ระบบบวม

- raw XLSX/ZIP/API response ใช้ระหว่างประมวลผลแล้วทิ้ง ไม่เก็บสำเนาต่อผู้ใช้
- เก็บเฉพาะ compact catalog-scoped snapshots ใน `data/staging/*.json`
- เก็บราคาเป็น shared compressed series ต่อหลักทรัพย์ ไม่ฝังกราฟซ้ำใน PDF ทุกเล่ม
- PDF ในอนาคตอ้าง immutable research snapshot เดียว ไม่คำนวณใหม่คนละคำตอบในแต่ละหน้า
- provider candidates 4,888 แถวมีไว้เป็น search queue และถูกตั้ง `eligibleForSecurityBirth=false`

ไฟล์หลักที่ต้องย้ายไปด้วย:

- `data/security-events.json` — canonical events
- `data/staging/official-foreign-security-events.json` — ผล stage และ audit trail รอบล่าสุด
- `data/staging/*-dates.json` — compact snapshots ของแหล่งที่ต้อง cache
- `data/staging/foreign-provider-date-candidates.json` — คิวค้นหลักฐานที่ยังถูกกัก
- `src/lib/research/` — parser, matcher, policy และ canonical logic
- `scripts/stage-official-foreign-events.ts` — orchestrator รวมทุกแหล่ง

## สิทธิ์ใช้ข้อมูลเชิงพาณิชย์

การมี URL สาธารณะไม่ได้แปลว่าเอาข้อมูลไปขายต่อได้ ระบบจึงคง `displayRights=unknown` และไม่เปิด paid/public gate จนกว่าจะมีการตรวจหรือทำสัญญา โดยเฉพาะ:

- HKEX profile ระบุ Refinitiv
- ASX directory ระบุ LSEG Data & Analytics/Morningstar
- TSX workbook มีข้อจำกัดเรื่องการทำซ้ำ/เผยแพร่และต้องขอความยินยอม
- JSE disclaimer ระบุข้อมูลเป็นทรัพย์สินของ JSE และการใช้เพื่อ commercial gain ต้องมีหนังสืออนุญาต
- Borsa Istanbul มีผลิตภัณฑ์ market data และกระบวนการ data-distribution agreement
- B3, PSX, SIX, Deutsche Börse, SZSE และตลาดอื่นยังต้องผ่าน terms/data-license review รายตลาด

ข้อความนี้เป็น product/data governance gate ไม่ใช่คำวินิจฉัยทางกฎหมาย ควรให้ที่ปรึกษากฎหมายไทยตรวจทั้งสิทธิ์ข้อมูล การแสดงคำแนะนำ และ wording ก่อนเปิดขาย

## คำสั่งย้ายเครื่องและกู้ระบบ

ใช้ Node.js 22.x ตาม `package.json` และย้ายทั้ง repository รวม `data/staging` กับ `data/security-events.json`

```powershell
npm install
npm.cmd run research:audit
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

นำ compact snapshots ที่มีอยู่กลับเข้า stage และตรวจ idempotence:

```powershell
npm.cmd run research:stage-official-foreign-events -- --jpx-input=data/staging/jpx-company-dates.json --lse-input=data/staging/lse-instrument-dates.json --pse-input=data/staging/pse-company-dates.json --tadawul-input=data/staging/tadawul-company-dates.json --idx-input=data/staging/idx-company-dates.json --vietnam-input=data/staging/vietnam-company-dates.json --sgx-input=data/staging/sgx-company-dates.json --hkex-input=data/staging/hkex-company-dates.json --b3-input=data/staging/b3-company-dates.json --psx-input=data/staging/psx-listing-dates.json --six-input=data/staging/six-listing-dates.json --xetra-input=data/staging/xetra-listing-dates.json --tsx-input=data/staging/tsx-listing-dates.json --bist-input=data/staging/bist-listing-dates.json --jse-input=data/staging/jse-listing-dates.json --apply
```

คำสั่งนี้ยังดาวน์โหลด TWSE, NSE, SSE, SZSE A/B, KRX และ ASX ใหม่ จึงต้องมี network การรันที่ถูกต้องหลังข้อมูลถูก import แล้วต้องได้ `added=0`, `conflicts=[]`

ถ้าต้องการ refresh snapshot ของ 8 แหล่งใหม่ ให้รันทีละแหล่งเพื่อแยก failure และเคารพ rate limit:

```powershell
npm.cmd run research:fetch-hkex-dates -- --refresh
npm.cmd run research:fetch-b3-dates -- --refresh
npm.cmd run research:fetch-psx-dates -- --refresh
npm.cmd run research:fetch-six-dates -- --refresh
npm.cmd run research:fetch-xetra-dates -- --refresh
npm.cmd run research:fetch-tsx-dates -- --refresh
npm.cmd run research:fetch-bist-dates -- --refresh
npm.cmd run research:fetch-jse-dates -- --refresh
```

ก่อนใช้ SEC ต้องตั้ง User-Agent เป็นองค์กรและอีเมลที่มีผู้ดูแลจริง:

```powershell
$env:SEC_USER_AGENT="Bazi Investor Guide data pipeline YOUR_REAL_MONITORED_EMAIL"
npm.cmd run research:stage-sec-master
```

## ลำดับงานระบบก่อนกลับไปทำ PDF

1. จัดซื้อ/ทำสัญญา fundamentals และ adjusted EOD ที่ครอบคลุม universe จริง พร้อม corporate actions และ symbol history
2. เลือก licensed US/Canada/Europe security-master เพื่อปิด 2,148 official-date gaps ที่เหลือ
3. ทำ reconciliation job รายเดือน: current catalog เทียบ source, stale event, delisting, ticker migration และ conflict queue
4. เพิ่ม walk-forward backtest, benchmark, transaction cost, survivorship-bias control และ model calibration
5. ทำ compliance UX: แสดงข้อมูล/สมมติฐาน/ความไม่แน่นอน, user-authored alerts และห้ามใช้คำสั่งซื้อขายรับประกันผล
6. เปิด PDF ใหม่เมื่อ canonical snapshot, data rights, model validation และ legal gate ผ่านเท่านั้น

## QA ณ ตอนส่งมอบ

- `research:audit`: foreign official 3,810/5,958 (63.95%); global 4,075/6,223 (65.48%)
- official stage รอบสุดท้าย: SZSE 307/307; `added=0`; `alreadyPresent=4,483`; conflicts 0
- `npm.cmd test`: 65 test files / 361 tests ผ่าน
- `npm.cmd run typecheck`: ผ่าน
- targeted ESLint ของ adapter/stage/tests รอบนี้: 0 errors
- `npm.cmd run build`: Next.js production build ผ่าน
- global lint: คง baseline เดิม 18 errors / 1 warning ใน legacy PDF/chat/demo และไฟล์เดิมนอก research adapters

## ข้อสรุปเชิงผลิตภัณฑ์

สิ่งที่ขายได้ในอนาคตไม่ควรเป็น “ดวงบอกซื้อ/ขายวันไหน” จากวันเกิดหุ้นเพียงค่าเดียว แต่ควรเป็น research product ที่ประกอบด้วยหลักฐานวันหุ้น, fundamentals, price history, pattern validation, risk budget, scenario และคำอธิบายข้อจำกัด แล้วให้ BaZi เป็นชั้นสะท้อนพฤติกรรม/วินัยที่ไม่เปลี่ยน market score จนกว่าจะมีหลักฐานเชิงสถิติรองรับ

ดังนั้นสถานะ PDF ยังเป็น `DEFERRED` อย่างตั้งใจ: ฐานวันหุ้นดีขึ้นมากแล้ว แต่สิ่งที่ทำให้ผู้ซื้อคุ้มเงินจริงในลำดับถัดไปคือข้อมูลพื้นฐาน, ประวัติราคา, backtest และความน่าเชื่อถือทางกฎหมาย—not จำนวนหน้ารายงาน
