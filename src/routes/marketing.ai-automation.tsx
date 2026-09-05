import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, Brain, Check, Sparkles, X, Zap } from "lucide-react";

import { DataScreen } from "@/components/marketing/data-screen";
import {
  ProgressBar,
  QueryState,
  ScreenHeader,
  SectionCard,
  StatCard,
  StatusBadge,
} from "@/components/marketing/kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { recordAudit, tableQuery, useUpdateRow } from "@/lib/marketing/api";
import { dateTime, num, titleCase } from "@/lib/marketing/format";

export const Route = createFileRoute("/marketing/ai-automation")({
  head: () => ({
    meta: [
      { title: "AI Automation — Software Vala Marketing Manager" },
      {
        name: "description",
        content:
          "Review AI budget and creative recommendations and manage always-on marketing automations and journeys.",
      },
      { property: "og:title", content: "AI Automation — Software Vala" },
      {
        property: "og:description",
        content: "AI recommendations plus live marketing automations and journey performance.",
      },
    ],
  }),
  component: AiAutomationScreen,
});

const TRIGGERS = ["form_submit", "page_visit", "cart_abandon", "inactivity", "date_based", "score_change"] as const;
const CHANNELS = ["Email", "WhatsApp", "SMS", "Push", "In-app"] as const;
const AUTOMATION_STATUS = ["draft", "active", "paused", "archived"] as const;

function Recommendations() {
  const recs = useQuery(tableQuery("marketing_ai_recommendations", { column: "confidence" }));
  const update = useUpdateRow("marketing_ai_recommendations");

  const decide = (row: { id: string; title: string }, status: "accepted" | "dismissed") =>
    update.mutate(
      { id: row.id, values: { status } },
      {
        onSuccess: () => {
          toast.success(`Recommendation ${status}.`);
          void recordAudit({
            actor: "Marketing Manager",
            action: status,
            entity_type: "AI recommendation",
            entity_id: row.id,
            entity_name: row.title,
            module: "AI Automation",
          });
        },
        onError: (e) => toast.error(e.message),
      },
    );

  const list = recs.data ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recommendations" value={num(list.length)} icon={Brain} tone="violet" index={0} />
        <StatCard
          label="Open"
          value={num(list.filter((r) => r.status === "new" || r.status === "pending").length)}
          icon={Sparkles}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Accepted"
          value={num(list.filter((r) => r.status === "accepted").length)}
          icon={Check}
          tone="green"
          index={2}
        />
        <StatCard
          label="Avg confidence"
          value={
            list.length
              ? `${Math.round(list.reduce((s, r) => s + Number(r.confidence ?? 0), 0) / list.length)}%`
              : "0%"
          }
          icon={Zap}
          tone="blue"
          index={3}
        />
      </div>

      <SectionCard title="AI recommendations" description="Model-generated actions awaiting your decision">
        <QueryState
          isLoading={recs.isLoading}
          error={recs.error}
          data={list}
          emptyMessage="No recommendations right now."
        >
          {(rows) => (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {r.title}
                        <StatusBadge value={r.category} />
                        <StatusBadge value={r.status} />
                      </div>

                      <p className="mt-1 text-sm text-muted-foreground">{r.recommendation}</p>
                      {r.impact_estimate ? (
                        <p className="mt-1 text-xs text-aurora-teal">Impact: {r.impact_estimate}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => decide(r, "accepted")} disabled={update.isPending}>
                        <Check className="mr-1 h-4 w-4" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => decide(r, "dismissed")}
                        disabled={update.isPending}
                      >
                        <X className="mr-1 h-4 w-4" /> Dismiss
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Confidence {num(r.confidence)}%</span>
                    <div className="w-40">
                      <ProgressBar value={Number(r.confidence ?? 0)} max={100} tone="violet" />
                    </div>
                    <span className="text-xs text-muted-foreground">{dateTime(r.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </QueryState>
      </SectionCard>
    </div>
  );
}

function AiAutomationScreen() {
  return (
    <div className="space-y-6">
      <ScreenHeader
        title="AI Automation"
        description="Model recommendations and always-on automations, connected to live marketing data."
      />
      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations">
          <Recommendations />
        </TabsContent>

        <TabsContent value="automations">
          <DataScreen
            headless
            table="marketing_automations"
            title="Automations"
            description="Always-on journeys"
            module="AI Automation"
            entityLabel="Automation"
            order={{ column: "runs" }}
            searchKeys={["name", "channel", "trigger_type"]}
            filterKey="status"
            filterOptions={AUTOMATION_STATUS}
            minWidth={1080}
            stats={[
              { label: "Automations", icon: Bot, tone: "violet", value: (r) => num(r.length) },
              {
                label: "Active",
                icon: Zap,
                tone: "green",
                value: (r) => num(r.filter((x) => x.status === "active").length),
              },
              {
                label: "Total runs",
                icon: Sparkles,
                tone: "blue",
                value: (r) => num(r.reduce((s, x) => s + Number(x.runs ?? 0), 0)),
              },
              {
                label: "Conversions",
                icon: Check,
                tone: "gold",
                value: (r) => num(r.reduce((s, x) => s + Number(x.conversions ?? 0), 0)),
              },
            ]}
            columns={[
              { key: "name", header: "Automation", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "trigger_type", header: "Trigger", render: (r) => titleCase(r.trigger_type) },
              { key: "channel", header: "Channel", render: (r) => r.channel },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
              { key: "audience_size", header: "Audience", align: "right", render: (r) => num(r.audience_size) },
              { key: "runs", header: "Runs", align: "right", render: (r) => num(r.runs) },
              { key: "conversions", header: "Conversions", align: "right", render: (r) => num(r.conversions) },
              { key: "last_run_at", header: "Last run", render: (r) => dateTime(r.last_run_at) },
            ]}
            fields={[
              { key: "name", label: "Automation name", kind: "text", required: true, full: true },
              { key: "trigger_type", label: "Trigger", kind: "select", options: TRIGGERS },
              { key: "channel", label: "Channel", kind: "select", options: CHANNELS },
              { key: "status", label: "Status", kind: "select", options: AUTOMATION_STATUS },
              { key: "audience_size", label: "Audience size", kind: "number" },
              { key: "runs", label: "Runs", kind: "number" },
              { key: "conversions", label: "Conversions", kind: "number" },
              { key: "last_run_at", label: "Last run at", kind: "datetime" },
              { key: "description", label: "Description", kind: "textarea", full: true },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
