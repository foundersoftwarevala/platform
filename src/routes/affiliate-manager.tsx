import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { TopBar } from "@/components/affiliate/TopBar";
import { AppSidebar, useSidebarState } from "@/components/affiliate/AppSidebar";
import { useAffiliateRealtimeSync } from "@/lib/affiliate-realtime";
import { permissionForPath, usePermissions } from "@/lib/affiliate-permissions";
import { PermissionGate } from "@/components/affiliate/PermissionGate";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/affiliate-manager")({
  head: () => ({
    meta: [
      { title: "Affiliate Manager — Software Vala Boss Panel" },
      { name: "description", content: "Global affiliate, referral, commission and payout control center." },
    ],
  }),
  component: AffiliateManagerLayout,
  errorComponent: WallError,
  notFoundComponent: WallNotFound,
});

/** Wall-level failure surface so one broken workspace never blanks the panel. */
function WallError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div
        role="alert"
        className="w-full max-w-md rounded-lg border border-destructive/30 bg-surface p-6 text-center"
      >
        <AlertTriangle className="mx-auto mb-3 size-8 text-destructive" aria-hidden="true" />
        <h1 className="font-display text-lg font-semibold">This workspace failed to load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "An unexpected error occurred while loading affiliate data."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload panel
          </Button>
        </div>
      </div>
    </div>
  );
}

function WallNotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-lg font-semibold">Workspace not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The wall you requested does not exist. Use the top bar or ⌘K to jump to a workspace.
        </p>
      </div>
    </div>
  );
}

function AffiliateManagerLayout() {
  const { data: perms } = usePermissions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useAffiliateRealtimeSync(!!perms?.is_boss);
  const required = permissionForPath(pathname);
  const sidebar = useSidebarState();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <AppSidebar
        collapsed={sidebar.collapsed}
        onToggleCollapsed={sidebar.toggleCollapsed}
        mobileOpen={sidebar.mobileOpen}
        onCloseMobile={() => sidebar.setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => sidebar.setMobileOpen(true)} />
        <main id="main" className="min-w-0 flex-1">
          {required ? (
            <PermissionGate permission={required}>
              <Outlet />
            </PermissionGate>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
