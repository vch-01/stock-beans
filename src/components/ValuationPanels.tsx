import { For, createMemo } from 'solid-js';
import type { Stock } from '../types';

type Props = {
  stocks: Stock[];
};

export function ValuationPanels(props: Props) {
  const grouped = createMemo(() =>
    props.stocks.reduce(
      (acc, stock) => {
        acc[stock.valuation].push(stock);
        return acc;
      },
      { undervalued: [] as Stock[], fair: [] as Stock[], overvalued: [] as Stock[] },
    ),
  );

  const sections = ['undervalued', 'fair', 'overvalued'] as const;

  return (
    <section class="valuation-panels">
      <For each={sections}>
        {section => (
          <article class={`panel panel-${section}`}>
            <h3>
              {section === 'undervalued'
                ? 'Undervalued'
                : section === 'fair'
                  ? 'Fair Value'
                  : 'Overvalued'}
            </h3>
            <p>
              {grouped()[section].length} stock{grouped()[section].length === 1 ? '' : 's'}
            </p>
            <ul>
              <For each={grouped()[section]}>
                {stock => (
                  <li>
                    <strong>{stock.symbol}</strong>
                  </li>
                )}
              </For>
            </ul>
          </article>
        )}
      </For>
    </section>
  );
}
