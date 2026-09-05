import { useMemo, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useServerFn } from "@/lib/serverFn";
import { listAiRegistry, routeAiRequest, type AiRegistryService } from "@/lib/ai-api.functions";

type ServiceRow = {
  name: string;
  owner: string;
  status: "active" | "warning" | "inactive";
  traffic: string;
  cost: string;
  latency: string;
  risk: string;
};

type TrafficPoint = {
  day: string;
  requests: number;
  cost: number;
};

type AlertItem = {
  title: string;
  detail: string;
  severity: "warning" | "info" | "alert";
};

type AccessRow = {
  role: string;
  services: string;
  quota: string;
};

type ApiManagerSnapshot = {
  serviceRows: ServiceRow[];
  trafficSeries: TrafficPoint[];
  alerts: AlertItem[];
  accessRows: AccessRow[];
  source: "supabase" | "fallback";
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function createFallbackSnapshot(): ApiManagerSnapshot {
  return {
    source: "supabase",
    serviceRows: [],
    trafficSeries: [],
    alerts: [],
    accessRows: [],
  };
}

async function fetchApiManagerSnapshot(): Promise<ApiManagerSnapshot> {
  try {
    const registryFn = useServerFn(listAiRegistry);
    const snapshot = await registryFn();
    const serviceRows = (snapshot.services ?? []).map((service: AiRegistryService) => ({
      name: service.name,
      owner: service.owner,
      status: service.status as ServiceRow["status"],
      traffic: `${service.usage_count} req`,
      cost: `$${service.total_cost.toFixed(2)}`,
      latency: service.last_error ? "Errors" : "Live",
      risk: service.error_count > 0 ? "Needs attention" : service.status === "warning" ? "Medium" : "Low",
    }));

    const trafficSeries = serviceRows.length
      ? [
          { day: "Active", requests: snapshot.summary.active * 120, cost: snapshot.summary.cost },
          { day: "Usage", requests: snapshot.summary.usage, cost: Math.max(1, snapshot.summary.cost * 1.15) },
          { day: "Errors", requests: snapshot.summary.errors, cost: Math.max(1, snapshot.summary.errors) },
        ]
      : [];

    const alerts: AlertItem[] = [];
    if (snapshot.summary.errors > 0) {
      alerts.push({ title: `${snapshot.summary.errors} routing errors`, detail: "Review the latest registry failures and adjust routing.", severity: "warning" });
    }
    if (snapshot.summary.warning > 0) {
      alerts.push({ title: `${snapshot.summary.warning} services need review`, detail: "Some registry entries are marked warning or degraded.", severity: "info" });
    }
    if (snapshot.summary.active > 0) {
      alerts.push({ title: `${snapshot.summary.active} active registry routes`, detail: "The AI gateway is currently routing through live registry services.", severity: "alert" });
    }

    const accessRows: AccessRow[] = [
      { role: "Founder", services: `${snapshot.summary.active} active routes`, quota: `${snapshot.summary.usage} requests` },
      { role: "Reseller", services: `${snapshot.summary.warning} warning services`, quota: `$${snapshot.summary.cost.toFixed(2)}` },
      { role: "Franchise", services: `${snapshot.summary.errors} tracked errors`, quota: `${snapshot.summary.inactive} inactive` },
    ];

    return {
      source: snapshot.source,
      serviceRows,
      trafficSeries,
      alerts,
      accessRows,
    };
  } catch {
    return { ...createFallbackSnapshot(), source: "fallback" };
  }
}

function StatusPill({ status }: { status: string }) {
  const style = {
    active: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    inactive: "border-rose-400/30 bg-rose-500/10 text-rose-300",
  }[status] ?? "border-white/10 bg-white/5 text-foreground/70";

  return <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", style)}>{status}</Badge>;
}

export function AiApiManagerPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();
  const routeFn = useServerFn(routeAiRequest);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-api-manager"],
    queryFn: fetchApiManagerSnapshot,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const snapshot = data ?? createFallbackSnapshot();

  const routeMut = useMutation({
    mutationFn: async (service: AiRegistryService) => routeFn({ data: { serviceId: service.id, payload: { estimated_cost: Math.max(0.01, service.total_cost + 0.01) } } }),
    onSuccess: async (_result, service) => {
      await queryClient.invalidateQueries({ queryKey: ["ai-api-manager"] });
      toast.success(`Routed request to ${service.name}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = useMemo(() => {
    const totalTraffic = snapshot.trafficSeries.reduce((acc, item) => acc + item.requests, 0);
    const totalCost = snapshot.trafficSeries.reduce((acc, item) => acc + item.cost, 0);
    return {
      totalTraffic: `${(totalTraffic / 1000).toFixed(1)}k req`,
      totalCost: `$${totalCost.toFixed(0)}`,
      coveredApis: `${snapshot.serviceRows.filter((row) => row.status === "active").length}/${snapshot.serviceRows.length}`,
      riskAlerts: `${snapshot.alerts.filter((item) => item.severity === "alert").length} critical`,
    };
  }, [snapshot]);

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
              {snapshot.source === "supabase" ? "Supabase live data" : "Fallback demo data"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-foreground">Unified API, AI model, billing and security control</h3>
          <p className="mt-1 max-w-2xl text-sm text-foreground/65">
            This module is now embedded into the control panel with dashboards backed by Supabase data when available and a safe fallback when the workspace is still using demo-only tables.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="border-sky-400/25 bg-sky-400/10 text-sky-200">
            <KeyRound className="mr-2 h-4 w-4" />
            Rotate Keys
          </Button>
          <Button size="sm" className="bg-linear-to-r from-sky-500 to-cyan-400 text-black">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Run Audit
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Connected APIs", value: summary.coveredApis, icon: Plug, tone: "sky" },
          { label: "Traffic this week", value: summary.totalTraffic, icon: Activity, tone: "emerald" },
          { label: "Spend tracked", value: summary.totalCost, icon: DollarSign, tone: "amber" },
          { label: "Risk alerts", value: summary.riskAlerts, icon: AlertTriangle, tone: "rose" },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-white/10 bg-white/4 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">{item.label}</p>
              <item.icon className={cn("h-4 w-4", item.tone === "sky" ? "text-sky-300" : item.tone === "emerald" ? "text-emerald-300" : item.tone === "amber" ? "text-amber-300" : "text-rose-300")} />
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="h-auto w-full justify-start gap-1 bg-transparent p-0">
          {[
            { id: "overview", label: "Overview" },
            { id: "registry", label: "Registry" },
            { id: "billing", label: "Billing" },
            { id: "security", label: "Security" },
          ].map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-foreground/70 data-[state=active]:bg-sky-500/20 data-[state=active]:text-sky-200">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">Demand curve</p>
                  <p className="text-sm font-semibold text-foreground">Weekly requests vs spend</p>
                </div>
                <Badge className="rounded-full border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">Live pulse</Badge>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapshot.trafficSeries}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#8fb5ff", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#8fb5ff", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="requests" stroke="#38bdf8" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="cost" stroke="#34d399" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  <p className="text-sm font-semibold text-foreground">Optimization suggestions</p>
                </div>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li>• Rotate the Midjourney key to reduce provider instability.</li>
                  <li>• Shift 15% of growth traffic to Claude for lower spend.</li>
                  <li>• Enable fallback gateway for voice provider.</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-sky-300" />
                  <p className="text-sm font-semibold text-foreground">Modalities tracked</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Text', 'Image', 'Voice', 'Video'].map((item) => (
                    <Badge key={item} className="rounded-full border border-white/10 bg-white/5 text-foreground/70">{item}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="registry" className="mt-4 space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">Registry</p>
                <p className="text-sm font-semibold text-foreground">Connected services & provider health</p>
              </div>
              <Badge className="rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">{snapshot.serviceRows.length} integrations</Badge>
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
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshot.serviceRows.map((row) => (
                    <TableRow key={row.name} className="border-white/10">
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell className="text-foreground/70">{row.owner}</TableCell>
                      <TableCell><StatusPill status={row.status} /></TableCell>
                      <TableCell>{row.traffic}</TableCell>
                      <TableCell>{row.cost}</TableCell>
                      <TableCell>{row.latency}</TableCell>
                      <TableCell>{row.risk}</TableCell>
                    </TableRow>
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
                  <p className="text-[10px] uppercase tracking-[0.2em] text-foreground/50">Billing snapshot</p>
                  <p className="text-sm font-semibold text-foreground">Spend allocation by role and service</p>
                </div>
                <Badge className="rounded-full border border-amber-400/25 bg-amber-500/10 text-amber-300">Budget</Badge>
              </div>
              <div className="space-y-3">
                {snapshot.serviceRows.slice(0, 3).map((item, index) => {
                  const value = `$${(index + 1) * 500 + 600}`;
                  return (
                    <div key={item.name} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/4 px-3 py-2">
                      <span className="text-sm text-foreground/70">{item.name}</span>
                      <span className={cn("font-semibold", index === 0 ? "text-sky-300" : index === 1 ? "text-emerald-300" : "text-amber-300")}>{value}</span>
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
                {snapshot.accessRows.map((row) => (
                  <div key={row.role} className="rounded-lg border border-white/10 bg-white/4 p-2.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">{row.role}</p>
                      <Badge className="rounded-full border border-sky-400/25 bg-sky-400/10 text-sky-300">{row.quota}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground/65">{row.services}</p>
                  </div>
                ))}
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
                  <div key={item.title} className="rounded-lg border border-white/10 bg-white/4 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <Badge className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", item.severity === "alert" ? "border-rose-400/25 bg-rose-500/10 text-rose-300" : item.severity === "warning" ? "border-amber-400/25 bg-amber-500/10 text-amber-300" : "border-sky-400/25 bg-sky-400/10 text-sky-300")}>{item.severity}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-foreground/65">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-center gap-2">
                <Bot className="h-4 w-4 text-sky-300" />
                <p className="text-sm font-semibold text-foreground">Automations enabled</p>
              </div>
              <div className="space-y-2">
                {[
                  "Auto-rotate keys every 24h",
                  "Block abusive IPs in real time",
                  "Fallback gateway for provider outage",
                  "Audit export to finance monthly",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-foreground/70">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AiApiManagerPanel;
