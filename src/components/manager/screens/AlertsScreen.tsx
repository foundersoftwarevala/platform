import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Shield,
  ShieldAlert,
  TrendingDown,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ErrorMonitorPanel from "@/components/manager/screens/alerts/ErrorMonitorPanel";
import { useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
  day,
  downloadRows,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  usd,
  when,
} from "@/components/manager/primitives";

function n(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

const SUBSECTIONS = [
  "alert-low-wallet",
  "alert-overuse",
  "alert-cost-spike",
  "alert-abnormal",
  "alert-failure",
  "alert-security",
  "alert-runtime-errors",
];

export default function AlertsScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "alert-low-wallet";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "security_alerts", orderBy: "detected_at", ascending: false, limit: 300 },
    { table: "incidents", orderBy: "started_at", ascending: false, limit: 300 },
    { table: "wallets", orderBy: "created_at", ascending: false, limit: 100 },
    { table: "usage_daily", orderBy: "day", ascending: true, limit: 2000 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 1000 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 200 },
    { table: "safety_policies", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "automation_rules", orderBy: "created_at", ascending: false, limit: 200 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alert & Safety System" description="Monitor and manage all system alerts" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alert & Safety System" description="Monitor and manage all system alerts" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [alerts, incidents, wallets, usageDaily, usageEvents, services, policies, rules] = many.data ?? [
    [], [], [], [], [], [], [], [],
  ];

  return (
    <AlertsContent
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      alerts={alerts ?? []}
      incidents={incidents ?? []}
      wallets={wallets ?? []}
      usageDaily={usageDaily ?? []}
      usageEvents={usageEvents ?? []}
      services={services ?? []}
      policies={policies ?? []}
      rules={rules ?? []}
    />
  );
}

function AlertsContent({
  activeTab,
  setActiveTab,
  alerts,
  incidents,
  wallets,
  usageDaily,
  usageEvents,
  services,
  policies,
  rules,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  alerts: Row[];
  incidents: Row[];
  wallets: Row[];
  usageDaily: Row[];
  usageEvents: Row[];
  services: Row[];
  policies: Row[];
  rules: Row[];
}) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s["id"], s])), [services]);
  const updateAlert = useUpdateRecord("Alert updated");
  const updateIncident = useUpdateRecord("Incident updated");
  const updateRule = useUpdateRecord("Automation rule updated");
  const updateWallet = useUpdateRecord("Wallet threshold updated");

  const openAlerts = alerts.filter((a) => a["status"] !== "resolved");
  const criticalAlerts = alerts.filter((a) => a["severity"] === "critical" && a["status"] !== "resolved");
  const openIncidents = incidents.filter((i) => i["status"] !== "resolved");
  const lowWallets = wallets.filter((w) => n(w, "balance") < n(w, "low_balance_threshold"));

  const securityAlerts = useMemo(
    () => alerts.filter((a) => String(a["category"]).toLowerCase().includes("security") || String(a["category"]).toLowerCase().includes("breach")),
    [alerts],
  );

  const overuseServices = useMemo(() => {
    const map = new Map<string, { name: string; requests: number; errors: number }>();
    for (const u of usageDaily) {
      const svc = serviceById.get(u["service_id"]) as Row | undefined;
      const key = String(u["service_id"] ?? "unknown");
      const name = svc ? String(svc["name"]) : "Unknown Service";
      const existing = map.get(key) ?? { name, requests: 0, errors: 0 };
      existing.requests += n(u, "requests");
      existing.errors += n(u, "errors");
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.requests - a.requests).slice(0, 25);
  }, [usageDaily, serviceById]);

  const costSpike = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const u of usageDaily) {
      const key = String(u["day"]).slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + n(u, "cost_usd"));
    }
    const sorted = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const rows = sorted.map(([d, cost], i) => {
      const prev = i > 0 ? sorted[i - 1]![1] : cost;
      const change = prev > 0 ? ((cost - prev) / prev) * 100 : 0;
      return { date: day(d), cost, change: Math.round(change) };
    });
    return rows.slice(-30);
  }, [usageDaily]);

  const spikeDays = costSpike.filter((r) => r.change >= 50);

  const abnormalUsage = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const u of usageDaily) {
      const key = String(u["service_id"] ?? "unknown");
      const arr = map.get(key) ?? [];
      arr.push(n(u, "requests"));
      map.set(key, arr);
    }
    const rows: Array<{ name: string; avg: number; max: number; ratio: number }> = [];
    for (const [key, vals] of map.entries()) {
      const svc = serviceById.get(key) as Row | undefined;
      const name = svc ? String(svc["name"]) : "Unknown Service";
      const avg = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
      const max = Math.max(...vals, 0);
      const ratio = avg > 0 ? max / avg : 0;
      rows.push({ name, avg: Math.round(avg), max, ratio: Math.round(ratio * 10) / 10 });
    }
    return rows.filter((r) => r.ratio >= 2).sort((a, b) => b.ratio - a.ratio);
  }, [usageDaily, serviceById]);

  const failureEvents = useMemo(() => usageEvents.filter((e) => !e["success"]), [usageEvents]);
  const failureByService = useMemo(() => {
    const map = new Map<string, { name: string; failures: number; total: number }>();
    for (const e of usageEvents) {
      const svc = serviceById.get(e["service_id"]) as Row | undefined;
      const key = String(e["service_id"] ?? "unknown");
      const name = svc ? String(svc["name"]) : "Unknown Service";
      const existing = map.get(key) ?? { name, failures: 0, total: 0 };
      existing.total += 1;
      if (!e["success"]) existing.failures += 1;
      map.set(key, existing);
    }
    return [...map.values()]
      .map((r) => ({ ...r, rate: r.total > 0 ? Math.round((r.failures / r.total) * 1000) / 10 : 0 }))
      .filter((r) => r.failures > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [usageEvents, serviceById]);

  const acknowledgeAlert = (id: string) => updateAlert.mutate({ table: "security_alerts", id, values: { status: "investigating" } });
  const resolveAlert = (id: string) =>
    updateAlert.mutate({ table: "security_alerts", id, values: { status: "resolved", resolved_at: new Date().toISOString() } });
  const resolveIncident = (id: string) =>
    updateIncident.mutate({ table: "incidents", id, values: { status: "resolved", resolved_at: new Date().toISOString() } });
  const toggleRule = (rule: Row) => updateRule.mutate({ table: "automation_rules", id: String(rule["id"]), values: { enabled: !rule["enabled"] } });
  const setThreshold = (wallet: Row, value: number) =>
    updateWallet.mutate({ table: "wallets", id: String(wallet["id"]), values: { low_balance_threshold: value } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alert & Safety System"
        description="Monitor and manage all system alerts"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "alerts.csv",
                alerts.map((a) => ({ title: a["title"], category: a["category"], severity: a["severity"], status: a["status"], detected_at: a["detected_at"] })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open Alerts" value={openAlerts.length} icon={<Bell className="h-4 w-4" />} tone="amber" />
        <StatCard label="Critical Alerts" value={criticalAlerts.length} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Open Incidents" value={openIncidents.length} icon={<AlertCircle className="h-4 w-4" />} tone="violet" />
        <StatCard label="Low-Balance Wallets" value={lowWallets.length} icon={<Wallet className="h-4 w-4" />} tone="cyan" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="alert-low-wallet">Low Wallet</TabsTrigger>
          <TabsTrigger value="alert-overuse">API Overuse</TabsTrigger>
          <TabsTrigger value="alert-cost-spike">Cost Spike</TabsTrigger>
          <TabsTrigger value="alert-abnormal">Abnormal Usage</TabsTrigger>
          <TabsTrigger value="alert-failure">API Failure</TabsTrigger>
          <TabsTrigger value="alert-security">Security Breach</TabsTrigger>
          <TabsTrigger value="alert-runtime-errors">Runtime Errors</TabsTrigger>
        </TabsList>

        <TabsContent value="alert-low-wallet">
          <GlassCard title="Low Wallet Balance Alert" icon={<Wallet className="h-4 w-4 text-primary" />}>
            {wallets.length === 0 ? (
              <EmptyState message="No wallets configured yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Wallet</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Adjust Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallets.map((w) => {
                    const low = n(w, "balance") < n(w, "low_balance_threshold");
                    return (
                      <TableRow key={String(w["id"])}>
                        <TableCell className="font-medium text-foreground">{String(w["name"])}</TableCell>
                        <TableCell>{usd(n(w, "balance"))}</TableCell>
                        <TableCell>{usd(n(w, "low_balance_threshold"))}</TableCell>
                        <TableCell>
                          {low ? <StatusBadge value="critical" /> : <StatusBadge value="active" />}
                        </TableCell>
                        <TableCell>
                          <ThresholdEditor wallet={w} onSave={(val) => setThreshold(w, val)} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-overuse">
          <GlassCard title="API Overuse Alert" icon={<AlertCircle className="h-4 w-4 text-primary" />}>
            {overuseServices.length === 0 ? (
              <EmptyState message="No usage data yet" />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={overuseServices}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="requests" name="Requests" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="errors" name="Errors" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-cost-spike">
          <GlassCard title="Cost Spike Alert" icon={<TrendingDown className="h-4 w-4 text-primary" />}>
            {costSpike.length === 0 ? (
              <EmptyState message="No daily cost data yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={costSpike}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => usd(v)} />
                    <Line type="monotone" dataKey="cost" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-foreground">Days with ≥50% cost increase</p>
                  {spikeDays.length === 0 ? (
                    <EmptyState message="No cost spikes detected" />
                  ) : (
                    <div className="space-y-2">
                      {spikeDays.map((r) => (
                        <div key={r.date} className="flex items-center justify-between rounded-lg border border-status-error/30 bg-status-error/10 p-3">
                          <span className="text-sm text-foreground">{r.date}</span>
                          <span className="text-sm font-medium text-status-error">+{r.change}% ({usd(r.cost)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-abnormal">
          <GlassCard title="Abnormal Usage Alert" icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
            {abnormalUsage.length === 0 ? (
              <EmptyState message="No abnormal usage patterns detected" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Avg Requests/Day</TableHead>
                    <TableHead>Peak Requests</TableHead>
                    <TableHead>Peak / Avg Ratio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abnormalUsage.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell>{r.avg.toLocaleString("en-US")}</TableCell>
                      <TableCell>{r.max.toLocaleString("en-US")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-status-warning/40 text-status-warning">{r.ratio}x normal</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-failure" className="space-y-6">
          <GlassCard title="API Failure Alert — By Service" icon={<AlertCircle className="h-4 w-4 text-primary" />}>
            {failureByService.length === 0 ? (
              <EmptyState message="No failures recorded" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Failures</TableHead>
                    <TableHead>Total Requests</TableHead>
                    <TableHead>Failure Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failureByService.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell>{r.failures}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell>
                        <StatusBadge value={r.rate > 5 ? "critical" : r.rate > 1 ? "warning" : "active"} />
                        <span className="ml-2 text-xs text-muted-foreground">{r.rate}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>

          <GlassCard title="Open Incidents" icon={<Clock className="h-4 w-4 text-primary" />}>
            {openIncidents.length === 0 ? (
              <EmptyState message="No open incidents" />
            ) : (
              <div className="space-y-3">
                {openIncidents.map((i) => (
                  <div key={String(i["id"])} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{String(i["title"])}</p>
                        <StatusBadge value={String(i["severity"])} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{when(String(i["started_at"]))}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => resolveIncident(String(i["id"]))}>
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard title="Failed Events (recent)" icon={<XCircle className="h-4 w-4 text-primary" />}>
            {failureEvents.length === 0 ? (
              <EmptyState message="No failed events" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Status Code</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Occurred</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failureEvents.slice(0, 50).map((e) => {
                    const svc = serviceById.get(e["service_id"]) as Row | undefined;
                    return (
                      <TableRow key={String(e["id"])}>
                        <TableCell>{svc ? String(svc["name"]) : "Unknown"}</TableCell>
                        <TableCell><Badge variant="outline" className="border-status-error/40 text-status-error">{String(e["status_code"])}</Badge></TableCell>
                        <TableCell>{String(e["product"])}</TableCell>
                        <TableCell>{when(String(e["occurred_at"]))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-security" className="space-y-6">
          <GlassCard title="Security Breach Alert" icon={<Shield className="h-4 w-4 text-primary" />}>
            {securityAlerts.length === 0 ? (
              <EmptyState message="No security alerts" />
            ) : (
              <div className="space-y-3">
                {securityAlerts.map((a) => (
                  <div
                    key={String(a["id"])}
                    className={
                      a["status"] === "resolved"
                        ? "flex items-center justify-between rounded-lg border border-border/50 bg-secondary/10 p-4 opacity-60"
                        : "flex items-center justify-between rounded-lg border border-status-error/30 bg-status-error/10 p-4"
                    }
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{String(a["title"])}</p>
                        <StatusBadge value={String(a["severity"])} />
                        <StatusBadge value={String(a["status"])} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{String(a["description"] ?? "")}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{String(a["source"])} · {when(String(a["detected_at"]))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {a["status"] !== "resolved" && a["status"] !== "investigating" ? (
                        <Button size="sm" variant="ghost" onClick={() => acknowledgeAlert(String(a["id"]))}>
                          <Eye className="mr-1 h-4 w-4" />
                          Acknowledge
                        </Button>
                      ) : null}
                      {a["status"] !== "resolved" ? (
                        <Button size="sm" variant="outline" onClick={() => resolveAlert(String(a["id"]))}>
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Resolve
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard title="Safety Policies" icon={<ShieldAlert className="h-4 w-4 text-primary" />}>
            {policies.length === 0 ? (
              <EmptyState message="No safety policies configured" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Violations (30d)</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((p) => (
                    <TableRow key={String(p["id"])}>
                      <TableCell className="font-medium text-foreground">{String(p["name"])}</TableCell>
                      <TableCell>{String(p["category"])}</TableCell>
                      <TableCell><Badge variant="outline">{String(p["action"])}</Badge></TableCell>
                      <TableCell>{n(p, "violations_30d")}</TableCell>
                      <TableCell><Switch checked={Boolean(p["enabled"])} disabled /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </GlassCard>

          <GlassCard title="Automation Rules" icon={<Zap className="h-4 w-4 text-primary" />}>
            {rules.length === 0 ? (
              <EmptyState message="No automation rules configured" />
            ) : (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div key={String(r["id"])} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{String(r["name"])}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(r["trigger_type"])} → {String(r["action_type"])} · {n(r, "run_count")} runs
                      </p>
                    </div>
                    <Switch checked={Boolean(r["enabled"])} onCheckedChange={() => toggleRule(r)} />
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="alert-runtime-errors">
          <ErrorMonitorPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThresholdEditor({ wallet, onSave }: { wallet: Row; onSave: (v: number) => void }) {
  const [value, setValue] = useState(String(n(wallet, "low_balance_threshold")));
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-28"
      />
      <Button size="sm" variant="outline" onClick={() => onSave(Number(value) || 0)}>
        Save
      </Button>
    </div>
  );
}
