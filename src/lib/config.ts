const getProcessEnv = (key: string) =>
  typeof process !== 'undefined' && typeof process.env !== 'undefined'
    ? (process.env as Record<string, string | undefined>)[key]
    : undefined;

export const getAlphaVantageKey = () =>
  import.meta.env.VITE_ALPHA_VANTAGE_API_KEY ?? getProcessEnv('VITE_ALPHA_VANTAGE_API_KEY');

export const getFinnhubKey = () =>
  import.meta.env.VITE_FINNHUB_API_KEY ?? getProcessEnv('VITE_FINNHUB_API_KEY');

export const getAlpacaKey = () =>
  import.meta.env.VITE_ALPACA_API_KEY ?? getProcessEnv('VITE_ALPACA_API_KEY');

export const getAlpacaSecret = () =>
  import.meta.env.VITE_ALPACA_SECRET_KEY ?? getProcessEnv('VITE_ALPACA_SECRET_KEY');

export const hasLiveProviderConfigured = () =>
  Boolean(getAlpacaKey() || getFinnhubKey() || getAlphaVantageKey());
