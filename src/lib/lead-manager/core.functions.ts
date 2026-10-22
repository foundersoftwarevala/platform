import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Lead } from "./types";

const UUID = z.string().uuid();
const statusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "proposal",
  "interested",
  "follow_up",
  "negotiation",
  "won",
  "lost",
  "spam",
]);
const sourceSchema = z.enum([
  "website",
  "seo",
  "social",
  "ads",
  "marketplace",
  "referral",
  "manual",
  "api",
  "whatsapp",
]);

const activityStateSchema = z.object({
  status: z.string().optional(),
  assigned_agent_id: UUID.nullable().optional(),
  assigned_to: UUID.nullable().optional(),
});

const activitySchema = z.object({
  id: UUID,
  lead_id: UUID,
  actor_id: UUID,
  action: z.string(),
  note: z.string().nullable(),
  before_state: activityStateSchema.nullable(),
  after_state: activityStateSchema.nullable(),
  created_at: z.string(),
});

const assignableAgentSchema = z.object({
  id: UUID,
  name: z.string(),
  team: z.string(),
  status: z.string(),
});

type Activity = z.infer<typeof activitySchema>;
export type AssignableLeadAgent = z.infer<typeof assignableAgentSchema>;

function databaseUrl(): string {
  const value = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  if (!value) throw new Error("Lead Manager database is not configured.");
  return value;
}

function publishableKey(): string {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) throw new Error("Lead Manager database is not configured.");
  return key;
}

function callerToken(): string {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new Error("Authentication is required.");
  return token;
}

async function callLeadRpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${databaseUrl()}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey(),
      Authorization: `Bearer ${callerToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      if (response.ok) throw new Error("Lead Manager server returned an invalid response.");
    }
  }
  if (!response.ok) {
    const error = z.object({ message: z.string().optional() }).safeParse(body);
    throw new Error(error.success ? error.data.message ?? "Lead Manager request failed." : "Lead Manager request failed.");
  }
  return body;
}

async function getLead(
  context: { supabase: import("@supabase/supabase-js").SupabaseClient },
  id: string,
): Promise<Lead> {
  const { data, error } = await context.supabase.from("leads").select("*").eq("id", id).single();
  if (error) throw new Error(`Lead could not be loaded: ${error.message}`);
  return data;
}

export const getLeadRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        status: statusSchema.optional(),
        source: sourceSchema.optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).max(100_000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const limit = data.limit ?? 200;
    const offset = data.offset ?? 0;
    let query = context.supabase
      .from("leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const term = data.search?.replace(/[(),*%_\\"']/g, " ").trim();
    if (term) {
      query = query.or(["name", "email", "company", "city"].map((field) => `${field}.ilike.%${term}%`).join(","));
    }
    if (data.status) query = query.filter("status", "eq", data.status);
    if (data.source) query = query.filter("source", "eq", data.source);

    const { data: rows, error, count } = await query;
    if (error) throw new Error(`Leads could not be loaded: ${error.message}`);
    return { rows, count: count ?? 0 };
  });

const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  company: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(120).nullable().optional(),
  source: z.enum(["website", "seo", "social", "ads", "marketplace", "referral", "manual", "api", "whatsapp"]),
  sub_source: z.string().trim().max(200).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  deal_value: z.number().finite().min(0),
  requirements: z.string().trim().max(20_000).nullable().optional(),
});

export const createLeadRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => createLeadSchema.parse(input))
  .handler(async ({ data, context }): Promise<Lead> => {
    const id = UUID.parse(
      await callLeadRpc("lead_manager_create_lead", {
        p_name: data.name,
        p_email: data.email.toLowerCase(),
        p_phone: data.phone,
        p_company: data.company ?? null,
        p_city: data.city ?? null,
        p_state: data.state ?? null,
        p_source: data.source,
        p_sub_source: data.sub_source ?? "Manual Entry",
        p_priority: data.priority,
        p_deal_value: data.deal_value,
        p_requirements: data.requirements ?? null,
      }),
    );
    return getLead(context, id);
  });

export const updateLeadRecordStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ leadId: UUID, status: statusSchema, note: z.string().trim().max(2_000).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Lead> => {
    const id = UUID.parse(
      await callLeadRpc("lead_manager_update_status", {
        p_lead_id: data.leadId,
        p_status: data.status,
        p_note: data.note ?? null,
      }),
    );
    return getLead(context, id);
  });

export const assignLeadRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ leadId: UUID, agentId: UUID, note: z.string().trim().max(2_000).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Lead> => {
    const id = UUID.parse(
      await callLeadRpc("lead_manager_assign_lead", {
        p_lead_id: data.leadId,
        p_agent_id: data.agentId,
        p_note: data.note ?? "Manual assignment",
      }),
    );
    return getLead(context, id);
  });

export const getLeadActivityRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ leadId: UUID }).parse(input))
  .handler(async ({ data }): Promise<Activity[]> => {
    const result = await callLeadRpc("lead_manager_get_activities", { p_lead_id: data.leadId });
    return z.array(activitySchema).parse(result);
  });

export const canAssignLeadRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<boolean> => {
    const result = await callLeadRpc("lead_manager_can_assign", {});
    return z.boolean().parse(result);
  });

export const getAssignableLeadAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AssignableLeadAgent[]> => {
    const result = await callLeadRpc("lead_manager_assignable_agents", {});
    return z.array(assignableAgentSchema).parse(result);
  });
