import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  WifiOff,
  Inbox,
} from "lucide-react";
import { diagnoseDataAccess } from "@/lib/data-access";
import { useDataRetry, useRegisterRetry } from "@/hooks/useDataRetry";
import PermissionDiagnosticsDialog from "./PermissionDiagnosticsDialog";

interface DataStateNoticeProps {
  isLoading?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  /** Whether a backend session exists — sharpens the permission copy. */
  hasSession?: boolean;
  /** Human name of the data being read, e.g. "demo requests". */
  resource?: string;
  loadingLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  onRetry?: () => void;
  children?: ReactNode;
}

/**
 * Single place that renders loading / permission-denied / error / empty states
 * for every Demo Manager panel, so an RLS block never masquerades as
 * "no records yet". Each panel's retry also joins the shared recheck flow.
 */
export function DataStateNotice({
  isLoading,
  error,
  isEmpty,
  hasSession,
  resource = "this data",
  loadingLabel = "Loading live data…",
  emptyTitle = "Nothing here yet",
  emptyDescription = "No records found for this view.",
  emptyIcon,
  onRetry,
  children,
}: DataStateNoticeProps) {
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { retryAll, isRetrying, registered } = useDataRetry();
  useRegisterRetry(onRetry);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{loadingLabel}</p>
      </div>
    );
  }

  if (error) {
    const diagnosis = diagnoseDataAccess(error, { hasSession, resource });
    const gated = diagnosis.kind === "permission" || diagnosis.kind === "auth";
    const Icon =
      diagnosis.kind === "permission"
        ? ShieldAlert
        : diagnosis.kind === "auth"
          ? Lock
          : diagnosis.kind === "network"
            ? WifiOff
            : AlertTriangle;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="py-8 flex justify-center"
      >
        <Card
          className={
            gated
              ? "max-w-xl w-full bg-amber-500/5 border-amber-500/30 backdrop-blur-xl"
              : "max-w-xl w-full bg-destructive/5 border-destructive/30 backdrop-blur-xl"
          }
        >
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center ${
                  gated ? "bg-amber-500/15" : "bg-destructive/15"
                }`}
              >
                <Icon className={`w-6 h-6 ${gated ? "text-amber-400" : "text-destructive"}`} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-foreground">{diagnosis.title}</h3>
                  {gated && (
                    <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]">
                      ACCESS POLICY
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{diagnosis.message}</p>
              </div>
            </div>

            <div className="rounded-lg bg-background/40 border border-border/50 p-4">
              <p className="text-xs font-medium text-foreground mb-2">Next steps</p>
              <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                {diagnosis.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry this panel
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => void retryAll()}
                disabled={isRetrying || registered === 0}
              >
                {isRetrying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {isRetrying ? "Rechecking…" : `Recheck all${registered ? ` (${registered})` : ""}`}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDiagnosticsOpen(true)}>
                <Stethoscope className="w-4 h-4 mr-2" />
                Diagnostics
              </Button>
            </div>

            {diagnosis.raw && (
              <details className="text-xs text-muted-foreground/80">
                <summary className="cursor-pointer select-none">Technical detail</summary>
                <code className="mt-2 block break-all rounded bg-background/60 p-2">
                  {diagnosis.raw}
                </code>
              </details>
            )}
          </CardContent>
        </Card>

        <PermissionDiagnosticsDialog
          open={diagnosticsOpen}
          onOpenChange={setDiagnosticsOpen}
          diagnosis={diagnosis}
          resource={resource}
          hasSession={hasSession}
          onRetry={onRetry ?? (() => void retryAll())}
        />
      </motion.div>
    );
  }


  if (isEmpty) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
          {emptyIcon ?? <Inbox className="w-8 h-8 text-muted-foreground" />}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{emptyTitle}</h3>
        <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        {onRetry && (
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        )}
      </motion.div>
    );
  }

  return <>{children}</>;
}

export default DataStateNotice;
