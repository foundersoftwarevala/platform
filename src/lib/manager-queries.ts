import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
  deleteRecord,
  checkApiServiceHealth,
  insertRecord,
  listManyRecords,
  listRecords,
  updateRecord,
  type Row,
} from "./manager-data.functions";
import type { ManagerTable } from "./manager-tables";

export type { Row };

export interface ListSpec {
  table: ManagerTable;
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  filters?: Array<{
    column: string;
    op?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is";
    value: string | number | boolean | null | string[];
  }>;
}

function normalize(spec: ListSpec) {
  return {
    table: spec.table,
    select: spec.select ?? "*",
    orderBy: spec.orderBy,
    ascending: spec.ascending ?? false,
    limit: spec.limit ?? 200,
    filters: (spec.filters ?? []).map((f) => ({ ...f, op: f.op ?? "eq" })),
  };
}

async function withAccessToken<T extends object>(data: T): Promise<T & { accessToken: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Manager authentication required");
  return { ...data, accessToken };
}

/** Read one table. */
export function useRecords(spec: ListSpec) {
  const fn = useServerFn(listRecords);
  const payload = normalize(spec);
  return useQuery({
    queryKey: ["manager", payload],
    queryFn: async () => fn({ data: await withAccessToken(payload) }),
    staleTime: 15_000,
  });
}

/** Read several tables in a single round trip. */
export function useManyRecords(specs: ListSpec[]) {
  const fn = useServerFn(listManyRecords);
  const requests = specs.map(normalize);
  return useQuery({
    queryKey: ["manager", "many", requests],
    queryFn: async () => fn({ data: await withAccessToken({ requests }) }),
    staleTime: 15_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["manager"] });
}

export function useUpdateRecord(successMessage = "Saved") {
  const fn = useServerFn(updateRecord);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { table: ManagerTable; id: string; values: Record<string, unknown> }) =>
      withAccessToken(vars).then((data) => fn({ data })),
    onSuccess: () => {
      invalidate();
      toast.success(successMessage);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInsertRecord(successMessage = "Created") {
  const fn = useServerFn(insertRecord);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { table: ManagerTable; values: Record<string, unknown> }) =>
      withAccessToken(vars).then((data) => fn({ data })),
    onSuccess: () => {
      invalidate();
      toast.success(successMessage);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRecord(successMessage = "Deleted") {
  const fn = useServerFn(deleteRecord);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { table: ManagerTable; id: string }) =>
      withAccessToken(vars).then((data) => fn({ data })),
    onSuccess: () => {
      invalidate();
      toast.success(successMessage);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Run an auditable server-side reachability check for a registered provider endpoint. */
export function useApiServiceHealthCheck() {
  const fn = useServerFn(checkApiServiceHealth);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { serviceId: string }) => withAccessToken(vars).then((data) => fn({ data })),
    onSuccess: (result) => {
      invalidate();
      toast.success(result.detail);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
