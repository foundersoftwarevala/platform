/**
 * Small localStorage-backed state helpers for the marketplace home page.
 *
 * Favourites, the dismissed offer banner and the "notify me" list all used to
 * live in component state only, so every refresh threw the visitor's choices
 * away. These hooks keep the same API as `useState` while writing through to
 * localStorage, and they stay SSR-safe: the first render always uses the
 * fallback value and the stored value is adopted in an effect, so the server
 * and client markup match.
 */
import { useCallback, useEffect, useRef, useState } from "react";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const hydrated = useRef(false);

  useEffect(() => {
    setValue(read(key, fallback));
    hydrated.current = true;
    // `fallback` is intentionally not a dependency — it is the initial value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — the UI still works, it just will not remember */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** Debounces a fast-changing value (the search box) so the 3,000-card grid is
 *  filtered once the visitor stops typing instead of on every keystroke. */
export function useDebouncedValue<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Favourite product ids, remembered across refreshes. */
export function useFavorites() {
  const [favorites, setFavorites] = usePersistentState<string[]>("sv.home.favorites.v1", []);
  const toggle = useCallback(
    (id: string) =>
      setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id])),
    [setFavorites],
  );
  return { favorites, toggle };
}
