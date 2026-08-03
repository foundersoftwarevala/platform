/**
 * Client-side shim for @tanstack/react-start's useServerFn.
 * This project is a Vite SPA (react-router-dom), so "server functions"
 * are plain async client functions — the hook just returns them as-is.
 */
export function useServerFn<T>(fn: T): T {
  return fn;
}
