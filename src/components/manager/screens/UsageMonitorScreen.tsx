import { useEffect, useMemo, useRef } from "react";
import {
  Activity,
  AlertCircle,
  Clock,
  Download,
  Gauge,
  Package,
  Shield,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useManyRecords } from "@/lib/manager-queries";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  downloadRows,
  num,
  when,
} from "@/components/manager/primitives";

function useScrollIntoFocus(view: string | undefined, ids: readonly string[]) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!view || !ids.includes(view)) return;
    const el = refs.current[view];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/60");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [view, ids]);
  return refs;
}

const CHILD_IDS = [
  "usage-rps",
  "usage-per-user",
  "usage-per-product",
  "usage-per-role",
  "usage-failed",
  "usage-latency",
] as const;

export default function UsageMonitorScreen({ view }: { view?: string | undefined }) {
  const refs = useScrollIntoFocus(view, CHILD_IDS);

  const many = useManyRecords([
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 1000 },
    { table: "api_request_logs", orderBy: "occurred_at", ascending: false, limit: 1000 },
    { table: "role_api_permissions", limit: 500 },
    { table: "api_services", limit: 500 },
    { table: "usage_daily", orderBy: "day", ascending: false, limit: 1000 },
  ]);

  const raw = many.data;
  const usageEvents = raw?.[0] ?? [];
  const requestLogs = raw?.[1] ?? [];
  const rolePerms = raw?.[2] ?? [];
  const services = raw?.[3] ?? [];
  const usageDaily = raw?.[4] ?? [];

  const isLoading = many.isLoading;
  const error = many.error;

  const serviceById = useMemo(() => new Map(services.map((s) => [String(s["id"]), s])), [services]);

  const dailyAvgRequests = useMemo(() => {
    if (usageDaily.length === 0) return 0;
    const total = usageDaily.reduce((sum, r) => sum + Number(r["requests"] ?? 0), 0);
    const days = new Set(usageDaily.map((r) => String(r["day"] ?? ""))).size || 1;
    return Math.round(total / days);
  }, [usageDaily]);

  // Requests per second: derived from usage_events timestamps in the most recent window.
  const rps = useMemo(() => {
    if (usageEvents.length === 0) return 0;
    const times = usageEvents
      .map((e) => new Date(String(e["occurred_at"] ?? "")).getTime())
      .filter((t) => !Number.isNaN(t));
    if (times.length === 0) return 0;
    const totalRequests = usageEvents.reduce((sum, e) => sum + Number(e["requests"] ?? 1), 0);
    const maxT = Math.max(...times);
    const minT = Math.min(...times);
    const spanSeconds = Math.max((maxT - minT) / 1000, 1);
    return totalRequests / spanSeconds;
  }, [usageEvents]);

  const totalRequests = usageEvents.reduce((sum, e) => sum + Number(e["requests"] ?? 1), 0);
  const failedCount = requestLogs.filter((r) => Number(r["status_code"] ?? 0) >= 400).length;
  const activeProducts = new Set(usageEvents.map((e) => String(e["product"] ?? ""))).size;
  const avgLatency = requestLogs.length
    ? Math.round(requestLogs.reduce((sum, r) => sum + Number(r["latency_ms"] ?? 0), 0) / requestLogs.length)
    : 0;

  const perProduct = useMemo(() => {
    const map = new Map<string, { product: string; requests: number; cost: number }>();
    for (const e of usageEvents) {
      const p = String(e["product"] ?? "unknown");
      const entry = map.get(p) ?? { product: p, requests: 0, cost: 0 };
      entry.requests += Number(e["requests"] ?? 1);
      entry.cost += Number(e["cost_usd"] ?? 0);
      map.set(p, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.requests - a.requests).slice(0, 12);
  }, [usageEvents]);

  const perSource = useMemo(() => {
    const map = new Map<string, { source: string; requests: number }>();
    for (const e of usageEvents) {
      const s = String(e["source"] ?? "unknown");
      const entry = map.get(s) ?? { source: s, requests: 0 };
      entry.requests += Number(e["requests"] ?? 1);
      map.set(s, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.requests - a.requests).slice(0, 12);
  }, [usageEvents]);

  const perRole = useMemo(() => {
    const map = new Map<string, { role: string; rateLimit: number; services: number }>();
    for (const p of rolePerms) {
      const role = String(p["role_name"] ?? "unknown");
      const entry = map.get(role) ?? { role, rateLimit: 0, services: 0 };
      entry.rateLimit = Math.max(entry.rateLimit, Number(p["rate_limit_per_min"] ?? 0));
      entry.services += 1;
      map.set(role, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.rateLimit - a.rateLimit);
  }, [rolePerms]);

  const failedRequests = useMemo(
    () =>
      requestLogs
        .filter((r) => Number(r["status_code"] ?? 0) >= 400)
        .sort((a, b) => String(b["occurred_at"] ?? "").localeCompare(String(a["occurred_at"] ?? "")))
        .slice(0, 25),
    [requestLogs],
  );

  const latencyStats = useMemo(() => {
    const values = requestLogs.map((r) => Number(r["latency_ms"] ?? 0)).sort((a, b) => a - b);
    if (values.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
    const pick = (p: number) => {
      const idx = Math.min(values.length - 1, Math.floor((p / 100) * values.length));
      return values[idx] ?? 0;
    };
    return { p50: pick(50), p95: pick(95), p99: pick(99), max: values[values.length - 1] ?? 0 };
  }, [requestLogs]);

  const latencyBuckets = useMemo(() => {
    const buckets = [
      { label: "0-100ms", min: 0, max: 100, count: 0 },
      { label: "100-300ms", min: 100, max: 300, count: 0 },
      { label: "300-600ms", min: 300, max: 600, count: 0 },
      { label: "600ms-1s", min: 600, max: 1000, count: 0 },
      { label: "1s+", min: 1000, max: Infinity, count: 0 },
    ];
    for (const r of requestLogs) {
      const lat = Number(r["latency_ms"] ?? 0);
      const bucket = buckets.find((b) => lat >= b.min && lat < b.max);
      if (bucket) bucket.count += 1;
    }
    return buckets;
  }, [requestLogs]);

  const handleExportFailed = () => {
    downloadRows(
      "failed-requests.csv",
      failedRequests.map((r) => ({
        occurred_at: r["occurred_at"],
        method: r["method"],
        path: r["path"],
        status_code: r["status_code"],
        latency_ms: r["latency_ms"],
        error_message: r["error_message"],
        service: serviceById.get(String(r["service_id"] ?? ""))?.["name"] ?? r["service_id"],
      })),
    );
  };

  const handleExportUsageEvents = () => {
    downloadRows(
      "usage-events.csv",
      usageEvents.map((e) => ({
        occurred_at: e["occurred_at"],
        product: e["product"],
        source: e["source"],
        success: e["success"],
        status_code: e["status_code"],
        latency_ms: e["latency_ms"],
        requests: e["requests"],
        cost_usd: e["cost_usd"],
      })),
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Usage Monitor" description="Real-time API usage tracking and monitoring" />
        <LoadingBlock rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Usage Monitor" description="Real-time API usage tracking and monitoring" />
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Usage Monitor"
        description="Real-time API usage tracking and monitoring across products, users, roles and latency"
        actions={
          <Button variant="outline" size="sm" onClick={handleExportUsageEvents}>
            <Download className="mr-2 h-4 w-4" />
            Export Usage CSV
          </Button>
        }
      />

      <div
        ref={(el) => {
          refs.current["usage-rps"] = el;
        }}
        className="grid grid-cols-2 gap-4 rounded-xl transition-all md:grid-cols-3 lg:grid-cols-6"
      >
        <StatCard label="Requests/Second" value={rps.toFixed(1)} icon={<Gauge className="h-5 w-5" />} tone="primary" />
        <StatCard label="Total Requests" value={num(totalRequests)} change={`~${num(dailyAvgRequests)}/day avg`} icon={<Activity className="h-5 w-5" />} tone="cyan" />
        <StatCard label="Active Products" value={num(activeProducts)} icon={<Package className="h-5 w-5" />} tone="green" />
        <StatCard label="Failed Requests" value={num(failedCount)} icon={<AlertCircle className="h-5 w-5" />} tone="red" />
        <StatCard label="Avg Latency" value={`${avgLatency} ms`} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard label="P95 Latency" value={`${latencyStats.p95} ms`} icon={<Activity className="h-5 w-5" />} tone="slate" />
      </div>

      <div
        ref={(el) => {
          refs.current["usage-per-product"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard title="Requests per Product" icon={<Package className="h-4 w-4 text-primary" />}>
          {perProduct.length === 0 ? (
            <EmptyState message="No usage events recorded" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perProduct}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={12} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="requests" name="Requests" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div
          ref={(el) => {
            refs.current["usage-per-user"] = el;
          }}
          className="rounded-xl transition-all"
        >
          <GlassCard title="Requests per Source" icon={<Users className="h-4 w-4 text-primary" />}>
            {perSource.length === 0 ? (
              <EmptyState message="No usage events recorded" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perSource} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis dataKey="source" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="requests" name="Requests" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        <div
          ref={(el) => {
            refs.current["usage-per-role"] = el;
          }}
          className="rounded-xl transition-all"
        >
          <GlassCard title="Access & Rate Limits per Role" icon={<Shield className="h-4 w-4 text-primary" />}>
            {perRole.length === 0 ? (
              <EmptyState message="No role API permissions configured" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Services</TableHead>
                      <TableHead className="text-right">Max Rate Limit/min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perRole.map((r) => (
                      <TableRow key={r.role}>
                        <TableCell className="font-medium capitalize text-foreground">{r.role}</TableCell>
                        <TableCell className="text-right">{num(r.services)}</TableCell>
                        <TableCell className="text-right">{num(r.rateLimit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      <div
        ref={(el) => {
          refs.current["usage-failed"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard
          title="Failed Requests"
          icon={<AlertCircle className="h-4 w-4 text-status-error" />}
          actions={
            <Button variant="outline" size="sm" onClick={handleExportFailed}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          }
        >
          {failedRequests.length === 0 ? (
            <EmptyState message="No failed requests (status >= 400) recorded" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedRequests.map((r) => (
                    <TableRow key={String(r["id"])}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {when(r["occurred_at"] as string | undefined)}
                      </TableCell>
                      <TableCell>{String(serviceById.get(String(r["service_id"] ?? ""))?.["name"] ?? r["service_id"] ?? "—")}</TableCell>
                      <TableCell className="font-mono text-xs">{String(r["method"] ?? "")}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">{String(r["path"] ?? "")}</TableCell>
                      <TableCell className="text-right">
                        <StatusBadge value={Number(r["status_code"]) >= 500 ? "error" : "warning"} />
                        <span className="ml-1 text-xs text-muted-foreground">{String(r["status_code"] ?? "")}</span>
                      </TableCell>
                      <TableCell className="text-right">{num(r["latency_ms"] as number)} ms</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {String(r["error_message"] ?? "—")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </GlassCard>
      </div>

      <div
        ref={(el) => {
          refs.current["usage-latency"] = el;
        }}
        className="rounded-xl transition-all"
      >
        <GlassCard title="Latency Distribution" icon={<Clock className="h-4 w-4 text-primary" />}>
          {requestLogs.length === 0 ? (
            <EmptyState message="No request logs to compute latency distribution" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{latencyStats.p50} ms</p>
                  <p className="text-xs text-muted-foreground">P50</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                  <p className="text-lg font-bold text-status-warning">{latencyStats.p95} ms</p>
                  <p className="text-xs text-muted-foreground">P95</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                  <p className="text-lg font-bold text-status-error">{latencyStats.p99} ms</p>
                  <p className="text-xs text-muted-foreground">P99</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{latencyStats.max} ms</p>
                  <p className="text-xs text-muted-foreground">Max</p>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={latencyBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" name="Requests" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

    </div>
  );
}
