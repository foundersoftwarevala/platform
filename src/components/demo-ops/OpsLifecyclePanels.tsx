/**
 * OPS — EXPIRY / RENEWAL / CLEANUP / ARCHIVE + BACKUP & RESTORE
 */

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Archive, CalendarClock, DatabaseBackup, RotateCcw, Trash2 } from "lucide-react";
import { DataStateNotice } from "@/components/demo-manager/DataStateNotice";
import { useAuth } from "@/hooks/useAuth";
import { MonitorGap, OpsSection } from "./OpsPrimitives";
import { useOpsActions, useOpsBackups, useOpsDemos, useOpsRenewals } from "@/hooks/useDemoOps";
import { daysUntil, relativeTime } from "@/lib/demo-ops";
import { cn } from "@/lib/utils";

export function OpsLifecyclePanel() {
  const { user } = useAuth();
  const demosQuery = useOpsDemos();
  const renewalsQuery = useOpsRenewals();
  const { renewDemo, setLifecycle } = useOpsActions();
  const [tab, setTab] = useState<"expiring" | "expired" | "archived">("expiring");

  const demos = demosQuery.data ?? [];
  const buckets = useMemo(() => {
    const expiring = demos.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days >= 0 && days <= 14;
    });
    const expired = demos.filter((d) => {
      const days = daysUntil(d.expiry_date);
      return days !== null && days < 0;
    });
    const archived = demos.filter((d) => ["archived", "retired"].includes(d.lifecycle_status ?? ""));
    return { expiring, expired, archived };
  }, [demos]);

  const visible = buckets[tab];

  return (
    <OpsSection
      title="Demo Expiry, Renewal, Cleanup & Archive"
      description="Reads expiry_date and lifecycle_status from demos; renewals write a real row to demo_renewal_logs."
      icon={CalendarClock}
      actions={
        <div className="flex gap-1">
          {(["expiring", "expired", "archived"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[10px] font-mono uppercase",
                tab === key
                  ? "border-neon-teal/50 bg-neon-teal/10 text-neon-teal"
                  : "border-border/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {key} · {buckets[key].length}
            </button>
          ))}
        </div>
      }
    >
      <div className="space-y-4">
        <DataStateNotice
          isLoading={demosQuery.isLoading}
          error={demosQuery.error}
          isEmpty={!demosQuery.isLoading && !demosQuery.error && visible.length === 0}
          hasSession={Boolean(user)}
          resource="demo lifecycle"
          emptyTitle={
            tab === "expiring" ? "Nothing expiring in 14 days" : tab === "expired" ? "No expired demos" : "No archived demos"
          }
          emptyDescription="Lifecycle buckets are computed from the expiry date and lifecycle status stored on each demo."
          onRetry={() => void demosQuery.refetch()}
        >
          <div className="space-y-2">
            {visible.slice(0, 40).map((demo) => {
              const days = daysUntil(demo.expiry_date);
              return (
                <div key={demo.id} className="rounded-lg border border-border/40 bg-background/40 p-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{demo.title}</p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {demo.expiry_date ? new Date(demo.expiry_date).toLocaleDateString() : "no expiry set"} ·{" "}
                      {demo.lifecycle_status ?? "lifecycle unset"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px]",
                      days !== null && days < 0
                        ? "border-red-500/40 text-red-400"
                        : days !== null && days <= 7
                          ? "border-amber-500/40 text-amber-400"
                          : "border-border/50",
                    )}
                  >
                    {days === null ? "—" : days < 0 ? `expired ${Math.abs(days)}d ago` : `${days}d left`}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={renewDemo.isPending}
                      onClick={() => renewDemo.mutate({ demo, days: 30 })}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Renew 30d
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      disabled={setLifecycle.isPending}
                      onClick={() => setLifecycle.mutate({ demo, lifecycle: "archived" })}
                    >
                      <Archive className="w-3 h-3 mr-1" />
                      Archive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] text-red-400 border-red-500/40 hover:bg-red-500/10"
                      disabled={setLifecycle.isPending}
                      onClick={() => setLifecycle.mutate({ demo, lifecycle: "retired" })}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Retire
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </DataStateNotice>

        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">Renewal history (demo_renewal_logs)</p>
          <DataStateNotice
            isLoading={renewalsQuery.isLoading}
            error={renewalsQuery.error}
            isEmpty={!renewalsQuery.isLoading && !renewalsQuery.error && (renewalsQuery.data ?? []).length === 0}
            hasSession={Boolean(user)}
            resource="renewal history"
            emptyTitle="No renewals recorded"
            emptyDescription="Every renewal performed here is written back to demo_renewal_logs."
            onRetry={() => void renewalsQuery.refetch()}
          >
            <ul className="space-y-1.5">
              {(renewalsQuery.data ?? []).slice(0, 12).map((row: any) => (
                <li key={row.id} className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span className="truncate">
                    {row.auto_renewed ? "AUTO" : "MANUAL"} · {row.previous_expiry?.slice(0, 10) ?? "—"} →{" "}
                    {row.new_expiry?.slice(0, 10) ?? "—"}
                  </span>
                  <span>{relativeTime(row.created_at)}</span>
                </li>
              ))}
            </ul>
          </DataStateNotice>
        </div>

        <MonitorGap
          title="Auto cleanup scheduler"
          requirement="Archiving and deleting expired demos is available here as an explicit action. Unattended cleanup needs a scheduled job that calls the same lifecycle update on a cron."
          fields={["cron job: nightly lifecycle sweep", "policy: retention_days per demo"]}
        />
      </div>
    </OpsSection>
  );
}

export function OpsBackupPanel() {
  const { user } = useAuth();
  const backupsQuery = useOpsBackups();
  const demosQuery = useOpsDemos();
  const withBackupUrl = (demosQuery.data ?? []).filter((d) => d.backup_url?.trim());

  return (
    <OpsSection
      title="Backup & Restore"
      description="Backup runs come from server_backups; per-demo fallback targets come from demos.backup_url."
      icon={DatabaseBackup}
    >
      <div className="space-y-4">
        <DataStateNotice
          isLoading={backupsQuery.isLoading}
          error={backupsQuery.error}
          isEmpty={!backupsQuery.isLoading && !backupsQuery.error && (backupsQuery.data ?? []).length === 0}
          hasSession={Boolean(user)}
          resource="backup runs"
          emptyTitle="No backup runs recorded"
          emptyDescription="Manual and automatic backups appear here once the backup service writes to server_backups."
          onRetry={() => void backupsQuery.refetch()}
        >
          <div className="space-y-2">
            {(backupsQuery.data ?? []).slice(0, 15).map((row: any) => (
              <div key={row.id} className="rounded-lg border border-border/40 bg-background/40 p-3 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{row.backup_name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    {row.backup_type} · {row.is_auto_backup ? "auto" : "manual"} · {row.size_gb ?? "—"} GB
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {row.status}
                </Badge>
                <span className="text-[10px] font-mono text-muted-foreground">{relativeTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        </DataStateNotice>

        <div className="rounded-lg border border-border/40 bg-background/40 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Demo fallback targets</p>
          <p className="text-[11px] text-muted-foreground">
            {withBackupUrl.length} of {(demosQuery.data ?? []).length} demos have a backup URL stored for instant
            failover.
          </p>
          <ul className="space-y-1">
            {withBackupUrl.slice(0, 8).map((d) => (
              <li key={d.id} className="text-[11px] font-mono text-muted-foreground truncate">
                {d.title} → {d.backup_url}
              </li>
            ))}
          </ul>
        </div>

        <MonitorGap
          title="Restore previous version"
          requirement="Restoring requires the backup service to expose a restore endpoint tied to a restore_point_id. Until it does, restores must be triggered from the infrastructure console."
          fields={["server_backups.restore_point_id", "restore endpoint + confirmation workflow"]}
        />
      </div>
    </OpsSection>
  );
}
