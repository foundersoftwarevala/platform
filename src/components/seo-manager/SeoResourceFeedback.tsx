import { useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

import {
  ResourceFeedbackContext,
  type ResourceFeedbackContextValue,
  type ResourceFeedbackEntry,
} from "@/lib/manager/use-resource";

export function SeoResourceFeedbackProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ResourceFeedbackEntry[]>([]);
  const report = useCallback((entry: ResourceFeedbackEntry) => {
    setEntries((current) => {
      const index = current.findIndex((item) => item.id === entry.id);
      if (index < 0) return [...current, entry];
      const previous = current[index];
      if (
        previous.resource === entry.resource &&
        previous.loading === entry.loading &&
        previous.failed === entry.failed &&
        previous.retry === entry.retry
      ) {
        return current;
      }
      const next = [...current];
      next[index] = entry;
      return next;
    });
  }, []);
  const remove = useCallback(
    (id: string) => setEntries((current) => current.filter((entry) => entry.id !== id)),
    [],
  );
  const value = useMemo<ResourceFeedbackContextValue>(
    () => ({ entries, report, remove }),
    [entries, report, remove],
  );

  return (
    <ResourceFeedbackContext.Provider value={value}>{children}</ResourceFeedbackContext.Provider>
  );
}

export function SeoResourceFeedbackNotice() {
  const feedback = useContext(ResourceFeedbackContext);
  const entries = feedback?.entries ?? [];
  const loading = entries.filter((entry) => entry.loading);
  const failed = entries.filter((entry) => entry.failed);

  return (
    <div className="mb-4 space-y-2">
      {loading.length > 0 && (
        <div
          className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>Loading SEO data…</span>
          <span className="h-2 min-w-24 flex-1 animate-pulse rounded bg-muted" aria-hidden="true" />
        </div>
      )}
      {failed.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Failed to load {entry.resource}. Please try again.
          </span>
          <button
            type="button"
            onClick={entry.retry}
            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1 text-xs font-medium hover:bg-destructive/10"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ))}
    </div>
  );
}
