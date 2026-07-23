import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stock } from '../types';
import { enrichStocks } from './enrichment';

vi.mock('./config', () => ({
  getFinnhubKey: () => 'test-key',
  getAlphaVantageKey: () => 'test-key',
}));

vi.mock('./providers/finnhub', () => ({
  fetchFinnhubProfile: vi.fn(),
  fetchFinnhubMetric: vi.fn(),
}));

vi.mock('./providers/alphaVantage', () => ({
  fetchAlphaVantageOverview: vi.fn(),
}));

vi.mock('./providers/yahoo', () => ({
  fetchYahooQuoteStock: vi.fn(),
  fetchYahooSummary: vi.fn(),
}));

const { fetchFinnhubProfile, fetchFinnhubMetric } = await import('./providers/finnhub');
const { fetchAlphaVantageOverview } = await import('./providers/alphaVantage');
const { fetchYahooQuoteStock, fetchYahooSummary } = await import('./providers/yahoo');

const makeStock = (overrides: Partial<Stock> = {}): Stock => {
  const symbol = overrides.symbol ?? 'AAPL';
  return {
    symbol,
    name: symbol,
    price: 150,
    changePercent: 2,
    allTimeHigh: 0,
    forwardPE: 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
    ...overrides,
  };
};

describe('enrichStocks', () => {
  beforeEach(() => {
    for (const m of [
      fetchFinnhubProfile,
      fetchFinnhubMetric,
      fetchAlphaVantageOverview,
      fetchYahooQuoteStock,
      fetchYahooSummary,
    ]) {
      (m as ReturnType<typeof vi.fn>).mockReset();
    }
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fetchFinnhubMetric as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fetchAlphaVantageOverview as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (fetchYahooQuoteStock as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (fetchYahooSummary as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
  });

  it('short-circuits when stock is already enriched', async () => {
    const stock = makeStock({
      name: 'Apple Inc.',
      allTimeHigh: 200,
      forwardPE: 15,
    });
    const [result] = await enrichStocks([stock]);
    expect(result.name).toBe('Apple Inc.');
    expect(fetchFinnhubProfile).not.toHaveBeenCalled();
    expect(fetchFinnhubMetric).not.toHaveBeenCalled();
  });

  it('fetches name and ATH from Finnhub profile', async () => {
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Apple Inc.',
      allTimeHigh: 200,
    });

    const [result] = await enrichStocks([makeStock()]);
    expect(result.name).toBe('Apple Inc.');
    expect(result.allTimeHigh).toBe(200);
    expect(fetchFinnhubProfile).toHaveBeenCalledWith('AAPL');
  });

  it('fetches ATH and PE from Finnhub metric', async () => {
    (fetchFinnhubMetric as ReturnType<typeof vi.fn>).mockResolvedValue({
      allTimeHigh: 180,
      forwardPE: 22,
    });

    const [result] = await enrichStocks([makeStock()]);
    expect(result.allTimeHigh).toBe(180);
    expect(result.forwardPE).toBe(22);
    expect(fetchFinnhubMetric).toHaveBeenCalledWith('AAPL');
  });

  it('fills missing data from Alpha Vantage when Finnhub only provides partial data', async () => {
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Apple Inc.' });
    (fetchFinnhubMetric as ReturnType<typeof vi.fn>).mockResolvedValue({ allTimeHigh: 180 });
    (fetchAlphaVantageOverview as ReturnType<typeof vi.fn>).mockResolvedValue({ forwardPE: 22 });

    const [result] = await enrichStocks([makeStock()]);
    expect(result.name).toBe('Apple Inc.');
    expect(result.allTimeHigh).toBe(180);
    expect(result.forwardPE).toBe(22);
  });

  it('skips Alpha Vantage name when Finnhub already set it', async () => {
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Apple Inc.' });
    (fetchAlphaVantageOverview as ReturnType<typeof vi.fn>).mockResolvedValue({
      name: 'Apple Inc. (AV)',
    });

    const [result] = await enrichStocks([makeStock()]);
    expect(result.name).toBe('Apple Inc.');
  });

  it('falls through to Yahoo when Finnhub and AV fail', async () => {
    (fetchYahooQuoteStock as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      allTimeHigh: 190,
      forwardPE: 0,
      price: 150,
      changePercent: 2,
      earningsYield: 0,
      valueScore: 0,
      valuation: 'fair',
    });

    const [result] = await enrichStocks([makeStock()]);
    expect(result.name).toBe('Apple Inc.');
    expect(result.allTimeHigh).toBe(190);
  });

  it('skips Yahoo when Finnhub already provided full data', async () => {
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'Apple Inc.' });
    (fetchFinnhubMetric as ReturnType<typeof vi.fn>).mockResolvedValue({
      allTimeHigh: 180,
      forwardPE: 22,
    });

    await enrichStocks([makeStock()]);
    expect(fetchYahooQuoteStock).not.toHaveBeenCalled();
  });

  it('handles provider errors gracefully', async () => {
    (fetchFinnhubProfile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    (fetchFinnhubMetric as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'));
    (fetchAlphaVantageOverview as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network error'),
    );

    const [result] = await enrichStocks([makeStock()]);
    expect(result.symbol).toBe('AAPL');
    expect(result.name).toBe('AAPL');
    expect(result.allTimeHigh).toBe(0);
    expect(result.forwardPE).toBe(0);
  });

  it('fetches Yahoo summary as fallback for ATH', async () => {
    (fetchYahooQuoteStock as ReturnType<typeof vi.fn>).mockResolvedValue({
      symbol: 'AAPL',
      name: 'Apple Inc.',
      allTimeHigh: 0,
      forwardPE: 0,
      price: 150,
      changePercent: 2,
      earningsYield: 0,
      valueScore: 0,
      valuation: 'fair',
    });
    (fetchYahooSummary as ReturnType<typeof vi.fn>).mockResolvedValue(195);

    const [result] = await enrichStocks([makeStock()]);
    expect(result.allTimeHigh).toBe(195);
    expect(fetchYahooSummary).toHaveBeenCalledWith('AAPL');
  });

  it('enriches multiple stocks correctly', async () => {
    const profileMock = fetchFinnhubProfile as ReturnType<typeof vi.fn>;
    const metricMock = fetchFinnhubMetric as ReturnType<typeof vi.fn>;
    profileMock.mockReset();
    metricMock.mockReset();
    profileMock
      .mockResolvedValueOnce({ name: 'Apple Inc.', allTimeHigh: 200 })
      .mockResolvedValueOnce({ name: 'Tesla Inc.', allTimeHigh: 300 });
    metricMock.mockResolvedValueOnce({ forwardPE: 22 }).mockResolvedValueOnce({ forwardPE: 30 });

    const results = await enrichStocks([
      makeStock({ symbol: 'AAPL' }),
      makeStock({ symbol: 'TSLA' }),
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].name).toBe('Apple Inc.');
    expect(results[1].name).toBe('Tesla Inc.');
  });
});
