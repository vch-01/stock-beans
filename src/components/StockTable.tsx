import { useRef, useMemo } from 'react';
import type { Stock } from '../types';
import type { Column, ColumnKey } from '../lib/columns';
import { getColumnSortValue } from '../lib/columns';

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

export function StockTable({
  stocks,
  columns,
  sortKey,
  sortDirection,
  onSort,
  onRemove,
  onColumnsChange,
  loading,
}: Props) {
  const dragIndexRef = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (event: React.DragEvent<HTMLTableHeaderCellElement>) => {
    event.preventDefault();
  };

  const handleDrop = (index: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex === null || fromIndex === index) return;

    const next = [...columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(index, 0, moved);
    onColumnsChange(next);
    dragIndexRef.current = null;
  };

  const getSortValue = (stock: Stock, key: ColumnKey): string | number | null =>
    getColumnSortValue(stock, key);

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aValue = getSortValue(a, sortKey);
      const bValue = getSortValue(b, sortKey);

      if (aValue === bValue) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue);
    });
  }, [stocks, sortKey, sortDirection]);

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
          <button className="remove-btn" onClick={() => onRemove(stock.symbol)} type="button">
            Remove
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <section className="table-card">
      <div className="table-header">
        <h2>Tracked stocks</h2>
        <span>{stocks.length} companies</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  draggable={column.key !== 'actions'}
                  onDragStart={column.key !== 'actions' ? () => handleDragStart(index) : undefined}
                  onDragOver={column.key !== 'actions' ? handleDragOver : undefined}
                  onDrop={column.key !== 'actions' ? () => handleDrop(index) : undefined}
                  onClick={() => onSort(column)}
                  style={{ cursor: column.key === 'actions' ? 'default' : 'pointer' }}
                >
                  {column.label}
                  {column.key !== 'actions' && sortKey === column.key && (
                    <span>{sortDirection === 'asc' ? ' ▲' : ' ▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStocks.map(stock => (
              <tr key={stock.symbol} className={`valuation-${stock.valuation}`}>
                {columns.map(column => (
                  <td key={`${stock.symbol}-${column.key}`}>{renderCell(stock, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <p className="hint">Loading data…</p>}
    </section>
  );
}
