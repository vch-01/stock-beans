import axios from 'axios';
import { delayWithJitter } from './utils';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export const isRateLimitError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status === 429 || status === 503;
  }
  const e = error as { response?: { status?: number } } | undefined;
  const status = e?.response?.status;
  return status === 429 || status === 503;
};

export const isAxiosError = (error: unknown) => axios.isAxiosError(error);

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 400 } = options;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      attempt += 1;
      if (attempt >= maxAttempts || !isRateLimitError(error)) {
        throw error;
      }
      await delayWithJitter(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error('Retry failed');
}
