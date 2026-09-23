/**
 * In-process caches for the translation hot path.
 *
 * The database is a network round trip away (about 280 ms from the
 * production host), so the path that serves translations that already exist
 * must not wait on it for every request. These are plain in-memory
 * structures: the application runs as one server process, and everything
 * that changes the cached data (engine results, reviews, glossary edits,
 * language switches) happens in that same process and invalidates it. If the
 * application is ever run as several processes, entries still expire on
 * their own (see the TTLs where the caches are created), and the caches
 * would move to a shared store.
 */

type Slot<V> = { value: V; expires: number };

/** A size-bounded map whose entries expire; least recently used goes first. */
export class TtlCache<V> {
  private readonly slots = new Map<string, Slot<V>>();
  hits = 0;
  misses = 0;

  constructor(private readonly maxEntries: number) {}

  get(key: string, now = Date.now()): V | undefined {
    const slot = this.slots.get(key);
    if (!slot) {
      this.misses += 1;
      return undefined;
    }
    if (slot.expires <= now) {
      this.slots.delete(key);
      this.misses += 1;
      return undefined;
    }
    // Re-insert so iteration order is least recently used first.
    this.slots.delete(key);
    this.slots.set(key, slot);
    this.hits += 1;
    return slot.value;
  }

  /** Like get, without counting towards hits and misses or refreshing recency. */
  peek(key: string, now = Date.now()): V | undefined {
    const slot = this.slots.get(key);
    return slot && slot.expires > now ? slot.value : undefined;
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): void {
    this.slots.delete(key);
    this.slots.set(key, { value, expires: now + ttlMs });
    while (this.slots.size > this.maxEntries) {
      const oldest = this.slots.keys().next().value;
      if (oldest === undefined) break;
      this.slots.delete(oldest);
    }
  }

  delete(key: string): void {
    this.slots.delete(key);
  }

  /** Remove every entry whose key starts with `prefix` (all of it when empty). */
  deletePrefix(prefix: string): void {
    if (!prefix) {
      this.slots.clear();
      return;
    }
    for (const key of this.slots.keys()) if (key.startsWith(prefix)) this.slots.delete(key);
  }

  get size(): number {
    return this.slots.size;
  }
}

/**
 * Collapses concurrent calls for the same key into one: while a load is in
 * flight, later callers get the same promise instead of starting another.
 * Many visitors opening the same page in the same language send identical
 * batches at the same moment; this turns that burst into one database read.
 */
export class SingleFlight<V> {
  private readonly inFlight = new Map<string, Promise<V>>();
  shared = 0;

  run(key: string, load: () => Promise<V>): Promise<V> {
    const existing = this.inFlight.get(key);
    if (existing) {
      this.shared += 1;
      return existing;
    }
    const promise = load().finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  get pending(): number {
    return this.inFlight.size;
  }
}
