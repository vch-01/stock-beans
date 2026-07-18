import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { isRateLimitError, withRetry } from './retry';

vi.mock('./utils', () => ({
  delayWithJitter: vi.fn().mockResolvedValue(undefined),
}));

function makeAxiosError(message: string, status: number): Error & { response: { status: number } } {
  const err = new Error(message) as Error & { response: { status: number } };
  err.response = { status };
  return err;
}

describe('isRateLimitError', () => {
  it('returns true for axios 429 errors', () => {
    const error = makeAxiosError('rate limit', 429);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns true for axios 503 errors', () => {
    const error = makeAxiosError('service unavailable', 503);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns false for non-rate-limit axios errors', () => {
    const error = makeAxiosError('not found', 404);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);
    expect(isRateLimitError(error)).toBe(false);
  });

  it('returns false for errors without response', () => {
    const error = new Error('network');
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    expect(isRateLimitError(error)).toBe(false);
  });

  it('handles non-axios errors with response status', () => {
    const error = { response: { status: 429 } };
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);
    expect(isRateLimitError(error)).toBe(true);
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('succeeds on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on rate-limit errors and succeeds', async () => {
    const err = makeAxiosError('rate limit', 429);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce('ok');
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    const err = makeAxiosError('rate limit', 429);
    const fn = vi.fn().mockRejectedValue(err);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-rate-limit errors', async () => {
    const error = new Error('bad request');
    const fn = vi.fn().mockRejectedValue(error);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(false);

    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('bad request');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses defaults when no options provided', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
  });

  it('does not retry when maxAttempts is 1', async () => {
    const err = makeAxiosError('rate limit', 429);
    const fn = vi.fn().mockRejectedValue(err);
    vi.spyOn(axios, 'isAxiosError').mockReturnValue(true);

    await expect(withRetry(fn, { maxAttempts: 1 })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
