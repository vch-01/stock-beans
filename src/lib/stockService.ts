import type { Stock } from '../types';
import { StockCache } from './cache';
import { CircuitBreaker } from './circuitBreaker';
import { enrichStocks } from './enrichment';
import { loadFallbackStockData } from './fallback';
import { runProviderChain } from './providers/index';
import { normalizeSymbol } from './utils';
import { enrichStockMetrics } from './valuation';

export const defaultTickers = [{ symbol: 'AAPL' }, { symbol: 'TSLA' }];

const cache = new StockCache();
const enrichmentCache = new StockCache(60 * 60 * 1000, 2 * 60 * 60 * 1000);
const circuitBreaker = new CircuitBreaker();

export const resetServiceState = () => {
  cache.invalidate();
  enrichmentCache.invalidate();
};

export const scoreToValuation = (score: number): Stock['valuation'] => {
  if (score > 10) return 'overvalued';
  if (score >= 0) return 'fair';
  return 'undervalued';
};

function needsEnrichment(stock: Stock): boolean {
  return stock.name === stock.symbol || stock.allTimeHigh === 0 || stock.forwardPE === 0;
}

export const fetchStocksData = async (
  tickers: { symbol: string }[],
): Promise<{ stocks: Stock[]; fallbackUsed: boolean }> => {
  const normalizedTickers = tickers.map(({ symbol }) => ({
    symbol: normalizeSymbol(symbol),
  }));

  try {
    const stocks = await runProviderChain(
      normalizedTickers.map(t => t.symbol),
      circuitBreaker,
      cache,
    );

    const stocksToEnrich: { stock: Stock; index: number }[] = [];
    const enriched: Stock[] = new Array(stocks.length);

    for (let i = 0; i < stocks.length; i += 1) {
      const stock = stocks[i];

      if (!needsEnrichment(stock)) {
        enriched[i] = enrichStockMetrics(stock);
        continue;
      }

      const cachedEnrichment = enrichmentCache.get(stock.symbol);
      if (
        cachedEnrichment.data &&
        cachedEnrichment.data.name !== cachedEnrichment.data.symbol &&
        cachedEnrichment.data.allTimeHigh > 0 &&
        cachedEnrichment.data.forwardPE > 0
      ) {
        enriched[i] = enrichStockMetrics({
          ...stock,
          name: cachedEnrichment.data.name,
          allTimeHigh: cachedEnrichment.data.allTimeHigh,
          forwardPE: cachedEnrichment.data.forwardPE,
        });
        continue;
      }

      stocksToEnrich.push({ stock, index: i });
    }

    if (stocksToEnrich.length > 0) {
      const enrichedResults = await enrichStocks(stocksToEnrich.map(e => e.stock));

      for (let j = 0; j < stocksToEnrich.length; j += 1) {
        const { index } = stocksToEnrich[j];
        const result = enrichedResults[j];
        enriched[index] = result;

        if (result.allTimeHigh > 0 && result.forwardPE > 0 && result.name !== result.symbol) {
          enrichmentCache.set(result.symbol, result);
          cache.set(result.symbol, result);
        }
      }
    }

    const fallbackUsed = enriched.some(s => s.price === 0 && s.changePercent === 0);
    return { stocks: enriched, fallbackUsed };
  } catch {
    return { stocks: loadFallbackStockData(normalizedTickers), fallbackUsed: true };
  }
};
