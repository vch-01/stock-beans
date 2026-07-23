import { describe, expect, it, vi } from 'vitest';
import { delay, delayWithJitter, mapConcurrent, normalizeSymbol, processInBatches } from './utils';

describe('utils', () => {
  describe('normalizeSymbol', () => {
    it('converts to uppercase', () => {
      expect(normalizeSymbol('aapl')).toBe('AAPL');
      expect(normalizeSymbol('Shop')).toBe('SHOP');
      expect(normalizeSymbol('AAPL')).toBe('AAPL');
    });
  });

  describe('delay', () => {
    it('resolves after given ms', async () => {
      vi.useFakeTimers();
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('delayWithJitter', () => {
    it('resolves after base delay plus jitter', async () => {
      vi.useFakeTimers();
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const promise = delayWithJitter(100);
      vi.advanceTimersByTime(200);
      await expect(promise).resolves.toBeUndefined();
      vi.useRealTimers();
    });
  });

  describe('mapConcurrent', () => {
    it('runs all items with limited concurrency', async () => {
      const results = await mapConcurrent([1, 2, 3], async n => n * 2, 2);
      expect(results).toEqual([2, 4, 6]);
    });

    it('handles empty input', async () => {
      const results = await mapConcurrent([], async n => n, 2);
      expect(results).toEqual([]);
    });

    it('preserves order', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      const results = await mapConcurrent(
        [3, 1, 2],
        async n => {
          await delay(n * 10);
          return n;
        },
        3,
      );
      expect(results).toEqual([3, 1, 2]);
    });
  });

  describe('processInBatches', () => {
    it('processes items in batches of given size', async () => {
      const fn = vi.fn().mockImplementation(async (x: number) => x);
      const results = await processInBatches([1, 2, 3, 4], fn, 2, 0);
      expect(results).toEqual([1, 2, 3, 4]);
    });

    it('processes batches sequentially with delay between them', async () => {
      const start = Date.now();
      const fn = vi.fn().mockImplementation(async (x: number) => {
        return x;
      });
      const results = await processInBatches([1, 2, 3], fn, 2, 50);
      expect(results).toEqual([1, 2, 3]);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(50);
    });

    it('does not delay after last batch', async () => {
      const fn = vi.fn().mockImplementation(async (x: number) => x);
      const results = await processInBatches([1, 2], fn, 2, 100);
      expect(results).toEqual([1, 2]);
    });
  });
});
