import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { TopBar } from "./TopBar";
import { WorkspaceBar } from "./WorkspaceBar";
import { AppSidebar, useSidebarState } from "./AppSidebar";
import { PageBanner } from "./PageBanner";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();

  return (
    <div className="flex min-h-dvh w-full">
      <AppSidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <PageBanner />
            <WorkspaceBar />
            {/* Route key restarts the entrance transition on navigation. */}
            <div key={pathname} className="motion-rise">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
