import type { Stock } from '../../types';
import type { ProviderName } from '../circuitBreaker';
import type { CircuitBreaker } from '../circuitBreaker';
import type { StockCache } from '../cache';
import { fetchAlpacaSnapshots } from './alpaca';
import { fetchFinnhubQuote } from './finnhub';
import { fetchAlphaVantageQuote } from './alphaVantage';
import { fetchYahooQuoteBatch } from './yahoo';
import { getAlpacaKey, getFinnhubKey, getAlphaVantageKey } from '../config';
import { delay, normalizeSymbol } from '../utils';
import { loadFallbackStockData } from '../fallback';

export type QuoteResult = {
  stock: Stock;
  fromProvider: ProviderName;
};

function isProviderConfigured(provider: ProviderName): boolean {
  switch (provider) {
    case 'alpaca':
      return Boolean(getAlpacaKey());
    case 'finnhub':
      return Boolean(getFinnhubKey());
    case 'alphaVantage':
      return Boolean(getAlphaVantageKey());
    case 'yahoo':
      return true;
  }
}

async function fetchFromProvider(
  symbols: string[],
  fetcher: (symbols: string[]) => Promise<Stock[]>,
  provider: ProviderName,
  circuitBreaker: CircuitBreaker,
): Promise<Map<string, QuoteResult>> {
  if (!isProviderConfigured(provider)) return new Map();
  if (!circuitBreaker.canTry(provider)) return new Map();

  try {
    const stocks = await fetcher(symbols.map(s => normalizeSymbol(s)));
    circuitBreaker.recordSuccess(provider);
    const map = new Map<string, QuoteResult>();
    for (const stock of stocks) {
      map.set(normalizeSymbol(stock.symbol), { stock, fromProvider: provider });
    }
    return map;
  } catch {
    circuitBreaker.recordFailure(provider);
    return new Map();
  }
}

async function fetchFromProviderSingle(
  symbol: string,
  fetcher: (symbol: string) => Promise<Stock>,
  provider: ProviderName,
  circuitBreaker: CircuitBreaker,
): Promise<QuoteResult | null> {
  if (!isProviderConfigured(provider)) return null;
  if (!circuitBreaker.canTry(provider)) return null;

  try {
    const stock = await fetcher(symbol);
    circuitBreaker.recordSuccess(provider);
    return { stock, fromProvider: provider };
  } catch {
    circuitBreaker.recordFailure(provider);
    return null;
  }
}

export async function runProviderChain(
  symbols: string[],
  circuitBreaker: CircuitBreaker,
  cache: StockCache,
): Promise<Stock[]> {
  const normalized = symbols.map(s => normalizeSymbol(s));
  const results = new Map<string, QuoteResult>();
  const remaining = new Set(normalized);

  const alpacaResults = await fetchFromProvider(
    normalized,
    fetchAlpacaSnapshots,
    'alpaca',
    circuitBreaker,
  );
  for (const [symbol, result] of alpacaResults) {
    results.set(symbol, result);
    remaining.delete(symbol);
  }

  if (remaining.size > 0) {
    const symbolsLeft = [...remaining];
    for (let i = 0; i < symbolsLeft.length; i += 1) {
      const symbol = symbolsLeft[i];
      const result = await fetchFromProviderSingle(
        symbol,
        fetchFinnhubQuote,
        'finnhub',
        circuitBreaker,
      );
      if (result) {
        results.set(symbol, result);
        remaining.delete(symbol);
      }
      if (i < symbolsLeft.length - 1) {
        await delay(1200);
      }
    }
  }

  if (remaining.size > 0) {
    const symbolsLeft = [...remaining];
    for (let i = 0; i < symbolsLeft.length; i += 1) {
      const symbol = symbolsLeft[i];
      const result = await fetchFromProviderSingle(
        symbol,
        fetchAlphaVantageQuote,
        'alphaVantage',
        circuitBreaker,
      );
      if (result) {
        results.set(symbol, result);
        remaining.delete(symbol);
      }
      if (i < symbolsLeft.length - 1) {
        await delay(14000);
      }
    }
  }

  if (remaining.size > 0) {
    const symbolsLeft = [...remaining];
    const yahooResults = await fetchFromProvider(
      symbolsLeft,
      fetchYahooQuoteBatch,
      'yahoo',
      circuitBreaker,
    );
    for (const [symbol, result] of yahooResults) {
      results.set(symbol, result);
      remaining.delete(symbol);
    }
  }

  for (const symbol of remaining) {
    const cached = cache.get(symbol);
    if (cached.isStale && cached.data) {
      results.set(symbol, { stock: cached.data, fromProvider: 'yahoo' });
      remaining.delete(symbol);
    }
  }

  const finalStocks = normalized.map(symbol => {
    const result = results.get(symbol);
    if (result) return result.stock;

    const fallback = loadFallbackStockData([{ symbol }]);
    return fallback[0];
  });

  return finalStocks;
}
