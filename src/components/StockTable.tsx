import { For, createMemo } from 'solid-js';
import type { Column, ColumnKey } from '../lib/columns';
import { getColumnSortValue } from '../lib/columns';
import type { Stock } from '../types';

type Props = {
  stocks: Stock[];
  columns: Column[];
  sortKey: ColumnKey;
  sortDirection: 'asc' | 'desc';
  onSort: (column: Column) => void;
  onRemove: (symbol: string) => void;
  onColumnsChange: (columns: Column[]) => void;
  loading: boolean;
};

export function StockTable(props: Props) {
  let dragIndex: number | null = null;

  const handleDragStart = (index: number) => {
    dragIndex = index;
  };

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;

    const next = [...props.columns];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    props.onColumnsChange(next);
    dragIndex = null;
  };

  const getSortValue = (stock: Stock, key: ColumnKey): string | number | null =>
    getColumnSortValue(stock, key);

  const sortedStocks = createMemo(() => {
    return [...props.stocks].sort((a, b) => {
      const aValue = getSortValue(a, props.sortKey);
      const bValue = getSortValue(b, props.sortKey);

      if (aValue === bValue) return 0;
      if (aValue == null) return props.sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return props.sortDirection === 'asc' ? -1 : 1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return props.sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return props.sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });
  });

  const renderCell = (stock: Stock, column: Column) => {
    switch (column.key) {
      case 'symbol':
        return stock.symbol;
      case 'name':
        return stock.name;
      case 'price':
        return `$${stock.price.toFixed(2)}`;
      case 'allTimeHigh':
        return stock.allTimeHigh && stock.allTimeHigh > 0
          ? `$${stock.allTimeHigh.toFixed(2)}`
          : '—';
      case 'toAthPercent': {
        const pct =
          stock.allTimeHigh && stock.price
            ? ((stock.allTimeHigh - stock.price) / stock.price) * 100
            : null;
        return pct != null ? `${pct.toFixed(2)}%` : '—';
      }
      case 'xIncrease': {
        const x = stock.allTimeHigh && stock.price ? stock.allTimeHigh / stock.price : null;
        return x != null ? `${x.toFixed(2)}x` : '—';
      }
      case 'priceAthPercent': {
        const pct =
          stock.allTimeHigh && stock.price
            ? ((stock.allTimeHigh - stock.price) / stock.allTimeHigh) * 100
            : null;
        return pct != null ? `${pct.toFixed(2)}%` : '—';
      }
      case 'forwardPE':
        return stock.forwardPE > 0 ? stock.forwardPE.toFixed(2) : '—';
      case 'earningsYield':
        return stock.earningsYield > 0 ? `${stock.earningsYield.toFixed(2)}%` : '—';
      case 'valueScore':
        return stock.valueScore > 0 ? stock.valueScore : '—';
      case 'valuation':
        return stock.valuation;
      case 'actions':
        return (
          <button class="remove-btn" onClick={() => props.onRemove(stock.symbol)} type="button">
            Remove
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <section class="table-card">
      <div class="table-header">
        <h2>Tracked stocks</h2>
        <span>{props.stocks.length} companies</span>
      </div>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <For each={props.columns}>
                {(column, index) => (
                  <th
                    draggable={column.key !== 'actions'}
                    onDragStart={
                      column.key !== 'actions' ? () => handleDragStart(index()) : undefined
                    }
                    onDragOver={column.key !== 'actions' ? handleDragOver : undefined}
                    onDrop={column.key !== 'actions' ? () => handleDrop(index()) : undefined}
                    onClick={() => props.onSort(column)}
                    onKeyDown={
                      column.key !== 'actions'
                        ? (e: KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') props.onSort(column);
                          }
                        : undefined
                    }
                    tabIndex={column.key !== 'actions' ? 0 : undefined}
                    role={column.key !== 'actions' ? 'columnheader' : undefined}
                    style={{ cursor: column.key === 'actions' ? 'default' : 'pointer' }}
                  >
                    {column.label}
                    {column.key !== 'actions' && props.sortKey === column.key && (
                      <span>{props.sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={sortedStocks()}>
              {stock => (
                <tr class={`valuation-${stock.valuation}`}>
                  <For each={props.columns}>{column => <td>{renderCell(stock, column)}</td>}</For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
      {props.loading && <p class="hint">Loading data…</p>}
    </section>
  );
}
