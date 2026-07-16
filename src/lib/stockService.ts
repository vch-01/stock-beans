import axios from 'axios'
import type { Stock } from '../api'
import { enrichStockMetrics } from './valuation'
import type { YahooQuote, AlphaVantageQuote, AlphaVantageResponse, FinnhubQuote } from './providerTypes'

export const defaultTickers = [
  { symbol: 'AAPL' },
  { symbol: 'TSLA' },
]

const apiUrl = '/api/finance/v7/finance/quote'
const getProcessEnv = (key: string) =>
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? (process.env as Record<string, string | undefined>)[key]
    : undefined

const getAlphaVantageKey = () =>
  import.meta.env.VITE_ALPHA_VANTAGE_API_KEY ?? getProcessEnv('VITE_ALPHA_VANTAGE_API_KEY')
const getFinnhubKey = () =>
  import.meta.env.VITE_FINNHUB_API_KEY ?? getProcessEnv('VITE_FINNHUB_API_KEY')
const hasLiveProviderConfigured = () => Boolean(getAlphaVantageKey() || getFinnhubKey())

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const fetchWithRetry = async <T>(request: () => Promise<T>, maxAttempts = 3, initialDelayMs = 400): Promise<T> => {
  let attempt = 0
  let delayMs = initialDelayMs

  while (attempt < maxAttempts) {
    try {
      return await request()
    } catch (error) {
      attempt += 1
      const shouldRetry = attempt < maxAttempts && isRateLimitError(error)
      if (!shouldRetry) {
        throw error
      }
      await delay(delayMs)
      delayMs *= 2
    }
  }

  throw new Error('fetchWithRetry exhausted all attempts')
}

const enrichFromFinnhub = async (stock: Stock): Promise<Stock> => {
  if (!getFinnhubKey()) return stock

  let updatedStock = stock
  const updates: Partial<Stock> = {}

  if (updatedStock.name === updatedStock.symbol || updatedStock.allTimeHigh === 0) {
    try {
      const profileInfo = await fetchFinnhubProfile(stock.symbol)
      if (profileInfo?.name && updatedStock.name === updatedStock.symbol) {
        updates.name = profileInfo.name
      }
      if (typeof profileInfo?.allTimeHigh === 'number' && updatedStock.allTimeHigh === 0) {
        updates.allTimeHigh = profileInfo.allTimeHigh
      }
    } catch {
      // Ignore Finnhub profile enrichment failures.
    }
  }

  if (updatedStock.allTimeHigh === 0 || updatedStock.forwardPE === 0) {
    try {
      const metricInfo = await fetchFinnhubMetric(stock.symbol)
      if (typeof metricInfo?.allTimeHigh === 'number' && updatedStock.allTimeHigh === 0) {
        updates.allTimeHigh = metricInfo.allTimeHigh
      }
      if (typeof metricInfo?.forwardPE === 'number' && updatedStock.forwardPE === 0) {
        updates.forwardPE = metricInfo.forwardPE
      }
    } catch {
      // Ignore Finnhub metric enrichment failures.
    }
  }

  if (Object.keys(updates).length > 0) {
    updatedStock = { ...updatedStock, ...updates }
  }

  return updatedStock
}

const enrichFromAlphaVantage = async (stock: Stock): Promise<Stock> => {
  if (!getAlphaVantageKey()) return stock
  if (stock.name !== stock.symbol && stock.allTimeHigh > 0 && stock.forwardPE > 0) return stock

  try {
    const overview = await fetchAlphaVantageOverview(stock.symbol)
    if (!overview) return stock

    const updates: Partial<Stock> = {}
    if (stock.name === stock.symbol && overview.name) {
      updates.name = overview.name
    }
    if (typeof overview.allTimeHigh === 'number' && stock.allTimeHigh === 0) {
      updates.allTimeHigh = overview.allTimeHigh
    }
    if (typeof overview.forwardPE === 'number' && stock.forwardPE === 0) {
      updates.forwardPE = overview.forwardPE
    }

    return Object.keys(updates).length > 0 ? { ...stock, ...updates } : stock
  } catch {
    return stock
  }
}

const enrichWithProviderFallbacks = async (stock: Stock): Promise<Stock> => {
  let updatedStock = stock

  if (getFinnhubKey()) {
    updatedStock = await enrichFromFinnhub(updatedStock)
  }

  if (getAlphaVantageKey()) {
    updatedStock = await enrichFromAlphaVantage(updatedStock)
  }

  if ((updatedStock.name === updatedStock.symbol || updatedStock.allTimeHigh === 0 || updatedStock.forwardPE === 0) && typeof enrichStockNameFromYahoo === 'function') {
    try {
      updatedStock = await enrichStockNameFromYahoo(updatedStock)
    } catch {
      // Ignore Yahoo enrichment failures.
    }
  }

  return enrichStockMetrics(updatedStock)
}

export const scoreToValuation = (score: number): Stock['valuation'] => {
  if (score > 10) return 'overvalued'
  if (score >= 0) return 'fair'
  return 'undervalued'
}

export const normalizeSymbol = (symbol: string) => {
  return symbol.toUpperCase()
}

const parseQuote = (quote: YahooQuote, symbol: string): Stock => {
  const price = Number(quote['regularMarketPrice'] ?? 0)
  const changePercent = Number(quote['regularMarketChangePercent'] ?? 0)
  const summaryDetail = quote.summaryDetail as YahooQuote['summaryDetail'] | undefined
  const defaultKeyStatistics = quote.defaultKeyStatistics as Record<string, unknown> | undefined
  const fiftyTwoWeekHigh = Number(
    quote['fiftyTwoWeekHigh'] ??
    quote['52WeekHigh'] ??
    (summaryDetail && (summaryDetail['fiftyTwoWeekHigh'] as Record<string, unknown> | undefined)?.['raw']) ??
    (summaryDetail && summaryDetail['fiftyTwoWeekHigh']) ??
    (defaultKeyStatistics && (defaultKeyStatistics['fiftyTwoWeekHigh'] as Record<string, unknown> | undefined)?.['raw']) ??
    (defaultKeyStatistics && defaultKeyStatistics['fiftyTwoWeekHigh']) ??
    0,
  )
  const forwardPE = Number(
    quote['forwardPE'] ??
    (quote['forwardPE'] as Record<string, unknown> | undefined)?.['raw'] ??
    (summaryDetail && (summaryDetail['forwardPE'] as Record<string, unknown> | undefined)?.['raw']) ??
    (summaryDetail && summaryDetail['forwardPE']) ??
    (defaultKeyStatistics && (defaultKeyStatistics['forwardPE'] as Record<string, unknown> | undefined)?.['raw']) ??
    (defaultKeyStatistics && defaultKeyStatistics['forwardPE']) ??
    0,
  )
  const allTimeHigh = Number(
    fiftyTwoWeekHigh || (quote['regularMarketDayHigh'] ?? quote['high'] ?? quote['highPrice'] ?? 0),
  )
  return enrichStockMetrics({
    symbol,
    name:
      (quote['longName'] as string | undefined) ??
      (quote['long_name'] as string | undefined) ??
      (quote['shortName'] as string | undefined) ??
      (quote['short_name'] as string | undefined) ??
      (quote['displayName'] as string | undefined) ??
      (quote['name'] as string | undefined) ??
      (quote['companyName'] as string | undefined) ??
      (quote['symbol'] as string | undefined) ??
      symbol,
    price,
    changePercent,
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
  })
}

const parseAlphaVantageQuote = (quote: AlphaVantageQuote, symbol: string): Stock => {
  const price = Number(quote['05. price'] ?? 0)
  const rawChange = String(quote['10. change percent'] ?? '0').replace('%', '')
  const changePercent = Number(rawChange)
  return enrichStockMetrics({
    symbol,
    name: symbol,
    price,
    changePercent,
    allTimeHigh: 0,
    forwardPE: 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
  })
}

const fetchAlphaVantageOverview = async (symbol: string): Promise<{ name?: string; allTimeHigh?: number; forwardPE?: number } | undefined> => {
  const apiKey = getAlphaVantageKey()
  if (!apiKey) return undefined

  const response = await axios.get('/api/alpha/query', {
    params: {
      function: 'OVERVIEW',
      symbol,
      apikey: apiKey,
    },
  })

  const data = response.data || {}
  const name = data?.Name ?? data?.name
  const possibleHigh = Number(data?.['52WeekHigh'] ?? data?.['52_WeekHigh'] ?? data?.['52WeekHighLow'] ?? NaN)
  const forwardPE = Number(data?.ForwardPE ?? data?.forwardPE ?? NaN)
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined
  return {
    name: typeof name === 'string' && name ? name : undefined,
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : undefined,
  }
}

const fetchFinnhubProfile = async (symbol: string): Promise<{ name?: string; allTimeHigh?: number } | undefined> => {
  const apiKey = getFinnhubKey()
  if (!apiKey) return undefined

  const response = await axios.get('/api/finnhub/v1/stock/profile2', {
    params: {
      symbol,
      token: apiKey,
    },
  })

  const profile = response.data || {}
  const name = profile?.name ?? profile?.displayName ?? profile?.companyName
  const possibleHigh = Number(profile?.fiftyTwoWeekHigh ?? profile?.['52WeekHigh'] ?? profile?.high52 ?? NaN)
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined
  return { name: typeof name === 'string' && name ? name : undefined, allTimeHigh }
}

const fetchFinnhubMetric = async (symbol: string): Promise<{ allTimeHigh?: number; forwardPE?: number } | undefined> => {
  const apiKey = getFinnhubKey()
  if (!apiKey) return undefined

  const response = await axios.get('/api/finnhub/v1/stock/metric', {
    params: {
      symbol,
      metric: 'all',
      token: apiKey,
    },
  })

  const metric = response.data?.metric || {}
  const possibleHigh = Number(
    metric?.['52WeekHigh'] ??
    metric?.['52WeekHigh']?.raw ??
    metric?.yearHigh ??
    metric?.['52WeekHighLow'] ??
    NaN,
  )
  const forwardPE = Number(metric?.forwardPE ?? metric?.['forwardPE'] ?? NaN)
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined
  return {
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : undefined,
  }
}


const fetchYahooSummary = async (symbol: string): Promise<number | undefined> => {
  const response = await axios.get(`/api/finance/v10/finance/quoteSummary/${symbol}`, {
    params: { modules: 'summaryDetail' },
  })

  const result = response.data?.quoteSummary?.result
  const summary = Array.isArray(result) ? result[0]?.summaryDetail : undefined
  const high = Number(
    summary?.fiftyTwoWeekHigh?.raw ??
    summary?.fiftyTwoWeekHigh ??
    summary?.['52WeekHigh'] ??
    summary?.['52WeekHigh']?.raw ??
    NaN,
  )
  return Number.isFinite(high) ? high : undefined
}

const enrichYahooAth = async (stock: Stock): Promise<Stock> => {
  if (stock.allTimeHigh > 0) {
    return stock
  }

  try {
    const summaryHigh = await fetchYahooSummary(stock.symbol)
    if (typeof summaryHigh === 'number' && summaryHigh > 0) {
      return enrichStockMetrics({ ...stock, allTimeHigh: summaryHigh })
    }
  } catch {
    // Ignore Yahoo summary failures and keep the original stock values.
  }

  return stock
}

const enrichStockNameFromYahoo = async (stock: Stock): Promise<Stock> => {
  if (stock.name !== stock.symbol && stock.allTimeHigh > 0) {
    return stock
  }

  try {
    const yahooStock = await fetchYahooQuote(stock.symbol)
    const updates: Partial<Stock> = {}
    if (stock.name === stock.symbol && yahooStock.name && yahooStock.name !== yahooStock.symbol) {
      updates.name = yahooStock.name
    }
    if (typeof yahooStock.allTimeHigh === 'number' && yahooStock.allTimeHigh > 0) {
      updates.allTimeHigh = yahooStock.allTimeHigh
    }

    if (updates.allTimeHigh == null || updates.allTimeHigh === 0) {
      const summaryHigh = await fetchYahooSummary(stock.symbol)
      if (typeof summaryHigh === 'number' && summaryHigh > 0) {
        updates.allTimeHigh = summaryHigh
      }
    }

    if (Object.keys(updates).length > 0) {
      return { ...stock, ...updates }
    }
  } catch {
    // If Yahoo fails, preserve the original stock values.
  }

  return stock
}

const isAlphaVantageDataError = (data: AlphaVantageResponse | undefined) => {
  return Boolean((data && (data['Error Message'] || data['Note'] || data['Information'])) ?? false)
}

const fetchAlphaVantageQuote = async (symbol: string): Promise<Stock> => {
  const apiKey = getAlphaVantageKey()
  if (!apiKey) {
    throw new Error('AlphaVantage API key is not configured')
  }

  const response = await fetchWithRetry(() =>
    axios.get('/api/alpha/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol,
        apikey: apiKey,
      },
    }),
  )

  const data = response.data
  if (isAlphaVantageDataError(data)) {
    throw new Error(data['Error Message'] || data.Note || data.Information)
  }

  const quote = data?.['Global Quote']
  if (!quote || !quote['05. price']) {
    throw new Error(`Invalid AlphaVantage quote for ${symbol}`)
  }

  const stock = parseAlphaVantageQuote(quote, symbol)
  return enrichWithProviderFallbacks(stock)
}

const parseFinnhubQuote = (quote: FinnhubQuote, symbol: string): Stock => {
  const price = Number(quote.c ?? 0)
  const changePercent = Number(quote.dp ?? 0)
  return enrichStockMetrics({
    symbol,
    name: symbol,
    price,
    changePercent,
    allTimeHigh: 0,
    forwardPE: 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
  })
}

export const getFinnhubSymbol = (symbol: string) => {
  return normalizeSymbol(symbol)
}

const fetchFinnhubQuote = async (symbol: string): Promise<Stock> => {
  const apiKey = getFinnhubKey()
  if (!apiKey) {
    throw new Error('Finnhub API key is not configured')
  }

  const providerSymbol = getFinnhubSymbol(symbol)
  const response = await fetchWithRetry(() =>
    axios.get('/api/finnhub/v1/quote', {
      params: {
        symbol: providerSymbol,
        token: apiKey,
      },
    }),
  )

  const quote = response.data
  if (!quote || quote.c == null || quote.c === 0) {
    throw new Error(`Invalid Finnhub quote for ${symbol}`)
  }

  const stock = parseFinnhubQuote(quote, symbol)
  return enrichWithProviderFallbacks(stock)
}

const fetchYahooQuote = async (symbol: string): Promise<Stock> => {
  const response = await fetchWithRetry(() =>
    axios.get(apiUrl, {
      params: { symbols: symbol },
    }),
  )

  const result = response.data?.quoteResponse?.result
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Missing Yahoo quote for ${symbol}`)
  }

  const stock = parseQuote(result[0], symbol)
  return getFinnhubKey() || getAlphaVantageKey() ? enrichWithProviderFallbacks(stock) : stock
}

const fetchYahooQuoteBatch = async (tickerRequests: { symbol: string }[]) => {
  const response = await fetchWithRetry(() =>
    axios.get(apiUrl, {
      params: { symbols: tickerRequests.map(t => t.symbol).join(',') },
    }),
  )

  const result = response.data?.quoteResponse?.result
  if (!Array.isArray(result)) {
    throw new Error(`Invalid quote response for symbols ${tickerRequests.map(t => t.symbol).join(',')}`)
  }

  return Promise.all(
    tickerRequests.map(async ({ symbol }) => {
      const quote = findQuote(result, symbol)
      if (!quote) {
        throw new Error(`Missing Yahoo quote for ${symbol}`)
      }

      let stock = parseQuote(quote, symbol)
      if (getFinnhubKey() || getAlphaVantageKey()) {
        stock = await enrichWithProviderFallbacks(stock)
      } else if (stock.allTimeHigh === 0) {
        stock = await enrichYahooAth(stock)
      }
      return stock
    }),
  )
}

const fetchQuoteBatchOnce = async (tickerRequests: { symbol: string }[]) => {
  if (!hasLiveProviderConfigured()) {
    return fetchYahooQuoteBatch(tickerRequests)
  }

  const hasFinnhub = Boolean(getFinnhubKey())
  const hasAlphaVantage = Boolean(getAlphaVantageKey())

  if (hasFinnhub) {
    const quotes = [] as Stock[]

    for (let i = 0; i < tickerRequests.length; i += 1) {
      const { symbol } = tickerRequests[i]
      let quote: Stock | undefined

      try {
        quote = await fetchFinnhubQuote(symbol)
      } catch {
        if (hasAlphaVantage) {
          try {
            quote = await fetchAlphaVantageQuote(symbol)
          } catch {
            try {
              quote = await fetchYahooQuote(symbol)
            } catch {
              quote = undefined
            }
          }
        } else {
          try {
            quote = await fetchYahooQuote(symbol)
          } catch {
            quote = undefined
          }
        }
      }

      quotes.push(quote ?? loadFallbackStockData([{ symbol }])[0])
      await delay(500)
    }

    return quotes
  }

  if (hasAlphaVantage) {
    const quotes = [] as Stock[]

    for (let i = 0; i < tickerRequests.length; i += 1) {
      const { symbol } = tickerRequests[i]
      let quote: Stock | undefined

      try {
        quote = await fetchAlphaVantageQuote(symbol)
      } catch {
        try {
          quote = await fetchYahooQuote(symbol)
        } catch {
          quote = undefined
        }
      }

      quotes.push(quote ?? loadFallbackStockData([{ symbol }])[0])

      if (i < tickerRequests.length - 1) {
        await delay(1250)
      }
    }

    return quotes
  }

  return fetchYahooQuoteBatch(tickerRequests)
}

const isRateLimitError = (error: unknown) => {
  const status = axios.isAxiosError(error)
    ? error.response?.status
    : (error as { response?: { status?: number } })?.response?.status

  return status !== undefined && [429, 503].includes(status)
}

const fetchQuoteBatchWithRetry = async (tickerRequests: { symbol: string }[]) => {
  return fetchWithRetry(() => fetchQuoteBatchOnce(tickerRequests))
}

const findQuote = (quotes: Record<string, unknown>[], normalized: string) => {
  return quotes.find(quote => String(quote['symbol']).toUpperCase() === normalized.toUpperCase())
}

export const loadFallbackStockData = (tickers: { symbol: string }[]): Stock[] => {
  return tickers.map(({ symbol }) => {
    const normalized = normalizeSymbol(symbol)
    return enrichStockMetrics({
      symbol: normalized,
      name: `${normalized} (fallback)`,
      allTimeHigh: 0,
      forwardPE: 0,
      earningsYield: 0,
      valueScore: 0,
      price: 0,
      changePercent: 0,
      valuation: 'fair',
    })
  })
}

export const fetchStocksData = async (
  tickers: { symbol: string }[],
): Promise<{ stocks: Stock[]; fallbackUsed: boolean }> => {
  const normalizedTickers = tickers.map(({ symbol }) => ({
    symbol: normalizeSymbol(symbol),
  }))

  try {
    const stocks = await fetchQuoteBatchWithRetry(normalizedTickers)
    const fallbackUsed = stocks.some(stock => stock.price === 0 && stock.changePercent === 0)
    return { stocks, fallbackUsed }
  } catch {
    return { stocks: loadFallbackStockData(normalizedTickers), fallbackUsed: true }
  }
}
