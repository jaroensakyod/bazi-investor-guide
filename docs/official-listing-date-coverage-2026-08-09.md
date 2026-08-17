# Official Listing Date Coverage — สถานะจริงและแผนปิดช่องว่าง

> **เอกสารประวัติ:** ตัวเลขล่าสุดและคำสั่งย้ายเครื่องอยู่ที่ `docs/official-listing-date-coverage-2026-08-10.md`

อัปเดต: 9 สิงหาคม 2569  
คำสั่งตรวจซ้ำ: `npm.cmd run research:audit -- --json`

## สรุปสำหรับผู้บริหาร

ตัวเลขที่ใช้ตัดสินว่าฐานวันเข้าตลาด “ครบ” คือ **วันจากหลักฐานทางการ** ไม่ใช่จำนวนหุ้นที่ถูกจัดหมวดงานแล้ว

| ตัวชี้วัด | ก่อน Sprint 0E | หลัง Sprint 0E | การเปลี่ยนแปลง | ยังขาด |
|---|---:|---:|---:|---:|
| ต่างประเทศ | 4,121/5,958 (69.17%) | **4,160/5,885 (70.69%)** | +39 วัน; ตัด alias ซ้ำ 73 รหัส | 1,725 |
| รวมไทย | 4,386/6,223 (70.48%) | **4,425/6,150 (71.95%)** | +39 วัน; ตัด alias ซ้ำ 73 รหัส | 1,725 |
| SIX/SWX | 38/117 | **73/117 (62.39%)** | +35 | 44 |
| B3/Bovespa | 97/174 | **101/101 (100%)** | +4 วัน; 73 odd-lot aliases ไม่นับซ้ำ | 0 |

คำว่า `classified=5,885/5,885` หมายถึงระบบรู้สถานะและงานถัดไปของหุ้นต่างประเทศทุกตัว ไม่ได้หมายถึงมีวันทางการครบทุกตัว หน้า Trust และ release gate ยังคงเป็น **partial** ตราบใดที่ `officialDateAvailable < total`

## สิ่งที่เพิ่มใน Sprint 0E

- รีเฟรช SIX จาก IPO History และ current Sponsored Foreign Shares/FQS ทั้งตาราง 708 แถว ได้ exact symbol + trading-currency match 73/117 ตัว โดยไม่มี ambiguous/invalid match
- เพิ่ม SIX official events 35 ตัว และแก้ provenance ของ `BRK` CHF/USD trading lines แบบ conflict-safe 1 รายการ
- ตรวจคู่มือ B3 ทางการแล้วพบว่า ticker ลงท้าย `F` คือ odd-lot trading code ของหลักทรัพย์เดิม ไม่ใช่บริษัทหรือหลักทรัพย์ใหม่
- เก็บ odd-lot aliases 73 รหัสไว้ให้ค้นหา แต่ resolve ไป canonical ticker และไม่นับซ้ำใน research universe/backtest/coverage
- แก้ 4 รหัสที่ catalog มีเฉพาะ odd-lot form (`MRSA6BF`, `EQPA7F`, `EQPA5F`, `EQPA6F`) เป็น canonical security code แล้วนำวันจาก B3 Listed Companies เข้า event store
- B3 จึงเป็น 101 หลักทรัพย์จริงและมีวันทางการครบ 101/101 โดยไม่ได้ลดตัวหารเพื่อซ่อนหุ้นที่ยังขาด

แหล่งหลัก:

- [SIX IPO History](https://www.six-group.com/en/market-data/shares/ipo-history.html)
- [SIX Sponsored Foreign Shares](https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html)
- [B3 Listed Companies](https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=en-us)
- [B3 Trading Procedures Manual](https://www.b3.com.br/data/files/3A/84/39/0C/7DBEE8100E866AE8AC094EA8/MPO%20de%20Negociacao%20da%20B3.pdf)

## สิ่งที่ทำให้ Bursa ครบ 117/117

- อ่าน PDF `Bursa Malaysia ISIN Equity` ทางการ 66 หน้า ตรวจ SHA-256 และสกัด 2,419 แถว
- จับคู่ `Stock Name (Short)` แบบ exact เท่านั้น ได้ 109/117 ตัว ไม่มี fuzzy match และไม่มี ambiguous match
- ตรวจประกาศ IPO/secondary listing ทางการของ Bursa เพิ่ม 6 ตัว: `ECOSHOP`, `UMSINT`, `SUNMED`, `MTTSL`, `SKYECHIP`, `STRATUS`
- ตรวจ Listing Circular ทางการสำหรับ ticker lifecycle อีก 2 ตัว: `AAX → AAGB` และ `MYEG → ZETRIX`; ใช้วันเดิมได้เฉพาะเมื่อ circular ยืนยัน old/new stock short name และ stock code เดิมไม่เปลี่ยน
- ทุก event เก็บ `localTime=null`; ไม่มีการสมมติเวลาเปิดตลาดเป็นเวลา first trade
- สิทธิ์แสดงข้อมูลเชิงพาณิชย์ยังเป็น `unknown` และต้องผ่าน legal/data-rights gate แยกจากความถูกต้องของวัน

แหล่งหลัก:

- [Bursa Malaysia ISIN Equity — 30 April 2025](https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/assets/6814a336e6414a4b168c007b/isinequity_as_of__30_Aor_2025.pdf)
- [ตัวอย่างประกาศ IPO ทางการของ SKYECHIP](https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=3666715)
- [Listing Circular AAX → AAGB](https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=3684755)
- [Listing Circular MYEG → ZETRIX](https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=3566970)

## ช่องว่าง 1,725 ตัว แยกตามสาเหตุ

| สถานะ | จำนวน | สิ่งที่ต้องทำ |
|---|---:|---|
| `catalog_venue_resolution_required` | 1,040 | แยก legacy bucket `NYSE/NASDAQ` ให้เป็น venue และ security identity ที่แน่นอนก่อน |
| `official_adapter_no_match` | 283 | reconcile ticker alias, share class, stale symbol และ historical notice โดยไม่ยืมวันข้ามหลักทรัพย์ |
| `licensed_source_required` | 227 | ทำสัญญากับ exchange/reference-data provider แล้วนำเข้าผ่าน licensed adapter |
| `provider_candidate_requires_official_verification` | 142 | ใช้ provider date เป็นคิวค้นเท่านั้น แล้วตรวจ exchange/issuer รายตัว |
| `issuer_or_exchange_research_required` | 33 | ค้น issuer filing หรือ exchange notice ของหลักทรัพย์ที่ venue ชัดแล้ว |
| **รวม** | **1,725** | ห้ามเติมวันหรือเวลาเพื่อทำให้เปอร์เซ็นต์ดูครบ |

## ช่องว่างรายตลาด

| ตลาด | มีวันทางการ | ขาด |
|---|---:|---:|
| NYSE/NASDAQ | 0/1,040 | 1,040 |
| TSX | 186/400 | 214 |
| Euronext Paris | 0/127 | 127 |
| BMV Mexico | 0/89 | 89 |
| SIX/SWX | 73/117 | 44 |
| PSX/KSE | 24/93 | 69 |
| KRX | 201/234 | 33 |
| NYSE | 2/35 | 33 |
| Saudi Exchange | 73/87 | 14 |
| PSE | 72/85 | 13 |
| NASDAQ | 8/19 | 11 |
| HKEX | 282/293 | 11 |
| SGX | 92/98 | 6 |
| LSE | 270/275 | 5 |
| ASX | 246/251 | 5 |
| NSE | 294/298 | 4 |
| SSE | 324/327 | 3 |
| TSE/JPX | 409/411 | 2 |
| TWSE | 187/188 | 1 |
| IDX | 148/149 | 1 |

## เส้นทางไป 100% ที่ไม่บิดเบือนข้อมูล

1. **แก้ US identity ก่อน:** แยก 1,040 ตัวใน `NYSE/NASDAQ` ด้วย official current identity และเก็บ identifier เดิม/ใหม่เป็น lifecycle; ขั้นนี้ยังไม่สร้าง listing date เอง
2. **ตัดสินใจงบ licensed data:** Nasdaq Historical Daily List, NYSE listing notices/event feed และ Euronext Advanced Reference Data เป็นผลิตภัณฑ์ข้อมูล ไม่ควร scrape หรือแทนด้วยวันแรกของกราฟราคา
3. **ปิด official-adapter gaps:** ทำ alias/share-class reconciliation สำหรับ TSX, SIX, PSX, KRX และตลาดที่เหลือ พร้อม conflict queue และ manual review
4. **ทำ rights registry รายแหล่ง:** ความถูกต้องของวันและสิทธิ์นำไปแสดงในรายงานขายเป็นคนละ gate
5. **เกณฑ์คำว่า “ครบ”:** ใช้ได้เมื่อ global `officialListingDate.count=6,150`, foreign `officialDateAvailable=5,885`, `unclassified=0`, conflicts=0 และ data-rights ของ use case ที่เปิดขายผ่านแล้วเท่านั้น

แหล่งที่ต้องจัดงบ/สัญญา:

- [Nasdaq Daily List Products](https://classic.nasdaqtrader.com/Trader.aspx?id=DailyListPD)
- [NYSE Listing Notices](https://www.nyse.com/market-data/corporate-actions/listing-notices)
- [NYSE Market Event Feed](https://beta.nyse.com/market-data/corporate-actions/market-event-feed)
- [Euronext Advanced Reference Data](https://www.euronext.com/en/products-services/advanced-reference-data)

## ไฟล์และคำสั่งสร้าง Bursa ซ้ำ

ไฟล์สำคัญ:

- `scripts/extract-bursa-listing-dates.py`
- `scripts/import-bursa-listing-dates.ts`
- `src/lib/research/bursa-isin-equity.ts`
- `src/lib/research/bursa-listing-announcements.ts`
- `data/staging/bursa-listing-dates.json`
- `data/curated/bursa-listing-announcements.json`
- `data/security-events.json`

หลังรับ PDF ทางการมาไว้ในเครื่อง:

```powershell
python -m pip install -r requirements-research.txt
npm.cmd run research:extract-bursa-dates -- --pdf=tmp/pdfs/bursa-isin-equity-2025-04-30.pdf --output=data/staging/bursa-listing-dates.json
npm.cmd run research:import-bursa-dates
npm.cmd run research:import-bursa-dates -- --apply
npm.cmd run research:foreign-date-ledger
npm.cmd run research:audit -- --json
```

Preview ต้องได้ `matched=117`, `unmatched=0`, `ambiguous=0`, `invalid=0`; การรัน apply ซ้ำต้องได้ `addedEvents=0`
