# แผน: ขยายคลังหุ้นตลาดที่เสนอ (ก่อน IPO) + กรอง /stocks ตามธาตุ/ประเทศ

วันที่: 2026-08-07 · หลัก: Asia-First (ดูดวงเข้ม × เข้าถึงง่าย) — คลังมี 26 ตลาด 3,103 ตัวแล้ว

## เป้าหมาย (เพิ่มตามลำดับ — ทำตลาดละรอบ เหมือน expand-to-100)
| ลำดับ | ตลาด | ตอนนี้ | เป้า | เหตุผล |
|---|---|---|---|---|
| 🥇 | 🇮🇳 อินเดีย NSE | 90 | **150** (+BSE บางตัว) | IPO ร้อนแรงสุดโลก 2026 · โหราศาสตร์เข้ม |
| 🥇 | 🇹🇼 ไต้หวัน TWSE | 100 | **150** | ตามแผน Asia-First (TW ก่อนนอกไทย) · ชิป/เทค |
| 🥈 | 🇯🇵 ญี่ปุ่น TSE | 219 | **300** | IPO เยอะมาก (โตเกียวโปร) |
| 🥈 | 🇮🇩 อินโดนีเซีย IDX | 60 | **100** | IPO แอคทีฟ (มุสลิมใหญ่สุด) |
| 🥉 | 🇸🇬 สิงคโปร์ SGX | 59 | **80** | S-REIT · ฮับการเงิน |

**รวม +~160 ตัว → ~3,260**

## วิธีทำต่อตลาด (pattern เดิม)
1. **รายชื่อหุ้น**: Yahoo search ต่อ exchange (pattern expand-to-100) + คัดใหญ่สุด/สภาพคล่องดีก่อน
2. **fetch quotes**: batch 25 + freshness 6h + breaker (เดิม) — ไม่ชน limit
3. **ธุรกิจ/ธาตุ**: business จาก Yahoo description → businessKeywords → **ธาตุ deterministic ตามตารางซินแส (Source6 §1.1.2 — ใช้ RULES เดียวกับ IPO classifier)**
4. **merge** เข้า data/stocks/global.json + export CSV รอซินแสตรวจ (ธาตุเดา = flag)
5. เทสต์ (element-audit ครอบคลุมใหม่) + typecheck/build + commit

## ลำดับถัดไป: IPO ของตลาดเดียวกัน (ต่อจากคลัง)
- อินเดีย: Chittorgarh.com IPO calendar → NSE/BSE
- ไต้หวัน: TWSE IPO / 鉅亨網 · ญี่ปุ่น: TSE new listings · อินโดนีเซีย: IDX IPO calendar
- fetcher ต่อ pipeline (แบบ fetch-ipo-asx.ts) + classifier ภาษาท้องถิ่น (जापानी/ไทย-จีน/อินโด)

## งานคู่ขนาน (วันนี้): หน้า /stocks กรอง ธาตุ × ประเทศ
- API /api/stocks: + element, country param + elementCounts/countries ใน response
- หน้า: chips ธาตุ (สี 5 ธาตุ + count) · select ประเทศ (25 ประเทศ) · select ตลาด (เดิม) · search (เดิม)
- รายการ group ตามธาตุ (หัวข้อสี) เมื่อไม่กรองธาตุ — ดูง่าย
