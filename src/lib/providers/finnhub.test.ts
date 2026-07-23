import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios');

const mockedAxios = axios as unknown as { get: ReturnType<typeof vi.fn> };

vi.mock('../config', () => ({
  getFinnhubKey: () => 'test-key',
}));

// Dynamic import to access the module after mocks are set up
const getModule = () => import('./finnhub');

describe('Finnhub provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFinnhubSymbol', () => {
    it('returns uppercase symbol', async () => {
      const { getFinnhubSymbol } = await getModule();
      expect(getFinnhubSymbol('aapl')).toBe('AAPL');
    });
  });

  describe('fetchFinnhubQuote', () => {
    it('returns parsed stock from a valid quote', async () => {
      const { fetchFinnhubQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { c: 150, dp: 3.5 },
      });
      const result = await fetchFinnhubQuote('AAPL');
      expect(result.symbol).toBe('AAPL');
      expect(result.price).toBe(150);
      expect(result.changePercent).toBe(3.5);
    });

    it('throws when quote has null c', async () => {
      const { fetchFinnhubQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: { c: null } });
      await expect(fetchFinnhubQuote('AAPL')).rejects.toThrow('Invalid Finnhub quote');
    });

    it('throws when quote has c = 0', async () => {
      const { fetchFinnhubQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: { c: 0 } });
      await expect(fetchFinnhubQuote('AAPL')).rejects.toThrow('Invalid Finnhub quote');
    });

    it('throws when quote is missing', async () => {
      const { fetchFinnhubQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: null });
      await expect(fetchFinnhubQuote('AAPL')).rejects.toThrow('Invalid Finnhub quote');
    });

    it('defaults missing dp to 0', async () => {
      const { fetchFinnhubQuote } = await getModule();
      mockedAxios.get.mockResolvedValue({ data: { c: 100 } });
      const result = await fetchFinnhubQuote('AAPL');
      expect(result.price).toBe(100);
      expect(result.changePercent).toBe(0);
    });
  });

  describe('fetchFinnhubProfile', () => {
    it('returns name and ATH from profile', async () => {
      const { fetchFinnhubProfile } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { name: 'Apple Inc.', fiftyTwoWeekHigh: 180 },
      });
      const result = await fetchFinnhubProfile('AAPL');
      expect(result?.name).toBe('Apple Inc.');
      expect(result?.allTimeHigh).toBe(180);
    });

    it('falls back to displayName', async () => {
      const { fetchFinnhubProfile } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { displayName: 'Apple Inc.' },
      });
      const result = await fetchFinnhubProfile('AAPL');
      expect(result?.name).toBe('Apple Inc.');
    });

    it('returns undefined for non-finite ATH', async () => {
      const { fetchFinnhubProfile } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { name: 'Apple Inc.', fiftyTwoWeekHigh: 'N/A' },
      });
      const result = await fetchFinnhubProfile('AAPL');
      expect(result?.allTimeHigh).toBeUndefined();
    });
  });

  describe('fetchFinnhubMetric', () => {
    it('returns ATH and forwardPE from metric', async () => {
      const { fetchFinnhubMetric } = await getModule();
      mockedAxios.get.mockResolvedValue({
        data: { metric: { '52WeekHigh': 180, forwardPE: 22 } },
      });
      const result = await fetchFinnhubMetric('AAPL');
      expect(result?.allTimeHigh).toBe(180);
      expect(result?.forwardPE).toBe(22);
    });
  });
});
