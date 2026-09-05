import { useMemo } from "react";
import { Brain, Copy, Lightbulb, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAgents, useLeads, useScores } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import type { Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, ScoreBar, StatCard, inr, num, relTime } from "../shared";
import { useAction } from "./common";

export function QualificationScreen({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (lead: Lead) => void;
}) {
  const { data: leads = [], isLoading } = useLeads();
  const { data: agents = [] } = useAgents();
  const { data: scores = [] } = useScores();
  const run = useAction();

  const highBudget = leads.filter((l) => (l.deal_value ?? 0) >= 500000);
  const highIntent = leads.filter((l) => l.intent_score >= 75);
  const flagged = leads.filter((l) => l.priority === "critical" || l.priority === "high");
  const duplicates = leads.filter((l) => l.is_duplicate);

  const rows = useMemo(() => {
    switch (section) {
      case "budget_detection":
        return [...highBudget].sort((a, b) => (b.deal_value ?? 0) - (a.deal_value ?? 0));
      case "intent_detection":
        return [...highIntent].sort((a, b) => b.intent_score - a.intent_score);
      case "priority_flag":
        return flagged;
      case "duplicate_detection":
        return duplicates;
      default:
        return [...leads].sort((a, b) => b.ai_score - a.ai_score);
    }
  }, [section, leads, highBudget, highIntent, flagged, duplicates]);

  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="AI scored leads" value={num(leads.length)} icon={Brain} hint={`Avg ${avg(leads.map((l) => l.ai_score))}`} />
        <StatCard label="High budget detected" value={num(highBudget.length)} icon={Target} tone="success" />
        <StatCard label="High intent" value={num(highIntent.length)} icon={Lightbulb} tone="warning" />
        <StatCard label="Priority flagged" value={num(flagged.length)} tone="destructive" />
        <StatCard label="Duplicates found" value={num(duplicates.length)} icon={Copy} tone="info" />
      </div>

      {section === "duplicate_detection" ? (
        <Panel title="Duplicate resolution" description="Confirmed duplicates are moved to spam; dismissing clears the flag.">
          <div className="space-y-2">
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No duplicates currently flagged.</p>
            ) : (
              duplicates.map((l) => (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-2 p-3">
                  <button className="text-left" onClick={() => onSelect(l)}>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.email} • {l.phone} • match {l.duplicate_score}%
                    </p>
                  </button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => run(() => leadApi.resolveDuplicate(l.id, true), "Duplicate flag cleared")}>
                      Not a duplicate
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => run(() => leadApi.resolveDuplicate(l.id, false), "Duplicate merged out")}>
                      Confirm duplicate
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Scoring model output" description="Latest AI scoring runs with the factors that drove each score.">
          <div className="space-y-2">
            {scores.slice(0, 8).map((s) => {
              const f = (s.factors ?? {}) as Record<string, number>;
              return (
                <div key={s.id} className="rounded-md border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>{leads.find((l) => l.id === s.lead_id)?.name ?? "Lead"}</span>
                    <Badge variant="outline">
                      {s.score_type.replace(/_/g, " ")} • {s.score}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Object.entries(f)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(" • ") || "No factor breakdown"}{" "}
                    • confidence {s.confidence}% • {s.model_version} • {relTime(s.created_at)}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Budget bands" description="Detected budget ranges across the open pipeline.">
          <div className="space-y-2">
            {Object.entries(
              leads.reduce<Record<string, { count: number; value: number }>>((acc, l) => {
                const key = l.budget_range ?? "Not disclosed";
                acc[key] = { count: (acc[key]?.count ?? 0) + 1, value: (acc[key]?.value ?? 0) + (l.deal_value ?? 0) };
                return acc;
              }, {}),
            )
              .sort((a, b) => b[1].count - a[1].count)
              .map(([band, e]) => (
                <div key={band} className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
                  <span>{band}</span>
                  <span className="text-xs text-muted-foreground">
                    {e.count} leads • {inr(e.value)}
                  </span>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      <Panel
        title={`Qualification queue — ${rows.length} leads`}
        description="Re-score any lead to recompute AI score, intent weighting and conversion probability from live data."
        actions={
          <Button
            size="sm"
            variant="secondary"
            disabled={rows.length === 0}
            onClick={() =>
              run(async () => {
                for (const l of rows.slice(0, 15)) await leadApi.rescoreLead(l.id);
              }, "Top leads re-scored")
            }
          >
            Re-score top 15
          </Button>
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="stat-tile p-3">
            <ScoreBar score={avg(leads.map((l) => l.ai_score))} label="Avg AI score" />
          </div>
          <div className="stat-tile p-3">
            <ScoreBar score={avg(leads.map((l) => l.intent_score))} label="Avg intent" />
          </div>
          <div className="stat-tile p-3">
            <ScoreBar score={avg(leads.map((l) => Number(l.conversion_probability)))} label="Avg conv. prob." />
          </div>
        </div>
        <LeadTable
          leads={rows}
          agents={agents}
          isLoading={isLoading}
          onSelect={onSelect}
          columns={["source", "status", "priority", "score", "intent", "value", "created"]}
        />
      </Panel>
    </div>
  );
}
