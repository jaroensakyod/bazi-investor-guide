# สรุปงานล่าสุด — Platform Core First

> **สถานะล่าสุด 9 ส.ค. 2569:** หุ้นต่างประเทศมี terminal evidence status ครบ **5,958/5,958 (100%)**, `unclassified=0`; มี official listing/first-trading date จริง **4,004/5,958 (67.20%)** และภาพรวมรวมไทย **4,269/6,223 (68.60%)**
>
> เอกสารส่งต่อและคำสั่งย้ายเครื่องฉบับล่าสุด: [`docs/foreign-security-date-coverage-100-status-2026-08-09.md`](./docs/foreign-security-date-coverage-100-status-2026-08-09.md)
>
> QA ล่าสุด: 67 test files / 370 tests ผ่าน · typecheck ผ่าน · targeted lint 0 errors · production build ผ่าน · official stage ซ้ำได้ `added=0`, `alreadyPresent=4,677`, conflicts 0
>
> **ยังพัก PDF:** fundamentals ทั้งระบบ 351/6,223 (5.64%), adjusted EOD 275/6,223 (4.42%), exact first-trade time 0 และสิทธิ์ commercial รายตลาดยังไม่ผ่าน

> **ทิศทางใหม่ 8 ส.ค. 2569:** พักการเพิ่มหน้า/ภาพ/PDF แล้วทำ data, research, pattern/backtest และ compliance ให้ผ่านก่อน
>
> เอกสารแม่บทล่าสุด: [`docs/platform-core-first-plan-2026-08-08.md`](./docs/platform-core-first-plan-2026-08-08.md)
>
> ตรวจสถานะทุกเครื่อง: `npm.cmd run research:audit`
>
> ผลเติมข้อมูลนำร่อง: [`docs/security-data-pilot-th10-2026-08-08.md`](./docs/security-data-pilot-th10-2026-08-08.md)
>
> ผลฐานข้อมูลหุ้นไทยฉบับเต็ม: [`docs/thai-research-data-foundation-2026-08-08.md`](./docs/thai-research-data-foundation-2026-08-08.md)
>
> ผลฐานวันหุ้นต่างประเทศ + US10: [`docs/foreign-security-dates-2026-08-09.md`](./docs/foreign-security-dates-2026-08-09.md)

## สถานะวันหุ้นต่างประเทศ

- Foreign universe 5,958 ตัว / 27 market groups: terminal evidence status **5,958 (100%)**, official listing **4,004 (67.20%)**, company origin **684 (11.48%)** และ exact first-trade time 0
- รอบล่าสุด Xetra ครบ 239/239 โดยคง historical evidence 45 ตัวและเติม current instrument fallback 194 ตัว; ภาพรวมทั้งระบบเป็น 4,269/6,223 (68.60%)
- รายการที่ยังไม่มีวันทางการ 1,954 ตัวมี terminal reason และ next action ทุกตัว; ไม่มี `unclassified`
- SGX ได้ 92/98 จาก issuer-level Listed Date & Board; 6 ตัวที่ไม่มีวันระดับวันหรือเป็น alias ไม่ชัดถูกปล่อย unresolved
- พบ provider candidate 4,888 ตัว (82.04%) แต่กักไว้ทั้งหมด ไม่ใช้คำนวณดวงหุ้นจนกว่าจะมีหลักฐานทางการ
- US10 official pilot มี fundamentals, official date, EOD และ pattern-ready ครบ 10/10
- เพิ่ม pipeline SEC identity, source policy 29 ตลาด, compact snapshots, conflict-safe stage, 100% evidence ledger และ readiness gate แล้ว
- paid/public ต่างประเทศยังบล็อกจนกว่าสิทธิ์แสดงผล, licensed fundamentals/EOD และ legal review จะผ่าน
- รายละเอียดต่อแหล่ง/คำสั่งย้ายเครื่อง: [`docs/foreign-security-date-coverage-100-status-2026-08-09.md`](./docs/foreign-security-date-coverage-100-status-2026-08-09.md)

## สถานะล่าสุดหลังขยายหุ้นไทย

- Security catalog 271 แถว: หลักทรัพย์ปัจจุบัน 265 + historical aliases 6
- Official listing date 265/265 (100%) และไม่มีการแต่งเวลา first trade
- Company origin exact 217/265; มีเพียงปี 41; ยังไม่พบ 7
- Fundamentals usable 265/265; core ≥3 fields 263/265
- EOD gzip 265/265 รวม ~4.32 MiB; pattern-ready ≥252 sessions 262/265
- แก้ dividend yield normalization ซ้ำ 100 เท่าแล้ว และมี `npm.cmd run research:migrate-market-v2` สำหรับ snapshot เก่า
- Internal development gates ผ่าน แต่ paid/public ยังบล็อกเพราะข้อมูล Yahoo เป็น development-only และสิทธิ์ SET ยังต้องยืนยัน

## สิ่งที่เพิ่มใน Core Foundation

- Security event provenance + confidence A–D โดยไม่แต่งเวลา first trade
- Shared compressed price-series store ไม่ทำสำเนากราฟต่อผู้ใช้
- Pattern observation + historical scenarios + walk-forward evaluation
- Research assessment ที่แยก market score ออกจาก BaZi อย่างเด็ดขาด
- User-authored alerts และ compliance capability/text gates
- `GET /api/research`, generic research screen, immutable snapshot และ readiness audit
- QA ล่าสุดหลังเพิ่มต่างประเทศ: typecheck ผ่าน · 57 test files / 314 tests ผ่าน · targeted lint 0 errors · production build ผ่าน
- Runtime smoke ผ่าน: `/api/research` และ `/api/research-screen`; web `:3000` + API `:8787` ทำงาน
- global lint ยังมี 18 errors / 1 warning ในไฟล์เดิมนอก research core (จำนวนเท่า baseline) และต้องแยก cleanup ต่อ

## ช่องว่างข้อมูลที่ต้องทำต่อก่อน PDF

- Universe 6,229 ตัว / researchable 6,223: ราคาล่าสุด 5,284 (84.91%) · fundamentals 351 (5.64%)
- Company origin exact date 901 (14.48%); ไทยปัจจุบัน 217 และต่างประเทศ 684
- Official listing/first-trading date 4,075/6,223 (65.48%); ต่างประเทศ 3,810/5,958 (63.95%) · exact first-trade time 0%
- Adjusted EOD series 275 (4.42%); ไทยครบ 265 และ US10 ครบ 10
- TH10 และ US10 มี fundamentals/วันทางการ/EOD ครบ แต่ข้อมูลตลาดยังเป็น development-only
- ขั้นถัดไป: licensed fundamentals/EOD + US/Europe security master → corporate actions/symbol history → validate model → data-license/legal review

---

# ภาคผนวก — Editorial Report v7.2

**วันที่**: 8 ส.ค. 2569 · **Repo**: `C:\Users\ASUS\Desktop\biz\bazi-investor-guide` · **Branch**: `investor-guide`
**Commit**: ตรวจด้วย `git log -1 --oneline` · **สถานะ QA ล่าสุด**: typecheck และ report-system tests ผ่าน

---

## ✅ สิ่งที่ส่งมอบใน v7.2

- เปลี่ยนจาก PDF ยาวแบบรายงานงบ/ตารางซ้ำ เป็นหนังสือ A4 แบบ editorial ที่ตอบคำถามทีละเรื่อง
- ฟอนต์เนื้อหาหลักประมาณ 12pt, จัดชิดซ้าย, ใช้ตารางเท่าที่จำเป็น และไม่มีภาพทับตัวหนังสือ
- แต่ละราคาคือเล่มสมบูรณ์: `FREE=11`, `฿99=18`, `฿490=28`, `฿790=32` หน้า
- เพิ่ม Financial Snapshot, willingness เทียบ capacity, goal gap, allocation, IPS, portfolio diagnostic, stress scenario, source ledger, decision journal และ baseline ตาม tier
- ตัวเลขการเงินทั้งหมดคำนวณด้วย deterministic engine; LLM ห้ามคำนวณยอดเงิน ผลตอบแทน หรือ allocation
- Paid production ต้องมีข้อมูลการเงินจริงครบและ signed entitlement ที่ผูกกับโปรไฟล์
- แก้ narrative cache ให้ดึงได้เฉพาะ identity ของคนเดียวกัน และเพิ่ม artifact cache แบบ hash + atomic write + in-flight dedupe
- หน้าแอดมินแสดงคุณค่าจริงของแต่ละ tier รับข้อมูลการเงินตามระดับ และส่งข้อมูลผ่าน POST แทนการใส่ตัวเลขใน URL

## 💎 Value ladder

| Tier | หน้า | สิ่งที่ผู้ซื้อได้เพิ่ม |
|---|---:|---|
| FREE | 11 | บุคลิกการเงิน หลักฐาน/ข้อจำกัด วงจรตัดสินใจ แผนเดือน และ 30/90/365 วัน |
| ฿99 | 18 | ระบบแบ่งเงิน กรอบ willingness/capacity จังหวะชีวิต Life Map และ worksheet |
| ฿490 | 28 | ฐานะ เป้าหมาย Allocation, IPS, กรวยคัดหุ้น คิววิจัย วินิจฉัยพอร์ต stress test และแหล่งข้อมูล |
| ฿790 | 32 | Deep research 3 บริษัท, decision journal, monthly baseline และแผนทบทวน 12 เดือน |

## 🧪 เปรียบเทียบหลายคนและเวลาเจน

คำสั่ง `npm run report:matrix` ทดสอบ 6 โปรไฟล์ × 4 tier รวม 24 แบบ และสร้าง PDF 32 หน้าจริงให้ทุกโปรไฟล์:

- ลายเซ็นเฉพาะบุคคล 6/6 ไม่ซ้ำ
- ธาตุเด่น 3 แบบ · ธาตุเสริม 4 แบบ · คิววิจัย 5 แบบ
- เวลา PDF 32 หน้า: 749–938 ms ต่อคนบนเครื่องทดสอบ
- API cold หลังโหลดโมดูล ~1.00 วินาที · ครั้งแรกหลังเปิด process ~2.60 วินาที · cache hit 24–30 ms
- ขนาดเล่มประมาณ 2.66 MB และทุก tier มีจำนวนหน้าตรง manifest
- ผลแบบอ่านได้: `output/report-matrix/report-matrix.md`
- ผลแบบเครื่องอ่าน: `output/report-matrix/report-matrix.json`

## 📄 Final proofs

```text
output/pdf/bazi-report-free-editorial-v7.2.pdf
output/pdf/bazi-report-99-editorial-v7.2.pdf
output/pdf/bazi-report-490-editorial-v7.2.pdf
output/pdf/bazi-report-790-editorial-v7.2.pdf
```

ใช้ `npm run report:proofs` เพื่อสร้างใหม่ และต้อง render ตรวจทุกหน้าก่อนส่งลูกค้า

## 🏗️ ไฟล์ source of truth

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/report/product-system.ts` | tier manifest, page ladder, promises, page count |
| `src/lib/report/financial-system.ts` | คำนวณฐานะ ความเสี่ยง เป้าหมาย allocation และ scenarios |
| `src/lib/report/report-input.ts` | contract ข้อมูลขั้นต่ำตาม tier |
| `src/lib/report/report-entitlement.ts` | สิทธิ์ paid ที่ลงลายเซ็นและผูก profile |
| `src/api/report-pdf-editorial.ts` | canonical PDF renderer |
| `src/api/report-pdf-artifact-cache.ts` | cache ไฟล์ส่งมอบแบบแยก input/profile |
| `src/app/report/print/page.tsx` | HTML print preview |
| `scripts/report-matrix.ts` | cross-profile regression + performance benchmark |

---

## ภาคผนวก: snapshot ระบบ 6 ภาครุ่นก่อน v7

## 🎯 ภาพรวมงานวันนี้

เปลี่ยน "รายงาน PDF ธรรมดา" → **หนังสือจ่ายเงิน 6 ภาค อ่านต่อเนื่อง** (เหมือนหนังสือจริง ไม่ใช่แยกย่อย):

| ก่อน | หลัง |
|---|---|
| 3-4 หน้า ตารางล้วน | **หนังสือ 6 ภาค** · ปกโดนัทธาตุ · สารบัญ · บทนำ |
| อธิบายสั้น (1-2 ประโยค/ส่วน) | **LLM เขียน 1,700-2,300 ตัวอักษร/ภาค** (โทน "อาจารย์หมิง" อบอุ่น เล่าเรื่อง) |
| แนะนำหุ้นแบบข้อมูลดิบ | **การ์ดคำอธิบายรายตัว** (ทำไมตรงดวง/ซื้อยังไง/ระวังอะไร) |
| font 9-10pt อัดแน่น | **font 11pt + lineGap 4 + spacing 32** (อ่านง่าย) |
| PDFKit อย่างเดียว (ช้า ~2 นาที) | **2 ช่องทาง**: 🖨️ HTML print (instant คุณภาพสูง) + 📥 PDF ด่วน |

## 📚 โครงสร้างหนังสือ (6 ภาค)

1. **มุมมองดวง** — กำลังดิถี/ธาตุในดวง/ธาตุลาภ/ความหมายต่อการเงิน (LLM ✅ 2,189 ตัว)
2. **การจัดสรรเงิน** — 70:10:20 + เครื่องมือแต่ละกอง (LLM ✅ 2,098 ตัว)
3. **พอร์ตเด่น** — TH30/US30 พร้อมการ์ดรายตัว (LLM 🔄 gen — ดูภาพประกอบ: ตาราง TH30 เทียร์ VIP/PRO/FREE + คะแนน 7.1→5.0)
4. **สินค้าแนะนำ** — 11 หมวด fit 4 ระดับ พร้อมการ์ดรายตัว (LLM 🔄 gen)
5. **แผนที่ชีวิต** — วัยจร 0-80+ ปี (LLM ✅ 1,794 ตัว)
6. **ฉบับเดือนนี้** — ธาตุเดือน/ปฏิทินมงคล/แผนรายเดือน (LLM ✅ 2,363 ตัว) — ของสด VIP

+ ภาคผนวก: เช็กลิสต์ 30 ข้อ · อภิธานศัพท์ · สรุปท้ายเล่ม

## 🏗️ สถาปัตยกรรม (สำคัญ)

```
┌─ gen (background, ~5 นาที) ─┐        ┌─ ส่งมอบ (instant) ─┐
│ 6 LLM calls (1/ภาค)         │        │ 🖨️ /report/print    │
│ → cache data/cache/         │        │   (HTML window.print│
│   narratives-v6/1-6.json    │──อ่าน──▶    → PDF คุณภาพสูง) │
└─────────────────────────────┘        │ 📥 /api/product-pdf │
                                       │   (PDFKit ด่วน)     │
                                       └─────────────────────┘
```

**กฎเหล็ก**: PDF/API **อ่านแต่ cache** (0.42s) — ห้าม gen LLM ในเส้นทางส่งมอบ (ไม่อุดตัน) · gen แยก background + retry 3× + cache เติมรอบหน้า

## 📁 ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `src/lib/report/narrative-v6.ts` | engine 6 ภาค: `generateBookNarrative` → {intro, body, picks, summary} |
| `src/lib/report/narrative-v5.ts` | ระบบ 26 บท (สำรอง — cache 21/26 บท) |
| `src/lib/report/narrative.ts` | v4 7 ส่วน (fallback) |
| `src/api/report-pdf-full.ts` | PDFKit builder + tier lock (mirror 25 บท) |
| `src/app/report/print/page.tsx` | หน้า HTML print 6 ภาค (ตัวหลักคุณภาพสูง) |
| `src/api/market.ts` | `handleReportHtmlData` (ข้อมูล+book จาก cache) · `handleProductPdf` |
| `src/app/admin/pdf/page.tsx` | โรงงาน PDF: กรอกวันเกิด → เลือก tier → 🖨️/📥 |

## 💰 Tier (จ่ายสูง = เห็นมากขึ้น)

`free=ตัวอย่าง · ฿99=ภาค 1-2 · ฿490=+3-4 · ฿790=ครบ 6 ภาค + ฉบับเดือนนี้ (ของสดรายเดือน)`

## 🧪 ข้อมูลทดสอบ

- ดวง: `birthDate=1993-11-24 · birthTime=15:12 · gender=male · province=Bangkok`
- ผล: ดิถีอ่อน (ดินทราย) · น้ำ 45% เกิน = 身弱财旺 → **เสริมไฟ หลีกไม้** · เทรดไม่ได้
- พอร์ต TH30 top: BH (7.1) / BDMS (6.5) / PTTEP (6.4) / GULF / BANPU / GUNKUL / XPG / BEAUTY / PTT / DELTA (5.0)
- ตรวจ: `curl "http://localhost:8787/api/product-pdf?tier=790&birthDate=1993-11-24&birthTime=15:12&gender=male&province=Bangkok" -o out.pdf`

## ⚠️ สิ่งที่ค้าง (คิวถัดไป)

1. **ภาค 3-4 LLM gen** (มีการ์ดรายตัว picks) — background gen รอ provider กลับมา → cache เต็ม 6/6
2. **PDFKit mirror เป็น 6 ภาค** (ตอนนี้ยังเป็น 25 บท condensed — ต้องย่อเป็น 6 ภาคตาม print page)
3. เดploy/LINE push — ยังไม่ทำ (ทำฟีเจอร์ให้ครบก่อน)
4. Provider Nous→Novita 503 บ่อย → retry-cache กันไว้แล้ว

## 🔑 บทเรียน (อยู่ใน skill `bazi-book-report-pipeline`)

- เนื้อหายาว LLM ต้อง `maxTokens 8000` (งบน้อย → content null เพราะ reasoning กินงบ)
- prompt ยาว → fail บ่อย → แยก batch (6 calls) + retry 3× + cache รายภาค
- PDFKit render ไทยบน Windows ช้า (~2 นาที) → ใช้ HTML print เป็นตัวหลัก
- cwd ค้างข้าม repo · heredoc ยาวใช้ write_file · server 8787 kill ทุก PID ก่อน restart

---
*สร้างโดย Hermes Agent — สรุปส่งงานต่อ 8 ส.ค. 2569*
