import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FranchiseRow = Record<string, any>;

export const franchiseKeys = {
  all: ["franchise"] as const,
  list: () => ["franchise", "list"] as const,
  applications: () => ["franchise", "applications"] as const,
  royalties: () => ["franchise", "royalties"] as const,
};

async function readTable(table: string): Promise<FranchiseRow[]> {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const franchisesQuery = queryOptions({
  queryKey: franchiseKeys.list(),
  queryFn: () => readTable("franchises"),
  staleTime: 15_000,
});

export const applicationsQuery = queryOptions({
  queryKey: franchiseKeys.applications(),
  queryFn: () => readTable("franchise_applications"),
  staleTime: 15_000,
});

export const royaltiesQuery = queryOptions({
  queryKey: franchiseKeys.royalties(),
  queryFn: () => readTable("franchise_royalties"),
  staleTime: 15_000,
});
