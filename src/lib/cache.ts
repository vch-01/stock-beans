import type { Stock } from '../types';

interface CacheEntry {
  stock: Stock;
  fetchedAt: number;
}

export class StockCache {
  private store = new Map<string, CacheEntry>();
  private pending = new Map<string, Promise<Stock | null>>();
  private ttl: number;
  private maxStale: number;

  constructor(ttl = 60_000, maxStale = 300_000) {
    this.ttl = ttl;
    this.maxStale = maxStale;
  }

  get(symbol: string): { data: Stock | null; isFresh: boolean; isStale: boolean } {
    const entry = this.store.get(symbol);
    if (!entry) {
      return { data: null, isFresh: false, isStale: false };
    }

    const age = Date.now() - entry.fetchedAt;
    if (age < this.ttl) {
      return { data: entry.stock, isFresh: true, isStale: false };
    }

    if (age < this.maxStale) {
      return { data: entry.stock, isFresh: false, isStale: true };
    }

    this.store.delete(symbol);
    return { data: null, isFresh: false, isStale: false };
  }

  set(symbol: string, stock: Stock): void {
    this.store.set(symbol, { stock, fetchedAt: Date.now() });
  }

  invalidate(): void {
    this.store.clear();
    this.pending.clear();
  }

  async getOrFetch(symbol: string, fetcher: () => Promise<Stock | null>): Promise<Stock | null> {
    const cached = this.get(symbol);
    if (cached.isFresh && cached.data) {
      return cached.data;
    }

    const existing = this.pending.get(symbol);
    if (existing) {
      const result = await existing;
      if (result) return result;
      if (cached.isStale && cached.data) {
        return cached.data;
      }
      return null;
    }

    const promise = fetcher()
      .then(result => {
        this.pending.delete(symbol);
        if (result) {
          this.set(symbol, result);
        }
        return result;
      })
      .catch(() => {
        this.pending.delete(symbol);
        const cached = this.get(symbol);
        return cached.isStale && cached.data ? cached.data : null;
      });

    this.pending.set(symbol, promise);
    return promise;
  }
}
