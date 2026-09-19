/**
 * One request per page view for data several homepage sections read.
 *
 * The category strip and the industry grid both read /api/marketplace/rows;
 * each fetched it, so every visitor asked for the same answer twice. Callers
 * asking for the same address share the first request's JSON. A failed request
 * is forgotten, so the next caller tries again.
 */
const shared = new Map<string, Promise<unknown>>();

export function fetchJsonShared<T>(url: string): Promise<T> {
  let request = shared.get(url) as Promise<T> | undefined;
  if (!request) {
    request = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    });
    shared.set(url, request);
    request.catch(() => shared.delete(url));
    // A page left open for a while reads fresh data on its next render.
    setTimeout(() => shared.delete(url), 60_000);
  }
  return request;
}
