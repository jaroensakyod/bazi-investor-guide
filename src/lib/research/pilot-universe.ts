export type ResearchPilotSecurity = {
  securityId: string;
  ticker: string;
  market: string;
  /** Prevent predecessor history from being mixed into a new legal security. */
  historyFrom?: string;
  note?: string;
};

export type ResearchPilotUniverse = {
  id: string;
  name: string;
  securities: ResearchPilotSecurity[];
};

export const TH10_RESEARCH_PILOT: ResearchPilotUniverse = {
  id: "th10-ceo-v1",
  name: "TH10 จากชุดตัวอย่าง CEO",
  securities: [
    { securityId: "SET:BH", ticker: "BH", market: "SET" },
    { securityId: "SET:BDMS", ticker: "BDMS", market: "SET" },
    { securityId: "SET:PTTEP", ticker: "PTTEP", market: "SET" },
    { securityId: "SET:GULF", ticker: "GULF", market: "SET", historyFrom: "2025-04-01", note: "นิติบุคคลผู้สืบทอดจากการควบรวม" },
    {
      securityId: "SET:BANPU",
      ticker: "BANPU",
      market: "SET",
      historyFrom: "2026-08-04",
      note: "NewCo จาก BANPU/BPP; ห้ามปะปนราคาของนิติบุคคลเดิม",
    },
    { securityId: "SET:GUNKUL", ticker: "GUNKUL", market: "SET" },
    { securityId: "SET:XPG", ticker: "XPG", market: "SET" },
    { securityId: "SET:BEAUTY", ticker: "BEAUTY", market: "SET" },
    { securityId: "SET:PTT", ticker: "PTT", market: "SET" },
    { securityId: "SET:DELTA", ticker: "DELTA", market: "SET" },
  ],
};

export const US10_RESEARCH_PILOT: ResearchPilotUniverse = {
  id: "us10-official-v1",
  name: "US10 high-liquidity official-date pilot",
  securities: [
    { securityId: "NASDAQ:AAPL", ticker: "AAPL", market: "NASDAQ" },
    { securityId: "NASDAQ:MSFT", ticker: "MSFT", market: "NASDAQ" },
    { securityId: "NASDAQ:NVDA", ticker: "NVDA", market: "NASDAQ" },
    { securityId: "NASDAQ:AMZN", ticker: "AMZN", market: "NASDAQ" },
    { securityId: "NASDAQ:GOOGL", ticker: "GOOGL", market: "NASDAQ" },
    { securityId: "NASDAQ:META", ticker: "META", market: "NASDAQ" },
    { securityId: "NASDAQ:TSLA", ticker: "TSLA", market: "NASDAQ" },
    { securityId: "NASDAQ:NFLX", ticker: "NFLX", market: "NASDAQ" },
    { securityId: "NYSE:BABA", ticker: "BABA", market: "NYSE" },
    { securityId: "NYSE:V", ticker: "V", market: "NYSE" },
  ],
};

export const RESEARCH_PILOT_UNIVERSES = [TH10_RESEARCH_PILOT, US10_RESEARCH_PILOT] as const;
