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
// address, and created the first time they save something, so their work has
// an owner the rest of the platform already understands.
//
// Because those are staff tables, nobody gets a row in them for opening a
// screen. Every function here first proves the caller holds the reseller role
// and has a live, active resellers row of their own; an operator who opens the
// reseller dashboard is refused instead of being filed as a reseller. Reads
// never create anything - a reseller with no row yet simply has no records.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { aiComplete } from "@/lib/ai-gateway.server";

function writer() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    throw new Error(
      "Server storage is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

type Sb = ReturnType<typeof writer>;
// The tables used here are not all in the generated types; this is the loose
// view of the same client.
type Loose = { from: (table: string) => any };
const loose = (sb: Sb) => sb as unknown as Loose;

type ResellerRow = {
  id: string;
  status: string;
  name: string | null;
  company_name: string | null;
  tier: string | null;
  kyc_status: string | null;
  plan_code: string | null;
};

type Reseller = {
  userId: string;
  reseller: ResellerRow;
  /** The sign-in address, lower-cased: how the staff tables know this person. */
  email: string;
  name: string;
};

const RESELLER_COLUMNS = "id, status, name, company_name, tier, kyc_status, plan_code";

/** The caller's reseller role and live resellers row, without judging status. */
async function resellerOf(sb: Sb, userId: string) {
  const role = await loose(sb)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "reseller")
    .limit(1);
  if (role.error) throw new Error(role.error.message);
  if (!((role.data ?? []) as unknown[]).length) return { hasRole: false, reseller: null };
  // At most one non-terminated record per user (resellers_one_live_record_per_user).
  const found = await loose(sb)
    .from("resellers")
    .select(RESELLER_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "terminated")
    .limit(1);
  if (found.error) throw new Error(found.error.message);
  return { hasRole: true, reseller: ((found.data ?? []) as ResellerRow[])[0] ?? null };
}

/**
 * The signed-in reseller, or an error that says why not. Identity comes from
 * the verified token only; nothing the browser sends can name a reseller.
 */
async function requireReseller(
  sb: Sb,
  context: { userId: string; claims?: Record<string, unknown> },
): Promise<Reseller> {
  const { hasRole, reseller } = await resellerOf(sb, context.userId);
  if (!hasRole)
    throw new Error(
      "This workspace belongs to reseller accounts, and this account does not hold the reseller role.",
    );
  if (!reseller) throw new Error("No reseller record is linked to this account yet.");
  if (reseller.status !== "active") {
    throw new Error(
      `This reseller account is ${reseller.status}, so its clients and leads cannot be opened.`,
    );
  }
  const claims = context.claims;
  const email = typeof claims?.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!email) throw new Error("This account has no email address, so its records cannot be filed.");
  const meta = (claims?.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    reseller.company_name ||
    reseller.name ||
    email;
  return { userId: context.userId, reseller, email, name };
}

/**
 * The row in a staff table whose email is this address, ignoring case.
 * ilike narrows the search; the exact comparison decides, so a "%" or "_" in
 * an address can never match someone else's row.
 */
async function idByEmail(sb: Sb, table: "team_members" | "lead_agents", email: string) {
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data, error } = await loose(sb)
    .from(table)
    .select("id, email, created_at")
    .ilike("email", pattern)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw new Error(error.message);
  const hit = ((data ?? []) as { id: string; email: string }[]).find(
    (r) => (r.email ?? "").trim().toLowerCase() === email,
  );
  return hit?.id ?? null;
}

/** The team_members row that owns this reseller's customers. */
async function ownerIdFor(sb: Sb, who: Reseller, create: boolean) {
  const found = await idByEmail(sb, "team_members", who.email);
  if (found || !create) return found;
  const made = await loose(sb)
    .from("team_members")
    .insert({
      full_name: who.name,
      email: who.email,
      department: "Channel",
      role_title: "Reseller",
      status: "active",
    })
    .select("id")
    .single();
  if (made.error) throw new Error(made.error.message);
  return (made.data as { id: string }).id;
}

// A reseller's own agent row is never online: lead intake hands public leads
// to agents whose status is online (lib/marketplace/lead-intake.ts), and a
// reseller's pipeline is the leads they enter themselves. The table requires
// an offline agent to say why (lead_agents_offline_explained).
const RESELLER_AGENT_REASON =
  "Reseller account: holds the leads this reseller enters and is not part of lead routing.";

/** The lead_agents row that this reseller's leads are assigned to. */
async function agentIdFor(sb: Sb, who: Reseller, create: boolean) {
  const found = await idByEmail(sb, "lead_agents", who.email);
  if (found || !create) return found;
  const made = await loose(sb)
    .from("lead_agents")
    .insert({
      name: who.name,
      email: who.email,
      role: "Reseller",
      team: "Channel",
      status: "offline",
      unavailable_reason: RESELLER_AGENT_REASON,
    })
    .select("id")
    .single();
  if (made.error) {
    // Two first saves at once: the email is unique, so the other one won.
    if ((made.error as { code?: string }).code === "23505") {
      const again = await idByEmail(sb, "lead_agents", who.email);
      if (again) return again;
    }
    throw new Error(made.error.message);
  }
  return (made.data as { id: string }).id;
}

const CUSTOMER_COLUMNS =
  "id, company_name, contact_name, email, phone, industry, country, plan, status, health_score, lifetime_value, open_tickets, owner_id, last_contact_at, created_at, updated_at";

const LEAD_COLUMNS =
  "id, name, email, phone, company, industry, source, sub_source, campaign, referrer, utm_source, status, priority, country, requirements, deal_value, assigned_agent_id, next_follow_up, created_at, updated_at";

/** A crm_customers row as CUSTOMER_COLUMNS reads it. */
type CustomerRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  industry: string | null;
  country: string | null;
  plan: string;
  status: string;
  health_score: number;
  lifetime_value: number;
  open_tickets: number;
  owner_id: string | null;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

/** A leads row as LEAD_COLUMNS reads it. */
type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  industry: string;
  source: string;
  sub_source: string;
  campaign: string | null;
  referrer: string | null;
  utm_source: string | null;
  status: string;
  priority: string;
  country: string;
  requirements: string | null;
  deal_value: number;
  assigned_agent_id: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
};

// The enums the leads table enforces (lead_status_type, lead_source_type,
// lead_industry). Anything else is refused here with a readable message
// instead of a database error.
const LEAD_STATUSES = [
  "new",
  "contacted",
  "interested",
  "follow_up",
  "negotiation",
  "won",
  "lost",
  "spam",
] as const;
const LEAD_SOURCES = [
  "website",
  "seo",
  "social",
  "ads",
  "marketplace",
  "referral",
  "manual",
  "api",
  "whatsapp",
] as const;
const LEAD_INDUSTRIES = [
  "retail",
  "healthcare",
  "finance",
  "education",
  "real_estate",
  "manufacturing",
  "hospitality",
  "logistics",
  "technology",
  "other",
] as const;

/** A timestamp, or null for "no date"; an empty string is no date. */
const optionalInstant = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value.trim() === "") return null;
    const time = Date.parse(value);
    if (Number.isNaN(time)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "That date could not be read." });
      return z.NEVER;
    }
    return new Date(time).toISOString();
  });

const customerInput = z.object({
  contact_name: z.string().min(1, "A name is required"),
  company_name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  plan: z.string().optional(),
  status: z.string().optional(),
  health_score: z.number().int().min(0).max(100).optional(),
});

const leadInput = z.object({
  name: z.string().min(1, "A name is required"),
  company: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  industry: z.enum(LEAD_INDUSTRIES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  sub_source: z.string().optional(),
  campaign: z.string().nullable().optional(),
  referrer: z.string().nullable().optional(),
  utm_source: z.string().nullable().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  country: z.string().optional(),
  requirements: z.string().optional(),
  deal_value: z.number().min(0).optional(),
  next_follow_up: optionalInstant,
});

/** Drop keys whose value is undefined, so a patch only names what changed. */
function defined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export const listResellerCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const owner = await ownerIdFor(sb, who, false);
    if (!owner) return [];
    const { data, error } = await loose(sb)
      .from("crm_customers")
      .select(CUSTOMER_COLUMNS)
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as CustomerRow[];
  });

export const createResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => customerInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const owner = await ownerIdFor(sb, who, true);
    const { data: row, error } = await loose(sb)
      .from("crm_customers")
      .insert({
        ...defined(data),
        // Both columns are required by the table; an empty value is allowed.
        company_name: data.company_name ?? "",
        email: data.email ?? "",
        owner_id: owner,
      })
      .select(CUSTOMER_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row as CustomerRow;
  });

export const updateResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({ id: z.string().uuid(), patch: customerInput.partial() }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const owner = await ownerIdFor(sb, who, false);
    if (!owner) throw new Error("That client was not found among yours.");
    // Scoped by owner as well as id, so one reseller cannot reach another's row.
    const { data: row, error } = await loose(sb)
      .from("crm_customers")
      .update({ ...defined(data.patch), updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", owner)
      .select(CUSTOMER_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That client was not found among yours.");
    return row as CustomerRow;
  });

export const deleteResellerCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const owner = await ownerIdFor(sb, who, false);
    if (!owner) throw new Error("That client was not found among yours.");
    const { data: gone, error } = await loose(sb)
      .from("crm_customers")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", owner)
      .select("id");
    if (error) throw new Error(error.message);
    if (!((gone ?? []) as unknown[]).length)
      throw new Error("That client was not found among yours.");
    return { removed: data.id };
  });

export const listResellerLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const agent = await agentIdFor(sb, who, false);
    if (!agent) return [];
    const { data, error } = await loose(sb)
      .from("leads")
      .select(LEAD_COLUMNS)
      .eq("assigned_agent_id", agent)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as LeadRow[];
  });

export const createResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => leadInput.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const agent = await agentIdFor(sb, who, true);
    const { data: row, error } = await loose(sb)
      .from("leads")
      .insert({
        ...defined(data),
        // The table requires an email; a lead may be entered without one.
        email: data.email ?? "",
        status: data.status ?? "new",
        // A lead typed in by a person is manual unless they said where it came from.
        source: data.source ?? "manual",
        assigned_agent_id: agent,
        assigned_at: new Date().toISOString(),
      })
      .select(LEAD_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row as LeadRow;
  });

export const updateResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({ id: z.string().uuid(), patch: leadInput.partial() }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const agent = await agentIdFor(sb, who, false);
    if (!agent) throw new Error("That lead was not found among yours.");
    const patch: Record<string, unknown> = {
      ...defined(data.patch),
      updated_at: new Date().toISOString(),
    };
    // A lead that is won or lost is closed; reopening it clears the date.
    if (data.patch.status === "won" || data.patch.status === "lost")
      patch.closed_at = new Date().toISOString();
    else if (data.patch.status) patch.closed_at = null;
    const { data: row, error } = await loose(sb)
      .from("leads")
      .update(patch)
      .eq("id", data.id)
      .eq("assigned_agent_id", agent)
      .select(LEAD_COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That lead was not found among yours.");
    return row as LeadRow;
  });

export const deleteResellerLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const agent = await agentIdFor(sb, who, false);
    if (!agent) throw new Error("That lead was not found among yours.");
    const { data: gone, error } = await loose(sb)
      .from("leads")
      .delete()
      .eq("id", data.id)
      .eq("assigned_agent_id", agent)
      .select("id");
    if (error) throw new Error(error.message);
    if (!((gone ?? []) as unknown[]).length)
      throw new Error("That lead was not found among yours.");
    return { removed: data.id };
  });

/* ---------------- Lead follow-ups and meetings ---------------- */

// lead_follow_ups is the table Lead Manager schedules follow-ups in; a meeting
// is a follow-up of type "meeting", as Lead Manager records it. A plain
// follow-up takes the table's own default type.

type FollowUpRow = {
  id: string;
  lead_id: string;
  scheduled_at: string;
  follow_up_type: string;
  notes: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
};

/** The lead, if it is assigned to this reseller's agent row. */
async function ownLead(sb: Sb, who: Reseller, leadId: string, create: boolean) {
  const agent = await agentIdFor(sb, who, create);
  if (!agent) throw new Error("That lead was not found among yours.");
  const { data, error } = await loose(sb)
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("assigned_agent_id", agent)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That lead was not found among yours.");
  return { agent, leadId };
}

/** leads.next_follow_up is the earliest follow-up still open, as Lead Manager keeps it. */
async function refreshNextFollowUp(sb: Sb, leadId: string) {
  const next = await loose(sb)
    .from("lead_follow_ups")
    .select("scheduled_at")
    .eq("lead_id", leadId)
    .eq("is_completed", false)
    .order("scheduled_at", { ascending: true })
    .limit(1);
  if (next.error) throw new Error(next.error.message);
  const at = ((next.data ?? []) as { scheduled_at: string }[])[0]?.scheduled_at ?? null;
  const { error } = await loose(sb).from("leads").update({ next_follow_up: at }).eq("id", leadId);
  if (error) throw new Error(error.message);
}

export const listResellerLeadFollowUps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ leadId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    await ownLead(sb, who, data.leadId, false);
    const { data: rows, error } = await loose(sb)
      .from("lead_follow_ups")
      .select(
        "id, lead_id, scheduled_at, follow_up_type, notes, is_completed, completed_at, created_at",
      )
      .eq("lead_id", data.leadId)
      .order("scheduled_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as FollowUpRow[];
  });

export const addResellerLeadFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z
      .object({
        leadId: z.string().uuid(),
        kind: z.enum(["followup", "meeting"]),
        text: z.string().trim().min(1, "Say what the follow-up is").max(2000),
        date: z.string().min(1, "A date is required"),
      })
      .parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { agent } = await ownLead(sb, who, data.leadId, false);
    const time = Date.parse(data.date);
    if (Number.isNaN(time)) throw new Error("That date could not be read.");
    const { data: row, error } = await loose(sb)
      .from("lead_follow_ups")
      .insert({
        lead_id: data.leadId,
        agent_id: agent,
        scheduled_at: new Date(time).toISOString(),
        notes: data.text,
        ...(data.kind === "meeting" ? { follow_up_type: "meeting" } : {}),
      })
      .select(
        "id, lead_id, scheduled_at, follow_up_type, notes, is_completed, completed_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    await refreshNextFollowUp(sb, data.leadId);
    return row as FollowUpRow;
  });

export const setResellerLeadFollowUpDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const found = await loose(sb)
      .from("lead_follow_ups")
      .select("id, lead_id")
      .eq("id", data.id)
      .maybeSingle();
    if (found.error) throw new Error(found.error.message);
    const leadId = (found.data as { lead_id?: string } | null)?.lead_id;
    if (!leadId) throw new Error("That follow-up was not found among yours.");
    await ownLead(sb, who, leadId, false);
    const { data: row, error } = await loose(sb)
      .from("lead_follow_ups")
      .update({
        is_completed: data.done,
        completed_at: data.done ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select(
        "id, lead_id, scheduled_at, follow_up_type, notes, is_completed, completed_at, created_at",
      )
      .single();
    if (error) throw new Error(error.message);
    await refreshNextFollowUp(sb, leadId);
    return row as FollowUpRow;
  });

type ResellerLeadTask = {
  id: string;
  lead_id: string;
  title: string;
  due_at: string | null;
  status: "pending" | "completed";
  created_at: string;
};

export const listResellerLeadTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ leadId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    await ownLead(sb, who, data.leadId, false);
    const { data: rows, error } = await loose(sb)
      .from("reseller_lead_tasks")
      .select("id, lead_id, title, due_at, status, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ResellerLeadTask[];
  });

export const addResellerLeadTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      leadId: z.string().uuid(),
      title: z.string().trim().min(1, "A task description is required").max(500),
      due: z.string().optional(),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { agent } = await ownLead(sb, who, data.leadId, false);
    const due = data.due ? Date.parse(data.due) : NaN;
    if (data.due && Number.isNaN(due)) throw new Error("That date could not be read.");
    const { data: row, error } = await loose(sb)
      .from("reseller_lead_tasks")
      .insert({
        lead_id: data.leadId,
        owner_agent_id: agent,
        title: data.title,
        due_at: Number.isNaN(due) ? null : new Date(due).toISOString(),
      })
      .select("id, lead_id, title, due_at, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ResellerLeadTask;
  });

export const setResellerLeadTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const agent = await agentIdFor(sb, who, false);
    if (!agent) throw new Error("That task was not found among yours.");
    const { data: row, error } = await loose(sb)
      .from("reseller_lead_tasks")
      .update({ status: data.done ? "completed" : "pending" })
      .eq("id", data.id)
      .eq("owner_agent_id", agent)
      .select("id, lead_id, title, due_at, status, created_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That task was not found among yours.");
    return row as ResellerLeadTask;
  });

type ResellerLeadQuote = {
  id: string;
  lead_id: string;
  product: string;
  amount: number;
  currency: string;
  status: "draft" | "sent" | "accepted" | "declined";
  created_at: string;
};

export const listResellerLeadQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ leadId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    await ownLead(sb, who, data.leadId, false);
    const { data: rows, error } = await loose(sb)
      .from("reseller_lead_quotes")
      .select("id, lead_id, product, amount, currency, status, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ResellerLeadQuote[];
  });

export const addResellerLeadQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      leadId: z.string().uuid(),
      product: z.string().trim().min(1, "A product or line is required").max(300),
      amount: z.number().finite().min(0).max(1_000_000_000),
      currency: z.string().trim().length(3).default("USD"),
      status: z.enum(["draft", "sent", "accepted", "declined"]).default("sent"),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { agent } = await ownLead(sb, who, data.leadId, false);
    const { data: row, error } = await loose(sb)
      .from("reseller_lead_quotes")
      .insert({
        lead_id: data.leadId,
        owner_agent_id: agent,
        product: data.product,
        amount: data.amount,
        currency: data.currency.toUpperCase(),
        status: data.status,
      })
      .select("id, lead_id, product, amount, currency, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ResellerLeadQuote;
  });

type ResellerLeadProposal = {
  id: string;
  lead_id: string;
  title: string;
  body: string;
  status: "draft" | "sent";
  created_at: string;
};

export const listResellerLeadProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ leadId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    await ownLead(sb, who, data.leadId, false);
    const { data: rows, error } = await loose(sb)
      .from("reseller_lead_proposals")
      .select("id, lead_id, title, body, status, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ResellerLeadProposal[];
  });

export const addResellerLeadProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      leadId: z.string().uuid(),
      title: z.string().trim().min(1, "A proposal title is required").max(300),
      body: z.string().trim().min(1, "Proposal details are required").max(20_000),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { agent } = await ownLead(sb, who, data.leadId, false);
    const { data: row, error } = await loose(sb)
      .from("reseller_lead_proposals")
      .insert({ lead_id: data.leadId, owner_agent_id: agent, title: data.title, body: data.body })
      .select("id, lead_id, title, body, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ResellerLeadProposal;
  });

/* ---------------- One client's purchases, licences and follow-ups ---------------- */

const PAID = new Set(["paid", "processing", "fulfilled", "completed"]);

/** Split a list for .in() filters, which travel in the URL. */
function chunks<T>(list: T[], size = 150): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function readIn(sb: Sb, table: string, columns: string, column: string, values: string[]) {
  const rows: Record<string, unknown>[] = [];
  for (const part of chunks([...new Set(values)])) {
    const { data, error } = await loose(sb).from(table).select(columns).in(column, part);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
  }
  return rows;
}

/** Every order this reseller is credited with (marketplace_order_attributions.reseller_id). */
async function attributedOrders(sb: Sb, resellerId: string) {
  const { data, error } = await loose(sb)
    .from("marketplace_order_attributions")
    .select("order_id")
    .eq("reseller_id", resellerId)
    .limit(5000);
  if (error) throw new Error(error.message);
  const ids = ((data ?? []) as { order_id: string }[]).map((a) => a.order_id);
  if (!ids.length) return [];
  return (await readIn(
    sb,
    "marketplace_orders",
    "id, order_number, order_no, buyer_id, status, currency, total, amount_usd, created_at",
    "id",
    ids,
  )) as {
    id: string;
    order_number: string | null;
    order_no: string | null;
    buyer_id: string | null;
    status: string;
    currency: string | null;
    total: number | string | null;
    amount_usd: number | string | null;
    created_at: string;
  }[];
}

/** Verify the client belongs to this reseller's CRM owner row. */
async function ownedClient(sb: Sb, who: Reseller, clientId: string) {
  const owner = await ownerIdFor(sb, who, false);
  if (!owner) throw new Error("That client was not found among yours.");
  const client = await loose(sb)
    .from("crm_customers")
    .select("id, email, created_at")
    .eq("id", clientId)
    .eq("owner_id", owner)
    .maybeSingle();
  if (client.error) throw new Error(client.error.message);
  if (!client.data) throw new Error("That client was not found among yours.");
  return { owner, client: client.data as { id: string; email: string | null; created_at: string } };
}

/**
 * The client's orders among this reseller's credited sales. Matching a CRM
 * email against every marketplace order would expose unrelated purchases.
 */
async function clientOrders(sb: Sb, who: Reseller, clientId: string) {
  const { owner, client } = await ownedClient(sb, who, clientId);
  const email = (client.email ?? "").trim().toLowerCase();
  if (!email) return { owner, client, orders: [] };

  const orders = await attributedOrders(sb, who.reseller.id);
  const buyerIds = [...new Set(orders.map((o) => o.buyer_id).filter((b): b is string => !!b))];
  if (!buyerIds.length) return { owner, client, orders: [] };
  // Exact, case-insensitive address match among those buyers only.
  const buyers = (await readIn(sb, "profiles", "id, email", "id", buyerIds)) as {
    id: string;
    email: string | null;
  }[];
  const theirs = new Set(
    buyers.filter((b) => (b.email ?? "").trim().toLowerCase() === email).map((b) => b.id),
  );
  return {
    owner,
    client,
    orders: orders.filter((o) => o.buyer_id && theirs.has(o.buyer_id)),
  };
}

/**
 * The licences a reseller has sold to one of their clients. The key itself is
 * the buyer's, so only its ends are shown.
 */
export const listResellerClientLicences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ clientId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { orders } = await clientOrders(sb, who, data.clientId);
    if (!orders.length) return [];

    const items = (await readIn(
      sb,
      "marketplace_order_items",
      "id, product_name",
      "order_id",
      orders.map((o) => o.id),
    )) as {
      id: string;
      product_name: string;
    }[];
    const product = new Map(items.map((i) => [i.id, i.product_name]));
    if (!product.size) return [];

    const licences = (await readIn(
      sb,
      "marketplace_licenses",
      "id, order_item_id, license_key, license_model, status, expires_at, created_at",
      "order_item_id",
      [...product.keys()],
    )) as {
      id: string;
      order_item_id: string;
      license_key: string | null;
      license_model: string | null;
      status: string;
      expires_at: string | null;
      created_at: string;
    }[];
    return licences
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((l) => ({
        id: l.id,
        product: product.get(l.order_item_id) ?? "Licence",
        keyHint: l.license_key ? `${l.license_key.slice(0, 4)}…${l.license_key.slice(-4)}` : "—",
        model: l.license_model,
        status: l.status,
        expires_at: l.expires_at,
      }));
  });

type ClientTask = {
  id: string;
  title: string;
  due_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

/**
 * A client's purchase history (orders credited to this reseller that the
 * client's address placed) and follow-ups (crm_tasks for the client).
 */
export const listResellerClientActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ clientId: z.string().uuid() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { owner, client, orders } = await clientOrders(sb, who, data.clientId);

    const items = orders.length
      ? ((await readIn(
          sb,
          "marketplace_order_items",
          "order_id, product_name",
          "order_id",
          orders.map((o) => o.id),
        )) as {
          order_id: string;
          product_name: string;
        }[])
      : [];
    const names = new Map<string, string[]>();
    for (const i of items)
      names.set(i.order_id, [...(names.get(i.order_id) ?? []), i.product_name]);

    const tasks = await loose(sb)
      .from("crm_tasks")
      .select("id, title, due_at, status, created_at, updated_at")
      .eq("customer_id", data.clientId)
      .eq("owner_id", owner)
      .order("created_at", { ascending: false })
      .limit(200);
    if (tasks.error) throw new Error(tasks.error.message);
    const [noteResult, documentResult, communicationResult] = await Promise.all([
      loose(sb)
        .from("reseller_client_notes")
        .select("notes")
        .eq("client_id", data.clientId)
        .eq("owner_id", owner)
        .maybeSingle(),
      loose(sb)
        .from("reseller_client_documents")
        .select("id, file_name, mime_type, file_size, storage_path, created_at")
        .eq("client_id", data.clientId)
        .eq("owner_id", owner)
        .order("created_at", { ascending: false })
        .limit(100),
      loose(sb)
        .from("reseller_client_communications")
        .select("id, communication_type, content, actor_name, created_at")
        .eq("client_id", data.clientId)
        .eq("owner_id", owner)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    for (const result of [noteResult, documentResult, communicationResult]) {
      if (result.error) throw new Error(result.error.message);
    }

    return {
      clientCreatedAt: client.created_at,
      notes: ((noteResult.data as { notes?: string } | null)?.notes ?? ""),
      documents: (documentResult.data ?? []) as ClientDocumentRow[],
      communications: (communicationResult.data ?? []) as ClientCommunicationRow[],
      purchases: orders
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((o) => ({
          id: o.id,
          number: o.order_number ?? o.order_no ?? o.id.slice(0, 8),
          products: names.get(o.id) ?? [],
          amount: Number(o.total ?? 0),
          currency: o.currency ?? "USD",
          status: o.status,
          date: o.created_at,
        })),
      followUps: (tasks.data ?? []) as ClientTask[],
    };
  });

export const addResellerClientFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z
      .object({
        clientId: z.string().uuid(),
        title: z.string().trim().min(1, "Say what the follow-up is").max(500),
        due: z.string().optional(),
      })
      .parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { owner } = await ownedClient(sb, who, data.clientId);
    const due = data.due ? Date.parse(data.due) : NaN;
    const { data: row, error } = await loose(sb)
      .from("crm_tasks")
      .insert({
        title: data.title,
        task_type: "follow_up",
        status: "pending",
        due_at: Number.isNaN(due) ? null : new Date(due).toISOString(),
        owner_id: owner,
        customer_id: data.clientId,
      })
      .select("id, title, due_at, status, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ClientTask;
  });

export const setResellerClientFollowUpDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const owner = await ownerIdFor(sb, who, false);
    if (!owner) throw new Error("That follow-up was not found among yours.");
    const { data: row, error } = await loose(sb)
      .from("crm_tasks")
      .update({ status: data.done ? "completed" : "pending", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("owner_id", owner)
      .not("customer_id", "is", null)
      .select("id, title, due_at, status, created_at, updated_at")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That follow-up was not found among yours.");
    return row as ClientTask;
  });

type ClientDocumentRow = {
  id: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

type ClientCommunicationRow = {
  id: string;
  communication_type: string;
  content: string;
  actor_name: string;
  created_at: string;
};

export const saveResellerClientNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({ clientId: z.string().uuid(), notes: z.string().max(20_000) }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { owner } = await ownedClient(sb, who, data.clientId);
    const { data: row, error } = await loose(sb)
      .from("reseller_client_notes")
      .upsert(
        { client_id: data.clientId, owner_id: owner, notes: data.notes, updated_at: new Date().toISOString() },
        { onConflict: "client_id" },
      )
      .select("client_id, notes, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as { client_id: string; notes: string; updated_at: string };
  });

export const addResellerClientCommunication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      clientId: z.string().uuid(),
      content: z.string().trim().min(1, "Describe the communication").max(2000),
      kind: z.enum(["call", "email", "meeting", "other"]).default("other"),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { owner } = await ownedClient(sb, who, data.clientId);
    const { data: row, error } = await loose(sb)
      .from("reseller_client_communications")
      .insert({
        client_id: data.clientId,
        owner_id: owner,
        actor_id: who.userId,
        actor_name: who.name,
        communication_type: data.kind,
        content: data.content,
      })
      .select("id, communication_type, content, actor_name, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ClientCommunicationRow;
  });

export const registerResellerClientDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      clientId: z.string().uuid(),
      storagePath: z.string().min(1).max(200),
      fileName: z.string().trim().min(1).max(255),
      mimeType: z.string().min(1).max(150),
      fileSize: z.number().int().positive().max(15 * 1024 * 1024),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    const who = await requireReseller(sb, context);
    const { owner } = await ownedClient(sb, who, data.clientId);
    const pathPattern = new RegExp(`^${who.userId}/${data.clientId}/[0-9a-f-]{36}$`, "i");
    if (!pathPattern.test(data.storagePath)) throw new Error("That document upload path is not valid.");
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);
    if (!allowedTypes.has(data.mimeType)) throw new Error("That document type is not supported.");
    const { data: row, error } = await loose(sb)
      .from("reseller_client_documents")
      .insert({
        client_id: data.clientId,
        owner_id: owner,
        uploaded_by: who.userId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        storage_path: data.storagePath,
      })
      .select("id, file_name, mime_type, file_size, storage_path, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ClientDocumentRow;
  });

/* ---------------- Dashboard figures ---------------- */

/** An amount in US dollars, or null when the row's currency cannot be stated in dollars. */
function usd(amount: unknown, currency: unknown, amountUsd?: unknown): number | null {
  if (amountUsd != null && amountUsd !== "") return Number(amountUsd);
  if (String(currency ?? "USD").toUpperCase() === "USD") return Number(amount ?? 0);
  return null;
}

/** Sum in dollars; null if any row could not be stated in dollars. */
function sumUsd(values: (number | null)[]) {
  let total = 0;
  for (const v of values) {
    if (v == null || Number.isNaN(v)) return null;
    total += v;
  }
  return Math.round(total * 100) / 100;
}

export type ResellerOverview = {
  reseller: {
    id: string;
    name: string;
    status: string;
    tier: string | null;
    verified: boolean;
    kycStatus: string | null;
  } | null;
  membership: {
    planCode: string;
    planName: string | null;
    status: string;
    expiresAt: string | null;
  } | null;
  rank: number | null;
  /** KPI values by the reseller KPI keys in lib/roles.ts; null = no source. */
  metrics: Record<string, number | null>;
  earnings: { available: number | null; pending: number | null; lifetime: number | null };
};

export type ResellerLedgerCommission = {
  id: string;
  order_id: string;
  gross_amount: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
};

export type ResellerLedgerPayout = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  requested_at: string | null;
  completed_at: string | null;
  provider_reference: string | null;
};

export type ResellerLedgerMembership = {
  id: string;
  plan_code: string | null;
  membership_state: string;
  activated_at: string | null;
  expires_at: string | null;
  renewal_at: string | null;
};

export type ResellerLedger = {
  linked: boolean;
  commissions: ResellerLedgerCommission[];
  payouts: ResellerLedgerPayout[];
  memberships: ResellerLedgerMembership[];
};

/** The signed-in reseller's own commissions, payouts, and memberships. */
export const getResellerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResellerLedger> => {
    const sb = writer();
    const { hasRole, reseller } = await resellerOf(sb, context.userId);
    if (!hasRole) throw new Error("This workspace belongs to reseller accounts.");
    if (!reseller) {
      return { linked: false, commissions: [], payouts: [], memberships: [] };
    }
    if (reseller.status !== "active") {
      throw new Error(
        `This reseller account is ${reseller.status}, so its ledger cannot be opened.`,
      );
    }

    const [commissions, payouts, memberships] = await Promise.all([
      loose(sb)
        .from("reseller_commissions")
        .select("id, order_id, gross_amount, commission_amount, currency, status, created_at")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(1000),
      loose(sb)
        .from("reseller_payouts")
        .select("id, amount, currency, status, requested_at, completed_at, provider_reference")
        .eq("reseller_id", reseller.id)
        .order("requested_at", { ascending: false })
        .limit(1000),
      loose(sb)
        .from("reseller_memberships")
        .select("id, plan_code, membership_state, activated_at, expires_at, renewal_at")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);
    if (commissions.error) throw new Error(commissions.error.message);
    if (payouts.error) throw new Error(payouts.error.message);
    if (memberships.error) throw new Error(memberships.error.message);

    return {
      linked: true,
      commissions: (commissions.data ?? []) as ResellerLedgerCommission[],
      payouts: (payouts.data ?? []) as ResellerLedgerPayout[],
      memberships: (memberships.data ?? []) as ResellerLedgerMembership[],
    };
  });

async function loadResellerOverview(context: { userId: string; claims?: Record<string, unknown> }) {
  const sb = writer();
  const empty: ResellerOverview = {
    reseller: null,
    membership: null,
    rank: null,
    metrics: {},
    earnings: { available: null, pending: null, lifetime: null },
  };
  const { reseller } = await resellerOf(sb, context.userId);
  if (!reseller) return empty;
  const email =
    typeof context.claims?.email === "string" ? context.claims.email.trim().toLowerCase() : "";
  const who: Reseller = { userId: context.userId, reseller, email, name: reseller.name ?? email };
  const now = Date.now();

  // Clients: crm_customers owned by the reseller's team_members row.
  const owner = email ? await ownerIdFor(sb, who, false) : null;
  let activeClients = 0;
  if (owner) {
    const { data, error } = await loose(sb)
      .from("crm_customers")
      .select("status")
      .eq("owner_id", owner)
      .limit(5000);
    if (error) throw new Error(error.message);
    activeClients = ((data ?? []) as { status: string }[]).filter(
      (c) => c.status === "active",
    ).length;
  }

  // Leads: assigned to the reseller's own agent row.
  const agent = email ? await agentIdFor(sb, who, false) : null;
  const leadCount: Record<string, number> = {};
  if (agent) {
    const { data, error } = await loose(sb)
      .from("leads")
      .select("status")
      .eq("assigned_agent_id", agent)
      .limit(5000);
    if (error) throw new Error(error.message);
    for (const l of (data ?? []) as { status: string }[])
      leadCount[l.status] = (leadCount[l.status] ?? 0) + 1;
  }
  const leadsTotal = Object.values(leadCount).reduce((a, b) => a + b, 0);
  const closed = (leadCount.won ?? 0) + (leadCount.lost ?? 0) + (leadCount.spam ?? 0);

  // Sales credited to the reseller, and the licences issued for them.
  const orders = await attributedOrders(sb, reseller.id);
  const paid = orders.filter((o) => PAID.has(o.status));
  const items = orders.length
    ? ((await readIn(
        sb,
        "marketplace_order_items",
        "id",
        "order_id",
        orders.map((o) => o.id),
      )) as { id: string }[])
    : [];
  const licences = items.length
    ? ((await readIn(
        sb,
        "marketplace_licenses",
        "id, buyer_id, status, license_model, expires_at",
        "order_item_id",
        items.map((i) => i.id),
      )) as {
        id: string;
        buyer_id: string | null;
        status: string;
        license_model: string | null;
        expires_at: string | null;
      }[])
    : [];
  const lapsed = (l: { expires_at: string | null }) =>
    !!l.expires_at && Date.parse(l.expires_at) < now;
  const live = licences.filter((l) => l.status === "active" && !lapsed(l));
  const expired = licences.filter(
    (l) => l.status === "expired" || (l.status !== "revoked" && lapsed(l)),
  );
  const trialBuyers = new Set(
    live.filter((l) => l.license_model === "trial").map((l) => l.buyer_id ?? l.id),
  );

  // Commissions and payouts: the reseller's own ledgers.
  const commissions = await loose(sb)
    .from("reseller_commissions")
    .select("commission_amount, currency, status, created_at")
    .eq("reseller_id", reseller.id)
    .limit(5000);
  if (commissions.error) throw new Error(commissions.error.message);
  const ledger = (commissions.data ?? []) as {
    commission_amount: number;
    currency: string;
    status: string;
    created_at: string;
  }[];
  const monthStart = new Date(
    Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1),
  ).toISOString();
  const earned = ledger.filter((c) => c.status !== "reversed");
  const inDollars = (rows: typeof ledger) =>
    sumUsd(rows.map((c) => usd(c.commission_amount, c.currency)));

  const payouts = await loose(sb)
    .from("reseller_payouts")
    .select("amount, currency, status")
    .eq("reseller_id", reseller.id)
    .in("status", ["pending", "approved", "processing"])
    .limit(5000);
  if (payouts.error) throw new Error(payouts.error.message);

  // Plan: the active membership of this reseller record.
  const membership = await loose(sb)
    .from("reseller_memberships")
    .select("plan_code, status, expires_at, activated_at")
    .eq("reseller_id", reseller.id)
    .eq("status", "active")
    .order("activated_at", { ascending: false })
    .limit(1);
  if (membership.error) throw new Error(membership.error.message);
  const current =
    (
      (membership.data ?? []) as {
        plan_code: string;
        status: string;
        expires_at: string | null;
      }[]
    )[0] ?? null;
  let planName: string | null = null;
  if (current) {
    const plan = await loose(sb)
      .from("reseller_membership_plans")
      .select("name")
      .eq("code", current.plan_code)
      .maybeSingle();
    planName = (plan.data as { name?: string } | null)?.name ?? null;
  }

  // Rank: the best place this account holds on any leaderboard.
  const ranks = await loose(sb)
    .from("leaderboard_entries")
    .select("rank")
    .eq("user_id", context.userId)
    .limit(100);
  if (ranks.error) throw new Error(ranks.error.message);
  const rankList = ((ranks.data ?? []) as { rank: number | null }[])
    .map((r) => r.rank)
    .filter((r): r is number => r != null);

  return {
    reseller: {
      id: reseller.id,
      name: reseller.company_name || reseller.name || "Your Reseller Account",
      status: reseller.status,
      tier: reseller.tier,
      verified: reseller.kyc_status === "verified",
      kycStatus: reseller.kyc_status,
    },
    membership: current
      ? {
          planCode: current.plan_code,
          planName,
          status: current.status,
          expiresAt: current.expires_at,
        }
      : null,
    rank: rankList.length ? Math.min(...rankList) : null,
    metrics: {
      clients: activeClients,
      licenses: live.length,
      "trial-clients": trialBuyers.size,
      "expired-licenses": expired.length,
      leads: leadsTotal - closed,
      "leads-won": leadCount.won ?? 0,
      "leads-lost": leadCount.lost ?? 0,
      // Not yet worked: a lead still at "new".
      "leads-pending": leadCount.new ?? 0,
      commissions: inDollars(earned.filter((c) => c.created_at >= monthStart)),
      "payout-pending": sumUsd(
        ((payouts.data ?? []) as { amount: number; currency: string }[]).map((p) =>
          usd(p.amount, p.currency),
        ),
      ),
      revenue: sumUsd(paid.map((o) => usd(o.total, o.currency, o.amount_usd))),
      // No table records a licence renewal yet, so there is no rate to show.
      renewals: null,
    },
    earnings: {
      available: inDollars(ledger.filter((c) => c.status === "available")),
      pending: inDollars(ledger.filter((c) => c.status === "pending")),
      lifetime: inDollars(earned),
    },
  } satisfies ResellerOverview;
}

export const getResellerMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const overview = await loadResellerOverview(context);
    return { metrics: overview.metrics };
  });

/**
 * Every figure on the reseller's home screen, read from the tables that hold
 * them and scoped to the signed-in reseller on the server. Nothing is created.
 * A caller who is not a reseller gets an empty answer, which the screen shows
 * as dashes.
 */
export const getResellerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResellerOverview> => loadResellerOverview(context));

/**
 * The payment rails Finance has switched on, for the membership payment form.
 * finance_payment_rails is readable only by finance operators, so the list is
 * read here; only a rail's code and name leave the server.
 */
export const listResellerPaymentRails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const sb = writer();
    const { data, error } = await loose(sb)
      .from("finance_payment_rails")
      .select("code, display_name")
      .eq("enabled", true)
      .order("display_name");
    if (error) throw new Error(error.message);
    return ((data ?? []) as { code: string; display_name: string | null }[]).map((r) => ({
      code: r.code,
      label: r.display_name || r.code,
    }));
  });

const resellerAccountSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    companyName: z.string().trim().max(200).optional(),
    legalName: z.string().trim().max(200).optional(),
    gstNumber: z.string().trim().max(40).optional(),
    panNumber: z.string().trim().max(20).optional(),
    region: z.string().trim().max(120).optional(),
    timezone: z.string().trim().max(100).optional(),
    companyAddress: z.string().trim().max(2000).optional(),
    payoutMethod: z.enum(["bank", "upi"]).optional(),
    bankAccountHolder: z.string().trim().max(160).optional(),
    bankName: z.string().trim().max(160).optional(),
    bankAccountNumber: z.string().trim().max(80).optional(),
    bankIfsc: z.string().trim().max(20).optional(),
    upiVpa: z.string().trim().max(100).optional(),
  })
  .refine((value) => !value.bankIfsc || /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(value.bankIfsc), {
    path: ["bankIfsc"],
    message: "Enter a valid IFSC code.",
  })
  .refine((value) => !value.upiVpa || /^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/.test(value.upiVpa), {
    path: ["upiVpa"],
    message: "Enter a valid UPI ID.",
  });

export const getResellerAccountSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const { reseller } = await requireReseller(sb, context);
    const [profile, settings] = await Promise.all([
      loose(sb)
        .from("resellers")
        .select(
          "name, email, phone, company_name, legal_name, gst_number, pan_number, region, kyc_status",
        )
        .eq("id", reseller.id)
        .eq("user_id", context.userId)
        .maybeSingle(),
      loose(sb)
        .from("reseller_account_settings")
        .select(
          "timezone, company_address, payout_method, bank_account_holder, bank_name, bank_account_number, bank_ifsc, upi_vpa",
        )
        .eq("reseller_id", reseller.id)
        .maybeSingle(),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    if (settings.error) throw new Error(settings.error.message);
    if (!profile.data) throw new Error("The reseller profile could not be loaded.");
    const p = profile.data as Record<string, string | null>;
    const s = (settings.data ?? {}) as Record<string, string | null>;
    return {
      profile: {
        resellerId: reseller.id,
        name: p.name ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        companyName: p.company_name ?? "",
        legalName: p.legal_name ?? "",
        gstNumber: p.gst_number ?? "",
        panNumber: p.pan_number ?? "",
        region: p.region ?? "",
        kycStatus: p.kyc_status ?? "unverified",
      },
      settings: {
        timezone: s.timezone ?? "UTC",
        companyAddress: s.company_address ?? "",
        payoutMethod: s.payout_method ?? "bank",
        bankAccountHolder: s.bank_account_holder ?? "",
        bankName: s.bank_name ?? "",
        bankAccountNumber: s.bank_account_number ?? "",
        bankIfsc: s.bank_ifsc ?? "",
        upiVpa: s.upi_vpa ?? "",
      },
    };
  });

export const saveResellerAccountSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => resellerAccountSettingsSchema.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const { reseller } = await requireReseller(sb, context);
    const profile: Record<string, string> = {};
    if (data.name !== undefined) profile.name = data.name;
    if (data.phone !== undefined) profile.phone = data.phone;
    if (data.companyName !== undefined) profile.company_name = data.companyName;
    if (data.legalName !== undefined) profile.legal_name = data.legalName;
    if (data.gstNumber !== undefined) profile.gst_number = data.gstNumber;
    if (data.panNumber !== undefined) profile.pan_number = data.panNumber;
    if (data.region !== undefined) profile.region = data.region;

    if (Object.keys(profile).length) {
      const result = await loose(sb)
        .from("resellers")
        .update(profile)
        .eq("id", reseller.id)
        .eq("user_id", context.userId)
        .select("id")
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("The reseller profile was not updated.");
    }

    const settings: Record<string, string> = {};
    if (data.timezone !== undefined) settings.timezone = data.timezone;
    if (data.companyAddress !== undefined) settings.company_address = data.companyAddress;
    if (data.payoutMethod !== undefined) settings.payout_method = data.payoutMethod;
    if (data.bankAccountHolder !== undefined) settings.bank_account_holder = data.bankAccountHolder;
    if (data.bankName !== undefined) settings.bank_name = data.bankName;
    if (data.bankAccountNumber !== undefined) settings.bank_account_number = data.bankAccountNumber;
    if (data.bankIfsc !== undefined) settings.bank_ifsc = data.bankIfsc.toUpperCase();
    if (data.upiVpa !== undefined) settings.upi_vpa = data.upiVpa;

    if (Object.keys(settings).length) {
      const result = await loose(sb)
        .from("reseller_account_settings")
        .upsert(
          { reseller_id: reseller.id, ...settings, updated_at: new Date().toISOString() },
          { onConflict: "reseller_id" },
        )
        .select("reseller_id")
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) throw new Error("The reseller settings were not saved.");
    }
    return { success: true };
  });

const resellerKycDocumentSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});

export const listResellerKycDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = writer();
    const { reseller } = await requireReseller(sb, context);
    const result = await loose(sb)
      .from("reseller_kyc_documents")
      .select("id, file_name, mime_type, file_size, storage_path, created_at")
      .eq("reseller_id", reseller.id)
      .eq("uploaded_by", context.userId)
      .order("created_at", { ascending: false });
    if (result.error) throw new Error(result.error.message);
    const documents = (result.data ?? []) as {
      id: string;
      file_name: string;
      mime_type: string;
      file_size: number;
      storage_path: string;
      created_at: string;
    }[];
    return Promise.all(
      documents.map(async (doc) => {
        const signed = await sb.storage
          .from("reseller-kyc-documents")
          .createSignedUrl(doc.storage_path, 300);
        if (signed.error) throw new Error(signed.error.message);
        return {
          id: doc.id,
          fileName: doc.file_name,
          mimeType: doc.mime_type,
          fileSize: doc.file_size,
          createdAt: doc.created_at,
          url: signed.data.signedUrl,
        };
      }),
    );
  });

export const registerResellerKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) => resellerKycDocumentSchema.parse(value ?? {}))
  .handler(async ({ data, context }) => {
    const sb = writer();
    const { reseller } = await requireReseller(sb, context);
    const expectedPrefix = `${context.userId}/${reseller.id}/`;
    if (!data.storagePath.startsWith(expectedPrefix) || data.storagePath.includes("..")) {
      throw new Error("The uploaded document path is not owned by this reseller account.");
    }
    const inserted = await loose(sb)
      .from("reseller_kyc_documents")
      .insert({
        reseller_id: reseller.id,
        uploaded_by: context.userId,
        file_name: data.fileName,
        mime_type: data.mimeType,
        file_size: data.fileSize,
        storage_path: data.storagePath,
      })
      .select("id")
      .maybeSingle();
    if (inserted.error) throw new Error(inserted.error.message);
    if (!inserted.data) throw new Error("The KYC document could not be registered.");
    const updated = await loose(sb)
      .from("resellers")
      .update({ kyc_status: "submitted" })
      .eq("id", reseller.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (updated.error || !updated.data) {
      const failure =
        updated.error?.message ??
        "The document was saved, but the KYC status could not be updated.";
      const cleanup = await loose(sb)
        .from("reseller_kyc_documents")
        .delete()
        .eq("id", inserted.data.id);
      if (cleanup.error) {
        throw new Error(
          `${failure} The incomplete document record could not be removed: ${cleanup.error.message}`,
        );
      }
      throw new Error(failure);
    }
    return { success: true };
  });

export const RESELLER_AI_TOOLS = [
  "sales-assistant",
  "lead-scoring",
  "proposal",
  "email",
  "whatsapp",
  "followup",
  "renewal",
  "forecast",
] as const;

export type ResellerAiTool = (typeof RESELLER_AI_TOOLS)[number];

const RESELLER_AI_INSTRUCTIONS: Record<ResellerAiTool, string> = {
  "sales-assistant":
    "Help a software reseller with sales objections, product pitches and demo preparation. Give practical, concise guidance and do not invent product capabilities or customer facts.",
  "lead-scoring":
    "Assess the supplied lead for fit, intent and conversion likelihood. Give a transparent 0-100 estimate, explain the evidence and uncertainty, and recommend the next qualifying questions. Do not invent missing facts.",
  proposal:
    "Draft a tailored software-services proposal from the supplied brief. Clearly label assumptions, describe scope and deliverables, and do not invent prices, guarantees, product features or legal terms.",
  email:
    "Write a polished sales email based only on the supplied goal and facts. Use a clear subject, concise body and one appropriate call to action. Do not invent names, promises or product capabilities.",
  whatsapp:
    "Write a brief, natural WhatsApp sales message based only on the supplied intent and facts. Keep it concise, respectful and include a clear next step without inventing details.",
  followup:
    "Recommend a practical next follow-up based only on the supplied pipeline snapshot. State the suggested channel, timing and message, and identify uncertainty rather than inventing activity.",
  renewal:
    "Assess renewal or churn risk using only the supplied account information. Explain the evidence and uncertainty, and suggest concrete retention checks without claiming access to license telemetry not provided.",
  forecast:
    "Prepare a cautious revenue or commission forecast from the supplied figures and horizon. State assumptions and missing inputs clearly; do not fabricate historical or financial data.",
};

export function resellerAiInstructions(tool: ResellerAiTool) {
  return RESELLER_AI_INSTRUCTIONS[tool];
}

export function eligibleResellerAiServiceId(service: unknown): string | null {
  if (!service || typeof service !== "object" || Array.isArray(service)) return null;
  const row = service as Record<string, unknown>;
  const tier = String(row["pricing_tier"] ?? "").toLowerCase();
  const category = String(row["category"] ?? "").toLowerCase();
  if (
    row["status"] !== "active" ||
    row["approval_status"] !== "approved" ||
    !["ai", "llm"].includes(category) ||
    !["local", "free", "free-tier", "freemium"].includes(tier)
  ) {
    return null;
  }
  return typeof row["id"] === "string" && row["id"].trim() ? row["id"] : null;
}

export const generateResellerAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value) =>
    z.object({
      tool: z.enum(RESELLER_AI_TOOLS),
      input: z.string().trim().min(1, "Enter information for the AI tool").max(4000),
    }).parse(value ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = writer();
    await requireReseller(sb, context);
    const { data: service, error: serviceError } = await loose(sb)
      .from("api_services")
      .select("id, category, status, approval_status, pricing_tier")
      .eq("status", "active")
      .eq("approval_status", "approved")
      .in("category", ["ai", "llm"])
      .in("pricing_tier", ["local", "free", "free-tier", "freemium"])
      .order("name", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (serviceError) {
      throw new Error(`Could not verify free-tier AI availability: ${serviceError.message}`);
    }
    const serviceId = eligibleResellerAiServiceId(service);
    if (!serviceId) {
      throw new Error("No active approved free-tier AI service is available for Reseller AI.");
    }
    const result = await aiComplete({
      module: "reseller",
      serviceId,
      temperature: 0.4,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are Software Vala's practical reseller assistant. Use only facts in the user's input; " +
            "do not claim to have read the reseller's CRM, products, orders, or account data. " +
            `${resellerAiInstructions(data.tool)} Return useful, clear plain text.`,
        },
        { role: "user", content: data.input },
      ],
    });
    const text = result.text.trim();
    if (!text) throw new Error("The AI provider returned an empty answer.");
    return { text, model: result.model };
  });
