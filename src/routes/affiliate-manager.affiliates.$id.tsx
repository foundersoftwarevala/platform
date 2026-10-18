import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WallShell } from "@/components/affiliate/WallShell";
import { EmptyState } from "@/components/affiliate/EmptyState";
import {
  AffiliateIdentity, AffiliateProfileBody, type AffiliateRecord,
} from "@/components/affiliate/AffiliateProfile";
import { supabase } from "@/integrations/supabase/client";

// The partner tables are not in the generated database types.
const untyped = (table: string) => (supabase as any).from(table);

export const Route = createFileRoute("/affiliate-manager/affiliates/$id")({
  head: () => ({
    meta: [
      { title: "Affiliate Profile — Software Vala Affiliate Manager" },
      { name: "description", content: "Full affiliate profile: identity, performance scorecards, earnings and audit-backed activity." },
      { property: "og:title", content: "Affiliate Profile — Software Vala Affiliate Manager" },
      { property: "og:description", content: "Full affiliate profile with performance, risk and activity history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AffiliateDetailPage,
});

function AffiliateDetailPage() {
  const { id } = Route.useParams();

  const affiliate = useQuery({
    queryKey: ["affiliate", "detail", id],
    queryFn: async () => {
      // The affiliate is a marketplace_affiliate_partners row. Its email lives on
      // the partner's profile and its code in marketplace_referral_codes; the
      // partner record holds no country, health or risk score, so those stay empty.
      const { data, error } = await untyped("marketplace_affiliate_partners")
        .select("id, user_id, display_name, status, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [profile, code] = await Promise.all([
        data.user_id
          ? supabase.from("profiles").select("email").eq("id", data.user_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        untyped("marketplace_referral_codes")
          .select("code")
          .eq("affiliate_partner_id", data.id)
          .eq("active", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      if (code.error) throw code.error;
      return {
        id: data.id,
        display_name: data.display_name ?? "",
        email: (profile.data as { email: string | null } | null)?.email ?? null,
        code: code.data?.code ?? null,
        country: null,
        status: data.status,
        health_score: null,
        risk_score: null,
        created_at: data.created_at,
      } satisfies AffiliateRecord;
    },
  });

  return (
    <WallShell>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2">
          <Link to="/affiliate-manager/affiliates">
            <ArrowLeft className="size-3.5" /> Affiliate Directory
          </Link>
        </Button>
      </div>

      {affiliate.isLoading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-56 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : affiliate.isError ? (
        <div className="rounded-lg border border-destructive/30 bg-surface p-6 text-sm text-destructive">
          Failed to load this affiliate.
        </div>
      ) : !affiliate.data ? (
        <EmptyState
          icon={Users}
          title="Affiliate not found"
          description="This affiliate may have been removed or you may not have access to it."
        />
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-5">
            <AffiliateIdentity affiliate={affiliate.data} />
          </div>
          <AffiliateProfileBody affiliate={affiliate.data} />
        </>
      )}
    </WallShell>
  );
}
