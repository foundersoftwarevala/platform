import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/language-catalog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { snapshotsQuery } from "../queries";
import { EmptyState, PanelHeader, PanelSkeleton, relativeTime } from "../shared";

export function RollbackPanel() {
  const { translate: t } = useLanguage();
  const { data, isPending } = useQuery(snapshotsQuery);
  const [target, setTarget] = useState<any | null>(null);
  if (isPending || !data) return <PanelSkeleton />;

  const snapshots = data.data ?? [];

  return (
    <div className="space-y-6">
      <PanelHeader title={t("Rollback Trigger")} description={t("Approve a previous stable snapshot before restoring it.")} icon={RotateCcw} source={data.source} />
      {snapshots.length === 0 ? <EmptyState message={t("No snapshots recorded.")} /> : (
        <ul className="space-y-3">
          {(snapshots as any[]).map((snapshot) => (
            <li key={snapshot.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/70 p-4">
              <div>
                <div className="font-semibold">{snapshot.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{snapshot.projectTitle ?? t("Platform-wide")} • {relativeTime(snapshot.createdAt)} • {snapshot.sizeKb.toLocaleString()} KB</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setTarget(snapshot)}><RotateCcw className="mr-2 size-4" />{t("Rollback")}</Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Confirm rollback")}</AlertDialogTitle>
            <AlertDialogDescription>{t("This restores the platform to \"{label}\". All changes made after this snapshot will be reverted.").replace("{label}", target?.label ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { window.alert(t("Boss approval required for rollback execution")); setTarget(null); }}>{t("Request Boss Approval")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
