import type { Stock } from '../types';

const computeEarningsYield = (forwardPE: number) => (forwardPE > 0 ? 100 / forwardPE : 0);

const computeAthDiscount = (stock: Stock) => {
  if (stock.allTimeHigh <= 0 || stock.price <= 0) return 0;
  return Math.max(0, Math.min(100, ((stock.allTimeHigh - stock.price) / stock.allTimeHigh) * 100));
};

const computeForwardPEScore = (forwardPE: number) => {
  if (forwardPE <= 0) return 0;
  if (forwardPE <= 10) return 30;
  if (forwardPE <= 15) return 23;
  if (forwardPE <= 20) return 16;
  if (forwardPE <= 25) return 9;
  return 0;
};

const computeEarningsYieldScore = (earningsYield: number) => {
  if (earningsYield <= 0) return 0;
  return (Math.min(earningsYield, 15) / 15) * 30;
};

export const computeValueScore = (stock: Stock) => {
  const athScore = Math.min(computeAthDiscount(stock), 40);
  const peScore = computeForwardPEScore(stock.forwardPE);
  const yieldScore = computeEarningsYieldScore(stock.earningsYield);
  return Math.round(athScore + peScore + yieldScore);
};

export const deriveStockValuation = (stock: Stock): Stock['valuation'] => {
  const hasValidPrice = stock.price > 0;
  const hasValidAth = stock.allTimeHigh > 0;
  if (!hasValidPrice) return 'fair';

  if (hasValidAth && stock.price >= stock.allTimeHigh && stock.forwardPE > 25) {
    return 'overvalued';
  }

  if (stock.valueScore >= 65) {
    return 'undervalued';
  }

  if (stock.valueScore <= 35) {
    return 'overvalued';
  }

  return 'fair';
};

export const enrichStockMetrics = (stock: Stock): Stock => {
  const earningsYield = computeEarningsYield(stock.forwardPE);
  const valueScore = computeValueScore({ ...stock, earningsYield });
  return {
    ...stock,
    earningsYield,
    valueScore,
    valuation: deriveStockValuation({ ...stock, earningsYield, valueScore }),
  };
};
