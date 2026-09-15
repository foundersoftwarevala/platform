import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  MessageSquare,
  Eye,
  Mic,
  Image as ImageIcon,
  Video,
  Sparkles,
  Settings,
  Star,
  Power,
  DollarSign,
  Gauge,
  Layers,
  Plus,
  KeyRound,
  Server,
  Plug,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

import {
  useApiServiceHealthCheck,
  useInsertRecord,
  useManyRecords,
  useUpdateRecord,
  type Row,
} from "@/lib/manager-queries";
import {
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  day,
  num,
  usd,
} from "@/components/manager/primitives";

interface ScreenProps {
  view?: string | undefined;
}

const MODALITY_TABS: Array<{
  id: string;
  childId: string;
  label: string;
  modality: string;
  icon: typeof Brain;
}> = [
  {
    id: "ai-openai",
    childId: "ai-openai",
    label: "Text / LLM",
    modality: "text",
    icon: MessageSquare,
  },
  { id: "ai-vision", childId: "ai-vision", label: "Vision", modality: "vision", icon: Eye },
  { id: "ai-voice", childId: "ai-voice", label: "Voice", modality: "voice", icon: Mic },
  { id: "ai-image", childId: "ai-image", label: "Image", modality: "image", icon: ImageIcon },
  { id: "ai-video", childId: "ai-video", label: "Video", modality: "video", icon: Video },
  { id: "ai-nlp", childId: "ai-nlp", label: "NLP", modality: "nlp", icon: Sparkles },
  { id: "ai-custom", childId: "ai-custom", label: "Custom", modality: "custom", icon: Settings },
];

function providerName(providers: Row[], providerId: string | null): string {
  const p = providers.find((row) => row["id"] === providerId);
  return p ? String(p["name"]) : "Unknown provider";
}

function ModelUsageChart({ usage }: { usage: Row[] }) {
  const chartData = useMemo(() => {
    const byDay: Record<string, { day: string; requests: number; cost: number }> = {};
    for (const row of usage) {
      const d = day(row["day"] as string | null);
      const entry = byDay[d] ?? { day: d, requests: 0, cost: 0 };
      entry.requests += Number(row["requests"] ?? 0);
      entry.cost += Number(row["cost_usd"] ?? 0);
      byDay[d] = entry;
    }
    return Object.values(byDay);
  }, [usage]);

  if (chartData.length === 0) {
    return <p className="py-6 text-center text-xs text-muted-foreground">No usage recorded yet</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="h-48">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Requests / day</p>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Area
              type="monotone"
              dataKey="requests"
              stroke="hsl(var(--chart-1))"
              fill="hsl(var(--chart-1))"
              fillOpacity={0.25}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="h-48">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Cost (USD) / day</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Bar dataKey="cost" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ModalitySection({
  modality,
  models,
  providers,
  services,
  usage,
  onOpenModelDialog,
  onOpenServiceDialog,
  onOpenProviderDialog,
}: {
  modality: string;
  models: Row[];
  providers: Row[];
  services: Row[];
  usage: Row[];
  onOpenModelDialog: (modality: string) => void;
  onOpenServiceDialog: (category: string) => void;
  onOpenProviderDialog: () => void;
}) {
  const updateModel = useUpdateRecord("Model updated");

  const modalityModels = useMemo(
    () => models.filter((m) => String(m["modality"]).toLowerCase() === modality),
    [models, modality],
  );
  const modalityServices = useMemo(
    () => services.filter((s) => String(s["category"]).toLowerCase() === modality),
    [services, modality],
  );
  const modelIds = useMemo(() => new Set(modalityModels.map((m) => m["id"])), [modalityModels]);
  const modalityUsage = useMemo(
    () => usage.filter((u) => modelIds.has(u["model_id"])),
    [usage, modelIds],
  );

  const totalCost = modalityUsage.reduce((sum, u) => sum + Number(u["cost_usd"] ?? 0), 0);
  const totalRequests = modalityUsage.reduce((sum, u) => sum + Number(u["requests"] ?? 0), 0);
  const avgLatency = modalityModels.length
    ? modalityModels.reduce((sum, m) => sum + Number(m["latency_ms"] ?? 0), 0) /
      modalityModels.length
    : 0;
  const avgQuality = modalityModels.length
    ? modalityModels.reduce((sum, m) => sum + Number(m["quality_score"] ?? 0), 0) /
      modalityModels.length
    : 0;

  const toggleStatus = (model: Row) => {
    const next = model["status"] === "active" ? "inactive" : "active";
    updateModel.mutate({ table: "ai_models", id: String(model["id"]), values: { status: next } });
  };

  const setDefault = (model: Row) => {
    modalityModels
      .filter((m) => m["is_default"] && m["id"] !== model["id"])
      .forEach((m) =>
        updateModel.mutate({
          table: "ai_models",
          id: String(m["id"]),
          values: { is_default: false },
        }),
      );
    updateModel.mutate({
      table: "ai_models",
      id: String(model["id"]),
      values: { is_default: true },
    });
  };

  if (modalityModels.length === 0 && modalityServices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-12 px-4 text-center space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          No {modality} models or services configured yet.
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Register an AI Provider, Model, or Execution Service to enable {modality} capabilities
          across the platform.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button size="sm" onClick={() => onOpenModelDialog(modality)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add {modality.toUpperCase()} Model
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenServiceDialog(modality)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Service
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenProviderDialog}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Provider
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Models"
          value={num(modalityModels.length)}
          icon={<Brain className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Requests (window)"
          value={num(totalRequests)}
          icon={<Gauge className="h-4 w-4" />}
          tone="cyan"
        />
        <StatCard
          label="Cost (window)"
          value={usd(totalCost)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Avg quality / latency"
          value={`${avgQuality.toFixed(1)} · ${Math.round(avgLatency)}ms`}
          icon={<Layers className="h-4 w-4" />}
          tone="violet"
        />
      </div>

      <GlassCard
        title="Models"
        icon={<Brain className="h-4 w-4 text-primary" />}
        actions={
          <Button size="sm" variant="outline" onClick={() => onOpenModelDialog(modality)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Model
          </Button>
        }
      >
        {modalityModels.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No models in this modality
          </p>
        ) : (
          <div className="space-y-3">
            {modalityModels.map((model) => (
              <div
                key={String(model["id"])}
                className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {String(model["name"])}
                    </p>
                    {model["is_default"] ? (
                      <Badge
                        variant="outline"
                        className="border-status-success/40 bg-status-success/15 text-status-success"
                      >
                        <Star className="mr-1 h-3 w-3" /> default
                      </Badge>
                    ) : null}
                    <StatusBadge value={model["status"] as string} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {providerName(providers, model["provider_id"] as string | null)} ·{" "}
                    {String(model["model_id"])}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>In: {usd(model["input_cost_per_1k"] as number)}/1k</span>
                    <span>Out: {usd(model["output_cost_per_1k"] as number)}/1k</span>
                    <span>Context: {num(model["context_window"] as number)}</span>
                    <span>Latency: {num(model["latency_ms"] as number)}ms</span>
                    <span>Quality: {Number(model["quality_score"] ?? 0).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(model["is_default"]) || updateModel.isPending}
                    onClick={() => setDefault(model)}
                  >
                    <Star className="mr-1 h-3.5 w-3.5" /> Set default
                  </Button>
                  <div className="flex items-center gap-2">
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch
                      checked={model["status"] === "active"}
                      onCheckedChange={() => toggleStatus(model)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {modalityServices.length > 0 ? (
        <GlassCard
          title="API services"
          icon={<Layers className="h-4 w-4 text-neon-cyan" />}
          actions={
            <Button size="sm" variant="outline" onClick={() => onOpenServiceDialog(modality)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Service
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Health</th>
                  <th className="py-2 pr-3">Uptime</th>
                  <th className="py-2 pr-3">Latency</th>
                </tr>
              </thead>
              <tbody>
                {modalityServices.map((s) => (
                  <tr key={String(s["id"])} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{String(s["name"])}</td>
                    <td className="py-2 pr-3">
                      <StatusBadge value={s["status"] as string} />
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge value={s["health_status"] as string} />
                    </td>
                    <td className="py-2 pr-3">{Number(s["uptime_pct"] ?? 0).toFixed(2)}%</td>
                    <td className="py-2 pr-3">{num(s["avg_latency_ms"] as number)}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard title="Usage & cost" icon={<DollarSign className="h-4 w-4 text-neon-cyan" />}>
        <ModelUsageChart usage={modalityUsage} />
      </GlassCard>
    </div>
  );
}

function CentralRegistrySection({
  services,
  capabilities,
  keys,
  usageEvents,
  onConfigure,
}: {
  services: Row[];
  capabilities: Row[];
  keys: Row[];
  usageEvents: Row[];
  onConfigure: (service: Row) => void;
}) {
  const updateService = useUpdateRecord("Registry service updated");
  const healthCheck = useApiServiceHealthCheck();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [engineFilter, setEngineFilter] = useState("all");
  const [pricingFilter, setPricingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [credentialFilter, setCredentialFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");

  const capabilityMap = useMemo(() => {
    const entries = new Map<string, Row[]>();
    for (const capability of capabilities) {
      const serviceId = String(capability["service_id"] ?? "");
      if (serviceId) entries.set(serviceId, [...(entries.get(serviceId) ?? []), capability]);
    }
    return entries;
  }, [capabilities]);
  const configuredServiceIds = useMemo(
    () =>
      new Set(
        keys
          .filter((key) => key["status"] === "active" && key["service_id"])
          .map((key) => String(key["service_id"])),
      ),
    [keys],
  );
  const serviceUsage = useMemo(() => {
    const entries = new Map<string, { requests: number; cost: number }>();
    for (const event of usageEvents) {
      const serviceId = String(event["service_id"] ?? "");
      if (!serviceId) continue;
      const current = entries.get(serviceId) ?? { requests: 0, cost: 0 };
      current.requests += Number(event["requests"] ?? 0);
      current.cost += Number(event["cost_usd"] ?? 0);
      entries.set(serviceId, current);
    }
    return entries;
  }, [usageEvents]);
  const filterOptions = useMemo(() => {
    const values = (column: string) =>
      Array.from(
        new Set(
          services.flatMap((service) => {
            const value = service[column];
            return Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
          }),
        ),
      ).sort();
    return {
      categories: values("category"),
      countries: values("supported_countries"),
      engines: values("supported_search_engines"),
      pricing: values("pricing_tier"),
      statuses: values("status"),
      approvals: values("approval_status"),
      health: values("health_status"),
    };
  }, [services]);
  const filteredServices = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return services.filter((service) => {
      const serviceId = String(service["id"]);
      const capabilityText = (capabilityMap.get(serviceId) ?? [])
        .map((capability) => String(capability["capability_name"] ?? ""))
        .join(" ")
        .toLocaleLowerCase();
      const haystack = [
        service["name"],
        service["slug"],
        service["category"],
        service["pricing_tier"],
        ...(Array.isArray(service["supported_countries"]) ? service["supported_countries"] : []),
        ...(Array.isArray(service["supported_search_engines"])
          ? service["supported_search_engines"]
          : []),
        capabilityText,
      ]
        .map(String)
        .join(" ")
        .toLocaleLowerCase();
      const countryMatches =
        countryFilter === "all" ||
        (Array.isArray(service["supported_countries"]) &&
          service["supported_countries"].map(String).includes(countryFilter));
      const engineMatches =
        engineFilter === "all" ||
        (Array.isArray(service["supported_search_engines"]) &&
          service["supported_search_engines"].map(String).includes(engineFilter));
      const credentialMatches =
        credentialFilter === "all" ||
        (credentialFilter === "configured") === configuredServiceIds.has(serviceId);
      return (
        (!term || haystack.includes(term)) &&
        (categoryFilter === "all" || service["category"] === categoryFilter) &&
        countryMatches &&
        engineMatches &&
        (pricingFilter === "all" || service["pricing_tier"] === pricingFilter) &&
        (statusFilter === "all" || service["status"] === statusFilter) &&
        credentialMatches &&
        (approvalFilter === "all" || service["approval_status"] === approvalFilter) &&
        (healthFilter === "all" || service["health_status"] === healthFilter)
      );
    });
  }, [
    approvalFilter,
    capabilityMap,
    categoryFilter,
    configuredServiceIds,
    countryFilter,
    credentialFilter,
    engineFilter,
    healthFilter,
    pricingFilter,
    search,
    services,
    statusFilter,
  ]);

  if (!services.length) {
    return (
      <GlassCard
        title="Central service registry"
        icon={<Layers className="h-4 w-4 text-primary" />}
      >
        <p className="py-4 text-sm text-muted-foreground">
          No registered services yet. Registry entries appear here after the central registry
          migration is deployed.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      title="Central service registry"
      icon={<Layers className="h-4 w-4 text-primary" />}
      description={`${filteredServices.length} of ${services.length} registered AI, API, and SEO services`}
    >
      <div className="mb-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <Input
          className="xl:col-span-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search service, capability, country, or network"
          aria-label="Search central service registry"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {filterOptions.categories.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {filterOptions.countries.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={engineFilter} onValueChange={setEngineFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Search engine / network" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engines / networks</SelectItem>
            {filterOptions.engines.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pricingFilter} onValueChange={setPricingFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Pricing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pricing</SelectItem>
            {filterOptions.pricing.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Activation status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activation states</SelectItem>
            {filterOptions.statuses.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={credentialFilter} onValueChange={setCredentialFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Credentials" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All credential states</SelectItem>
            <SelectItem value="configured">Configured</SelectItem>
            <SelectItem value="required">Credential required</SelectItem>
          </SelectContent>
        </Select>
        <Select value={approvalFilter} onValueChange={setApprovalFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Approval" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All approval states</SelectItem>
            {filterOptions.approvals.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={healthFilter} onValueChange={setHealthFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health states</SelectItem>
            {filterOptions.health.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-3">
        {filteredServices.map((service) => {
          const serviceId = String(service["id"]);
          const isExpanded = expandedId === serviceId;
          const approval = String(service["approval_status"] ?? "pending");
          const credentialConfigured = configuredServiceIds.has(serviceId);
          const capabilityRows = capabilityMap.get(serviceId) ?? [];
          const serviceTotals = serviceUsage.get(serviceId) ?? { requests: 0, cost: 0 };
          const canEnable = approval === "approved" && credentialConfigured;
          const isActive = service["status"] === "active";

          return (
            <div key={serviceId} className="rounded-lg border border-border/50 bg-card/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{String(service["name"])}</p>
                    <StatusBadge value={String(service["status"] ?? "inactive")} />
                    <StatusBadge value={approval} />
                    {!credentialConfigured ? (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                        BLOCKED / CREDENTIAL REQUIRED
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-status-success/40 text-status-success"
                      >
                        Credential configured
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {String(service["category"] ?? "general")} ·{" "}
                    {String(service["pricing_tier"] ?? "unknown")} ·{" "}
                    {String(service["auth_type"] ?? "not specified")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedId(isExpanded ? null : serviceId)}
                  >
                    {isExpanded ? "Hide details" : "View details"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onConfigure(service)}>
                    <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Configure
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={healthCheck.isPending || !service["endpoint_url"]}
                    onClick={() => healthCheck.mutate({ serviceId })}
                  >
                    <Gauge className="mr-1.5 h-3.5 w-3.5" /> Health
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title="A provider-specific execution adapter and an approved credential are required before a live request can be tested."
                  >
                    Test blocked
                  </Button>
                  {approval !== "approved" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateService.isPending}
                      onClick={() =>
                        updateService.mutate({
                          table: "api_services",
                          id: serviceId,
                          values: { approval_status: "approved" },
                        })
                      }
                    >
                      Approve
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant={isActive ? "outline" : "default"}
                    disabled={!isActive && (!canEnable || updateService.isPending)}
                    title={
                      !isActive && !canEnable
                        ? "Approval and an active credential are required before enabling."
                        : undefined
                    }
                    onClick={() =>
                      updateService.mutate({
                        table: "api_services",
                        id: serviceId,
                        values: { status: isActive ? "inactive" : "active" },
                      })
                    }
                  >
                    <Power className="mr-1.5 h-3.5 w-3.5" /> {isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </div>
              {isExpanded ? (
                <div className="mt-4 grid gap-3 border-t border-border/50 pt-3 text-xs md:grid-cols-2">
                  <div className="space-y-1 text-muted-foreground">
                    <p>Provider: {String(service["provider_id"] ?? "Not linked")}</p>
                    <p>Health: {String(service["health_status"] ?? "not checked")}</p>
                    <p>
                      Test:{" "}
                      {credentialConfigured && approval === "approved"
                        ? "Adapter required"
                        : "BLOCKED / CREDENTIAL REQUIRED or PENDING APPROVAL"}
                    </p>
                    <p>Usage: {num(serviceTotals.requests)} requests</p>
                    <p>Cost: {usd(serviceTotals.cost)}</p>
                    <p>
                      Country coverage:{" "}
                      {(service["supported_countries"] as string[] | null)?.join(", ") ||
                        "Not specified"}
                    </p>
                    <p>
                      Search engines:{" "}
                      {(service["supported_search_engines"] as string[] | null)?.join(", ") ||
                        "Not applicable"}
                    </p>
                  </div>
                  <div className="space-y-1 text-muted-foreground">
                    <p>Official: {String(service["official_url"] ?? "Not specified")}</p>
                    <p>Documentation: {String(service["docs_url"] ?? "Not specified")}</p>
                    <p>Capabilities ({capabilityRows.length})</p>
                    {capabilityRows.length ? (
                      <ul className="list-inside list-disc">
                        {capabilityRows.map((capability) => (
                          <li key={String(capability["id"])}>
                            {String(capability["capability_name"])} ·{" "}
                            {String(capability["verification_status"])} ·{" "}
                            {String(capability["approval_status"])}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Not catalogued</p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        {!filteredServices.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No services match the selected registry filters.
          </p>
        ) : null}
      </div>
    </GlassCard>
  );
}

export default function AiApiScreen({ view }: ScreenProps) {
  const [tab, setTab] = useState<string>(() => {
    const found = MODALITY_TABS.find((t) => t.childId === view);
    return found ? found.id : "ai-openai";
  });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const insertRecord = useInsertRecord("Created successfully");

  // Dialog states
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: "",
    slug: "",
    category: "ai",
    base_url: "",
    region: "global",
    docs_url: "",
  });

  const [modelOpen, setModelOpen] = useState(false);
  const [modelForm, setModelForm] = useState({
    name: "",
    model_id: "",
    provider_id: "none",
    modality: "text",
    context_window: "128000",
    input_cost_per_1k: "0",
    output_cost_per_1k: "0",
    is_default: false,
  });

  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    slug: "",
    provider_id: "none",
    category: "text",
    endpoint_url: "",
  });

  const [keyOpen, setKeyOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({
    label: "",
    environment: "production",
    service_id: "none",
    provider_id: "none",
    secret: "",
  });

  useEffect(() => {
    const found = MODALITY_TABS.find((t) => t.childId === view);
    if (found) {
      setTab(found.id);
      refs.current[found.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [view]);

  const many = useManyRecords([
    { table: "ai_providers", orderBy: "name", ascending: true, limit: 200 },
    { table: "ai_models", orderBy: "name", ascending: true, limit: 500 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "usage_daily", orderBy: "day", ascending: false, limit: 2000 },
    { table: "api_service_capabilities", orderBy: "capability_name", ascending: true, limit: 2000 },
    { table: "api_keys", orderBy: "created_at", ascending: false, limit: 500 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 2000 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI API Management"
          description="Providers, models and usage by modality"
        />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="AI API Management"
          description="Providers, models and usage by modality"
        />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [
    providers = [],
    models = [],
    services = [],
    usage = [],
    capabilities = [],
    keys = [],
    usageEvents = [],
  ] = many.data ?? [];

  const totalModels = models.length;
  const activeModels = models.filter((m) => m["status"] === "active").length;
  const totalCost = usage.reduce((sum, u) => sum + Number(u["cost_usd"] ?? 0), 0);
  const totalProviders = providers.length;

  const handleCreateProvider = () => {
    if (!providerForm.name.trim() || !providerForm.slug.trim()) return;
    insertRecord.mutate({
      table: "ai_providers",
      values: {
        name: providerForm.name.trim(),
        slug: providerForm.slug.trim().toLowerCase(),
        category: providerForm.category,
        base_url: providerForm.base_url.trim() || null,
        region: providerForm.region || "global",
        docs_url: providerForm.docs_url.trim() || null,
        status: "inactive",
      },
    });
    setProviderOpen(false);
    setProviderForm({
      name: "",
      slug: "",
      category: "ai",
      base_url: "",
      region: "global",
      docs_url: "",
    });
  };

  const handleCreateModel = () => {
    if (!modelForm.name.trim() || !modelForm.model_id.trim()) return;
    insertRecord.mutate({
      table: "ai_models",
      values: {
        name: modelForm.name.trim(),
        model_id: modelForm.model_id.trim(),
        provider_id: modelForm.provider_id === "none" ? null : modelForm.provider_id,
        modality: modelForm.modality,
        context_window: Number(modelForm.context_window) || 128000,
        input_cost_per_1k: Number(modelForm.input_cost_per_1k) || 0,
        output_cost_per_1k: Number(modelForm.output_cost_per_1k) || 0,
        is_default: modelForm.is_default,
        status: "inactive",
      },
    });
    setModelOpen(false);
    setModelForm({
      name: "",
      model_id: "",
      provider_id: "none",
      modality: "text",
      context_window: "128000",
      input_cost_per_1k: "0",
      output_cost_per_1k: "0",
      is_default: false,
    });
  };

  const handleCreateService = () => {
    if (!serviceForm.name.trim() || !serviceForm.slug.trim()) return;
    insertRecord.mutate({
      table: "api_services",
      values: {
        name: serviceForm.name.trim(),
        slug: serviceForm.slug.trim().toLowerCase(),
        provider_id: serviceForm.provider_id === "none" ? null : serviceForm.provider_id,
        category: serviceForm.category,
        endpoint_url: serviceForm.endpoint_url.trim() || null,
        status: "inactive",
        health_status: "not_checked",
        uptime_pct: 0,
      },
    });
    setServiceOpen(false);
    setServiceForm({ name: "", slug: "", provider_id: "none", category: "text", endpoint_url: "" });
  };

  const handleCreateKey = () => {
    if (!keyForm.label.trim() || !keyForm.secret.trim()) return;
    const secret = keyForm.secret.trim();
    const prefix = secret.slice(0, Math.min(8, secret.length));
    const lastFour = secret.slice(-4);

    insertRecord.mutate({
      table: "api_keys",
      values: {
        label: keyForm.label.trim(),
        environment: keyForm.environment,
        status: "active",
        key_prefix: prefix,
        last_four: lastFour,
        fingerprint: `${prefix}_${lastFour}_${Date.now()}`,
        secret_encrypted: secret || null,
        service_id: keyForm.service_id === "none" ? null : keyForm.service_id,
        provider_id: keyForm.provider_id === "none" ? null : keyForm.provider_id,
        scopes: [],
      },
    });
    setKeyOpen(false);
    setKeyForm({
      label: "",
      environment: "production",
      service_id: "none",
      provider_id: "none",
      secret: "",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI API Management"
        description="Manage AI providers, models and per-modality usage & cost"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setProviderOpen(true)}>
              <Server className="mr-1.5 h-3.5 w-3.5" /> Add Provider
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModelOpen(true)}>
              <Brain className="mr-1.5 h-3.5 w-3.5" /> Add Model
            </Button>
            <Button size="sm" variant="outline" onClick={() => setServiceOpen(true)}>
              <Plug className="mr-1.5 h-3.5 w-3.5" /> Add Service
            </Button>
            <Button size="sm" variant="outline" onClick={() => setKeyOpen(true)}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Configure Key
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="AI providers"
          value={num(totalProviders)}
          icon={<Brain className="h-4 w-4" />}
          tone="primary"
        />
        <StatCard
          label="Models (active)"
          value={`${num(activeModels)} / ${num(totalModels)}`}
          icon={<Power className="h-4 w-4" />}
          tone="cyan"
        />
        <StatCard
          label="Total spend"
          value={usd(totalCost)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="amber"
        />
        <StatCard
          label="Modalities tracked"
          value={num(MODALITY_TABS.length)}
          icon={<Layers className="h-4 w-4" />}
          tone="violet"
        />
      </div>

      <CentralRegistrySection
        services={services}
        capabilities={capabilities}
        keys={keys}
        usageEvents={usageEvents}
        onConfigure={(service) => {
          setKeyForm((form) => ({ ...form, service_id: String(service["id"]) }));
          setKeyOpen(true);
        }}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {MODALITY_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {MODALITY_TABS.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            <div
              ref={(el) => {
                refs.current[t.id] = el;
              }}
            >
              <ModalitySection
                modality={t.modality}
                models={models}
                providers={providers}
                services={services}
                usage={usage}
                onOpenModelDialog={(m) => {
                  setModelForm((f) => ({ ...f, modality: m }));
                  setModelOpen(true);
                }}
                onOpenServiceDialog={(c) => {
                  setServiceForm((f) => ({ ...f, category: c }));
                  setServiceOpen(true);
                }}
                onOpenProviderDialog={() => setProviderOpen(true)}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Provider Dialog */}
      <Dialog open={providerOpen} onOpenChange={setProviderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register AI Provider</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Provider Name</Label>
              <Input
                placeholder="e.g. OpenAI, Anthropic, Google Gemini"
                value={providerForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setProviderForm((f) => ({
                    ...f,
                    name: val,
                    slug: f.slug || val.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                  }));
                }}
              />
            </div>
            <div>
              <Label>Slug Identifier</Label>
              <Input
                placeholder="e.g. openai, anthropic, google"
                value={providerForm.slug}
                onChange={(e) => setProviderForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <Label>Base URL</Label>
              <Input
                placeholder="e.g. https://api.openai.com/v1"
                value={providerForm.base_url}
                onChange={(e) => setProviderForm((f) => ({ ...f, base_url: e.target.value }))}
              />
            </div>
            <div>
              <Label>Region</Label>
              <Input
                placeholder="global / us / eu"
                value={providerForm.region}
                onChange={(e) => setProviderForm((f) => ({ ...f, region: e.target.value }))}
              />
            </div>
            <div>
              <Label>Docs URL (Optional)</Label>
              <Input
                placeholder="e.g. https://platform.openai.com/docs"
                value={providerForm.docs_url}
                onChange={(e) => setProviderForm((f) => ({ ...f, docs_url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProviderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProvider}
              disabled={!providerForm.name.trim() || !providerForm.slug.trim()}
            >
              Save Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register AI Model</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Model Display Name</Label>
              <Input
                placeholder="e.g. GPT-4o, Claude 3.5 Sonnet"
                value={modelForm.name}
                onChange={(e) => setModelForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Model ID (API Identifier)</Label>
              <Input
                placeholder="e.g. gpt-4o, claude-3-5-sonnet-latest"
                value={modelForm.model_id}
                onChange={(e) => setModelForm((f) => ({ ...f, model_id: e.target.value }))}
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select
                value={modelForm.provider_id}
                onValueChange={(val) => setModelForm((f) => ({ ...f, provider_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
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
            <div>
              <Label>Modality</Label>
              <Select
                value={modelForm.modality}
                onValueChange={(val) => setModelForm((f) => ({ ...f, modality: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text / LLM</SelectItem>
                  <SelectItem value="vision">Vision</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="nlp">NLP / Chat</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Input Cost / 1k ($)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="0.00015"
                  value={modelForm.input_cost_per_1k}
                  onChange={(e) =>
                    setModelForm((f) => ({ ...f, input_cost_per_1k: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Output Cost / 1k ($)</Label>
                <Input
                  type="number"
                  step="0.00001"
                  placeholder="0.0006"
                  value={modelForm.output_cost_per_1k}
                  onChange={(e) =>
                    setModelForm((f) => ({ ...f, output_cost_per_1k: e.target.value }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Context Window (Tokens)</Label>
              <Input
                type="number"
                placeholder="128000"
                value={modelForm.context_window}
                onChange={(e) => setModelForm((f) => ({ ...f, context_window: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="model-default"
                checked={modelForm.is_default}
                onCheckedChange={(checked) => setModelForm((f) => ({ ...f, is_default: checked }))}
              />
              <Label htmlFor="model-default" className="text-xs font-normal cursor-pointer">
                Set as default model for this modality
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateModel}
              disabled={!modelForm.name.trim() || !modelForm.model_id.trim()}
            >
              Save Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service Dialog */}
      <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register API Execution Service</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Service Name</Label>
              <Input
                placeholder="e.g. OpenAI Chat Completions"
                value={serviceForm.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setServiceForm((f) => ({
                    ...f,
                    name: val,
                    slug: f.slug || val.toLowerCase().replace(/[^a-z0-9]/g, "-"),
                  }));
                }}
              />
            </div>
            <div>
              <Label>Slug Identifier</Label>
              <Input
                placeholder="e.g. openai-chat"
                value={serviceForm.slug}
                onChange={(e) => setServiceForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div>
              <Label>Provider</Label>
              <Select
                value={serviceForm.provider_id}
                onValueChange={(val) => setServiceForm((f) => ({ ...f, provider_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
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
            <div>
              <Label>Category</Label>
              <Select
                value={serviceForm.category}
                onValueChange={(val) => setServiceForm((f) => ({ ...f, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text / LLM</SelectItem>
                  <SelectItem value="vision">Vision</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="nlp">NLP</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Execution Endpoint URL</Label>
              <Input
                placeholder="e.g. https://api.openai.com/v1/chat/completions"
                value={serviceForm.endpoint_url}
                onChange={(e) => setServiceForm((f) => ({ ...f, endpoint_url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateService}
              disabled={!serviceForm.name.trim() || !serviceForm.slug.trim()}
            >
              Save Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Dialog */}
      <Dialog open={keyOpen} onOpenChange={setKeyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure API Credential / Key</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Key Label</Label>
              <Input
                placeholder="e.g. Production OpenAI API Key"
                value={keyForm.label}
                onChange={(e) => setKeyForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div>
              <Label>Environment</Label>
              <Select
                value={keyForm.environment}
                onValueChange={(val) => setKeyForm((f) => ({ ...f, environment: val }))}
              >
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
            <div>
              <Label>Service</Label>
              <Select
                value={keyForm.service_id}
                onValueChange={(val) => setKeyForm((f) => ({ ...f, service_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Service" />
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
            <div>
              <Label>Provider</Label>
              <Select
                value={keyForm.provider_id}
                onValueChange={(val) => setKeyForm((f) => ({ ...f, provider_id: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Provider" />
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
            <div>
              <Label>Secret API Key Value</Label>
              <Input
                type="password"
                placeholder="sk-... or AIza... (stored encrypted on server)"
                value={keyForm.secret}
                onChange={(e) => setKeyForm((f) => ({ ...f, secret: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateKey}
              disabled={!keyForm.label.trim() || !keyForm.secret.trim()}
            >
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
