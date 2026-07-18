export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const delayWithJitter = (ms: number) => delay(ms + Math.random() * 200);

export const normalizeSymbol = (symbol: string) => symbol.toUpperCase();

export async function mapConcurrent<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 5,
): Promise<R[]> {
  const results: R[] = [];
  const entries: [number, T][] = items.map((item, index) => [index, item]);
  let nextEntry = 0;

  const worker = async () => {
    while (nextEntry < entries.length) {
      const [index, item] = entries[nextEntry];
      nextEntry += 1;
      results[index] = await fn(item);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function processInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number,
  delayMs: number,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await delay(delayMs);
    }
  }
  return results;
}
