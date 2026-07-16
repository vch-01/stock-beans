import { useEffect, useMemo, useRef, useState } from 'react'
import { Stock, defaultTickers, fetchStocksData, normalizeSymbol } from './api'
import { getColumnSortValue, initialColumns, type Column, type ColumnKey } from './lib/columns'

function App() {
  const [tickers, setTickers] = useState<Array<{ symbol: string }>>(defaultTickers)
  const [inputSymbol, setInputSymbol] = useState('')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const dragIndexRef = useRef<number | null>(null)
  const [sortKey, setSortKey] = useState<ColumnKey>('symbol')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    const storedTheme = window.localStorage.getItem('theme')
    if (storedTheme === 'dark' || storedTheme === 'light') {
      return storedTheme === 'dark'
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  const liveProviderConfigured = Boolean(
    import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || import.meta.env.VITE_FINNHUB_API_KEY,
  )

  useEffect(() => {
    const theme = isDarkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('theme', theme)
  }, [isDarkMode])

  const fetchStocks = async () => {
    setLoading(true)
    setError(null)

    try {
      const { stocks: results, fallbackUsed } = await fetchStocksData(tickers)
      setStocks(results)

      if (fallbackUsed) {
        setError(
          liveProviderConfigured
            ? 'Some stock data could not be loaded; showing fallback values.'
            : 'No live stock provider configured. Showing offline fallback values. Set VITE_ALPHA_VANTAGE_API_KEY or VITE_FINNHUB_API_KEY in .env for live data.',
        )
      }
    } catch (err) {
      console.error(err)
      setError('Unable to load stock data. Please try refreshing or check your network connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      await fetchStocks()
    }
    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers])

  const handleAdd = () => {
    const symbol = inputSymbol.trim()
    if (!symbol) return

    const normalizedSymbol = normalizeSymbol(symbol)
    if (tickers.some((ticker: { symbol: string }) => ticker.symbol === normalizedSymbol)) {
      setError('This stock has already been added.')
      return
    }

    setTickers(prev => [
      ...prev,
      { symbol: normalizedSymbol },
    ])
    setInputSymbol('')
    setError(null)
  }

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!inputSymbol.trim()) return
    handleAdd()
  }

  const handleRemove = (symbol: string) => {
    setTickers(prev => prev.filter((t: { symbol: string }) => t.symbol !== symbol))
  }

  const handleDragStart = (index: number) => {
    dragIndexRef.current = index
  }

  const handleDragOver = (event: React.DragEvent<HTMLTableHeaderCellElement>) => {
    event.preventDefault()
  }

  const handleDrop = (index: number) => {
    const fromIndex = dragIndexRef.current
    if (fromIndex === null || fromIndex === index) return

    setColumns(prev => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(index, 0, moved)
      return next
    })
    dragIndexRef.current = null
  }

  const handleSort = (column: Column) => {
    if (column.key === 'actions') return

    if (sortKey === column.key) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column.key)
      setSortDirection('asc')
    }
  }
  const getSortValue = (stock: Stock, key: ColumnKey): string | number | null => getColumnSortValue(stock, key)

  const sortedStocks = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const aValue = getSortValue(a, sortKey)
      const bValue = getSortValue(b, sortKey)

      if (aValue === bValue) return 0
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc'
        ? Number(aValue) - Number(bValue)
        : Number(bValue) - Number(aValue)
    })
  }, [stocks, sortKey, sortDirection])

  const grouped = useMemo(
    () => sortedStocks.reduce(
      (acc, stock) => {
        acc[stock.valuation].push(stock)
        return acc
      },
      { undervalued: [] as Stock[], fair: [] as Stock[], overvalued: [] as Stock[] },
    ),
    [sortedStocks],
  )

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Stock Valuation Tracker</p>
          <h1>US stock valuation dashboard</h1>
          <p className="subhead">
            Track US stocks, add interests, and see whether a stock looks undervalued,
            fair valued, or overvalued using free market data.
          </p>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setIsDarkMode(prev => !prev)}
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
          <form className="input-row" onSubmit={handleFormSubmit}>
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
              <button type="button" onClick={fetchStocks} className="secondary">
                Refresh data
              </button>
            </div>
          </form>
          {error && <p className="error-message">{error}</p>}
        </div>
      </header>

      <main>
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
                      onClick={() => handleSort(column)}
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
                    {columns.map(column => {
                      switch (column.key) {
                        case 'symbol':
                          return <td key={`${stock.symbol}-symbol`}>{stock.symbol}</td>
                        case 'name':
                          return <td key={`${stock.symbol}-name`}>{stock.name}</td>
                        case 'price':
                          return <td key={`${stock.symbol}-price`}>${stock.price.toFixed(2)}</td>
                        case 'allTimeHigh':
                          return (
                            <td key={`${stock.symbol}-ath`}>
                              {stock.allTimeHigh && stock.allTimeHigh > 0 ? `$${stock.allTimeHigh.toFixed(2)}` : '—'}
                            </td>
                          )
                        case 'toAthPercent': {
                          const pct = (stock.allTimeHigh && stock.price) ? ((stock.allTimeHigh - stock.price) / stock.price) * 100 : null
                          return <td key={`${stock.symbol}-toAth`}>{pct != null ? `${pct.toFixed(2)}%` : '—'}</td>
                        }
                        case 'xIncrease': {
                          const x = (stock.allTimeHigh && stock.price) ? (stock.allTimeHigh / stock.price) : null
                          return <td key={`${stock.symbol}-xincrease`}>{x != null ? `${x.toFixed(2)}x` : '—'}</td>
                        }
                        case 'priceAthPercent': {
                          const pct = (stock.allTimeHigh && stock.price) ? ((stock.allTimeHigh - stock.price) / stock.allTimeHigh) * 100 : null
                          return <td key={`${stock.symbol}-priceAth`}>{pct != null ? `${pct.toFixed(2)}%` : '—'}</td>
                        }
                        case 'forwardPE':
                          return <td key={`${stock.symbol}-forwardPE`}>{stock.forwardPE > 0 ? stock.forwardPE.toFixed(2) : '—'}</td>
                        case 'earningsYield':
                          return <td key={`${stock.symbol}-earningsYield`}>{stock.earningsYield > 0 ? `${stock.earningsYield.toFixed(2)}%` : '—'}</td>
                        case 'valueScore':
                          return <td key={`${stock.symbol}-valueScore`}>{stock.valueScore > 0 ? stock.valueScore : '—'}</td>
                        case 'valuation':
                          return <td key={`${stock.symbol}-valuation`}>{stock.valuation}</td>
                        case 'actions':
                          return (
                            <td key={`${stock.symbol}-actions`}>
                              <button className="remove-btn" onClick={() => handleRemove(stock.symbol)}>
                                Remove
                              </button>
                            </td>
                          )
                        default:
                          return null
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="hint">Loading data…</p>}
        </section>

        <section className="valuation-panels">
          {(['undervalued', 'fair', 'overvalued'] as const).map(section => (
            <article key={section} className={`panel panel-${section}`}>
              <h3>{section === 'undervalued' ? 'Undervalued' : section === 'fair' ? 'Fair Value' : 'Overvalued'}</h3>
              <p>{grouped[section].length} stock{grouped[section].length === 1 ? '' : 's'}</p>
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
      </main>
    </div>
  )
}

export default App
