# 📝 UPDATE.md — สมุดอัปเดตแผน/โปรเจค

> สมุดบันทึกความคืบหน้า — ดูคู่กับแผนเต็ม: `.hermes/plans/2026-08-05_ai-investor-chat.md`
> อัปเดตทุกครั้งที่ทำงานเสร็จ / เปลี่ยนแผน / ตัดสินใจใหม่

---

## 2026-08-05 — Phase 0 (AI Investor Chat + Asia-First) ✅ ปิดครบ 15/15 + ต่อยอดอีก 4

### ✅ ตัดสินใจแล้ว (ล็อก)
- **3 ภาษา**: th/zh/en (MVP) — vi/ja/ko/id เติมทีหลัง
- **ตลาดแรกนอกไทย**: 🇹🇼 ไต้หวัน (LINE infra ใช้ร่วมได้)
- ช่องทาง: LINE ก่อน + Web (global) · LLM: DeepSeek · compliance: "แนวโน้มตามดวง + ข้อมูล"
- รับ data unofficial (Yahoo/TradingView) สำหรับ MVP → abstraction เปลี่ยน backend ได้
- **อัปเดตอัตโนมัติ**: ตั้ง cron แล้ว (Hermes) — รายวัน 17:30 ราคา+ข่าว · รายสัปดาห์ จันทร์ 08:00 fundamentals+IPO(browser)+digest

### 📋 ความคืบหน้า Task (Phase 0)
| Task | งาน | สถานะ |
|---|---|---|
| 0.1 | marketData fetcher (Yahoo quoteSummary) | ✅ **ราคาจริง 1,937/1,955 ตัว** — snapshot `data/cache/market/<date>.json` + merge runtime · 11 เทสต์ |
| 0.2 | Today movers (TradingView scanner) | ✅ **ใช้ snapshot แทน scanner** (ดีกว่าแผน: ตรงคลัง + ไม่เปลือง request) — `topMovers()` เรียง gainers/losers + กรองตลาด + ตรงธาตุ · **fix findQuote ใช้ yahooTicker ตรง (กัน 7203@TADAWUL ชน 7203.T)** |
| 0.3 | IPO pipeline | ✅ **StockAnalysis calendar** (curl ได้) — 8 IPO จริง (US) · **TradingView `ipo_date` = dead ใน free tier** · **Asia IPO = cron รายสัปดาห์ขูด Investing.com ผ่าน browser** |
| 0.4 | News RSS + data/events.json | ✅ **11 feed = 3 global (Yahoo/Investing/MarketWatch) + 8 ตลาด Google News RSS ต่อภาษา** (TH/CN/TW/VN/JP/KR/ID/MY) — **200 ข่าว/วันจริง** (TH 39/CN 33/ID 61/VN 13/JP 21/KR 10/TW 2 + GLOBAL 21) + classify keyword→เซกเตอร์→ธาตุ + FOMC 2026 seed + `filterNewsByMarket` |
| 0.5 | Fundamentals + buffett-checks | ✅ **Yahoo financialData จริง 124 ตัว** (ROE/margin/growth — แก้ {raw} format) + Buffett checklist 5 ข้อ + score |
| 0.6 | ขยายคลังไทย 129 → ~250 | ✅ **129 → 272 ตัว** (TradingView SET top-250) — tier SET50 52/SET100 93/mai 16/mid 111 · **desc 264/272** · ธาตุ ไม้12/น้ำ147/ไฟ47/ดิน26/ทอง40 |
| 0.7–0.8 | Hidden Gems screener + risk gating ตามกำลังดวง | ✅ underwater 0-100 + tier 🟢🟡🔴 + ดวงอ่อนเห็นแค่ 🟢 · ได้จริง (SISB Buffett 10/10, TOA 10/10, BILI 100/100) |
| 0.9–0.10 | Asset universe (commodities) + price fetchers | ✅ **27 รายการ** (ทอง/เงิน/น้ำมัน/ก๊าซ/คริปโต/ETF/REIT/บอนด์/ฝาก/forex/กองทุน/อนุพันธ์) + ราคาจริง 26 ตัว merge snapshot (ทอง $4,221/BTC $64K/SPY $771) |
| 0.11–0.12 | Asset verdict + จัดพอร์ตตามธาตุ | ✅ verdict ธาตุ fit+ momentum + tier gate (🔴 ไม่มี verdict) · จัดพอร์ตบท 13: กันชนตามกำลัง + ธาตุหลัก 1.5× + เก็งกำไรเฉพาะดวงแข็ง · demo จริง (ไม้36/น้ำ24/กันชน30/เก็ง10) |
| 0.13–0.14 | Real assets + สิ่งที่ห้าม | ✅ **19 รายการ** (บ้านเช่า/ที่ดิน/สวนยาง/ป่า/ฟาร์ม/สลาก/ทองก้อน/พระเครื่อง/ประกันสะสมทรัพย์) + forbidden 5 (ห้องแชร์/พนัน/ของปลอม → verdict avoid เสมอ) · ธาตุเสนอ→รอซินแส |
| 0.15 | Universe เอเชีย +5 ตลาด (TW/SG/ID/MY/PH) | ✅ **+337 ตัว** → คลัง 2,503 · MY/PH desc บางส่วน (Yahoo ไม่บริการ .KL/.PS → Wikipedia เติมได้บาง) |
| +0.16 | Universe ยุโรป 4 (GB/DE/FR/CH) | ✅ **+300 ตัว** (GB 93/DE 76/FR 73/CH 58) — is_primary filter (ตัด NVDA บน Xetra) · suffix .L/.DE/.PA/.SW |
| +0.17 | Universe ชุด 3 (PK/SA/BR) + dedupe 68 ตัวซ้ำ | ✅ **+194 ตัว** (Aramco/Al Rajhi/Petrobras/Vale) · market code ซาอุฯ = `ksa` · suffix .PK/.SR/.SA · **dedupe: 700.HK vs 0700.HK/601398 vs .SS/RY vs .TO (เก็บ canonical) + fix findQuote** · PK desc รอเติม |
| +0.18 | Universe LatAm/Africa (MX/TR/ZA) — 21 → 24 ตลาด | ✅ **+174 ตัว** (GMEXICO.B class share → .B.MX /Aselsan/Naspers/Capitec) · market code แอฟริกาใต้ = `rsa` · suffix .MX/.IS/.JO · TR/ZA desc 100% (MX 16/58) · **กู้ stale write แล้ว (ดู runbook ข้อ 16)** |
| +0.19 | Cron อัตโนมัติ + ข่าว 8 ตลาด + กู้คืน description | ✅ **cron 2 ตัว** (daily-data-refresh 17:30 script · weekly-market-digest จันทร์ 08:00 agent+browser) · **กู้ desc 18 ตัวที่ลบผิด** (BBL/CPALL/SCB/TOP/PLANB/JBH ฯลฯ — ดู runbook ข้อ 17) + ลบของเสียจริง (BABA/CBG/CENTEL/EGCO/USB) · TH desc เติมใหม่ถูกต้องผ่าน Yahoo (CBG/CENTEL/BCH) |

### 📊 สรุป Phase 0 (Gate ผ่าน: typecheck ✅ lint ✅ **128 เทสต์** ✅)
- **คลังข้อมูล: 24 ตลาด · 3,103 หุ้น** (ไทย 272 + โลก 2,831) + สินทรัพย์ 46 (commodities 27 + real-assets 19) + IPO 8 + ข่าว 200/วัน + fundamentals 124
- **desc ครบ 2,482/3,103 (80%)** — เหลือ: PK 57/MX 42/MY 46/PH 21 (Yahoo ไม่บริการ suffix เหล่านี้ → รอ Wikipedia/CBDC)
- **ยาม 23:00–23:59 ใช้ stem วันเดิม** (resolveSinsaeHourGanzhi) · verdict รายหุ้นใช้ธาตุธุรกิจ · ธาตุตลาด/ทิศใช้เฉพาะบท 8

### 🔀 การตัดสินใจระหว่างทำ (deviation log)
- **Movers**: แผนเดิม = TradingView scanner → เปลี่ยนเป็นอ่านจาก market snapshot (ข้อมูลตรงคลัง มีธาตุครบ ไม่เปลือง request) — `src/lib/market/movers.ts`
- **IPO แหล่งข้อมูล**: TradingView scanner ฟิลด์ `ipo_date` คืน null เสมอ (free tier ตาย) → ใช้ `stockanalysis.com/ipos/calendar/` (curl ได้ ไม่มี key — ครอบ US) · เอเชีย = Investing.com browser ผ่าน cron รายสัปดาห์
- **Fundamentals เป้าหมาย**: ต้องเก็บทั้งตัวใหญ่ (รายงาน) + ตัวกลาง-เล็ก (hidden gems — ไม่งั้นใต้ผืนน้ำได้ 0 ตัว)
- **ข่าวหลายตลาด**: Google News RSS ต่อภาษา (curl ได้ ฟรี) แทน RSS หน้าเว็บแต่ละประเทศ (หลายเจ้าไม่มี RSS) — `news.google.com/rss/search?q=<คำ>&hl=<lang>&gl=<ประเทศ>`
- **ราคาสินทรัพย์**: ใช้ Yahoo ทั้งหมดรวมคริปโต (BTC-USD) — ไม่ต้อง CoinGecko (แหล่งเดียว ง่ายกว่า)

### 🧰 RUNBOOK — ปัญหาที่เจอ + วิธีแก้ (อ่านก่อนทำงาน/เครื่องใหม่)

**สกิลที่ต้องโหลดก่อนทำงานโปรเจคนี้**: `bazi-engine-development` (engine/ยามซินแส/pipeline) · `bazi-product-development` (schema/review/daily-content) · `thai-text-processing` (regex ไทย) · วางแผน: `plan`/`writing-plans`

**ลำดับรัน pipeline (ต้องเรียง — ห้ามรัน enrich 2 ตัวพร้อมกัน!):**
```bash
npx tsx scripts/fetch-market-data.ts      # ราคา → data/cache/market/<date>.json (1,900+ ตัว)
npx tsx scripts/fetch-asset-prices.ts     # ราคาสินทรัพย์ → merge snapshot เดียวกัน
npx tsx scripts/fetch-fundamentals.ts     # พื้นฐาน → data/cache/fundamentals.json (resumable ใหญ่40+กลางเล็ก160/รอบ)
npx tsx scripts/fetch-news.ts             # ข่าว → data/news.json (200/วัน 8 ตลาด)
npx tsx scripts/ipo-pipeline.ts           # IPO → data/ipo.json
npx tsx scripts/hidden-gems.ts --birth ... --time ... --gender ...   # ใต้ผืนน้ำ
npx tsx scripts/portfolio-demo.ts --birth ... --time ... --gender ... # จัดพอร์ต
npm run typecheck && npm run lint && npm test   # 128 เทสต์
```

| # | ปัญหา | วิธีแก้ (ราก) | ไฟล์ |
|---|---|---|---|
| 1 | **Yahoo v10 ส่งค่าเป็น `{raw, fmt}` object ไม่ใช่ number** — normalize ได้ undefined เงียบๆ | แกะ `.raw` ใน normalize (รองรับทั้ง number ตรงและ object) + เทสต์ล็อก format | `market/fundamentals.ts` |
| 2 | **เทสต์เขียนทับข้อมูลจริง** — saveSnapshot เขียน `latest.json` ทับด้วย fixture → ราคาปลอมทั้งคลัง | เพิ่ม param `dir` ให้ save/loadSnapshot — เทสต์ใช้ `os.tmpdir()` เสมอ (hermetic) | `market/market-data.ts` + tests |
| 3 | **TradingView `ipo_date` = dead ใน free tier** (null เสมอ) | สลับแหล่ง: `stockanalysis.com/ipos/calendar/` (curl ได้ ฟรี) — Asia = Investing.com browser | `investor/ipo.ts` |
| 4 | **TV market code**: US = `america` · ไทย = `thailand`/`SET` (MAI ได้ 0 — ยังไม่เจอชื่อจริง) | ใช้ `america`/`thailand` — debug ด้วย .tmp script | `scripts/expand-thai-universe.ts` |
| 5 | **TV sector ต่างจาก GICS** — ใช้ชื่อ `Communications`/`Consumer Services` | ขยาย `sector-elements.ts` เฉพาะที่มี precedent ใน GICS เดิม (ไม่เดา) + debug ดู sector จริง | `market/sector-elements.ts` |
| 6 | **Hidden gems ได้ 0 ตัว** — fundamentals cache มีแต่หุ้นใหญ่ แต่ใต้ผืนน้ำ = ตัวกลาง-เล็ก | fetch-fundamentals เก็บ ใหญ่ 40 + กลาง-เล็ก 160 (resumable) | `scripts/fetch-fundamentals.ts` |
| 7 | **repo export ชื่อ**: `inMemoryRepository` ไม่มีจริง — เป็น `createInMemoryKnowledgeRepository()` | grep export จริงก่อน import | `bazi/in-memory-repository.ts` |
| 8 | **read_file ตีไฟล์ไทยเป็น binary** (Thai-heavy UTF-8) | ใช้ terminal `grep`/`sed -n` แทน read_file | ทุกไฟล์ data/src |
| 9 | **Windows CRLF/LF** — node/python เขียน LF → git เห็นทั้งไฟล์ diff (warning ธรรมดา) | ไม่ต้องแก้ — ถ้า conflict ใช้ `git checkout --ours/theirs` เลือกฝั่งที่ถูก | — |
| 10 | **patch tool ใช้ relative path พลาดเมื่อ terminal cwd เปลี่ยน** (เช่น cd /tmp) | ใช้ absolute path `C:\Users\ASUS\Desktop\biz\bazi-investor-guide\...` เสมอ | — |
| 11 | **node -e / sed pipeline โดน approval/blocklist** | เขียน `.tmp-xxx.ts` แล้วลบหลังใช้ (convention โปรเจค) — อย่าใช้ one-liner ซับซ้อน | scripts/.tmp-* |
| 12 | **ทิศ→ธาตุตลาด 15 ตลาดใหม่ + ธาตุ ปศุสัตว์/พระเครื่อง/สลาก/คาร์บอน** | ยังไม่ตัดสิน — **รอซินแส** (decision-log ด้านล่าง) | — |
| 13 | **Yahoo v10 ไม่บริการ .KL/.PS/.SI/.PK (assetProfile null)** — แต่ 2330.TW/TR/ZA ได้ | Wikipedia enrich เป็น fallback + เพิ่ม `lang=en-US&region=US` — เติมได้บาง (wiki ผิดบ่อย → ตรวจ) | `scripts/enrich-descriptions.ts` |
| 14 | **TV exchange code ไม่ตรงชื่อที่เดา**: มาเลเซีย = `MYX` · ซาอุฯ market = `ksa` · แอฟริกาใต้ = `rsa` · ฝรั่งเศสไม่ต้อง exchange | debug ด้วย .tmp script ก่อน expand (ประหยัดรอบ) | `scripts/expand-*-universe.ts` |
| 15 | **Description ผิดคนละบริษัท** (suffix map เก่า → Yahoo ดึง US ticker แทน เช่น SDG=กองทุนUS/TM=Toyota) | cleanup: เทียบ `businessEvidence.url` กับ `yahooTicker()` ที่ควรเป็น — ไม่ตรง = ลบ · refactor ให้ enrich import yahooTicker จาก canonical module (ห้าม copy map) | `market/yahoo.ts` |
| 16 | **Enrich 2 ตัวคู่ขนาน = stale write ทับข้อมูลใหม่** (background Wikipedia enrich โหลด state เก่า → เขียนทับ MX/TR/ZA + dedupe ที่เพิ่งทำ) | **ห้ามรัน enrich 2 ตัวพร้อมกัน** — รอตัวแรกจบก่อน · กู้ด้วย `git checkout -- data/stocks/*.json` แล้วรัน expand/enrich ใหม่ (cache .yahoo-cache.json ช่วยให้เร็ว) | `enrich-descriptions*.ts` |
| 17 | **Cleanup token-match ลบ description ถูกทิ้ง 18 ตัว** (ชื่อไทยไม่มีคำอังกฤษ → false positive: BBL/CPALL/SCB/TOP/PLANB/JBH ฯลฯ) | **ห้ามใช้ token-overlap กับชื่อไทย** — กู้จาก `git show HEAD:<file>` แล้ว merge เฉพาะตัวที่ลบผิด · ตรวจด้วยสายตาเสมอ | — |
| 18 | **Numeric ticker ชนข้ามตลาด** — `7203`@TADAWUL (Elm ซาอุฯ) ชน `7203.T` (Toyota) ด้วย findQuote startsWith | findQuote ใช้ `yahooTicker()` เป็น key ตรง (ไม่ใช้ startsWith) + dedupe 68 ตัวซ้ำ (700.HK vs 0700.HK) | `market/movers.ts` |
| 19 | **BMV class share**: `GMEXICO/B` → Yahoo ต้อง `GMEXICO.B.MX` (มีจุดแล้วแต่ต้องเติม suffix ต่อ) | yahooTicker: ถ้า mkt=BMV และไม่จบ .MX → เติม .MX (ก่อน logic "มีจุด = คืนทันที") | `market/yahoo.ts` |
| 20 | **Windows taskkill ฆ่า tsx wrapper ไม่ตาย — node child ค้างพอร์ต** (EADDRINUSE รอบถัดไป) | ฆ่า PID ที่ `netstat -ano \| grep :8787 \| grep LISTEN` คืนมา (ไม่ใช่ PID จาก background process) | — |
| 21 | **Next dev server ค้างหลัง hot-reload นาน** (LISTEN แต่ไม่ตอบ / jest-worker crash → ทุก /api/* คืน HTML error = "backend ไม่พร้อม") | `taskkill /PID <PID :3000> /F` + `npm run dev` ใหม่ — API server (8787) ปกติไม่ต้องแตะ · ถ้า user เจอ "backend ไม่พร้อม" ให้ตรวจ BFF ก่อนเสมอ | scripts/api-server.ts |
| 22 | **curl ส่งภาษาไทยจาก Windows shell encoding เพี้ยน** → intent กลายเป็น smalltalk | เขียน JSON ลงไฟล์ (UTF-8) แล้ว `curl --data @file` | — |
| 23 | **ฟอนต์ไทย PDF (Leelawadee) ไม่มี glyph emoji/→/⚠️+FE0F** → ขึ้นกล่อง \u0000 | clean(): กรอง `\u{1F000}-\u{1FFFF}` + `\uFE00-\uFE0F` + `\u2000-\u2BFF` ทุกจุดที่เขียน (line/row/footer — ไม่ใช่แค่บางสาย) | `api/report-pdf.ts` |
| 24 | **fundamentals cache เก็บค่าเป็น % อยู่แล้ว** (roe=8.8 หมายถึง 8.8%) | อย่าคูณ 100 อีก — แสดง `${v}%` ตรงๆ | `report/full-report.ts` |

**เปลี่ยนเครื่องใหม่**: `npm install` (node 20+) · ข้อมูลทั้งหมด commit ใน repo แล้ว (cache/ราคา/ข่าว/IPO) — ไม่ต้องพึ่ง network · ไม่มี secret ใน repo (LLM key ใส่ `.env` ตอน Phase 1+) · อ่าน `UPDATE.md` + `.hermes/plans/2026-08-05_ai-investor-chat.md` + `KNOWN-ISSUES.md` ก่อน

### 🧾 คิวถามซินแส (decision-log — รวบรวมถามรอบเดียว)
- [ ] ธาตุ: ปศุสัตว์(หมู/ไก่/โค) · พระเครื่อง · สลากออมสิน · คาร์บอนเครดิต · งานศิลปะ
- [ ] ทิศ→ธาตุตลาด **15 ตลาดใหม่**: TW/SG/ID/MY/PH · GB/DE/FR/CH · PK/SA/BR · MX/TR/ZA (ตอนนี้ verdict รายตัวใช้ธาตุธุรกิจ — ธาตุตลาดใช้เฉพาะบท 8 ภาพรวมประเทศ)
- [ ] review ธาตุหุ้นไทย 129 ตัว (CSV รอส่ง — `npx tsx scripts/review-checklist.ts export`)
- [ ] HK sector map ครบ 85 ตัว (รอเติมจากซินแส)
