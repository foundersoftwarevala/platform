import { useState } from "react";
import { Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/rd-module/ui/button";
import { usePMCompliance } from "@/hooks/rd-module/useProManagerData";
import { useProManagerAI } from "@/hooks/rd-module/useProManagerAI";
import { AIOutput, PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, PMStat } from "../pm-ui";

export const PROCompliancePolicy = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMCompliance();
  const { complianceReview, isLoading: aiBusy } = useProManagerAI();
  const [reviews, setReviews] = useState<Record<string, string>>({});

  const term = search.trim().toLowerCase();
  const rows = (data ?? []).filter((row) =>
    term ? row.user_code.toLowerCase().includes(term) : true,
  );
  const flagged = rows.filter((r) => r.legal_flag).length;
  const violations = rows.reduce((s, r) => s + r.violations, 0);

  return (
    <PMSection
      title="Compliance & policy"
      description="Agreement acceptance, policy violations and legal flags across premium accounts."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <PMStat label="Accounts reviewed" value={rows.length} icon={Shield} />
        <PMStat label="Total violations" value={violations} icon={Shield} tone="warning" />
        <PMStat label="Legal flags" value={flagged} icon={Shield} tone="danger" />
      </div>

      <PMPanel title="User compliance status">
        {isLoading ? (
          <PMLoading rows={4} />
        ) : rows.length === 0 ? (
          <PMEmpty message="No compliance records match this search." />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{row.user_code}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PMBadge tone={row.agreement_accepted ? "success" : "danger"}>
                      {row.agreement_accepted ? "agreement accepted" : "agreement pending"}
                    </PMBadge>
                    <PMBadge tone={row.violations === 0 ? "success" : "warning"}>
                      {row.violations} violations
                    </PMBadge>
                    {row.legal_flag && <PMBadge tone="danger">legal flag</PMBadge>}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={aiBusy}
                      onClick={async () => {
                        const result = await complianceReview(
                          row.user_code,
                          row.agreement_accepted,
                          row.violations,
                          row.legal_flag,
                        );
                        if (result) setReviews((prev) => ({ ...prev, [row.id]: result }));
                      }}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" /> AI review
                    </Button>
                  </div>
                </div>
                {reviews[row.id] && <AIOutput text={reviews[row.id]!} />}
              </li>
            ))}
          </ul>
        )}
      </PMPanel>
    </PMSection>
  );
};
