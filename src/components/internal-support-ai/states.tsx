/**
 * Internal Support AI - loading, error and empty rows, styled like the
 * list rows they stand in for so the section layouts do not change.
 */

import React from "react";
import { AlertTriangle, Info, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";
import { errorText, isDenied } from "./data";

export const LoadingRow: React.FC<{ label?: string }> = ({ label }) => {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-2 p-3 bg-card/60 rounded-lg border border-border text-xs text-muted-foreground"
      role="status"
      aria-busy="true"
    >
      <RefreshCw className="w-3 h-3 animate-spin" />
      {label ?? t("manager.support_ai.loading")}
    </div>
  );
};

export const EmptyRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 p-3 bg-card/60 rounded-lg border border-border text-xs text-muted-foreground">
    <Info className="w-3 h-3 mt-0.5 shrink-0" />
    <span>{children}</span>
  </div>
);

export const ErrorRow: React.FC<{ error: unknown; onRetry?: () => void; source: string }> = ({
  error,
  onRetry,
  source,
}) => {
  const { t } = useTranslation();
  const denied = isDenied(error);
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
      <div className="flex items-start gap-2 text-xs text-red-400">
        {denied ? (
          <Lock className="w-3 h-3 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
        )}
        <span>
          {denied
            ? t("manager.support_ai.not_permitted", { source })
            : t("manager.support_ai.could_not_load", { source })}
          <span className="block text-[10px] text-muted-foreground">{errorText(error)}</span>
        </span>
      </div>
      {!denied && onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs border-border shrink-0"
          onClick={onRetry}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          {t("manager.console.retry")}
        </Button>
      )}
    </div>
  );
};

/** Renders loading / error / empty / content for one query-backed list. */
export function QueryRows<T>({
  query,
  source,
  rows,
  empty,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  source: string;
  rows: T[];
  empty: React.ReactNode;
  children: (rows: T[]) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingRow />;
  if (query.isError)
    return <ErrorRow error={query.error} source={source} onRetry={() => void query.refetch()} />;
  if (!rows.length) return <EmptyRow>{empty}</EmptyRow>;
  return <>{children(rows)}</>;
}
