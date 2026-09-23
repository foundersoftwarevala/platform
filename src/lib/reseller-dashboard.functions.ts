// What a reseller's own dashboard reads and writes.
//
// The clients and leads workspaces kept their records in a browser-side store
// that was gone on reload, and said so on the screen. Nothing a reseller
// entered ever reached the database, so the Reseller Manager - which reads
// crm_customers and leads - could never see any of it.
//
// These are the server functions behind those screens. The signed-in reseller
// is established from their token by the middleware; the row's owner is then
// set from that, never from anything the browser sends, so a reseller can only
// ever read and change their own records.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

/**
 * A client that can write these tables.
 *
 * Row-level security refuses a reseller's own insert into crm_customers, so
 * the write happens here, after the caller has been identified, rather than
 * from the browser. The owner is stamped on server side.
 */
function writer() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error("Server storage is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

const CUSTOMER_COLUMNS =
  "id, company_name, contact_name, email, phone, industry, country, plan, status, health_score, lifetime_value, open_tickets, owner_id, last_contact_at, created_at, updated_at";

const LEAD_COLUMNS =
  "id, name, email, phone, company, industry, source, status, priority, country, requirements, deal_value, assigned_agent_id, next_follow_up, created_at, updated_at";

const customerInput = z.object({
  contact_name: z.string().min(1, "A name is required"),
  company_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  plan: z.string().optional(),
  status: z.string().optional(),
  health_score: z.number().optional(),
});

const leadInput = z.object({
  name: z.string().min(1, "A name is required"),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  country: z.string().optional(),
  requirements: z.string().optional(),
  deal_value: z.number().optional(),
  next_follow_up: z.string().optional(),
});

/** The customers this reseller owns. */
export const listResellerCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await writer()
      .from("crm_customers")
      .select(CUSTOMER_COLUMNS)
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => customerInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await writer()
      .from("crm_customers")
      .insert({ ...data, owner_id: context.userId })
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({ id: z.string().min(1), patch: customerInput.partial() }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Scoped by owner as well as id, so one reseller cannot reach another's row.
    const { data: row, error } = await writer()
      .from("crm_customers")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().min(1) }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const { error } = await writer()
      .from("crm_customers")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { removed: data.id };
  });

/** The leads assigned to this reseller. */
export const listResellerLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await writer()
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("assigned_agent_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => leadInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await writer()
      .from("leads")
      .insert({
        ...data,
        status: data.status ?? "new",
        source: data.source ?? "reseller",
        assigned_agent_id: context.userId,
        assigned_at: new Date().toISOString(),
      })
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({ id: z.string().min(1), patch: leadInput.partial() }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await writer()
      .from("leads")
      .update({ ...data.patch, updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("assigned_agent_id", context.userId)
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().min(1) }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const { error } = await writer()
      .from("leads")
      .delete()
      .eq("id", data.id)
      .eq("assigned_agent_id", context.userId);
    if (error) throw new Error(error.message);
    return { removed: data.id };
  });
