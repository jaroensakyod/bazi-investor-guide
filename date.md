# สรุปงาน — ระบบหนังสือ PDF "การลงทุนคู่ดวง" (6 ภาค)

**วันที่**: 8 ส.ค. 2569 · **Repo**: `C:\Users\ASUS\Desktop\biz\bazi-investor-guide` · **Branch**: `investor-guide`
**HEAD**: `512fd30` · **เทสต์**: 226/226 (30 ไฟล์) · typecheck/build เขียว

---

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
