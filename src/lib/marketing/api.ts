import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];

export type MarketingTable = Extract<keyof Tables, `marketing_${string}`>;
export type Row<T extends MarketingTable> = Tables[T]["Row"];
export type InsertRow<T extends MarketingTable> = Tables[T]["Insert"];
export type UpdateRow<T extends MarketingTable> = Tables[T]["Update"];

/* The generated Supabase types are keyed per-table; a generic table name widens
 * the builder union beyond what TS can resolve, so the builder is narrowed here
 * once and results are re-typed at the boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const from = (table: MarketingTable) => supabase.from(table) as any;

export type OrderSpec = { column: string; ascending?: boolean };

/** Hard cap so a large table can never stall a screen with an unbounded read. */
export const MAX_ROWS = 2000;

export const marketingKey = (table: MarketingTable, order?: OrderSpec) =>
  ["marketing", table, order?.column ?? null, order?.ascending ?? null] as const;

export function tableQuery<T extends MarketingTable>(table: T, order?: OrderSpec, limit = MAX_ROWS) {
  return queryOptions({
    queryKey: [...marketingKey(table, order), limit] as const,
    queryFn: async (): Promise<Array<Row<T>>> => {
      let builder = from(table).select("*");
      if (order) builder = builder.order(order.column, { ascending: order.ascending ?? false });
      const { data, error } = await builder.limit(limit);
      if (error) throw new Error(error.message);
      if ((data?.length ?? 0) === limit)
        console.warn(`[marketing] ${table} hit the ${limit}-row read cap.`);
      return (data ?? []) as Array<Row<T>>;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}


async function insertRow<T extends MarketingTable>(table: T, values: InsertRow<T>) {
  const { data, error } = await from(table).insert(values).select().single();
  if (error) throw new Error(error.message);
  return data as Row<T>;
}

async function updateRow<T extends MarketingTable>(table: T, id: string, values: UpdateRow<T>) {
  const { data, error } = await from(table).update(values).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Row<T>;
}

async function deleteRow<T extends MarketingTable>(table: T, id: string) {
  const { error } = await from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  return id;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function useInvalidate(table: MarketingTable) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["marketing", table] });
  };
}

export function useCreateRow<T extends MarketingTable>(table: T) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (values: InsertRow<T>) => insertRow(table, values),
    onSuccess: invalidate,
  });
}

export function useUpdateRow<T extends MarketingTable>(table: T) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: UpdateRow<T> }) =>
      updateRow(table, id, values),
    onSuccess: invalidate,
  });
}

export function useDeleteRow<T extends MarketingTable>(table: T) {
  const invalidate = useInvalidate(table);
  return useMutation({
    mutationFn: (id: string) => deleteRow(table, id),
    onSuccess: invalidate,
  });
}

/** Records an action in the marketing audit trail. */
export async function recordAudit(entry: {
  actor: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  module: string;
  details?: string;
}) {
  const { error } = await supabase.from("marketing_audit_logs").insert(entry);
  if (error) console.error("[marketing] audit write failed:", error.message);
}
