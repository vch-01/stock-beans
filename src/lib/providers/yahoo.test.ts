import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

const getModule = () => import('./yahoo');

describe('Yahoo provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchYahooQuoteStock', () => {
    it('returns parsed stock from valid quote', async () => {
      const { fetchYahooQuoteStock } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [
              {
                symbol: 'AAPL',
                regularMarketPrice: 150,
                regularMarketChangePercent: 2.5,
                longName: 'Apple Inc.',
                fiftyTwoWeekHigh: 200,
                forwardPE: 22,
              },
            ],
          },
        },
      });
      const result = await fetchYahooQuoteStock('AAPL');
      expect(result.symbol).toBe('AAPL');
      expect(result.price).toBe(150);
      expect(result.changePercent).toBe(2.5);
      expect(result.name).toBe('Apple Inc.');
      expect(result.allTimeHigh).toBe(200);
      expect(result.forwardPE).toBe(22);
    });

    it('throws when result array is empty', async () => {
      const { fetchYahooQuoteStock } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { quoteResponse: { result: [] } },
      });
      await expect(fetchYahooQuoteStock('AAPL')).rejects.toThrow('Missing Yahoo quote');
    });

    it('falls through multiple name fields', async () => {
      const { fetchYahooQuoteStock } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [
              {
                symbol: 'AAPL',
                shortName: 'Apple',
                regularMarketPrice: 150,
                regularMarketChangePercent: 0,
              },
            ],
          },
        },
      });
      const result = await fetchYahooQuoteStock('AAPL');
      expect(result.name).toBe('Apple');
    });

    it('defaults name to symbol when no name field is present', async () => {
      const { fetchYahooQuoteStock } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [{ symbol: 'AAPL', regularMarketPrice: 150, regularMarketChangePercent: 0 }],
          },
        },
      });
      const result = await fetchYahooQuoteStock('AAPL');
      expect(result.name).toBe('AAPL');
    });
  });

  describe('fetchYahooQuoteBatch', () => {
    it('returns stocks for multiple symbols', async () => {
      const { fetchYahooQuoteBatch } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [
              { symbol: 'AAPL', regularMarketPrice: 150, regularMarketChangePercent: 0 },
              { symbol: 'TSLA', regularMarketPrice: 200, regularMarketChangePercent: 0 },
            ],
          },
        },
      });
      const results = await fetchYahooQuoteBatch(['AAPL', 'TSLA']);
      expect(results).toHaveLength(2);
      expect(results[0].symbol).toBe('AAPL');
      expect(results[1].symbol).toBe('TSLA');
    });

    it('throws when response has no result array', async () => {
      const { fetchYahooQuoteBatch } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: {} });
      await expect(fetchYahooQuoteBatch(['AAPL'])).rejects.toThrow('Invalid quote response');
    });

    it('throws when a symbol is not found in results', async () => {
      const { fetchYahooQuoteBatch } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [{ symbol: 'MSFT', regularMarketPrice: 300, regularMarketChangePercent: 0 }],
          },
        },
      });
      await expect(fetchYahooQuoteBatch(['AAPL'])).rejects.toThrow('Missing Yahoo quote');
    });

    it('matches symbols case-insensitively', async () => {
      const { fetchYahooQuoteBatch } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteResponse: {
            result: [{ symbol: 'AAPL', regularMarketPrice: 150, regularMarketChangePercent: 0 }],
          },
        },
      });
      const results = await fetchYahooQuoteBatch(['aapl']);
      expect(results[0].symbol).toBe('aapl');
    });
  });

  describe('fetchYahooSummary', () => {
    it('returns fiftyTwoWeekHigh from summaryDetail', async () => {
      const { fetchYahooSummary } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteSummary: {
            result: [{ summaryDetail: { fiftyTwoWeekHigh: { raw: 200 } } }],
          },
        },
      });
      const result = await fetchYahooSummary('AAPL');
      expect(result).toBe(200);
    });

    it('returns undefined for non-finite values', async () => {
      const { fetchYahooSummary } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          quoteSummary: {
            result: [{ summaryDetail: { fiftyTwoWeekHigh: { raw: 'N/A' } } }],
          },
        },
      });
      const result = await fetchYahooSummary('AAPL');
      expect(result).toBeUndefined();
    });
  });
});
