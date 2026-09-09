import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Server,
  AlertTriangle,
  Target,
  Download,
  Play,
  Pause,
} from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { aiControlsQuery, aiUsageQuery } from "@/lib/finance/queries";
import { useUpdateAiControl } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import type { AiApiUsage } from "@/lib/finance/types";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { formatCompact, formatCurrency, formatDate, formatNumber, downloadCsv } from "@/lib/finance/format";

const META: Record<string, { providerFilter?: "ai" | "api"; label: string; description: string }> = {
  ai_usage_cost: { providerFilter: "ai", label: "AI Usage Cost", description: "AI provider usage cost breakdown from finance_ai_api_usage" },
  api_usage_cost: { providerFilter: "api", label: "API Usage Cost", description: "Non-AI API provider usage cost breakdown" },
  ai_spike_alert: { label: "Cost Spike Alerts", description: "Alerts derived from day-over-day cost spikes in usage trends" },
  ai_stop_resume: { label: "Stop / Resume Controls", description: "Operator controls to pause or resume billing for a provider/service" },
  ai_budget_limit: { label: "Budget Limits", description: "Configured budget limits versus actual metered spend" },
};

const AI_PROVIDERS = new Set(["openai", "anthropic", "google", "azure-openai", "cohere", "mistral", "claude", "gpt", "gemini"]);

function isAiProvider(provider: string) {
  const p = provider.toLowerCase();
  return AI_PROVIDERS.has(p) || p.includes("gpt") || p.includes("claude") || p.includes("gemini") || p.includes("openai") || p.includes("anthropic");
}

function providerKey(row: AiApiUsage) {
  return `${row.provider}::${row.service}`;
}

export default function AiBillingSections({ view }: { view: FinanceView }) {
  const meta = META[view] ?? META["ai_usage_cost"]!;
  const allUsageState = useQuery(aiUsageQuery());
  const controlsState = useQuery(aiControlsQuery());
  const updateControl = useUpdateAiControl();
  const allRows = allUsageState.data ?? [];
  const controls = controlsState.data ?? [];

  const rows = useMemo(() => {
    if (view === "ai_usage_cost") return allRows.filter((r) => isAiProvider(r.provider));
    if (view === "api_usage_cost") return allRows.filter((r) => !isAiProvider(r.provider));
    return allRows;
  }, [allRows, view]);

  const [search, setSearch] = useState("");
  const [budgets, setBudgets] = useState<Record<string, string>>({});

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.provider.toLowerCase().includes(q) || r.service.toLowerCase().includes(q));
  }, [rows, search]);

  const stats = useMemo(() => {
    const totalCost = rows.reduce((sum, r) => sum + Number(r.cost), 0);
    const totalRequests = rows.reduce((sum, r) => sum + Number(r.requests), 0);
    const totalTokens = rows.reduce((sum, r) => sum + Number(r.tokens), 0);
    const providerCount = new Set(rows.map((r) => r.provider)).size;
    return { totalCost, totalRequests, totalTokens, providerCount };
  }, [rows]);

  const dailyTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const key = r.usage_date;
      map.set(key, (map.get(key) ?? 0) + Number(r.cost));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cost]) => ({ date, cost }));
  }, [rows]);

  const providerBreakdown = useMemo(() => {
    const map = new Map<string, { provider: string; total: number; requests: number; tokens: number; count: number }>();
    for (const r of rows) {
      const entry = map.get(r.provider) ?? { provider: r.provider, total: 0, requests: 0, tokens: 0, count: 0 };
      entry.total += Number(r.cost);
      entry.requests += Number(r.requests);
      entry.tokens += Number(r.tokens);
      entry.count += 1;
      map.set(r.provider, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  // Services list for stop/resume and budget views (per provider+service combo)
  const services = useMemo(() => {
    const map = new Map<string, { provider: string; service: string; total: number; requests: number; count: number; billedTo: Set<string> }>();
    for (const r of rows) {
      const key = providerKey(r);
      const entry = map.get(key) ?? { provider: r.provider, service: r.service, total: 0, requests: 0, count: 0, billedTo: new Set<string>() };
      entry.total += Number(r.cost);
      entry.requests += Number(r.requests);
      entry.count += 1;
      if (r.billed_to) entry.billedTo.add(r.billed_to);
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([key, v]) => ({ key, ...v })).sort((a, b) => b.total - a.total);
  }, [rows]);

  // Spike alerts derived from day-over-day change per provider
  const spikeAlerts = useMemo(() => {
    const byProvider = new Map<string, Map<string, number>>();
    for (const r of allRows) {
      const dayMap = byProvider.get(r.provider) ?? new Map<string, number>();
      dayMap.set(r.usage_date, (dayMap.get(r.usage_date) ?? 0) + Number(r.cost));
      byProvider.set(r.provider, dayMap);
    }
    const alerts: { provider: string; date: string; cost: number; prevCost: number; changePct: number }[] = [];
    for (const [provider, dayMap] of byProvider.entries()) {
      const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      for (let i = 1; i < sortedDays.length; i++) {
        const prevEntry = sortedDays[i - 1];
        const curEntry = sortedDays[i];
        if (!prevEntry || !curEntry) continue;
        const [prevDate, prevCost] = prevEntry;
        const [date, cost] = curEntry;
        if (prevCost <= 0) continue;
        const changePct = ((cost - prevCost) / prevCost) * 100;
        if (changePct >= 50 && cost - prevCost > 100) {
          alerts.push({ provider, date, cost, prevCost, changePct });
        }
      }
    }
    return alerts.sort((a, b) => b.changePct - a.changePct).slice(0, 20);
  }, [allRows]);

  const [ackedAlerts, setAckedAlerts] = useState<Set<string>>(new Set());

  const handleExport = () => {
    downloadCsv(`${view}.csv`, filteredRows.map((r) => ({
      provider: r.provider,
      service: r.service,
      usage_date: r.usage_date,
      requests: r.requests,
      tokens: r.tokens,
      cost: r.cost,
      billed_to: r.billed_to,
    })));
  };

  const controlFor = (provider: string, service: string) =>
    controls.find((control) => control.provider === provider && control.service === service);

  const toggleService = (provider: string, service: string) => {
    const current = controlFor(provider, service)?.status ?? "active";
    updateControl.mutate({
      provider,
      service,
      status: current === "active" ? "stopped" : "active",
      actor: "finance_manager",
    });
  };

  const handleSaveBudget = (key: string, provider: string, service: string) => {
    const value = budgets[key] ?? String(controlFor(provider, service)?.budget ?? "");
    if (!value || Number(value) <= 0) return;
    updateControl.mutate({ provider, service, budget: Number(value), actor: "finance_manager" });
  };

  const kpiIcon = view === "api_usage_cost" ? Server : Cpu;

  return (
    <SectionShell
      title={meta.label}
      description={meta.description}
      icon={kpiIcon}
      actions={
        <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="space-y-6">
        <StatGrid>
          <StatCard label="Total Cost" value={formatCompact(stats.totalCost)} hint={`${rows.length} usage records`} icon={kpiIcon} />
          <StatCard label="Total Requests" value={formatNumber(stats.totalRequests)} icon={Server} tone="info" />
          <StatCard label="Total Tokens" value={formatNumber(stats.totalTokens)} icon={Cpu} tone="info" />
          <StatCard label="Providers" value={String(stats.providerCount)} icon={Target} tone="default" />
        </StatGrid>

        {view === "ai_spike_alert" && (
          <PanelCard title="Active Spike Alerts">
            <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={spikeAlerts.length === 0} emptyLabel="No cost spikes detected">
              <div className="space-y-3">
                {spikeAlerts.map((a) => {
                  const alertKey = `${a.provider}-${a.date}`;
                  const acked = ackedAlerts.has(alertKey);
                  return (
                    <div key={alertKey} className={`flex items-center justify-between rounded-lg p-4 ${acked ? "bg-muted/50" : "bg-warning/10"}`}>
                      <div>
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          {a.provider}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(a.date)} · Prev {formatCurrency(a.prevCost)} → Now <span className="font-semibold text-destructive">{formatCurrency(a.cost)}</span> ({a.changePct.toFixed(0)}% spike)
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={acked ? "secondary" : "destructive"}>{acked ? "Acknowledged" : "Active"}</Badge>
                        {!acked && (
                          <Button variant="outline" size="sm" onClick={() => setAckedAlerts((prev) => new Set(prev).add(alertKey))}>
                            Acknowledge
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </QueryState>
          </PanelCard>
        )}

        {view === "ai_stop_resume" && (
          <PanelCard title="Service Controls">
            <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={services.length === 0}>
              <div className="space-y-3">
                {services.map((s) => {
                   const status = controlFor(s.provider, s.service)?.status ?? "active";
                  return (
                    <div key={s.key} className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-4">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${status === "active" ? "bg-success/15" : "bg-warning/15"}`}>
                          <Cpu className={`h-5 w-5 ${status === "active" ? "text-success" : "text-warning"}`} />
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{s.provider} · {s.service}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(s.requests)} requests · {s.count} entries</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="font-semibold text-foreground">{formatCompact(s.total)}</p>
                          <p className="text-xs text-muted-foreground">total spend</p>
                        </div>
                        <div className="flex items-center gap-3">
                           <Switch checked={status === "active"} disabled={updateControl.isPending} onCheckedChange={() => toggleService(s.provider, s.service)} />
                          <Button
                            variant={status === "active" ? "destructive" : "default"}
                            size="sm"
                             disabled={updateControl.isPending}
                             onClick={() => toggleService(s.provider, s.service)}
                          >
                            {status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </QueryState>
          </PanelCard>
        )}

        {view === "ai_budget_limit" && (
          <PanelCard title="Budget Limits vs Actual Spend">
            <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={services.length === 0}>
              <div className="space-y-4">
                {services.slice(0, 15).map((s) => {
                   const savedBudget = controlFor(s.provider, s.service)?.budget ?? 0;
                   const budgetValue = budgets[s.key] ?? String(savedBudget || "");
                  const budgetNum = Number(budgetValue) || 0;
                  const pct = budgetNum > 0 ? Math.min((s.total / budgetNum) * 100, 100) : 0;
                  return (
                    <div key={s.key} className="space-y-2 rounded-lg border border-border p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{s.provider} · {s.service}</span>
                        <span className="text-sm text-muted-foreground">Spent: <span className="font-semibold text-foreground">{formatCompact(s.total)}</span></span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          placeholder="Set budget (₹)"
                          type="number"
                          className="h-8 w-40 text-xs"
                          value={budgetValue}
                          onChange={(e) => setBudgets((prev) => ({ ...prev, [s.key]: e.target.value }))}
                        />
                        <Progress value={pct} className={`h-2 flex-1 ${pct > 80 ? "[&>div]:bg-warning" : ""}`} />
                        <span className="w-10 text-xs text-muted-foreground">{budgetNum > 0 ? `${pct.toFixed(0)}%` : "—"}</span>
                         <Button size="sm" variant="outline" disabled={updateControl.isPending || Number(budgetValue) <= 0} onClick={() => handleSaveBudget(s.key, s.provider, s.service)}>Save</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </QueryState>
          </PanelCard>
        )}

        <PanelCard title="Daily Cost Trend">
          <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={dailyTrend.length === 0} emptyLabel="No usage data yet">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => formatDate(v)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(v) => formatDate(String(v))} />
                  <Area type="monotone" dataKey="cost" stroke="var(--color-primary, #6366f1)" fill="var(--color-primary, #6366f1)" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard title="Provider Breakdown">
          <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={providerBreakdown.length === 0}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="provider" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="total" name="Cost" fill="var(--color-primary, #6366f1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </QueryState>
        </PanelCard>

        <PanelCard
          title="Usage Log"
          actions={
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search provider or service..."
              className="h-8 w-56 rounded-md border border-border bg-background px-2 text-xs"
            />
          }
        >
          <QueryState isLoading={allUsageState.isLoading} error={allUsageState.error} isEmpty={filteredRows.length === 0} emptyLabel="No usage records found">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Service</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Requests</th>
                    <th className="pb-2 font-medium">Tokens</th>
                    <th className="pb-2 font-medium">Cost</th>
                    <th className="pb-2 font-medium">Billed To</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.slice(0, 200).map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 font-medium text-foreground">{r.provider}</td>
                      <td className="py-2 text-muted-foreground">{r.service}</td>
                      <td className="py-2 text-muted-foreground">{formatDate(r.usage_date)}</td>
                      <td className="py-2 text-muted-foreground">{formatNumber(r.requests)}</td>
                      <td className="py-2 text-muted-foreground">{formatNumber(r.tokens)}</td>
                      <td className="py-2 font-semibold text-destructive">{formatCurrency(r.cost)}</td>
                      <td className="py-2">
                        {r.billed_to ? <StatusBadge status={r.billed_to} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
