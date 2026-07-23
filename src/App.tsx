import { createEffect, createMemo, createSignal } from 'solid-js';
import { ErrorBanner } from './components/ErrorBanner';
import { Header } from './components/Header';
import { StockTable } from './components/StockTable';
import { ValuationPanels } from './components/ValuationPanels';
import { useDashboardStocks } from './hooks/useDashboardStocks';
import { type Column, type ColumnKey, initialColumns } from './lib/columns';

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  const storedTheme = window.localStorage.getItem('theme');
  if (storedTheme === 'dark' || storedTheme === 'light') {
    return storedTheme === 'dark';
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function App() {
  const { stocks, loading, error, wsConnected, addStock, removeStock, refresh } =
    useDashboardStocks();

  const [columns, setColumns] = createSignal<Column[]>(initialColumns);
  const [sortKey, setSortKey] = createSignal<ColumnKey>('symbol');
  const [sortDirection, setSortDirection] = createSignal<'asc' | 'desc'>('asc');
  const [dismissedError, setDismissedError] = createSignal<string | null>(null);
  const [isDarkMode, setIsDarkMode] = createSignal(getInitialDarkMode());

  createEffect(() => {
    const theme = isDarkMode() ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  });

  const handleSort = (column: Column) => {
    if (column.key === 'actions') return;

    if (sortKey() === column.key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key as ColumnKey);
      setSortDirection('asc');
    }
  };

  const displayError = createMemo(() => {
    const err = error();
    return err && err !== dismissedError() ? err : null;
  });

  return (
    <div class="app-shell">
      <Header
        onAdd={addStock}
        onRefresh={refresh}
        loading={loading()}
        wsConnected={wsConnected()}
        isDarkMode={isDarkMode()}
        onToggleDark={() => setIsDarkMode(!isDarkMode())}
      />

      <ErrorBanner message={displayError()} onDismiss={() => setDismissedError(error())} />

      <main>
        <StockTable
          stocks={stocks()}
          columns={columns()}
          sortKey={sortKey()}
          sortDirection={sortDirection()}
          onSort={handleSort}
          onRemove={removeStock}
          onColumnsChange={setColumns}
          loading={loading()}
        />

        <ValuationPanels stocks={stocks()} />
      </main>
    </div>
  );
}
