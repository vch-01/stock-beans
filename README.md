# Stock Valuation Dashboard

[![CI](https://github.com/vch-01/stock-beans/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vch-01/stock-beans/actions/workflows/ci.yml) [![CodeQL](https://github.com/vch-01/stock-beans/actions/workflows/codeql-analysis.yml/badge.svg?branch=main)](https://github.com/vch-01/stock-beans/actions/workflows/codeql-analysis.yml)


A Solid JS, TypeScript, and Vite app for tracking US stocks and evaluating them with investor-style valuation metrics. Fetches live data through a cascading provider chain with automatic fallback and real-time WebSocket updates.

## Features

- Add and remove stock tickers from the dashboard
- View core market metrics such as price, all-time high, forward P/E, earnings yield, and value score
- See valuation insights for each stock, including whether it looks undervalued, fair, or overvalued
- Sort and reorder table columns to focus on the metrics you care about
- **Live WebSocket updates** — prices update in real-time via Alpaca streaming when configured
- **Multi-provider fallback** — data automatically cascades through Alpaca → Finnhub → Alpha Vantage → Yahoo → stale cache → fallback
- **Circuit breaker** — failing providers are auto-skipped for 30 seconds after 3 consecutive failures
- **Request caching** — data is cached with a 60-second TTL to reduce redundant API calls
- **Concurrent fetching** — provider calls run in parallel where possible with configurable concurrency limits

## Provider Chain

```
Alpaca (batch snapshots, 200 req/min) ── success ──► return enriched data
    │ failure
    ▼
Finnhub (per-symbol, 60 req/min) ────── success ──► return enriched data
    │ failure
    ▼
Alpha Vantage (per-symbol, 5 req/min) ── success ──► return enriched data
    │ failure
    ▼
Yahoo Finance (batch quote) ──────────── success ──► return enriched data
    │ failure
    ▼
Stale cache ──────────────────────────── hit ──────► return cached data
    │ miss
    ▼
Fallback (zero data) ─────────────────────────────► return placeholder
```

Each provider is checked for configuration and circuit-breaker status before calling. Failed symbols fall through individually — one bad ticker doesn't block the rest.

## Tech Stack

- Solid JS 1.8
- TypeScript
- Vite
- Axios
- Vitest
- Biome

## Technology Choices

### Solid JS (over React)
React is the dominant industry standard and would be the conventional choice for a team project. However, as a solo self-directed project, I chose Solid JS to explore its reactive, compile-time approach. Solid compiles JSX directly to DOM operations instead of using a virtual DOM, giving it a performance advantage for real-time updates — particularly the WebSocket price ticks that update the table without a full re-render. The component model is similar enough to React that the architecture and patterns translate cleanly, while signals provide simpler reactivity without dependency arrays or hook rules.

### TypeScript
Strict type safety catches entire classes of bugs at compile time rather than runtime. The multi-provider pipeline has complex data shapes (provider responses, cache entries, enriched stock objects) that benefit from exhaustive type checking across module boundaries.

### Vite
Fast dev server with native ESM and a built-in proxy layer that solves CORS issues with the four external APIs (Alpaca, Finnhub, Alpha Vantage, Yahoo) — no separate backend proxy is needed.

### Vitest
Shares Vite's config and transform pipeline for zero duplicate setup. Jest-compatible API with native ESM support. Fast enough that 120+ tests run in under one second.

### Axios
The retry and circuit-breaker layer needs to distinguish rate-limit errors (429) from other failures. Axios provides typed error responses via `error.response.status` — something `fetch` lacks without a manual wrapper.

### Biome
Replaces ESLint + Prettier as a single unified tool for linting and formatting. Written in Rust, it is significantly faster and eliminates the complexity of maintaining two separate configs with overlapping concerns.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure a live data provider in a `.env` file (Alpaca recommended):
   ```bash
   VITE_ALPACA_API_KEY=pk_your_key_here
   VITE_ALPACA_SECRET_KEY=your_secret_here
   ```
   Alternatively, Finnhub and Alpha Vantage are also supported:
   ```bash
   VITE_FINNHUB_API_KEY=your_finnhub_key_here
   VITE_ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here
   ```
   If no keys are provided, the app will still run using Yahoo Finance and fallback values.

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open the local Vite URL in your browser.

## Testing and Build

Run the unit tests:

```bash
npm test
```

Create a production build:

```bash
npm run build
```

## Project Structure

```
src/
├── api.ts                          # Barrel re-exports
├── App.tsx                         # Layout composition
├── main.tsx                        # Solid entry point
├── types.ts                        # Stock type definition
├── styles.css                      # All styles (light/dark theme)
├── hooks/
│   └── useDashboardStocks.ts       # REST fetch + WebSocket hook
├── components/
│   ├── Header.tsx                  # Title, input form, dark mode toggle
│   ├── StockTable.tsx              # Sortable, draggable data table
│   ├── ValuationPanels.tsx         # Undervalued / fair / overvalued cards
│   ├── ErrorBanner.tsx             # Dismissable error messages
│   └── ConnectionIndicator.tsx     # WebSocket live/offline dot
└── lib/
    ├── config.ts                   # API key getters
    ├── utils.ts                    # delay, normalizeSymbol, mapConcurrent
    ├── retry.ts                    # Exponential backoff with jitter
    ├── cache.ts                    # In-memory cache with TTL
    ├── circuitBreaker.ts           # Per-provider failure tracking
    ├── fallback.ts                 # Zero-data fallback generation
    ├── enrichment.ts               # Fills name/ATH/PE from providers
    ├── stockService.ts             # Public API entry point
    ├── wsService.ts                # Alpaca WebSocket streaming
    ├── valuation.ts                # Value score and valuation logic
    ├── columns.ts                  # Table column definitions
    ├── providerTypes.ts            # API response type definitions
    └── providers/
        ├── index.ts                # Provider chain orchestrator
        ├── alpaca.ts               # Alpaca batch snapshots
        ├── finnhub.ts              # Finnhub quote/profile/metric
        ├── alphaVantage.ts         # Alpha Vantage quote/overview
        └── yahoo.ts                # Yahoo batch/single/summary
```

## Architecture Notes

- **Single Responsibility** — each module has one concern. Providers fetch and parse their own data format. The orchestrator routes requests through the chain. Enrichment fills missing fields from secondary providers.
- **Circuit Breaker** — if a provider fails 3 times consecutively, it's skipped for 30 seconds. Success resets the counter.
- **Cache** — fresh for 60 seconds, stale for up to 5 minutes. Stale data is returned while a background refresh happens.
- **WebSocket** — connects to Alpaca's IEX stream on free tier. Trades update price and change percent in real-time without a full page refresh.
- The valuation model is centered on metrics that value investors often examine, including ATH discount, forward P/E, and earnings yield.

## Developer Guide

- Install dependencies:

```bash
npm install
```

- Available scripts:

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint (errors will fail CI)
npm run lint

# Auto-fix lintable issues
npm run lint:fix

# Format files with Biome
npm run format
```

- Pre-commit hooks: Husky + lint-staged are configured to run Biome on staged files. Run `npm run prepare` after a fresh `npm install` to enable Husky locally.

## Continuous Integration & Security

- GitHub Actions: lint and tests run on push and pull requests via [.github/workflows/ci.yml](.github/workflows/ci.yml#L1-L34).
- CodeQL: a CodeQL analysis workflow is included at [.github/workflows/codeql-analysis.yml](.github/workflows/codeql-analysis.yml#L1-L32).
- Dependabot: dependency updates are configured in [.github/dependabot.yml](.github/dependabot.yml#L1-L8).
