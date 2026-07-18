import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

vi.mock('../config', () => ({
  getAlphaVantageKey: () => 'test-key',
}));

const getModule = () => import('./alphaVantage');

describe('Alpha Vantage provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAlphaVantageQuote', () => {
    it('returns parsed stock from valid quote', async () => {
      const { fetchAlphaVantageQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: {
          'Global Quote': {
            '05. price': '150.00',
            '10. change percent': '2.5%',
          },
        },
      });
      const result = await fetchAlphaVantageQuote('AAPL');
      expect(result.symbol).toBe('AAPL');
      expect(result.price).toBe(150);
      expect(result.changePercent).toBe(2.5);
    });

    it('throws when Global Quote is missing', async () => {
      const { fetchAlphaVantageQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: {} });
      await expect(fetchAlphaVantageQuote('AAPL')).rejects.toThrow('Invalid AlphaVantage quote');
    });

    it('throws on API error message', async () => {
      const { fetchAlphaVantageQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { 'Error Message': 'Invalid API call' },
      });
      await expect(fetchAlphaVantageQuote('AAPL')).rejects.toThrow('Invalid API call');
    });
  });

  describe('fetchAlphaVantageOverview', () => {
    it('returns name, ATH, and forwardPE', async () => {
      const { fetchAlphaVantageOverview } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { Name: 'Apple Inc.', '52WeekHigh': '180', ForwardPE: '22' },
      });
      const result = await fetchAlphaVantageOverview('AAPL');
      expect(result?.name).toBe('Apple Inc.');
      expect(result?.allTimeHigh).toBe(180);
      expect(result?.forwardPE).toBe(22);
    });

    it('returns undefined for missing numeric fields', async () => {
      const { fetchAlphaVantageOverview } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { Name: 'Apple Inc.' },
      });
      const result = await fetchAlphaVantageOverview('AAPL');
      expect(result?.name).toBe('Apple Inc.');
      expect(result?.allTimeHigh).toBeUndefined();
      expect(result?.forwardPE).toBeUndefined();
    });
  });
});
