import { useMemo } from 'react';
import type { Stock } from '../types';

type Props = {
  stocks: Stock[];
};

export function ValuationPanels({ stocks }: Props) {
  const grouped = useMemo(
    () =>
      stocks.reduce(
        (acc, stock) => {
          acc[stock.valuation].push(stock);
          return acc;
        },
        { undervalued: [] as Stock[], fair: [] as Stock[], overvalued: [] as Stock[] },
      ),
    [stocks],
  );

  return (
    <section className="valuation-panels">
      {(['undervalued', 'fair', 'overvalued'] as const).map(section => (
        <article key={section} className={`panel panel-${section}`}>
          <h3>
            {section === 'undervalued'
              ? 'Undervalued'
              : section === 'fair'
                ? 'Fair Value'
                : 'Overvalued'}
          </h3>
          <p>
            {grouped[section].length} stock{grouped[section].length === 1 ? '' : 's'}
          </p>
          <ul>
            {grouped[section].map(stock => (
              <li key={stock.symbol}>
                <strong>{stock.symbol}</strong>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
