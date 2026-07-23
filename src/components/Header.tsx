import { For, createSignal, onCleanup } from 'solid-js';
import { searchSymbols } from '../lib/search';
import type { SearchResult } from '../lib/search';
import { ConnectionIndicator } from './ConnectionIndicator';

type Props = {
  onAdd: (symbol: string) => string | null;
  onRefresh: () => void;
  loading: boolean;
  wsConnected: boolean;
  isDarkMode: boolean;
  onToggleDark: () => void;
};

export function Header(props: Props) {
  const [inputValue, setInputValue] = createSignal('');
  const [localError, setLocalError] = createSignal<string | null>(null);
  const [suggestions, setSuggestions] = createSignal<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = createSignal(false);
  const [activeIndex, setActiveIndex] = createSignal(-1);
  const [searching, setSearching] = createSignal(false);
  let inputRef: HTMLInputElement | undefined;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const handleSubmit = (symbol?: string) => {
    const value = symbol ?? inputValue().trim();
    if (!value) return;

    const err = props.onAdd(value.toUpperCase());
    if (err) {
      setLocalError(err);
    } else {
      setLocalError(null);
      setInputValue('');
      setSuggestions([]);
      setShowDropdown(false);
    }
  };

  const doSearch = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const results = await searchSymbols(query);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setSearching(false);
    }
  };

  const handleInput = (value: string) => {
    setInputValue(value);
    setActiveIndex(-1);

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void doSearch(value);
    }, 300);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const list = suggestions();
    if (!showDropdown() || list.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < list.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : list.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = activeIndex();
      if (idx >= 0 && idx < list.length) {
        handleSubmit(list[idx].symbol);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  const handleSelect = (result: SearchResult) => {
    handleSubmit(result.symbol);
  };

  const handleClickOutside = (e: MouseEvent) => {
    if (inputRef && !inputRef.closest('.search-wrapper')?.contains(e.target as Node)) {
      setShowDropdown(false);
    }
  };
  document.addEventListener('click', handleClickOutside);
  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const idx = activeIndex();
    const list = suggestions();
    if (idx >= 0 && idx < list.length) {
      handleSubmit(list[idx].symbol);
    } else {
      handleSubmit();
    }
  };

  return (
    <header class="hero">
      <div>
        <p class="eyebrow">Stock Valuation Tracker</p>
        <h1>US stock valuation dashboard</h1>
        <p class="subhead">
          Track US stocks, add interests, and see whether a stock looks undervalued, fair valued, or
          overvalued using free market data.
        </p>
      </div>

      <button
        class="theme-toggle"
        onClick={props.onToggleDark}
        aria-label={props.isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        type="button"
      >
        {props.isDarkMode ? (
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

      <div class="control-panel">
        <div class="header-info-row">
          <ConnectionIndicator connected={props.wsConnected} />
        </div>
        <form class="input-row" onSubmit={onSubmit}>
          <label>
            Ticker or company name
            <div class="search-wrapper">
              <input
                ref={inputRef}
                value={inputValue()}
                onInput={e => handleInput((e.target as HTMLInputElement).value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions().length > 0) setShowDropdown(true);
                }}
                placeholder="AAPL or Apple Inc."
                autocomplete="off"
              />
              {showDropdown() && (
                <div class="search-dropdown">
                  <For each={suggestions()}>
                    {(result, index) => (
                      <div
                        class={`search-option${index() === activeIndex() ? ' active' : ''}`}
                        onMouseDown={() => handleSelect(result)}
                      >
                        <span class="search-symbol">{result.symbol}</span>
                        <span class="search-name">{result.name}</span>
                        <span class="search-exchange">{result.exchange}</span>
                      </div>
                    )}
                  </For>
                </div>
              )}
              {searching() && <div class="search-spinner" />}
            </div>
          </label>
          <div class="button-row">
            <button type="submit">Add stock</button>
            <button
              type="button"
              onClick={props.onRefresh}
              class="secondary"
              disabled={props.loading}
            >
              {props.loading ? 'Loading…' : 'Refresh data'}
            </button>
          </div>
        </form>
        {localError() && <p class="error-message">{localError()}</p>}
      </div>
    </header>
  );
}
