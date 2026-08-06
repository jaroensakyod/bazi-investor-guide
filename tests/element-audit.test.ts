import { describe, it, expect } from "vitest";
import { getAssets } from "../src/lib/assets/asset-universe";
import { getAllStocks } from "../src/lib/investor/stock-database";

/** เทสต์ล็อกการแมปธาตุตามตารางแม่บทซินแส (bazi-sft-dataset/knownlage/distilled/Source6_ การงานและธุรกิจ §1.1.2)
 *  กัน regression — ถ้าซินแสแก้ ให้แก้เทสต์นี้พร้อมกัน
 */
describe("ธาตุตามตารางแม่บทซินแส (Source6 §1.1.2)", () => {
  const stock = (tk: string) => getAllStocks().find((s) => s.ticker === tk);
  const asset = (tk: string) => getAssets().find((a) => a.ticker === tk);

  it("การเกษตร/ปศุสัตว์ = ดิน (โค/หมู/ไก่)", () => {
    for (const tk of ["LE=F", "HE=F", "GF=F", "LIVESTOCK_FARM", "EGG_FARM"]) {
      expect(asset(tk)?.primaryElement, tk).toBe("ดิน");
    }
  });

  it("กล้องถ่ายรูป = ไฟ · ศิลปะ/จิตรกร = ไม้ · แร่ธาตุ/หยก = ดิน", () => {
    expect(asset("VINTAGE_CAMERA")?.primaryElement).toBe("ไฟ");
    expect(asset("ARTWORK")?.primaryElement).toBe("ไม้");
    expect(asset("JADE")?.primaryElement).toBe("ดิน");
  });

  it("การศึกษา/โรงเรียน = ไม้ (SISB, TAL)", () => {
    expect(stock("SISB")?.primaryElement).toBe("ไม้");
    expect(stock("TAL")?.primaryElement).toBe("ไม้");
  });

  it("หมวดหลักคงเดิม — ธนาคาร=น้ำ · อสังหา/ปูน=ดิน · พลังงาน/รพ.=ไฟ · สะดวกซื้อ=น้ำ · โทรคม=ไม้ · เทค/ชิป=ทอง", () => {
    expect(stock("KBANK")?.primaryElement).toBe("น้ำ");
    expect(stock("SCC")?.primaryElement).toBe("ดิน");
    expect(stock("GULF")?.primaryElement).toBe("ไฟ");
    expect(stock("BDMS")?.primaryElement).toBe("ไฟ");
    expect(stock("CPALL")?.primaryElement).toBe("น้ำ");
    expect(stock("ADVANC")?.primaryElement).toBe("ไม้");
    expect(stock("DELTA")?.primaryElement).toBe("ทอง");
  });
});
