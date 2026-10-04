import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import {
  deleteRecord,
  checkApiServiceHealth,
  creditWallet,
  testApiService,
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

/**
 * Errors that can never succeed on retry: the caller is signed out or lacks the
 * manager role. Retrying these only floods the server function.
 */
export function isAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /authentication required|permission required|cannot access|unauthori[sz]ed|forbidden|\b40[13]\b|jwt/i.test(
    message,
  );
}

/**
 * Shared read policy for every manager console query: at most two retries with
 * exponential backoff (2s, 4s, capped at 8s), none for access failures, and no
 * refetch on window focus or on remount of a query that already failed, so a
 * failing read cannot become a request storm. Retry is explicit (ErrorState).
 */
export const MANAGER_READ_POLICY = {
  staleTime: 30_000,
  retry: (failureCount: number, error: unknown) => !isAccessError(error) && failureCount < 2,
  retryDelay: (attempt: number) => Math.min(1_000 * 2 ** (attempt + 1), 8_000),
  retryOnMount: false,
  refetchOnWindowFocus: false,
} as const;

/** Read one table. */
export function useRecords(spec: ListSpec) {
  const fn = useServerFn(listRecords);
  const payload = normalize(spec);
  return useQuery({
    queryKey: ["manager", payload],
    queryFn: async () => fn({ data: await withAccessToken(payload) }),
    ...MANAGER_READ_POLICY,
  });
}

/** Read several tables in a single round trip. */
export function useManyRecords(specs: ListSpec[]) {
  const fn = useServerFn(listManyRecords);
  const requests = specs.map(normalize);
  return useQuery({
    queryKey: ["manager", "many", requests],
    queryFn: async () => fn({ data: await withAccessToken({ requests }) }),
    ...MANAGER_READ_POLICY,
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

/** Credit a wallet atomically on the server; see creditWallet. */
export function useCreditWallet(successMessage = "Money added") {
  const fn = useServerFn(creditWallet);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { walletId: string; amount: number; description: string }) =>
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

/**
 * Run a real, minimal-cost, metered, audited request through the registered
 * provider's execution adapter. Never returns success unless the provider
 * itself answered; there is no mock path.
 */
export function useApiServiceTest() {
  const fn = useServerFn(testApiService);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (vars: { serviceId: string }) => withAccessToken(vars).then((data) => fn({ data })),
    onSuccess: (result) => {
      invalidate();
      toast.success(
        `Live test succeeded via ${result.service} (${result.model ?? "default model"}), ${result.latencyMs}ms — "${result.responsePreview}"`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Untyped browser client for platform tables the generated types do not list
 * (leads, ai_content_*, seo_* ...). Row-level security applies; in production
 * this client talks to the VPS.
 */
export const directDb = supabase as unknown as SupabaseClient;

/** Unwrap a Supabase response, turning its error into a thrown Error. */
export async function must<T>(
  request: PromiseLike<{
    data: T | null;
    error: { message: string } | null;
    count?: number | null;
  }>,
): Promise<{ data: T | null; count: number | null }> {
  const { data, error, count } = await request;
  if (error) throw new Error(error.message);
  return { data, count: count ?? null };
}

/** A direct read under the same bounded retry policy as every manager read. */
export function useDirectRead<T>(key: readonly unknown[], read: () => Promise<T>) {
  return useQuery({
    queryKey: ["manager", "direct", ...key],
    queryFn: read,
    ...MANAGER_READ_POLICY,
  });
}
