import axios from 'axios';
import type { Stock } from '../../types';
import { getAlpacaKey, getAlpacaSecret } from '../config';
import type { AlpacaSnapshot, AlpacaSnapshotsResponse } from '../providerTypes';
import { enrichStockMetrics } from '../valuation';

const parseAlpacaSnapshot = (snapshot: AlpacaSnapshot, symbol: string): Stock => {
  const price = snapshot.latestTrade?.p ?? snapshot.dailyBar?.c ?? 0;
  const prevClose = snapshot.prevDailyBar?.c ?? 0;
  const changePercent = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

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

export const fetchAlpacaSnapshots = async (symbols: string[]): Promise<Stock[]> => {
  const apiKey = getAlpacaKey();
  const secretKey = getAlpacaSecret();

  if (!apiKey || !secretKey) {
    throw new Error('Alpaca API key is not configured');
  }

  const response = await axios.get('/api/alpaca/v2/stocks/snapshots', {
    params: { symbols: symbols.join(',') },
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': secretKey,
    },
  });

  const data = response.data as AlpacaSnapshotsResponse;

  return symbols.map(symbol => {
    const snapshot = data[symbol];
    if (!snapshot) {
      throw new Error(`Missing Alpaca snapshot for ${symbol}`);
    }
    return parseAlpacaSnapshot(snapshot, symbol);
  });
};
