/**
 * ดัชนีตลาด + อัตราแลกเปลี่ยน — สัญลักษณ์ Yahoo คงที่
 * fetch-market-data จะดึงรวมเข้า snapshot (key = symbol ตรงๆ)
 * หน้า /markets อ่านจาก snapshot เหมือนหุ้น
 */
export type IndexEntry = { symbol: string; name: string; region: string };

export const INDICES: IndexEntry[] = [
  // ไทย
  { symbol: "^SET.BK", name: "SET Index", region: "TH" },
  { symbol: "^SET50.BK", name: "SET50", region: "TH" },
  // สหรัฐ
  { symbol: "^GSPC", name: "S&P 500", region: "US" },
  { symbol: "^DJI", name: "Dow Jones", region: "US" },
  { symbol: "^IXIC", name: "NASDAQ", region: "US" },
  { symbol: "^RUT", name: "Russell 2000", region: "US" },
  // เอเชีย
  { symbol: "^N225", name: "Nikkei 225", region: "JP" },
  { symbol: "^HSI", name: "Hang Seng", region: "HK" },
  { symbol: "^KS11", name: "KOSPI", region: "KR" },
  { symbol: "^TWII", name: "TWSE", region: "TW" },
  { symbol: "^BSESN", name: "SENSEX", region: "IN" },
  { symbol: "^AXJO", name: "ASX 200", region: "AU" },
  { symbol: "^STI", name: "Straits Times", region: "SG" },
  { symbol: "^JKSE", name: "IDX Composite", region: "ID" },
  { symbol: "^KLSE", name: "FTSE Bursa KLCI", region: "MY" },
  { symbol: "^PSEI", name: "PSEi", region: "PH" },
  { symbol: "^VNINDEX", name: "VN-Index", region: "VN" },
  // ยุโรป
  { symbol: "^GDAXI", name: "DAX", region: "DE" },
  { symbol: "^FTSE", name: "FTSE 100", region: "GB" },
  { symbol: "^FCHI", name: "CAC 40", region: "FR" },
  { symbol: "^STOXX50E", name: "Euro Stoxx 50", region: "EU" },
  // อื่นๆ
  { symbol: "^BVSP", name: "IBOVESPA", region: "BR" },
  { symbol: "^MXX", name: "IPC Mexico", region: "MX" },
  { symbol: "^TASI", name: "TASI (ซาอุฯ)", region: "SA" },
  { symbol: "^KSE100", name: "KSE-100 (ปากีสถาน)", region: "PK" },
];

export const FX: IndexEntry[] = [
  { symbol: "USDTHB=X", name: "USD/THB", region: "FX" },
  { symbol: "EURUSD=X", name: "EUR/USD", region: "FX" },
  { symbol: "USDJPY=X", name: "USD/JPY", region: "FX" },
  { symbol: "GBPUSD=X", name: "GBP/USD", region: "FX" },
  { symbol: "AUDUSD=X", name: "AUD/USD", region: "FX" },
  { symbol: "USDCAD=X", name: "USD/CAD", region: "FX" },
  { symbol: "USDCNY=X", name: "USD/CNY", region: "FX" },
  { symbol: "USDKRW=X", name: "USD/KRW", region: "FX" },
];

/** สินทรัพย์เด่นสำหรับหน้า /markets (อ่านจาก snapshot + asset universe) */
export const FEATURED_ASSET_SYMBOLS = ["GC=F", "SI=F", "CL=F", "NG=F", "BTC-USD", "ETH-USD"];
