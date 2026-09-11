export type WorkerPoolResult<T> = {
  results: T[];
  durations: number[];
};

export async function runWorkerPool<TItem, TResult, TWorker>(
  items: TItem[],
  workerCount: number,
  createWorker: () => Promise<TWorker>,
  run: (worker: TWorker, item: TItem, index: number) => Promise<TResult>,
  dispose: (worker: TWorker) => Promise<void>
): Promise<WorkerPoolResult<TResult>> {
  const count = Math.max(1, Math.min(workerCount, items.length || 1));
  const workers = await Promise.all(Array.from({ length: count }, () => createWorker()));
  const results: TResult[] = new Array(items.length);
  const durations: number[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async (worker: TWorker) => {
    while (true) {
      const index = nextIndex;
      if (index >= items.length) break;
      nextIndex += 1;
      const start = Date.now();
      results[index] = await run(worker, items[index], index);
      durations[index] = Date.now() - start;
    }
  };

  try {
    await Promise.all(workers.map((worker) => runWorker(worker)));
  } finally {
    await Promise.all(workers.map((worker) => dispose(worker)));
  }

  return { results, durations };
}
