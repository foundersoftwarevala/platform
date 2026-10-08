import { Fragment, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  Bot,
  DollarSign,
  KeyRound,
  Layers,
  Lock,
  Plug,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useServerFn } from "@/lib/serverFn";
import {
  listAiRegistry,
  setAiServiceStatus,
  testAiService,
  type AiRegistryService,
} from "@/lib/ai-api.functions";

type ServiceRow = {
  id: string;
  name: string;
  owner: string;
  status: "active" | "warning" | "inactive";
  traffic: string;
  cost: string;
  latency: string;
  risk: string;
  category: string;
  pricing: string;
  approval: string;
  credential: string;
  capabilities: string[];
};

type AlertItem = {
  title: string;
  detail: string;
  severity: "warning" | "info" | "alert";
};

type TrafficPoint = {
  day: string;
  requests: number;
  cost: number;
  errors: number;
};

type ApiManagerSnapshot = {
  serviceRows: ServiceRow[];
  alerts: AlertItem[];
  source: "supabase" | "fallback";
  trafficSeries: TrafficPoint[];
  usageCount: number;
  totalCost: number;
  windowDays: number;
  truncated: boolean;
};

function createFallbackSnapshot(): ApiManagerSnapshot {
  return {
    source: "fallback",
    serviceRows: [],
    alerts: [],
    trafficSeries: [],
    usageCount: 0,
    totalCost: 0,
    windowDays: 0,
    truncated: false,
  };
}

async function fetchApiManagerSnapshot(): Promise<ApiManagerSnapshot> {
  const registryFn = useServerFn(listAiRegistry);
  const snapshot = await registryFn();
  const serviceRows = (snapshot.services ?? []).map((service: AiRegistryService) => ({
    id: service.id,
    name: service.name,
    owner: service.owner,
    status: service.status as ServiceRow["status"],
    traffic: `${service.usage_count} req`,
    cost: `$${service.total_cost.toFixed(2)}`,
    latency: service.last_error ? "Errors" : "Not measured",
    risk:
      service.error_count > 0
        ? "Needs attention"
        : service.status === "warning"
          ? "Medium"
          : "Low",
    category: service.category,
    pricing: service.pricing_tier,
    approval: service.approval_status,
    credential: service.credential_status,
    capabilities: service.capabilities,
  }));

  const alerts: AlertItem[] = [];
  if (snapshot.summary.errors > 0) {
    alerts.push({
      title: `${snapshot.summary.errors} failed requests`,
      detail: `Usage events recorded failures in the last ${snapshot.usage_window_days} days.`,
      severity: "warning",
    });
  }
  if (snapshot.summary.warning > 0) {
    alerts.push({
      title: `${snapshot.summary.warning} services need review`,
      detail: "Registry entries are marked warning or degraded.",
      severity: "info",
    });
  }

  const trafficSeries = (snapshot.usage_by_day ?? []).map((point) => ({
    day: point.date.slice(5),
    requests: point.requests,
    cost: point.cost,
    errors: point.errors,
  }));

  return {
    source: snapshot.source,
    serviceRows,
    alerts,
    trafficSeries,
    usageCount: trafficSeries.reduce((acc, point) => acc + point.requests, 0),
    totalCost: trafficSeries.reduce((acc, point) => acc + point.cost, 0),
    windowDays: snapshot.usage_window_days,
    truncated: snapshot.usage_truncated,
  };
}

function StatusPill({ status }: { status: string }) {
  const style =
    {
      active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
      warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
      inactive: "border-rose-400/30 bg-rose-500/10 text-rose-300",
    }[status] ?? "border-white/10 bg-white/5 text-foreground/70";

  return (
    <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", style)}>
      {status}
    </Badge>
  );
}

export function AiApiManagerPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  const testFn = useServerFn(testAiService);
  const statusFn = useServerFn(setAiServiceStatus);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["ai-api-manager"],
    queryFn: fetchApiManagerSnapshot,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const snapshot = data ?? createFallbackSnapshot();

  const testMut = useMutation({
    mutationFn: (service: ServiceRow) => testFn({ data: { serviceId: service.id } }),
    onSuccess: (result) => toast[result.status === "ready" ? "success" : "warning"](result.detail),
    onError: (error: Error) => toast.error(error.message),
  });
  const statusMut = useMutation({
    mutationFn: ({ service, enabled }: { service: ServiceRow; enabled: boolean }) =>
      statusFn({ data: { serviceId: service.id, enabled } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai-api-manager"] });
      toast.success("Service status updated.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = useMemo(() => {
    const windowLabel = snapshot.windowDays ? `last ${snapshot.windowDays} days` : "no window";
    return {
      windowLabel,
      totalTraffic: snapshot.usageCount.toLocaleString(),
      totalCost: `$${snapshot.totalCost.toFixed(2)}`,
      coveredApis: `${snapshot.serviceRows.filter((row) => row.status === "active").length}/${snapshot.serviceRows.length}`,
      riskAlerts: `${snapshot.alerts.length} signals`,
    };
  }, [snapshot]);
  const capabilities = [...new Set(snapshot.serviceRows.flatMap((row) => row.capabilities))];

  return (
    <div className="rounded-2xl border border-sky-400/25 bg-[linear-gradient(140deg,rgba(13,24,44,0.96),rgba(8,17,34,0.95))] p-4 shadow-[0_22px_60px_-26px_rgba(44,116,255,0.85)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">
              <Zap className="h-3.5 w-3.5" />
              AI API Manager
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">
              {snapshot.source === "supabase" ? "Live registry data" : "Data unavailable"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Unified API, AI model, billing and security control
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            Requests and cost are aggregated from persisted usage events by calendar day over the
            {" "}
            {summary.windowLabel}. No projected, estimated or role-based figures are shown.
            {snapshot.truncated
              ? " The usage query reached its row cap, so totals are a lower bound."
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled title="Key rotation is not available here.">
            <KeyRound className="mr-2 h-4 w-4" />
            Rotate Keys
          </Button>
          <Button size="sm" disabled title="An audit action is not available here.">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Run Audit
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Connected APIs", value: summary.coveredApis, icon: Plug, tone: "sky" },
          {
            label: `Requests (${summary.windowLabel})`,
            value: summary.totalTraffic,
            icon: Activity,
            tone: "emerald",
          },
          {
            label: `Cost (${summary.windowLabel})`,
            value: summary.totalCost,
            icon: DollarSign,
            tone: "amber",
          },
          { label: "Risk alerts", value: summary.riskAlerts, icon: AlertTriangle, tone: "rose" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/4 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                {item.label}
              </p>
              <item.icon
                className={cn(
                  "h-4 w-4",
                  item.tone === "sky"
                    ? "text-sky-300"
                    : item.tone === "emerald"
                      ? "text-emerald-300"
                      : item.tone === "amber"
                        ? "text-amber-300"
                        : "text-rose-300",
                )}
              />
            </div>
            <p className="mt-2 text-xl font-semibold text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-foreground/70">
          Loading live manager data…
        </div>
      ) : null}
      {isError ? (
        <div role="alert" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-sm text-rose-200">
          AI registry data could not be loaded: {error instanceof Error ? error.message : "Unknown error"}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "registry", label: "Registry" },
            { id: "billing", label: "Billing" },
            { id: "security", label: "Security" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-foreground/70 data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-200"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                    Usage data
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Daily requests vs recorded cost
                  </p>
                </div>
                <Badge className="rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
                  {summary.windowLabel}
                </Badge>
              </div>
              <div className="h-48">
                {snapshot.trafficSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshot.trafficSeries}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#8fb5ff", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#8fb5ff", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="cost"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="flex h-full items-center text-sm text-foreground/70">
                    No usage events are available for this window.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <p className="text-sm font-semibold text-foreground">Registry signals</p>
                </div>
                {snapshot.alerts.length ? (
                  <ul className="space-y-2 text-sm text-foreground/70">
                    {snapshot.alerts.map((item) => <li key={item.title}>• {item.title}: {item.detail}</li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-foreground/70">No warning or failed-request signals were returned.</p>
                )}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-sky-300" />
                  <p className="text-sm font-semibold text-foreground">Modalities tracked</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {capabilities.length ? (
                    capabilities.map((item) => (
                      <Badge
                        key={item}
                        className="rounded-full border border-white/10 bg-white/5 text-foreground/70"
                      >
                        {item}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-foreground/70">
                      No capabilities are catalogued for the registered services.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="registry" className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                  Registry
                </p>
                <p className="text-sm font-semibold text-foreground">
                  Connected services & provider health
                </p>
              </div>
              <Badge className="rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">
                {snapshot.serviceRows.length} integrations
              </Badge>
            </div>
            <div className="overflow-hidden rounded-lg border border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="bg-white/5 hover:bg-white/5">
                    <TableHead>Service</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Traffic</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Registry</TableHead>
                    <TableHead>Controls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.serviceRows.map((row) => (
                    <Fragment key={row.id}>
                      <TableRow className="border-white/10">
                        <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                        <TableCell className="text-foreground/70">{row.owner}</TableCell>
                        <TableCell>
                          <StatusPill status={row.status} />
                        </TableCell>
                        <TableCell>{row.traffic}</TableCell>
                        <TableCell>{row.cost}</TableCell>
                        <TableCell>{row.latency}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div>
                              {row.category} · {row.pricing}
                            </div>
                            <div className="text-foreground/55">
                              {row.approval} · {row.credential}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() =>
                                setExpandedService(expandedService === row.id ? null : row.id)
                              }
                            >
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() => testMut.mutate(row)}
                              disabled={testMut.isPending}
                            >
                              Test
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[10px]"
                              onClick={() =>
                                statusMut.mutate({ service: row, enabled: row.status !== "active" })
                              }
                            >
                              {row.status === "active" ? "Disable" : "Enable"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedService === row.id ? (
                        <TableRow className="border-white/10 bg-white/[0.03]">
                          <TableCell colSpan={8}>
                            <div className="flex flex-wrap gap-2 text-xs text-foreground/70">
                              <span>Health: {row.latency}</span>
                              <span>Credential: {row.credential}</span>
                              <span>Approval: {row.approval}</span>
                              <span>
                                Capabilities:{" "}
                                {row.capabilities.length
                                  ? row.capabilities.join(", ")
                                  : "Not catalogued"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="billing" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">
                    Billing snapshot
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    Recorded cost by service
                  </p>
                </div>
                <Badge className="rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300">
                  Usage data
                </Badge>
              </div>
              <div className="space-y-3">
                {snapshot.serviceRows.slice(0, 3).map((item) => {
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg border border-white/10 bg-white/4 px-3 py-2"
                    >
                      <span className="text-sm text-foreground/70">{item.name}</span>
                      <span
                        className="font-semibold text-sky-300"
                      >
                        {item.cost}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <p className="text-sm font-semibold text-foreground">Role-wise access</p>
              </div>
              <div className="space-y-2">
                <p className="rounded-lg border border-white/10 bg-white/4 p-2.5 text-sm text-foreground/70">
                  Role-specific access quotas are not available in the registry data.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-rose-300" />
                <p className="text-sm font-semibold text-foreground">Security posture</p>
              </div>
              <div className="space-y-2">
                {snapshot.alerts.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-white/10 bg-white/4 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          item.severity === "alert"
                            ? "border-rose-400/25 bg-rose-500/10 text-rose-300"
                            : item.severity === "warning"
                              ? "border-amber-400/25 bg-amber-500/10 text-amber-300"
                              : "border-sky-400/25 bg-sky-400/10 text-sky-300",
                        )}
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground/65">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-300" />
                <p className="text-sm font-semibold text-foreground">Automation status</p>
              </div>
              <div className="space-y-2">
                <p className="rounded-lg border border-white/10 bg-white/4 p-2.5 text-sm text-foreground/70">
                  Automation state is not tracked by the registry, so no automation status is
                  reported here.
                </p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AiApiManagerPanel;
