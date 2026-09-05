/**
 * PERMISSION DIAGNOSTICS MODAL
 * ============================
 * Explains exactly which RLS / privilege error the backend returned for a
 * Demo Manager read, and lists the database policies and grants to verify.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Database, RefreshCw, ShieldAlert } from "lucide-react";
import type { DataAccessDiagnosis } from "@/lib/data-access";

interface PermissionDiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagnosis: DataAccessDiagnosis;
  resource: string;
  hasSession?: boolean;
  onRetry?: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 px-2 text-xs text-muted-foreground"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {copied ? "Copied" : "Copy SQL"}
    </Button>
  );
}

export function PermissionDiagnosticsDialog({
  open,
  onOpenChange,
  diagnosis,
  resource,
  hasSession,
  onRetry,
}: PermissionDiagnosticsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            Permission diagnostics
          </DialogTitle>
          <DialogDescription>
            What the backend reported while loading {resource}, and what to verify in the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] uppercase">
              {diagnosis.kind}
            </Badge>
            {diagnosis.code && (
              <Badge variant="outline" className="text-[10px] font-mono">
                code {diagnosis.code}
              </Badge>
            )}
            {typeof diagnosis.status === "number" && (
              <Badge variant="outline" className="text-[10px] font-mono">
                HTTP {diagnosis.status}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              session: {hasSession ? "active" : "none"}
            </Badge>
          </div>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">What happened</h4>
            <p className="text-sm text-muted-foreground">{diagnosis.explanation}</p>
            {diagnosis.details && (
              <p className="text-xs text-muted-foreground/90">
                <span className="font-medium text-foreground">Details: </span>
                {diagnosis.details}
              </p>
            )}
            {diagnosis.hint && (
              <p className="text-xs text-muted-foreground/90">
                <span className="font-medium text-foreground">Backend hint: </span>
                {diagnosis.hint}
              </p>
            )}
          </section>

          {diagnosis.checks.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Verify these policies and grants
              </h4>
              <ol className="space-y-3">
                {diagnosis.checks.map((check, index) => (
                  <li
                    key={check.label}
                    className="rounded-lg border border-border/60 bg-background/40 p-3 space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{check.label}</p>
                        <p className="text-xs text-muted-foreground">{check.detail}</p>
                      </div>
                    </div>
                    {check.sql && (
                      <div className="space-y-1">
                        <pre className="overflow-x-auto rounded bg-background/70 p-2 text-[11px] leading-relaxed text-muted-foreground">
                          <code>{check.sql}</code>
                        </pre>
                        <CopyButton value={check.sql} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Next steps</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
              {diagnosis.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>

          {diagnosis.raw && (
            <section className="space-y-1">
              <h4 className="text-sm font-semibold text-foreground">Raw backend response</h4>
              <code className="block break-all rounded bg-background/70 p-2 text-[11px] text-muted-foreground">
                {diagnosis.raw}
              </code>
            </section>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onRetry && (
            <Button
              size="sm"
              onClick={() => {
                onRetry();
                onOpenChange(false);
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recheck now
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PermissionDiagnosticsDialog;
