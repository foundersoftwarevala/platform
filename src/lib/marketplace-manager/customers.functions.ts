import { callAsUser } from "@/lib/supabase-rpc.server";
import type { JsonObject } from "@/lib/json";
import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";

/**
 * Customer Management, over the customers this project already has.
 *
 * No customer table is created: auth.users and profiles already are the
 * customer record. Everything here is counted from orders, licences and
 * entitlements, and anything that cannot be linked honestly is reported as
 * unavailable with its reason rather than shown as a zero.
 */

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
  async (): Promise<JsonObject> => callAsUser("mm_customers_overview", {}),
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
  .handler(async ({ data }): Promise<JsonObject> =>
    callAsUser("mm_customer_profile", { p_user: data.id }),
  );

export const getReleaseOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<JsonObject> => callAsUser("mm_release_overview", {}),
);
