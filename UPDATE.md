# 📝 UPDATE.md — สมุดอัปเดตแผน/โปรเจค

> สมุดบันทึกความคืบหน้า — ดูคู่กับแผนเต็ม: `.hermes/plans/2026-08-05_ai-investor-chat.md`
> อัปเดตทุกครั้งที่ทำงานเสร็จ / เปลี่ยนแผน / ตัดสินใจใหม่

---

## 2026-08-05 — เริ่ม Phase 0 (AI Investor Chat + Asia-First)

### ✅ ตัดสินใจแล้ว (ล็อก)
- **3 ภาษา**: th/zh/en (MVP) — vi/ja/ko/id เติมทีหลัง
- **ตลาดแรกนอกไทย**: 🇹🇼 ไต้หวัน (LINE infra ใช้ร่วมได้)
- ช่องทาง: LINE ก่อน + Web (global) · LLM: DeepSeek · compliance: "แนวโน้มตามดวง + ข้อมูล"
- รับ data unofficial (Yahoo/TradingView) สำหรับ MVP → abstraction เปลี่ยน backend ได้

### 📋 ความคืบหน้า Task (Phase 0)
| Task | งาน | สถานะ |
|---|---|---|
| 0.1 | marketData fetcher (Yahoo quoteSummary) | ⏳ กำลังทำ |
| 0.2 | Today movers (TradingView scanner) | ⬜ |
| 0.3 | IPO pipeline (TradingView ipo_date + Investing.com) | ⬜ |
| 0.4 | News RSS + data/events.json | ⬜ |
| 0.5 | Fundamentals + buffett-checks | ⬜ |
| 0.6 | ขยายคลังไทย 129 → ~250 | ⬜ |
| 0.7–0.8 | Hidden Gems screener + risk gating ตามกำลังดวง | ⬜ |
| 0.9–0.10 | Asset universe (commodities) + price fetchers | ⬜ |
| 0.11–0.12 | Asset verdict + จัดพอร์ตตามธาตุ | ⬜ |
| 0.13–0.14 | Real assets (สลาก/ที่ดิน/สวนยาง/พระเครื่อง...) + สิ่งที่ห้าม | ⬜ |
| 0.15 | Universe เอเชีย +5 ตลาด (TW/SG/ID/MY/PH) | ⬜ |

### 🧾 คิวถามซินแส (decision-log — รวบรวมถามรอบเดียว)
- [ ] ธาตุ: ปศุสัตว์(หมู/ไก่/โค) · พระเครื่อง · สลากออมสิน · คาร์บอนเครดิต · งานศิลปะ
- [ ] ทิศ→ธาตุตลาด 5 ตลาดใหม่ (TW/SG/ID/MY/PH)
- [ ] review ธาตุหุ้นไทย 129 ตัว (CSV รอส่ง — `npx tsx scripts/review-checklist.ts export`)
