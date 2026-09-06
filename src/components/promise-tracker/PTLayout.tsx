import { useEffect, useState } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import { Menu, RadioTower, RefreshCw, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PTSidebar } from "./PTSidebar";
import { useTrackerRealtime, useTrackerMetrics } from "@/hooks/usePromiseTracker";

function RealtimeIndicator() {
  const { lastUpdate, status, lastError, retryNow } = useTrackerRealtime();
  const [mounted, setMounted] = useState(false);

  // Rendered only after hydration: the clock differs between server and client.
  useEffect(() => setMounted(true), []);

  const meta = {
    connecting: {
      label: "Connecting…",
      className: "border-border bg-muted/40 text-muted-foreground",
      icon: RadioTower,
    },
    live: {
      label: "Live",
      className: "border-success/30 bg-success/10 text-success",
      icon: RadioTower,
    },
    reconnecting: {
      label: "Reconnecting…",
      className: "border-warning/30 bg-warning/10 text-warning",
      icon: RefreshCw,
    },
    offline: {
      label: "Live updates offline",
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      icon: WifiOff,
    },
  }[status];

  const Icon = meta.icon;

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
          meta.className,
        )}
        title={lastError ?? undefined}
        data-testid="realtime-status"
        data-status={status}
      >
        <Icon className={cn("size-3.5", status === "reconnecting" && "animate-spin")} />
        {meta.label}
        {status === "live" && mounted && lastUpdate ? (
          <span className="hidden sm:inline">
            · {lastUpdate.toLocaleTimeString("en-GB", { hour12: false })}
          </span>
        ) : null}
      </span>
      {status === "offline" ? (
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={retryNow}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function PTLayout() {
  const [open, setOpen] = useState(false);
  const { metrics } = useTrackerMetrics();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <PTSidebar />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="size-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Promise Tracker navigation</SheetTitle>
              <PTSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <Link to="/promise-tracker" className="font-display text-sm font-semibold">
            Software Vala <span className="text-muted-foreground">/ Promise Tracker</span>
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
              <span>
                <span className="font-medium text-foreground">{metrics.active}</span> active
              </span>
              <span>
                <span className="font-medium text-destructive">{metrics.overdue}</span> overdue
              </span>
            </div>
            <RealtimeIndicator />
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
