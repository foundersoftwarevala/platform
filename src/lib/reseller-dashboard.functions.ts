// What a reseller's own dashboard reads and writes.
//
// The clients and leads workspaces kept their records in a browser-side store
// that was gone on reload, and said so on the screen. Nothing a reseller
// entered ever reached the database, so the Reseller Manager - which reads
// crm_customers and leads - could never see any of it.
//
// Two things make this less direct than it looks. Row-level security refuses
// a reseller's own insert into crm_customers, so the write happens here, after
// the caller has been identified from their token. And neither table is keyed
// on an auth user: a customer is owned by a team_members row and a lead by a
// lead_agents row. The reseller's own record in each is found by their email
// address, and created the first time they need one, so their work has an
// owner the rest of the platform already understands.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

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

type Caller = { email?: string; name?: string };

function callerFrom(claims: Record<string, unknown> | undefined, userId: string): Caller {
  const email = typeof claims?.email === "string" ? claims.email : undefined;
  const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email ||
    `Reseller ${userId.slice(0, 8)}`;
  return { email, name };
}

/** The team_members row that owns this reseller's customers. */
async function ownerIdFor(sb: ReturnType<typeof writer>, caller: Caller) {
  if (!caller.email) throw new Error("This account has no email address, so its records cannot be filed.");
  const found = await sb.from("team_members").select("id").eq("email", caller.email).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const made = await sb
    .from("team_members")
    .insert({
      full_name: caller.name ?? caller.email,
      email: caller.email,
      department: "Channel",
      role_title: "Reseller",
      status: "active",
    } as never)
    .select("id")
    .single();
  if (made.error) throw new Error(made.error.message);
  return (made.data as { id: string }).id;
}

/** The lead_agents row that this reseller's leads are assigned to. */
async function agentIdFor(sb: ReturnType<typeof writer>, caller: Caller) {
  if (!caller.email) throw new Error("This account has no email address, so its leads cannot be filed.");
  const found = await sb.from("lead_agents").select("id").eq("email", caller.email).maybeSingle();
  if (found.data?.id) return found.data.id as string;
  const made = await sb
    .from("lead_agents")
    .insert({
      name: caller.name ?? caller.email,
      email: caller.email,
      role: "Reseller",
      team: "Channel",
    } as never)
    .select("id")
    .single();
  if (made.error) throw new Error(made.error.message);
  return (made.data as { id: string }).id;
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
  status: z.string().optional(),
  country: z.string().optional(),
  requirements: z.string().optional(),
  deal_value: z.number().optional(),
  next_follow_up: z.string().optional(),
});

export const listResellerCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const owner = await ownerIdFor(sb, callerFrom(context.claims, context.userId));
    const { data, error } = await sb
      .from("crm_customers")
      .select(CUSTOMER_COLUMNS)
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => customerInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const owner = await ownerIdFor(sb, callerFrom(context.claims, context.userId));
    const { data: row, error } = await sb
      .from("crm_customers")
      .insert({ ...data, owner_id: owner } as never)
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
    const sb = writer();
    const owner = await ownerIdFor(sb, callerFrom(context.claims, context.userId));
    // Scoped by owner as well as id, so one reseller cannot reach another's row.
    const { data: row, error } = await sb
      .from("crm_customers")
      .update({ ...data.patch, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("owner_id", owner)
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().min(1) }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const owner = await ownerIdFor(sb, callerFrom(context.claims, context.userId));
    const { error } = await sb.from("crm_customers").delete().eq("id", data.id).eq("owner_id", owner);
    if (error) throw new Error(error.message);
    return { removed: data.id };
  });

export const listResellerLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const agent = await agentIdFor(sb, callerFrom(context.claims, context.userId));
    const { data, error } = await sb
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("assigned_agent_id", agent)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => leadInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const agent = await agentIdFor(sb, callerFrom(context.claims, context.userId));
    const { data: row, error } = await sb
      .from("leads")
      .insert({
        ...data,
        status: data.status ?? "new",
        // The source column is a fixed set; a lead typed in by a person is manual.
        source: "manual",
        assigned_agent_id: agent,
        assigned_at: new Date().toISOString(),
      } as never)
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
    const sb = writer();
    const agent = await agentIdFor(sb, callerFrom(context.claims, context.userId));
    const { data: row, error } = await sb
      .from("leads")
      .update({ ...data.patch, updated_at: new Date().toISOString() } as never)
      .eq("id", data.id)
      .eq("assigned_agent_id", agent)
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().min(1) }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const agent = await agentIdFor(sb, callerFrom(context.claims, context.userId));
    const { error } = await sb.from("leads").delete().eq("id", data.id).eq("assigned_agent_id", agent);
    if (error) throw new Error(error.message);
    return { removed: data.id };
  });
