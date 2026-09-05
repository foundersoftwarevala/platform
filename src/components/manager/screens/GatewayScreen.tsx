import { useMemo, useState } from "react";
import {
  Clock,
  Database,
  DollarSign,
  Download,
  GitBranch,
  HardDrive,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  useDeleteRecord,
  useManyRecords,
  useUpdateRecord,
  type Row,
} from "@/lib/manager-queries";
import {
  downloadRows,
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatCard,
  StatusBadge,
  num,
  usd,
  when,
} from "@/components/manager/primitives";

const SUBSECTIONS = ["gw-router", "gw-cache", "gw-failover"];

function FlowStrip({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
      {steps.map((step, i) => (
        <span key={step} className="flex items-center gap-2">
          <span className="rounded-md border border-border/60 bg-secondary/40 px-3 py-1.5 font-medium text-foreground">
            {step}
          </span>
          {i < steps.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </span>
      ))}
    </div>
  );
}

export default function GatewayScreen({ view }: { view?: string | undefined }) {
  const initial = view && SUBSECTIONS.includes(view) ? view : "gw-router";
  const [activeTab, setActiveTab] = useState(initial);

  const many = useManyRecords([
    { table: "router_rules", orderBy: "sort_order", ascending: true, limit: 200 },
    { table: "cache_entries", orderBy: "hits", ascending: false, limit: 500 },
    { table: "failover_events", orderBy: "occurred_at", ascending: false, limit: 500 },
  ]);

  const updateRule = useUpdateRecord("Routing rule updated");
  const dropCacheEntry = useDeleteRecord("Cache entry cleared");

  const [rules = [], cache = [], failovers = []] = many.data ?? [];

  const cacheStats = useMemo(() => {
    const hits = cache.reduce((s, r) => s + Number(r['hits'] ?? 0), 0);
    const saved = cache.reduce((s, r) => s + Number(r['cost_saved_usd'] ?? 0), 0);
    const size = cache.reduce((s, r) => s + Number(r['size_kb'] ?? 0), 0);
    return { hits, saved, size, entries: cache.length };
  }, [cache]);

  const failStats = useMemo(() => {
    const dayAgo = Date.now() - 86_400_000;
    const today = failovers.filter((f) => new Date(String(f['occurred_at'])).getTime() >= dayAgo);
    const ok = failovers.filter((f) => f['result'] === "success").length;
    const avg =
      failovers.length > 0
        ? failovers.reduce((s, f) => s + Number(f['extra_latency_ms'] ?? 0), 0) / failovers.length
        : 0;
    return {
      today: today.length,
      recovery: failovers.length > 0 ? Math.round((ok / failovers.length) * 100) : 100,
      avgLatency: avg,
    };
  }, [failovers]);

  const header = (
    <PageHeader
      title="Gateway Engine"
      description="Request routing, response caching and automatic provider failover"
    />
  );

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState error={many.error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="gw-router">Request Router</TabsTrigger>
          <TabsTrigger value="gw-cache">Response Cache</TabsTrigger>
          <TabsTrigger value="gw-failover">Failover System</TabsTrigger>
        </TabsList>

        {/* ── Request Router ───────────────────────────── */}
        <TabsContent value="gw-router" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Routing Rules" value={num(rules.length)} icon={<GitBranch className="h-4 w-4" />} />
            <StatCard
              label="Active Rules"
              value={num(rules.filter((r) => r['active']).length)}
              icon={<Zap className="h-4 w-4" />}
              tone="green"
            />
            <StatCard
              label="Matches (30d)"
              value={num(rules.reduce((s, r) => s + Number(r['matches_30d'] ?? 0), 0))}
              icon={<Database className="h-4 w-4" />}
              tone="cyan"
            />
            <StatCard
              label="High Priority"
              value={num(rules.filter((r) => r['priority'] === "high").length)}
              icon={<Zap className="h-4 w-4" />}
              tone="amber"
            />
          </div>

          <GlassCard>
            <FlowStrip
              steps={["User Prompt", "API Manager", "Rule Matching", "Model Selection", "AI Response"]}
            />
          </GlassCard>

          <GlassCard
            title="Routing Rules"
            icon={<GitBranch className="h-4 w-4 text-primary" />}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadRows("routing-rules.csv", rules)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            }
          >
            {rules.length === 0 ? (
              <EmptyState message="No routing rules configured" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Pattern</TableHead>
                      <TableHead>Target Model</TableHead>
                      <TableHead>Fallback</TableHead>
                      <TableHead className="text-right">Matches (30d)</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((rule: Row) => (
                      <TableRow key={String(rule['id'])}>
                        <TableCell className="font-medium text-foreground">
                          <span className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-primary" />
                            {String(rule['name'])}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {String(rule['pattern'])}
                        </TableCell>
                        <TableCell>{String(rule['target_model'])}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {rule['fallback_model'] ? String(rule['fallback_model']) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {num(Number(rule['matches_30d'] ?? 0))}
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={String(rule['priority'])} />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={Boolean(rule['active'])}
                            onCheckedChange={(checked) =>
                              updateRule.mutate({
                                table: "router_rules",
                                id: String(rule['id']),
                                values: { active: checked },
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {/* ── Response Cache ───────────────────────────── */}
        <TabsContent value="gw-cache" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Cached Entries"
              value={num(cacheStats.entries)}
              icon={<Database className="h-4 w-4" />}
            />
            <StatCard
              label="Total Hits"
              value={num(cacheStats.hits)}
              icon={<Zap className="h-4 w-4" />}
              tone="cyan"
            />
            <StatCard
              label="Cost Saved"
              value={usd(cacheStats.saved)}
              icon={<DollarSign className="h-4 w-4" />}
              tone="green"
            />
            <StatCard
              label="Cache Size"
              value={`${cacheStats.size.toFixed(1)} KB`}
              icon={<HardDrive className="h-4 w-4" />}
              tone="violet"
            />
          </div>

          <GlassCard>
            <FlowStrip steps={["Prompt", "Hash Check", "Cache Hit?", "Return / Call API"]} />
          </GlassCard>

          <GlassCard
            title="Cached Responses"
            icon={<Database className="h-4 w-4 text-primary" />}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadRows("cache-entries.csv", cache)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            }
          >
            {cache.length === 0 ? (
              <EmptyState message="Cache is empty" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cache Key</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Hits</TableHead>
                      <TableHead className="text-right">Cost Saved</TableHead>
                      <TableHead>TTL</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead>Last Hit</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cache.map((entry: Row) => (
                      <TableRow key={String(entry['id'])}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {String(entry['cache_key'])}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {String(entry['model'])}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {num(Number(entry['hits'] ?? 0))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-status-success">
                          {usd(Number(entry['cost_saved_usd'] ?? 0))}
                        </TableCell>
                        <TableCell>{Number(entry['ttl_hours'] ?? 0)}h</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(entry['size_kb'] ?? 0).toFixed(1)} KB
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {when(entry['last_hit_at'] as string | null)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Clear cache entry"
                            onClick={() =>
                              dropCacheEntry.mutate({
                                table: "cache_entries",
                                id: String(entry['id']),
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5 text-status-error" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassCard>
        </TabsContent>

        {/* ── Failover ─────────────────────────────────── */}
        <TabsContent value="gw-failover" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Failovers (24h)"
              value={num(failStats.today)}
              icon={<RefreshCw className="h-4 w-4" />}
              tone="amber"
            />
            <StatCard
              label="Recovery Rate"
              value={`${failStats.recovery}%`}
              icon={<Zap className="h-4 w-4" />}
              tone="green"
            />
            <StatCard
              label="Avg Extra Latency"
              value={`+${(failStats.avgLatency / 1000).toFixed(2)}s`}
              icon={<Clock className="h-4 w-4" />}
              tone="violet"
            />
          </div>

          <GlassCard>
            <FlowStrip steps={["Primary Fails", "Detect Error", "Switch Provider", "Return Response"]} />
          </GlassCard>

          <GlassCard
            title="Recent Failover Events"
            icon={<RefreshCw className="h-4 w-4 text-primary" />}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadRows("failover-events.csv", failovers)}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Export
              </Button>
            }
          >
            {failovers.length === 0 ? (
              <EmptyState message="No failover events recorded" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Primary</TableHead>
                      <TableHead>Failover To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Extra Latency</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failovers.map((event: Row) => (
                      <TableRow key={String(event['id'])}>
                        <TableCell className="text-xs text-muted-foreground">
                          {when(event['occurred_at'] as string)}
                        </TableCell>
                        <TableCell className="text-status-error">{String(event['from_model'])}</TableCell>
                        <TableCell className="text-status-success">{String(event['to_model'])}</TableCell>
                        <TableCell className="text-muted-foreground">{String(event['reason'])}</TableCell>
                        <TableCell className="text-right font-mono text-status-warning">
                          +{(Number(event['extra_latency_ms'] ?? 0) / 1000).toFixed(2)}s
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={String(event['result'])} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
