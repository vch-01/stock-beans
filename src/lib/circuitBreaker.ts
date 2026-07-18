export type ProviderName = 'alpaca' | 'finnhub' | 'alphaVantage' | 'yahoo';

interface ProviderState {
  failures: number;
  openUntil: number | null;
}

export class CircuitBreaker {
  private state = new Map<ProviderName, ProviderState>();
  private threshold: number;
  private resetTimeout: number;

  constructor(threshold = 3, resetTimeoutMs = 30_000) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeoutMs;
  }

  recordSuccess(provider: ProviderName): void {
    this.state.delete(provider);
  }

  recordFailure(provider: ProviderName): void {
    const current = this.state.get(provider) ?? { failures: 0, openUntil: null };
    current.failures += 1;

    if (current.failures >= this.threshold) {
      current.openUntil = Date.now() + this.resetTimeout;
    }

    this.state.set(provider, current);
  }

  canTry(provider: ProviderName): boolean {
    const current = this.state.get(provider);
    if (!current) return true;

    if (current.openUntil !== null) {
      if (Date.now() >= current.openUntil) {
        this.state.set(provider, { failures: 0, openUntil: null });
        return true;
      }
      return false;
    }

    return current.failures < this.threshold;
  }

  reset(provider: ProviderName): void {
    this.state.delete(provider);
  }
}
