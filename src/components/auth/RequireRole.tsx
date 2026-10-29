import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";

function normalizeRole(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Platform operators reach every guarded workspace. Without this an admin or the
 * boss would be refused from a console whose narrow role they do not personally
 * hold, which is how people end up removing guards altogether.
 */
const OPERATOR_ROLES = ["boss", "boss_owner", "admin", "super_admin", "founder", "owner"];

export function RequireRole({
  role,
  children,
  allowOperators = true,
}: {
  role: string | string[];
  children: ReactNode;
  /** Set false for a workspace that must exclude even platform operators. */
  allowOperators?: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const allowedRoles = Array.isArray(role) ? role : [role];
  const roleKey = [...allowedRoles, ...(allowOperators ? OPERATOR_ROLES : [])]
    .map(normalizeRole)
    .join("\u0000");

  useEffect(() => {
    let active = true;
    let checkId = 0;
    const allowed = new Set(roleKey.split("\u0000"));

    const checkRoles = async (userId: string) => {
      const currentCheck = ++checkId;
      if (active) setState("loading");
      try {
        const { data: rows, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (!active || currentCheck !== checkId) return;
        if (error) {
          console.error("[auth] Could not verify workspace roles:", error);
          setState("error");
          return;
        }

        const hasAccess = rows?.some((row) => allowed.has(normalizeRole(row.role))) ?? false;
        setState(hasAccess ? "allowed" : "denied");
      } catch (error) {
        if (!active || currentCheck !== checkId) return;
        console.error("[auth] Workspace role verification failed:", error);
        setState("error");
      }
    };

    const resolveSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) {
          console.error("[auth] Could not restore the workspace session:", error);
          setState("error");
          return;
        }
        if (!data.session?.user) {
          setState("denied");
          return;
        }
        await checkRoles(data.session.user.id);
      } catch (error) {
        if (!active) return;
        console.error("[auth] Workspace session resolution failed:", error);
        setState("error");
      }
    };

    const { data: authSubscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        checkId += 1;
        setState("denied");
      } else if (
        session?.user &&
        ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event)
      ) {
        void checkRoles(session.user.id);
      }
    });

    void resolveSession();
    return () => {
      active = false;
      checkId += 1;
      authSubscription.subscription.unsubscribe();
    };
  }, [roleKey, retry]);

  if (state === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        {t("auth.access.checking")}
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <section className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">{t("auth.access.checking")}</h1>
          <p className="text-sm text-muted-foreground">
            Could not verify your saved session and workspace role. Your session has not been
            rejected.
          </p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <section className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">{t("auth.access.restricted")}</h1>
          <p className="text-sm text-muted-foreground">{t("auth.access.missing_role")}</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/login" })}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("auth.access.return")}
          </button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
