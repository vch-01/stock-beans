# Stock Valuation Dashboard

[![CI](https://github.com/vch-01/stock-beans/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/vch-01/stock-beans/actions/workflows/ci.yml) [![CodeQL](https://github.com/vch-01/stock-beans/actions/workflows/codeql-analysis.yml/badge.svg?branch=main)](https://github.com/vch-01/stock-beans/actions/workflows/codeql-analysis.yml)


A React, TypeScript, and Vite app for tracking US stocks and evaluating them with investor-style valuation metrics.

## Features

- Add and remove stock tickers from the dashboard
- View core market metrics such as price, all-time high, forward P/E, earnings yield, and value score
- See valuation insights for each stock, including whether it looks undervalued, fair, or overvalued
- Sort and reorder table columns to focus on the metrics you care about
- Use optional live data from Alpha Vantage or Finnhub with fallback behavior when providers are unavailable

## Tech Stack

- React 18
- TypeScript
- Vite
- Axios
- Vitest

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Optional: configure live data providers in a `.env` file:
   ```bash
   VITE_ALPHA_VANTAGE_API_KEY=your_key_here
   VITE_FINNHUB_API_KEY=your_key_here
   ```
   If no keys are provided, the app will still run and use fallback values.

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

## Notes

- The app uses a Vite proxy for provider requests and is designed to work with free or configured market data sources.
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

# Format files with Prettier
npm run format
```

- Pre-commit hooks: Husky + lint-staged are configured to run lint/format on staged files. Run `npm run prepare` after a fresh `npm install` to enable Husky locally.

## Continuous Integration & Security

- GitHub Actions: lint and tests run on push and pull requests via [.github/workflows/ci.yml](.github/workflows/ci.yml#L1-L34).
- CodeQL: a CodeQL analysis workflow is included at [.github/workflows/codeql-analysis.yml](.github/workflows/codeql-analysis.yml#L1-L32).
- Dependabot: dependency updates are configured in [.github/dependabot.yml](.github/dependabot.yml#L1-L8).

## Next steps

- Expand unit tests to cover more error paths and provider fallbacks.
- Add a badge for CI and CodeQL once workflows run on the repository.

