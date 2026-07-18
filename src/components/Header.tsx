import { useState } from 'react';
import { ConnectionIndicator } from './ConnectionIndicator';

type Props = {
  onAdd: (symbol: string) => string | null;
  onRefresh: () => void;
  loading: boolean;
  wsConnected: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
};

export function Header({
  onAdd,
  onRefresh,
  loading,
  wsConnected,
  isDarkMode,
  onToggleDark,
}: Props) {
  const [inputSymbol, setInputSymbol] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputSymbol.trim()) return;

    const err = onAdd(inputSymbol.trim());
    if (err) {
      setLocalError(err);
    } else {
      setLocalError(null);
      setInputSymbol('');
    }
  };

  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Stock Valuation Tracker</p>
        <h1>US stock valuation dashboard</h1>
        <p className="subhead">
          Track US stocks, add interests, and see whether a stock looks undervalued, fair valued, or
          overvalued using free market data.
        </p>
      </div>

      <button
        className="theme-toggle"
        onClick={onToggleDark}
        aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        type="button"
      >
        {isDarkMode ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="5" />
            <g>
              <path d="M12 1.5v3" />
              <path d="M12 19.5v3" />
              <path d="M4.22 4.22l2.12 2.12" />
              <path d="M17.66 17.66l2.12 2.12" />
              <path d="M1.5 12h3" />
              <path d="M19.5 12h3" />
              <path d="M4.22 19.78l2.12-2.12" />
              <path d="M17.66 6.34l2.12-2.12" />
            </g>
          </svg>
        )}
      </button>

      <div className="control-panel">
        <div className="header-info-row">
          <ConnectionIndicator connected={wsConnected} />
        </div>
        <form className="input-row" onSubmit={handleSubmit}>
          <label>
            Ticker
            <input
              value={inputSymbol}
              onChange={e => setInputSymbol(e.target.value)}
              placeholder="AAPL"
            />
          </label>
          <div className="button-row">
            <button type="submit">Add stock</button>
            <button type="button" onClick={onRefresh} className="secondary" disabled={loading}>
              {loading ? 'Loading…' : 'Refresh data'}
            </button>
          </div>
        </form>
        {localError && <p className="error-message">{localError}</p>}
      </div>
    </header>
  );
}
