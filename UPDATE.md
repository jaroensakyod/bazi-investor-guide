# 📝 UPDATE.md — สมุดอัปเดตแผน/โปรเจค

> สมุดบันทึกความคืบหน้า — ดูคู่กับแผนเต็ม: `.hermes/plans/2026-08-05_ai-investor-chat.md`
> อัปเดตทุกครั้งที่ทำงานเสร็จ / เปลี่ยนแผน / ตัดสินใจใหม่

---

## 2026-08-05 — Phase 0 (AI Investor Chat + Asia-First)

### ✅ ตัดสินใจแล้ว (ล็อก)
- **3 ภาษา**: th/zh/en (MVP) — vi/ja/ko/id เติมทีหลัง
- **ตลาดแรกนอกไทย**: 🇹🇼 ไต้หวัน (LINE infra ใช้ร่วมได้)
- ช่องทาง: LINE ก่อน + Web (global) · LLM: DeepSeek · compliance: "แนวโน้มตามดวง + ข้อมูล"
- รับ data unofficial (Yahoo/TradingView) สำหรับ MVP → abstraction เปลี่ยน backend ได้

### 📋 ความคืบหน้า Task (Phase 0)
| Task | งาน | สถานะ |
|---|---|---|
| 0.1 | marketData fetcher (Yahoo quoteSummary) | ✅ **ราคาจริง 1,937/1,955 ตัว** — snapshot `data/cache/market/<date>.json` + merge runtime · 11 เทสต์ |
| 0.2 | Today movers (TradingView scanner) | ✅ **ใช้ snapshot แทน scanner** (ดีกว่าแผน: ตรงคลัง + ไม่เปลือง request) — `topMovers()` เรียง gainers/losers + กรองตลาด + ตรงธาตุ |
| 0.3 | IPO pipeline | ✅ **StockAnalysis calendar** (curl ได้) — 8 IPO จริง (US) · **หมายเหตุ: TradingView `ipo_date` = dead ใน free tier** (null เสมอ) · Asia IPO = Investing.com browser (TODO) |
| 0.4 | News RSS + data/events.json | ✅ **3 feed จริง** (Yahoo/Investing/MarketWatch) — 61 ข่าว/วัน + classify keyword→เซกเตอร์→ธาตุ + FOMC 2026 seed · 9 เทสต์ |
| 0.5 | Fundamentals + buffett-checks | ✅ **Yahoo financialData จริง 61 ตัว** (ROE/margin/growth — แก้ {raw} format) + Buffett checklist 5 ข้อ + score · 7 เทสต์ |
| 0.6 | ขยายคลังไทย 129 → ~250 | ✅ **129 → 272 ตัว** (TradingView SET top-250) — tier SET50 52/SET100 93/mai 16/mid 111 · desc 263 · ธาตุ ไม้12/น้ำ147/ไฟ47/ดิน26/ทอง40 |
| 0.7–0.8 | Hidden Gems screener + risk gating ตามกำลังดวง | ✅ **ได้จริง 5 ตัว** (BILI/PLANB/SAPPE/FDS/NCLH ตามดวงตัวอย่าง) — underwater 100/80 + tier 🟢🟡🔴 + ดวงอ่อนเห็นแค่ 🟢 · 10 เทสต์ |
| 0.9–0.10 | Asset universe (commodities) + price fetchers | ✅ **27 รายการ** (ทอง/เงิน/น้ำมัน/ก๊าซ/คริปโต/ETF/REIT/บอนด์/ฝาก/forex/กองทุน/อนุพันธ์) + ราคาจริง 26 ตัว merge snapshot (ทอง $4,221/BTC $64K/SPY $771) |
| 0.11–0.12 | Asset verdict + จัดพอร์ตตามธาตุ | ✅ verdict ธาตุ fit+ momentum + tier gate (🔴 ไม่มี verdict) · จัดพอร์ตบท 13: กันชนตามกำลัง + ธาตุหลัก 1.5× + เก็งกำไรเฉพาะดวงแข็ง · demo จริง (ไม้36/น้ำ24/กันชน30/เก็ง10) |
| 0.13–0.14 | Real assets (สลาก/ที่ดิน/สวนยาง/พระเครื่อง...) + สิ่งที่ห้าม | ✅ **19 รายการ** (บ้านเช่า/ที่ดิน/สวนยาง/ป่า/ฟาร์ม/สลาก/ทองก้อน/พระเครื่อง/ประกันสะสมทรัพย์) + forbidden 5 (ห้องแชร์/พนัน/ของปลอม → verdict avoid เสมอ) · ธาตุเสนอ→รอซินแส |
| 0.15 | Universe เอเชีย +5 ตลาด (TW/SG/ID/MY/PH) | ✅ **+337 ตัว** (TW 100/SG 59/ID 60/MY 60/PH 58) → คลังรวม 2,231 + ไทย 272 = **2,503 รายการ** · ทิศ→ธาตุตลาด รอซินแส · MY/PH description เติมผ่าน Wikipedia (background) |
| +0.16 | Universe ยุโรป 4 (GB/DE/FR/CH) — ต่อยอด Asia-First (ฉบับ EN ต้องมีตลาดพัฒนาแล้ว) | ✅ **+300 ตัว** (GB 93/DE 76/FR 73/CH 58) → **รวม 2,531 + ไทย 272 = 2,803 รายการ** · is_primary filter (ตัด NVDA บน Xetra) · suffix .L/.DE/.PA/.SW · ทิศ→ธาตุตลาด รอซินแส |
| +0.17 | Universe ชุด 3 (PK/SA/BR) + dedupe 68 ตัวซ้ำ | ✅ **+194 ตัว** (PK 57/SA 57/BR 80 — Aramco/Al Rajhi/Petrobras/Vale) → **รวม 2,657 + ไทย 272 = 2,929 รายการ (21 ตลาด)** · market code ซาอุฯ = `ksa` (ไม่ใช่ saudi-arabia) · suffix .PK/.SR/.SA · PK desc รอ Wikipedia (background) · dedupe: 700.HK vs 0700.HK/601398 vs .SS/RY vs .TO (เก็บ canonical) + fix findQuote (7203@TADAWUL ชน 7203.T) |
| +0.18 | Universe LatAm/Africa (MX/TR/ZA) — 21 → 24 ตลาด | ✅ **+174 ตัว** (MX 58 — GMEXICO.B class share /TR 60 — Aselsan/QNB /ZA 56 — Naspers/Capitec) → **รวม 2,831 + ไทย 272 = 3,103 รายการ (24 ตลาด)** · market code แอฟริกาใต้ = `rsa` (ไม่ใช่ south-africa) · suffix .MX/.IS/.JO + BMV class-share .B.MX · TR/ZA desc 100% (MX 16/58) · **เจอบทเรียน: อย่ารัน enrich 2 ตัวคู่ขนาน — script โหลดตอนเริ่ม เขียนทับตอนจบ (stale write)** |

### 🔀 การตัดสินใจระหว่างทำ (deviation log)
- **Movers**: แผนเดิม = TradingView scanner → เปลี่ยนเป็นอ่านจาก market snapshot (ข้อมูลตรงคลัง มีธาตุครบ ไม่เปลือง request) — `src/lib/market/movers.ts`
- **IPO แหล่งข้อมูล**: TradingView scanner ฟิลด์ `ipo_date` คืน null เสมอ (free tier ตาย) → ใช้ `stockanalysis.com/ipos/calendar/` (curl ได้ ไม่มี key — ครอบ US) · เอเชียต้อง Investing.com browser (TODO)
- **Fundamentals เป้าหมาย**: ต้องเก็บทั้งตัวใหญ่ (รายงาน) + ตัวกลาง-เล็ก (hidden gems — ไม่งั้นใต้ผืนน้ำได้ 0 ตัว)

### 🧰 RUNBOOK — ปัญหาที่เจอ + วิธีแก้ (อ่านก่อนทำงาน/เครื่องใหม่)

**สกิลที่ต้องโหลดก่อนทำงานโปรเจคนี้**: `bazi-engine-development` (engine/ยามซินแส/pipeline) · `bazi-product-development` (schema/review/daily-content) · `thai-text-processing` (regex ไทย) · วางแผน: `plan`/`writing-plans`

**ลำดับรัน pipeline (ต้องเรียง):**
```bash
npx tsx scripts/fetch-market-data.ts      # ราคา → data/cache/market/<date>.json (1,900+ ตัว)
npx tsx scripts/fetch-fundamentals.ts     # พื้นฐาน → data/cache/fundamentals.json (resumable ใหญ่40+กลางเล็ก160/รอบ)
npx tsx scripts/fetch-news.ts             # ข่าว → data/news.json
npx tsx scripts/ipo-pipeline.ts           # IPO → data/ipo.json
npx tsx scripts/hidden-gems.ts --birth ... --time ... --gender ...   # ใต้ผืนน้ำ
npm run typecheck && npm test             # 108+ เทสต์
```

| # | ปัญหา | วิธีแก้ (ราก) | ไฟล์ |
|---|---|---|---|
| 1 | **Yahoo v10 ส่งค่าเป็น `{raw, fmt}` object ไม่ใช่ number** — normalize ได้ undefined เงียบๆ | แกะ `.raw` ใน normalize (รองรับทั้ง number ตรงและ object) + เทสต์ล็อก format | `market/fundamentals.ts` |
| 2 | **เทสต์เขียนทับข้อมูลจริง** — saveSnapshot เขียน `latest.json` ทับด้วย fixture → ราคาปลอมทั้งคลัง | เพิ่ม param `dir` ให้ save/loadSnapshot — เทสต์ใช้ `os.tmpdir()` เสมอ (hermetic) | `market/market-data.ts` + tests |
| 3 | **TradingView `ipo_date` = dead ใน free tier** (null เสมอ) | สลับแหล่ง: `stockanalysis.com/ipos/calendar/` (curl ได้ ฟรี) — Asia = Investing.com browser (TODO) | `investor/ipo.ts` |
| 4 | **TV market code**: US = `america` (ไม่ใช่ `us`) · ไทย = `thailand`/exchange `SET` (MAI ได้ 0 — ยังไม่เจอชื่อจริง) | ใช้ `america`/`thailand` — debug ด้วย .tmp script | `scripts/expand-thai-universe.ts` |
| 5 | **TV sector ต่างจาก GICS** — ใช้ชื่อ `Communications`/`Consumer Services` ไม่ใช่ชื่อ GICS | ขยาย `sector-elements.ts` เฉพาะที่มี precedent ใน GICS เดิม (ไม่เดา) + debug ดู sector จริง | `market/sector-elements.ts` |
| 6 | **Hidden gems ได้ 0 ตัว** — fundamentals cache มีแต่หุ้นใหญ่ แต่ใต้ผืนน้ำ = ตัวกลาง-เล็ก | fetch-fundamentals เก็บ ใหญ่ 40 + กลาง-เล็ก 160 (resumable — รันซ้ำเติมได้) | `scripts/fetch-fundamentals.ts` |
| 7 | **repo export ชื่อ**: `inMemoryRepository` ไม่มีจริง — เป็น `createInMemoryKnowledgeRepository()` | grep export จริงก่อน import | `bazi/in-memory-repository.ts` |
| 8 | **read_file ตีไฟล์ไทยเป็น binary** (Thai-heavy UTF-8) | ใช้ terminal `grep`/`sed -n` แทน read_file | ทุกไฟล์ data/src |
| 9 | **Windows CRLF/LF** — node/python เขียน LF → git เห็นทั้งไฟล์ diff (warning ธรรมดา) | ไม่ต้องแก้ — ถ้า conflict ใช้ `git checkout --ours/theirs` เลือกฝั่งที่ถูก | — |
| 10 | **patch tool ใช้ relative path พลาดเมื่อ terminal cwd เปลี่ยน** (เช่น cd /tmp) | ใช้ absolute path `C:\Users\ASUS\Desktop\biz\bazi-investor-guide\...` เสมอ | — |
| 11 | **node -e / sed pipeline โดน approval/blocklist** | เขียน `.tmp-xxx.ts` แล้วลบหลังใช้ (ตาม convention โปรเจค) — อย่าใช้ one-liner ซับซ้อน | scripts/.tmp-* |
| 12 | **ทิศ→ธาตุตลาด 5 ตลาดใหม่ + ธาตุ ปศุสัตว์/พระเครื่อง/สลาก/คาร์บอน** | ยังไม่ตัดสิน — **รอซินแส** (decision-log) | — |
| 13 | **Yahoo v10 ไม่บริการ .KL/.PS/.SI (assetProfile null)** — แต่ 2330.TW ได้ | ใช้ Wikipedia enrich (`enrich-descriptions.ts`) เป็น fallback สำหรับตลาดที่ Yahoo ตาย + เพิ่ม `lang=en-US&region=US` | `scripts/enrich-descriptions.ts` |
| 14 | **มาเลเซีย exchange code บน TradingView = `MYX`** (ไม่ใช่ KLSE/BURSA) | ใช้ `MYX` — debug ด้วย .tmp script | `scripts/expand-asia-universe.ts` |
| 15 | **Description ผิดคนละบริษัท** (suffix map เก่า → Yahoo ดึง US ticker แทน เช่น SDG=กองทุนUS/TM=Toyota) | cleanup: เทียบ `businessEvidence.url` กับ `yahooTicker()` ที่ควรเป็น — ไม่ตรง = ลบ · และ refactor ให้ enrich import yahooTicker จาก canonical module (ห้าม copy map) | `market/yahoo.ts` |

**เปลี่ยนเครื่องใหม่**: `npm install` (node 20+) · ข้อมูลทั้งหมด commit ใน repo แล้ว (cache/ราคา/ข่าว/IPO) — ไม่ต้องพึ่ง network · ไม่มี secret ใน repo (LLM key ใส่ `.env` ตอน Phase 1+) · อ่าน `UPDATE.md` + `.hermes/plans/2026-08-05_ai-investor-chat.md` + `KNOWN-ISSUES.md` ก่อน

### 🧾 คิวถามซินแส (decision-log — รวบรวมถามรอบเดียว)
- [ ] ธาตุ: ปศุสัตว์(หมู/ไก่/โค) · พระเครื่อง · สลากออมสิน · คาร์บอนเครดิต · งานศิลปะ
- [ ] ทิศ→ธาตุตลาด 5 ตลาดใหม่ (TW/SG/ID/MY/PH)
- [ ] review ธาตุหุ้นไทย 129 ตัว (CSV รอส่ง — `npx tsx scripts/review-checklist.ts export`)
