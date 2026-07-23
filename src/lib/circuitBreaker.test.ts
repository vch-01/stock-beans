import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitBreaker } from './circuitBreaker';
import type { ProviderName } from './circuitBreaker';

const provider: ProviderName = 'finnhub';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    cb = new CircuitBreaker();
  });

  it('allows first attempt with no prior failures', () => {
    expect(cb.canTry(provider)).toBe(true);
  });

  it('tracks failures independently per provider', () => {
    cb.recordFailure('finnhub');
    cb.recordFailure('alpaca');
    expect(cb.canTry('finnhub')).toBe(true);
    expect(cb.canTry('alpaca')).toBe(true);
    cb.recordFailure('finnhub');
    cb.recordFailure('finnhub');
    expect(cb.canTry('finnhub')).toBe(false);
    expect(cb.canTry('alpaca')).toBe(true);
  });

  it('opens circuit after threshold failures', () => {
    cb = new CircuitBreaker(2);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(true);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
  });

  it('recordSuccess resets the breaker', () => {
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
    cb.recordSuccess(provider);
    expect(cb.canTry(provider)).toBe(true);
  });

  it('allows retry after resetTimeout expires', () => {
    cb = new CircuitBreaker(1, 10_000);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(cb.canTry(provider)).toBe(true);
  });

  it('resets failures to 0 after timeout', () => {
    cb = new CircuitBreaker(2, 10_000);
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(cb.canTry(provider)).toBe(true);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(true);
  });

  it('reset() clears state for a provider', () => {
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
    cb.reset(provider);
    expect(cb.canTry(provider)).toBe(true);
  });

  it('uses default threshold of 3 and resetTimeout of 30s', () => {
    cb = new CircuitBreaker();
    cb.recordFailure(provider);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(true);
    cb.recordFailure(provider);
    expect(cb.canTry(provider)).toBe(false);
    vi.advanceTimersByTime(29_999);
    expect(cb.canTry(provider)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(cb.canTry(provider)).toBe(true);
  });
});
