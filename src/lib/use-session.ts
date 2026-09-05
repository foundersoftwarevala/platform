import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the current operator session in the browser.
 * Components use this to render session-aware affordances (sign in vs.
 * account menu) instead of assuming an operator is always present.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, user: session?.user ?? null };
}

export function userInitials(email?: string | null): string {
  if (!email) return "SV";
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0]![0]}${parts[1]![0]}` : name.slice(0, 2);
  return (letters || "SV").toUpperCase();
}
