import React from "react";

const { useSyncExternalStore, useRef, useEffect, useMemo, useDebugValue } = React;

export function useSyncExternalStoreWithSelector(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => any,
  getServerSnapshot?: () => any,
  selector?: (snapshot: any) => any,
  isEqual?: (a: any, b: any) => boolean,
) {
  const actualSelector = selector ?? ((value: any) => value);
  const actualIsEqual = isEqual ?? ((a: any, b: any) => Object.is(a, b));

  const instRef = useRef<{ hasValue: boolean; value: any } | null>(null);

  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: null };
  }

  const inst = instRef.current;

  const memoizedResult = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: any = null;
    let memoizedSelection: any = null;

    function memoizedSelector(nextSnapshot: any) {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = actualSelector(nextSnapshot);

        if (inst.hasValue) {
          const currentSelection = inst.value;
          if (actualIsEqual(currentSelection, nextSelection)) {
            return (memoizedSelection = currentSelection);
          }
        }

        return (memoizedSelection = nextSelection);
      }

      const currentSelection = memoizedSelection;
      if (Object.is(memoizedSnapshot, nextSnapshot)) {
        return currentSelection;
      }

      const nextSelection = actualSelector(nextSnapshot);
      if (actualIsEqual(currentSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return currentSelection;
      }

      memoizedSnapshot = nextSnapshot;
      return (memoizedSelection = nextSelection);
    }

    return [
      function selectedGetSnapshot() {
        return memoizedSelector(getSnapshot());
      },
      getServerSnapshot ? function serverGetSnapshot() {
        return memoizedSelector(getServerSnapshot());
      } : undefined,
    ] as const;
  }, [getSnapshot, getServerSnapshot, actualSelector, actualIsEqual, inst]);

  const value = useSyncExternalStore(
    subscribe,
    memoizedResult[0],
    memoizedResult[1] ?? memoizedResult[0],
  );

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value, inst]);

  useDebugValue(value);
  return value;
}

export default { useSyncExternalStoreWithSelector };
