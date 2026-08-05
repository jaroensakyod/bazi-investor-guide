#!/usr/bin/env python3
"""ตรวจคุณภาพ description หลัง enrich — ใช้ตอนจบรอบรัน
เช็ค: จำนวน/ความครอบคลุม, ความยาว, disambiguation หลงเหลือ, ภาษา, ตัวอย่าง
"""
import json
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

DISAMBIG = re.compile(
    r"may refer to:|Topics referred to by the same term|Look up .+ in Wiktionary|"
    r"อาจหมายถึง|Nhiều nghĩa|nhiều ý nghĩa|曖昧さ回避|동음이의어|消歧义|维基百科消歧义",
    re.I,
)
THAI = re.compile(r"[\u0e00-\u0e7f]")
CJK = re.compile(r"[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]")

files = {
    "thailand": "/opt/data/bazi-investor-guide/data/stocks/thailand.json",
    "global": "/opt/data/bazi-investor-guide/data/stocks/global.json",
}

grand = {"total": 0, "have": 0}
for name, f in files.items():
    db = json.load(open(f))
    stocks = db["stocks"]
    have = [s for s in stocks if s.get("description")]
    short = [s for s in have if len(s["description"]) < 60]
    disambig = [s for s in have if DISAMBIG.search(s["description"])]
    thai = [s for s in have if THAI.search(s["description"])]
    cjk = [s for s in have if CJK.search(s["description"])]
    print(f"=== {name}: {len(stocks)} ตัว, มี desc {len(have)} ({len(have)*100//len(stocks)}%) ===")
    print(f"  สั้นเกิน 60 ตัวอักษร: {len(short)}")
    print(f"  น่าจะเป็น disambiguation หลงเหลือ: {len(disambig)}")
    print(f"  มีอักษรไทย: {len(thai)} | มีอักษร CJK: {len(cjk)}")
    grand["total"] += len(stocks)
    grand["have"] += len(have)
    if disambig:
        print("  ตัวอย่างที่น่าสงสัย:")
        for s in disambig[:5]:
            print("   •", s.get("ticker"), (s["description"] or "")[:100])

print(f"\nรวม: {grand['have']}/{grand['total']} ({grand['have']*100//grand['total']}%)")

# ตัวอย่างใหม่ (businessEvidence แบบใหม่มีภาษา)
print("\n=== ตัวอย่าง description ใหม่ (แยกภาษา) ===")
seen = set()
for name, f in files.items():
    db = json.load(open(f))
    for s in db["stocks"]:
        ev = s.get("businessEvidence") or {}
        src = ev.get("source", "")
        lang = "en"
        m = re.search(r"Wikipedia (\w+) intro", src)
        if m:
            lang = m.group(1)
        if lang != "en" and lang not in seen:
            seen.add(lang)
            print(f"  [{lang}] {s.get('ticker')} ({s.get('nameEn') or s.get('name')}):")
            print(f"      {(s.get('description') or '')[:120]}")
            print(f"      url={ev.get('url')}")
        if len(seen) >= 6:
            break
    if len(seen) >= 6:
        break
