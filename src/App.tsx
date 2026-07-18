import { useState, useEffect } from 'react';
import { useDashboardStocks } from './hooks/useDashboardStocks';
import { Header } from './components/Header';
import { ErrorBanner } from './components/ErrorBanner';
import { StockTable } from './components/StockTable';
import { ValuationPanels } from './components/ValuationPanels';
import { initialColumns, type Column, type ColumnKey } from './lib/columns';

function App() {
  const { stocks, loading, error, wsConnected, addStock, removeStock, refresh } =
    useDashboardStocks();

  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [sortKey, setSortKey] = useState<ColumnKey>('symbol');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const storedTheme = window.localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme === 'dark';
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('theme', theme);
  }, [isDarkMode]);

  const handleSort = (column: Column) => {
    if (column.key === 'actions') return;

    if (sortKey === column.key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(column.key);
      setSortDirection('asc');
    }
  };

  const displayError = error && error !== dismissedError ? error : null;

  return (
    <div className="app-shell">
      <Header
        onAdd={addStock}
        onRefresh={refresh}
        loading={loading}
        wsConnected={wsConnected}
        isDarkMode={isDarkMode}
        onToggleDark={() => setIsDarkMode(prev => !prev)}
      />

      <ErrorBanner message={displayError} onDismiss={() => setDismissedError(error)} />

      <main>
        <StockTable
          stocks={stocks}
          columns={columns}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRemove={removeStock}
          onColumnsChange={setColumns}
          loading={loading}
        />

        <ValuationPanels stocks={stocks} />
      </main>
    </div>
  );
}

export default App;
