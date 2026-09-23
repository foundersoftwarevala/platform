/**
 * A short-lived response cache that computes each key once at a time.
 *
 * The marketplace's public endpoints cached their answers for a minute, but
 * only after computing them: when the cache was cold (a restart, the minute
 * running out) every request that arrived before the first one finished
 * computed the same answer again. Under 40 concurrent visitors the catalogue's
 * first page - some twenty database round trips - was built 40 times at once,
 * and the slowest waited 20 s. Here the first miss computes and everyone else
 * asking for the same key waits for that one result.
 *
 * A failure is not cached: the next request tries again.
 */
export class SingleFlightCache<T> {
  private readonly entries = new Map<string, { at: number; value: T }>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 200,
  ) {}

  /** The cached value for `key`, or `compute()`'s, computed once however many ask. */
  async get(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    const running = this.pending.get(key);
    if (running) return running;
    const work = compute()
      .then((value) => {
        if (this.entries.size >= this.maxEntries) this.entries.clear();
        this.entries.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, work);
    return work;
  }

  /** Number of computations in progress (for tests and metrics). */
  get inFlight(): number {
    return this.pending.size;
  }
}
