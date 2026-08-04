/**
 * Local stand-in for `useServerFn`. The Marketplace Manager data layer runs
 * fully client-side in this project (no backend service is configured), so the
 * hook simply hands back the async function it is given.
 */
export function useServerFn<T>(fn: T): T {
  return fn;
}
