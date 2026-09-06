import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { emptyDashboardAnalytics, type DashboardAnalytics, type MetricKey } from "@/lib/creator/types";

const metric = (key: MetricKey, value: number) => ({
  ...emptyDashboardAnalytics("7d").metrics[key],
  key,
  value,
  previousValue: 0,
  deltaPct: null,
});

export const influencerDashboardQueryOptions = () => queryOptions({
  queryKey: ["influencer-dashboard", "workflow-tables"],
  staleTime: 30_000,
  queryFn: async (): Promise<DashboardAnalytics> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return emptyDashboardAnalytics("7d");

    const { data: profileData, error: profileError } = await supabase
      .from("influencer_profiles")
      .select("id, user_id, status, full_name, email, country, region, niche")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    if (!profileData) return emptyDashboardAnalytics("7d");

    const profileId = profileData.id;

    const [profiles, applications, assignments, payouts, earnings, socials] = await Promise.all([
      supabase.from("influencer_profiles").select("id, status, full_name, email, country, region, niche").eq("id", profileId).limit(2000),
      supabase.from("influencer_applications").select("id, status, applicant_user_id").eq("applicant_user_id", auth.user.id).limit(2000),
      supabase.from("influencer_campaign_assignments").select("id, status, profile_id, campaign_id").eq("profile_id", profileId).limit(2000),
      supabase.from("influencer_payouts").select("amount, status, profile_id").eq("profile_id", profileId).limit(2000),
      supabase.from("influencer_earnings").select("gross_amount, net_amount, status, profile_id").eq("profile_id", profileId).limit(2000),
      // Real follower counts, from the influencer's own connected accounts.
      supabase.from("influencer_social_accounts").select("followers, engagement_rate, verification_status, profile_id").eq("profile_id", profileId).limit(2000),
    ]);

    const campaignIds = (assignments.data ?? []).map((row) => row.campaign_id).filter((id): id is string => Boolean(id));
    const assignmentIds = (assignments.data ?? []).map((row) => row.id).filter((id): id is string => Boolean(id));
    const activity = assignmentIds.length
      ? await supabase.from("influencer_activity").select("id, metric, quantity, verification_status, assignment_id").in("assignment_id", assignmentIds).limit(2000)
      : { data: [], error: null };
    const campaigns = campaignIds.length
      ? await supabase.from("marketing_campaigns").select("id, status, revenue").in("id", campaignIds)
      : { data: [], error: null };

    const firstError = profiles.error ?? applications.error ?? assignments.error ?? activity.error ?? payouts.error ?? earnings.error ?? campaigns.error ?? socials.error;
    if (firstError) throw new Error(firstError.message);

    const profileRows = profiles.data ?? [];
    const applicationRows = applications.data ?? [];
    const assignmentRows = assignments.data ?? [];
    const activityRows = activity.data ?? [];
    const payoutRows = payouts.data ?? [];
    const earningRows = earnings.data ?? [];
    const campaignRows = campaigns.data ?? [];
    const socialRows = socials.data ?? [];

    const activeProfiles = profileRows.filter((row) => row.status === "active").length;
    const pendingApplications = applicationRows.filter((row) => row.status === "pending" || row.status === "in_review").length;
    const verifiedActivity = activityRows.filter((row) => row.verification_status === "verified").length;
    const totalNet = earningRows.reduce((sum, row) => sum + Number(row.net_amount ?? 0), 0);
    const totalPayouts = payoutRows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
    // Sum the accounts the influencer has actually connected. No connected
    // account means zero followers — which is the truth, and is what the
    // dashboard should say.
    const totalFollowers = socialRows.reduce((sum, row) => sum + Number(row.followers ?? 0), 0);
    const verifiedFollowers = socialRows
      .filter((row) => row.verification_status === "verified")
      .reduce((sum, row) => sum + Number(row.followers ?? 0), 0);
    const verifiedActivityQuantity = activityRows
      .filter((row) => row.verification_status === "verified")
      .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

    void activeProfiles;
    void verifiedActivity;
    const base = emptyDashboardAnalytics("7d");
    const metrics = { ...base.metrics };
    metrics.influencers = metric("influencers", profileRows.length);
    metrics.followers = metric("followers", totalFollowers);
    // Reach is only claimable for accounts whose ownership has been verified.
    metrics.reach = metric("reach", verifiedFollowers);
    metrics.campaigns = metric("campaigns", campaignRows.length);
    metrics.applications = metric("applications", pendingApplications);
    // Attributed sales require the referral chain (marketplace_order_attributions),
    // which nothing writes to yet — so this is genuinely zero rather than a
    // borrowed count of click-activity rows.
    metrics.sales = metric("sales", 0);
    // Likewise leads: the leads table carries no influencer or campaign column,
    // so no lead can be attributed to this influencer yet.
    metrics.leads = metric("leads", 0);
    // The verified clicks the influencer really has produced — the metric the
    // compensation rules are actually priced on, and what the old "sales"
    // number was counting rows of.
    metrics.clicks = metric("clicks", verifiedActivityQuantity);
    metrics.revenue = metric("revenue", campaignRows.reduce((sum, row) => sum + Number(row.revenue ?? 0), 0));
    metrics.commissions = metric("commissions", totalNet);
    metrics.payouts = metric("payouts", totalPayouts);

    return {
      ...base,
      connected: true,
      source: "supabase:influencer-workflow",
      generatedAt: new Date().toISOString(),
      metrics,
    };
  },
});