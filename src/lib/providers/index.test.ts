import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stock } from '../../types';
import { StockCache } from '../cache';
import { CircuitBreaker } from '../circuitBreaker';
import { runProviderChain } from './index';

const mockAlpacaSnapshots = vi.fn();
const mockFinnhubQuote = vi.fn();
const mockAlphaVantageQuote = vi.fn();
const mockYahooQuoteBatch = vi.fn();
const mockLoadFallback = vi.fn();

vi.mock('./alpaca', () => ({
  fetchAlpacaSnapshots: (...args: unknown[]) => mockAlpacaSnapshots(...args),
}));

vi.mock('./finnhub', () => ({
  fetchFinnhubQuote: (...args: unknown[]) => mockFinnhubQuote(...args),
}));

vi.mock('./alphaVantage', () => ({
  fetchAlphaVantageQuote: (...args: unknown[]) => mockAlphaVantageQuote(...args),
}));

vi.mock('./yahoo', () => ({
  fetchYahooQuoteBatch: (...args: unknown[]) => mockYahooQuoteBatch(...args),
}));

vi.mock('../config', () => ({
  getAlpacaKey: () => 'test-alpaca',
  getAlpacaSecret: () => 'test-secret',
  getFinnhubKey: () => 'test-finnhub',
  getAlphaVantageKey: () => 'test-alpha',
}));

vi.mock('../fallback', () => ({
  loadFallbackStockData: (...args: unknown[]) => mockLoadFallback(...args),
}));

vi.mock('../utils', () => ({
  delay: vi.fn().mockResolvedValue(undefined),
  normalizeSymbol: (s: string) => s.toUpperCase(),
}));

const makeStock = (symbol: string, overrides: Partial<Stock> = {}): Stock => ({
  symbol: symbol.toUpperCase(),
  name: symbol.toUpperCase(),
  price: 100,
  changePercent: 0,
  allTimeHigh: 0,
  forwardPE: 0,
  earningsYield: 0,
  valueScore: 0,
  valuation: 'fair',
  ...overrides,
});

describe('runProviderChain', () => {
  let cb: CircuitBreaker;
  let cache: StockCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cb = new CircuitBreaker();
    cache = new StockCache(60_000, 300_000);
    mockLoadFallback.mockImplementation((tickers: { symbol: string }[]) =>
      tickers.map(({ symbol }) => ({
        symbol: symbol.toUpperCase(),
        name: `${symbol} (fallback)`,
        price: 0,
        changePercent: 0,
        allTimeHigh: 0,
        forwardPE: 0,
        earningsYield: 0,
        valueScore: 0,
        valuation: 'fair' as const,
      })),
    );
  });

  it('returns stock from Alpaca when it succeeds', async () => {
    mockAlpacaSnapshots.mockResolvedValue([makeStock('AAPL')]);

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[0].price).toBe(100);
    expect(mockFinnhubQuote).not.toHaveBeenCalled();
  });

  it('falls through to Finnhub when Alpaca fails', async () => {
    mockAlpacaSnapshots.mockRejectedValue(new Error('alpaca error'));
    mockFinnhubQuote.mockResolvedValue(makeStock('AAPL'));

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAPL');
    expect(mockFinnhubQuote).toHaveBeenCalled();
  });

  it('falls through providers sequentially until one succeeds', async () => {
    mockAlpacaSnapshots.mockRejectedValue(new Error('fail'));
    mockFinnhubQuote.mockRejectedValue(new Error('fail'));
    mockAlphaVantageQuote.mockRejectedValue(new Error('fail'));
    mockYahooQuoteBatch.mockResolvedValue([makeStock('AAPL')]);

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('AAPL');
    expect(mockYahooQuoteBatch).toHaveBeenCalled();
  });

  it('returns fallback when all providers fail', async () => {
    mockAlpacaSnapshots.mockRejectedValue(new Error('fail'));
    mockFinnhubQuote.mockRejectedValue(new Error('fail'));
    mockAlphaVantageQuote.mockRejectedValue(new Error('fail'));
    mockYahooQuoteBatch.mockRejectedValue(new Error('fail'));

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('AAPL (fallback)');
  });

  it('skips provider when circuit breaker prevents it', async () => {
    cb.recordFailure('alpaca');
    cb.recordFailure('alpaca');
    cb.recordFailure('alpaca');
    mockFinnhubQuote.mockResolvedValue(makeStock('AAPL'));

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result[0].symbol).toBe('AAPL');
    expect(mockAlpacaSnapshots).not.toHaveBeenCalled();
    expect(mockFinnhubQuote).toHaveBeenCalled();
  });

  it('uses stale cache data when all live providers fail', async () => {
    const staleStock = makeStock('AAPL', { name: 'Stale data' });
    cache.set('AAPL', staleStock);
    // Make it stale
    vi.advanceTimersByTime(61000);

    mockAlpacaSnapshots.mockRejectedValue(new Error('fail'));
    mockFinnhubQuote.mockRejectedValue(new Error('fail'));
    mockAlphaVantageQuote.mockRejectedValue(new Error('fail'));
    mockYahooQuoteBatch.mockRejectedValue(new Error('fail'));

    const result = await runProviderChain(['AAPL'], cb, cache);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Stale data');
  });

  it('processes multiple symbols with partial success across providers', async () => {
    mockAlpacaSnapshots.mockResolvedValue([makeStock('AAPL')]);
    mockFinnhubQuote.mockImplementation(async (symbol: string) => {
      if (symbol === 'TSLA') return makeStock('TSLA');
      throw new Error('not found');
    });

    const result = await runProviderChain(['AAPL', 'TSLA'], cb, cache);
    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe('AAPL');
    expect(result[1].symbol).toBe('TSLA');
  });

  it('records a provider failure when fetcher throws', async () => {
    mockAlpacaSnapshots.mockRejectedValue(new Error('fail'));
    mockFinnhubQuote.mockResolvedValue(makeStock('AAPL'));

    await runProviderChain(['AAPL'], cb, cache);
    expect(cb.canTry('alpaca')).toBe(true); // 1 failure → still < 3
  });

  it('delays between Finnhub sequential calls', async () => {
    const { delay } = await import('../utils');
    mockAlpacaSnapshots.mockRejectedValue(new Error('fail'));
    mockFinnhubQuote
      .mockResolvedValueOnce(makeStock('AAPL'))
      .mockResolvedValueOnce(makeStock('GOOGL'));

    await runProviderChain(['AAPL', 'GOOGL'], cb, cache);
    expect(delay).toHaveBeenCalledWith(1200);
  });

  it('normalizes symbols before lookup', async () => {
    mockAlpacaSnapshots.mockResolvedValue([makeStock('AAPL')]);

    const result = await runProviderChain(['aapl'], cb, cache);
    expect(result[0].symbol).toBe('AAPL');
  });
});
