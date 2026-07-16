import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { fetchStocksData, loadFallbackStockData } from './stockService'

describe('fetchStocksData error and retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns fallback when fetch fails', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('network'))

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'ZZZZ' }])

    expect(fallbackUsed).toBe(true)
    expect(stocks).toEqual(loadFallbackStockData([{ symbol: 'ZZZZ' }]))
  })

  it('retries on rate-limit errors and succeeds', async () => {
    const mockGet = vi.spyOn(axios, 'get')

    mockGet
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({ data: { quoteResponse: { result: [{ symbol: 'AAPL', regularMarketPrice: 150, regularMarketChangePercent: 1 }] } } })

    vi.spyOn(axios, 'isAxiosError').mockImplementation(() => true)

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'AAPL' }])

    expect(fallbackUsed).toBe(false)
    expect(stocks.length).toBe(1)
    expect(stocks[0].symbol).toBe('AAPL')
    expect(stocks[0].price).toBe(150)
  })
})
