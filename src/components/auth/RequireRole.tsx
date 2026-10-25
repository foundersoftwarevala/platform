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
const OPERATOR_ROLES = ["boss", "boss_owner", "admin", "super_admin", "founder"];

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
  const [retryCount, setRetryCount] = useState(0);
  const allowedRoles = Array.isArray(role) ? role : [role];
  const allowedRoleKey = [...allowedRoles, ...(allowOperators ? OPERATOR_ROLES : [])]
    .map(normalizeRole)
    .join(",");

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    const fail = (error: unknown) => {
      console.error("[RequireRole] Access verification failed:", error);
      if (active) setState("error");
    };

    try {
      const { data: authSubscription } = supabase.auth.onAuthStateChange((event) => {
        if (active && event === "SIGNED_OUT") setState("denied");
      });
      unsubscribe = () => authSubscription.subscription.unsubscribe();

      void (async () => {
        try {
          const normalizedAllowed = new Set(allowedRoleKey.split(","));
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError && userError.name !== "AuthSessionMissingError") throw userError;
          if (!userData.user) {
            if (active) setState("denied");
            return;
          }

          const { data: rows, error: rolesError } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userData.user.id);
          if (rolesError) throw rolesError;

          const allowed =
            rows?.some((row) => normalizedAllowed.has(normalizeRole(row.role))) ?? false;
          if (active) setState(allowed ? "allowed" : "denied");
        } catch (error) {
          fail(error);
        }
      })();
    } catch (error) {
      fail(error);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [allowedRoleKey, retryCount]);

  if (state === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">
        {t("auth.access.checking")}
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

  if (state === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <section className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">{t("auth.access.verification_failed")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.access.verification_failed_body")}
          </p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setRetryCount((count) => count + 1);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            {t("auth.access.retry")}
          </button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
