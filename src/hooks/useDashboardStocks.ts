import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { getAlpacaKey } from '../lib/config';
import { defaultTickers, fetchStocksData } from '../lib/stockService';
import { normalizeSymbol } from '../lib/utils';
import { StockWebSocket } from '../lib/wsService';
import type { Stock } from '../types';

export function useDashboardStocks() {
  const [tickers, setTickers] = createSignal<Array<{ symbol: string }>>(defaultTickers);
  const [stocks, setStocks] = createSignal<Stock[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [wsConnected, setWsConnected] = createSignal(false);

  const hasLiveProvider = Boolean(getAlpacaKey());

  const loadStocks = async (currentTickers: Array<{ symbol: string }>) => {
    setLoading(true);
    setError(null);

    try {
      const { stocks: results, fallbackUsed } = await fetchStocksData(currentTickers);

      setStocks(results);

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
  };

  createEffect(() => {
    const currentTickers = tickers();
    queueMicrotask(() => {
      void loadStocks(currentTickers);
    });
  });

  onMount(() => {
    const ws = new StockWebSocket();

    const unsubStatus = ws.onStatusChange(setWsConnected);
    const unsubTrade = ws.onTrade((symbol, price, changePercent) => {
      setStocks(prev => prev.map(s => (s.symbol === symbol ? { ...s, price, changePercent } : s)));
    });

    ws.connect();
    ws.subscribe(tickers().map(t => t.symbol));

    onCleanup(() => {
      unsubTrade();
      unsubStatus();
      ws.disconnect();
    });
  });

  const addStock = (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return 'Symbol is required';

    setTickers(prev => {
      if (prev.some(t => t.symbol === normalized)) {
        return prev;
      }
      return [...prev, { symbol: normalized }];
    });
    return null;
  };

  const removeStock = (symbol: string) => {
    setTickers(prev => prev.filter(t => t.symbol !== symbol));
  };

  const refresh = () => {
    void loadStocks(tickers());
  };

  return {
    stocks,
    loading,
    error,
    wsConnected,
    addStock,
    removeStock,
    refresh,
  };
}
