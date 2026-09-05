import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, XCircle, Download } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { BulkAction } from "@/lib/affiliate-bulk";
import { downloadCsv } from "@/lib/affiliate-bulk";
import { usePermissions, can, BULK_ACTION_PERMISSIONS } from "@/lib/affiliate-permissions";
import { logAudit } from "@/lib/affiliate-audit";
import { Lock } from "lucide-react";

type Phase = "confirm" | "running" | "done";

export function BulkActionDialog({
  open,
  onOpenChange,
  action,
  selectedCount,
  scopeLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: BulkAction | null;
  selectedCount: number;
  scopeLabel: string;
}) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [confirmText, setConfirmText] = useState("");
  const [stats, setStats] = useState({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("confirm");
      setProgress(0);
      setStats({ processed: 0, succeeded: 0, failed: 0, skipped: 0 });
      setConfirmText("");
      if (timer.current) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    }
  }, [open]);

  const { data: perms } = usePermissions();
  if (!action) return null;

  const requiredPerm = BULK_ACTION_PERMISSIONS[action.id];
  const allowed = !requiredPerm || can(perms, requiredPerm) || perms?.roles.includes("admin");
  const needsTyping = action.destructive;
  const canConfirm = allowed && (!needsTyping || confirmText.trim().toUpperCase() === "CONFIRM");
  const Icon = action.icon;

  function run() {
    if (!action) return;
    setPhase("running");
    const total = Math.max(selectedCount, 1);
    const tickMs = 200;
    const perTick = Math.max(1, Math.round((action.estimatedRate * tickMs) / 1000));
    let processed = 0;
    timer.current = window.setInterval(() => {
      processed = Math.min(total, processed + perTick);
      const pct = Math.round((processed / total) * 100);
      setProgress(pct);
      const failed = Math.round(processed * 0.012);
      const skipped = Math.round(processed * 0.006);
      setStats({ processed, failed, skipped, succeeded: processed - failed - skipped });
      if (processed >= total) {
        if (timer.current) window.clearInterval(timer.current);
        timer.current = null;
        setPhase("done");
        const failedNow = Math.round(processed * 0.012);
        const skippedNow = Math.round(processed * 0.006);
        void logAudit(`bulk.${action!.id}`, scopeLabel, {
          selected: selectedCount,
          succeeded: processed - failedNow - skippedNow,
          failed: failedNow,
          skipped: skippedNow,
          permission: BULK_ACTION_PERMISSIONS[action!.id] ?? null,
        });
      }
    }, tickMs);
  }

  function cancel() {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    onOpenChange(false);
  }

  function downloadReport() {
    const lines = [
      `action,${action!.id}`,
      `scope,${scopeLabel}`,
      `processed,${stats.processed}`,
      `succeeded,${stats.succeeded}`,
      `failed,${stats.failed}`,
      `skipped,${stats.skipped}`,
      "",
      "row,record_id,status,error",
    ];
    for (let i = 1; i <= stats.failed; i++) {
      lines.push(`${i},REC-${1000 + i},failed,Validation error: required field missing`);
    }
    downloadCsv(`bulk-${action!.id}-report.csv`, lines.join("\n") + "\n");
  }

  const tone =
    action.tone === "destructive"
      ? "text-destructive bg-destructive/10"
      : action.tone === "warning"
      ? "text-warning-foreground bg-warning/15"
      : action.tone === "success"
      ? "text-success bg-success/10"
      : "text-primary bg-primary-soft";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4 space-y-1">
          <div className="flex items-center gap-3">
            <div className={`grid size-9 place-items-center rounded-md ${tone}`}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-base">{action.label}</DialogTitle>
              <DialogDescription className="text-xs">
                {selectedCount.toLocaleString()} {scopeLabel} selected
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-muted-foreground">{action.description}</p>
            {!allowed && requiredPerm && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive flex gap-2">
                <Lock className="size-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">403 — permission required</div>
                  <div className="mt-0.5">
                    Your role ({perms?.roles.join(", ") || "none"}) does not include{" "}
                    <span className="font-mono">{requiredPerm}</span>. Ask an admin to grant it before running this action.
                  </div>
                </div>
              </div>
            )}
            {action.destructive && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[12px] text-destructive flex gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <div>
                  This action cannot be undone. An audit log entry will be created and assigned to your
                  operator account.
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <Stat label="Records" value={selectedCount.toLocaleString()} />
              <Stat label="Est. duration" value={`${Math.max(1, Math.round(selectedCount / action.estimatedRate))}s`} />
              <Stat label="Rate limit" value={`${action.estimatedRate}/s`} />
            </div>
            {needsTyping && (
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-foreground">
                  Type <span className="font-mono">CONFIRM</span> to proceed
                </label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="CONFIRM"
                  className="h-9"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {phase === "running" && (
          <div className="px-5 py-5 space-y-4" role="status" aria-live="polite" aria-atomic="false">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" /> Processing batch…
            </div>
            <Progress
              value={progress}
              className="h-2"
              aria-label="Bulk action progress"
              aria-valuenow={Math.round(progress)}
            />
            <span className="sr-only">
              {`Progress ${Math.round(progress)} percent. ${stats.processed} processed, ${stats.succeeded} succeeded, ${stats.failed} failed.`}
            </span>
            <div className="grid grid-cols-4 gap-2 text-[12px]">
              <Stat label="Processed" value={stats.processed.toLocaleString()} />
              <Stat label="Succeeded" value={stats.succeeded.toLocaleString()} tone="success" />
              <Stat label="Skipped" value={stats.skipped.toLocaleString()} />
              <Stat label="Failed" value={stats.failed.toLocaleString()} tone="destructive" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              You can close this dialog — the batch will continue in the background and notify you on
              completion.
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center gap-2">
              {stats.failed > 0 ? (
                <XCircle className="size-5 text-destructive" />
              ) : (
                <CheckCircle2 className="size-5 text-success" />
              )}
              <div className="font-display text-sm font-semibold">
                {stats.failed > 0 ? "Completed with errors" : "Completed successfully"}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-[12px]">
              <Stat label="Processed" value={stats.processed.toLocaleString()} />
              <Stat label="Succeeded" value={stats.succeeded.toLocaleString()} tone="success" />
              <Stat label="Skipped" value={stats.skipped.toLocaleString()} />
              <Stat label="Failed" value={stats.failed.toLocaleString()} tone="destructive" />
            </div>
            {stats.failed > 0 && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-[12px]">
                <div className="font-medium text-foreground mb-1">Top errors</div>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Validation error: required field missing ({Math.round(stats.failed * 0.6)})</li>
                  <li>• Conflict: record locked by another operator ({Math.round(stats.failed * 0.25)})</li>
                  <li>• Provider rejected: KYC incomplete ({Math.round(stats.failed * 0.15)})</li>
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-border bg-muted/30 px-5 py-3">
          {phase === "confirm" && (
            <>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant={action.destructive ? "destructive" : "default"}
                disabled={!canConfirm}
                onClick={run}
              >
                Run {action.label}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button variant="outline" size="sm" onClick={cancel}>
              Run in background
            </Button>
          )}
          {phase === "done" && (
            <>
              <Button variant="outline" size="sm" onClick={downloadReport} className="gap-1.5">
                <Download className="size-3.5" /> Download report
              </Button>
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 font-display text-sm font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}
