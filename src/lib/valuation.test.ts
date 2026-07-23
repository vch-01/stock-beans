import { describe, expect, it } from 'vitest';
import type { Stock } from '../api';
import { getColumnSortValue, initialColumns } from './columns';
import { computeValueScore, deriveStockValuation, enrichStockMetrics } from './valuation';

const buildStock = (overrides: Partial<Stock> = {}): Stock => ({
  symbol: 'AAPL',
  name: 'Apple Inc.',
  price: 100,
  changePercent: 0,
  allTimeHigh: 200,
  forwardPE: 10,
  earningsYield: 0,
  valueScore: 0,
  valuation: 'fair',
  ...overrides,
});

describe('valuation helpers', () => {
  it('computes a value score from ATH discount, forward PE, and earnings yield', () => {
    const stock = buildStock({ price: 100, allTimeHigh: 200, forwardPE: 10 });

    expect(computeValueScore(stock)).toBe(70);
  });

  it('classifies stocks as undervalued, fair, or overvalued', () => {
    expect(
      deriveStockValuation(
        buildStock({ price: 100, allTimeHigh: 200, forwardPE: 10, valueScore: 90 }),
      ),
    ).toBe('undervalued');
    expect(
      deriveStockValuation(
        buildStock({ price: 100, allTimeHigh: 200, forwardPE: 10, valueScore: 35 }),
      ),
    ).toBe('overvalued');
    expect(
      deriveStockValuation(
        buildStock({ price: 100, allTimeHigh: 200, forwardPE: 10, valueScore: 50 }),
      ),
    ).toBe('fair');
  });

  it('enriches stock metrics with earnings yield, score, and valuation', () => {
    const enriched = enrichStockMetrics(
      buildStock({ price: 100, allTimeHigh: 200, forwardPE: 10 }),
    );

    expect(enriched.earningsYield).toBe(10);
    expect(enriched.valueScore).toBe(90);
    expect(enriched.valuation).toBe('undervalued');
  });
});

describe('column helpers', () => {
  it('defines the expected default columns', () => {
    expect(initialColumns.map(column => column.key)).toContain('toAthPercent');
    expect(initialColumns.map(column => column.key)).toContain('xIncrease');
    expect(initialColumns.map(column => column.key)).toContain('priceAthPercent');
  });

  it('computes the right sort values for derived columns', () => {
    const stock = buildStock({ price: 80, allTimeHigh: 100 });

    expect(getColumnSortValue(stock, 'toAthPercent')).toBe(25);
    expect(getColumnSortValue(stock, 'xIncrease')).toBe(1.25);
    expect(getColumnSortValue(stock, 'priceAthPercent')).toBe(20);
  });

  it('returns null for derived columns when price or ATH is missing', () => {
    const stock = buildStock({ price: 0, allTimeHigh: 0 });

    expect(getColumnSortValue(stock, 'toAthPercent')).toBeNull();
    expect(getColumnSortValue(stock, 'xIncrease')).toBeNull();
    expect(getColumnSortValue(stock, 'priceAthPercent')).toBeNull();
  });
});
