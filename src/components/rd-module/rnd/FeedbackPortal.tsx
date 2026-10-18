import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/rd-module/ui/button";
import { Input } from "@/components/rd-module/ui/input";
import { Textarea } from "@/components/rd-module/ui/textarea";
import { PMBadge, PMEmpty, PMPanel, formatDate } from "@/components/rd-module/pro-manager/pm-ui";
import { TEAM_AREAS, submitTeamFeedback } from "@/lib/rd-module/feedback-insights.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/rd-module/ui/tabs";
import {
  FeedbackAnalysis,
  feedbackKeys,
  useTeamFeedback,
  type FeedbackEntry,
} from "./FeedbackAnalysis";

export const FeedbackPortal = () => {
  const qc = useQueryClient();
  const submit = useServerFn(submitTeamFeedback);
  const { data: entries = [] } = useTeamFeedback();
  const [area, setArea] = useState<(typeof TEAM_AREAS)[number]>("general");

  const add = useMutation({
    mutationFn: (d: { member: string; area: (typeof TEAM_AREAS)[number]; content: string }) =>
      submit({ data: d }),
    onSuccess: () => {
      toast.success("Feedback added");
      qc.invalidateQueries({ queryKey: feedbackKeys.team });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    add.mutate(
      { member: String(fd.get("member") ?? ""), area, content: String(fd.get("content") ?? "") },
      { onSuccess: () => ((form.querySelector("textarea") as HTMLTextAreaElement).value = "") },
    );
  }

  const stats = useMemo(() => {
    const areas = new Set(entries.map((e) => e.area));
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = entries.filter((e) => new Date(e.created_at).getTime() > weekAgo).length;
    return { total: entries.length, areas: areas.size, recent };
  }, [entries]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-pink-400 bg-clip-text text-transparent">
            Team Feedback Portal
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Real entries from R&D team members, analysed by AI
          </p>
        </div>
      </div>

      {/* Summary stats from real entries */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total feedback", value: String(stats.total), icon: MessageSquare },
          { label: "Areas covered", value: String(stats.areas), icon: Users },
          { label: "Last 7 days", value: String(stats.recent), icon: Sparkles },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <stat.icon className="h-5 w-5 text-brand" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Feedback inbox</TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> AI analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <PMPanel
            title="Submit feedback"
            description="Only R&D team members can post here"
            icon={Users}
          >
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                name="member"
                aria-label="Your name or code"
                placeholder="Your name or code, e.g. vala(rnd)2341"
                required
                maxLength={80}
              />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Area">
                {TEAM_AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={area === a}
                    onClick={() => setArea(a)}
                    className={`min-h-8 rounded-full border px-3 text-xs capitalize ${area === a ? "border-brand bg-brand/20 text-foreground" : "border-border text-muted-foreground hover:bg-surface-2"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <Textarea
                name="content"
                aria-label="Feedback"
                placeholder="What is working, what is blocking you, what should change?"
                required
                minLength={5}
                maxLength={2000}
                rows={3}
              />
              <Button type="submit" disabled={add.isPending}>
                {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}Submit feedback
              </Button>
            </form>
          </PMPanel>

          <PMPanel
            title="Recent entries"
            description={`${stats.total} entries from R&D members`}
            icon={MessageSquare}
          >
            {entries.length === 0 ? (
              <PMEmpty message="No team feedback yet." />
            ) : (
              <ul className="scroll-slim max-h-[28rem] space-y-2 overflow-y-auto">
                {entries.map((e: FeedbackEntry) => (
                  <li key={e.id} className="rounded-xl border border-border p-3 text-sm">
                    <p className="text-foreground">{e.content}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <PMBadge>{e.member}</PMBadge>
                      <span className="capitalize">{e.area}</span> · {formatDate(e.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PMPanel>
        </TabsContent>

        <TabsContent value="analysis">
          <FeedbackAnalysis entries={entries} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
