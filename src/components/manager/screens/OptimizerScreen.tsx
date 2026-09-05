import { useMemo, useState } from "react";
import {
  Check,
  Cpu,
  DollarSign,
  Download,
  Gauge,
  Lightbulb,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
  downloadRows,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  usd,
} from "@/components/manager/primitives";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function n(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

const SUBSECTIONS = ["opt-high-cost", "opt-cheaper", "opt-token", "opt-downgrade", "opt-recommendations"];

export default function OptimizerScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "opt-high-cost";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "usage_daily", orderBy: "day", ascending: true, limit: 2000 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 1000 },
    { table: "ai_models", orderBy: "name", ascending: true, limit: 200 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 200 },
    { table: "cost_recommendations", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "billing_plans", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "ai_providers", orderBy: "name", ascending: true, limit: 200 },
    { table: "ai_agents", orderBy: "created_at", ascending: false, limit: 200 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Cost Optimizer" description="Detect high costs and optimize API spending" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI Cost Optimizer" description="Detect high costs and optimize API spending" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [usageDaily, usageEvents, models, services, recommendations, plans, providers, agents] = many.data ?? [
    [], [], [], [], [], [], [], [],
  ];

  return (
    <OptimizerContent
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      usageDaily={usageDaily ?? []}
      usageEvents={usageEvents ?? []}
      models={models ?? []}
      services={services ?? []}
      recommendations={recommendations ?? []}
      plans={plans ?? []}
      providers={providers ?? []}
      agents={agents ?? []}
    />
  );
}

function OptimizerContent({
  activeTab,
  setActiveTab,
  usageDaily,
  usageEvents,
  models,
  services,
  recommendations,
  plans,
  providers,
  agents,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  usageDaily: Row[];
  usageEvents: Row[];
  models: Row[];
  services: Row[];
  recommendations: Row[];
  plans: Row[];
  providers: Row[];
  agents: Row[];
}) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s["id"], s])), [services]);
  const modelById = useMemo(() => new Map(models.map((m) => [m["id"], m])), [models]);
  const providerById = useMemo(() => new Map(providers.map((p) => [p["id"], p])), [providers]);

  const updateRecommendation = useUpdateRecord("Recommendation updated");
  const updateModel = useUpdateRecord("Model default updated");
  const updateAgent = useUpdateRecord("Agent token limit updated");

  const highCostServices = useMemo(() => {
    const map = new Map<string, { name: string; cost: number; requests: number }>();
    for (const u of usageDaily) {
      const svc = serviceById.get(u["service_id"]) as Row | undefined;
      const key = String(u["service_id"] ?? "unknown");
      const name = svc ? String(svc["name"]) : "Unknown Service";
      const existing = map.get(key) ?? { name, cost: 0, requests: 0 };
      existing.cost += n(u, "cost_usd");
      existing.requests += n(u, "requests");
      map.set(key, existing);
    }
    return [...map.values()]
      .map((r) => ({ ...r, avgCost: r.requests > 0 ? r.cost / r.requests : 0 }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 15);
  }, [usageDaily, serviceById]);

  const totalMonthlyCost = highCostServices.reduce((s, r) => s + r.cost, 0);

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, { name: string; models: Row[] }>();
    for (const m of models) {
      const provider = providerById.get(m["provider_id"]) as Row | undefined;
      const key = provider ? String(provider["id"]) : "unknown";
      const name = provider ? String(provider["name"]) : "Unknown Provider";
      const existing = map.get(key) ?? { name, models: [] };
      existing.models.push(m);
      map.set(key, existing);
    }
    return [...map.values()];
  }, [models, providerById]);

  const cheaperAlternatives = useMemo(() => {
    return models
      .map((m) => {
        const same = models.filter(
          (other) => other["modality"] === m["modality"] && other["id"] !== m["id"] && n(other, "input_cost_per_1k") < n(m, "input_cost_per_1k"),
        );
        const cheapest = same.sort((a, b) => n(a, "input_cost_per_1k") - n(b, "input_cost_per_1k"))[0];
        return cheapest ? { model: m, alternative: cheapest } : null;
      })
      .filter((r): r is { model: Row; alternative: Row } => r !== null)
      .sort((a, b) => n(b.model, "input_cost_per_1k") - n(a.model, "input_cost_per_1k"));
  }, [models]);

  const tokenHeavyAgents = useMemo(
    () => agents.filter((a) => n(a, "max_tokens") > 0).sort((a, b) => n(b, "max_tokens") - n(a, "max_tokens")),
    [agents],
  );

  const latencyServices = useMemo(
    () => services.filter((s) => n(s, "avg_latency_ms") > 0).sort((a, b) => n(b, "avg_latency_ms") - n(a, "avg_latency_ms")).slice(0, 15),
    [services],
  );

  const activeRecs = recommendations.filter((r) => r["status"] === "suggested");
  const appliedRecs = recommendations.filter((r) => r["status"] === "applied");
  const potentialSavings = activeRecs.reduce((s, r) => s + n(r, "estimated_monthly_saving"), 0);
  const appliedSavings = appliedRecs.reduce((s, r) => s + n(r, "estimated_monthly_saving"), 0);

  const pieData = highCostServices.slice(0, 6).map((r) => ({ name: r.name, value: r.cost }));

  const applyRecommendation = (id: string) => updateRecommendation.mutate({ table: "cost_recommendations", id, values: { status: "applied" } });
  const dismissRecommendation = (id: string) => updateRecommendation.mutate({ table: "cost_recommendations", id, values: { status: "dismissed" } });
  const setDefaultModel = (model: Row) => {
    const peers = models.filter((m) => m["provider_id"] === model["provider_id"] && m["id"] !== model["id"] && m["is_default"]);
    for (const peer of peers) {
      updateModel.mutate({ table: "ai_models", id: String(peer["id"]), values: { is_default: false } });
    }
    updateModel.mutate({ table: "ai_models", id: String(model["id"]), values: { is_default: true } });
  };
  const reduceTokens = (agent: Row, newMax: number) => updateAgent.mutate({ table: "ai_agents", id: String(agent["id"]), values: { max_tokens: newMax } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Cost Optimizer"
        description="Detect high costs and optimize API spending"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "cost-recommendations.csv",
                recommendations.map((r) => ({
                  title: r["title"],
                  category: r["category"],
                  status: r["status"],
                  estimated_monthly_saving: n(r, "estimated_monthly_saving").toFixed(2),
                })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Monthly Savings Applied" value={usd(appliedSavings)} icon={<DollarSign className="h-4 w-4" />} tone="green" />
        <StatCard label="Potential Additional Savings" value={usd(potentialSavings)} icon={<TrendingDown className="h-4 w-4" />} tone="violet" />
        <StatCard label="Active Recommendations" value={activeRecs.length} icon={<Lightbulb className="h-4 w-4" />} tone="cyan" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="opt-high-cost">High-Cost APIs</TabsTrigger>
          <TabsTrigger value="opt-cheaper">Cheaper Alternatives</TabsTrigger>
          <TabsTrigger value="opt-token">Reduce Token Usage</TabsTrigger>
          <TabsTrigger value="opt-downgrade">Downgrade Speed Mode</TabsTrigger>
          <TabsTrigger value="opt-recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="opt-high-cost" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <GlassCard title="High-Cost APIs Detected" icon={<DollarSign className="h-4 w-4 text-primary" />}>
              {highCostServices.length === 0 ? (
                <EmptyState message="No usage data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={highCostServices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => usd(v)} />
                    <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
            <GlassCard title="Cost Share (Top 6)" icon={<DollarSign className="h-4 w-4 text-primary" />}>
              {pieData.length === 0 ? (
                <EmptyState message="No usage data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label={(e) => e.name}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => usd(v)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>

          <GlassCard title="High-Cost Service Details" icon={<DollarSign className="h-4 w-4 text-primary" />}>
            {highCostServices.length === 0 ? (
              <EmptyState message="No usage data yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Monthly Cost</TableHead>
                    <TableHead>Requests</TableHead>
                    <TableHead>Avg Cost / Request</TableHead>
                    <TableHead>Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highCostServices.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell className="text-status-error">{usd(r.cost)}</TableCell>
                      <TableCell>{r.requests.toLocaleString("en-US")}</TableCell>
                      <TableCell>{usd(r.avgCost)}</TableCell>
                      <TableCell>{totalMonthlyCost > 0 ? Math.round((r.cost / totalMonthlyCost) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="opt-cheaper">
          <GlassCard title="Suggest Cheaper Alternative" icon={<TrendingDown className="h-4 w-4 text-primary" />}>
            {cheaperAlternatives.length === 0 ? (
              <EmptyState message="No cheaper alternatives found for current models" />
            ) : (
              <div className="space-y-3">
                {cheaperAlternatives.map(({ model, alternative }) => {
                  const saving = n(model, "input_cost_per_1k") - n(alternative, "input_cost_per_1k");
                  return (
                    <div key={String(model["id"])} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <span>{String(model["name"])}</span>
                            {Boolean(model["is_default"]) ? <Badge variant="outline">default</Badge> : null}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            ${n(model, "input_cost_per_1k").toFixed(4)}/1k tokens · quality {n(model, "quality_score")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-status-success">Alt: {String(alternative["name"])}</p>
                          <p className="text-xs text-muted-foreground">${n(alternative, "input_cost_per_1k").toFixed(4)}/1k · save ${saving.toFixed(4)}/1k</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setDefaultModel(alternative)}>
                          Switch Default
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="opt-token">
          <GlassCard title="Auto Reduce Token Usage" icon={<Cpu className="h-4 w-4 text-primary" />}>
            {tokenHeavyAgents.length === 0 ? (
              <EmptyState message="No agents configured yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Max Tokens</TableHead>
                    <TableHead>Runs (30d)</TableHead>
                    <TableHead>Reduce Tokens</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenHeavyAgents.map((a) => (
                    <TokenRow key={String(a["id"])} agent={a} onSave={(v) => reduceTokens(a, v)} />
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="opt-downgrade">
          <GlassCard title="Auto Downgrade Speed Mode" icon={<Gauge className="h-4 w-4 text-primary" />}>
            {latencyServices.length === 0 ? (
              <EmptyState message="No latency data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={latencyServices.map((s) => ({ name: String(s["name"]), latency: n(s, "avg_latency_ms") }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-30} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="latency" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="mt-3 text-xs text-muted-foreground">
                  Services with high average latency are candidates for downgrading to a faster/cheaper speed mode
                  or swapping their default model via the Cheaper Alternatives tab.
                </p>
              </>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="opt-recommendations" className="space-y-6">
          <GlassCard title="Cost Saving Recommendations" icon={<Sparkles className="h-4 w-4 text-primary" />}>
            {recommendations.length === 0 ? (
              <EmptyState message="No cost recommendations yet" />
            ) : (
              <div className="space-y-3">
                {recommendations.map((r) => {
                  const svc = serviceById.get(r["service_id"]) as Row | undefined;
                  return (
                    <div
                      key={String(r["id"])}
                      className={
                        r["status"] === "applied"
                          ? "rounded-lg border border-status-success/30 bg-status-success/10 p-4"
                          : r["status"] === "dismissed"
                            ? "rounded-lg border border-border/50 bg-secondary/10 p-4 opacity-60"
                            : "rounded-lg border border-border/50 bg-secondary/20 p-4"
                      }
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground">{String(r["title"])}</p>
                            <StatusBadge value={String(r["status"])} />
                            <Badge variant="outline">{String(r["category"])}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{String(r["detail"])}</p>
                          <div className="mt-2 flex items-center gap-4 text-xs">
                            <span className="text-status-success">Saves {usd(n(r, "estimated_monthly_saving"))}/month</span>
                            <span className="text-muted-foreground">Effort: {String(r["effort"])}</span>
                            {svc ? <span className="text-muted-foreground">Service: {String(svc["name"])}</span> : null}
                          </div>
                        </div>
                        {r["status"] === "suggested" ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => applyRecommendation(String(r["id"]))}>
                              <Check className="mr-1 h-4 w-4" />
                              Apply
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => dismissRecommendation(String(r["id"]))}>
                              <X className="mr-1 h-4 w-4" />
                              Dismiss
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          <GlassCard title="Billing Plans (context)" icon={<DollarSign className="h-4 w-4 text-primary" />}>
            {plans.length === 0 ? (
              <EmptyState message="No billing plans configured" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Monthly Fee</TableHead>
                    <TableHead>Included Requests</TableHead>
                    <TableHead>Overage /1k</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((p) => (
                    <TableRow key={String(p["id"])}>
                      <TableCell className="font-medium text-foreground">{String(p["name"])}</TableCell>
                      <TableCell>{usd(n(p, "monthly_fee"))}</TableCell>
                      <TableCell>{n(p, "included_requests").toLocaleString("en-US")}</TableCell>
                      <TableCell>{usd(n(p, "overage_per_1k"))}</TableCell>
                      <TableCell><StatusBadge value={String(p["status"])} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TokenRow({ agent, onSave }: { agent: Row; onSave: (v: number) => void }) {
  const [value, setValue] = useState(String(n(agent, "max_tokens")));
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{String(agent["name"])}</TableCell>
      <TableCell>{String(agent["purpose"])}</TableCell>
      <TableCell>{n(agent, "max_tokens").toLocaleString("en-US")}</TableCell>
      <TableCell>{n(agent, "runs_30d").toLocaleString("en-US")}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="h-8 w-28" />
          <Button size="sm" variant="outline" onClick={() => onSave(Number(value) || 0)}>
            Save
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
