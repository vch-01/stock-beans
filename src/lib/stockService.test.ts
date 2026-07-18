import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { fetchStocksData } from './stockService';
import { loadFallbackStockData } from './fallback';

describe('fetchStocksData error and retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback when fetch fails', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(new Error('network'));

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'ZZZZ' }]);

    expect(fallbackUsed).toBe(true);
    expect(stocks).toEqual(loadFallbackStockData([{ symbol: 'ZZZZ' }]));
  });

  it('falls through providers and eventually gets data from Yahoo', async () => {
    const mockGet = vi.spyOn(axios, 'get');

    mockGet.mockResolvedValue({
      data: {
        quoteResponse: {
          result: [{ symbol: 'AAPL', regularMarketPrice: 150, regularMarketChangePercent: 1 }],
        },
      },
    });

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'AAPL' }]);

    expect(fallbackUsed).toBe(false);
    expect(stocks.length).toBe(1);
    expect(stocks[0].symbol).toBe('AAPL');
    expect(stocks[0].price).toBe(150);
  });
});
