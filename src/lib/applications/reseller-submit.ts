import { supabase } from "@/integrations/supabase/client";

export interface ResellerApplicationInput {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  business_type: string;
  sales_experience: string;
  target_market: string;
  expected_monthly_sales: string;
  customer_base: string;
  marketing_channels: string;
  website: string;
  social_media: string;
  all_values: Record<string, string>;
  agreement_accepted: boolean;
}

/**
 * Submit a real Reseller Application to Supabase.
 * This creates a record in reseller_applications table that admin can review and approve.
 * Reseller applications are persisted in Supabase and never in local state.
 */
export async function submitResellerApplication(input: ResellerApplicationInput) {
  if (!input.agreement_accepted) {
    throw new Error("Agreement acceptance is required to submit an application");
  }

  // Applications always use real Supabase persistence.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authentication required to submit application");
  }

  const { data: duplicate } = await supabase
    .from("reseller_applications")
    .select("application_number")
    .eq("requester_email", input.email)
    .in("status", ["pending", "under_review"])
    .maybeSingle();
  if (duplicate) throw new Error(`An application is already pending (${duplicate.application_number}).`);

  // Create application record with status 'pending'
  const { data, error } = await supabase.from("reseller_applications").insert([
    {
      applicant_user_id: user.id,
      requester_email: input.email,
      requester_name: input.full_name,
      company_name: input.company_name,
      region: input.target_market,
      motivation: input.marketing_channels,
      status: "pending",
      application_type: "new",
      submitted_data: input.all_values,
      agreement_accepted: input.agreement_accepted,
      agreement_accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Store additional data as JSON if schema supports, or leave for now
    },
  ]).select("id, application_number, status, created_at").single();

  if (error) {
    console.error("Reseller application submission error:", error);
    throw new Error(`Failed to submit application: ${error.message}`);
  }

  return data;
}
