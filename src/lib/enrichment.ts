import type { Stock } from '../types';
import { getFinnhubKey, getAlphaVantageKey } from './config';
import { fetchFinnhubProfile, fetchFinnhubMetric } from './providers/finnhub';
import { fetchAlphaVantageOverview } from './providers/alphaVantage';
import { fetchYahooQuoteStock, fetchYahooSummary } from './providers/yahoo';
import { processInBatches } from './utils';
import { enrichStockMetrics } from './valuation';

async function enrichFromFinnhub(stock: Stock): Promise<Partial<Stock>> {
  const updates: Partial<Stock> = {};
  if (!getFinnhubKey()) return updates;

  try {
    if (stock.name === stock.symbol) {
      const info = await fetchFinnhubProfile(stock.symbol);
      if (info?.name) updates.name = info.name;
      if (typeof info?.allTimeHigh === 'number' && stock.allTimeHigh === 0)
        updates.allTimeHigh = info.allTimeHigh;
    }

    if (stock.allTimeHigh === 0 || stock.forwardPE === 0) {
      const metricInfo = await fetchFinnhubMetric(stock.symbol);
      if (typeof metricInfo?.allTimeHigh === 'number' && metricInfo.allTimeHigh > 0) {
        updates.allTimeHigh = metricInfo.allTimeHigh;
      }
      if (typeof metricInfo?.forwardPE === 'number' && metricInfo.forwardPE > 0) {
        updates.forwardPE = metricInfo.forwardPE;
      }
    }
  } catch {
    // ignore Finnhub enrichment failures
  }

  return updates;
}

async function enrichFromAlphaVantage(stock: Stock): Promise<Partial<Stock>> {
  const updates: Partial<Stock> = {};
  if (!getAlphaVantageKey()) return updates;

  try {
    const info = await fetchAlphaVantageOverview(stock.symbol);
    if (info) {
      if (stock.name === stock.symbol && info.name) updates.name = info.name;
      if (typeof info?.allTimeHigh === 'number' && stock.allTimeHigh === 0)
        updates.allTimeHigh = info.allTimeHigh;
      if (typeof info?.forwardPE === 'number' && stock.forwardPE === 0)
        updates.forwardPE = info.forwardPE;
    }
  } catch {
    // ignore Alpha Vantage enrichment failures
  }

  return updates;
}

async function enrichFromYahoo(stock: Stock): Promise<Partial<Stock>> {
  const updates: Partial<Stock> = {};

  try {
    const yahooStock = await fetchYahooQuoteStock(stock.symbol);
    if (stock.name === stock.symbol && yahooStock.name && yahooStock.name !== yahooStock.symbol) {
      updates.name = yahooStock.name;
    }
    if (typeof yahooStock.allTimeHigh === 'number' && yahooStock.allTimeHigh > 0) {
      updates.allTimeHigh = yahooStock.allTimeHigh;
    }

    if (!updates.allTimeHigh || updates.allTimeHigh === 0) {
      const summaryHigh = await fetchYahooSummary(stock.symbol);
      if (typeof summaryHigh === 'number' && summaryHigh > 0) {
        updates.allTimeHigh = summaryHigh;
      }
    }
  } catch {
    // ignore Yahoo enrichment failures
  }

  return updates;
}

async function enrichStock(stock: Stock): Promise<Stock> {
  if (stock.name !== stock.symbol && stock.allTimeHigh > 0 && stock.forwardPE > 0) {
    return enrichStockMetrics(stock);
  }

  let updated: Stock = stock;

  const finnhubUpdates = await enrichFromFinnhub(stock);
  if (Object.keys(finnhubUpdates).length > 0) {
    updated = { ...updated, ...finnhubUpdates };
  }

  const avUpdates = await enrichFromAlphaVantage(updated);
  if (Object.keys(avUpdates).length > 0) {
    updated = { ...updated, ...avUpdates };
  }

  if (updated.allTimeHigh === 0 || updated.name === updated.symbol) {
    const yahooUpdates = await enrichFromYahoo(updated);
    if (Object.keys(yahooUpdates).length > 0) {
      updated = { ...updated, ...yahooUpdates };
    }
  }

  return enrichStockMetrics(updated);
}

export async function enrichStocks(stocks: Stock[]): Promise<Stock[]> {
  return processInBatches(stocks, enrichStock, 2, 1200);
}
