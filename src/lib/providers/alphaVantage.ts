import axios from 'axios';
import type { Stock } from '../../types';
import { getAlphaVantageKey } from '../config';
import type { AlphaVantageQuote, AlphaVantageResponse } from '../providerTypes';
import { enrichStockMetrics } from '../valuation';

const isAlphaVantageDataError = (data: AlphaVantageResponse | undefined) => {
  return Boolean((data && (data['Error Message'] || data.Note || data.Information)) ?? false);
};

const parseAlphaVantageQuote = (quote: AlphaVantageQuote, symbol: string): Stock => {
  const price = Number(quote['05. price'] ?? 0);
  const rawChange = String(quote['10. change percent'] ?? '0').replace('%', '');
  const changePercent = Number(rawChange);
  return enrichStockMetrics({
    symbol,
    name: symbol,
    price,
    changePercent,
    allTimeHigh: 0,
    forwardPE: 0,
    earningsYield: 0,
    valueScore: 0,
    valuation: 'fair',
  });
};

export const fetchAlphaVantageQuote = async (symbol: string): Promise<Stock> => {
  const apiKey = getAlphaVantageKey();
  if (!apiKey) {
    throw new Error('AlphaVantage API key is not configured');
  }

  const response = await axios.get('/api/alpha/query', {
    params: {
      function: 'GLOBAL_QUOTE',
      symbol,
      apikey: apiKey,
    },
  });

  const data = response.data;
  if (isAlphaVantageDataError(data)) {
    throw new Error(data['Error Message'] || data.Note || data.Information);
  }

  const quote = data?.['Global Quote'];
  if (!quote || !quote['05. price']) {
    throw new Error(`Invalid AlphaVantage quote for ${symbol}`);
  }

  return parseAlphaVantageQuote(quote, symbol);
};

export const fetchAlphaVantageOverview = async (
  symbol: string,
): Promise<{ name?: string; allTimeHigh?: number; forwardPE?: number } | undefined> => {
  const apiKey = getAlphaVantageKey();
  if (!apiKey) return undefined;

  const response = await axios.get('/api/alpha/query', {
    params: {
      function: 'OVERVIEW',
      symbol,
      apikey: apiKey,
    },
  });

  const data = response.data || {};
  const name = data?.Name ?? data?.name;
  const possibleHigh = Number(
    data?.['52WeekHigh'] ?? data?.['52_WeekHigh'] ?? data?.['52WeekHighLow'] ?? Number.NaN,
  );
  const forwardPE = Number(data?.ForwardPE ?? data?.forwardPE ?? Number.NaN);
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined;
  return {
    name: typeof name === 'string' && name ? name : undefined,
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : undefined,
  };
};
