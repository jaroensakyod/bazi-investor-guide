# 📌 สถานะโปรเจค & ปัญหาที่ค้าง (2026-08-04)

> บันทึกนี้เขียนก่อน push ขึ้น GitHub ครั้งแรก — อัปเดตทุกครั้งที่แก้ปัญหา

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
| `45ea3c4` | **Pipeline ดึงหุ้นจริงจาก Wikipedia** (S&P500/NIFTY/HangSeng) → 715 ตัว |
| *(ยังไม่ commit)* | **ขยาย parser: ASX 200/KOSPI 200/Nikkei 225/TSX 60 → 1,146 ตัว** |

## 📊 ข้อมูลปัจจุบัน

### คลังหุ้นรวม: **ไทย 129 + โลก ~1,146 = ~1,275 ตัว**

| ตลาด | จำนวน | แหล่ง |
|---|---|---|
| 🇺🇸 สหรัฐฯ (S&P 500) | 489 | Wikipedia auto |
| 🇯🇵 ญี่ปุ่น (Nikkei 225) | 219 | Wikipedia auto + มือ |
| 🇦🇺 ออสเตรเลีย (ASX 200) | 175 | Wikipedia auto + มือ |
| 🇰🇷 เกาหลีใต้ (KOSPI 200) | 106 | Wikipedia auto + มือ |
| 🇮🇳 อินเดีย (NIFTY 50) | 53 | Wikipedia auto + มือ |
| 🇨🇦 แคนาดา (TSX 60) | 40 | Wikipedia auto + มือ |
| 🇨🇳 จีน | 35 | มือ (ADR + A-share ใหญ่) |
| 🇻🇳 เวียดนาม | 25 | มือ |
| 🇭🇰 ฮ่องกง (Hang Seng) | 4 | Wikipedia auto (parser ยังได้น้อย) |

## ⚠️ ปัญหาที่ค้าง (TODO)

### 1. 🔴 Nikkei 184 ตัว business = ชื่อตัวแรก (parser ผิดรอบแรก)
- เกิดจาก regex `\[?\[?([^\]|]+?)\]?\]?` จับ `[[Honda|Honda Motor]]` ได้แค่ "H" (ตัวแรก)
- แก้ regex แล้ว (`(?:[^\]|]+\|)?([^\]|]+?)` จับหลัง `|`) แต่ **ข้อมูล 184 ตัวที่อยู่ใน JSON แล้วไม่ถูกแก้** (merge ข้ามตัวซ้ำ)
- **วิธีแก้**: รัน `scripts/fix-nikkei-names.tmp.ts` (ถูกลบแล้ว — เขียนใหม่ตาม `scripts/fetch-wikipedia-stocks.ts` logic) รอ Wikipedia rate-limit หาย (ดึงได้ครั้งละ ~50-110 ตัว ต้องรันซ้ำ 2-3 รอบ)

### 2. 🟡 Wikipedia rate-limit (HTTP 429)
- Pipeline ใช้ Wikipedia API ฟรี — โดน rate-limit บ่อย ต้อง delay ระหว่าง request
- **ทางออกระยะยาว**: ใช้ API ราคาเชิงพาณิชย์ (หรือ Yahoo Finance ผ่าน browser flow) + cache ไว้ใน repo

### 3. 🟡 เวียดนาม (VN30) ยังหา source ไม่เจอ
- หน้า "VN30 Index" / "VN 30" ไม่มีใน en.wikipedia — ต้องหาจากแหล่งอื่น (th.wikipedia / vietstock / หน้า VNINDEX)

### 4. 🟡 Hong Kong (Hang Seng) ได้แค่ 4 ตัว
- parser รองรับ format `{{SEHK|5}}` แต่ดึงได้น้อย — ต้องตรวจ section 7 format จริงอีกครั้ง

### 5. 🟡 หุ้น auto (Wikipedia) คุณภาพต่ำกว่ามือ
- `business` = ชื่อบริษัท (ไม่มีคำอธิบายธุรกิจ) + ธาตุจาก GICS sector เฉยๆ
- **ต้องพึ่งซินแสตรวจผ่าน Review Workflow** (`review-checklist.ts export` → ตรวจ → import) ก่อน published
- ทุกตัวมี `elementSource: "Wikipedia GICS sector (auto)"` ระบุชัดเจน

## 🚀 วิธีรัน

```bash
npm install
npm run typecheck    # typecheck
npm run test         # vitest (57 เทสต์)
npm run smoke        # คำนวณดวงตัวอย่าง
npx tsx scripts/demo-investor.ts        # verdict คลังหุ้นทั้งหมด
npx tsx scripts/demo-daily-content.ts   # คอนเทนต์รายวัน 7 วัน
npx tsx scripts/fetch-wikipedia-stocks.ts  # ดึงหุ้นโลกจาก Wikipedia (merge)
npx tsx scripts/review-checklist.ts export  # สร้าง CSV ให้ซินแสตรวจธาตุ
```

## 📁 โครงสร้างสำคัญ

```
src/lib/bazi/          ← engine (คัดลอกจาก bazi-sft-dataset + แก้ยามตามซินแส)
src/lib/investor/      ← investor-tables / investor-guide / stock-database / daily-content
data/stocks/           ← thailand.json (129) + global.json (~1,146)
data/review/           ← checklist CSV ให้ซินแสตรวจ
scripts/               ← pipeline + demo + review tools
tests/                 ← 57 เทสต์ (engine/ยามซินแส/verdict/review/daily-content)
docs/                  ← product-proposal / data-spec / plan-summary
```
