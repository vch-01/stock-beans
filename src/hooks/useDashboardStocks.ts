import { useState, useEffect, useCallback, useRef } from 'react';
import type { Stock } from '../types';
import { fetchStocksData, defaultTickers } from '../lib/stockService';
import { normalizeSymbol } from '../lib/utils';
import { StockWebSocket } from '../lib/wsService';
import { getAlpacaKey } from '../lib/config';

export function useDashboardStocks() {
  const [tickers, setTickers] = useState<Array<{ symbol: string }>>(defaultTickers);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<StockWebSocket | null>(null);

  const hasLiveProvider = Boolean(getAlpacaKey());

  const loadStocks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { stocks: results, fallbackUsed } = await fetchStocksData(tickers);
      setStocks(results);

      if (wsRef.current) {
        for (const stock of results) {
          if (stock.price > 0) {
            wsRef.current.setPreviousClose(
              stock.symbol,
              stock.price - (stock.price * stock.changePercent) / 100,
            );
          }
        }
      }

      if (fallbackUsed) {
        setError(
          hasLiveProvider
            ? 'Some stock data could not be loaded; showing fallback values.'
            : 'No live stock provider configured. Set VITE_ALPACA_API_KEY or VITE_FINNHUB_API_KEY in .env for live data.',
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        'Unable to load stock data. Please try refreshing or check your network connection.',
      );
    } finally {
      setLoading(false);
    }
  }, [tickers, hasLiveProvider]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadStocks();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  useEffect(() => {
    const ws = new StockWebSocket();
    wsRef.current = ws;

    const unsubStatus = ws.onStatusChange(setWsConnected);
    const unsubTrade = ws.onTrade((symbol, price, changePercent) => {
      setStocks(prev => prev.map(s => (s.symbol === symbol ? { ...s, price, changePercent } : s)));
    });

    ws.connect();
    ws.subscribe(tickers.map(t => t.symbol));

    return () => {
      unsubTrade();
      unsubStatus();
      ws.disconnect();
    };
  }, [tickers]);

  const addStock = useCallback((symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return 'Symbol is required';

    setTickers(prev => {
      if (prev.some(t => t.symbol === normalized)) {
        return prev;
      }
      return [...prev, { symbol: normalized }];
    });
    return null;
  }, []);

  const removeStock = useCallback((symbol: string) => {
    setTickers(prev => prev.filter(t => t.symbol !== symbol));
  }, []);

  const refresh = useCallback(() => {
    void loadStocks();
  }, [loadStocks]);

  return {
    stocks,
    loading,
    error,
    wsConnected,
    hasLiveProvider,
    addStock,
    removeStock,
    refresh,
  };
}
