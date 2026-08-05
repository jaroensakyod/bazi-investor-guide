# แผน: AI ผู้ช่วยลงทุนคู่ดวง (Bazi Investment Co-pilot Chat)

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.
> ผู้ร่าง: Hermes Agent · 2026-08-05 · ภาษาไทย (ศัพท์เทคนิคอังกฤษได้)

**Goal:** สร้างแชท AI ผู้ช่วยลงทุน + ดวง (เหมือน "แชทฮิลใจ" แต่ด้านการเงิน) ที่ตอบได้ 5 อย่าง: ① หุ้นน่าสนใจวันนี้ ② IPO กำลังจะเข้า ③ หุ้น X กับดวงเราเป็นยังไง ④ วิเคราะห์พื้นฐานหุ้น X ⑤ ข่าว/เหตุการณ์ (ทรัมป์/เทค/อากาศ) ส่งผลยังไง — และเขียนรายงานสไตล์สถาบัน (แบบ Warren Buffett) เป็นไฟล์ได้

**Architecture:** 3 ชั้น — ① **Data layer** (ราคา/IPO/ข่าว/พื้นฐาน อัปเดตอัตโนมัติ) ② **Deterministic core** (bazi engine + คลังหุ้น + verdict — มีแล้ว ไม่ให้ AI เดา) ③ **LLM shell** (แปลคำถาม → เรียก tools → เขียนคำตอบ/รายงาน) — LLM เป็น "ปากกา" ไม่ใช่ "สมองตัดสินธาตุ"

**Tech Stack:** TypeScript (เดิม) · Yahoo Finance quoteSummary (พิสูจน์แล้วใน enrich-descriptions-yahoo.ts) · TradingView scanner API (พิสูจน์แล้วใน expand-to-100.ts) · RSS ข่าว · LLM API (DeepSeek แนะนำ — ถูก/ภาษาไทยดี) · LINE Messaging API · docx (มีสกิล)

---

## 1. Feasibility — สรุปตรงๆ

| คำถามผู้ใช้ | ทำได้ไหม | หมายเหตุ |
|---|---|---|
| หุ้นน่าสนใจวันนี้ | ✅ | Yahoo/TradingView ดึง movers + ฟิลเตอร์เฉพาะคลัง 2,023 ตัวเรา |
| ตัวไหนจะ IPO | ✅ | TradingView scanner มีฟิลด์ `ipo_date` (pattern เดียวกับ expand-to-100) + Investing.com browser |
| ดวงเรากับหุ้นนี้ | ✅ | **มีแล้ว** — deterministic verdict (scoreStock) รอแค่ "เชื่อมแชท" |
| วิเคราะห์พื้นฐาน | ✅ | Yahoo financialData (PE/ROE/margin) + description/revenueMix ที่มีแล้ว |
| สินทรัพย์ 12 ประเภท (ทอง/คริปโต/REIT/บอนด์/ฝาก/forex/กองทุน/ETF...) | ✅ | schema + ตารางธาตุมีครบใน data-spec.md (type field 12 แบบ) — เหลือสร้าง data + fetcher + verdict (Task 0.9–0.12) |
| สินทรัพย์จริง/ของไทย (บ้านเช่า/ที่ดิน/สวนยาง/ป่า/ฟาร์ม/สลาก/ทองก้อน/พระเครื่อง/ของสะสม) | ✅ | สร้างเพิ่มได้ — schema ขยาย +2 types (`real_asset`/`lottery`) + ธาตุเสนอ→รอซินแส (Task 0.13–0.14) |
| **Asia-First** (ตลาดเอเชียก่อน → โลก) | ✅ | engine 八字 = สากลอยู่แล้ว (ระบบเดียวกับ CN/TW/HK/VN/JP/KR) — เพิ่ม i18n + universe TW/SG/ID/MY/PH (Task 0.15/1.7/4.5) |
| ข่าว/ทรัมป์/เทค/อากาศ → ผลกระทบ | 🟡 | RSS + ปฏิทินเหตุการณ์ + LLM วิเคราะห์เชื่อมธาตุ/เซกเตอร์ — คุณภาพต้องเทสต์ |
| รายงานสไตล์สถาบัน | ✅ | docx generator + เทมเพลต Buffett (moat/การเงิน/ความเสี่ยง/ดวง) |

**ทำไม่ได้/ต้องตัดสินใจ 2 จุด:** ① LLM API key สำหรับ production (ระหว่างพัฒนาใช้ของ Nous ได้) ② กรอบกฎหมาย — แชทตอบ "ควรซื้อไหม" รายบุคคลเข้าข่ายให้คำแนะนำการลงทุน (ก.ล.ต.) → ต้องตีกรอบ "แนวโน้มตามดวง + ข้อมูล ไม่ใช่คำแนะนำซื้อขาย" (ดู §8)

---

## 2. สินค้าคงคลัง (มีแล้ว) vs ช่องว่าง

### มีแล้ว ✅
- bazi engine deterministic (ยามซินแส 13/13) + `resolveInvestElements` / `scoreStock` / `resolveInvestorPersona` (15 การ์ด) / `buildInvestorTimeline`
- คลังหุ้น 2,023 (ไทย 129 + โลก 1,894) — ทุกตัวมี elementReason + description 1,885 + revenueMix (บางส่วน)
- schema 2 ชั้น: **ชั้น B `marketData` ว่างรอ API ราคาอยู่แล้ว** ← จุดต่อตรง
- daily-content 4 ประเภท + review workflow CSV + cache Wikipedia + enrich scripts (Yahoo/TradingView/investing/stockanalysis)
- scripts/asset-picks.ts — "ใส่วันเกิด → เรียงหุ้นตาม verdict" = **หัวใจของแชทข้อ ③ พร้อมใช้งานแล้ว**

### ช่องว่าง ❌
| ช่องว่าง | ต้องสร้าง |
|---|---|
| ราคา/ข้อมูลตลาดสด | `src/lib/market/` — Yahoo quoteSummary fetch + cache → เติม `marketData` |
| IPO | `scripts/ipo-pipeline.ts` → `data/ipo.json` + ฟังก์ชัน query |
| ข่าว/เหตุการณ์ | `src/lib/market/news.ts` — RSS + `data/events.json` (ปฏิทินเหตุการณ์: FOMC/OPEC/ทรัมป์/อากาศ) |
| แชท | `src/lib/chat/` — intent router + tools + user chart store |
| LLM orchestration | `src/lib/chat/assistant.ts` — prompt + tool calling + disclaimer |
| รายงานสถาบัน | `scripts/generate-report.ts` + `src/lib/report/` — docx เทมเพลต Buffett |
| LINE bot | `src/server/` — webhook (ภายหลัง Phase 4) |

---

## 3. สถาปัตยกรรม

```
ผู้ใช้ (LINE / Web) ──▶ LLM Shell (assistant.ts)
                          │  แปลคำถามไทย → เลือก intent
                          ▼
              ┌─────────────────────────────┐
              │ Tool Layer (deterministic)  │ ← LLM เรียก tools เท่านั้น
              ├─────────────────────────────┤
              │ getTodayMovers(market)      │  Yahoo/TradingView + คลังเรา
              │ getUpcomingIPOs(market)     │  data/ipo.json
              │ getBaziVerdict(ticker,user) │  scoreStock() + ไทม์ไลน์ (มีแล้ว)
              │ getFundamentals(ticker)     │  Yahoo + description/revenueMix
              │ getNewsImpact(theme/event)  │  RSS + events.json → เซกเตอร์→ธาตุ
              │ generateReport(ticker)      │  docx เทมเพลตสถาบัน
              └──────────────┬──────────────┘
                             ▼
              Bazi Engine (มีแล้ว) · คลังหุ้น 2,023 · marketData · ipo.json · events.json
```

**กฎเหล็ก (จากหลักโปรเจคเดิม):**
1. verdict/ธาตุ = deterministic เสมอ — LLM ห้ามเดา element เอง ต้องเรียก `scoreStock`
2. ข้อมูลตลาด = จาก API เท่านั้น ไม่มีมือพิมพ์ (ชั้น B เดิม)
3. ทุกคำตอบมี disclaimer (กฎ ก.ล.ต.) — ฝังใน system prompt + ต่อท้ายทุก message
4. ข้อมูลใหม่ (IPO/ข่าว) เก็บเป็น draft + review ได้เหมือนหุ้น

---

## 4. ข้อตัดสินใจเปิด (ต้องตอบก่อนเริ่ม Phase 1+)

| # | คำถาม | ตัวเลือก | แนะนำ |
|---|---|---|---|
| Q1 | ช่องทางแชทแรก | LINE OA / Web app / ทั้งคู่ | **LINE OA** (funnel มีอยู่แล้ว เก็บ LINE ได้เลย) |
| Q2 | LLM API production | DeepSeek / GPT / Claude / Gemini | **DeepSeek** (ถูก ~10-20×, ภาษาไทยดี, ใช้ model เดียวกับ agent เรา) |
| Q3 | กรอบ compliance | "แนวโน้มตามดวง + ข้อมูล" (ไม่แนะนำซื้อขาย) / จด IC license | **แนวโน้มตามดวง** (ตรงสินค้าเดิม เปลี่ยนน้อยสุด) |
| Q4 | โมเดลรายได้ | แชท = โบนัสของเล่ม (upsell) / สินค้าใหม่ subscription | แชทฟรีในกลุ่ม LINE → ปลดล็อกวิเคราะห์ลึกใน VIP |
| Q5 | รับ data unofficial ไหม | Yahoo/TradingView (ฟรี, ToS เทา) / จ่าย API (Finnhub/TwelveData) | **รับสำหรับ MVP** → เปลี่ยน backend ได้เพราะ schema เดียวกัน |
| Q6 | ภาษารายงาน | ไทยล้วน / ไทย+อังกฤษ | ✅ **th/zh/en (3 ภาษา) — ตัดสินใจแล้ว 2026-08-05** (i18n dictionary สร้างครั้งเดียว ภาษาถัดไปเติม key) |

## 4.5 ยุทธศาสตร์ Asia-First — ตลาดเอเชียก่อน แล้วค่อยโลก

> หลัก: ระบบ 八字/四柱推命/사주/Tử Vi = ระบบเดียวกันกับ engine เรา → ต้นทุนเดียว ขายได้ 8+ ประเทศ
> และคลังหุ้น×ธาตุ 2,000+ (มี review) = moat ที่คู่แข่งท้องถิ่นไม่มี

### ลำดับเข้าตลาด (ดูดวงเข้ม × เข้าถึงง่าย)
| ลำดับ | ตลาด | ระบบดูดวง | ช่องทาง | เหตุผล |
|---|---|---|---|---|
| 1 | 🇹🇭 ไทย (ฐาน) | ดวงจีน/โหร | LINE | funnel มีแล้ว |
| 2 | 🇹🇼 ไต้หวัน (แรกนอกไทย) → 🇭🇰 ฮ่องกง → 🇸🇬 สิงคโปร์ | 八字 ดั้งเดิม | LINE/WeChat/EN | ✅ **ไต้หวันก่อน — ตัดสินใจแล้ว 2026-08-05** (LINE infra ใช้ร่วมไทยได้ทันที + 八字เข้ม) |
| 3 | 🇻🇳 เวียดนาม | Tử Vi + 八字 | Zalo | ดูดวงเข้มมาก ประชากรอายุน้อย |
| 4 | 🇯🇵 ญี่ปุ่น · 🇰🇷 เกาหลี | 四柱推命 · 사주 | LINE · KakaoTalk | ตลาดใหญ่ ซื้อของ personalized |
| 5 | 🇮🇩 🇲🇾 อินโดนีเซีย/มาเลเซีย | 八字 รอง | WhatsApp/Telegram | ตลาดใหญ่ แต่ดูดวงน้อยกว่า → หลัง |
| 6 | 🇨🇳 จีนแผ่นดินใหญ่ | 八字 | WeChat (ปิด) | ตลาดใหญ่สุด แต่ compliance เข้ม + เข้าถึงยาก → พาร์ทเนอร์/ทีหลัง |
| 7 | 🌍 โลก (US/CA/AU/EU) | ครอสโอเวอร์ | Web + email | ภาษาอังกฤษ กลุ่ม "ดวง+การลงทุน" |

### ภาษา (ตามลำดับเข้า): th → zh (TW/HK/SG) → vi → en → ja → ko → id
- ✅ **MVP 3 ภาษา: th/zh/en — ตัดสินใจแล้ว (2026-08-05)** — vi/ja/ko/id เติมทีหลัง
- **i18n หลักการ**: engine deterministic = ภาษากลาง (ธาตุ 木火土金水) · เทมเพลต verdict แปลผ่าน **dictionary (ไม่ใช่ LLM — กันเพี้ยน/เทสต์ได้)** · เนื้อเรื่อง/แชท = LLM ต่อภาษา · เล่ม 25 บท re-render ต่อภาษา (Phase ทีหลัง)
- **Compliance ต่อประเทศ**: แปล disclaimer + เช็คกฎหมายท้องถิ่น (CSRC/FSA/SSC/FSS...) — **gate: เปิดประเทศไม่ได้จนกว่า checklist ผ่าน** (Task 4.6)
- **ราคา**: สกุลท้องถิ่น (฿4,990 ≈ NT$4,500 ≈ ¥1,000 ≈ $140) — ladder 7 ชั้นเดิม

---

## 5. Phase 0 — Data Layer (รากฐานทุกอย่าง)

> เป้า: แชทต้องมี "ข้อมูลวันนี้" — ราคา movers IPO ข่าว พื้นฐาน

### Task 0.1: marketData fetcher (Yahoo quoteSummary)
**Files:** Create `src/lib/market/yahoo.ts` · Create `src/lib/market/market-data.ts` · Test `tests/market-data.test.ts`
- `fetchQuoteSummary(tickers[], modules)` — batch quoteSummary (reuse pattern จาก enrich-descriptions-yahoo.ts: ticker suffix map .BK/.HK/.SS/.T/.KS/.VN/.AX/.TO/.NS/US)
- modules: `price, financialData, defaultKeyStatistics, summaryDetail`
- Output shape = **schema ชั้น B เดิมเป๊ะ** (`marketData: { price, changePct, pe, pbv, dividendYield, marketCap, avgVolume, fiftyTwoWeekHigh/Low, updatedAt }`)
- Cache `data/cache/market/<date>.json` (วันละ 1 รอบ — Yahoo 429 ง่าย)
- **TDD:** fetch ตัวอย่าง 3 ticker (KBANK.BK, AAPL, 7203.T) → assert field ครบ + cache เขียนจริง

### Task 0.2: Today movers + สแกนหุ้นเด่น
**Files:** Create `src/lib/market/movers.ts` · Test `tests/movers.test.ts`
- แหล่ง: TradingView scanner (`scanner.tradingview.com/{market}/scan` — POST pattern มีแล้วใน expand-to-100.ts) ฟิลเตอร์ `changePct` สูงสุด
- ฟิลเตอร์: เฉพาะ ticker ที่อยู่ในคลังเรา (2,023) — หุ้นนอกคลังไม่มีธาตุ อย่าโชว์
- Output: `{ ticker, name, changePct, price, element, verdictForUser? }` — ต่อแชทข้อ ①

### Task 0.3: IPO pipeline
**Files:** Create `scripts/ipo-pipeline.ts` · Create `src/lib/investor/ipo.ts` · Data `data/ipo.json` · Test `tests/ipo.test.ts`
- แหล่ง 1: TradingView scanner — ฟิลด์ `ipo_date` (same POST API) filter `ipo_date > now` สำหรับ 8 ตลาดเรา
- แหล่ง 2 (fallback/ไทย): Investing.com IPO calendar ผ่าน browser (pattern enrich-vn30 — curl 403)
- แต่ละ IPO: `{ ticker, name, market, exchange, ipoDate, sector, business, primaryElement (sector→ธาตุ auto), status: "draft", priceRange? }`
- **ไม่ทับของเดิม** — merge เหมือน pipeline หุ้น
- ต่อ daily-content: เพิ่ม type 5 `ipo-of-week` (วันศุกร์) — "IPO หน้าน่าสนใจ: X (ธาตุไฟ) ตรงดวงคนธาตุไฟ"
- Verify: `npx tsx scripts/ipo-pipeline.ts` → data/ipo.json มีรายการ ≥ 5 · เทสต์ผ่าน

### Task 0.4: News + event pipeline
**Files:** Create `src/lib/market/news.ts` · Create `scripts/fetch-events.ts` · Data `data/events.json` · Test `tests/news.test.ts`
- RSS (ฟรี ไม่ต้อง key): Investing.com RSS, Reuters business feed, Yahoo Finance RSS ตาม ticker
- `data/events.json` (กึ่งมือ — ทบทวนรายสัปดาห์): `{ date, title, type: "policy"|"macro"|"weather"|"tech"|"geopolitics", affectedSectors[], note }` — เช่น "ทรัมป์ขึ้นภาษีเหล็ก → เหล็ก/วัสดุ (ทอง), ผู้ส่งออก (น้ำ/ไม้)"
- Map เหตุการณ์ → เซกเตอร์ → ธาตุ (ใช้ SECTOR_TO_ELEMENT เดิม) → พร้อมเทียบดวงผู้ใช้
- Verify: fetch RSS ได้ ≥ 20 ข่าว/วัน, events.json มี ≥ 10 เหตุการณ์ตัวอย่าง

### Task 0.5: Fundamentals สำหรับวิเคราะห์
**Files:** Modify `src/lib/market/yahoo.ts` · Test `tests/fundamentals.test.ts`
- ดึงเพิ่ม: `financialData` (revenue, grossMargin, operatingMargin, ROE, debtToEquity, revenueGrowth), `defaultKeyStatistics`
- เก็บใน entry เดิม: `fundamentals: {...}` (schema ขยาย — ข้อมูลนิ่ง/กึ่งนิ่ง)
- **Buffett checklist function** `src/lib/report/buffett-checks.ts`: ROE ≥ 15%, debt/equity < 0.5, margin stable, 10-yr... (ข้อมูลจำกัด → ใช้ proxy ที่ Yahoo มี) → ออกเป็น pass/warn/fail รายข้อ

### Task 0.6: ขยายคลังไทย 129 → ~250 (mai + กลาง-เล็ก) — ฐานของ "ใต้ผืนน้ำ" ไทย
**Files:** Create `scripts/expand-thai-universe.ts` · Modify `data/stocks/thailand.json`
- แหล่ง: SET.or.th รายชื่อ mai + SET100 ส่วนที่เหลือ (ผ่าน browser — pattern เดิม) + tier: SET50/SET100/mai/mid/small
- กฎ: ตัวใหม่ต้องผ่าน validator เดิม (elementReason/elements/status) + **ต้องมี description จริง** (enrich-descriptions) ก่อนเข้า — กันข้อมูลเปล่า
- ทุกตัว status: draft → รอซินแส (รอบ 2)

### Task 0.7: Hidden Gems screener — "หุ้นใต้ผืนน้ำ" (แกนใหม่ของแผน)
**Files:** Create `src/lib/market/hidden-gems.ts` · Create `scripts/hidden-gems.ts` · Data `data/hidden-gems.json` · Test `tests/hidden-gems.test.ts`
- **คอนเซปต์ 2 แกน**: ความนิยม (ทุกคนเห็นไหม) × คุณภาพ (ผ่าน Buffett ไหม) — ล่าในจตุภาค "คนไม่เห็น + คุณภาพดี"
- สแกน TradingView scanner: market cap กลาง-เล็ก (ไทย: นอก SET50 + mai · โลก: 1B–50B USD) + ฟิลเตอร์คุณภาพ: ROE ≥ 15% · D/E < 0.5 · สภาพคล่อง ≥ เกณฑ์ · กำไรเป็นบวก
- **Underwater score (0–100)** — เมตริก "ใต้ผืนน้ำแค่ไหน": ไม่ติดดัชนีหลัก (+30) · cap กลาง-เล็ก (+20) · สภาพคล่องไม่หนาแน่น (+10) · ไม่มีกระแส/วิเคราะห์น้อย (+10)
- **Risk tiers (หัวใจ "ไม่เสี่ยงเกินไป")**:
  - 🟢 Tier 1 ปลอดภัย — ผ่านทุกเกณฑ์ + สภาพคล่องดี → แนะนำได้ทุกดวง
  - 🟡 Tier 2 ลุ้นได้ — ผ่านกำไร แต่เล็ก/สภาพคล่องปานกลาง → **เฉพาะดวงแข็ง** (strong band)
  - 🔴 Tier 3 ระวัง — micro cap/ข้อมูลน้อย → **watchlist เท่านั้น ไม่มี verdict**
- merge data/hidden-gems.json (draft) + element จาก sector→ธาตุ + enrich description อัตโนมัติ

### Task 0.8: ต่อ verdict + จำกัดความเสี่ยงตามกำลังดวง
**Files:** Modify `src/lib/market/hidden-gems.ts` · Test `tests/hidden-gems.test.ts`
- กฎส่วนตัว: ดวงอ่อน (weak/very-weak) → เห็นแค่ 🟢 · ดวงแข็ง → 🟢+🟡 · 🔴 ไม่โชว์ verdict ให้ใคร
- "หุ้นใต้ผืนน้ำที่ตรงดวง" = scoreStock ≥ 2 + underwater ≥ 50 + tier อนุญาต → เรียงให้ผู้ใช้

### Task 0.9: Asset universe — 12 ประเภทการลงทุน (schema มีแล้ว เริ่มสร้าง data)
**Files:** Create `data/stocks/commodities.json` (ตาม roadmap เดิม) + ขยาย → `src/lib/assets/asset-universe.ts` · Test `tests/assets.test.ts`
- ใช้ type field จาก data-spec: `fund/etf/reit/bond/deposit/commodity/crypto/real_estate/forex/insurance/derivative`
- ชุดแรก ~100 รายการ (data-spec รอบ 6): ทอง/เงิน/แพลตตินัม · น้ำมัน WTI/Brent/ก๊าซ · คริปโต BTC/ETH · REIT ไทย (CPNREIT) + ต่างประเทศ · ETF หลัก (SPY/QQQ/GLD/VNQ...) · กองทุนไทยเด่น (SET50/ทอง/อินเดีย) · พันธบัตร/หุ้นกู้/ฝาก (อัตรา ธปท.) · forex คู่หลัก (USD/THB, EUR/USD...) · อนุพันธ์ (SETA50F) · ประกัน/อสังหา (ข้อมูลนิ่ง)
- ทุกตัวมี: `elementReason` (จากตาราง data-spec: REIT=ดิน, ทอง=ทอง, น้ำมัน=ไฟ, forex=น้ำ, อนุพันธ์=ตามสินค้าอ้างอิง, กองทุน=sector weight) + `status: draft`
- **กฎเหล็กเดิม**: ไม่เดา element — map จากตารางที่ซินแส/decision-log อนุมัติแล้วเท่านั้น

### Task 0.10: Asset price fetchers — ราคา/อัตราของทุกประเภท
**Files:** Create `src/lib/assets/asset-prices.ts` · Create `scripts/fetch-asset-prices.ts` · Test `tests/assets.test.ts`
- Yahoo: โลหะมีค่า `GC=F/SI=F/PL=F` · พลังงาน `CL=F/NG=F` · ETF/REIT/กองทุน (pattern เดิม) · forex `USDTHB=X`
- CoinGecko ฟรี: BTC/ETH (ราคา + change 24h)
- อัตราดอกเบี้ย/เงินฝาก: จาก `data/events.json` + ธปท. (review รายสัปดาห์ — ไม่ใช่ real-time)
- ทุกตัวเติม `marketData` schema เดียวกับหุ้น (ราคา/change/updatedAt) — แชทถาม "ทองตอนนี้เท่าไร" ตอบได้ทันที

### Task 0.11: Asset verdict — ธาตุ + สภาพตลาด + risk tier (ต่อยอด scoreStock)
**Files:** Create `src/lib/assets/asset-verdict.ts` · Test `tests/assets.test.ts`
- คะแนน 2 ส่วน: ① **ธาตุ fit** (scoreStock เดิม: useful god/TABLE B/ธาตุลาภ/avoid) ② **สภาพตลาด** (trend ราคา + เหตุการณ์ใน events.json — เช่น "ทองใกล้ all-time high + ทรัมป์ภาษี = หนุน" → +1)
- **Risk tier ต่อสินทรัพย์** (ปรับตามกำลังดวงเหมือน hidden gems):
  - 🟢 ปลอดภัย: ฝาก/พันธบัตรรัฐ/กองทุนตลาดเงิน/ทองคำแท่ง → แนะนำทุกดวง
  - 🟡 ปานกลาง: ทอง ETF/REIT/กองทุนหุ้น/น้ำมัน/เงิน/forex หลัก → ดวงแข็ง + ดวงสมดุล
  - 🔴 สูง: คริปโต/อนุพันธ์/เลเวอเรจ → เฉพาะดวงแข็ง + วงเงินจำกัด (ไม่เกิน X% ตามกำลัง)
- จุดขาย bazi: **ไม่มีสินทรัพย์ไหน "ไม่ดี"** — ฝาก (ธาตุน้ำ) ดีสำหรับคนที่ต้องการน้ำ — เรื่อง "fit + จังหวะ + กำลัง" ไม่ใช่ "ตัวไหนแพงสุด"

### Task 0.12: จัดพอร์ตตามธาตุ (บท 13) — asset allocation engine
**Files:** Create `src/lib/assets/portfolio.ts` · Create `scripts/portfolio-demo.ts` · Test `tests/portfolio.test.ts`
- อินพุต: useful god + strength band + เงินลงทุน → **% ต่อธาตุ** (ตาราง TABLE B เดิม) → สินทรัพย์ตัวอย่างในแต่ละธาตุ (จาก asset universe)
- ตัวอย่าง: ดวงอ่อน ต้องการน้ำ → ฝาก/บอนด์/หุ้นน้ำ (ธนาคาร) 40% + ทอง (ปลอดภัย) 20%... — ดวงแข็ง → เพิ่มคริปโต/เก็งกำไร
- ต่อ daily-content: โพสต์ "จัดพอร์ตตามธาตุประจำเดือน" (หมุน 12 ประเภท) + ต่อ Excel โบนัสเดิมในเล่ม

### Task 0.13: สินทรัพย์ที่คนมองข้าม — Real Assets + ของไทย (ขยาย universe)
**Files:** Create `data/stocks/real-assets.json` · Modify `src/lib/assets/asset-universe.ts` (โหลดรวม) · Test `tests/assets.test.ts`
- **schema ขยาย +2 types** (แก้ data-spec): `real_asset` (subtype: house_rental/land/forest/farm/livestock/aquaculture/collectible/bullion/carbon) · `lottery`
- ชุดแรก ~30 รายการ (ของที่คนไทยดูดวงถือจริง):
  - **ดิน**: บ้านเช่า/คอนโดปล่อยเช่า/ที่ดิน/อาคารพาณิชย์ (แยกจาก REIT ชัดเจน)
  - **ไม้ (ธาตุหายาก — ใต้ผืนน้ำฉบับไทยแท้)**: สวนยาง/สวนปาล์ม/สวนผลไม้/ป่าไม้/ไม้เศรษฐกิจ/คาร์บอนเครดิต
  - **น้ำ**: ฟาร์มกุ้ง-ปลา (เสนอ → รอ ruling) · **ไม้/น้ำ**: ฟาร์มหมู-ไก่-โค (รอ ruling)
  - **ทอง**: ทองก้อน/เงินก้อน/เพชร/พลอย/นาฬิกา/ของสะสมมีค่า · **ดิน+ทอง**: พระเครื่อง (รอ ruling)
  - **น้ำ+ไฟ**: สลากออมสิน/สลาก ธกส. — Concept **偏財 (ทรัพย์ลมๆ แล้งๆ/ลุ้นโชค) — เช็ค Source4 + ซินแสก่อนใช้**
  - **น้ำ**: ประกันสะสมทรัพย์/ประกันบำนาญ — Concept **คลังทรัพย์ (财库)** เปิด/ปิดคลัง
- ทุกตัว: elementReason + risk tier + **ข้อมูลนิ่งเป็นหลัก (marketData มัก null — ไม่มีราคา API)** · ข้อยกเว้น: ทองก้อน/เงินก้อน ใช้ราคา `GC=F/SI=F` ได้จริง
- กฎ "ไม่เดา": ข้อมูลไม่มี → ใส่ "วิธีลงทุน/ความเสี่ยง/แหล่งอ้างอิง" เป็นข้อความนิ่ง ไม่ปั้นตัวเลข

### Task 0.14: Verdict สินทรัพย์จริง + "สิ่งที่ห้าม" (บท 9 — ต่อยอด avoid concept)
**Files:** Modify `src/lib/assets/asset-verdict.ts` · Test `tests/assets.test.ts`
- tier: 🟢 ทองก้อน/เงินก้อน/สลากรัฐ → ทุกดวง · 🟡 ที่ดิน/บ้านเช่า/สวนยาง/ประกันสะสมทรัพย์ (สภาพคล่องต่ำ แต่มีกระแสเงินสด/มูลค่า) → ดวงแข็ง+สมดุล · 🔴 ป่า/ของสะสม/พระเครื่อง/คาร์บอน (ไม่มีข้อมูล/ตลาด) → watchlist + "ต้องศึกษาด้วยตัวเอง" · ⛔ **ห้ามแนะนำเด็ดขาด: ห้องแชร์/แชร์ลูกโซ่/ลอตเตอรี่ใต้ดิน/การพนัน** (เนื้อหาบท 9/22)
- แชท: `asset_verdict` ครอบคลุมอยู่แล้ว (รู้จักชื่อสินทรัพย์) — เพิ่มตัวอย่าง: "ซื้อที่ดินดีไหม" / "สวนยางคุ้มไหม" / "สลากเหมาะกับดวงไหม" / "พระเครื่องเป็นสินทรัพย์ไหม"
- **decision-log ใหม่รอซินแส** (คิวถาม): ปศุสัตว์=? · พระเครื่อง=? · สลาก=? · คาร์บอนเครดิต=? · งานศิลปะ=?

### Task 0.15: ขยาย universe เอเชีย — TW/SG/ID/MY/PH (+~150 ตัว)
**Files:** Modify `scripts/fetch-wikipedia-stocks.ts` (เพิ่ม SOURCES + suffix map) · Modify `data/stocks/global.json` · Test `tests/global-stocks.test.ts`
- เพิ่ม 5 ตลาด (pattern เดิม Wikipedia/TradingView/Yahoo + enrich description):
  - 🇹🇼 ไต้หวัน: Taiwan 50 (`TWSE:2330` → `.TW`) · 🇸🇬 สิงคโปร์: Straits Times 30 (`.SI`) · 🇮🇩 อินโดนีเซีย: IDX30/LQ45 (`.JK`) · 🇲🇾 มาเลเซีย: FBM KLCI 30 (`.KL`) · 🇵🇭 ฟิลิปปินส์: PSEi 30 (`.PS`)
- ธาตุ: GICS → ธาตุ (logic เดิม) · MARKET_META: ทิศจากไทย → ธาตุตลาด (บท 8) — **ทิศ 5 ตลาดใหม่ต้องตรวจกับซินแสก่อน** (decision-log)
- ทุกตัว: draft + elementReason + enrich description (Yahoo suffix map ขยาย) — ผ่านกฎเหล็กเดิม

**✅ Gate Phase 0:** `npm run typecheck && npm test` (57+ ผ่าน) · demo: `npx tsx scripts/demo-market.ts` แสดง movers+IPO+ข่าววันนี้ · `npx tsx scripts/hidden-gems.ts` แสดงรายการใต้ผืนน้ำ + tier · `npx tsx scripts/portfolio-demo.ts` จัดพอร์ตได้ + `fetch-asset-prices.ts` มีราคาทอง/น้ำมัน/คริปโตจริง

---

## 6. Phase 1 — Chat Core (โครงแชท + tools)

> เป้า: มี "แชท" ที่ตอบคำถาม 5 ข้อได้ครบ — ระยะแรกเป็น CLI/API ก่อน LINE

### Task 1.1: Intent router
**Files:** Create `src/lib/chat/intents.ts` · Test `tests/chat-intents.test.ts`
- Rule-based ก่อน (ถูกกว่า/เทสต์ได้) + LLM fallback: keywords ไทย
- Intents: `today_movers` / `upcoming_ipo` / `stock_verdict` (หุ้น+ดวง) / `stock_analysis` (พื้นฐาน) / `news_impact` (ข่าว/เหตุการณ์) / `report` / `smalltalk`
- ตัวอย่าง: "วันนี้มีหุ้นอะไรน่าสนใจ" → today_movers · "วิเคราะห์ KBANK ให้หน่อย" → stock_analysis · "ทรัมป์ประกาศภาษีมีผลยังไง" → news_impact · "KBANK กับดวงเราเป็นยังไง" → stock_verdict

### Task 1.2: User chart store
**Files:** Create `src/lib/chat/user-store.ts` · Data `data/users/<lineUserId>.json` (หรือ SQLite ภายหลัง) · Test `tests/user-store.test.ts`
- `{ lineUserId, birthDate, birthTime, gender, province, chartHash, createdAt }` — คำนวณดวงครั้งเดียว (deterministic) แคช `chartHash` → แชทเร็ว
- โฟลว์แรกใช้: ไม่มีโปรไฟล์ → บอทถามวัน/เวลา/เพศ/จังหวัดก่อน

### Task 1.3: Tool layer
**Files:** Create `src/lib/chat/tools.ts` · Test `tests/chat-tools.test.ts`
- 7 tools: `getTodayMovers(market?)` · `getUpcomingIPOs(market?)` · `getBaziVerdict(ticker)` (รับ user chart จาก store → scoreStock + verdict + ไทม์ไลน์ปัจจุบัน) · `getFundamentals(ticker)` · `getNewsImpact(query)` · `searchStocks(element|sector|keyword)` · `generateReport(ticker)`
- ทุก tool return JSON มาตรฐาน `{ ok, data, disclaimer }` — LLM เอาไปเขียนคำตอบ

### Task 1.4: CLI chat demo
**Files:** Create `scripts/chat-demo.ts`
- `npx tsx scripts/chat-demo.ts --birth ... --time ... --gender ...` → REPL ถาม-ตอบ ผ่าน tools (ยังไม่ต้อง LLM — ตอบ template ก่อน)
- พิสูจน์ flow: ถาม 5 ข้อ → ได้คำตอบครบ 5 แบบ

### Task 1.5: LLM assistant (DeepSeek ต่อ)
**Files:** Create `src/lib/chat/assistant.ts` · Create `.env.example` (LLM_API_KEY/LLM_BASE_URL) · Test `tests/assistant.test.ts` (mock LLM)
- System prompt: persona "นักวิเคราะห์การเงินคู่ดวง" + กฎ (ต้องเรียก tools ไม่เดา, disclaimer ทุกครั้ง, ภาษาไทย)
- Tool calling: OpenAI-compatible function calling (DeepSeek รองรับ)
- Fallback: LLM error → ตอบจาก tool ตรงๆ (graceful degradation — แชทต้องไม่ตาย)
- Verify: `npx tsx scripts/chat-demo.ts --llm` — ถามครบ 5 ข้อ ตอบสมเหตุสมผล + disclaimer ติดทุกข้อ

### Task 1.7: i18n layer — เนื้อหาหลายภาษา (เอเชียก่อน — th/zh/en)
**Files:** Create `src/lib/i18n/locales.ts` · Create `src/lib/i18n/verdict-text.ts` · Test `tests/i18n.test.ts`
- dictionary: ธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ → 木/火/土/金/水 + en/vi/ja/ko) · verdict label (เหมาะมาก→…) · ชื่อสินทรัพย์/คำศัพท์
- `formatVerdict(verdict, locale)` — deterministic แปลผ่าน dictionary **ไม่ใช่ LLM** (เทสต์: ทุก locale ครบทุก key + output เหมือนเดิมทุกครั้ง)
- เริ่ม 3 ภาษา: th/zh/en — vi/ja/ko เติมทีหลัง (LLM generate draft + เจ้าของภาษาตรวจ)
- ต่อแชท: assistant เลือก locale ตามผู้ใช้ (Q: ภาษาตามประเทศ/เลือกเอง?)

**✅ Gate Phase 1:** เทสต์ intent/tools/user-store ผ่าน · chat-demo ตอบ 5 ข้อได้ · typecheck/test เขียว

---

## 7. Phase 2 — AI Analyst (คุณภาพคำตอบ)

### Task 2.1: คำตอบ "หุ้นวันนี้" ที่มีดวงผสม
- Movers → เรียง verdict กับดวงผู้ใช้: "NVDA +2.3% (ธาตุทอง ตรงธาตุที่ดวงคุณต้องการ ✅) — 5 ตัวเด่นวันนี้ที่ตรงดวงคุณ: ..."
- Output: ข้อความ + carousel card (LINE rich message)

### Task 2.2: วิเคราะห์หุ้นพื้นฐาน (narrative)
- Data: fundamentals + description + revenueMix + bazi verdict → LLM เขียน "ภาพธุรกิจ + ฐานะการเงิน + จุดแข็ง/เสี่ยง + มุมมองดวง"
- กัน hallucination: LLM **ห้ามสร้างตัวเลข** — ตัวเลขต้องมาจาก tool JSON เท่านั้น (prompt rule + post-check: ตัวเลขในคำตอบต้องมีใน tool output)

### Task 2.3: วิเคราะห์ข่าว/เหตุการณ์
- Flow: intent news_impact → หาเหตุการณ์ใน events.json + RSS ล่าสุด (keyword: ทรัมป์/ภาษี/FOMC/พายุ/ชิป...) → map เซกเตอร์→ธาตุ → เทียบ useful god ผู้ใช้ → "ข่าว X → หนุนกลุ่ม Y (ธาตุ Z) → ดวงคุณธาตุ Z = ได้อานิสงส์/เลี่ยง"
- ต้องมี "ความไม่แน่นอน" wording — LLM ห้ามการันตีผล

### Task 2.4: ความจำแชท + quick replies
- จำ context ล่าสุด (session 30 นาที) — ตามด้วย "แล้ว IPO ล่ะ" → เข้าใจว่าเรื่องเดิม
- Quick reply buttons: [ดูหุ้นวันนี้] [IPO] [วิเคราะห์หุ้น] [รายงาน] [ดวงฉันวันนี้]

### Task 2.5: แชท "หุ้นใต้ผืนน้ำ" — จุดขาย VIP
**Files:** Modify `src/lib/chat/intents.ts` · Modify `src/lib/chat/tools.ts`
- intent ใหม่: `hidden_gems` ("หาหุ้นใต้ผืนน้ำ/หุ้นที่คนไม่เห็น/หุ้นเด่นที่ไม่ดัง")
- tool: `getHiddenGems(user)` → underwater score + tier + verdict → carousel "🫧 X — ใต้ผืนน้ำ 72/100 · ธาตุทอง ตรงดวง ✅ · Tier 🟢"
- คำตอบต้องมีเหตุผล "ทำไมคนยังไม่เห็น" (underwater components) + "ทำไมปลอดภัย" (ผ่านเกณฑ์อะไร) — สร้างความเชื่อใจ 2 ทาง

### Task 2.6: แชทสินทรัพย์ 14 ประเภท — "ทองดีไหม / คริปโตกับดวง / จัดพอร์ตให้หน่อย / ซื้อที่ดินดีไหม"
**Files:** Modify `src/lib/chat/intents.ts` · Modify `src/lib/chat/tools.ts`
- intents ใหม่: `asset_verdict` ("ทอง/น้ำมัน/คริปโต/REIT/ฝาก/ที่ดิน/สวนยาง/สลาก/พระเครื่อง... ดีไหม") · `portfolio` ("จัดพอร์ต/แบ่งเงินยังไง/ควรถืออะไรบ้าง") · `asset_hidden` ("สินทรัพย์ใต้ผืนน้ำ/ที่คนไม่สนใจ")
- tools: `getAssetVerdict(asset, user)` · `getPortfolioAllocation(user, amount)` · `getHiddenAssets(user)` (เงิน vs ทอง, REIT ปันผลสูง, บอนด์ยิลด์สูง, สวนยาง/ป่า — tier 🔴 ไม่มี verdict)
- คำตอบต้องแสดง: ธาตุ + fit กับดวง + tier ความเสี่ยง + สภาพตลาดปัจจุบัน (ราคา/ข่าว) — ครบ 3 มิติ
- Quick reply เพิ่ม: [ทองวันนี้] [จัดพอร์ต] [คริปโตเสี่ยงไหม]

**✅ Gate Phase 2:** ตอบทั้ง 5 ข้อคุณภาพดี (เช็กลิสต์ manual 10 คำถาม) · ไม่มีตัวเลขที่ไม่อยู่ใน tool output

---

## 8. Phase 3 — รายงานสไตล์สถาบัน (Warren Buffett)

### Task 3.1: เทมเพลตรายงาน docx
**Files:** Create `src/lib/report/report-docx.ts` (ใช้ docx skill) · Create `scripts/generate-report.ts`
- โครงสร้าง (เลียนแบบรายงานนักวิเคราะห์):
  1. บทสรุปผู้บริหาร (1 หน้า — verdict + ตัวเลขสำคัญ)
  2. ภาพธุรกิจ & Moat (description + revenueMix + buffett-checks)
  3. ฐานะการเงิน (ตาราง: รายได้/กำไร/ROE/PE/PBV/ปันผล — จาก Yahoo)
  4. Buffett Checklist (ตาราง pass/warn/fail + คำอธิบาย)
  5. ความเสี่ยง (จาก debt/margin/volatility + ธาตุเสี่ยง)
  6. **มุมมองดวง** (verdict + ไทม์ไลน์วัยจร + จังหวะปีนี้) ← จุดต่างจากสถาบันจริง
  7. Disclaimer หน้าแรก + ท้าย (กฎ ก.ล.ต.)
- Verify: สร้าง PDF/docx จริง อ่านแล้วเห็นภาพถูก (docx-stdlib/ocr ถ้าจำเป็น)

### Task 3.2: รายงานรายสัปดาห์อัตโนมัติ
- ต่อ daily-content: ทุกวันอาทิตย์ สร้าง "Market Weekly — 5 หุ้นเด่นสัปดาห์หน้า + เหตุการณ์มาแรง + IPO" (docx + โพสต์ LINE)
- cron job ได้ (Hermes cron) หรือ script ใน repo

### Task 3.3: รายงานรายเดือน "10 หุ้นใต้ผืนน้ำคู่ดวง" — VIP retention หลัก
**Files:** Modify `src/lib/report/report-docx.ts` · Create `scripts/generate-hidden-gems-report.ts`
- ต้นเดือน: docx "10 หุ้นใต้ผืนน้ำที่ตรงดวงคุณ" — แต่ตัว: underwater score + tier + verdict + เหตุผล "คนไม่เห็น/ปลอดภัย/ตรงดวง" + เปลี่ยนรายเดือน (หุ้นเดิมที่ดังขึ้น → ถอดออก)
- โพสต์ LINE: teaser 3 ตัว → ดูครบใน VIP (ต่อยอด subscription ฿790/เดือน)

### Task 3.4: รายงาน "จัดพอร์ตตามดวง + สินทรัพย์" (บท 7 + 13 รวมในเล่มเดียว)
**Files:** Modify `src/lib/report/report-docx.ts`
- ส่วนที่ 8 ของรายงานสถาบัน: ตารางจัดพอร์ต (ธาตุ → % → สินทรัพย์ตัวอย่าง) + verdict สินทรัพย์หลัก (ทอง/น้ำมัน/คริปโต/REIT/บอนด์) + "สินทรัพย์ใต้ผืนน้ำที่น่าสนใจเดือนนี้" 2–3 ตัว
- ทำให้รายงานหุ้นรายตัว → **รายงาน "แผนการเงินคู่ดวง"** (จุดขาย Premium ฿12,900 ต่อยอดได้)

**✅ Gate Phase 3:** รายงาน KBANK/AAPL/7203.T สร้างได้จริง เปิดดูสวย + ตัวเลขตรง Yahoo

---

## 9. Phase 4 — LINE OA + ขายจริง

### Task 4.1: LINE Messaging API webhook
**Files:** Create `src/server/webhook.ts` · Create `scripts/line-bot.ts` (long-poll หรือ webhook server)
- รับข้อความ → assistant.handle() → ตอบ (text/carousel)
- ลงทะเบียน LINE OA (Messaging API) — ต้องมี channel secret/access token (Q: user มี LINE OA แล้วไหม — funnel ใช้ LINE อยู่)

### Task 4.2: rich messages + onboarding
- First-time user: การ์ดเก็บวันเกิด (ถาม 4 คำถาม) → สร้างโปรไฟล์ → แชทเริ่ม
- หุ้นแนะนำ: carousel การ์ด (ชื่อ/ธาตุ/verdict/ปุ่ม "วิเคราะห์")

### Task 4.3: ต่อ value ladder
- แชทพื้นฐานฟรี (หุ้นวันนี้/IPO/ดวงวันนี้/ทองวันนี้) → ปลดล็อก "วิเคราะห์ลึก + **ใต้ผืนน้ำ** + **จัดพอร์ต + รายงาน**" = สิทธิ์ VIP (฿790/เดือน) — ต่อยอดจากเล่ม
- รายงาน docx + "10 หุ้นใต้ผืนน้ำ" + **จัดพอร์ตรายเดือนตามดวง** = ของแถม VIP (แทนคลิปอ่านเล่ม) — เพิ่ม perceived value + เหตุผลต่ออายุ
- Premium ฿12,900: "แผนการเงินคู่ดวงฉบับเต็ม" = รายงาน + ซินแสปรับพอร์ต (สินทรัพย์ครบ 12 ประเภท)

### Task 4.5: ช่องทางต่อประเทศ (channel matrix)
- ตาม §4.5: LINE ก่อน (TH/TW/JP — infrastructure เดียวกัน) + Web app (global) → Zalo (VN) / KakaoTalk (KR) / WhatsApp-Telegram (ID/MY) ตามลำดับเข้า
- แต่ละประเทศ: onboarding ภาษาท้องถิ่น + quick replies ภาษาท้องถิ่น + ราคาสกุลท้องถิ่น

### Task 4.6: Compliance checklist ต่อประเทศ (gate ก่อนเปิด)
- เปิดประเทศไม่ได้จนกว่า: disclaimer แปล + ตรวจกฎหมายท้องถิ่น (CSRC/FSA/SSC/FSS/BNM...) + ช่องทางชำระเงิน + ภาษี — checklist ต่อประเทศใน docs/

### Task 4.4: Web app (ถ้าตัดสินใจ Q1 = ทั้งคู่)
- Next.js (roadmap Phase 5 เดิม) — chat UI + ประวัติรายงาน + ดาวน์โหลด PDF

**✅ Gate Phase 4:** LINE OA ตอบได้จริงบนมือถือ · onboarding เก็บวันเกิดสำเร็จ · ผู้ใช้ VIP ปลดล็อกรายงานได้

---

## 10. Compliance & Risk (สำคัญสุด)

| ความเสี่ยง | ระดับ | มาตรการ |
|---|---|---|
| แชท = "ให้คำแนะนำการลงทุนรายบุคคล" (ผิด พ.ร.บ.หลักทรัพย์ฯ) | 🔴 | ตีกรอบทุกคำตอบ: "แนวโน้มตามดวง/การศึกษา ไม่ใช่คำแนะนำซื้อขาย" + ห้าม output "ซื้อ/ขาย" แบบเด็ดขาด (prompt + filter) + checkbox ตอน onboarding |
| LLM hallucination (ตัวเลข/ธาตุปลอม) | 🟠 | ตัวเลขต้องมาจาก tool เท่านั้น (post-check) · ธาตุ/verdict = deterministic เสมอ · LLM แค่เรียบเรียง |
| Yahoo/TradingView unofficial API (ToS/429/ปิดบริการ) | 🟡 | abstraction ชั้นเดียว (market-data.ts) → สลับ Finnhub/TwelveData ได้ · cache รายวัน |
| ข่าวไม่ทัน/ผิด | 🟡 | ระบุ timestamp + "ข่าวอาจเปลี่ยนแปลง" · events.json review รายสัปดาห์ |
| ต้นทุน LLM โต | 🟡 | cache คำตอบซ้ำ (hash คำถาม+วัน) · ใช้ DeepSeek · ตอบ template ก่อน LLM (intent ง่ายๆ ไม่ต้องใช้ LLM) |
| หุ้นเล็ก/กลาง ข้อมูลน้อย → verdict เสี่ยง | 🟠 | Tier 🔴 ไม่มี verdict · ต้องมี description จริงก่อนขึ้น 🟢/🟡 · ข้อมูล Yahoo ไม่ครบ = ดอง (ไม่เดา) · ซินแส review รอบ 2 ก่อน publish |

---

## 11. MVP 90 วัน (แนะนำลำดับ)

| สัปดาห์ | ทำอะไร | ผลลัพธ์ |
|---|---|---|
| 1–3 | Phase 0 ทั้งหมด | มี movers/IPO/ข่าว/พื้นฐาน pipeline + data + **ขยายไทย 250 + hidden-gems screener + สินทรัพย์ 12 ประเภท + จัดพอร์ต + universe เอเชีย 5 ตลาด** |
| 4–6 | Phase 1 (CLI ก่อน) | แชทตอบ 5 ข้อได้ครบ (template) |
| 7–9 | Phase 2 + LLM | คำตอบมีคุณภาพ + analysis narrative + **ตอบ "ใต้ผืนน้ำ" ได้** |
| 10–11 | Phase 3 รายงาน | สร้างรายงานสถาบัน docx ได้ + รายงานใต้ผืนน้ำรายเดือน |
| 12–13 | Phase 4 LINE | เปิดใช้ LINE OA เบต้า (กลุ่มทดสอบ) |

**ตัดสินใจก่อนเริ่ม:** Q1 (LINE ก่อน?) · Q2 (LLM API) · Q3 (compliance framing) — ตอบ 3 ข้อนี้แล้วเริ่ม Phase 0 ได้เลย

---

## 12. ไฟล์ที่จะสร้างทั้งหมด (แผนที่)

```
src/lib/market/yahoo.ts            src/lib/market/market-data.ts
src/lib/market/movers.ts           src/lib/market/news.ts
src/lib/market/hidden-gems.ts      src/lib/investor/ipo.ts
src/lib/assets/asset-universe.ts   src/lib/assets/asset-prices.ts
src/lib/assets/asset-verdict.ts    src/lib/assets/portfolio.ts
src/lib/i18n/locales.ts            src/lib/i18n/verdict-text.ts
src/lib/report/buffett-checks.ts   src/lib/report/report-docx.ts
src/lib/chat/intents.ts            src/lib/chat/tools.ts
src/lib/chat/user-store.ts         src/lib/chat/assistant.ts
src/server/webhook.ts
scripts/ipo-pipeline.ts            scripts/fetch-events.ts
scripts/chat-demo.ts               scripts/generate-report.ts
scripts/line-bot.ts                scripts/demo-market.ts
scripts/hidden-gems.ts             scripts/expand-thai-universe.ts
scripts/generate-hidden-gems-report.ts
scripts/fetch-asset-prices.ts      scripts/portfolio-demo.ts
data/ipo.json                      data/events.json
data/hidden-gems.json              data/users/<id>.json
data/stocks/commodities.json       data/stocks/real-assets.json
data/cache/market/<date>.json
tests/market-data.test.ts          tests/movers.test.ts
tests/ipo.test.ts                  tests/news.test.ts
tests/fundamentals.test.ts         tests/chat-intents.test.ts
tests/chat-tools.test.ts           tests/user-store.test.ts
tests/assistant.test.ts            tests/hidden-gems.test.ts
tests/assets.test.ts               tests/portfolio.test.ts
tests/i18n.test.ts
```
