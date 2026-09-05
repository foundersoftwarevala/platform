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

const MODALITY_TABS: Array<{ id: string; childId: string; label: string; modality: string; icon: typeof Brain }> = [
  { id: "ai-openai", childId: "ai-openai", label: "Text / LLM", modality: "text", icon: MessageSquare },
  { id: "ai-vision", childId: "ai-vision", label: "Vision", modality: "vision", icon: Eye },
  { id: "ai-voice", childId: "ai-voice", label: "Voice", modality: "voice", icon: Mic },
  { id: "ai-image", childId: "ai-image", label: "Image", modality: "image", icon: ImageIcon },
  { id: "ai-video", childId: "ai-video", label: "Video", modality: "video", icon: Video },
  { id: "ai-nlp", childId: "ai-nlp", label: "NLP", modality: "nlp", icon: Sparkles },
  { id: "ai-custom", childId: "ai-custom", label: "Custom", modality: "custom", icon: Settings },
];

function providerName(providers: Row[], providerId: string | null): string {
  const p = providers.find((row) => row['id'] === providerId);
  return p ? String(p['name']) : "Unknown provider";
}

function ModelUsageChart({ usage }: { usage: Row[] }) {
  const chartData = useMemo(() => {
    const byDay: Record<string, { day: string; requests: number; cost: number }> = {};
    for (const row of usage) {
      const d = day(row['day'] as string | null);
      const entry = byDay[d] ?? { day: d, requests: 0, cost: 0 };
      entry.requests += Number(row['requests'] ?? 0);
      entry.cost += Number(row['cost_usd'] ?? 0);
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
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
            <Area type="monotone" dataKey="requests" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.25} />
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
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
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
}: {
  modality: string;
  models: Row[];
  providers: Row[];
  services: Row[];
  usage: Row[];
}) {
  const updateModel = useUpdateRecord("Model updated");

  const modalityModels = useMemo(
    () => models.filter((m) => String(m['modality']).toLowerCase() === modality),
    [models, modality],
  );
  const modalityServices = useMemo(
    () => services.filter((s) => String(s['category']).toLowerCase() === modality),
    [services, modality],
  );
  const modelIds = new Set(modalityModels.map((m) => m['id']));
  const modalityUsage = useMemo(
    () => usage.filter((u) => modelIds.has(u['model_id'])),
    [usage, modalityModels],
  );

  const totalCost = modalityUsage.reduce((sum, u) => sum + Number(u['cost_usd'] ?? 0), 0);
  const totalRequests = modalityUsage.reduce((sum, u) => sum + Number(u['requests'] ?? 0), 0);
  const avgLatency = modalityModels.length
    ? modalityModels.reduce((sum, m) => sum + Number(m['latency_ms'] ?? 0), 0) / modalityModels.length
    : 0;
  const avgQuality = modalityModels.length
    ? modalityModels.reduce((sum, m) => sum + Number(m['quality_score'] ?? 0), 0) / modalityModels.length
    : 0;

  const toggleStatus = (model: Row) => {
    const next = model['status'] === "active" ? "inactive" : "active";
    updateModel.mutate({ table: "ai_models", id: String(model['id']), values: { status: next } });
  };

  const setDefault = (model: Row) => {
    modalityModels
      .filter((m) => m['is_default'] && m['id'] !== model['id'])
      .forEach((m) => updateModel.mutate({ table: "ai_models", id: String(m['id']), values: { is_default: false } }));
    updateModel.mutate({ table: "ai_models", id: String(model['id']), values: { is_default: true } });
  };

  if (modalityModels.length === 0 && modalityServices.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
        No {modality} models or services configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Models" value={num(modalityModels.length)} icon={<Brain className="h-4 w-4" />} tone="primary" />
        <StatCard label="Requests (window)" value={num(totalRequests)} icon={<Gauge className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Cost (window)" value={usd(totalCost)} icon={<DollarSign className="h-4 w-4" />} tone="amber" />
        <StatCard label="Avg quality / latency" value={`${avgQuality.toFixed(1)} · ${Math.round(avgLatency)}ms`} icon={<Layers className="h-4 w-4" />} tone="violet" />
      </div>

      <GlassCard title="Models" icon={<Brain className="h-4 w-4 text-primary" />}>
        {modalityModels.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">No models in this modality</p>
        ) : (
          <div className="space-y-3">
            {modalityModels.map((model) => (
              <div
                key={String(model['id'])}
                className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{String(model['name'])}</p>
                    {model['is_default'] ? (
                      <Badge variant="outline" className="border-status-success/40 bg-status-success/15 text-status-success">
                        <Star className="mr-1 h-3 w-3" /> default
                      </Badge>
                    ) : null}
                    <StatusBadge value={model['status'] as string} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{providerName(providers, model['provider_id'] as string | null)} · {String(model['model_id'])}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>In: {usd(model['input_cost_per_1k'] as number)}/1k</span>
                    <span>Out: {usd(model['output_cost_per_1k'] as number)}/1k</span>
                    <span>Context: {num(model['context_window'] as number)}</span>
                    <span>Latency: {num(model['latency_ms'] as number)}ms</span>
                    <span>Quality: {Number(model['quality_score'] ?? 0).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Boolean(model['is_default']) || updateModel.isPending}
                    onClick={() => setDefault(model)}
                  >
                    <Star className="mr-1 h-3.5 w-3.5" /> Set default
                  </Button>
                  <div className="flex items-center gap-2">
                    <Power className="h-3.5 w-3.5 text-muted-foreground" />
                    <Switch checked={model['status'] === "active"} onCheckedChange={() => toggleStatus(model)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {modalityServices.length > 0 ? (
        <GlassCard title="API services" icon={<Layers className="h-4 w-4 text-neon-cyan" />}>
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
                  <tr key={String(s['id'])} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3 font-medium text-foreground">{String(s['name'])}</td>
                    <td className="py-2 pr-3"><StatusBadge value={s['status'] as string} /></td>
                    <td className="py-2 pr-3"><StatusBadge value={s['health_status'] as string} /></td>
                    <td className="py-2 pr-3">{Number(s['uptime_pct'] ?? 0).toFixed(2)}%</td>
                    <td className="py-2 pr-3">{num(s['avg_latency_ms'] as number)}ms</td>
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

export default function AiApiScreen({ view }: ScreenProps) {
  const [tab, setTab] = useState<string>(() => {
    const found = MODALITY_TABS.find((t) => t.childId === view);
    return found ? found.id : "ai-openai";
  });
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

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
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI API Management" description="Providers, models and usage by modality" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="AI API Management" description="Providers, models and usage by modality" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [providers, models, services, usage] = many.data ?? [[], [], [], []];

  const totalModels = models?.length ?? 0;
  const activeModels = (models ?? []).filter((m) => m['status'] === "active").length;
  const totalCost = (usage ?? []).reduce((sum, u) => sum + Number(u['cost_usd'] ?? 0), 0);
  const totalProviders = providers?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI API Management"
        description="Manage AI providers, models and per-modality usage & cost"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="AI providers" value={num(totalProviders)} icon={<Brain className="h-4 w-4" />} tone="primary" />
        <StatCard label="Models (active)" value={`${num(activeModels)} / ${num(totalModels)}`} icon={<Power className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total spend" value={usd(totalCost)} icon={<DollarSign className="h-4 w-4" />} tone="amber" />
        <StatCard label="Modalities tracked" value={num(MODALITY_TABS.length)} icon={<Layers className="h-4 w-4" />} tone="violet" />
      </div>

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
            <div ref={(el) => { refs.current[t.id] = el; }}>
              <ModalitySection
                modality={t.modality}
                models={models ?? []}
                providers={providers ?? []}
                services={services ?? []}
                usage={usage ?? []}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
