/** Passes through TanStack server-function proxies used by Marketplace Manager sections. */
export function useServerFn<T>(fn: T): T {
  return fn;
}
