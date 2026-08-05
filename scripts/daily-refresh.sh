#!/usr/bin/env bash
# DAILY REFRESH: ดึงราคา + ข่าว → commit snapshot (เรียกโดย Hermes cron)
# ต้องรันจาก repo root (cron ตั้ง workdir ไว้แล้ว)
set -e
echo "📡 Daily refresh: $(date '+%Y-%m-%d %H:%M %Z')"

echo "── ราคา (fetch-market-data)"
npx tsx scripts/fetch-market-data.ts 2>&1 | tail -2

echo "── ข่าว (fetch-news)"
npx tsx scripts/fetch-news.ts 2>&1 | grep -E "✅ ข่าวรวม|ต่อตลาด" || true

git add data/cache/market/ data/news.json 2>/dev/null || true
if git diff --cached --quiet; then
  echo "ℹ️ ไม่มีข้อมูลเปลี่ยน — ข้าม commit"
else
  git commit -m "chore(data): daily snapshot $(date +%Y-%m-%d) (ราคา + ข่าว)" 2>&1 | tail -1
  git push origin investor-guide 2>&1 | tail -1
fi
echo "✅ Daily refresh เสร็จ"
