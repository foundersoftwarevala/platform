/**
 * DEMO MANAGER — SHARED RETRY FLOW
 * ================================
 * Every panel that reads live backend data registers its refetch function
 * here, so a single "Recheck all" click re-runs every failed read (permission,
 * auth or network) instead of the user hunting per-card retry buttons.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RetryFn = () => unknown | Promise<unknown>;

interface DataRetryContextValue {
  /** Re-runs every registered panel refetch. */
  retryAll: () => Promise<void>;
  /** True while a recheck is in flight. */
  isRetrying: boolean;
  /** How many panels are wired into the shared retry flow. */
  registered: number;
  /** Timestamp of the last completed recheck. */
  lastRetryAt: number | null;
}

const DataRetryContext = createContext<DataRetryContextValue | null>(null);

export function DataRetryProvider({ children }: { children: ReactNode }) {
  const retries = useRef(new Map<number, RetryFn>());
  const [isRetrying, setIsRetrying] = useState(false);
  const [registered, setRegistered] = useState(0);
  const [lastRetryAt, setLastRetryAt] = useState<number | null>(null);

  const register = useCallback((id: number, fn: RetryFn) => {
    retries.current.set(id, fn);
    setRegistered(retries.current.size);
    return () => {
      retries.current.delete(id);
      setRegistered(retries.current.size);
    };
  }, []);

  const retryAll = useCallback(async () => {
    setIsRetrying(true);
    try {
      await Promise.allSettled([...retries.current.values()].map((fn) => fn()));
      setLastRetryAt(Date.now());
    } finally {
      setIsRetrying(false);
    }
  }, []);

  const value = useMemo(
    () => ({ retryAll, isRetrying, registered, lastRetryAt }),
    [retryAll, isRetrying, registered, lastRetryAt],
  );

  return (
    <DataRetryContext.Provider value={value}>
      <RegisterContext.Provider value={register}>{children}</RegisterContext.Provider>
    </DataRetryContext.Provider>
  );
}

type RegisterFn = (id: number, fn: RetryFn) => () => void;
const RegisterContext = createContext<RegisterFn | null>(null);

let nextId = 0;

/** Adds a panel's refetch to the shared retry flow for as long as it is mounted. */
export function useRegisterRetry(fn?: RetryFn) {
  const register = useContext(RegisterContext);
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!register || !latest.current) return;
    const id = ++nextId;
    return register(id, () => latest.current?.());
  }, [register, Boolean(fn)]);
}

/** Read the shared retry state. Returns a no-op fallback outside the provider. */
export function useDataRetry(): DataRetryContextValue {
  return (
    useContext(DataRetryContext) ?? {
      retryAll: async () => {},
      isRetrying: false,
      registered: 0,
      lastRetryAt: null,
    }
  );
}

export default useDataRetry;
