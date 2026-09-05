import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EntityFilter = {
  column: string;
  op?: "eq" | "ilike" | "in" | "gte" | "lte";
  value: unknown;
};

export type EntityListOptions = {
  table: string;
  select?: string;
  search?: { q?: string; columns: string[] };
  filters?: EntityFilter[];
  order?: { column: string; ascending?: boolean };
  page?: number;
  pageSize?: number;
  countMode?: "estimated" | "exact";
};

export type EntityListResult<T = Record<string, unknown>> = {
  rows: T[];
  count: number;
  countIsEstimate: boolean;
  page: number;
  pageSize: number;
  totalPages: number;
};

/**
 * Paginated list fetcher for reseller-manager walls. Queries real Supabase tables.
 */
export function useResellerEntityList<T = Record<string, unknown>>(
  opts: EntityListOptions,
) {
  const {
    table,
    select = "*",
    search,
    filters = [],
    order = { column: "created_at", ascending: false },
    page = 1,
    pageSize = 25,
    countMode = "estimated",
  } = opts;

  return useQuery<EntityListResult<T>>({
    queryKey: ["reseller-entity", table, { select, search, filters, order, page, pageSize, countMode }],
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
    queryFn: async ({ signal }) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string, o?: { count?: "exact" | "estimated"; head?: boolean }) => any;
        };
      };

      let q = client
        .from(table)
        .select(select, { count: countMode })
        .order(order.column, { ascending: !!order.ascending })
        .range((page - 1) * pageSize, page * pageSize - 1);

      for (const f of filters) {
        if (f.value == null || f.value === "" || f.value === "all") continue;
        const op = f.op ?? "eq";
        q = (q as any)[op](f.column, f.value);
      }

      if (search?.q && search.columns.length) {
        const or = search.columns.map((c) => `${c}.ilike.%${search.q}%`).join(",");
        q = q.or(or);
      }

      const { data, error, count } = await q.abortSignal(signal);
      if (error) throw error;

      const total = count ?? 0;
      return {
        rows: (data ?? []) as T[],
        count: total,
        countIsEstimate: countMode === "estimated" && total > 1000,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    },
  });
}

/**
 * Create a reseller record
 */
export async function createReseller(data: {
  name: string;
  code: string;
  email: string;
  phone?: string;
  region?: string;
  tier?: string;
  company_name?: string;
  legal_name?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("resellers")
    .insert([{ ...data, status: "pending", kyc_status: "unverified" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Update a reseller
 */
export async function updateReseller(
  id: string,
  patch: Record<string, any>,
): Promise<any> {
  const { data, error } = await supabase
    .from("resellers")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a reseller
 */
export async function deleteReseller(id: string): Promise<void> {
  const { error } = await supabase.from("resellers").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Approve a reseller
 */
export async function approveReseller(id: string): Promise<any> {
  const userId = (await supabase.auth.getUser()).data?.user?.id;
  return updateReseller(id, {
    status: "active",
    approved_by: userId,
    approved_at: new Date().toISOString(),
  });
}

/**
 * Create application
 */
export async function createApplication(data: {
  reseller_id?: string;
  requester_email: string;
  requester_name?: string;
  company_name?: string;
  region?: string;
  motivation?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_applications")
    .insert([{ ...data, status: "pending" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  status: string,
): Promise<any> {
  const userId = (await supabase.auth.getUser()).data?.user?.id;
  const normalizedStatus = String(status ?? "").trim().toLowerCase();

  if (normalizedStatus === "approved" || normalizedStatus === "active") {
    const { data: application, error: applicationError } = await supabase
      .from("reseller_applications")
      .select("*")
      .eq("id", id)
      .single();

    if (applicationError) throw applicationError;

    const applicantEmail = String(application?.requester_email ?? "").trim();
    const applicantName = String(application?.requester_name ?? application?.company_name ?? "New Reseller").trim() || "New Reseller";
    const companyName = String(application?.company_name ?? "").trim() || applicantName;
    const region = String(application?.region ?? "").trim();
    const codeBase = (companyName || applicantName || "RSL")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "")
      .slice(0, 8) || "RSL";
    const code = `${codeBase}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const applicantUserId = application?.applicant_user_id ?? null;
    let resellerId = application?.reseller_id ?? null;

    if (!resellerId && applicantEmail) {
      const { data: existingResellers, error: existingError } = await supabase
        .from("resellers")
        .select("id, email")
        .or(`email.ilike.%${applicantEmail}%,user_id.eq.${applicantUserId ?? "00000000-0000-0000-0000-000000000000"}`)
        .limit(20);

      if (existingError) throw existingError;
      resellerId = existingResellers?.find((row) => String(row.email ?? "").toLowerCase() === applicantEmail.toLowerCase())?.id ?? existingResellers?.[0]?.id ?? null;
    }

    if (!resellerId) {
      const { data: reseller, error: createError } = await supabase
        .from("resellers")
        .insert([
          {
            name: applicantName,
            code,
            email: applicantEmail || `${applicantName.toLowerCase().replace(/\s+/g, ".")}@pending.local`,
            region,
            company_name: companyName,
            status: "active",
            kyc_status: "unverified",
            tier: "bronze",
            approved_by: userId ?? null,
            approved_at: new Date().toISOString(),
            user_id: applicantUserId,
          },
        ])
        .select("id")
        .single();

      if (createError) throw createError;
      resellerId = reseller.id;
    } else {
      const { error: updateResellerError } = await supabase
        .from("resellers")
        .update({
          name: applicantName,
          email: applicantEmail || undefined,
          region,
          company_name: companyName,
          status: "active",
          approved_by: userId ?? null,
          approved_at: new Date().toISOString(),
          user_id: applicantUserId,
        })
        .eq("id", resellerId);

      if (updateResellerError) throw updateResellerError;
    }

    const { data, error } = await supabase
      .from("reseller_applications")
      .update({
        status: "approved",
        reseller_id: resellerId,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  return supabase
    .from("reseller_applications")
    .update({ status: normalizedStatus, reviewed_by: userId, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
}

/**
 * Create KYC record
 */
export async function createKycRecord(data: {
  reseller_id: string;
  doc_type: string;
  doc_number: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_kyc")
    .insert([{ ...data, status: "pending" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Verify KYC
 */
export async function verifyKyc(id: string): Promise<any> {
  const userId = (await supabase.auth.getUser()).data?.user?.id;
  return supabase
    .from("reseller_kyc")
    .update({ status: "verified", verified_by: userId, verified_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()
    .then(({ data, error }) => {
      if (error) throw error;
      return data;
    });
}

/**
 * Create license
 */
export async function createLicense(data: {
  license_key: string;
  product: string;
  plan: string;
  reseller_id?: string;
  customer_name?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_licenses")
    .insert([{ ...data, status: "active" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create commission rule
 */
export async function createCommissionRule(data: {
  name: string;
  scope: string;
  tier: string;
  rate: number;
  cycle?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_commissions")
    .insert([{ ...data, status: "active" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create wallet transaction
 */
export async function createWalletTransaction(data: {
  reseller_id: string;
  type: string;
  amount: number;
  ref: string;
  note?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_wallet_transactions")
    .insert([{ ...data, status: "pending" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create subscription
 */
export async function createSubscription(data: {
  plan: string;
  customer: string;
  reseller_id?: string;
  cycle: string;
  amount: number;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_subscriptions")
    .insert([{ ...data, status: "active" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create notification
 */
export async function createNotification(data: {
  title: string;
  type: string;
  audience?: string;
  body?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_notifications")
    .insert([{ ...data, status: "scheduled" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create support ticket
 */
export async function createSupportTicket(data: {
  subject: string;
  requester: string;
  reseller_id?: string;
  priority?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_support_tickets")
    .insert([{ ...data, status: "open" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Create report
 */
export async function createReport(data: {
  name: string;
  cadence: string;
  format: string;
  recipient: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_reports")
    .insert([{ ...data, status: "active" }])
    .select()
    .single();

  if (error) throw error;
  return result;
}

/**
 * Log audit event
 */
export async function logAuditEvent(data: {
  actor: string;
  action: string;
  entity: string;
  target: string;
  severity?: string;
}): Promise<any> {
  const { data: result, error } = await supabase
    .from("reseller_audit_logs")
    .insert([data])
    .select()
    .single();

  if (error) throw error;
  return result;
}
