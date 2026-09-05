import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function normalizeRole(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function RequireRole({ role, children }: {
  role: string | string[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");
  const allowedRoles = Array.isArray(role) ? role : [role];
  const normalizedAllowed = new Set(allowedRoles.map(normalizeRole));

  useEffect(() => {
    let active = true;
    const { data: authSubscription } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") setState("denied");
    });
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        if (active) setState("denied");
        return;
      }
      const { data: rows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);

      const allowed = rows?.some((row) => {
        const normalized = normalizeRole(row.role);
        return normalizedAllowed.has(normalized);
      }) ?? false;

      if (active) setState(allowed ? "allowed" : "denied");
    })();
    return () => {
      active = false;
      authSubscription.subscription.unsubscribe();
    };
  }, [allowedRoles.join(",")]);

  if (state === "loading") {
    return <main className="grid min-h-dvh place-items-center bg-background text-sm text-muted-foreground">Checking workspace access...</main>;
  }

  if (state === "denied") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
        <section className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">This authenticated account does not have the required Control Panel role.</p>
          <button type="button" onClick={() => void navigate({ to: "/auth" })} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Return to sign in</button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
