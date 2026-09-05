import { supabase } from "@/integrations/supabase/client";

/* RPC boundaries keep application review and onboarding atomic in Postgres. */
export async function submitInfluencerApplication(input: {
  fullName: string;
  email: string;
  phone?: string;
  country?: string;
  region?: string;
  socialProfiles: Record<string, string>;
  followers: number;
  niche: string;
  contentTypes: string[];
  engagementRate: number;
  paymentDetails: Record<string, string>;
  taxDetails: Record<string, string>;
}) {
  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) (
    "submit_influencer_application",
    {
      p_full_name: input.fullName,
      p_email: input.email,
      p_phone: input.phone ?? null,
      p_country: input.country ?? null,
      p_region: input.region ?? null,
      p_social_profiles: input.socialProfiles,
      p_followers: input.followers,
      p_niche: input.niche,
      p_content_types: input.contentTypes,
      p_engagement_rate: input.engagementRate,
      p_payment_details: input.paymentDetails,
      p_tax_details: input.taxDetails,
      p_agreement_accepted: true,
      p_consent_accepted: true,
      p_terms_accepted: true,
    },
  );
  if (error) throw new Error(error.message);
  return data as { id: string; application_number: string; status: string; created_at: string };
}

export async function reviewInfluencerApplication(id: string, status: "in_review" | "approved" | "rejected", rejectionReason?: string) {
  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>) (
    "review_influencer_application",
    { p_application_id: id, p_status: status, p_rejection_reason: rejectionReason ?? null },
  );
  if (error) throw new Error(error.message);
  return data;
}
