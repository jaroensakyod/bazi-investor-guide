# PROJECT HANDOFF — เริ่มต่อจากไฟล์นี้เมื่อย้ายเครื่อง

> อัปเดต: 8 สิงหาคม 2569  
> โปรเจกต์: `bazi-investor-guide`  
> Branch หลักขณะบันทึก: `investor-guide`  
> Commit ล่าสุด: ตรวจด้วย `git log -1 --oneline` หลัง restore

## 0. สถานะล่าสุด — Editorial Report v7.2

ระบบส่งมอบถูกปรับจาก “เพิ่มหน้าและล็อกเนื้อหา” เป็น **หนังสือสมบูรณ์แยกตามคุณค่าของแต่ละราคา** ทุกเล่มไม่มีหน้าเบลอ ไม่มีหน้าล็อก และไม่มีหน้าตารางที่เพิ่มมาเพื่อให้ดูยาว

| Tier | หน้า | คำสัญญาหลัก | ข้อมูลการเงินที่ต้องมี |
|---|---:|---|---|
| FREE | 11 | เข้าใจบุคลิก วงจรตัดสินใจ และมีแผนเริ่มทำทันที | ไม่บังคับ; ถ้าไม่มีต้องระบุว่าเป็นตัวอย่าง |
| ฿99 | 18 | ระบบแบ่งเงิน ความเสี่ยง Life Map และแผน 90 วัน | รายรับ รายจ่าย เงินสำรอง หนี้ ระยะเวลา และขาดทุนที่รับได้ |
| ฿490 | 28 | ฐานะ เป้าหมาย Allocation, IPS, คิววิจัย พอร์ต และ scenario | ข้อมูล ฿99 + พอร์ต เป้าหมาย เงินเติม และ allocation ปัจจุบัน |
| ฿790 | 32 | ฿490 + deep research, journal, baseline และแผนติดตาม 12 เดือน | ชุดข้อมูลเต็มเหมือน ฿490 และใช้เป็นฐานเทียบรอบถัดไป |

Source of truth ของ Tier และลำดับหน้าอยู่ที่ `src/lib/report/product-system.ts` เท่านั้น ห้าม hardcode จำนวนหน้าหรือคำสัญญาซ้ำใน renderer/หน้าแอดมิน

### สถาปัตยกรรมส่งมอบ v7.2

```text
ข้อมูลเกิด + ข้อมูลการเงินจริง
          │
          ├─ deterministic BaZi engine
          ├─ deterministic financial engine (LLM ห้ามคำนวณตัวเลข)
          ├─ tier manifest + entitlement ที่ผูกกับโปรไฟล์
          └─ market snapshot + narrative cache ที่แยกตาม profile
                         │
                         ├─ canonical PDFKit editorial PDF
                         └─ HTML print preview
                                   │
                         artifact cache ตาม profile+tier+input+data date
```

- หน้าแอดมินส่งข้อมูลการเงินผ่าน `POST` JSON ไม่ใส่ตัวเลขการเงินใน URL
- HTML preview ใช้ local draft ID ชั่วคราว แล้วลบข้อมูลจาก browser หลังโหลดสำเร็จ
- Production paid tier ต้องมี `REPORT_ENTITLEMENT_SECRET` และ signed entitlement; เปลี่ยน `tier=790` ใน URL อย่างเดียวไม่ได้
- Paid tier ใน production ปฏิเสธการส่งมอบเมื่อข้อมูลการเงินจริงไม่ครบ
- Artifact filename ใช้ hash ไม่ใช้ชื่อ วันเกิด หรือข้อมูลการเงินของลูกค้า
- LLM ไม่อยู่ใน critical delivery path; ใช้ cache เฉพาะโปรไฟล์เดียวกันเท่านั้น

### Benchmark และ regression matrix

รัน `npm run report:matrix` เพื่อทดสอบ 6 โปรไฟล์ × 4 tier = 24 รูปแบบส่งมอบ ผลล่าสุด:

- personal signature ไม่ซ้ำ 6/6
- dominant element 3 แบบ, support element 4 แบบ, research queue 5 แบบ
- สร้าง PDF 32 หน้าจริงต่อโปรไฟล์ 749–938 ms บนเครื่องทดสอบ
- API cold หลังโหลดโมดูลประมาณ 1.00 s; request แรกหลังเปิด process 2.60 s; artifact cache hit 24–30 ms
- ไฟล์ทุกเล่มมากกว่า 1 MB และจำนวนหน้าตรง manifest
- รายละเอียดอ่านได้ที่ `output/report-matrix/report-matrix.md`

### Final proof

```text
output/pdf/bazi-report-free-editorial-v7.2.pdf  (11 หน้า)
output/pdf/bazi-report-99-editorial-v7.2.pdf    (18 หน้า)
output/pdf/bazi-report-490-editorial-v7.2.pdf   (28 หน้า)
output/pdf/bazi-report-790-editorial-v7.2.pdf   (32 หน้า)
```

สร้างใหม่ด้วย `npm run report:proofs` และตรวจภาพทุกหน้าด้วย Poppler ก่อนส่งมอบ

## 1. เอกสารที่ต้องอ่านก่อน

1. [`docs/pdf-product-system-master-plan.md`](./docs/pdf-product-system-master-plan.md) — แผนระบบ PDF ฉบับแม่บทและลำดับพัฒนาทั้งหมด
2. [`docs/pdf-buyer-audit-2026-08-08.md`](./docs/pdf-buyer-audit-2026-08-08.md) — ผลประเมินเล่มปัจจุบันในมุมผู้ซื้อ
3. [`date.md`](./date.md) — สรุประบบ PDF 6 ภาคก่อน redesign
4. [`UPDATE.md`](./UPDATE.md) — ประวัติระบบตลาด หุ้น ธาตุ และงานเดิม
5. [`docs/data-spec.md`](./docs/data-spec.md) — schema คลังหุ้น×ธาตุและ review trail

หากแผนเนื้อหา/Tier ใน `docs/offers/` ขัดกับ Master Plan ให้ยึด Master Plan เพราะเป็นการตัดสินใจล่าสุดหลังตรวจ PDF จริง

## 2. สถานะระบบเมื่อส่งต่อ

### Stack

- Node.js 22
- Next.js 16.3 / React 19 / TypeScript
- API local แยก process ที่พอร์ต 8787
- Next dev server พอร์ต 3000
- BaZi engine แบบ deterministic
- Market/fundamental data เก็บเป็น JSON snapshots/cache
- PDFKit editorial เป็น canonical downloadable PDF
- HTML print เป็นช่องทาง preview/พิมพ์สำรอง
- LLM narratives เป็น optional enrichment ที่สร้าง background แล้วเก็บ cache แยก profile

### URL ตัวอย่างล่าสุด

```text
http://localhost:3000/report/print?birthDate=1993-11-24&birthTime=15%3A12&gender=male&province=Bangkok&tier=790
```

### PDF proof รุ่นเก่า (เก็บเพื่อเทียบย้อนหลัง)

```text
output/pdf/bazi-investor-private-editorial-v5.pdf
```

หมายเหตุ: `output/` เป็น generated artifact และยังไม่ใช่ source of truth สำหรับ production

## 3. คำเตือนเรื่อง Git ก่อนย้ายเครื่อง

ขณะจัดทำเอกสารนี้ worktree มีงานที่ยังไม่ได้ commit หลายไฟล์ รวมถึง PDF v5, CSS, assets และ cache บางส่วน ห้ามใช้ `git reset --hard`, `git checkout --` หรือ clean worktree โดยไม่ตรวจ เพราะอาจลบงาน redesign ล่าสุด

ให้ตรวจด้วย:

```powershell
git status --short
git diff --name-only
git ls-files --others --exclude-standard
```

กลุ่มที่เห็นใน worktree ล่าสุด ได้แก่:

```text
M  next-env.d.ts
M  src/api/market.ts
M  src/app/report/print/page.tsx
M  src/lib/picks/monthly-picks.ts
?? AGENTS.md
?? CLAUDE.md
?? data/cache/narratives-v6/
?? output/
?? public/report/
?? scripts/.tmp-v6.ts
?? src/app/report/print/print.module.css
?? tmp/
```

รายการนี้เป็น snapshot เพื่อเตือน ไม่ใช่คำสั่งให้ commit ทั้งหมด ต้องตรวจว่าไฟล์ใดเป็น source, generated artifact, cache หรือ temporary ก่อน

### สิ่งที่ควรอยู่ใน Git

- Source code ใน `src/`
- Scripts ที่ใช้จริงใน `scripts/`
- Tests
- เอกสารใน `docs/`
- Final design assets ที่ระบบต้องใช้จริงใน `public/report/`
- `.env.example`
- Schema/migrations เมื่อเพิ่มฐานข้อมูล

### สิ่งที่ไม่ควรอยู่ใน Git

- `.env` และ secrets
- `node_modules/`, `.next/`, `tmp/`
- ข้อมูลลูกค้าจริงใน `data/users/`
- `data/usage.jsonl`
- Personalized narrative cache
- PDF ลูกค้าจริงหรือไฟล์ที่มีข้อมูลการเงิน

## 4. Checklist ก่อนเปลี่ยนเครื่อง

- [ ] ตรวจและ commit source/doc/assets ที่ต้องเก็บ โดยเลือกไฟล์อย่างตั้งใจ
- [ ] Push branch ที่ใช้งานไป remote
- [ ] เก็บ `.env` ใน password manager หรือ secret manager ห้ามส่งผ่าน Git
- [ ] สำรองข้อมูล local ที่ต้องใช้ต่อแบบเข้ารหัส
- [ ] สำรอง PDF proof หากต้องการเก็บเป็นตัวอย่าง
- [ ] จด provider/account ที่ใช้สำหรับ LLM, market data, payment และ deployment
- [ ] ยืนยันว่า `git status` ไม่มี source สำคัญที่ยังอยู่เฉพาะเครื่องเดิม
- [ ] ทดสอบ clone ลงโฟลเดอร์ใหม่และรันระบบได้ก่อนล้างเครื่องเดิม

### ข้อมูล local ที่ต้องตัดสินใจเป็นรายกลุ่ม

| Path | ความหมาย | แนวทาง |
|---|---|---|
| `.env` | Keys/config จริง | สำรองแบบลับ ไม่ commit |
| `data/users/` | โปรไฟล์ local/ข้อมูลส่วนบุคคล | สำรองเข้ารหัสเฉพาะที่จำเป็น |
| `data/cache/narratives-v6/` | เนื้อหาเฉพาะโปรไฟล์ | ไม่ commit; copy แบบลับชั่วคราวหรือ regenerate หลังแก้ isolation |
| `data/cache/market/` | Market snapshots | เก็บเฉพาะ snapshot ที่เป็น fixture/source สำคัญ |
| `output/` | PDF/render artifacts | เก็บ proof ที่ต้องอ้างอิง แต่อย่า commit ไฟล์ลูกค้า |
| `public/report/` | Cover/design assets | เลือก final source assets เข้า Git |
| `tmp/`, `.hermes-tmp.*` | ไฟล์ชั่วคราว | ไม่ต้องย้าย |

## 5. ติดตั้งบนเครื่องใหม่

### Requirements

- Git
- Node.js 22.x
- npm ที่มากับ Node
- Browser/Chromium สำหรับตรวจ print output
- Keys ที่ระบุใน `.env.example`

### Restore

```powershell
git clone <repository-url>
Set-Location bazi-investor-guide
git switch investor-guide
npm ci
Copy-Item .env.example .env
```

จากนั้นใส่ secrets จริงใน `.env` โดยไม่แก้ `.env.example` ให้มี key จริง

### รันระบบปัจจุบัน

Terminal 1:

```powershell
npm run api
```

Terminal 2:

```powershell
npm run dev
```

เปิด:

```text
http://localhost:3000
http://localhost:3000/report/print?birthDate=1993-11-24&birthTime=15%3A12&gender=male&province=Bangkok&tier=790
```

## 6. Verification หลัง Restore

รันตามลำดับ:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
npm run report:matrix
npm run report:proofs
```

จากนั้นตรวจด้วยตา:

- หน้าเว็บโหลดข้อมูลจาก API ได้
- รายงาน 24 หน้า render ครบ
- ฟอนต์ไทยไม่แตก
- ปกและภาพประกอบขึ้นครบ
- ไม่มีรูปทับข้อความ
- Market as-of date แสดงถูกต้อง
- ทดสอบอย่างน้อยสองวันเกิดเพื่อดูว่าข้อความไม่ hardcode เป็นคนตัวอย่าง

## 7. ข้อกำหนดเฉพาะ Next.js ใน repo นี้

ก่อนแก้โค้ด Next.js ต้องอ่านคู่มือรุ่นที่ติดตั้งจริงใน:

```text
node_modules/next/dist/docs/
```

เริ่มจาก:

```text
node_modules/next/dist/docs/01-app/01-getting-started/
```

อย่าอาศัยความจำจาก Next.js รุ่นเก่า เพราะ `AGENTS.md` ระบุว่ารุ่นนี้มี breaking changes

## 8. จุด P0 ที่ต้องทำก่อนเปิดหลายผู้ใช้

1. แก้ narrative cache ให้ผูก `reportSnapshotId + moduleId`
2. หยุดใช้ข้อมูลวันเกิดและการเงินตัวอย่างใน paid flow
3. เอาข้อมูลการเงินออกจาก query string
4. สร้าง server-side Tier manifest และ entitlement checks
5. Parameterize ข้อความ/ภาพ/หุ้นที่เขียนเฉพาะโปรไฟล์ตัวอย่าง
6. เพิ่ม automated test ให้ผู้ใช้สองคนสร้างพร้อมกันโดยข้อมูลไม่ปะปน

ห้ามเปิด paid multi-user ก่อนผ่านทั้ง 6 ข้อนี้

## 9. ลำดับทำงานเมื่อเริ่มต่อ

```text
P0 isolation/security
→ database/auth/snapshots
→ financial intake/engines
→ module report pipeline
→ renderer/visual QA
→ payment/entitlement/delivery
→ VIP monthly delta
→ pilot/hardening
```

รายละเอียดงานและ Exit Gate อยู่ใน [`docs/pdf-product-system-master-plan.md`](./docs/pdf-product-system-master-plan.md)

## 10. กฎสำคัญสำหรับผู้รับช่วงงาน

- Preserve งานผู้ใช้ใน dirty worktree
- อย่าสร้าง narrative version ใหม่เพิ่มโดยไม่ยุบของเก่า
- อย่าให้ LLM คำนวณตัวเลขการเงินสำคัญ
- อย่าอ่าน cache “ไฟล์ล่าสุด” เพื่อสร้างรายงานเฉพาะคน
- อย่าใช้ demo values ใน paid artifact
- อย่าเก็บข้อมูลการเงินใน URL หรือ logs
- อย่าทำ Tier ด้วยการซ่อน client-side อย่างเดียว
- อย่าเพิ่มหน้าเพื่อให้ดูคุ้ม ต้องเพิ่มคำตอบ หลักฐาน และสิ่งที่ทำต่อได้
- HTML print คือ renderer หลัก; PDFKit ไม่ควร mirror หนังสือเต็มอีกชุด
- ทุก PDF ต้องย้อนหา input snapshot, data date, rule, prompt, model และ artifact checksum ได้

## 11. Definition of successful handoff

การย้ายเครื่องถือว่าสำเร็จเมื่อ:

- Clone จาก remote ได้โดยไม่พึ่งไฟล์ source ที่อยู่เฉพาะเครื่องเก่า
- ใส่ secrets แล้วติดตั้งด้วย `npm ci` สำเร็จ
- Tests/typecheck/build ผ่าน
- เปิด report preview ได้
- Final design assets ครบ
- เอกสาร Master Plan อ่านได้จาก repo
- ข้อมูล local ที่จำเป็นถูก restore อย่างปลอดภัย
- ไม่มีข้อมูลลูกค้าจริงหลุดเข้า Git history
