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

// ---------------------------------------------------------------- metrics
//
// The reseller dashboard's KPI tiles were showing the sample-number engine.
// This reads the reseller's own real figures instead, from the same rows the
// Clients/Leads/Licenses workspaces and the Reseller Manager already use.
//
// These finders READ an owner/agent/reseller record but never create one — a
// dashboard load must not file a reseller into team_members or lead_agents just
// by counting. A reseller with no records yet reads as zero, and one not linked
// to a resellers row reads commission figures as null (a dash), which is the
// honest answer rather than an invented number.

const NUM = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const MONEY = (n: number): number => Math.round(n * 100) / 100;

async function findOwnerId(sb: ReturnType<typeof writer>, caller: Caller): Promise<string | null> {
  if (!caller.email) return null;
  const { data } = await sb.from("team_members").select("id").eq("email", caller.email).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function findAgentId(sb: ReturnType<typeof writer>, caller: Caller): Promise<string | null> {
  if (!caller.email) return null;
  const { data } = await sb.from("lead_agents").select("id").eq("email", caller.email).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function findResellerId(sb: ReturnType<typeof writer>, userId: string): Promise<string | null> {
  const { data } = await sb.from("resellers").select("id").eq("user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Real figures for the reseller dashboard, keyed by the `kpis[].key` values in
 * lib/roles.ts so KpiGrid can look each one up by the key it already has. A
 * `null` means the platform has no source for that metric and the tile shows a
 * dash rather than a made-up number.
 */
export const getResellerMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ metrics: Record<string, number | null> }> => {
    const sb = writer();
    const caller = callerFrom(context.claims, context.userId);
    const startOfMonth = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    ).toISOString();
    const nowIso = new Date().toISOString();

    const [ownerId, agentId, resellerId] = await Promise.all([
      findOwnerId(sb, caller),
      findAgentId(sb, caller),
      findResellerId(sb, context.userId),
    ]);

    // Clients — the reseller's own crm_customers.
    let clients: { status: string | null }[] = [];
    if (ownerId) {
      const { data } = await sb
        .from("crm_customers").select("status").eq("owner_id", ownerId).limit(5000);
      clients = (data as { status: string | null }[] | null) ?? [];
    }

    // Leads — assigned to this reseller's lead_agents row.
    let leads: { status: string | null }[] = [];
    if (agentId) {
      const { data } = await sb
        .from("leads").select("status").eq("assigned_agent_id", agentId).limit(5000);
      leads = (data as { status: string | null }[] | null) ?? [];
    }

    // Licences the reseller holds — same rows the Licenses workspace lists.
    const { data: licData } = await (sb as unknown as {
      from: (t: string) => { select: (s: string) => { eq: (c: string, v: string) => { limit: (n: number) => Promise<{ data: unknown }> } } };
    })
      .from("marketplace_licenses")
      .select("status,expires_at")
      .eq("buyer_id", context.userId)
      .limit(5000);
    const licences = (licData as { status: string | null; expires_at: string | null }[] | null) ?? [];

    // Commission and payouts — only when this account is linked to a reseller.
    let commissions: { gross_amount: unknown; commission_amount: unknown; status: string; created_at: string }[] = [];
    let payouts: { amount: unknown; status: string }[] = [];
    if (resellerId) {
      const [c, p] = await Promise.all([
        sb.from("reseller_commissions")
          .select("gross_amount,commission_amount,status,created_at")
          .eq("reseller_id", resellerId).limit(5000),
        sb.from("reseller_payouts").select("amount,status").eq("reseller_id", resellerId).limit(5000),
      ]);
      commissions = (c.data as typeof commissions | null) ?? [];
      payouts = (p.data as typeof payouts | null) ?? [];
    }

    const liveCommissions = commissions.filter((c) => c.status !== "reversed");
    const isExpired = (l: { status: string | null; expires_at: string | null }) =>
      l.status === "expired" || (l.expires_at != null && l.expires_at < nowIso);
    const ACTIVE_LEADS = ["new", "contacted", "interested", "follow_up", "negotiation"];

    const metrics: Record<string, number | null> = {
      clients: clients.filter((c) => c.status === "active").length,
      // crm_customers has no trial state, so this has no honest source.
      "trial-clients": null,
      licenses: licences.filter((l) => (l.status === "issued" || l.status === "active") && !isExpired(l)).length,
      "expired-licenses": licences.filter(isExpired).length,
      leads: leads.filter((l) => ACTIVE_LEADS.includes(String(l.status))).length,
      "leads-won": leads.filter((l) => l.status === "won").length,
      "leads-lost": leads.filter((l) => l.status === "lost").length,
      "leads-pending": leads.filter((l) => l.status === "new" || l.status === "contacted").length,
      commissions: resellerId
        ? MONEY(liveCommissions.filter((c) => c.created_at >= startOfMonth)
            .reduce((s, c) => s + NUM(c.commission_amount), 0))
        : null,
      "payout-pending": resellerId
        ? MONEY(payouts.filter((p) => ["pending", "approved", "processing"].includes(p.status))
            .reduce((s, p) => s + NUM(p.amount), 0))
        : null,
      revenue: resellerId
        ? MONEY(liveCommissions.reduce((s, c) => s + NUM(c.gross_amount), 0))
        : null,
      // Renewal rate needs a subscription/renewal history the reseller side does
      // not model yet. A dash is the honest answer.
      renewals: null,
    };

    return { metrics };
  });

// ---------------------------------------------------------- ledger (read-only)
//
// The reseller's own commission ledger, payouts and memberships — the same rows
// the Reseller Manager reads, scoped to the reseller this account is linked to.
// Read-only: commission is earned by the attribution engine and paid through
// the manager, never typed in here. An account not linked to a resellers row
// gets `linked: false` and the workspace explains that plainly instead of
// erroring. This replaced the browser-local CrudWorkspace the Commissions,
// Revenue and Renewals modules used to open.

export type ResellerLedgerCommission = {
  id: string; order_id: string; gross_amount: number; commission_amount: number;
  currency: string; status: string; created_at: string;
};
export type ResellerLedgerPayout = {
  id: string; amount: number; currency: string; status: string;
  requested_at: string | null; completed_at: string | null; provider_reference: string | null;
};
export type ResellerLedgerMembership = {
  id: string; plan_code: string | null; membership_state: string;
  activated_at: string | null; expires_at: string | null; renewal_at: string | null;
};
export type ResellerLedger = {
  linked: boolean;
  commissions: ResellerLedgerCommission[];
  payouts: ResellerLedgerPayout[];
  memberships: ResellerLedgerMembership[];
};

export const getResellerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResellerLedger> => {
    const sb = writer();
    const resellerId = await findResellerId(sb, context.userId);
    if (!resellerId) {
      return { linked: false, commissions: [], payouts: [], memberships: [] };
    }
    const [c, p, m] = await Promise.all([
      sb.from("reseller_commissions")
        .select("id,order_id,gross_amount,commission_amount,currency,status,created_at")
        .eq("reseller_id", resellerId).order("created_at", { ascending: false }).limit(1000),
      sb.from("reseller_payouts")
        .select("id,amount,currency,status,requested_at,completed_at,provider_reference")
        .eq("reseller_id", resellerId).order("requested_at", { ascending: false }).limit(1000),
      sb.from("reseller_memberships")
        .select("id,plan_code,membership_state,activated_at,expires_at,renewal_at")
        .eq("reseller_id", resellerId).order("created_at", { ascending: false }).limit(1000),
    ]);
    return {
      linked: true,
      commissions: (c.data as ResellerLedgerCommission[] | null) ?? [],
      payouts: (p.data as ResellerLedgerPayout[] | null) ?? [],
      memberships: (m.data as ResellerLedgerMembership[] | null) ?? [],
    };
  });
