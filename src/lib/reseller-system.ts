import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ResellerSystemContext = {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  row: Record<string, any> | null;
};

export async function ensureCurrentResellerRecord(): Promise<ResellerSystemContext | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const email = (user.email ?? "").trim().toLowerCase();
  const query = supabase
    .from("resellers")
    .select("*")
    .or(`user_id.eq.${user.id},email.ilike.%${email}%`)
    .limit(20);

  const { data, error } = await query;
  if (error) throw error;

  const discovered = (data ?? []) as Record<string, any>[];
  const matches = discovered.filter((row) => {
    const rowEmail = String(row.email ?? "").trim().toLowerCase();
    return row.user_id === user.id || (email && rowEmail === email);
  });

  const row = matches[0] ?? discovered[0] ?? null;
  if (!row) {
    throw new Error("No reseller record is linked to the authenticated user. Map the signed-in user to a reseller row in Supabase before visiting the Reseller Dashboard.");
  }

  if (!row.user_id && email && String(row.email ?? "").trim().toLowerCase() === email) {
    const { error: syncError } = await supabase
      .from("resellers")
      .update({ user_id: user.id })
      .eq("id", row.id);

    if (syncError) throw syncError;
    row.user_id = user.id;
  }

  return {
    id: row.id,
    userId: row.user_id ?? user.id ?? null,
    email: row.email ?? user.email ?? null,
    name: row.name ?? user.user_metadata?.full_name ?? null,
    row,
  };
}

export async function getCurrentResellerContext(): Promise<ResellerSystemContext | null> {
  try {
    const context = await ensureCurrentResellerRecord();
    if (context) return context;
  } catch {
  }
  if (import.meta.env.DEV && typeof window !== "undefined") {
    try {
      const rows = JSON.parse(window.localStorage.getItem("dev_db_resellers") ?? "[]") as Record<string, any>[];
      const row = rows.find((candidate) => candidate.status === "active") ?? rows[0];
      if (row?.id) return { id: row.id, userId: row.user_id ?? null, email: row.email ?? null, name: row.name ?? null, row };
    } catch {
      // Fall through to the normal unauthenticated state.
    }
  }
  return null;
}

export function useCurrentResellerContext() {
  return useQuery({
    queryKey: ["reseller-system-context"],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    queryFn: getCurrentResellerContext,
  });
}

export function useResellerScopedRows<T = Record<string, any>>(table: string, select = "*", enabled = true) {
  const { data: reseller } = useCurrentResellerContext();

  return useQuery({
    queryKey: ["reseller-system-rows", table, reseller?.id, select],
    enabled: enabled && !!reseller?.id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq("reseller_id", reseller!.id);

      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export async function upsertResellerScopedRecord<T = Record<string, any>>(
  table: string,
  payload: Record<string, any>,
  id?: string,
) {
  const reseller = await getCurrentResellerContext();
  if (!reseller) {
    throw new Error("No reseller identity available for this session.");
  }

  const row = {
    ...payload,
    reseller_id: payload.reseller_id ?? reseller.id,
  };

  if (id) {
    const { data, error } = await supabase
      .from(table)
      .update(row)
      .eq("id", id)
      .eq("reseller_id", reseller.id)
      .select()
      .single();

    if (error) throw error;
    return data as T;
  }

  const { data, error } = await supabase.from(table).insert([row]).select().single();
  if (error) throw error;
  return data as T;
}

export async function deleteResellerScopedRecord(table: string, id: string) {
  const reseller = await getCurrentResellerContext();
  if (!reseller) {
    throw new Error("No reseller identity available for this session.");
  }

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("reseller_id", reseller.id);

  if (error) throw error;
}
