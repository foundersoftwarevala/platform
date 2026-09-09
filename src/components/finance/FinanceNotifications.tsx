import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck } from "lucide-react";

import { alertsQuery } from "@/lib/finance/queries";
import { useUpdateAlert } from "@/lib/finance/mutations";
import { relativeTime } from "@/lib/finance/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function FinanceNotifications({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const alertsState = useQuery(alertsQuery());
  const updateAlert = useUpdateAlert();
  const alerts = alertsState.data ?? [];
  const unread = useMemo(() => alerts.filter((alert) => alert.status === "unread" || alert.status === "open"), [alerts]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Finance Notifications</SheetTitle>
          <SheetDescription>{unread.length} alerts require review</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{alert.title}</p>
                    <Badge variant="outline" className="capitalize">{alert.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{alert.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{relativeTime(alert.created_at)}</p>
                  {(alert.status === "unread" || alert.status === "open") && (
                    <Button variant="ghost" size="sm" className="mt-2 gap-1" disabled={updateAlert.isPending} onClick={() => updateAlert.mutate({ id: alert.id, status: "acknowledged" })}>
                      <CheckCheck className="h-3.5 w-3.5" /> Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}