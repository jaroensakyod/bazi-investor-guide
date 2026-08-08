# PROJECT HANDOFF — เริ่มต่อจากไฟล์นี้เมื่อย้ายเครื่อง

> อัปเดต: 8 สิงหาคม 2569  
> โปรเจกต์: `bazi-investor-guide`  
> Branch หลักขณะบันทึก: `investor-guide`  
> Remote HEAD ที่ยืนยันแล้วก่อนเอกสารชุดนี้: `af09ea8`

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
- HTML print เป็น PDF คุณภาพหลัก
- PDFKit เป็นช่องทางสำรอง/เอกสารสั้น
- LLM narratives สร้าง background แล้วเก็บ cache

### URL ตัวอย่างล่าสุด

```text
http://localhost:3000/report/print?birthDate=1993-11-24&birthTime=15%3A12&gender=male&province=Bangkok&tier=790
```

### PDF proof ล่าสุด

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
