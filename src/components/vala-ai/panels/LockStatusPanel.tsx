import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/language-catalog";
import { updateAiLockState } from "@/lib/ai/ai.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { lockQuery } from "../queries";
import { PanelHeader, PanelSkeleton } from "../shared";

export function LockStatusPanel() {
  const { translate: t } = useLanguage();
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(lockQuery);
  const mutation = useMutation({
    mutationFn: (locked: boolean) => updateAiLockState({ data: { locked } }),
    onSuccess: (res) => {
      queryClient.setQueryData(lockQuery.queryKey, res);
      toast.success(res.data.locked ? t("Lock re-armed") : t("Lock disabled — changes are live"));
    },
    onError: (e: Error) => toast.error(`${t("Could not update lock state")}: ${e.message}`),
  });
  if (isPending || !data) return <PanelSkeleton />;

  const state = data.data;

  return (
    <div className="space-y-6">
      <PanelHeader
        title={t("Lock Status")}
        description={t("Inspect and change VALA AI write lock state.")}
        icon={Lock}
        source={data.source}
      />
      <div className="rounded-xl border border-border bg-surface/70 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t("System Lock")}</h2>
            <p className="text-sm text-muted-foreground">{state.reason ?? t("No reason")}</p>
          </div>
          <Badge
            variant="outline"
            className={
              state.locked ? "border-success/50 text-success" : "border-warning/50 text-warning"
            }
          >
            {state.locked ? t("Active") : t("Disabled")}
          </Badge>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant={state.locked ? "default" : "outline"}
            disabled={mutation.isPending || !data.available}
            onClick={() => mutation.mutate(!state.locked)}
          >
            {" "}
            {state.locked ? (
              <Unlock className="mr-2 size-4" />
            ) : (
              <Lock className="mr-2 size-4" />
            )}{" "}
            {state.locked ? t("Unlock") : t("Arm lock")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t("Changed by")} {state.changedBy ?? t("nobody yet")} •{" "}
            {state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
