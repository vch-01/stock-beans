import axios from 'axios';
import type { Stock } from '../../types';
import { getFinnhubKey } from '../config';
import type { FinnhubQuote } from '../providerTypes';
import { normalizeSymbol } from '../utils';
import { enrichStockMetrics } from '../valuation';

export const getFinnhubSymbol = (symbol: string) => normalizeSymbol(symbol);

const parseFinnhubQuote = (quote: FinnhubQuote, symbol: string): Stock => {
  const price = Number(quote.c ?? 0);
  const changePercent = Number(quote.dp ?? 0);
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

export const fetchFinnhubQuote = async (symbol: string): Promise<Stock> => {
  const apiKey = getFinnhubKey();
  if (!apiKey) {
    throw new Error('Finnhub API key is not configured');
  }

  const providerSymbol = getFinnhubSymbol(symbol);
  const response = await axios.get('/api/finnhub/v1/quote', {
    params: {
      symbol: providerSymbol,
      token: apiKey,
    },
  });

  const quote = response.data;
  if (!quote || quote.c == null || quote.c === 0) {
    throw new Error(`Invalid Finnhub quote for ${symbol}`);
  }

  return parseFinnhubQuote(quote, symbol);
};

export const fetchFinnhubProfile = async (
  symbol: string,
): Promise<{ name?: string; allTimeHigh?: number } | undefined> => {
  const apiKey = getFinnhubKey();
  if (!apiKey) return undefined;

  const response = await axios.get('/api/finnhub/v1/stock/profile2', {
    params: {
      symbol,
      token: apiKey,
    },
  });

  const profile = response.data || {};
  const name = profile?.name ?? profile?.displayName ?? profile?.companyName;
  const possibleHigh = Number(
    profile?.fiftyTwoWeekHigh ?? profile?.['52WeekHigh'] ?? profile?.high52 ?? Number.NaN,
  );
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined;
  return { name: typeof name === 'string' && name ? name : undefined, allTimeHigh };
};

export const fetchFinnhubMetric = async (
  symbol: string,
): Promise<{ allTimeHigh?: number; forwardPE?: number } | undefined> => {
  const apiKey = getFinnhubKey();
  if (!apiKey) return undefined;

  const response = await axios.get('/api/finnhub/v1/stock/metric', {
    params: {
      symbol,
      metric: 'all',
      token: apiKey,
    },
  });

  const metric = response.data?.metric || {};
  const possibleHigh = Number(
    metric?.['52WeekHigh'] ??
      metric?.['52WeekHigh']?.raw ??
      metric?.yearHigh ??
      metric?.['52WeekHighLow'] ??
      Number.NaN,
  );
  const forwardPE = Number(metric?.forwardPE ?? metric?.forwardPE ?? Number.NaN);
  const allTimeHigh = Number.isFinite(possibleHigh) ? possibleHigh : undefined;
  return {
    allTimeHigh,
    forwardPE: Number.isFinite(forwardPE) ? forwardPE : undefined,
  };
};
