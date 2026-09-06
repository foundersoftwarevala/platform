import { createFileRoute, Outlet } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { CelebrationProvider } from "@/components/ams/effects/Celebration";
import { AppShell } from "@/components/layout/AppShell";
import { RouteHistoryPanel, RouteHistoryProvider } from "@/components/layout/RouteHistory";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * AMS Manager — the shell every AMS screen renders inside.
 *
 * Software Vala already carried all 76 screens of the AMS module, its component
 * tree and its libraries, but it had no layout route: each screen rendered on
 * its own with no sidebar, no top bar, no workspace bar and no way to get from
 * one to another. The module was present and unusable.
 *
 * This is the reference application's `_authenticated/route.tsx`, reproduced:
 * the same providers in the same order — tooltips, route history, celebration —
 * wrapping the same AppShell, with the same route-history panel and toaster.
 * The reference mounts it at the site root because there the AMS module is the
 * whole application; here it mounts at /ams, which is where these screens
 * already live, so every one of them becomes a child of this layout.
 *
 * Access uses Software Vala's own RBAC rather than a second auth system. The
 * reference's own comment says as much — "Auth is handled by the parent
 * Software Vala application" — and this is that parent. `RouteAccessGate`
 * already guards the /ams prefix for the same roles; this is the second lock,
 * matching how every other operator console in the project is protected.
 */
export const Route = createFileRoute("/ams")({
  head: () => ({
    meta: [
      { title: "AMS Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Achievement Management System: awards, badges, trophies, certificates, progression, missions, rewards, leaderboards and vaults.",
      },
      { property: "og:title", content: "AMS Manager — Software Vala" },
      {
        property: "og:description",
        content:
          "Run recognition end to end — awards, progression, missions, rewards and leaderboards.",
      },
      // An operator console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AmsManagerLayout,
});

function AmsManagerLayout() {
  return (
    <RequireRole role={["developer", "support"]}>
      <TooltipProvider delayDuration={250}>
        <RouteHistoryProvider>
          <CelebrationProvider>
            <AppShell>
              <Outlet />
            </AppShell>
            <RouteHistoryPanel />
            <Toaster richColors position="bottom-right" />
          </CelebrationProvider>
        </RouteHistoryProvider>
      </TooltipProvider>
    </RequireRole>
  );
}
