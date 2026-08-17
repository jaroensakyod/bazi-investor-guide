# ฐานวันหุ้นต่างประเทศ — 100% Evidence Classification

> **เอกสารประวัติ:** ตัวเลขล่าสุดและคำสั่งย้ายเครื่องอยู่ที่ `docs/official-listing-date-coverage-2026-08-10.md` เอกสารนี้คงไว้เพื่อ audit ความเปลี่ยนแปลงของวันที่ 9 สิงหาคม

> Canonical handoff ณ 9 สิงหาคม 2569 เอกสารนี้แทนตัวเลขใน `foreign-security-dates-2026-08-09.md` ส่วนสถานะล่าสุด  
> ตรวจค่าจริงจากเครื่องใดก็ได้ด้วย `npm.cmd run research:foreign-date-ledger` และ `npm.cmd run research:audit -- --json`

> **คำเตือน:** `100%` ในชื่อไฟล์หมายถึง “จัดหมวดเส้นทางหลักฐานครบ” เท่านั้น ไม่ใช่วันเข้าตลาดครบ สถานะวันทางการจริงล่าสุดคือ **4,160/5,885 ตัว (70.69%)** และ gate ยังคงเป็น `partial`

## ข้อสรุป

หุ้นต่างประเทศใน catalog ถูกตรวจและจัด **terminal evidence status ครบ 5,885/5,885 ตัว (100%)** โดยไม่มีรายการเงียบหรือ `unclassified` เหลืออยู่ แต่มีวันที่จากหลักฐานทางการจริง **4,160/5,885 ตัว (70.69%)** ไม่ใช่ 100%

คำว่า “ครบ 100%” ในระบบนี้หมายถึงทุกตัวมีคำตอบที่ตรวจสอบย้อนกลับได้ว่า:

- มีวันทางการแล้ว
- ต้องใช้แหล่งข้อมูลที่มี license
- ต้องแก้ venue/catalog ก่อน
- ต้องค้นเอกสาร issuer/exchange รายตัว
- ต้องรับเอกสารทางการด้วยขั้นตอน manual ที่ได้รับอนุญาต
- มี provider candidate แต่ยังห้ามใช้
- official adapter หาแถวตรงไม่พบ

ระบบไม่เติมวันที่หรือเวลาโดยคาดเดาเพื่อทำให้ตัวเลขดูครบ

## ตัวเลขล่าสุด

| ตัวชี้วัด | ผล | ช่องว่าง |
|---|---:|---:|
| Foreign terminal evidence status | **5,885/5,885 (100%)** | 0 |
| Foreign official listing/first-trading date | **4,160/5,885 (70.69%)** | 1,725 |
| Global official listing/first-trading date | **4,425/6,150 (71.95%)** | 1,725 |
| Foreign company-origin exact date | 684/5,885 (11.62%) | 5,201 |
| Global fundamentals usable | 351/6,150 (5.71%) | 5,799 |
| Global adjusted EOD series | 275/6,150 (4.47%) | 5,875 |
| Exact first-trade time | 0/6,150 (0%) | ทั้งหมด |
| Provider date candidates ที่กักไว้ | 4,888/5,885 (83.06%) | ใช้เป็นคิวค้นหลักฐานเท่านั้น |

## ผลการจัดสถานะ 1,725 ตัวที่ยังไม่มีวันทางการ

| สถานะ | จำนวน | ความหมาย/งานถัดไป |
|---|---:|---|
| `licensed_source_required` | 227 | ต้องมี data agreement หรือ licensed historical security master |
| `catalog_venue_resolution_required` | 1,040 | catalog US ใช้ NYSE/NASDAQ รวมกัน ต้อง resolve venue/identity ก่อน |
| `issuer_or_exchange_research_required` | 33 | ต้องค้นหลักฐาน issuer/exchange รายหลักทรัพย์ |
| `manual_official_research_required` | 0 | Bursa ถูกปิดครบด้วย PDF + ประกาศทางการแล้ว |
| `provider_candidate_requires_official_verification` | 142 | มี candidate จาก provider แต่ห้าม promote จนพบหลักฐานทางการตรงตัว |
| `official_adapter_no_match` | 283 | มี adapter ทางการแล้ว แต่ symbol/class/แถวปัจจุบันไม่ตรง จึงไม่ยืมวันจากหุ้นอีก class |
| `source_discovery_required` | 0 | ทุกตลาดมีแนวทางแหล่งข้อมูลแล้ว |
| `unclassified` | **0** | ไม่มีรายการที่ระบบปล่อยว่างโดยไม่บอกเหตุผล |

## Coverage รายตลาด

| ตลาด | วันทางการ / catalog | เหลือ |
|---|---:|---:|
| NYSE/NASDAQ (venue ยังรวมกัน) | 0/1,040 | 1,040 |
| TSE/JPX | 409/411 | 2 |
| TSX | 186/400 | 214 |
| HOSE/HNX catalog เดิม | 351/351 | 0 |
| SSE | 324/327 | 3 |
| SZSE | 307/307 | 0 |
| NSE India | 294/298 | 4 |
| HKEX | 282/293 | 11 |
| LSE | 270/275 | 5 |
| ASX | 246/251 | 5 |
| Xetra | **239/239** | **0** |
| KRX | 201/234 | 33 |
| TWSE | 187/188 | 1 |
| B3/Bovespa | **101/101** | **0** |
| IDX | 148/149 | 1 |
| Euronext Paris | 0/127 | 127 |
| Bursa Malaysia | **117/117** | **0** |
| SIX/SWX | 73/117 | 44 |
| Borsa Istanbul | 100/100 | 0 |
| SGX | 92/98 | 6 |
| PSX/KSE | 24/93 | 69 |
| BMV Mexico | 0/89 | 89 |
| Saudi Exchange | 73/87 | 14 |
| PSE | 72/85 | 13 |
| JSE | 54/54 | 0 |
| NYSE (venue ระบุแล้ว) | 2/35 | 33 |
| NASDAQ (venue ระบุแล้ว) | 8/19 | 11 |

## สิ่งที่เพิ่มในรอบปิด coverage

### Sprint 0E — SIX และ B3 security identity

- SIX ใช้ official IPO History ร่วมกับ current Sponsored Foreign Shares/FQS ทั้งตาราง; exact symbol + trading-currency match เพิ่มจาก 38 เป็น 73/117
- importer รองรับการ refresh/correct เฉพาะ source URL ที่ประกาศ superseded และยังคงปฏิเสธ date conflict จากแหล่งอื่น
- B3 odd-lot ticker ที่ลงท้าย `F` จำนวน 73 รหัสถูกเก็บเป็น searchable trading alias และ resolve ไป canonical ticker แต่ไม่เข้าตัวหารวิจัย
- แก้ canonical identifier อีก 4 ตัวและเพิ่ม official B3 dates ทำให้ B3 ครบ 101/101 หลักทรัพย์จริง
- event store หลัง apply มี 5,327 events; รอบแรกเพิ่ม 4 B3 events หลัง Sprint 0E และไม่มี conflict

### Xetra 239/239

- อ่าน current instrument reference จาก [Deutsche Börse/Xetra Tradable Instruments](https://www.cashmarket.deutsche-boerse.com/cash-en/trading/Tradable-Instruments-Xetra)
- official snapshot มี active Xetra instruments 5,101 แถวหลังกรองสถานะ/MIC/ประเภท
- คง Primary Market historical evidence เดิม 45 ตัวไว้เป็นหลัก
- เติม fallback จาก current venue-instrument reference อีก 194 ตัว
- วันที่ต่างกันข้ามสองแหล่ง 21 ตัวถูกเก็บเป็น warning ไม่เขียนทับ historical date
- stage รอบแรกเพิ่ม 194 events โดยไม่มี conflict
- stage รอบยืนยันซ้ำได้ `added=0`, `alreadyPresent=4,677`, `conflicts=[]`

วันที่จาก current instrument reference หมายถึงวันที่ของ instrument บน Xetra ตาม snapshot ไม่ใช่วันก่อตั้งบริษัท วัน IPO ดั้งเดิม หรือเวลาเริ่มซื้อขายที่แน่นอน

### Bursa Malaysia 117/117

- สกัดตารางทางการ 2,419 แถวจาก PDF 66 หน้า พร้อม SHA-256 ได้ exact ticker match 109 ตัว
- เติม IPO/secondary listing จากประกาศ Bursa โดยตรง 6 ตัว
- เชื่อม ticker lifecycle อีก 2 ตัวด้วย Listing Circular ที่ยืนยัน old/new stock short name และ stock code เดิมไม่เปลี่ยน: `AAX→AAGB`, `MYEG→ZETRIX`
- ไม่มี fuzzy match, ambiguous match หรือการสมมติเวลา; commercial display rights ยังต้องตรวจแยก
- รายละเอียดและแผนปิด 1,725 ตัวที่เหลือ: `docs/official-listing-date-coverage-2026-08-09.md`

### Evidence ledger

- สร้าง record ต่อหลักทรัพย์ต่างประเทศทุกตัว
- เก็บ official evidence, source policy, งานถัดไป, provider quarantine, company-origin evidence และ commercial-readiness แยกกัน
- readiness gate แสดง `partial` แม้ classified ครบ ตราบใดที่ official date ยังไม่ครบ; จะเป็น `ready` เมื่อทั้ง classification และวันทางการครบเท่านั้น
- provider candidate ไม่สามารถถูกใช้เป็น security birth โดยอัตโนมัติ

## ช่องว่างที่ต้องใช้อำนาจหรือสิทธิ์จากภายนอก

1. **US 1,040 ตัว:** SEC มี current CIK/ticker/exchange identity แต่ไม่ได้ให้ first-trading date ต้องตั้ง `SEC_USER_AGENT` ด้วยชื่อองค์กรและอีเมลที่มีผู้ดูแลจริงก่อนดึงข้อมูล และ historical Nasdaq Daily List เป็นผลิตภัณฑ์ subscription
2. **Euronext 127 ตัว:** วันระดับ instrument อยู่ใน Advanced Reference Data จึงต้องซื้อ/ทำสัญญา
3. **BMV 89 ตัว:** มี profile และผลิตภัณฑ์ฐานข้อมูล/Web Services ทางการ แต่ต้องใช้ช่องทางและสิทธิ์เชิงพาณิชย์ที่เหมาะสม
4. **KRX 33 ตัว:** ส่วนใหญ่เป็น preferred/security class ที่แถว public เดิมไม่ตรง การใช้ KRX Open API ต้องสมัคร รับ authentication key และรออนุมัติ จึงห้ามยืมวัน common share
5. **TSX/SIX/PSX และตลาดย่อย:** unmatched ส่วนมากเป็น share class, alias, stale symbol หรือ historical instrument ต้องทำ symbol-lifecycle reconciliation หรือใช้ licensed master

## กฎความถูกต้องที่ห้ามลด

1. แยก `incorporation`, `listing_admission` และ `first_trading_day` เป็นคนละ event
2. ไม่ใช้วันแรกของกราฟราคาแทนวันเข้าตลาด
3. ไม่สมมติเวลาเปิดตลาดเป็น “เวลาเกิดหุ้น”; รอบนี้ทุก event มี `localTime=null`
4. ไม่ยืมวันระหว่าง common/preferred/class/odd-lot/certificate
5. ไม่ใช้ fuzzy name match เพื่อ promote เป็น canonical event
6. provider dates ทั้งหมดเป็น quarantine queue จนกว่าจะมี exchange/issuer evidence
7. import เป็น additive, idempotent และ conflict-safe; ความขัดแย้งไม่ถูกเขียนทับเงียบ ๆ
8. การเข้าถึงได้สาธารณะไม่เท่ากับมีสิทธิ์นำข้อมูลไปขาย ต้องผ่าน `displayRights`/legal gate แยกต่างหาก

## ไฟล์หลักที่ต้องย้ายเครื่อง

- `data/security-events.json` — canonical security events
- `data/staging/official-foreign-security-events.json` — stage summary และ audit trail
- `data/staging/foreign-date-coverage-ledger.json` — ledger 5,885 records
- `data/staging/six-listing-dates.json` — SIX official compact snapshot 708 source rows
- `data/staging/b3-company-dates.json` — B3 official company/security-code snapshot
- `data/staging/xetra-instrument-dates.json` — compact Xetra snapshot
- `data/staging/bursa-listing-dates.json` — compact snapshot จาก PDF Bursa พร้อม hash
- `data/curated/bursa-listing-announcements.json` — IPO และ ticker lifecycle ที่ตรวจจากประกาศ Bursa
- `data/staging/foreign-provider-date-candidates.json` — provider candidates ที่กักไว้
- `src/lib/research/xetra-instrument-reference.ts` — parse/match/merge Xetra
- `src/lib/research/bursa-isin-equity.ts` และ `bursa-listing-announcements.ts` — exact match และ provenance สองชั้น
- `src/lib/research/foreign-date-coverage-ledger.ts` — terminal-status classifier
- `scripts/fetch-xetra-instrument-dates.ts` — official Xetra fetch
- `scripts/extract-bursa-listing-dates.py` และ `scripts/import-bursa-listing-dates.ts` — Bursa pipeline
- `scripts/stage-official-foreign-events.ts` — multi-source stage/import
- `scripts/normalize-b3-odd-lot-aliases.ts` — canonical B3 security identity + searchable odd-lot aliases
- `scripts/build-foreign-date-coverage-ledger.ts` — reproducible ledger build
- `src/lib/research/readiness-audit.ts` — coverage และ product gates

## คำสั่งสร้างซ้ำ

ใช้ Node.js ตาม `package.json` และย้าย repository ทั้งชุดรวม `data/staging`:

```powershell
npm ci
npm.cmd run research:normalize-b3-aliases
npm.cmd run research:import-bursa-dates -- --apply
npm.cmd run research:fetch-xetra-instrument-dates -- --refresh
npm.cmd run research:fetch-six-dates -- --refresh
npm.cmd run research:stage-official-foreign-events -- --jpx-input=data/staging/jpx-company-dates.json --lse-input=data/staging/lse-instrument-dates.json --pse-input=data/staging/pse-company-dates.json --tadawul-input=data/staging/tadawul-company-dates.json --idx-input=data/staging/idx-company-dates.json --vietnam-input=data/staging/vietnam-company-dates.json --sgx-input=data/staging/sgx-company-dates.json --hkex-input=data/staging/hkex-company-dates.json --b3-input=data/staging/b3-company-dates.json --psx-input=data/staging/psx-listing-dates.json --six-input=data/staging/six-listing-dates.json --xetra-input=data/staging/xetra-listing-dates.json --xetra-instrument-input=data/staging/xetra-instrument-dates.json --tsx-input=data/staging/tsx-listing-dates.json --bist-input=data/staging/bist-listing-dates.json --jse-input=data/staging/jse-listing-dates.json --apply
npm.cmd run research:foreign-date-ledger
npm.cmd run research:audit -- --json
```

ผลที่ต้องได้เมื่อ canonical data ถูก import แล้ว:

- stage: `added=0`, `refreshed=0`, `correctedDates=0`, `alreadyPresent=4,716`, `conflicts=[]`
- ledger: `total=5,885`, `classified=5,885`, `unclassified=0`
- foreign official date: `4,160/5,885 (70.69%)`
- global official date: `4,425/6,150 (71.95%)`

## QA ณ จุดส่งมอบ

- `npm.cmd test`: **79 test files / 425 tests ผ่าน**
- `npm.cmd run typecheck`: ผ่าน
- targeted ESLint ของไฟล์ research/adapter/stage/ledger/tests รอบนี้: 0 errors
- `npm.cmd run build`: Next.js production build ผ่าน
- ledger integrity: 5,885 records, 5,885 unique security IDs, status sum 5,885, missing ID 0, unclassified 0
- `git diff --check`: ผ่าน มีเฉพาะคำเตือน CRLF ของไฟล์เดิมบน Windows
- Bursa importer preview: `matched=117`, `unmatched=0`, `ambiguous=0`, `invalid=0`; apply ซ้ำ: `addedEvents=0`
- Browser QA หน้า `/trust` จาก production build บน desktop ผ่าน: B3 101/101, SIX 73/117, global 4,425/6,150 และ missing 1,725 ตรงกับ audit; `scrollWidth=clientWidth=1,265` ไม่มี root horizontal overflow
- B3 migration รันซ้ำได้ `changed=false`; official stage รันซ้ำได้ `added=0`, `refreshed=0`, `correctedDates=0`, `alreadyPresent=4,716`, `conflicts=[]`
- global `npm.cmd run lint`: คง baseline เดิม 17 errors / 1 warning ใน legacy files นอกชุดงานนี้ (รอบนี้ตรวจ targeted ESLint ของไฟล์ที่แก้และผ่าน)

## ผลต่อระบบและ PDF

ฐาน security-date มี workflow ที่ครบและตรวจย้อนหลังได้แล้ว แต่ paid PDF ยังไม่ควรอ้างว่า “รู้จุดซื้อ/ขายสูงสุด” เพราะ fundamentals ครอบคลุมเพียง 5.71%, EOD 4.47%, exact first-trade time 0 และ commercial data rights ยังไม่ผ่าน

ลำดับถัดไปที่เพิ่มมูลค่าจริงคือ licensed fundamentals/EOD/corporate actions, symbol lifecycle, walk-forward backtest, benchmark/transaction cost, uncertainty calibration และ legal review จากนั้นจึงให้ PDF อ่าน immutable ResearchSnapshot เดียวกับหน้าระบบ เพื่อไม่ให้แต่ละราคาให้คำตอบขัดกัน
