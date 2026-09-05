import { useEffect, useMemo, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  DollarSign,
  Plug,
  Power,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useManyRecords, type Row } from "@/lib/manager-queries";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  day,
  num,
  usd,
  when,
} from "@/components/manager/primitives";

const CHILD_IDS = [
  "dashboard-total",
  "dashboard-active",
  "dashboard-inactive",
  "dashboard-ai-vs-non",
  "dashboard-today",
  "dashboard-monthly",
  "dashboard-wallet",
  "dashboard-risk",
] as const;

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function useScrollIntoFocus(view: string | undefined) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!view) return;
    const el = refs.current[view];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/60");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [view]);
  return refs;
}

export default function DashboardScreen({ view }: { view?: string | undefined }) {
  const refs = useScrollIntoFocus(view);

  const many = useManyRecords([
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "ai_models", limit: 500 },
    { table: "ai_providers", limit: 500 },
    { table: "usage_daily", orderBy: "day", ascending: true, limit: 2000 },
    { table: "wallets", limit: 200 },
    { table: "security_alerts", orderBy: "detected_at", ascending: false, limit: 25 },
    { table: "incidents", orderBy: "started_at", ascending: false, limit: 25 },
  ]);

  const raw = many.data;
  const services = raw?.[0] ?? [];
  const models = raw?.[1] ?? [];
  const providers = raw?.[2] ?? [];
  const usageDaily = raw?.[3] ?? [];
  const wallets = raw?.[4] ?? [];
  const alerts = raw?.[5] ?? [];
  const incidents = raw?.[6] ?? [];

  const isLoading = many.isLoading;
  const error = many.error;

  const totalServices = services.length;
  const activeServices = services.filter((s) => (s["status"] as string)?.toLowerCase() === "active").length;
  const inactiveServices = totalServices - activeServices;

  const aiServices = services.filter((s) => {
    const t = String(s["type"] ?? s["category"] ?? "").toLowerCase();
    return t.includes("ai");
  }).length;
  const nonAiServices = totalServices - aiServices;

  const last30 = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return usageDaily.filter((r) => {
      const d = r["day"] as string | undefined;
      return d ? new Date(d).getTime() >= cutoff : false;
    });
  }, [usageDaily]);

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; requests: number; cost: number }>();
    for (const r of last30) {
      const d = String(r["day"] ?? "");
      const entry = map.get(d) ?? { day: d, requests: 0, cost: 0 };
      entry.requests += Number(r["requests"] ?? 0);
      entry.cost += Number(r["cost_usd"] ?? 0);
      map.set(d, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [last30]);

  const todayUsage = useMemo(() => {
    if (usageDaily.length === 0) return 0;
    const latestDay = usageDaily.reduce((max, r) => {
      const d = String(r["day"] ?? "");
      return d > max ? d : max;
    }, "");
    return usageDaily
      .filter((r) => String(r["day"] ?? "") === latestDay)
      .reduce((sum, r) => sum + Number(r["requests"] ?? 0), 0);
  }, [usageDaily]);

  const monthlyCost = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return usageDaily
      .filter((r) => {
        const d = r["day"] as string | undefined;
        return d ? new Date(d).getTime() >= cutoff : false;
      })
      .reduce((sum, r) => sum + Number(r["cost_usd"] ?? 0), 0);
  }, [usageDaily]);

  const walletBalance = wallets.reduce((sum, w) => sum + Number(w["balance"] ?? 0), 0);

  const openAlerts = alerts.filter((a) => (a["status"] as string)?.toLowerCase() !== "resolved");
  const openIncidents = incidents.filter((i) => (i["status"] as string)?.toLowerCase() !== "resolved");
  const riskCount = openAlerts.length + openIncidents.length;

  const aiVsNonData = [
    { name: "AI APIs", value: aiServices },
    { name: "Non-AI APIs", value: nonAiServices },
  ];

  const topApis = useMemo(() => {
    const byService = new Map<
      string,
      { service_id: string; requests: number; errors: number; cost: number; latencySum: number; latencyCount: number }
    >();
    for (const r of usageDaily) {
      const sid = String(r["service_id"] ?? "");
      if (!sid) continue;
      const entry =
        byService.get(sid) ?? { service_id: sid, requests: 0, errors: 0, cost: 0, latencySum: 0, latencyCount: 0 };
      entry.requests += Number(r["requests"] ?? 0);
      entry.errors += Number(r["errors"] ?? 0);
      entry.cost += Number(r["cost_usd"] ?? 0);
      entry.latencySum += Number(r["avg_latency_ms"] ?? 0);
      entry.latencyCount += 1;
      byService.set(sid, entry);
    }
    const serviceById = new Map(services.map((s) => [String(s["id"]), s]));
    return Array.from(byService.values())
      .map((e) => {
        const svc = serviceById.get(e.service_id);
        return {
          ...e,
          name: svc ? String(svc["name"]) : e.service_id,
          status: svc ? String(svc["status"]) : "unknown",
          avgLatency: e.latencyCount ? Math.round(e.latencySum / e.latencyCount) : 0,
        };
      })
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }, [usageDaily, services]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="API & AI Dashboard" description="Complete API & AI management overview" />
        <LoadingBlock rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="API & AI Dashboard" description="Complete API & AI management overview" />
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="API & AI Dashboard" description="Complete API & AI management overview across services, usage, cost and risk" />

      <div
        ref={(el) => {
          refs.current["dashboard-total"] = el;
          refs.current["dashboard-active"] = el;
          refs.current["dashboard-inactive"] = el;
          refs.current["dashboard-ai-vs-non"] = el;
          refs.current["dashboard-today"] = el;
          refs.current["dashboard-monthly"] = el;
          refs.current["dashboard-wallet"] = el;
          refs.current["dashboard-risk"] = el;
        }}
        className="grid grid-cols-1 gap-4 rounded-xl transition-all md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard label="Total APIs Connected" value={num(totalServices)} icon={<Plug className="h-5 w-5" />} tone="cyan" />
        <StatCard label="Active APIs" value={num(activeServices)} icon={<Power className="h-5 w-5" />} tone="green" />
        <StatCard label="Inactive APIs" value={num(inactiveServices)} icon={<Power className="h-5 w-5" />} tone="slate" />
        <StatCard label="AI vs Non-AI APIs" value={`${num(aiServices)} / ${num(nonAiServices)}`} icon={<Bot className="h-5 w-5" />} tone="violet" />
        <StatCard label="Today Usage" value={num(todayUsage)} icon={<Activity className="h-5 w-5" />} tone="amber" />
        <StatCard label="Monthly Cost (30d)" value={usd(monthlyCost)} icon={<DollarSign className="h-5 w-5" />} tone="red" />
        <StatCard label="Wallet Balance" value={usd(walletBalance)} icon={<Wallet className="h-5 w-5" />} tone="green" />
        <StatCard label="Risk Alerts" value={num(riskCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard title="Requests & Cost (30 Days)" icon={<TrendingUp className="h-4 w-4 text-primary" />} className="lg:col-span-2">
          {byDay.length === 0 ? (
            <EmptyState message="No usage data recorded in the last 30 days" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={byDay}>
                  <defs>
                    <linearGradient id="reqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tickFormatter={(v: string) => day(v)} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    labelFormatter={(v: string) => day(v)}
                  />
                  <Legend />
                  <Area yAxisId="left" type="monotone" dataKey="requests" name="Requests" stroke="hsl(var(--chart-1))" fill="url(#reqGrad)" />
                  <Area yAxisId="right" type="monotone" dataKey="cost" name="Cost (USD)" stroke="hsl(var(--chart-3))" fill="url(#costGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        <GlassCard title="AI vs Non-AI APIs" icon={<Bot className="h-4 w-4 text-primary" />}>
          {totalServices === 0 ? (
            <EmptyState message="No API services found" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={aiVsNonData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                    {aiVsNonData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard title="Top APIs by Usage" icon={<TrendingUp className="h-4 w-4 text-primary" />}>
          {topApis.length === 0 ? (
            <EmptyState message="No usage data to rank APIs" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>API</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Errors</TableHead>
                    <TableHead className="text-right">Avg Latency</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topApis.map((r) => (
                    <TableRow key={r.service_id}>
                      <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                      <TableCell className="text-right">{num(r.requests)}</TableCell>
                      <TableCell className="text-right text-status-error">{num(r.errors)}</TableCell>
                      <TableCell className="text-right">{r.avgLatency} ms</TableCell>
                      <TableCell className="text-right">{usd(r.cost)}</TableCell>
                      <TableCell>
                        <StatusBadge value={r.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>

        <GlassCard title="Live Risk Alerts" icon={<ShieldAlert className="h-4 w-4 text-status-warning" />}>
          {alerts.length === 0 ? (
            <EmptyState message="No security alerts recorded" />
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 8).map((a) => (
                <div
                  key={String(a["id"])}
                  className="rounded-lg border border-border/50 bg-muted/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{String(a["title"] ?? "")}</p>
                    <StatusBadge value={String(a["severity"] ?? "")} />
                  </div>
                  {a["description"] ? (
                    <p className="mt-1 text-xs text-muted-foreground">{String(a["description"])}</p>
                  ) : null}
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{String(a["category"] ?? "")} · {String(a["source"] ?? "")}</span>
                    <span>{when(a["detected_at"] as string | undefined)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
