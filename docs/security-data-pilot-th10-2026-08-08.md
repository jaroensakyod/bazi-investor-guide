# Security Data Pilot TH10 — วันเกิดบริษัท วันเข้าตลาด Fundamentals และ EOD

> อัปเดต 8 สิงหาคม 2569  
> เป้าหมาย: พิสูจน์ data pipeline กับหุ้นที่ระบบใช้จริงก่อนขยายจาก 10 ไป 100–200 และ 6,230 ตัว

## สรุปผล

| Coverage | TH10 | ทั้งระบบ |
|---|---:|---:|
| ราคาล่าสุด | 10/10 | 5,284/6,223 researchable |
| Fundamentals ที่ใช้ประเมินได้ | 10/10 | 342/6,223; หุ้นไทย 265/265 |
| วันกำเนิดนิติบุคคล/ผู้สืบทอดแบบ exact date | 9/10 | 217/6,223; หุ้นไทย 217/265 |
| วันเข้าตลาดจากหลักฐานทางการ | 10/10 | 265/6,223; หุ้นไทย 265/265 |
| EOD series | 10/10 | 265/6,223; หุ้นไทย 265/265 |
| EOD ≥252 sessions สำหรับ pattern | 9/10 | หุ้นไทย 262/265 |
| เวลา first trade ที่ยืนยันได้ | 0/10 | 0/6,223 |
| สิทธิ์ข้อมูลพร้อมขาย | 0/10 | ยังไม่ผ่าน commercial gate |

TH10 เป็นจุดเริ่มต้นเท่านั้น ปัจจุบันขยายหุ้นไทยปัจจุบันครบแล้ว ดูผลล่าสุดที่ [`thai-research-data-foundation-2026-08-08.md`](./thai-research-data-foundation-2026-08-08.md) ส่วนเปอร์เซ็นต์ global ยังต่ำเพราะต่างประเทศ 5,958 ตัวต้องใช้ adapter/สิทธิ์ข้อมูลแยกตามตลาด และข้อมูล Yahoo ที่ใช้พิสูจน์ pipeline ยังเป็น development-only

## เหตุการณ์ที่ตรวจแล้ว

| Security | วันกำเนิดนิติบุคคล/ผู้สืบทอด | วันจดทะเบียนกับ ตลท. | EOD ที่เก็บ | หมายเหตุ |
|---|---|---|---:|---|
| SET:BH | 1975-04-21 | 1989-12-15 | 1,215 | Grade B; ไม่มีเวลา first trade |
| SET:BDMS | 1969-10-30 | 1991-10-02 | 1,217 | Grade B |
| SET:PTTEP | 1985-06-20 | 1993-06-10 | 1,216 | Grade B |
| SET:GULF | 2025-04-01 (`merger_successor`) | 2025-04-01 | 328 | แยกจาก GULF เดิม; series เริ่ม 2025-04-03 |
| SET:BANPU | 2026-07-31 (`merger_successor`) | 2026-07-31 | 4 | NewCo จาก BANPU+BPP; เก็บราคาเฉพาะ 2026-08-04 เป็นต้นไป |
| SET:GUNKUL | SET ระบุเพียงปี 1982 จึงไม่แต่งวัน | 2010-10-19 | 1,215 | company date exact ยังขาด |
| SET:XPG | 1974-09-01 | 1995-03-17 | 1,215 | แก้ข้อมูลเดิมจากพลังงาน/mai เป็นการเงิน/SET |
| SET:BEAUTY | 2000-10-19 | 2012-12-12 | 1,216 | แก้ market จาก mai เป็น SET |
| SET:PTT | 2001-10-01 | 2001-12-06 | 1,215 | วันที่ก่อตั้งนิติบุคคลหลังแปรรูป ไม่ใช่จุดกำเนิดกิจการรัฐเดิม |
| SET:DELTA | 1988-06-16 | 1995-07-24 | 1,216 | Grade B |

หลักฐานวันไทยมาจาก SET Factsheet ของแต่ละหลักทรัพย์และเก็บ URL ไว้ใน `data/security-events.json` ทุก event ส่วน BANPU มีหลักฐาน issuer เพิ่มเพื่อยืนยันว่าเป็น NewCo จากการควบรวม

## การใช้คำว่า “วันเกิดหุ้น” ในระบบ

ระบบต้องแสดงวันที่แยกกันเสมอ:

1. `incorporation` — วันก่อตั้งนิติบุคคล ใช้วิเคราะห์บริบทธุรกิจ
2. `merger_successor` — วันที่เกิดนิติบุคคลใหม่หลังควบรวม
3. `exchange_admission` — วันที่ตลาดรับหลักทรัพย์เข้าจดทะเบียน
4. `first_trading_day` — วันเริ่มซื้อขายจริง เมื่อมีหลักฐานแยก
5. `first_trade` — timestamp รายการซื้อขายแรก ซึ่งต้องมาจาก official/licensed tick data

TH10 ตอนนี้เป็น Grade B: รู้วันทางการแต่ไม่รู้เวลา จึงใช้การวิเคราะห์ระดับวันและ sensitivity 12 ช่วงเวลาเท่านั้น ห้ามเติม 09:30 หรือ 12:00 เอง

## สิ่งที่ข้อมูลนี้ทำได้และยังทำไม่ได้

ทำได้ใน development/internal:

- วิเคราะห์ pattern ย้อนหลังสำหรับ 9 ตัวที่มีอย่างน้อย 252 sessions
- สร้าง fundamental + pattern research snapshot
- แสดงวันบริษัทและวันเข้าตลาดพร้อมแหล่งอ้างอิง
- ทดสอบ walk-forward และเปรียบเทียบ baseline

ยังห้ามใช้ใน paid/public production:

- Yahoo fundamentals/EOD ยังไม่มี commercial redistribution approval
- BANPU มีข้อมูลเพียง 4 sessions และต้องไม่ต่อประวัติ NewCo เข้ากับบริษัทเดิมแบบไร้ lineage
- ไม่มี exact first-trade timestamp ทุกตัว
- Generic ranking/timing ยังติด legal/model gates

## คำสั่งสร้างข้อมูลใหม่เมื่อย้ายเครื่อง

```powershell
npm.cmd run research:seed-pilot
npm.cmd run research:stage-set-events -- --apply
npm.cmd run research:fundamentals -- --country=TH --limit=300
npm.cmd run research:seed-thai-history
npm.cmd run research:audit
```

`research:seed-pilot` มี retry/cache และ policy ตัดประวัติ BANPU ก่อนเกิด NewCo โดยอัตโนมัติ แต่เป็น development-only เสมอ

## แผนขยาย

1. หุ้นไทยปัจจุบัน 265 ตัว ingest แล้ว; ขั้นถัดไปคือซื้อ/ยืนยันสิทธิ์ SET + licensed fundamentals/EOD แล้วทำ parity test
2. เลือกหุ้นต่างประเทศ 100–200 ตัวตาม watchlist/usage จริงเป็น pilot ถัดไป
3. สหรัฐฯ ใช้ SEC EDGAR สำหรับงบและ metadata; วัน listing/corporate actions ใช้ exchange/licensed reference data
4. ตลาดอื่นสร้าง adapter แยกตาม venue และคง schema/event confidence เดียวกัน
5. Exact first-trade time เก็บเฉพาะเมื่อมีแหล่ง tick data ที่ยืนยันและมีสิทธิ์ใช้งาน ไม่ทำให้เป็น requirement ของหุ้นทุกตัว
