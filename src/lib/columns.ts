import type { Stock } from '../types';

export type ColumnKey = keyof Stock | 'toAthPercent' | 'xIncrease' | 'priceAthPercent' | 'actions';

export type Column = {
  key: ColumnKey;
  label: string;
};

export const initialColumns: Column[] = [
  { key: 'symbol', label: 'Ticker' },
  { key: 'name', label: 'Name' },
  { key: 'price', label: 'Price' },
  { key: 'allTimeHigh', label: 'ATH' },
  { key: 'forwardPE', label: 'Forward P/E' },
  { key: 'earningsYield', label: 'Earnings Yield' },
  { key: 'valueScore', label: 'Value Score' },
  { key: 'toAthPercent', label: '% to ATH' },
  { key: 'xIncrease', label: 'X‑increase' },
  { key: 'priceAthPercent', label: '% decreased from ATH' },
  { key: 'valuation', label: 'Valuation' },
  { key: 'actions', label: 'Actions' },
];

export const getColumnSortValue = (stock: Stock, key: ColumnKey): string | number | null => {
  if (key === 'toAthPercent') {
    if (!stock.allTimeHigh || !stock.price) return null;
    return ((stock.allTimeHigh - stock.price) / stock.price) * 100;
  }
  if (key === 'xIncrease') {
    if (!stock.allTimeHigh || !stock.price) return null;
    return stock.allTimeHigh / stock.price;
  }
  if (key === 'priceAthPercent') {
    if (!stock.allTimeHigh || !stock.price) return null;
    return ((stock.allTimeHigh - stock.price) / stock.allTimeHigh) * 100;
  }
  if (key === 'allTimeHigh') return stock.allTimeHigh ?? null;
  if (key === 'actions') return null;
  if (key === 'valuation') {
    const order = { undervalued: 0, fair: 1, overvalued: 2 };
    return order[stock.valuation] ?? 1;
  }
  const value = (stock as Record<string, unknown>)[key];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
};
