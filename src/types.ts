export type Stock = {
  symbol: string
  name: string
  price: number
  changePercent: number
  allTimeHigh: number
  forwardPE: number
  earningsYield: number
  valueScore: number
  valuation: 'undervalued' | 'fair' | 'overvalued'
}
