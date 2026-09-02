import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPermissions, fetchMyProfile } from "@/services/chat/chat-service";

export function useSupabaseSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (mounted) setSession(next);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, userId: session?.user.id ?? null, loading };
}

export function useMyProfile(userId: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: () => fetchMyProfile(userId!),
  });
}

export function useMyPermissions(userId: string | null) {
  const query = useQuery({
    queryKey: ["permissions", userId],
    enabled: !!userId,
    queryFn: () => fetchMyPermissions(userId!),
  });
  const permissions = query.data?.permissions ?? [];
  return {
    ...query,
    roles: query.data?.roles ?? [],
    permissions,
    can: (permission: string) => permissions.includes(permission),
  };
}
