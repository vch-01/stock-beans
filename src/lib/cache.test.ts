import { describe, expect, it, vi, beforeEach } from 'vitest';
import { StockCache } from './cache';
import type { Stock } from '../types';

const makeStock = (symbol: string): Stock => ({
  symbol,
  name: symbol,
  price: 100,
  changePercent: 0,
  allTimeHigh: 200,
  forwardPE: 10,
  earningsYield: 10,
  valueScore: 70,
  valuation: 'fair',
});

describe('StockCache', () => {
  let cache: StockCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new StockCache(1000, 5000);
  });

  it('returns null for missing symbol', () => {
    const result = cache.get('AAPL');
    expect(result.data).toBeNull();
    expect(result.isFresh).toBe(false);
    expect(result.isStale).toBe(false);
  });

  it('returns fresh data within TTL', () => {
    cache.set('AAPL', makeStock('AAPL'));
    const result = cache.get('AAPL');
    expect(result.data).toEqual(makeStock('AAPL'));
    expect(result.isFresh).toBe(true);
    expect(result.isStale).toBe(false);
  });

  it('returns stale data after TTL but before maxStale', () => {
    cache.set('AAPL', makeStock('AAPL'));
    vi.advanceTimersByTime(1500);
    const result = cache.get('AAPL');
    expect(result.data).toEqual(makeStock('AAPL'));
    expect(result.isFresh).toBe(false);
    expect(result.isStale).toBe(true);
  });

  it('returns null after maxStale and deletes entry', () => {
    cache.set('AAPL', makeStock('AAPL'));
    vi.advanceTimersByTime(6000);
    const result = cache.get('AAPL');
    expect(result.data).toBeNull();
    expect(result.isFresh).toBe(false);
    expect(result.isStale).toBe(false);
  });

  it('invalidate clears all entries', () => {
    cache.set('AAPL', makeStock('AAPL'));
    cache.set('TSLA', makeStock('TSLA'));
    cache.invalidate();
    expect(cache.get('AAPL').data).toBeNull();
    expect(cache.get('TSLA').data).toBeNull();
  });

  it('getOrFetch returns fresh cached data without calling fetcher', async () => {
    cache.set('AAPL', makeStock('AAPL'));
    const fetcher = vi.fn().mockResolvedValue(makeStock('AAPL-new'));
    const result = await cache.getOrFetch('AAPL', fetcher);
    expect(result).toEqual(makeStock('AAPL'));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('getOrFetch calls fetcher when no cache exists', async () => {
    const stock = makeStock('AAPL');
    const fetcher = vi.fn().mockResolvedValue(stock);
    const result = await cache.getOrFetch('AAPL', fetcher);
    expect(result).toEqual(stock);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('getOrFetch caches the result after successful fetch', async () => {
    const stock = makeStock('AAPL');
    const fetcher = vi.fn().mockResolvedValue(stock);
    await cache.getOrFetch('AAPL', fetcher);
    const cached = cache.get('AAPL');
    expect(cached.data).toEqual(stock);
    expect(cached.isFresh).toBe(true);
  });

  it('getOrFetch does not cache null results', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    await cache.getOrFetch('AAPL', fetcher);
    expect(cache.get('AAPL').data).toBeNull();
  });

  it('getOrFetch returns null when fetcher returns null', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    const result = await cache.getOrFetch('AAPL', fetcher);
    expect(result).toBeNull();
  });

  it('getOrFetch deduplicates concurrent calls', async () => {
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      callCount += 1;
      return makeStock('AAPL');
    });
    const [r1, r2] = await Promise.all([
      cache.getOrFetch('AAPL', fetcher),
      cache.getOrFetch('AAPL', fetcher),
    ]);
    expect(r1).toEqual(makeStock('AAPL'));
    expect(r2).toEqual(makeStock('AAPL'));
    expect(callCount).toBe(1);
  });

  it('getOrFetch returns stale data when fetcher fails', async () => {
    cache.set('AAPL', makeStock('AAPL'));
    vi.advanceTimersByTime(1500);
    const fetcher = vi.fn().mockRejectedValue(new Error('network'));
    const result = await cache.getOrFetch('AAPL', fetcher);
    expect(result).toEqual(makeStock('AAPL'));
  });

  it('getOrFetch returns null when fetcher fails and no stale data', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network'));
    const result = await cache.getOrFetch('AAPL', fetcher);
    expect(result).toBeNull();
  });
});
