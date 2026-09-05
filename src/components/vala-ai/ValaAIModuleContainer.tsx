import { Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-catalog";
import { ValaAISidebar, useActiveValaSection, useSidebarState } from "./ValaAISidebar";
import { ValaTopBar } from "./ValaTopBar";

export function ValaAIModuleContainer() {
  const { translate: t } = useLanguage();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const current = useActiveValaSection();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isCommandCenter = current.id === "command-center";

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex", collapsed ? "w-[72px]" : "w-[264px]")}> 
        <ValaAISidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label={t("Close menu overlay")} />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-border bg-background shadow-2xl">
            <ValaAISidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <ValaTopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className={isCommandCenter ? "h-[calc(100vh-3.5rem)]" : ""}>
              <div className="min-h-[calc(100vh-3.5rem)]">
                <Outlet />
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default ValaAIModuleContainer;
