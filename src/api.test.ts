import axios from 'axios';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  fetchStocksData,
  normalizeSymbol,
  scoreToValuation,
  getFinnhubSymbol,
  resetServiceState,
} from './api';

type AxiosGetMock = ReturnType<typeof vi.fn>;

vi.mock('axios');
vi.mock('./lib/config', () => ({
  getAlpacaKey: () => undefined,
  getAlpacaSecret: () => undefined,
  getFinnhubKey: () => 'test-finnhub',
  getAlphaVantageKey: () => 'test-alpha',
}));

const mockedAxios = axios as unknown as { get: AxiosGetMock };

describe('api helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetServiceState();
  });

  it('normalizes stock symbols to uppercase', () => {
    expect(normalizeSymbol('shop')).toBe('SHOP');
    expect(normalizeSymbol('aapl')).toBe('AAPL');
  });

  it('formats Finnhub symbols correctly', () => {
    expect(getFinnhubSymbol('shop')).toBe('SHOP');
    expect(getFinnhubSymbol('aapl')).toBe('AAPL');
  });

  it('classifies valuations correctly', () => {
    expect(scoreToValuation(15)).toBe('overvalued');
    expect(scoreToValuation(5)).toBe('fair');
    expect(scoreToValuation(-1)).toBe('undervalued');
  });

  it('loads fallback stock data when API fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Test failure'));

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'AAPL' }]);

    expect(fallbackUsed).toBe(true);
    expect(stocks[0]).toEqual({
      symbol: 'AAPL',
      name: 'AAPL (fallback)',
      allTimeHigh: 0,
      forwardPE: 0,
      earningsYield: 0,
      valueScore: 0,
      price: 0,
      changePercent: 0,
      valuation: 'fair',
    });
  });

  it('fetches stock data successfully with retries', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({
        data: {
          c: 150,
          dp: 3.5,
          h: 152,
          l: 148,
          o: 149,
          pc: 148,
          t: 1781812800,
        },
      })
      .mockResolvedValueOnce({
        data: {
          ticker: 'AAPL',
          name: 'Apple Inc.',
        },
      })
      .mockResolvedValueOnce({
        data: {
          metric: {
            '52WeekHigh': 180,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          Name: 'Apple Inc.',
          ForwardPE: 22,
          '52WeekHigh': 180,
        },
      });

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'AAPL' }]);

    expect(fallbackUsed).toBe(false);
    expect(stocks[0]).toEqual({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      allTimeHigh: 180,
      forwardPE: 22,
      earningsYield: 100 / 22,
      valueScore: Math.round(16.666666666666664 + 9 + (Math.min(100 / 22, 15) / 15) * 30),
      price: 150,
      changePercent: 3.5,
      valuation: 'overvalued',
    });
  });

  it('loads fallback data when symbol returns no quote', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { quoteResponse: { result: [] } },
    });

    const { stocks, fallbackUsed } = await fetchStocksData([{ symbol: 'AAPL' }]);

    expect(fallbackUsed).toBe(true);
    expect(stocks[0].name).toBe('AAPL (fallback)');
  });
});
