import type { ReactNode } from "react";
import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface AsyncStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: { message?: string } | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  rows?: number;
  children: ReactNode;
}

/** Standard loading / error / empty presentation for every legal surface. */
export const AsyncState = ({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyTitle = "Nothing here yet",
  emptyDescription = "Records will appear here as soon as they exist in the legal workspace.",
  emptyAction,
  onRetry,
  rows = 4,
  children,
}: AsyncStateProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Loading records</span>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 rounded-lg border border-border bg-surface/40 p-4"
          >
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-center"
      >
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">Could not load this data</p>
          <p className="text-sm text-muted-foreground">
            {error?.message ?? "The legal workspace did not respond. Please try again."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface/30 p-10 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div>
          <p className="font-medium text-foreground">{emptyTitle}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
};

export default AsyncState;
