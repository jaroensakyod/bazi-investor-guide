# Thai Research Data Foundation — หุ้นไทยปัจจุบัน 265 ตัว

> อัปเดต 8 สิงหาคม 2569 16:31 น. (Asia/Bangkok)  
> ขอบเขต: แกนข้อมูลสำหรับวิจัยภายในก่อนกลับไปสร้าง PDF  
> คำสั่งตรวจซ้ำ: `npm.cmd run research:audit`

## ผลลัพธ์ที่ทำเสร็จ

| รายการ | Coverage หุ้นไทยปัจจุบัน | คุณภาพ/ข้อจำกัด |
|---|---:|---|
| วันเข้าตลาดจากหลักฐานทางการ | **265/265 (100%)** | Grade B ทุกตัว; ไม่มีการแต่งเวลา first trade |
| วันกำเนิดนิติบุคคลแบบระบุวัน | **217/265 (81.89%)** | อีก 41 ตัวมีเพียงปี และ 7 ตัวไม่พบวัน จึงไม่สร้างวันที่สมมติ |
| Fundamentals ใช้ประเมินได้ | **265/265 (100%)** | 263 ตัวมี core fields ≥3; TTCL/VAYU1 ยัง sparse |
| Adjusted daily EOD | **265/265 (100%)** | 5 ปีย้อนหลังหรือตั้งแต่วันเกิดนิติบุคคลปัจจุบัน แล้วแต่ว่าวันใดใหม่กว่า |
| พร้อมวิเคราะห์ pattern ≥252 sessions | **262/265 (98.87%)** | BANPU NewCo 4 วัน, VAYU1 1 วัน, MRDIYT 188 วัน |
| เวลา first trade ที่ยืนยันได้ | **0/265** | ใช้ date-only + sensitivity 12 ยาม; ห้ามตั้งเวลาเปิดตลาดแทน |
| พร้อมใช้เชิงพาณิชย์ | **ยังไม่พร้อม** | Yahoo เป็น development-only; SET factsheet ยังต้องยืนยันสิทธิ์ใช้/แสดงผล |

EOD ทั้ง 265 ตัวใช้พื้นที่รวมประมาณ **4.32 MiB** เพราะเก็บ gzip หนึ่งชุดต่อ `securityId + timeframe + adjustment` และไม่ทำสำเนาต่อผู้ใช้หรือต่อ PDF

ระหว่าง runtime smoke พบและแก้ normalization เดิมที่คูณ `dividendYield` ซ้ำ 100 เท่าแล้ว เช่น BH จากค่าผิด 262% กลับเป็น 2.62% พร้อมเพิ่ม `normalizationVersion: 2` และ migration แบบ idempotent สำหรับ snapshot เก่าทั้งหมด

## สิ่งที่พบและแก้ใน Security Master

คลังเดิมมี 272 แถว แต่มี ticker ซ้ำ/เก่า จึงแก้เป็น 271 แถว โดยมีหลักทรัพย์ปัจจุบัน 265 ตัวและ historical aliases 6 ตัว ห้ามนำ 6 ตัวนี้เข้าคิวจัดอันดับหรือ backtest ปัจจุบัน:

| Ticker เก่า | สถานะ | หลักทรัพย์ปัจจุบัน | วันที่มีผล |
|---|---|---|---|
| BPP | ควบรวม | BANPU NewCo | 2026-07-31 |
| BSRC (เดิม ESSO) | เพิกถอนตามแผนปรับโครงสร้าง | BCP | 2025-12-12 |
| INTUCH | ควบรวมและสิ้นสภาพนิติบุคคล | GULF NewCo | 2025-04-01 |
| MAKRO | เปลี่ยนชื่อย่อ | CPAXT | 2023-06-21 |
| STEC | เพิกถอนและมี Holding Company แทน | STECON | 2024-10-29 |
| TICON | เปลี่ยนชื่อย่อ | FPT | 2019-01-31 |

ลบแถว `MED` ที่ซ้ำ/ผิด ticker เพราะหลักทรัพย์จริงคือ `MEDEZE` และมีรายการ canonical อยู่แล้ว

API รายละเอียดหุ้นยังค้น ticker เก่าได้และคืน `securityStatus`, `successorTicker`, วันที่มีผล และ URL หลักฐาน แต่ research screen และ research dossier จะไม่วิเคราะห์ ticker ที่ไม่ใช่หลักทรัพย์ปัจจุบัน

## Lineage ที่ต้องรักษาเป็นพิเศษ

ตัวนำเข้าตรวจพบ 8 บริษัทที่วันก่อตั้งนิติบุคคลปัจจุบันตรงกับวันเข้าตลาด หรือปีเริ่มกิจการเดิมเก่ากว่านิติบุคคลปัจจุบัน:

- BANPU, BEM, CPAXT, GULF, PTTGC, TFMAMA และ TRUE: ต้องถือเป็น NewCo/ผู้สืบทอดหรือทบทวนโครงสร้างก่อนนำประวัติเก่ามาต่อ
- PTT: วันเริ่มกิจการรัฐเดิมเก่ากว่าวันก่อตั้งนิติบุคคลหลังแปรรูป

ตัวดึง EOD ใช้ `max(ย้อนหลัง 5 ปี, official listing date)` เป็นจุดเริ่มต้น จึงไม่ดึงราคาก่อนวันเกิดของ NewCo โดยอัตโนมัติ BANPU ปัจจุบันจึงมีเพียง 4 sessions และไม่ถูกทำให้ดูเหมือนมีประวัติหลายปี

## Pipeline ที่สร้างแล้ว

### 1. SET factsheet evidence staging

```powershell
npm.cmd run research:stage-set-events -- --apply
```

- อ่าน `Establish Date` และ `Listed Date` จากหน้า SET ภาษาอังกฤษ
- รองรับ `DD/MM/YYYY`, `DD Mon YYYY` และ year-only
- เก็บ URL, retrieved time, ETag/Last-Modified เมื่อมี และ SHA-256 ของหน้า
- ไม่เก็บ HTML ทั้งหน้า
- checkpoint ทุก 10 ตัว, retry ได้ และไม่ทับวันที่ curated ที่ขัดกัน
- year-only ถูกเก็บเป็น partial evidence แต่ไม่ถูกแปลงเป็นวันที่ 1 มกราคม
- สถานะสิทธิ์เป็น `internal_research_only_pending_set_license`

ไฟล์ staging: `data/staging/set-security-events.json`  
ไฟล์ canonical events: `data/security-events.json`  
ข้อยกเว้นตรวจมือ: `data/curated/security-events-overrides.json`

### 2. Fundamentals development cache

```powershell
npm.cmd run research:fundamentals -- --country=TH --limit=300
```

- ทำงานเฉพาะหลักทรัพย์ปัจจุบัน
- resumable และบันทึกทุก 10 ตัว
- ค่าไม่ครบไม่ถูกแทนด้วยศูนย์
- ปัจจุบัน usable 265/265, core ≥3 fields 263/265
- แหล่ง Yahoo ยังใช้ได้เฉพาะ development/internal

### 3. Shared compressed EOD

```powershell
npm.cmd run research:seed-thai-history
```

- หนึ่ง gzip ต่อหลักทรัพย์ ไม่เก็บต่อผู้ใช้
- adjusted daily series ระยะ 5 ปี
- ตัด history ตาม official listing/NewCo date
- cache hit ไม่ดึงซ้ำ; `--refresh` ใช้เมื่อต้องการอัปเดต
- รอบล่าสุดสำเร็จ 255/255 ตัวที่ขาด รวมของเดิมเป็น 265/265 ไม่มี failed

### 4. Readiness audit

```powershell
npm.cmd run research:audit
```

Audit แยกตัวเลข global ออกจากหุ้นไทยแล้ว เพื่อไม่ให้ค่า 4–5% ของ universe 6,223 ตัวทำให้เข้าใจผิดว่าหุ้นไทยยังไม่พร้อม ตัว gate ปัจจุบันคือ:

- `thai-security-master`: READY
- `thai-development-data`: READY
- `thai-commercial-data`: BLOCKED
- global security/fundamentals: ยัง BLOCKED จนกว่าจะทำ adapter ตลาดต่างประเทศ

หากย้าย snapshot รุ่นเก่ามาจากเครื่องอื่น ให้รัน `npm.cmd run research:migrate-market-v2` หนึ่งครั้ง คำสั่งนี้รันซ้ำได้โดยไม่หาร dividend yield ซ้ำ

## ข้อจำกัดที่ต้องไม่ปกปิด

1. Coverage 100% ในเอกสารนี้หมายถึง **หุ้นไทยปัจจุบันใน curated universe 265 ตัว** ไม่ใช่หุ้นไทยทุกตัวในตลาด และไม่ใช่ 6,223 ตัวทั่วโลก
2. Fundamentals/EOD ที่ครบเป็นข้อมูลเพื่อพัฒนาโมเดล ไม่ใช่สิทธิ์สำหรับสินค้าที่เก็บเงิน
3. SET factsheet เป็นหลักฐานทางการ แต่หน้าเว็บระบุสงวนลิขสิทธิ์และใช้เพื่อข้อมูล/การศึกษา ต้องทำสัญญา SET SMART Marketplace หรือได้รับคำยืนยันสิทธิ์ก่อนเผยแพร่เชิงพาณิชย์
4. exact first-trade timestamp ยังเป็นศูนย์ และไม่ควรซื้อ tick history เพียงเพื่อบังคับให้ BaZi มีเสาชั่วโมง หากผลเชิงธุรกิจไม่คุ้มต้นทุน
5. Pattern 98.87% หมายถึงมีจำนวน sessions ขั้นต่ำ ไม่ได้หมายความว่าโมเดลทำนายกำไรหรือจุดสูงสุดได้

## ขั้นถัดไปก่อนกลับไปทำ PDF

1. เลือกผู้ให้บริการ EOD/fundamentals ที่มี commercial rights สำหรับไทย แล้วเขียน adapter เข้าสู่ schema เดิม
2. รัน parity test ระหว่างข้อมูล development กับ provider ที่ซื้อ เพื่อจับ split/dividend/missing-session
3. เพิ่ม peer-normalized fundamentals แยกธนาคาร ประกัน REIT พลังงาน และธุรกิจทั่วไป
4. ทำ walk-forward evaluation ทั้ง 262 ตัวที่มีประวัติพอ พร้อม baseline, transaction-cost assumption และ false-positive rate
5. ให้ทนายตลาดทุนตรวจคำ, ranking, alert และ UX ก่อนเปิด paid research
6. เมื่อ data/model/legal gates ผ่าน จึงสร้างเว็บและ PDF จาก `ResearchSnapshot` เดียวกัน

## แหล่งอ้างอิงหลัก

- SET Factsheet รายหลักทรัพย์ เช่น `https://www.set.or.th/en/market/product/stock/quote/ADVANC/factsheet`
- SET SMART Marketplace: `https://www.set.or.th/app/online-data/reference-data?lang=en`
- หลักฐาน lifecycle อยู่ใน `statusEvidence.url` ของแต่ละแถวใน `data/stocks/thailand.json`
