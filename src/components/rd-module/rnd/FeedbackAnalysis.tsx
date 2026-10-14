import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/rd-module/supabase/client";
import { Button } from "@/components/rd-module/ui/button";
import { PMBadge, PMEmpty, PMPanel, formatDate } from "@/components/rd-module/pro-manager/pm-ui";
import { runFeedbackInsights } from "@/lib/rd-module/feedback-insights.functions";
import type { InsightImprovement, InsightTheme } from "@/lib/rd-module/feedback-insights.server";

export interface FeedbackEntry {
  id: string;
  member: string;
  area: string;
  content: string;
  created_at: string;
}

export const feedbackKeys = {
  team: ["rnd", "team-feedback"] as const,
  insights: ["rnd", "feedback-insights"] as const,
};

export function useTeamFeedback() {
  return useQuery({
    queryKey: feedbackKeys.team,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rnd_team_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []) as FeedbackEntry[];
    },
  });
}

function useInsights() {
  return useQuery({
    queryKey: feedbackKeys.insights,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rnd_feedback_insights")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

type InsightRow = {
  id: string;
  created_at: string;
  summary: string;
  themes: unknown;
  improvements: unknown;
  feedback_count: number;
};

const tone = (v: string) =>
  v === "high" || v === "negative"
    ? "danger"
    : v === "medium" || v === "neutral"
      ? "warning"
      : "success";

export function FeedbackAnalysis({ entries }: { entries: FeedbackEntry[] }) {
  const qc = useQueryClient();
  const analyse = useServerFn(runFeedbackInsights);
  const { data: insights = [] } = useInsights();
  const [selected, setSelected] = useState(0);
  const autoRan = useRef(false);

  const run = useMutation({
    mutationFn: () => analyse(),
    onSuccess: () => {
      toast.success("New insights ready");
      setSelected(0);
      qc.invalidateQueries({ queryKey: feedbackKeys.insights });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      qc.invalidateQueries({ queryKey: feedbackKeys.insights });
    },
  });

  // Auto-run once when real entries are newer than the last saved analysis.
  useEffect(() => {
    if (autoRan.current || run.isPending) return;
    const latest = insights[0] as InsightRow | undefined;
    const stale = entries.length >= 2 && (!latest || (latest.feedback_count ?? 0) < entries.length);
    if (stale) {
      autoRan.current = true;
      run.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, insights, run.isPending]);

  const areas = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.area, (counts.get(e.area) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [entries]);
  const maxCount = areas[0]?.[1] ?? 1;

  const current = insights[selected] as InsightRow | undefined;
  const themes = (current?.themes ?? []) as unknown as InsightTheme[];
  const improvements = (current?.improvements ?? []) as unknown as InsightImprovement[];
  const newSinceRun = current
    ? Math.max(0, entries.length - (current.feedback_count ?? 0))
    : entries.length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <PMPanel title="Top areas" description="Where the feedback is coming from" icon={Sparkles}>
        {areas.length === 0 ? (
          <PMEmpty message="No feedback yet." />
        ) : (
          <ul className="space-y-3">
            {areas.map(([name, count]) => (
              <li key={name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium capitalize text-foreground">{name}</span>
                  <PMBadge tone={count === maxCount ? "success" : "muted"}>{count} entries</PMBadge>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </PMPanel>

      <PMPanel
        title="AI analysis"
        description="Themes & improvements, generated from real entries"
        icon={Sparkles}
        actions={
          <Button onClick={() => run.mutate()} disabled={run.isPending || entries.length < 2}>
            {run.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {run.isPending ? "Analysing…" : "Run analysis"}
          </Button>
        }
      >
        {insights.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(insights as InsightRow[]).map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={selected === i}
                className={`rounded-full border px-3 py-1 text-xs ${selected === i ? "border-brand bg-brand/20 text-foreground" : "border-border text-muted-foreground"}`}
              >
                {formatDate(r.created_at)}
              </button>
            ))}
          </div>
        )}
        {run.isPending && (
          <p className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Analysing {entries.length} entries…
          </p>
        )}
        {!run.isPending && newSinceRun > 0 && (
          <p className="mb-3 flex items-center gap-2 text-sm text-warning">
            {newSinceRun} new {newSinceRun === 1 ? "entry" : "entries"} since the last analysis —
            run it again to include them.
          </p>
        )}
        {!current ? (
          <PMEmpty
            message={
              entries.length < 2
                ? "Add at least 2 feedback entries, then the analysis runs automatically."
                : "No analysis yet."
            }
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-foreground">{current.summary}</p>
            <p className="text-xs text-muted-foreground">
              Based on {current.feedback_count} entries · {formatDate(current.created_at)}
            </p>
            <div>
              <h4 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Common themes
              </h4>
              <ul className="grid gap-2 sm:grid-cols-2">
                {themes.map((t) => (
                  <li key={t.title} className="rounded-xl border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{t.title}</span>
                      <PMBadge tone={tone(t.sentiment)}>{t.mentions}×</PMBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Actionable improvements
              </h4>
              <ol className="space-y-2">
                {improvements.map((imp, i) => (
                  <li key={imp.title} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {i + 1}. {imp.title}
                      </span>
                      <span className="flex gap-1">
                        <PMBadge tone={tone(imp.impact) === "danger" ? "success" : "muted"}>
                          impact {imp.impact}
                        </PMBadge>
                        <PMBadge>effort {imp.effort}</PMBadge>
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{imp.action}</p>
                    {imp.related_theme && (
                      <p className="mt-1 text-xs text-brand">{imp.related_theme}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </PMPanel>
    </div>
  );
}
