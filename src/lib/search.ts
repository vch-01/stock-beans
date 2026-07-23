import { searchFinnhubSymbols } from './providers/finnhub';
import { searchYahooSymbols } from './providers/yahoo';

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
};

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (query.length < 2) return [];

  try {
    const yahooResults = await searchYahooSymbols(query);
    if (yahooResults.length > 0) return yahooResults.slice(0, 10);
  } catch {
    // Yahoo failed, fall through to Finnhub
  }

  try {
    const finnhubResults = await searchFinnhubSymbols(query);
    if (finnhubResults.length > 0) return finnhubResults.slice(0, 10);
  } catch {
    // Both failed
  }

  return [];
}
