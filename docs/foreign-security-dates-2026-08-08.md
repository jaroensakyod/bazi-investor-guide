# ฐานวันหุ้นต่างประเทศ — สถานะและระบบรองรับ

> อัปเดต 8 สิงหาคม 2569 · ใช้คู่กับ `npm.cmd run research:audit`

## คำตอบสั้น

วันของหุ้นต่างประเทศหาได้ แต่ต้องแยกความหมายและระดับหลักฐานก่อนใช้กับดวงหุ้น ระบบจึงเก็บเหตุการณ์ 3 ชนิดแยกกัน:

1. `incorporation` — วันที่นิติบุคคลก่อตั้ง
2. `listing_admission` — วันที่ตลาดอนุมัติ/รับหลักทรัพย์เข้าจดทะเบียน
3. `first_trading_day` — วันซื้อขายวันแรก

ห้ามนำวันที่จากประวัติราคาหรือ provider มาแทนวันทางการโดยอัตโนมัติ และห้ามสมมติเวลาตลาดเปิดเป็น “เวลาเกิดหุ้น” หากไม่มีเอกสารยืนยันเวลาเหตุการณ์จริง

## สถานะข้อมูลปัจจุบัน

รอบนี้เพิ่มวันทางการจาก **1,531 → 2,984 ตัว** หรือ **25.70% → 50.08%** ของหุ้นต่างประเทศ เพิ่มสุทธิ 1,453 ตัวโดยไม่มี date conflict ตอนนำเข้า

| รายการ | ผล ณ 8 ส.ค. 2569 | วิธีใช้ |
|---|---:|---|
| หุ้นต่างประเทศใน catalog | 5,958 ตัว / 29 market codes | universe ที่ต้องเติมหลักฐาน |
| วันเข้าตลาด/วันซื้อขายจากหลักฐานทางการ | 2,984 ตัว (50.08%) | canonical security event |
| วันก่อตั้งบริษัทจากหลักฐานทางการ | 684 ตัว (11.48%) | company-origin event แยกจากวันหุ้น |
| ภาพรวมทั้งระบบรวมไทย | official listing 3,249/6,223 (52.21%) | ไทยปัจจุบันครบ 265/265 |
| provider date ที่พบ | 4,888 ตัว (82.04%) | กักใน staging เพื่อช่วยค้นเอกสารเท่านั้น |
| เวลาซื้อขายแรกที่มีหลักฐานระดับเวลา | 0 ตัว | ระบบเก็บ `time=null`; ไม่แต่งเวลา |
| Daily EOD series | 275/6,223 ตัว (4.42%) | gzip ชุดกลาง ไม่ทำสำเนากราฟต่อรายงาน |
| US10 pilot | official date/fundamentals/EOD 10/10 | พร้อมวิจัยภายใน แต่ยังไม่อนุญาตเชิงพาณิชย์ |

### Coverage จากตัวเชื่อมต่อทางการ

| ตลาด/แหล่ง | ตรง catalog | หมายเหตุที่ไม่เดา |
|---|---:|---|
| TWSE | 187/188 | วันก่อตั้งและวันเข้าตลาดจาก OpenAPI |
| NSE India | 294/298 | equity/REIT/InvIT แยกชุด |
| SSE | 324/327 | Main Board, STAR และ B-share |
| SZSE | 307/307 | ครบ catalog |
| JPX/TSE | 409/411 | detail ทางการแบบ snapshot ย่อ |
| LSE | 270/275 | Admission date ตาม TIDM |
| KRX KIND | 201/234 | ไม่ยืมวัน common share ให้ preferred class |
| ASX | 246/251 | ไฟล์อยู่บน ASX แต่ข้อมูลระบุผู้ให้บริการ LSEG/Morningstar; ต้องตรวจ license |
| PSE EDGE | 72/85 | ไม่ยืมวันให้ preferred share ที่ไม่มีแถวตรง |
| Saudi Exchange | 73/87 | อีก 14 profile แสดง `/`; เก็บวันก่อตั้งได้ 87/87 |
| IDX | 148/149 | `XSPI` ไม่อยู่ในรายชื่อบริษัทปัจจุบัน |
| เวียดนาม | 351/351 | catalog เดิมชื่อ HOSE แต่จริงเป็น HOSE 182 + HNX 169; event เก็บ venue จริง |
| SGX | 92/98 | ใช้ issuer-level Listed Date & Board; 6 ตัวไม่มีวันระดับวันหรือเป็น alias ที่ยืนยันไม่ได้ |
| US10 issuer/filing pilot | 10/10 | แหล่ง IR/filing รายบริษัท ไม่ใช่ bulk feed |

รวม adapter ทางการ 13 ตลาดได้ 2,974 วัน และ US10 อีก 10 วัน รวมเป็น 2,984 วัน รายการที่ไม่ตรง, class share, ticker เก่า, relisting หรือวันที่ไม่ครบวันจะคงสถานะ unresolved แทนการเติมค่าเดา

ไฟล์ staging ของ provider มี 5,958 แถว ขนาดประมาณ 3.2 MiB และไม่มีชุดกราฟราคา จึงไม่ทำให้ pattern storage บวม ส่วน snapshot ทางการเก็บเฉพาะแถวที่จำเป็นต่อ catalog และมี hash/provenance ในผล stage

สิทธิ์แสดงผลเชิงพาณิชย์ยังเป็น `unknown` สำหรับแหล่งตลาดทั้งหมด จึงใช้เพื่อวิจัย/พัฒนาภายในก่อน จนกว่าจะตรวจเงื่อนไขตลาดและ data license เสร็จ โดย ASX ต้องระวังเป็นพิเศษเพราะหน้า directory ระบุผู้ให้บริการข้อมูลภายนอก

## หุ้นสหรัฐนำร่อง 10 ตัว

| หลักทรัพย์ | เหตุการณ์ canonical | วันที่ | หลักฐานหลัก |
|---|---|---:|---|
| AAPL | listing admission | 1980-12-12 | Apple Investor Relations |
| MSFT | listing admission | 1986-03-13 | Microsoft Investor Relations |
| NVDA | listing admission | 1999-01-22 | NVIDIA Investor Relations |
| AMZN | listing admission | 1997-05-15 | Amazon Investor Relations |
| GOOGL | listing admission | 2004-08-19 | Alphabet annual report |
| META | first trading day | 2012-05-18 | Meta annual report |
| TSLA | first trading day | 2010-06-29 | Tesla Form 10-K |
| NFLX | first trading day | 2002-05-23 | Netflix IPO release |
| BABA | listing admission | 2014-09-19 | Alibaba Investor Relations |
| V | first trading day | 2008-03-19 | Visa Investor Relations |

รายละเอียด URL, วันที่เข้าถึง, quote locator, confidence และข้อจำกัดอยู่ใน `data/curated/us10-security-events.json` และถูกนำเข้า `data/security-events.json` แล้ว

## เหตุผลที่ไม่ใช้ provider date ตรง ๆ

ฟิลด์ `firstTradeDateMilliseconds` ช่วยคัดกรองได้เร็ว แต่ไม่ใช่หลักฐานตลาดหลักทรัพย์ และอาจสะท้อนเพียงจุดเริ่มต้นของข้อมูลที่ provider มี ตัวอย่างหุ้นเก่าบางตัวให้วันที่ใหม่กว่าการเข้าตลาดจริงหลายสิบปี ระบบจึงตั้ง `eligibleForSecurityBirth=false` ทุกแถว และต้องมี official/issuer evidence ก่อนเลื่อนเป็น canonical event

## สถาปัตยกรรมที่เพิ่มแล้ว

- `scripts/stage-official-foreign-events.ts` — รวม adapter, hash แหล่งข้อมูล, ตรวจ conflict และ import แบบ idempotent
- `src/lib/research/foreign-date-source-policy.ts` — policy ครบ 29 market codes แยก source/status/time zone
- `src/lib/research/*company*` และ `*security-list*` — parser/matcher ทางการรายตลาด 13 กลุ่ม
- `src/lib/research/vietnam-exchange-company-dates.ts` — แก้ catalog Vietnam ที่เคยรวม HOSE/HNX พร้อมคง venue จริง
- `src/lib/research/sgx-corporate-information.ts` — ใช้ประวัติ Listed Date & Board และแยก issuer admission จาก counter first trade
- `src/lib/research/provider-date-candidate.ts` — แปลง provider date เป็น candidate ที่ถูกกัก
- `scripts/stage-foreign-date-candidates.ts` — batch 5,958 ตัว พร้อม checkpoint/output แบบ atomic
- `src/lib/research/sec-security-master.ts` — จับคู่ SEC CIK/name/ticker/exchange และรองรับ class share
- `src/lib/research/security-birth.ts` และ `security-event-store.ts` — provenance/confidence, canonical event และ atomic store
- `src/lib/research/readiness-audit.ts` — audit coverage แยกต่างประเทศ รายตลาด และ candidate quarantine
- `data/security-events.json` — canonical events ที่ import แล้ว
- `data/staging/*company-dates.json` — snapshot ย่อสำหรับแหล่งที่ CDN/หน้าเว็บต้องใช้ browser ตรวจ
- `data/staging/foreign-provider-date-candidates.json` — candidate สำหรับค้นหลักฐานต่อ

## คำสั่งใช้งานเมื่อย้ายเครื่อง

```powershell
npm install
npm.cmd run research:audit
npm.cmd run research:stage-foreign-date-candidates
npm.cmd run research:stage-official-foreign-events -- --jpx-input=data/staging/jpx-company-dates.json --lse-input=data/staging/lse-instrument-dates.json --pse-input=data/staging/pse-company-dates.json --tadawul-input=data/staging/tadawul-company-dates.json --idx-input=data/staging/idx-company-dates.json --vietnam-input=data/staging/vietnam-company-dates.json --sgx-input=data/staging/sgx-company-dates.json --apply
npm.cmd run research:seed-pilot -- --pilot=us10-official-v1
npm.cmd test
npm.cmd run typecheck
```

คำสั่ง stage จะดาวน์โหลด TWSE/NSE/SSE/SZSE/KRX/ASX ใหม่ และใช้ snapshot ย่อสำหรับแหล่งที่ระบุผ่าน `--*-input` การ import ซ้ำจะนับเป็น `alreadyPresent` และจะไม่เขียนทับวันที่เดิมเมื่อพบ conflict

SEC กำหนดให้ User-Agent ระบุองค์กรและอีเมลติดต่อจริง จึงต้องตั้งค่าก่อนรัน:

```powershell
$env:SEC_USER_AGENT="Bazi Investor Guide data pipeline YOUR_REAL_MONITORED_EMAIL"
npm.cmd run research:stage-sec-master
```

แทน `YOUR_REAL_MONITORED_EMAIL` ด้วยอีเมลที่มีผู้ดูแลจริง สคริปต์จะปฏิเสธโดเมนตัวอย่าง และอย่า commit ข้อมูลติดต่อ production ลง repo

## ลำดับงานต่อจากนี้

1. ปิดช่องว่างสหรัฐ 1,094 ตัวด้วย SEC identity ก่อน แล้วจัดงบ Nasdaq Daily List/แหล่ง licensed ที่มี `First Date Traded`; SEC current identity อย่างเดียวไม่ใช่วันเข้าตลาด
2. ทำ source discovery ต่อสำหรับ TSX, Xetra, HKEX, B3/Bovespa, Euronext, SIX, Bursa และ Borsa Istanbul โดยไม่เลื่อน provider candidate เป็น canonical เอง
3. ใช้ candidate 4,888 ตัวเป็น search queue แล้วตรวจ ticker migration, relisting, predecessor และ class share ก่อน import
4. เพิ่ม company-origin, licensed fundamentals และ adjusted EOD; ตอนนี้ listing date ข้าม 50% แล้วแต่ fundamentals ยัง 5.64% และ EOD 4.42%
5. ตรวจ terms/data license รายตลาดและ legal wording ก่อนเปิด paid/public gate แล้วจึงกลับไปสร้าง PDF จาก canonical snapshot

TSX ถูกตรวจ public TMX Money GraphQL แล้ว แต่ schema สาธารณะที่หน้าใช้อยู่ไม่มี listing/IPO/first-trade date จึงยังไม่สร้างวันที่ปลอม ส่วน Nasdaq historical First Date Traded เป็นผลิตภัณฑ์ที่ต้องสมัครใช้

## QA รอบล่าสุด

- `research:audit`: foreign official 2,984/5,958 (50.08%) · global official 3,249/6,223 (52.21%)
- `npm.cmd test`: 57 test files / 314 tests ผ่าน
- `npm.cmd run typecheck`: ผ่าน
- targeted ESLint สำหรับ adapter/stage/tests ใหม่: 0 errors
- `npm.cmd run build`: Next.js production build ผ่าน
- idempotence check: รัน official stage ซ้ำได้ `added=0`, `alreadyPresent=3,656`, conflicts 0
- global lint ยังมี 18 errors / 1 warning ชุดเดิมใน PDF/chat/demo legacy นอก research adapter; จำนวนไม่เพิ่มจาก baseline ก่อนงานรอบนี้

## สิ่งที่ยังไม่ควรอ้าง

- ยังพูดไม่ได้ว่าหุ้นต่างประเทศทั้งหมดมี “วันเกิดหุ้น” ที่เชื่อถือได้
- วันก่อตั้งบริษัทไม่ใช่วันเข้าตลาด และวันเริ่มมีราคาย้อนหลังไม่ใช่วันซื้อขายแรกเสมอ
- exact first-trade time ยังเป็น 0% จึงต้องคำนวณแบบ date-only พร้อมแสดงความไม่แน่นอน
- US10 เป็น pilot สำหรับตรวจ architecture ไม่ใช่หลักฐานว่าระบบพร้อมขายครบทุกตลาด
