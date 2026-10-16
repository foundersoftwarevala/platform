import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

export function ResearchModule() {
  const pathname = useRouterState({ select: (state) => state.location.pathname }).replace(
    /\/$/,
    "",
  );
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((notify: () => void) => cache.subscribe(notify), [cache]);
  const snapshot = useCallback(
    () =>
      [
        ...new Set(
          cache
            .getAll()
            .filter(
              (query) =>
                ["rnd", "pm", "rd-manager"].includes(String(query.queryKey[0])) &&
                query.getObserversCount() > 0 &&
                query.state.status === "error",
            )
            .map((query) => query.state.error?.message ?? "R&D data could not be loaded."),
        ),
      ].join("\n"),
    [cache],
  );
  const errors = useSyncExternalStore(subscribe, snapshot, () => "");
  if (pathname === "/rd-manager/start" || pathname === "/rd-manager/track") {
    return (
      <div className="rd-module rd-module-shell">
        <Outlet />
      </div>
    );
  }
  return (
    <RequireRole role={["boss", "boss_owner", "admin", "super_admin", "founder", "owner"]}>
      <div className="rd-module rd-module-shell">
        <nav
          aria-label="R&D module"
          className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3 text-sm"
        >
          <Link to="/control-panel">Control Panel</Link>
          <Link to="/rd-manager">Opportunities</Link>
          <Link to="/rd-manager/lab">R&D Workspace</Link>
          <Link to="/rd-manager/pro-manager">Pro Manager</Link>
          <Link to="/rd-manager/start" search={{}}>
            Submit request
          </Link>
          <Link to="/rd-manager/track">Track request</Link>
        </nav>
        {errors && (
          <div
            role="alert"
            className="border-b border-danger/40 bg-danger/10 px-5 py-3 text-sm text-danger"
          >
            <p className="font-semibold">
              R&amp;D data unavailable. Check the module migration and platform connection.
            </p>
            <p className="whitespace-pre-wrap">{errors}</p>
          </div>
        )}
        <Outlet />
      </div>
    </RequireRole>
  );
}
