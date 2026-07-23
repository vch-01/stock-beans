import axios from 'axios';
import type { Stock } from '../../types';
import type { YahooQuote } from '../providerTypes';
import { enrichStockMetrics } from '../valuation';

const apiUrl = '/api/finance/v7/finance/quote';

const parseQuote = (quote: YahooQuote, symbol: string): Stock => {
  const price = Number(quote.regularMarketPrice ?? 0);
  const changePercent = Number(quote.regularMarketChangePercent ?? 0);
  const summaryDetail = quote.summaryDetail as YahooQuote['summaryDetail'] | undefined;
  const defaultKeyStatistics = quote.defaultKeyStatistics as Record<string, unknown> | undefined;
  const fiftyTwoWeekHigh = Number(
    quote.fiftyTwoWeekHigh ??
      quote['52WeekHigh'] ??
      (summaryDetail &&
        (summaryDetail.fiftyTwoWeekHigh as Record<string, unknown> | undefined)?.raw) ??
      summaryDetail?.fiftyTwoWeekHigh ??
      (defaultKeyStatistics &&
        (defaultKeyStatistics.fiftyTwoWeekHigh as Record<string, unknown> | undefined)?.raw) ??
      defaultKeyStatistics?.fiftyTwoWeekHigh ??
      0,
  );
  const forwardPE = Number(
    quote.forwardPE ??
      (quote.forwardPE as Record<string, unknown> | undefined)?.raw ??
      (summaryDetail && (summaryDetail.forwardPE as Record<string, unknown> | undefined)?.raw) ??
      summaryDetail?.forwardPE ??
      (defaultKeyStatistics &&
        (defaultKeyStatistics.forwardPE as Record<string, unknown> | undefined)?.raw) ??
      defaultKeyStatistics?.forwardPE ??
      0,
  );
  const allTimeHigh = Number(
    fiftyTwoWeekHigh || (quote.regularMarketDayHigh ?? quote.high ?? quote.highPrice ?? 0),
  );
  return enrichStockMetrics({
    symbol,
    name:
      (quote.longName as string | undefined) ??
      (quote.long_name as string | undefined) ??
      (quote.shortName as string | undefined) ??
      (quote.short_name as string | undefined) ??
      (quote.displayName as string | undefined) ??
      (quote.name as string | undefined) ??
      (quote.companyName as string | undefined) ??
      (quote.symbol as string | undefined) ??
      symbol,
    price,
    changePercent,
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
  });
};

const findQuote = (quotes: Record<string, unknown>[], normalized: string) => {
  return quotes.find(quote => String(quote.symbol).toUpperCase() === normalized.toUpperCase());
};

export const fetchYahooQuoteStock = async (symbol: string): Promise<Stock> => {
  const response = await axios.get(apiUrl, {
    params: { symbols: symbol },
  });

  const result = response.data?.quoteResponse?.result;
  if (!Array.isArray(result) || result.length === 0) {
    throw new Error(`Missing Yahoo quote for ${symbol}`);
  }

  return parseQuote(result[0], symbol);
};

export const fetchYahooQuoteBatch = async (symbols: string[]): Promise<Stock[]> => {
  const response = await axios.get(apiUrl, {
    params: { symbols: symbols.join(',') },
  });

  const result = response.data?.quoteResponse?.result;
  if (!Array.isArray(result)) {
    throw new Error(`Invalid quote response for symbols ${symbols.join(',')}`);
  }

  return symbols.map(symbol => {
    const quote = findQuote(result, symbol);
    if (!quote) {
      throw new Error(`Missing Yahoo quote for ${symbol}`);
    }
    return parseQuote(quote, symbol);
  });
};

export type YahooSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
};

export async function searchYahooSymbols(query: string): Promise<YahooSearchResult[]> {
  const response = await axios.get('/api/finance/v1/finance/search', {
    params: { q: query },
  });

  const quotes = response.data?.quotes;
  if (!Array.isArray(quotes)) return [];

  return quotes
    .filter((q: Record<string, unknown>) => q.typeDisp === 'Equity')
    .map((q: Record<string, unknown>) => ({
      symbol: String(q.symbol ?? ''),
      name: String(q.shortname ?? q.longname ?? q.symbol ?? ''),
      exchange: String(q.exchDisp ?? ''),
    }))
    .filter(r => r.symbol && r.name);
}

export const fetchYahooSummary = async (symbol: string): Promise<number | undefined> => {
  const response = await axios.get(`/api/finance/v10/finance/quoteSummary/${symbol}`, {
    params: { modules: 'summaryDetail' },
  });

  const result = response.data?.quoteSummary?.result;
  const summary = Array.isArray(result) ? result[0]?.summaryDetail : undefined;
  const high = Number(
    summary?.fiftyTwoWeekHigh?.raw ??
      summary?.fiftyTwoWeekHigh ??
      summary?.['52WeekHigh'] ??
      summary?.['52WeekHigh']?.raw ??
      Number.NaN,
  );
  return Number.isFinite(high) ? high : undefined;
};
