import { runWorkerPool } from '../ocr-pool';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('runWorkerPool', () => {
  test('processes items in parallel with requested worker count', async () => {
    const items = [1, 2, 3, 4];
    const start = Date.now();

    const result = await runWorkerPool(
      items,
      2,
      async () => ({ id: Math.random() }),
      async (_worker, item) => {
        await sleep(30);
        return item * 2;
      },
      async () => {}
    );

    const duration = Date.now() - start;
    expect(result.results).toEqual([2, 4, 6, 8]);
    expect(result.durations.length).toBe(items.length);
    expect(duration).toBeLessThan(120);
  });
});
