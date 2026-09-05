import { useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  Brain,
  Download,
  Gauge,
  Key,
  KeyRound,
  Plug,
  Plus,
  RotateCcw,
  ScrollText,
  Shield,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

import {
  useInsertRecord,
  useManyRecords,
  useUpdateRecord,
  type Row,
} from "@/lib/manager-queries";
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
  "reg-keys",
  "reg-services",
  "reg-integrations",
  "reg-monitoring",
  "reg-rate-limits",
  "reg-logs",
  "reg-decisions",
  "reg-automation",
  "reg-reports",
];

export default function RegistryScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "reg-keys";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "api_keys", orderBy: "created_at", ascending: false, limit: 300 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 300 },
    { table: "api_integrations", orderBy: "created_at", ascending: false, limit: 300 },
    { table: "rate_limits", orderBy: "created_at", ascending: false, limit: 300 },
    { table: "api_request_logs", orderBy: "occurred_at", ascending: false, limit: 500 },
    { table: "ai_decision_logs", orderBy: "occurred_at", ascending: false, limit: 500 },
    { table: "automation_rules", orderBy: "created_at", ascending: false, limit: 300 },
    { table: "usage_daily", orderBy: "day", ascending: true, limit: 1000 },
    { table: "ai_providers", orderBy: "name", ascending: true, limit: 200 },
    { table: "ai_models", orderBy: "name", ascending: true, limit: 300 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Registry & Ops" description="Keys, services, integrations, monitoring and automation" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="API Registry & Ops" description="Keys, services, integrations, monitoring and automation" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [
    keys,
    services,
    integrations,
    rateLimits,
    requestLogs,
    decisionLogs,
    automationRules,
    usageDaily,
    providers,
    models,
  ] = many.data ?? [[], [], [], [], [], [], [], [], [], []];

  return (
    <RegistryContent
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      keys={keys ?? []}
      services={services ?? []}
      integrations={integrations ?? []}
      rateLimits={rateLimits ?? []}
      requestLogs={requestLogs ?? []}
      decisionLogs={decisionLogs ?? []}
      automationRules={automationRules ?? []}
      usageDaily={usageDaily ?? []}
      providers={providers ?? []}
      models={models ?? []}
    />
  );
}

function RegistryContent({
  activeTab,
  setActiveTab,
  keys,
  services,
  integrations,
  rateLimits,
  requestLogs,
  decisionLogs,
  automationRules,
  usageDaily,
  providers,
  models,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  keys: Row[];
  services: Row[];
  integrations: Row[];
  rateLimits: Row[];
  requestLogs: Row[];
  decisionLogs: Row[];
  automationRules: Row[];
  usageDaily: Row[];
  providers: Row[];
  models: Row[];
}) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s["id"], s])), [services]);
  const providerById = useMemo(() => new Map(providers.map((p) => [p["id"], p])), [providers]);

  const activeKeys = keys.filter((k) => k["status"] === "active").length;
  const healthyServices = services.filter((s) => s["health_status"] === "healthy").length;
  const errorRequests = requestLogs.filter((r) => n(r, "status_code") >= 400).length;
  const enabledRules = automationRules.filter((r) => r["enabled"]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Registry & Ops"
        description="Keys, services, integrations, monitoring, rate limits, logs and automation"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "api-services.csv",
                services.map((s) => ({
                  name: s["name"],
                  status: s["status"],
                  health: s["health_status"],
                  uptime_pct: s["uptime_pct"],
                })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Keys" value={activeKeys} icon={<Key className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Healthy Services" value={`${healthyServices}/${services.length}`} icon={<Plug className="h-4 w-4" />} tone="green" />
        <StatCard label="Error Requests (recent)" value={errorRequests} icon={<Activity className="h-4 w-4" />} tone="red" />
        <StatCard label="Automation Rules Active" value={enabledRules} icon={<Zap className="h-4 w-4" />} tone="violet" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="reg-keys">API Keys</TabsTrigger>
          <TabsTrigger value="reg-services">Services</TabsTrigger>
          <TabsTrigger value="reg-integrations">Integrations</TabsTrigger>
          <TabsTrigger value="reg-monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="reg-rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="reg-logs">Request Logs</TabsTrigger>
          <TabsTrigger value="reg-decisions">AI Decisions</TabsTrigger>
          <TabsTrigger value="reg-automation">Automation</TabsTrigger>
          <TabsTrigger value="reg-reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="reg-keys">
          <KeysPanel keys={keys} services={services} providers={providers} />
        </TabsContent>

        <TabsContent value="reg-services">
          <ServicesPanel services={services} providers={providers} />
        </TabsContent>

        <TabsContent value="reg-integrations">
          <IntegrationsPanel integrations={integrations} providers={providerById} />
        </TabsContent>

        <TabsContent value="reg-monitoring">
          <MonitoringPanel services={services} requestLogs={requestLogs} />
        </TabsContent>

        <TabsContent value="reg-rate-limits">
          <RateLimitsPanel rateLimits={rateLimits} services={serviceById} />
        </TabsContent>

        <TabsContent value="reg-logs">
          <LogsPanel requestLogs={requestLogs} services={serviceById} />
        </TabsContent>

        <TabsContent value="reg-decisions">
          <DecisionsPanel decisionLogs={decisionLogs} models={models} />
        </TabsContent>

        <TabsContent value="reg-automation">
          <AutomationPanel automationRules={automationRules} />
        </TabsContent>

        <TabsContent value="reg-reports">
          <ReportsPanel usageDaily={usageDaily} services={serviceById} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KeysPanel({ keys, services, providers }: { keys: Row[]; services: Row[]; providers: Row[] }) {
  const insert = useInsertRecord("API key created");
  const update = useUpdateRecord("API key updated");
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [serviceId, setServiceId] = useState<string>("none");
  const [providerId, setProviderId] = useState<string>("none");

  const createKey = () => {
    if (!label.trim()) return;
    const prefix = `sk_${environment.slice(0, 4)}`;
    const lastFour = Math.random().toString(36).slice(-4);
    insert.mutate({
      table: "api_keys",
      values: {
        label: label.trim(),
        environment,
        status: "active",
        key_prefix: prefix,
        last_four: lastFour,
        fingerprint: `${prefix}_${lastFour}_${Date.now()}`,
        service_id: serviceId === "none" ? null : serviceId,
        provider_id: providerId === "none" ? null : providerId,
        scopes: [],
      },
    });
    setOpen(false);
    setLabel("");
    setEnvironment("production");
    setServiceId("none");
    setProviderId("none");
  };

  const rotate = (row: Row) => {
    const lastFour = Math.random().toString(36).slice(-4);
    update.mutate({
      table: "api_keys",
      id: String(row["id"]),
      values: { last_four: lastFour, last_rotated_at: new Date().toISOString(), status: "active" },
    });
  };

  const revoke = (row: Row) => {
    update.mutate({ table: "api_keys", id: String(row["id"]), values: { status: "revoked" } });
  };

  return (
    <GlassCard
      title="API Keys"
      icon={<KeyRound className="h-4 w-4 text-primary" />}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Backend service key" />
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Service</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {services.map((s) => (
                      <SelectItem key={String(s["id"])} value={String(s["id"])}>
                        {String(s["name"])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={providerId} onValueChange={setProviderId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={String(p["id"])} value={String(p["id"])}>
                        {String(p["name"])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createKey} disabled={!label.trim() || insert.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {keys.length === 0 ? (
        <EmptyState message="No API keys yet" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Environment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Used</TableHead>
              <TableHead>Last Rotated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((k) => (
              <TableRow key={String(k["id"])}>
                <TableCell className="font-medium text-foreground">{String(k["label"])}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String(k["key_prefix"])}••••{String(k["last_four"])}
                </TableCell>
                <TableCell className="capitalize text-muted-foreground">{String(k["environment"])}</TableCell>
                <TableCell>
                  <StatusBadge value={String(k["status"])} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{when(k["last_used_at"] as string | null)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{when(k["last_rotated_at"] as string | null)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => rotate(k)} disabled={update.isPending}>
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Rotate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-status-error/40 text-status-error"
                      onClick={() => revoke(k)}
                      disabled={update.isPending || k["status"] === "revoked"}
                    >
                      Revoke
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </GlassCard>
  );
}

function ServicesPanel({ services, providers }: { services: Row[]; providers: Row[] }) {
  const update = useUpdateRecord("Service updated");
  const providerById = useMemo(() => new Map(providers.map((p) => [p["id"], p])), [providers]);

  const toggleStatus = (row: Row) => {
    const next = row["status"] === "active" ? "inactive" : "active";
    update.mutate({ table: "api_services", id: String(row["id"]), values: { status: next } });
  };

  return (
    <GlassCard title="API Services" icon={<Plug className="h-4 w-4 text-primary" />}>
      {services.length === 0 ? (
        <EmptyState message="No services registered" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Uptime</TableHead>
              <TableHead>Avg Latency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => {
              const provider = providerById.get(s["provider_id"]) as Row | undefined;
              return (
                <TableRow key={String(s["id"])}>
                  <TableCell className="font-medium text-foreground">{String(s["name"])}</TableCell>
                  <TableCell className="text-muted-foreground">{provider ? String(provider["name"]) : "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(s["category"])}</TableCell>
                  <TableCell>
                    <StatusBadge value={String(s["status"])} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={String(s["health_status"])} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{Number(s["uptime_pct"] ?? 0).toFixed(2)}%</TableCell>
                  <TableCell className="text-muted-foreground">{n(s, "avg_latency_ms")}ms</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggleStatus(s)} disabled={update.isPending}>
                      {s["status"] === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </GlassCard>
  );
}

function IntegrationsPanel({ integrations, providers }: { integrations: Row[]; providers: Map<unknown, Row> }) {
  const update = useUpdateRecord("Integration updated");

  const connected = integrations.filter((i) => i["status"] === "connected" || i["status"] === "active").length;
  const disconnected = integrations.length - connected;

  const toggle = (row: Row) => {
    const active = row["status"] === "connected" || row["status"] === "active";
    update.mutate({ table: "api_integrations", id: String(row["id"]), values: { status: active ? "disconnected" : "connected" } });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Connected" value={connected} icon={<Boxes className="h-4 w-4" />} tone="green" />
        <StatCard label="Disconnected" value={disconnected} icon={<Boxes className="h-4 w-4" />} tone="red" />
        <StatCard label="Total" value={integrations.length} icon={<Boxes className="h-4 w-4" />} tone="cyan" />
      </div>
      <GlassCard title="Integrations" icon={<Boxes className="h-4 w-4 text-primary" />}>
        {integrations.length === 0 ? (
          <EmptyState message="No integrations configured" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Auth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {integrations.map((i) => (
                <TableRow key={String(i["id"])}>
                  <TableCell className="font-medium text-foreground">{String(i["name"])}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(i["category"])}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(i["direction"])}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(i["auth_type"])}</TableCell>
                  <TableCell>
                    <StatusBadge value={String(i["status"])} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{n(i, "error_count")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{when(i["last_sync_at"] as string | null)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggle(i)} disabled={update.isPending}>
                      {i["status"] === "connected" || i["status"] === "active" ? "Disconnect" : "Connect"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </GlassCard>
    </div>
  );
}

function MonitoringPanel({ services, requestLogs }: { services: Row[]; requestLogs: Row[] }) {
  const errorCount = requestLogs.filter((r) => n(r, "status_code") >= 400).length;
  const avgLatency = requestLogs.length
    ? Math.round(requestLogs.reduce((s, r) => s + n(r, "latency_ms"), 0) / requestLogs.length)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Avg Latency" value={`${avgLatency}ms`} icon={<Activity className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Errors (recent)" value={errorCount} icon={<Activity className="h-4 w-4" />} tone="red" />
        <StatCard label="Services Monitored" value={services.length} icon={<Plug className="h-4 w-4" />} tone="violet" />
      </div>
      <GlassCard title="Service Health" icon={<Activity className="h-4 w-4 text-primary" />}>
        {services.length === 0 ? (
          <EmptyState message="No services to monitor" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {services.map((s) => (
              <div key={String(s["id"])} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{String(s["name"])}</p>
                  <StatusBadge value={String(s["health_status"])} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Uptime {Number(s["uptime_pct"] ?? 0).toFixed(2)}%</span>
                  <span>Latency {n(s, "avg_latency_ms")}ms</span>
                </div>
                <Progress value={Number(s["uptime_pct"] ?? 0)} className="mt-2 h-1.5" />
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function RateLimitsPanel({ rateLimits, services }: { rateLimits: Row[]; services: Map<unknown, Row> }) {
  const update = useUpdateRecord("Rate limit updated");
  const [editing, setEditing] = useState<Row | null>(null);
  const [maxRequests, setMaxRequests] = useState("");
  const [windowSeconds, setWindowSeconds] = useState("");
  const [burst, setBurst] = useState("");

  const openEdit = (row: Row) => {
    setEditing(row);
    setMaxRequests(String(row["max_requests"] ?? ""));
    setWindowSeconds(String(row["window_seconds"] ?? ""));
    setBurst(String(row["burst"] ?? ""));
  };

  const save = () => {
    if (!editing) return;
    update.mutate({
      table: "rate_limits",
      id: String(editing["id"]),
      values: {
        max_requests: Number(maxRequests) || 0,
        window_seconds: Number(windowSeconds) || 0,
        burst: Number(burst) || 0,
      },
    });
    setEditing(null);
  };

  const toggleEnabled = (row: Row) => {
    update.mutate({ table: "rate_limits", id: String(row["id"]), values: { enabled: !row["enabled"] } });
  };

  return (
    <GlassCard title="Rate Limits" icon={<Gauge className="h-4 w-4 text-primary" />}>
      {rateLimits.length === 0 ? (
        <EmptyState message="No rate limits configured" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Burst</TableHead>
              <TableHead>On Exceed</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rateLimits.map((r) => {
              const svc = services.get(r["service_id"]) as Row | undefined;
              const pct = n(r, "max_requests") > 0 ? (n(r, "current_usage") / n(r, "max_requests")) * 100 : 0;
              return (
                <TableRow key={String(r["id"])}>
                  <TableCell className="font-medium text-foreground">{svc ? String(svc["name"]) : "Global"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(r["scope"])}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, pct)} className="h-1.5 w-24" />
                      <span className="text-xs text-muted-foreground">
                        {n(r, "current_usage")}/{n(r, "max_requests")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{n(r, "window_seconds")}s</TableCell>
                  <TableCell className="text-muted-foreground">{n(r, "burst")}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{String(r["action_on_exceed"])}</TableCell>
                  <TableCell>
                    <Switch checked={Boolean(r["enabled"])} onCheckedChange={() => toggleEnabled(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rate Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Max Requests</Label>
              <Input value={maxRequests} onChange={(e) => setMaxRequests(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Window (seconds)</Label>
              <Input value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} type="number" />
            </div>
            <div className="space-y-2">
              <Label>Burst</Label>
              <Input value={burst} onChange={(e) => setBurst(e.target.value)} type="number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}

function LogsPanel({ requestLogs, services }: { requestLogs: Row[]; services: Map<unknown, Row> }) {
  return (
    <GlassCard
      title="Request Logs"
      icon={<ScrollText className="h-4 w-4 text-primary" />}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadRows(
              "request-logs.csv",
              requestLogs.map((r) => ({
                occurred_at: r["occurred_at"],
                method: r["method"],
                path: r["path"],
                status_code: r["status_code"],
                latency_ms: r["latency_ms"],
              })),
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      }
    >
      {requestLogs.length === 0 ? (
        <EmptyState message="No request logs yet" />
      ) : (
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requestLogs.slice(0, 200).map((r) => {
                const svc = services.get(r["service_id"]) as Row | undefined;
                const isError = n(r, "status_code") >= 400;
                return (
                  <TableRow key={String(r["id"])}>
                    <TableCell className="text-xs text-muted-foreground">{when(r["occurred_at"] as string | null)}</TableCell>
                    <TableCell className="text-muted-foreground">{svc ? String(svc["name"]) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{String(r["method"])}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{String(r["path"])}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={isError ? "border-status-error/40 text-status-error" : "border-status-success/40 text-status-success"}
                      >
                        {n(r, "status_code")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{n(r, "latency_ms")}ms</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r["error_message"] ? String(r["error_message"]) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </GlassCard>
  );
}

function DecisionsPanel({ decisionLogs, models }: { decisionLogs: Row[]; models: Row[] }) {
  const modelById = useMemo(() => new Map(models.map((m) => [m["id"], m])), [models]);
  const totalCost = decisionLogs.reduce((s, d) => s + n(d, "cost_usd"), 0);
  const avgConfidence = decisionLogs.length
    ? decisionLogs.reduce((s, d) => s + n(d, "confidence"), 0) / decisionLogs.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Decisions Logged" value={decisionLogs.length} icon={<Brain className="h-4 w-4" />} tone="violet" />
        <StatCard label="Total Cost" value={usd(totalCost)} icon={<Brain className="h-4 w-4" />} tone="green" />
        <StatCard label="Avg Confidence" value={`${Math.round(avgConfidence * 100)}%`} icon={<Brain className="h-4 w-4" />} tone="cyan" />
      </div>
      <GlassCard
        title="AI Decision Logs"
        icon={<Brain className="h-4 w-4 text-primary" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "ai-decision-logs.json",
                decisionLogs.map((d) => ({
                  occurred_at: d["occurred_at"],
                  decision: d["decision"],
                  outcome: d["outcome"],
                  confidence: d["confidence"],
                  cost_usd: d["cost_usd"],
                })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      >
        {decisionLogs.length === 0 ? (
          <EmptyState message="No AI decision logs yet" />
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisionLogs.slice(0, 200).map((d) => {
                  const model = modelById.get(d["model_id"]) as Row | undefined;
                  return (
                    <TableRow key={String(d["id"])}>
                      <TableCell className="text-xs text-muted-foreground">{when(d["occurred_at"] as string | null)}</TableCell>
                      <TableCell className="text-muted-foreground">{model ? String(model["name"]) : "—"}</TableCell>
                      <TableCell className="text-foreground">{String(d["decision"])}</TableCell>
                      <TableCell>
                        <StatusBadge value={String(d["outcome"])} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{Math.round(n(d, "confidence") * 100)}%</TableCell>
                      <TableCell className="text-muted-foreground">{n(d, "tokens")}</TableCell>
                      <TableCell className="text-muted-foreground">{usd(n(d, "cost_usd"))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function AutomationPanel({ automationRules }: { automationRules: Row[] }) {
  const insert = useInsertRecord("Automation rule created");
  const update = useUpdateRecord("Automation rule updated");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("threshold");
  const [actionType, setActionType] = useState("alert");

  const create = () => {
    if (!name.trim()) return;
    insert.mutate({
      table: "automation_rules",
      values: { name: name.trim(), trigger_type: triggerType, action_type: actionType, enabled: true, condition: {}, action_config: {} },
    });
    setOpen(false);
    setName("");
  };

  const toggle = (row: Row) => {
    update.mutate({ table: "automation_rules", id: String(row["id"]), values: { enabled: !row["enabled"] } });
  };

  const activeCount = automationRules.filter((r) => r["enabled"]).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Active Rules" value={activeCount} icon={<Zap className="h-4 w-4" />} tone="green" />
        <StatCard label="Paused Rules" value={automationRules.length - activeCount} icon={<Zap className="h-4 w-4" />} tone="amber" />
        <StatCard
          label="Total Runs"
          value={automationRules.reduce((s, r) => s + n(r, "run_count"), 0)}
          icon={<Zap className="h-4 w-4" />}
          tone="cyan"
        />
      </div>
      <GlassCard
        title="Automation Rules"
        icon={<Zap className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Automation Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auto-throttle on cost spike" />
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <Select value={triggerType} onValueChange={setTriggerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="threshold">Threshold</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action Type</Label>
                  <Select value={actionType} onValueChange={setActionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alert">Alert</SelectItem>
                      <SelectItem value="throttle">Throttle</SelectItem>
                      <SelectItem value="disable">Disable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={create} disabled={!name.trim() || insert.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {automationRules.length === 0 ? (
          <EmptyState message="No automation rules configured" />
        ) : (
          <div className="space-y-3">
            {automationRules.map((rule) => (
              <div key={String(rule["id"])} className="rounded-lg border border-border/30 bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-foreground">{String(rule["name"])}</span>
                    <StatusBadge value={rule["enabled"] ? "active" : "disabled"} />
                  </div>
                  <Switch checked={Boolean(rule["enabled"])} onCheckedChange={() => toggle(rule)} />
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p className="uppercase">Trigger</p>
                    <p className="text-foreground">{String(rule["trigger_type"])}</p>
                  </div>
                  <div>
                    <p className="uppercase">Action</p>
                    <p className="text-foreground">{String(rule["action_type"])}</p>
                  </div>
                  <div>
                    <p className="uppercase">Runs</p>
                    <p className="text-foreground">{n(rule, "run_count")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

function ReportsPanel({ usageDaily, services }: { usageDaily: Row[]; services: Map<unknown, Row> }) {
  const totalRequests = usageDaily.reduce((s, u) => s + n(u, "requests"), 0);
  const totalCost = usageDaily.reduce((s, u) => s + n(u, "cost_usd"), 0);

  const byService = useMemo(() => {
    const map = new Map<string, { name: string; requests: number; cost: number }>();
    for (const u of usageDaily) {
      const svc = services.get(u["service_id"]) as Row | undefined;
      const key = (u["service_id"] as string) ?? "unknown";
      const name = svc ? String(svc["name"]) : "Unknown";
      const existing = map.get(key) ?? { name, requests: 0, cost: 0 };
      existing.requests += n(u, "requests");
      existing.cost += n(u, "cost_usd");
      map.set(key, existing);
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost);
  }, [usageDaily, services]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <StatCard label="Total Requests" value={totalRequests.toLocaleString("en-US")} icon={<BarChart3 className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total Cost" value={usd(totalCost)} icon={<BarChart3 className="h-4 w-4" />} tone="green" />
      </div>
      <GlassCard
        title="Usage & Cost by Service"
        icon={<BarChart3 className="h-4 w-4 text-primary" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "api-reports.csv",
                byService.map((r) => ({ service: r.name, requests: r.requests, cost_usd: r.cost.toFixed(2) })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      >
        {byService.length === 0 ? (
          <EmptyState message="No usage data yet" />
        ) : (
          <div className="space-y-3">
            {byService.map((r) => (
              <div key={r.name} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-sm font-bold text-foreground">{usd(r.cost)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{r.requests.toLocaleString("en-US")} requests</p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
