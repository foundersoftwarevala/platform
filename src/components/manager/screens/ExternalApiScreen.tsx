import { useEffect, useMemo, useRef, useState } from "react";
import {
  CreditCard,
  MessageCircle,
  Mail,
  Phone,
  Map,
  Cloud,
  BarChart3,
  Activity,
  AlertTriangle,
  DollarSign,
  Server,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
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

interface ScreenProps {
  view?: string | undefined;
}

const CATEGORY_TABS: Array<{ id: string; childId: string; label: string; category: string; icon: typeof CreditCard }> = [
  { id: "ext-payment", childId: "ext-payment", label: "Payment", category: "payment", icon: CreditCard },
  { id: "ext-sms", childId: "ext-sms", label: "SMS", category: "sms", icon: MessageCircle },
  { id: "ext-email", childId: "ext-email", label: "Email", category: "email", icon: Mail },
  { id: "ext-whatsapp", childId: "ext-whatsapp", label: "WhatsApp", category: "whatsapp", icon: Phone },
  { id: "ext-maps", childId: "ext-maps", label: "Maps", category: "maps", icon: Map },
  { id: "ext-cloud", childId: "ext-cloud", label: "Cloud", category: "cloud", icon: Cloud },
  { id: "ext-analytics", childId: "ext-analytics", label: "Analytics", category: "analytics", icon: BarChart3 },
];

function providerName(providers: Row[], providerId: string | null): string {
  const p = providers.find((row) => row['id'] === providerId);
  return p ? String(p['name']) : "—";
}

function CategoryTrafficChart({ usage, logs }: { usage: Row[]; logs: Row[] }) {
  const usageChart = useMemo(() => {
    const byDay: Record<string, { day: string; requests: number; errors: number }> = {};
    for (const row of usage) {
      const d = day(row['day'] as string | null);
      const entry = byDay[d] ?? { day: d, requests: 0, errors: 0 };
      entry.requests += Number(row['requests'] ?? 0);
      entry.errors += Number(row['errors'] ?? 0);
      byDay[d] = entry;
    }
    return Object.values(byDay);
  }, [usage]);

  const latencyChart = useMemo(() => {
    const byDay: Record<string, { day: string; latency: number; count: number }> = {};
    for (const row of logs) {
      const d = day(row['occurred_at'] as string | null);
      const entry = byDay[d] ?? { day: d, latency: 0, count: 0 };
      entry.latency += Number(row['latency_ms'] ?? 0);
      entry.count += 1;
      byDay[d] = entry;
    }
    return Object.values(byDay).map((e) => ({ day: e.day, latency: e.count ? Math.round(e.latency / e.count) : 0 }));
  }, [logs]);

  if (usageChart.length === 0 && latencyChart.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No traffic recorded yet</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-48">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Requests vs errors / day</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={usageChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="requests" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
            <Bar dataKey="errors" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="h-48">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Avg request latency / day (ms)</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={latencyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Line type="monotone" dataKey="latency" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  services,
  providers,
  integrations,
  usage,
  logs,
}: {
  category: string;
  services: Row[];
  providers: Row[];
  integrations: Row[];
  usage: Row[];
  logs: Row[];
}) {
  const updateService = useUpdateRecord("Service updated");

  const catServices = useMemo(
    () => services.filter((s) => String(s['category']).toLowerCase() === category),
    [services, category],
  );
  const catProviders = useMemo(
    () => providers.filter((p) => String(p['category']).toLowerCase() === category),
    [providers, category],
  );
  const catIntegrations = useMemo(
    () => integrations.filter((i) => String(i['category']).toLowerCase() === category),
    [integrations, category],
  );
  const serviceIds = new Set(catServices.map((s) => s['id']));
  const catUsage = useMemo(() => usage.filter((u) => serviceIds.has(u['service_id'])), [usage, catServices]);
  const catLogs = useMemo(() => logs.filter((l) => serviceIds.has(l['service_id'])), [logs, catServices]);

  const totalRequests = catUsage.reduce((sum, u) => sum + Number(u['requests'] ?? 0), 0);
  const totalErrors = catUsage.reduce((sum, u) => sum + Number(u['errors'] ?? 0), 0);
  const totalCost = catUsage.reduce((sum, u) => sum + Number(u['cost_usd'] ?? 0), 0);
  const avgUptime = catServices.length
    ? catServices.reduce((sum, s) => sum + Number(s['uptime_pct'] ?? 0), 0) / catServices.length
    : 0;

  const toggleStatus = (service: Row) => {
    const next = service['status'] === "active" ? "inactive" : "active";
    updateService.mutate({ table: "api_services", id: String(service['id']), values: { status: next } });
  };

  if (catServices.length === 0 && catProviders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
        No {category} services configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Services" value={num(catServices.length)} icon={<Server className="h-4 w-4" />} tone="primary" />
        <StatCard label="Requests (window)" value={num(totalRequests)} icon={<Activity className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Errors (window)" value={num(totalErrors)} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Cost / Uptime" value={`${usd(totalCost)} · ${avgUptime.toFixed(2)}%`} icon={<DollarSign className="h-4 w-4" />} tone="amber" />
      </div>

      <GlassCard title="Services" icon={<Server className="h-4 w-4 text-primary" />}>
        {catServices.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No services in this category</p>
        ) : (
          <div className="space-y-3">
            {catServices.map((service) => (
              <div
                key={String(service['id'])}
                className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{String(service['name'])}</p>
                    <StatusBadge value={service['status'] as string} />
                    <StatusBadge value={service['health_status'] as string} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {providerName(providers, service['provider_id'] as string | null)} · v{String(service['version'])} · {String(service['owner_team'])}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Uptime: {Number(service['uptime_pct'] ?? 0).toFixed(2)}%</span>
                    <span>Latency: {num(service['avg_latency_ms'] as number)}ms</span>
                    <span className="truncate">Endpoint: {String(service['endpoint_url'] ?? "—")}</span>
                    <span>Checked: {when(service['last_checked_at'] as string | null)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{service['status'] === "active" ? "Enabled" : "Disabled"}</span>
                  <Switch checked={service['status'] === "active"} onCheckedChange={() => toggleStatus(service)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {catIntegrations.length > 0 ? (
        <GlassCard title="Integrations" icon={<Activity className="h-4 w-4 text-neon-cyan" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Integration</th>
                  <th className="py-2 pr-3">Direction</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Errors</th>
                  <th className="py-2 pr-3">Last sync</th>
                </tr>
              </thead>
              <tbody>
                {catIntegrations.map((i) => (
                  <tr key={String(i['id'])} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{String(i['name'])}</td>
                    <td className="py-2 pr-3 capitalize">{String(i['direction'])}</td>
                    <td className="py-2 pr-3"><StatusBadge value={i['status'] as string} /></td>
                    <td className="py-2 pr-3">{num(i['error_count'] as number)}</td>
                    <td className="py-2 pr-3">{when(i['last_sync_at'] as string | null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard title="Traffic & reliability" icon={<BarChart3 className="h-4 w-4 text-neon-cyan" />}>
        <CategoryTrafficChart usage={catUsage} logs={catLogs} />
      </GlassCard>
    </div>
  );
}

export default function ExternalApiScreen({ view }: ScreenProps) {
  const [tab, setTab] = useState<string>(() => {
    const found = CATEGORY_TABS.find((t) => t.childId === view);
    return found ? found.id : "ext-payment";
  });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const found = CATEGORY_TABS.find((t) => t.childId === view);
    if (found) {
      setTab(found.id);
      refs.current[found.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const many = useManyRecords([
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "ai_providers", orderBy: "name", ascending: true, limit: 200 },
    { table: "api_integrations", orderBy: "name", ascending: true, limit: 500 },
    { table: "usage_daily", orderBy: "day", ascending: false, limit: 2000 },
    { table: "api_request_logs", orderBy: "occurred_at", ascending: false, limit: 2000 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="External API Management" description="Payments, messaging, maps, cloud & analytics integrations" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="External API Management" description="Payments, messaging, maps, cloud & analytics integrations" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [services, providers, integrations, usage, logs] = many.data ?? [[], [], [], [], []];

  const totalServices = services?.length ?? 0;
  const activeServices = (services ?? []).filter((s) => s['status'] === "active").length;
  const totalCost = (usage ?? []).reduce((sum, u) => sum + Number(u['cost_usd'] ?? 0), 0);
  const avgUptime = (services ?? []).length
    ? (services ?? []).reduce((sum, s) => sum + Number(s['uptime_pct'] ?? 0), 0) / (services ?? []).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="External API Management"
        description="Manage third-party services across payments, messaging, maps, cloud and analytics"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="External services" value={num(totalServices)} icon={<Server className="h-4 w-4" />} tone="primary" />
        <StatCard label="Enabled" value={`${num(activeServices)} / ${num(totalServices)}`} icon={<Activity className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total spend" value={usd(totalCost)} icon={<DollarSign className="h-4 w-4" />} tone="amber" />
        <StatCard label="Avg uptime" value={`${avgUptime.toFixed(2)}%`} icon={<AlertTriangle className="h-4 w-4" />} tone="violet" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {CATEGORY_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CATEGORY_TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            <div ref={(el) => { refs.current[t.id] = el; }}>
              <CategorySection
                category={t.category}
                services={services ?? []}
                providers={providers ?? []}
                integrations={integrations ?? []}
                usage={usage ?? []}
                logs={logs ?? []}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
