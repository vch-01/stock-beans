export interface YahooSummaryDetailRaw {
  raw?: number
}

export interface YahooSummaryDetail {
  fiftyTwoWeekHigh?: number | YahooSummaryDetailRaw
  forwardPE?: number | YahooSummaryDetailRaw
}

export interface YahooQuote {
  symbol?: string
  regularMarketPrice?: number | string
  regularMarketChangePercent?: number | string
  regularMarketDayHigh?: number | string
  high?: number | string
  highPrice?: number | string
  longName?: string
  long_name?: string
  shortName?: string
  short_name?: string
  displayName?: string
  name?: string
  companyName?: string
  summaryDetail?: YahooSummaryDetail
  defaultKeyStatistics?: Partial<Record<string, unknown>>
  forwardPE?: number | YahooSummaryDetailRaw
  [key: string]: unknown
}

export interface AlphaVantageQuote {
  '05. price'?: string
  '10. change percent'?: string
  [key: string]: unknown
}

export interface AlphaVantageResponse {
  'Error Message'?: string
  Note?: string
  Information?: string
  [key: string]: unknown
}

export interface FinnhubQuote {
  c?: number
  dp?: number
  [key: string]: unknown
}
