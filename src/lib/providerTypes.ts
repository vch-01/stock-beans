export interface YahooSummaryDetailRaw {
  raw?: number;
}

export interface YahooSummaryDetail {
  fiftyTwoWeekHigh?: number | YahooSummaryDetailRaw;
  forwardPE?: number | YahooSummaryDetailRaw;
}

export interface YahooQuote {
  symbol?: string;
  regularMarketPrice?: number | string;
  regularMarketChangePercent?: number | string;
  regularMarketDayHigh?: number | string;
  high?: number | string;
  highPrice?: number | string;
  longName?: string;
  long_name?: string;
  shortName?: string;
  short_name?: string;
  displayName?: string;
  name?: string;
  companyName?: string;
  summaryDetail?: YahooSummaryDetail;
  defaultKeyStatistics?: Partial<Record<string, unknown>>;
  forwardPE?: number | YahooSummaryDetailRaw;
  [key: string]: unknown;
}

export interface AlphaVantageQuote {
  '05. price'?: string;
  '10. change percent'?: string;
  [key: string]: unknown;
}

export interface AlphaVantageResponse {
  'Error Message'?: string;
  Note?: string;
  Information?: string;
  [key: string]: unknown;
}

export interface FinnhubQuote {
  c?: number;
  dp?: number;
  [key: string]: unknown;
}

export interface AlpacaBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: string;
}

export interface AlpacaTrade {
  p: number;
  s: number;
  t: string;
  c: string[];
  z: string;
}

export interface AlpacaSnapshot {
  symbol?: string;
  latestTrade?: AlpacaTrade;
  latestQuote?: {
    ap: number;
    as: number;
    bp: number;
    bs: number;
    t: string;
  };
  minuteBar?: AlpacaBar;
  dailyBar?: AlpacaBar;
  prevDailyBar?: AlpacaBar;
}

export interface AlpacaSnapshotsResponse {
  [symbol: string]: AlpacaSnapshot;
}
