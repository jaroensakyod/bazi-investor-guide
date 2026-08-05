#!/usr/bin/env python3
"""
CLEANUP: ลบ description auto ที่ผิด (หน้าวิกิไม่ตรงบริษัท)

หลัก: คำอธิบายที่ถูกต้องต้องมีชื่อบริษัทอย่างน้อย 1 รูปแบบ:
  nameEn, name, guessTitle(nameEn) (ตัด suffix), guessTitle(name), ticker ตัวยาว
ข้อยกเว้น: ข้อมูลมือ (ไม่มี businessEvidence.source ขึ้นต้นด้วย "Wikipedia") — ไม่แตะ

รัน: python3 scripts/cleanup-wrong-descriptions.py [--dry-run]
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
DRY = "--dry-run" in sys.argv

SUFFIX = re.compile(
    r"\s+(?:Limited|Ltd|PLC|Corporation|Corp|Incorporated|Inc|Company|Co|Group|Holdings?|Bancorp)[.,]?\s*$",
    re.I,
)
PAREN = re.compile(r"\s*\([^)]*\)\s*$")


def variants(s):
    """รูปแบบชื่อที่ควรโผล่ในคำอธิบายที่ถูกต้อง"""
    out = []
    for key in ("nameEn", "name"):
        raw = str(s.get(key) or "").strip()
        if not raw:
            continue
        out.append(raw)
        stripped = SUFFIX.sub("", PAREN.sub("", raw)).strip()
        if len(stripped) >= 4:
            out.append(stripped)
        nospace = raw.replace(" ", "")
        if len(nospace) >= 5:
            out.append(nospace)
    # ticker ยาว (>3) ช่วยจับบริษัทที่ชื่อย่อตรง
    t = str(s.get("ticker") or "").strip()
    if len(t) >= 5:
        out.append(t)
    # กรณี HMPRO: ชื่อแบรนด์ "HomePro" ต่างจาก nameEn — ใช้ส่วนแรกของ nameEn
    first = str(s.get("nameEn") or "").split(" ")[0]
    if len(first) >= 5:
        out.append(first)
    return [v for v in dict.fromkeys(out) if len(v) >= 4]


"""ลายเซ็นต์หน้า "ไม่ใช่บริษัท" — ประโยคแรกของบทความเพี้ยน (ลูกบอล/เทศกาล/เมือง/คน/โรค...)
   ตรงกับ NON_COMPANY_PATTERNS ใน enrich-descriptions-yahoo.ts / enrich-descriptions.ts"""
NON_COMPANY = re.compile(
    r"round object|edible fruit|larval stage|festive season|building material|administrative region|"
    r"writing system|person or thing|literally means|rice paddy|developmental disorders|coldest temperature|"
    r"climate change|football club|may refer to|may stand for|most often refers to|as an abbreviation|"
    r"surname|is a genus|is a species|is a city|is a town|is a village|is a commune|is a district|"
    r"is a province|animator|is a singer|is a footballer|is a politician|municipality|game list|"
    r"曖昧さ回避|동음이의어|消歧义|维基百科消歧义",
    re.I,
)

# หุ้นที่รู้แล้วว่าได้หน้า wiki ผิด (search fallback เจอ entity คนละตัว) — ลบรอ refill จาก Yahoo
# (BTS เคยอยู่ในนี้ แต่ cache keys ถูกลบแล้ว + Yahoo ให้ข้อมูลถูกแล้ว — ถอดออก)


def is_wrong(s):
    d = (s.get("description") or "").lower()
    if not d:
        return False
    ev = s.get("businessEvidence") or {}
    src = str(ev.get("source") or "")
    if not src.startswith("Wikipedia"):
        return False  # ข้อมูลมือ/Yahoo (ticker-based เชื่อถือได้) — ไม่แตะ
    # 1) หน้าไม่ใช่บริษัท (ลูกบอล/เทศกาล/เมือง/คน...) → ผิดแน่
    if NON_COMPANY.search(s["description"]):
        return True
    # 2) ต้องมีชื่อบริษัทโผล่
    vs = [v.lower() for v in variants(s)]
    return not any(v in d for v in vs)


def main():
    total_wrong = 0
    for f in ("/opt/data/bazi-investor-guide/data/stocks/thailand.json", "/opt/data/bazi-investor-guide/data/stocks/global.json"):
        db = json.load(open(f))
        wrong = [s for s in db["stocks"] if is_wrong(s)]
        total_wrong += len(wrong)
        print(f"{f}: ผิด {len(wrong)} ตัว")
        for s in wrong[:8]:
            print(f"   • {s.get('ticker')} ({s.get('nameEn') or s.get('name')}) [{str((s.get('businessEvidence') or {}).get('source'))[:25]}]")
            print(f"       {(s.get('description') or '')[:80]}")
        if not DRY:
            for s in wrong:
                s["description"] = ""
                s["businessEvidence"] = None
            db["meta"]["updatedAt"] = "2026-08-05"
            json.dump(db, open(f, "w"), ensure_ascii=False, indent=2)
            open(f, "a").write("\n")
    print(f"\n{'DRY-RUN: ' if DRY else ''}รวมผิด {total_wrong} ตัว {'(ยังไม่เขียน)' if DRY else '(ลบแล้ว — พร้อม re-fill จาก Yahoo)'}")


main()
