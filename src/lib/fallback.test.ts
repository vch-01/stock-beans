import { describe, expect, it } from 'vitest';
import { loadFallbackStockData } from './fallback';

describe('loadFallbackStockData', () => {
  it('returns a stock with fallback name and zero metrics', () => {
    const result = loadFallbackStockData([{ symbol: 'AAPL' }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      symbol: 'AAPL',
      name: 'AAPL (fallback)',
      price: 0,
      changePercent: 0,
      allTimeHigh: 0,
      forwardPE: 0,
      earningsYield: 0,
      valueScore: 0,
      valuation: 'fair',
    });
  });

  it('normalizes symbol to uppercase', () => {
    const result = loadFallbackStockData([{ symbol: 'aapl' }]);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].name).toBe('AAPL (fallback)');
  });

  it('returns empty array for empty input', () => {
    const result = loadFallbackStockData([]);
    expect(result).toEqual([]);
  });

  it('handles multiple tickers', () => {
    const result = loadFallbackStockData([{ symbol: 'AAPL' }, { symbol: 'TSLA' }]);
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[1].symbol).toBe('TSLA');
  });
});
