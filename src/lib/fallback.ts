import type { Stock } from '../types';
import { normalizeSymbol } from './utils';
import { enrichStockMetrics } from './valuation';

export const loadFallbackStockData = (tickers: { symbol: string }[]): Stock[] => {
  return tickers.map(({ symbol }) => {
    const normalized = normalizeSymbol(symbol);
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
    });
  });
};
