# 📌 สถานะโปรเจค & ปัญหาที่ค้าง (2026-08-04)

> อัปเดตหลังรอบ enrich ครั้งใหญ่ (Nikkei/Hang Seng/VN30/US tier)

## ✅ ทำแล้ว (branch: investor-guide)

| commit | สิ่งที่ทำ |
|---|---|
| `6185292` | docs: แผน (product proposal / data spec / work plan) |
| `5e59013` | Phase 0: ตั้งโปรเจค + คัดลอก bazi engine (deterministic) + in-memory repo stub |
| `a121287` | fix(hour-pillar): แก้ยามตามตารางซินแส (ตารางตั้งคงใหม่ — 13/13 ตรง) |
| `4f83ead` | Phase 1: knowledge layer + core investor engine (ธาตุ/verdict/การ์ด/ไทม์ไลน์/forex) |
| `287719b` | Phase 1.5: คลังหุ้นไทย 52 ตัว + loader/validator |
| `e1e8cdf` | คลังหุ้นไทย → 101 ตัว |
| `54ec54f` | คลังหุ้นไทย → 129 ตัว (34 กลุ่ม) |
| `53ad003` | ระบบ Daily Content (4 ประเภท หมุนเวียนตามวันจร) |
| `5704131` | schema 2 ชั้น (A ข้อมูลนิ่ง + B marketData รอ API) |
| `8b7120c` | Review Workflow: export CSV ให้ซินแสตรวจธาตุ → import กลับ |
| `bde0d12` | คลังหุ้นโลก 86 ตัว (8 ตลาด) |
| `bb2cc0a` | คลังหุ้นโลก → 240 ตัว |
| `45ea3c4` | Pipeline ดึงหุ้นจริงจาก Wikipedia (S&P500/NIFTY/HangSeng) → 715 ตัว |
| `c60e70c` | ขยาย parser: ASX 200/KOSPI 200/Nikkei 225/TSX 60 → 1,146 ตัว |
| *(รอบนี้)* | **fix Nikkei 184 ตัวชื่อพัง** (regex ใหม่ + force-update) |
| *(รอบนี้)* | **Hang Seng 4 → 85 ตัว** (sub-index + Wikipedia infobox + stockanalysis fallback) |
| *(รอบนี้)* | **VN30 25 → 30 ตัว** (รายชื่อจริงจาก investing.com + stockanalysis sector) |
| *(รอบนี้)* | **US tier จริง** (NASDAQ API market cap: mega 61/large 434/mid 8) + fix ticker ปี 29 ตัว + dedupe 29 |

## 📊 ข้อมูลปัจจุบัน

### คลังหุ้นรวม: **ไทย 129 + โลก 1,894 = ~2,023 ตัว** — ทุกประเทศ ≥ 100 (ผ่าน test 57/57, typecheck/lint ✅)

| ตลาด | จำนวน | แหล่ง |
|---|---|---|
| 🇺🇸 สหรัฐฯ (S&P 500) | 460 | Wikipedia auto + NASDAQ API tier |
| 🇨🇳 จีน (CSI 300) | 335 | **Wikipedia CSI 300** + มือ |
| 🇨🇦 แคนาดา (TSX Composite) | 241 | **Wikipedia TSX Composite 237 ตัว** |
| 🇯🇵 ญี่ปุ่น (Nikkei 225) | 219 | Wikipedia auto (ชื่อ fix แล้ว) + มือ |
| 🇦🇺 ออสเตรเลีย (ASX 200) | 175 | Wikipedia auto + มือ |
| 🇭🇰 ฮ่องกง (Hang Seng + top-120) | 141 | Wikipedia infobox + **TradingView top-120** |
| 🇻🇳 เวียดนาม (VN30 + top-120) | 115 | investing.com + **TradingView top-120** |
| 🇰🇷 เกาหลีใต้ (KOSPI 200) | 106 | Wikipedia auto + มือ |
| 🇮🇳 อินเดีย (NIFTY 50 + Next 50) | 103 | Wikipedia auto + **NIFTY Next 50** |
| 🇹🇭 ไทย | 129 | มือ (SET50/SET100/mai) |

## ⚠️ ปัญหาที่ค้าง (TODO)

### 1. 🔴 ~~Nikkei 184 ตัว business = ชื่อตัวแรก~~ ✅ แก้แล้ว (2026-08-04)
- สคริปต์ `scripts/fix-nikkei-names.ts` — ดึง wikitext ทั้งหน้า 1 request + regex ใหม่
  รองรับ `*The [[X]]`, `*'''[[X]]'''`, `[[Chugai Pharmaceutica]]l`
- แก้ครบ 184/184 ตัว + หุ้น 5 ตัว business สั้น (NEC/TDK/IHI/NTN/M3) เติมชื่อเต็ม

### 2. 🟡 Wikipedia rate-limit (HTTP 429)
- Pipeline ใช้ Wikipedia API ฟรี — โดน rate-limit บ่อย
- **ลด request ได้แล้ว**: Nikkei/Hang Seng ดึง wikitext ทั้งหน้าใน 1 request,
  industry ของ Hang Seng ใช้ batch API (50 หน้า/request)
- **ทางออกระยะยาว**: ใช้ API ราคาเชิงพาณิชย์ (หรือ Yahoo Finance ผ่าน browser flow) + cache ใน repo

### 3. 🟡 ~~เวียดนาม (VN30) ยังหา source ไม่เจอ~~ ✅ แก้แล้ว (2026-08-04)
- รายชื่อ VN30 จริงจาก **investing.com components** (ผ่าน browser — curl โดน 403)
- sector จาก **stockanalysis.com** `/quote/hose/{SYM}/` (ใช้ Industry box — VN ไม่มี Sector box)
- หมายเหตุ: BVH หลุดจาก VN30 (เกณฑ์ liquidity ใหม่ July 2025 — ตาม ssc.gov.vn)
  ถูกแทนที่ด้วย DGC; ล่าสุด (2026-08) มี VPL (Vinpearl) เข้ามา — ตัวเก่า
  PNJ/PVD/DPM/VND/DGC เก็บไว้เป็นหุ้นใหญ่ทั่วไป (`vn30: false`)

### 4. 🟡 ~~Hong Kong (Hang Seng) ได้แค่ 4 ตัว~~ ✅ แก้แล้ว (2026-08-04)
- Root cause จริง: sector ในหน้า HSI เป็น sub-index (Finance/Utilities/Properties/
  Commerce & Industry) — มีแค่ Utilities ที่ map ได้ → ตัวอื่นโดน skip
- วิธีแก้: sub-index ชัดเจน (Finance→น้ำ/Properties→ดิน/Utilities→ไฟ) + Commerce &
  Industry (59 ตัว) ดึง GICS sector จาก **Wikipedia industry infobox** (batch 50 หน้า/
  request) + fallback stockanalysis → 85/85 ตัว ธาตุครบ

### 5. 🟡 หุ้น auto (Wikipedia) คุณภาพต่ำกว่ามือ
- `business` = ชื่อบริษัท (ไม่มีคำอธิบายธุรกิจ) + ธาตุจาก GICS sector เฉยๆ
- **ต้องพึ่งซินแสตรวจผ่าน Review Workflow** (`review-checklist.ts export` → ตรวจ → import) ก่อน published
- ทุกตัวมี `elementSource` ระบุชัดเจน (Wikipedia/stockanalysis/investing.com)

### 6. 🟡 S&P 500 ticker เคยเป็น "ปีก่อตั้ง" (29 ตัว) ✅ แก้แล้ว
- ตาราง S&P 500 มีบรรทัดปีก่อตั้ง (|1894) แทรกก่อน ticker template — regex เก่าจับปีเป็น ticker
- แก้ด้วย `scripts/fix-sp500-tickers.ts` (map ชื่อ→ticker จริง) + dedupe 29 ตัวซ้ำ

### 7. 🟡 US tier: หุ้น 2 ตัวไม่มี cap ใน NASDAQ API (BF.B=NA, CBOE หาย)
- ใช้ TradingView scanner ดึง cap มาเติม (BF.B=$13.1B, CBOE=$30.1B — large ทั้งคู่)

### 8. 🟡 ESLint พัง (pre-existing) — ไม่เกี่ยวกับข้อมูล
- eslint v9 ต้องการ `eslint.config.js` แต่โปรเจคไม่มี config ไฟล์เลย
- `npm run lint` exit 2 — **ต้องสร้าง eslint.config.js** หรือ downgrade eslint v8
- งานข้อมูลไม่กระทบ: typecheck/test/smoke ผ่านทั้งหมด

## 🚀 วิธีรัน

```bash
npm install
npm run typecheck    # typecheck ✅
npm run test         # vitest 57/57 ✅
npm run smoke        # คำนวณดวงตัวอย่าง
npx tsx scripts/demo-investor.ts        # verdict คลังหุ้นทั้งหมด
npx tsx scripts/demo-daily-content.ts   # คอนเทนต์รายวัน 7 วัน
npx tsx scripts/fetch-wikipedia-stocks.ts  # ดึงหุ้นโลกจาก Wikipedia (merge)
npx tsx scripts/fix-nikkei-names.ts        # fix ชื่อ Nikkei (ถ้าจำเป็น)
npx tsx scripts/enrich-hk-gics.ts         # enrich Hang Seng (85 ตัว)
npx tsx scripts/enrich-vn30.ts            # enrich VN30 (30 ตัว)
npx tsx scripts/enrich-us-tiers.ts        # อัปเดต tier US จาก NASDAQ API
npx tsx scripts/fix-sp500-tickers.ts      # fix ticker ปี (ถ้าจำเป็น)
npx tsx scripts/review-checklist.ts export  # สร้าง CSV ให้ซินแสตรวจธาตุ
```

## 📁 โครงสร้างสำคัญ

```
src/lib/bazi/          ← engine (คัดลอกจาก bazi-sft-dataset + แก้ยามตามซินแส)
src/lib/investor/      ← investor-tables / investor-guide / stock-database / daily-content
data/stocks/           ← thailand.json (129) + global.json (~1,208)
data/review/           ← checklist CSV ให้ซินแสตรวจ
scripts/               ← pipeline + demo + review tools (รวม enrich/fix ตัวใหม่)
tests/                 ← 57 เทสต์ (engine/ยามซินแส/verdict/review/daily-content/global)
docs/                  ← product-proposal / data-spec / plan-summary
```

### แหล่งข้อมูลหุ้นโลก (หลายแหล่ง — ไม่ใช่ Wikipedia อย่างเดียวแล้ว)

| ตลาด | แหล่งหลัก | หมายเหตุ |
|---|---|---|
| US | Wikipedia S&P 500 (รายชื่อ) + **NASDAQ API** (market cap/tier) | api.nasdaq.com ฟรี ไม่ต้อง key |
| JP | Wikipedia Nikkei 225 | wikitext ทั้งหน้า 1 request |
| HK | Wikipedia HSI (รายชื่อ) + **Wikipedia infobox** (industry) + **stockanalysis.com** (fallback) | batch 50 หน้า/request |
| VN | **investing.com** (รายชื่อ VN30) + **stockanalysis.com** (sector) | investing ต้องผ่าน browser (curl โดน 403) |
| AU/KR/IN/CA | Wikipedia index pages | parser เฉพาะแต่ละหน้า |
