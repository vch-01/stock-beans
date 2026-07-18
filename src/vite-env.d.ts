/// <reference types="vite/client" />

declare global {
  interface ImportMetaEnv {
    readonly VITE_ALPHA_VANTAGE_API_KEY?: string;
    readonly VITE_FINNHUB_API_KEY?: string;
    readonly VITE_ALPACA_API_KEY?: string;
    readonly VITE_ALPACA_SECRET_KEY?: string;
    readonly [key: string]: string | undefined;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }

  interface ProcessEnv {
    [key: string]: string | undefined;
  }

  interface Process {
    env: ProcessEnv;
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
declare const process: Process;

export {};
