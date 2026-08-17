# Sprint 0E — SIX coverage และ B3 canonical security identity

> **เอกสารประวัติ:** ตัวเลขล่าสุดและคำสั่งย้ายเครื่องอยู่ที่ `docs/official-listing-date-coverage-2026-08-10.md`

วันที่: 9 สิงหาคม 2569  
สถานะ: implementation เสร็จ; commercial/data-rights gate ยังไม่ผ่าน

## ผลลัพธ์สำหรับผู้บริหาร

รอบนี้เพิ่มวันเข้าตลาดจากหลักฐานทางการ 39 หลักทรัพย์ และแก้ฐาน B3 ไม่ให้นับ odd-lot trading code เป็นหุ้นคนละตัว

| ตัวชี้วัด | ก่อน Sprint 0E | หลัง Sprint 0E |
|---|---:|---:|
| Foreign official date | 4,121/5,958 (69.17%) | **4,160/5,885 (70.69%)** |
| Global official date | 4,386/6,223 (70.48%) | **4,425/6,150 (71.95%)** |
| SIX/SWX | 38/117 | **73/117** |
| B3/Bovespa | 97/174 catalog rows | **101/101 canonical securities** |
| Foreign missing official date | 1,837 | **1,725** |
| Unclassified evidence path | 0 | **0** |

ตัวหารลดลง 73 เพราะ B3 ticker ลงท้าย `F` เป็น odd-lot trading alias ของหลักทรัพย์เดิมตามคู่มือ B3 ไม่ใช่การลบหลักทรัพย์ที่ยังหาแหล่งไม่พบ aliases เหล่านี้ยังอยู่ใน catalog เพื่อรองรับการค้นหา แต่จะ resolve ไป canonical ticker และไม่เข้าระบบจัดอันดับ backtest หรือ coverage

## SIX

- ใช้ [SIX IPO History](https://www.six-group.com/en/market-data/shares/ipo-history.html) และ [SIX Sponsored Foreign Shares](https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html)
- เปลี่ยน FQS query จากเฉพาะปีล่าสุดเป็น current table ทั้งชุด: IPO 157 แถว + sponsored foreign shares 551 แถว
- match ด้วย exact symbol และ trading currency; `.USD` ต้องตรง USD ส่วน trading line ปกติต้องตรง currency ใน catalog
- ผลล่าสุด: 73 matched, 44 unmatched, 0 ambiguous, 0 invalid
- เพิ่ม events ใหม่ 35 รายการ และแก้วันที่/provenance ของ source URL รุ่นเก่า 1 รายการผ่าน superseded-source allowlist เท่านั้น
- ไม่สมมติเวลา first trade; `localTime=null` ทุก event

## B3

- ใช้ [B3 Listed Companies](https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=en-us) สำหรับ listing date และ exact security code
- ใช้ [B3 Trading Procedures Manual](https://www.b3.com.br/data/files/3A/84/39/0C/7DBEE8100E866AE8AC094EA8/MPO%20de%20Negociacao%20da%20B3.pdf) ยืนยันความหมายของ suffix `F` ใน odd-lot market
- 73 aliases มี canonical ticker อยู่แล้ว เช่น `PETR4F → PETR4`; เก็บไว้ค้นหาแต่ตั้ง `securityStatus=trading_alias`
- 4 identifiers ที่ไม่มี canonical row เดิมถูกแก้เป็น `MRSA6B`, `EQPA7`, `EQPA5`, `EQPA6`
- official B3 dates ครบ 101/101 canonical securities; stage match 101, unmatched 0, ambiguous 0, invalid 0
- research/detail API resolve alias ไป canonical security ก่อนอ่านราคา fundamentals และ security events

## ความปลอดภัยของข้อมูล

- importer เป็น preview-first และ atomic
- merge แบบ additive; date conflict จากแหล่งอื่นถูก block
- อนุญาต refresh/correction เฉพาะ source URL รุ่นเก่าที่ระบุชัดว่า superseded
- provider candidates ยังคงอยู่ใน quarantine และไม่ถูก promote เป็น security birth
- ความถูกต้องของวันไม่เท่ากับสิทธิ์นำข้อมูลไปขาย; B3/SIX display rights ยังเป็น `unknown` และ paid/public use ต้องผ่าน legal/data-rights gate

## ช่องว่าง 1,725 ตัวที่เหลือ

| สาเหตุ | จำนวน |
|---|---:|
| ต้อง resolve US venue/security identity | 1,040 |
| official adapter จับ exact security ไม่ได้ | 283 |
| ต้องใช้ licensed source | 227 |
| provider candidate รอ official verification | 142 |
| ต้องค้น issuer/exchange รายตัว | 33 |
| **รวม** | **1,725** |

งานถัดไปที่มีผลมากที่สุดคือ US identity 1,040 ตัว, TSX 214 ตัว, Euronext 127 ตัว, BMV 89 ตัว, PSX 69 ตัว และ SIX ที่เหลือ 44 ตัว ห้ามใช้วันแรกของกราฟราคาแทนวันเข้าตลาด

## ไฟล์หลัก

- `data/stocks/global.json` — canonical rows + searchable B3 aliases
- `data/security-events.json` — canonical event store
- `data/staging/six-listing-dates.json` — SIX compact official snapshot
- `data/staging/b3-company-dates.json` — B3 compact official snapshot
- `data/staging/foreign-date-coverage-ledger.json` — ledger 5,885 records
- `scripts/normalize-b3-odd-lot-aliases.ts` — migration ที่รันซ้ำได้
- `scripts/fetch-six-listing-dates.ts` — official SIX fetch/compact snapshot
- `scripts/stage-official-foreign-events.ts` — multi-source preview/apply
- `src/lib/research/security-event-store.ts` — conflict-safe merge
- `src/lib/investor/stock-database.ts` — researchable/alias identity rules
- `src/app/trust/page.tsx` — coverage UI จาก readiness audit จริง

## คำสั่งสร้างซ้ำ

```powershell
npm ci
npm.cmd run research:normalize-b3-aliases
npm.cmd run research:fetch-six-dates -- --refresh
npm.cmd run research:stage-official-foreign-events -- --jpx-input=data/staging/jpx-company-dates.json --lse-input=data/staging/lse-instrument-dates.json --pse-input=data/staging/pse-company-dates.json --tadawul-input=data/staging/tadawul-company-dates.json --idx-input=data/staging/idx-company-dates.json --vietnam-input=data/staging/vietnam-company-dates.json --sgx-input=data/staging/sgx-company-dates.json --hkex-input=data/staging/hkex-company-dates.json --b3-input=data/staging/b3-company-dates.json --psx-input=data/staging/psx-listing-dates.json --six-input=data/staging/six-listing-dates.json --xetra-input=data/staging/xetra-listing-dates.json --xetra-instrument-input=data/staging/xetra-instrument-dates.json --tsx-input=data/staging/tsx-listing-dates.json --bist-input=data/staging/bist-listing-dates.json --jse-input=data/staging/jse-listing-dates.json --apply
npm.cmd run research:foreign-date-ledger
npm.cmd run research:audit -- --json
```

ค่าที่ต้องได้จาก canonical data ชุดนี้:

- B3 `101/101`; SIX `73/117`
- foreign ledger `5,885/5,885 classified`, official `4,160`, missing `1,725`
- global researchable `6,150`, official `4,425 (71.95%)`
- idempotent apply: `added=0`, `refreshed=0`, `correctedDates=0`, `conflicts=[]`

## QA ณ จุดส่งมอบ

- `npm.cmd test`: 79 test files / 425 tests ผ่าน
- `npm.cmd run typecheck`: ผ่าน
- targeted ESLint ของไฟล์ที่แก้: ผ่าน
- `npm.cmd run build`: Next.js production build ผ่าน
- `git diff --check`: ผ่าน; มีเฉพาะคำเตือน line-ending ของ worktree เดิมบน Windows
- Browser QA production `/trust`: ตัวเลข B3/SIX/global/missing ตรงกับ audit และไม่มี root horizontal overflow
- production review server: `http://127.0.0.1:3000/trust#coverage-title`
