import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeCheck, Banknote, Bell, Megaphone, Receipt, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/lib/language-catalog";

async function loadInfluencerPortal() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Authentication required");

  const { data: profile, error: profileError } = await supabase
    .from("influencer_profiles")
    .select("id, full_name, email, country, region, niche, status")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("Approved influencer profile not found");

  const [socials, assignments, earnings, agreements, invoices, payouts, notifications] = await Promise.all([
    supabase.from("influencer_social_accounts").select("id, platform, handle, profile_url, followers, engagement_rate, verification_status").eq("profile_id", profile.id),
    supabase.from("influencer_campaign_assignments").select("id, campaign_id, status, assigned_at").eq("profile_id", profile.id),
    supabase.from("influencer_earnings").select("id, campaign_id, gross_amount, net_amount, currency, status, created_at").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("influencer_agreements").select("id, campaign_id, version, status, accepted_at, created_at").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("influencer_invoices").select("id, invoice_number, amount, currency, status, issued_at, due_at").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("influencer_payouts").select("id, amount, currency, status, provider_reference, created_at").eq("profile_id", profile.id).order("created_at", { ascending: false }),
    supabase.from("influencer_notifications").select("id, kind, title, body, read_at, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const firstError = socials.error ?? assignments.error ?? earnings.error ?? agreements.error ?? invoices.error ?? payouts.error ?? notifications.error;
  if (firstError) throw new Error(firstError.message);

  const campaignIds = (assignments.data ?? []).map((assignment) => assignment.campaign_id).filter(Boolean);
  const campaigns = campaignIds.length
    ? await supabase.from("marketing_campaigns").select("id, name, status, objective, start_date, end_date, budget").in("id", campaignIds)
    : { data: [], error: null };
  if (campaigns.error) throw new Error(campaigns.error.message);

  const assignmentIds = (assignments.data ?? []).map((assignment) => assignment.id).filter(Boolean);
  const activities = assignmentIds.length
    ? await supabase.from("influencer_activity").select("id, assignment_id, metric, quantity, verification_status, occurred_at").in("assignment_id", assignmentIds).order("occurred_at", { ascending: false })
    : { data: [], error: null };
  if (activities.error) throw new Error(activities.error.message);

  return {
    profile,
    socials: socials.data ?? [],
    assignments: assignments.data ?? [],
    campaigns: campaigns.data ?? [],
    activities: activities.data ?? [],
    earnings: earnings.data ?? [],
    agreements: agreements.data ?? [],
    invoices: invoices.data ?? [],
    payouts: payouts.data ?? [],
    notifications: notifications.data ?? [],
  };
}

const statusClass = (status: string) =>
  status === "paid" || status === "accepted" || status === "verified" || status === "active"
    ? "text-emerald-600"
    : status === "pending" || status === "assigned"
      ? "text-amber-600"
      : "text-muted-foreground";

export function InfluencerPortalDashboard() {
  const { translate: t } = useLanguage();
  const query = useQuery({ queryKey: ["influencer-portal", "own-scope"], queryFn: loadInfluencerPortal, staleTime: 30_000 });

  if (query.isPending) return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">{t("Loading your influencer workspace...")}</div>;
  if (query.isError) return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{query.error.message}</div>;

  const data = query.data;
  const payable = data.earnings.filter((earning) => earning.status === "payable").reduce((total, earning) => total + Number(earning.net_amount ?? 0), 0);
  const verifiedActivities = data.activities.filter((activity) => activity.verification_status === "verified").length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-linear-to-br from-slate-950 via-cyan-950 to-emerald-900 p-6 text-white md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{t("Influencer Dashboard")}</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-3xl font-bold">{data.profile.full_name}</h1><p className="mt-1 text-sm text-white/70">{data.profile.niche} · {data.profile.country ?? t("Profile country pending")}</p></div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-semibold text-emerald-100"><BadgeCheck className="size-4" /> {t("Approved profile")}</span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [Users, t("Social accounts"), data.socials.length],
          [Megaphone, t("Assigned campaigns"), data.assignments.length],
          [Activity, t("Verified activities"), verifiedActivities],
          [Banknote, t("Payable earnings"), payable.toLocaleString()],
        ].map(([Icon, label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><Icon className="size-4 text-primary" /><p className="mt-3 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Megaphone className="size-4" /> {t("Campaigns")}</h2><div className="mt-4 space-y-3">{data.campaigns.length ? data.campaigns.map((campaign) => <div key={campaign.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0"><div><p className="font-medium">{campaign.name}</p><p className="text-xs text-muted-foreground">{campaign.objective ?? t("Campaign brief")}</p></div><span className={`text-xs font-semibold uppercase ${statusClass(data.assignments.find((assignment) => assignment.campaign_id === campaign.id)?.status ?? campaign.status)}`}>{data.assignments.find((assignment) => assignment.campaign_id === campaign.id)?.status ?? campaign.status}</span></div>) : <p className="text-sm text-muted-foreground">{t("No campaigns assigned yet.")}</p>}</div></div>
        <div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Activity className="size-4" /> {t("Activity")}</h2><div className="mt-4 space-y-3">{data.activities.length ? data.activities.slice(0, 8).map((activity) => <div key={activity.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0"><div><p className="font-medium">{activity.metric} · {activity.quantity}</p><p className="text-xs text-muted-foreground">{new Date(activity.occurred_at).toLocaleString()}</p></div><span className={`text-xs font-semibold uppercase ${statusClass(activity.verification_status)}`}>{activity.verification_status}</span></div>) : <p className="text-sm text-muted-foreground">{t("No activity recorded yet.")}</p>}</div></div>
        <div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Banknote className="size-4" /> {t("Earnings")}</h2><div className="mt-4 space-y-3">{data.earnings.length ? data.earnings.map((earning) => <div key={earning.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0"><span>{earning.currency} {Number(earning.net_amount).toLocaleString()}</span><span className={`text-xs font-semibold uppercase ${statusClass(earning.status)}`}>{earning.status}</span></div>) : <p className="text-sm text-muted-foreground">{t("No earnings yet.")}</p>}</div></div>
        <div className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Receipt className="size-4" /> {t("Invoices & payouts")}</h2><div className="mt-4 space-y-3">{[...data.invoices.map((invoice) => ({ key: invoice.id, label: invoice.invoice_number, amount: `${invoice.currency} ${Number(invoice.amount).toLocaleString()}`, status: invoice.status })), ...data.payouts.map((payout) => ({ key: payout.id, label: t("Payout"), amount: `${payout.currency} ${Number(payout.amount).toLocaleString()}`, status: payout.status }))].map((item) => <div key={item.key} className="flex items-center justify-between border-b border-border pb-3 last:border-0"><span>{item.label} · {item.amount}</span><span className={`text-xs font-semibold uppercase ${statusClass(item.status)}`}>{item.status}</span></div>)}{!data.invoices.length && !data.payouts.length && <p className="text-sm text-muted-foreground">{t("No invoices or payouts yet.")}</p>}</div></div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="size-4" /> {t("Notifications")}</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{data.notifications.length ? data.notifications.map((notification) => <div key={notification.id} className="rounded-lg bg-muted/40 p-3"><p className="font-medium">{notification.title}</p><p className="mt-1 text-sm text-muted-foreground">{notification.body}</p></div>) : <p className="text-sm text-muted-foreground">{t("No notifications yet.")}</p>}</div></section>
    </div>
  );
}
