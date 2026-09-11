/**
 * One request for data several homepage sections need at once.
 *
 * Shop by Industry and the category slider both asked /api/marketplace/rows,
 * and Success Stories and Awards both asked /api/marketplace/proof - each pair
 * on every page view, for the same answer. The first caller's request is shared
 * with the rest, and reused for a minute. A failed answer is not kept, so the
 * next caller tries again.
 */

type Settled = { ok: boolean; status: number; body: unknown };

const shared = new Map<string, { at: number; promise: Promise<Settled> }>();

export function sharedFetch(
  url: string,
  ttlMs = 60_000,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  const now = Date.now();
  let entry = shared.get(url);
  if (!entry || now - entry.at > ttlMs) {
    const promise = fetch(url)
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        body: await response.json().catch(() => null),
      }))
      .then((settled) => {
        if (!settled.ok) shared.delete(url);
        return settled;
      });
    promise.catch(() => shared.delete(url));
    entry = { at: now, promise };
    shared.set(url, entry);
  }
  return entry.promise.then((settled) => ({
    ok: settled.ok,
    status: settled.status,
    json: async () => settled.body,
  }));
}
