import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Customer Management, over the customers this project already has.
 *
 * No customer table is created: auth.users and profiles already are the
 * customer record. Everything here is counted from orders, licences and
 * entitlements, and anything that cannot be linked honestly is reported as
 * unavailable with its reason rather than shown as a zero.
 */

async function callAsUser<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const client = createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type CustomerRow = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  registered_at: string;
  last_sign_in_at: string | null;
  orders: number;
  paid_orders: number;
  lifetime_value: number;
  licences: number;
  entitlements: number;
  last_order_at: string | null;
  customer_type: "customer" | "registered";
  vip: boolean;
};

export const getCustomersOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, unknown>> => callAsUser("mm_customers_overview", {}),
);

export const listCustomers = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) =>
    z.object({
      search: z.string().max(120).optional(),
      filter: z.enum(["all", "customers", "registered", "vip"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      offset: z.number().int().min(0).optional(),
    }).parse(i ?? {}),
  )
  .handler(async ({ data }): Promise<{
    ok: boolean; reason?: string; total?: number;
    limit?: number; offset?: number; customers?: CustomerRow[];
  }> => callAsUser("mm_customers", { p_query: data }));

export const getCustomerProfile = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }): Promise<Record<string, unknown>> =>
    callAsUser("mm_customer_profile", { p_user: data.id }),
  );

export const getReleaseOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, unknown>> => callAsUser("mm_release_overview", {}),
);
