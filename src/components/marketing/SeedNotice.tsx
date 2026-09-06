import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

type SeedSummary = {
  seed_campaigns: number;
  real_campaigns: number;
  seed_revenue: number;
  real_revenue: number;
  seed_spend: number;
  seed_leads: number;
  lead_records: number;
  any_seed_present: boolean;
};

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
    .format(Number(n) || 0);

/**
 * Says out loud when the numbers on screen are demonstration data.
 *
 * Every marketing table arrived pre-populated from the source repository, and
 * between them those rows assert roughly 2.62 crore of revenue and 12,451 leads
 * against ten actual lead records. Nothing was deleted - but a board showing
 * that much invented money with nothing distinguishing it from the real thing
 * is how a figure ends up in a report.
 *
 * The banner disappears on its own: it is driven by the is_seed flag, so once
 * real campaigns exist it reports the split, and once the demonstration rows
 * are gone it renders nothing at all.
 */
export function SeedDataNotice() {
  const { data } = useQuery({
    queryKey: ["marketing", "seed-summary"],
    queryFn: async (): Promise<SeedSummary | null> => {
      const { data, error } = await supabase.rpc("marketing_seed_summary");
      if (error) return null;
      return data as unknown as SeedSummary;
    },
    staleTime: 60_000,
  });

  if (!data?.any_seed_present) return null;

  const hasReal = Number(data.real_campaigns) > 0;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">
          These figures include demonstration data
        </p>
        <p className="mt-1 text-muted-foreground">
          {data.seed_campaigns} seeded campaign{data.seed_campaigns === 1 ? "" : "s"} account for{" "}
          {inr(data.seed_spend)} of spend and {inr(data.seed_revenue)} of revenue, against{" "}
          {data.lead_records} actual lead record{data.lead_records === 1 ? "" : "s"}. They came with
          the module and are kept for reference.{" "}
          {hasReal
            ? `Real campaigns contribute ${inr(data.real_revenue)}.`
            : "No real campaign has been created yet, so every number below is illustrative."}
        </p>
      </div>
    </div>
  );
}
