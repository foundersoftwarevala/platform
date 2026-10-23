import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { RequireRole } from "@/components/auth/RequireRole";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";

export function ResearchModule() {
  const { t } = useTranslation();
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
            .map((query) => query.state.error?.message ?? t("rd.data_load_failed")),
        ),
      ].join("\n"),
    [cache, t],
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
          aria-label={t("rd.module_label")}
          className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3 text-sm"
        >
          <Link to="/control-panel">{t("rd.control_panel")}</Link>
          <Link to="/rd-manager">{t("rd.opportunities")}</Link>
          <Link to="/rd-manager/lab">{t("rd.workspace")}</Link>
          <Link to="/rd-manager/pro-manager">{t("rd.pro_manager")}</Link>
          <Link to="/rd-manager/start" search={{}}>
            {t("rd.submit_request")}
          </Link>
          <Link to="/rd-manager/track">{t("rd.track_request")}</Link>
        </nav>
        {errors && (
          <div
            role="alert"
            className="border-b border-danger/40 bg-danger/10 px-5 py-3 text-sm text-danger"
          >
            <p className="font-semibold">
              {t("rd.data_unavailable")}
            </p>
            <p className="whitespace-pre-wrap">{errors}</p>
          </div>
        )}
        <Outlet />
      </div>
    </RequireRole>
  );
}
