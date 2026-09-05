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
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, display_name, email, code, country, status, health_score, risk_score, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AffiliateRecord | null;
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
