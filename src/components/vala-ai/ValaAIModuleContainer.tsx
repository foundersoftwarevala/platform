import { Outlet } from "@tanstack/react-router";
import { Loader2, LogIn, ShieldOff } from "lucide-react";
import { useLanguage } from "@/lib/language-catalog";
import { EXISTING_LOGIN_URL } from "@/lib/auth-bridge";
import { cn } from "@/lib/utils";
import { useApi, type Operator } from "./api";
import { OperatorContext } from "./session";
import { ErrorBox } from "./ui";
import { ValaAISidebar } from "./ValaAISidebar";
import { useSidebarState } from "./nav";
import { ValaTopBar } from "./ValaTopBar";

export function ValaAIModuleContainer() {
  const { translate: t } = useLanguage();
  const session = useApi<{ operator: Operator | null }>(["session"], "/session");
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();

  if (session.isPending)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("Loading Vala AI…")}
      </div>
    );
  if (session.error?.status === 403)
    return <Notice icon={ShieldOff} title={t("No Vala AI access")} body={session.error.message} />;
  if (session.error)
    return (
      <div className="min-h-screen bg-background p-6">
        <ErrorBox error={session.error} />
      </div>
    );
  if (!session.data.operator)
    return (
      <Notice
        icon={LogIn}
        title={t("Sign in to the Control Panel")}
        body={t(
          "Vala AI is operated from the Control Panel. Sign in there and open Vala AI again.",
        )}
        login
      />
    );
  const operator = session.data.operator;

  return (
    <OperatorContext.Provider value={operator}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
            collapsed ? "w-[72px]" : "w-[248px]",
          )}
        >
          <ValaAISidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        </aside>
        {mobileOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              className="absolute inset-0 bg-background/70 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-label={t("Close menu overlay")}
            />
            <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] border-r border-border bg-background shadow-2xl">
              <ValaAISidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <ValaTopBar onOpenMenu={() => setMobileOpen(true)} operator={operator} />
          <main className="min-h-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </OperatorContext.Provider>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
  login = false,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  login?: boolean;
}) {
  const { translate: t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/70 p-6 text-center shadow-xl">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-lg font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex justify-center gap-2">
          {login ? (
            <a
              href={`${EXISTING_LOGIN_URL}?redirect=${encodeURIComponent("/vala-ai")}`}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              {t("Sign in")}
            </a>
          ) : null}
          <a href="/control-panel" className="rounded-lg border border-border px-3 py-2 text-sm">
            {t("Control Panel")}
          </a>
        </div>
      </div>
    </div>
  );
}

export default ValaAIModuleContainer;
