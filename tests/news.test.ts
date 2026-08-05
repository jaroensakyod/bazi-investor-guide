import { describe, it, expect } from "vitest";
import { parseRss, classifyNews, filterNewsByKeywords, filterNewsByMarket } from "../src/lib/market/news";
import { eventsBetween, EVENTS_SEED } from "../src/lib/market/events";

const RSS_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel><title>Test</title>
<item>
  <title>Fed signals rate cut as inflation cools</title>
  <link>https://example.com/1</link>
  <pubDate>Mon, 05 Aug 2026 10:00:00 GMT</pubDate>
  <description>Central bank ready to ease policy.</description>
</item>
<item>
  <title>TSMC reports record AI chip revenue</title>
  <link>https://example.com/2</link>
  <pubDate>Mon, 05 Aug 2026 09:00:00 GMT</pubDate>
</item>
<item>
  <title>No finance content here</title>
  <link>https://example.com/3</link>
</item>
</channel></rss>`;

describe("parseRss — แยก items จาก XML", () => {
  const items = parseRss(RSS_FIXTURE, "TestFeed");
  it("ได้ครบ 3 item + ฟิลด์พื้นฐาน", () => {
    expect(items.length).toBe(3);
    expect(items[0].title).toContain("Fed signals");
    expect(items[0].link).toBe("https://example.com/1");
    expect(items[0].source).toBe("TestFeed");
    expect(items[0].description).toContain("Central bank");
  });
  it("classifyNews ฝังตอน parse (Fed → น้ำ)", () => {
    expect(items[0].elements).toContain("น้ำ");
    expect(items[0].sectors).toContain("Banks");
  });
  it("TSMC/chip → ทอง", () => {
    expect(items[1].elements).toContain("ทอง");
    expect(items[1].sectors).toContain("Semiconductors");
  });
  it("ข่าวไม่มี keyword → elements ว่าง (ไม่เดา)", () => {
    expect(items[2].elements).toEqual([]);
  });
});

describe("classifyNews + filter", () => {
  it("keyword ไม่ซ้ำกันใน elements", () => {
    const cls = classifyNews({ title: "Trump tariff on gold and oil", description: "" });
    expect(cls.elements.length).toBe(new Set(cls.elements).size);
    expect(cls.elements).toContain("ทอง"); // tariff
    expect(cls.elements).toContain("ไฟ"); // oil
  });
  it("filterNewsByKeywords — กรองตามคำ", () => {
    const items = parseRss(RSS_FIXTURE, "T");
    const hits = filterNewsByKeywords(items, ["chip"], 5);
    expect(hits.length).toBe(1);
    expect(hits[0].title).toContain("TSMC");
  });
});

describe("ข่าวต่อตลาด (Google News RSS)", () => {
  it("parseRss เก็บ market ลง item", () => {
    const items = parseRss(RSS_FIXTURE, "Google News TH", "TH");
    expect(items[0].market).toBe("TH");
    expect(items[0].source).toBe("Google News TH");
  });
  it("filterNewsByMarket — กรองเฉพาะตลาด", () => {
    const th = parseRss(RSS_FIXTURE, "Google News TH", "TH");
    const cn = parseRss(RSS_FIXTURE, "Google News CN", "CN");
    const all = [...th, ...cn];
    expect(filterNewsByMarket(all, "TH", 5).every((i) => i.market === "TH")).toBe(true);
    expect(filterNewsByMarket(all, "CN", 5).every((i) => i.market === "CN")).toBe(true);
  });
});

describe("eventsBetween — เหตุการณ์ช่วงวันที่", () => {
  it("เจอ FOMC ก.ย. ในช่วง 15-16 ก.ย.", () => {
    const hits = eventsBetween(EVENTS_SEED, "2026-09-01", "2026-09-30");
    expect(hits.some((e) => e.title.includes("ก.ย."))).toBe(true);
  });
  it("นอกช่วง → ไม่เจอ", () => {
    const hits = eventsBetween(EVENTS_SEED, "2026-05-01", "2026-05-31");
    expect(hits.some((e) => e.title.includes("FOMC"))).toBe(false);
  });
  it("seed มี FOMC ครบ 8 ครั้ง (2026)", () => {
    expect(EVENTS_SEED.filter((e) => e.title.includes("FOMC")).length).toBe(8);
  });
});
