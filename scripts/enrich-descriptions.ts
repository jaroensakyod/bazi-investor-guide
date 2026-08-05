/**
 * ENRICH descriptions: เติมคำอธิบายธุรกิจ (ชั้น A) ให้หุ้นทุกตัวที่ยังไม่มี
 *
 * เหตุผล: ซินแสตรวจธาตุไม่ได้ ถ้าไม่รู้ว่าหุ้นประกอบธุรกิจอะไร
 *   — ปัจจุบันหุ้น auto มี business = แค่ชื่อบริษัท, description ว่าง 1,923 ตัว
 *
 * แหล่งข้อมูล: Wikipedia intro (prop=extracts&exintro&explaintext — plain text,
 *   batch 20 หน้า/request ตาม limit ของ extracts module)
 *   → description (2-3 ประโยค ~350 ตัวอักษร) + businessEvidence { source, url }
 *
 * ตัวที่มี description แล้ว (หุ้นมือ 5 ตัว) ข้าม — ไม่ทับของซินแส
 *
 * รัน: npx tsx scripts/enrich-descriptions.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [path.join(ROOT, "data/stocks/thailand.json"), path.join(ROOT, "data/stocks/global.json")];

/** หา Wikipedia title ที่ควรใช้: nameEn > name (ตัด suffix บริษัทที่พบบ่อย) */
function guessTitle(s: Record<string, unknown>): string {
  const raw = String(s.nameEn ?? s.name ?? "").trim();
  return raw
    .replace(/\s+(?:Limited|Ltd|PLC|Corporation|Corp|Incorporated|Inc|Company|Co|Group|Holdings?|Bancorp)[.,]?\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

/** ดึง intro (plain text) ของหลายหน้า — batch 20/request (limit extracts module) */
async function fetchIntros(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 20) {
    const chunk = titles.slice(i, i + 20);
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      chunk.join("|"),
    )}&prop=extracts&exintro&explaintext&redirects=1&format=json&formatversion=2`;
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url, {
        headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
      });
      if (res.status === 429) {
        const wait = 6000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      break;
    }
    if (!res?.ok) {
      console.log(`  ⚠️ batch ${i / 20 + 1} HTTP ${res?.status} — ข้าม`);
      continue;
    }
    const json = (await res.json()) as {
      query?: { pages?: Array<{ title: string; extract?: string }> };
    };
    for (const p of json.query?.pages ?? []) {
      if (p.extract) out.set(p.title, p.extract);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return out;
}

/** หา Wikipedia title ด้วย search API (fallback เมื่อเดา title ไม่ตรง) — มี retry กัน 429 */
async function searchTitle(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=1&format=json&formatversion=2`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
      return json.query?.search?.[0]?.title ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/** ดึง intro ของ 1 title (ใช้กับ search fallback) — มี retry กัน 429 */
async function fetchIntroOne(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title,
  )}&prop=extracts&exintro&explaintext&redirects=1&format=json&formatversion=2`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 8000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const json = (await res.json()) as { query?: { pages?: Array<{ extract?: string }> } };
      return json.query?.pages?.[0]?.extract ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

/** ตัด intro ให้เหลือ ~350 ตัวอักษร ลงท้ายประโยค */
function truncateIntro(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 350) return clean;
  const cut = clean.slice(0, 350);
  const lastDot = cut.lastIndexOf(". ");
  return lastDot > 150 ? cut.slice(0, lastDot + 1) : cut + "…";
}

async function main() {
  // รวมหุ้นที่ยังไม่มี description จากทั้ง 2 ไฟล์ (เก็บ db object ไว้เขียนกลับ)
  const dbs: Array<{ file: string; db: { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> } }> = [];
  const pending: Array<{ dbIdx: number; stock: Record<string, unknown> }> = [];
  for (const f of FILES) {
    const db = JSON.parse(readFileSync(f, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
    dbs.push({ file: f, db });
    for (const s of db.stocks) {
      if (!s.description) pending.push({ dbIdx: dbs.length - 1, stock: s });
    }
  }
  console.log(`📋 หุ้นที่ยังไม่มี description: ${pending.length} ตัว`);

  // แบ่ง batch ตาม title ที่เดาได้ (ใช้ 2 variants: ชื่อเต็ม + ชื่อตัด suffix — เพิ่มโอกาสเจอใน batch)
  const titleToStock = new Map<string, typeof pending>();
  for (const p of pending) {
    const raw = String(p.stock.nameEn ?? p.stock.name ?? "").trim();
    const full = raw;
    const trimmed = guessTitle(p.stock);
    for (const t of new Set([full, trimmed].filter(Boolean))) {
      if (!titleToStock.has(t)) titleToStock.set(t, []);
      titleToStock.get(t)!.push(p);
    }
  }
  const titles = [...titleToStock.keys()];
  console.log(`📡 ดึง Wikipedia intro (${titles.length} titles, batch 20)...`);

  const intros = await fetchIntros(titles);
  console.log(`  ได้ intro ${intros.size}/${titles.length}`);

  // fallback: title ที่ batch เจอไม่หมด → search หาหน้า Wikipedia (ทีละตัว)
  const missingTitles = titles.filter((t) => !intros.has(t));
  if (missingTitles.length > 0) {
    console.log(`🔍 search fallback สำหรับ ${missingTitles.length} titles...`);
    let found = 0;
    for (const t of missingTitles) {
      const items = titleToStock.get(t)!;
      const st = items[0].stock;
      // ลองหลาย query: nameEn → name → nameEn + " company" (เพิ่มโอกาสเจอ)
      const queries = [
        String(st.nameEn ?? ""),
        String(st.name ?? ""),
        `${String(st.nameEn ?? st.name ?? "")} company`,
      ].filter((q) => q && q !== t);
      let realTitle: string | null = null;
      for (const q of queries) {
        realTitle = await searchTitle(q);
        if (realTitle) break;
      }
      if (realTitle) {
        const intro = await fetchIntroOne(realTitle);
        if (intro) {
          intros.set(t, intro);
          found++;
        }
      }
      await new Promise((r) => setTimeout(r, 500)); // กัน rate-limit
    }
    console.log(`  search fallback ได้เพิ่ม ${found} ตัว`);
  }

  // เติม description + businessEvidence
  let filled = 0;
  let notFound = 0;
  for (const [title, items] of titleToStock) {
    const intro = intros.get(title);
    if (!intro) {
      notFound++;
      continue;
    }
    const desc = truncateIntro(intro);
    for (const { stock } of items) {
      stock.description = desc;
      stock.businessEvidence = {
        source: "Wikipedia intro (auto) — draft รอตรวจ",
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        quote: desc.slice(0, 200),
      };
      filled++;
    }
  }

  // เขียนกลับ (ใช้ db object เดิม — อย่า re-read ไม่งั้น reference ที่แก้หาย)
  for (const { file, db } of dbs) {
    db.meta.updatedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(file, JSON.stringify(db, null, 2) + "\n", "utf8");
  }

  console.log(`\n✅ เติม description ${filled} ตัว (หา intro ไม่เจอ ${notFound})`);
  console.log("   ตัวอย่าง:");
  const shown = new Set<string>();
  for (const [title, items] of titleToStock) {
    const intro = intros.get(title);
    if (intro && shown.size < 3) {
      console.log(`   • ${items[0].stock.ticker} (${title}): ${truncateIntro(intro).slice(0, 100)}...`);
      shown.add(title);
    }
  }
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
