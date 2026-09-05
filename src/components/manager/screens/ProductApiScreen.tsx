import { useMemo, useState } from "react";
import {
  Package,
  Power,
  PowerOff,
  DollarSign,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
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

import {
  useRecords,
  useManyRecords,
  useUpdateRecord,
  useInsertRecord,
  useDeleteRecord,
  type Row,
} from "@/lib/manager-queries";
import {
  PageHeader,
  GlassCard,
  StatCard,
  StatusBadge,
  QueryBoundary,
  LoadingBlock,
  ErrorState,
  EmptyState,
  usd,
  num,
} from "@/components/manager/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SUB_SECTIONS = [
  { id: "product-mapping", label: "Mapping" },
  { id: "product-enable", label: "Enable" },
  { id: "product-disable", label: "Disable" },
  { id: "product-cost", label: "Cost" },
  { id: "product-graph", label: "Graph" },
] as const;

type SubSectionId = (typeof SUB_SECTIONS)[number]["id"];

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

interface MappingEditState {
  id: string;
  plan: string;
  quota_monthly: string;
  notes: string;
}

export default function ProductApiScreen({ view }: { view?: string | undefined }) {
  const initial: SubSectionId = SUB_SECTIONS.some((s) => s.id === view)
    ? (view as SubSectionId)
    : "product-mapping";
  const [active, setActive] = useState<SubSectionId>(initial);

  const many = useManyRecords([
    { table: "product_apis", orderBy: "product", ascending: true, limit: 500 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 2000 },
  ]);

  const [productApis, apiServices, usageEvents] = (many.data ?? [[], [], []]) as [Row[], Row[], Row[]];

  const serviceMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of apiServices) m.set(String(s['id']), s);
    return m;
  }, [apiServices]);

  const rows = useMemo(
    () =>
      productApis.map(
        (r) =>
          ({
            ...r,
            __service: serviceMap.get(String(r['service_id'] ?? "")),
          }) as Row,
      ),
    [productApis, serviceMap],
  );

  const usageByProduct = useMemo(() => {
    const m = new Map<string, { requests: number; cost: number }>();
    for (const e of usageEvents) {
      const key = String(e['product'] ?? "Unknown");
      const cur = m.get(key) ?? { requests: 0, cost: 0 };
      cur.requests += Number(e['requests'] ?? 0);
      cur.cost += Number(e['cost_usd'] ?? 0);
      m.set(key, cur);
    }
    return m;
  }, [usageEvents]);

  const chartData = useMemo(() => {
    return Array.from(usageByProduct.entries())
      .map(([product, v]) => ({ product, requests: v.requests, cost: Number(v.cost.toFixed(2)) }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 12);
  }, [usageByProduct]);

  const update = useUpdateRecord("Product API updated");
  const insert = useInsertRecord("Mapping created");
  const remove = useDeleteRecord("Mapping removed");

  const [editState, setEditState] = useState<MappingEditState | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    product: "",
    service_id: "",
    plan: "standard",
    quota_monthly: "10000",
    notes: "",
  });

  const totalCost = Array.from(usageByProduct.values()).reduce((a, b) => a + b.cost, 0);
  const totalMappings = rows.length;
  const enabledCount = rows.filter((r) => r['enabled']).length;
  const disabledCount = totalMappings - enabledCount;

  function toggleEnabled(row: Row, enabled: boolean) {
    update.mutate({ table: "product_apis", id: String(row['id']), values: { enabled } });
  }

  function bulkSetForProduct(product: string, enabled: boolean) {
    const targets = rows.filter((r) => r['product'] === product);
    for (const t of targets) {
      update.mutate({ table: "product_apis", id: String(t['id']), values: { enabled } });
    }
  }

  function openEdit(row: Row) {
    setEditState({
      id: String(row['id']),
      plan: String(row['plan'] ?? ""),
      quota_monthly: String(row['quota_monthly'] ?? "0"),
      notes: String(row['notes'] ?? ""),
    });
  }

  function saveEdit() {
    if (!editState) return;
    update.mutate({
      table: "product_apis",
      id: editState.id,
      values: {
        plan: editState.plan,
        quota_monthly: Number(editState.quota_monthly) || 0,
        notes: editState.notes,
      },
    });
    setEditState(null);
  }

  function submitAdd() {
    if (!addForm.product || !addForm.service_id) return;
    insert.mutate({
      table: "product_apis",
      values: {
        product: addForm.product,
        service_id: addForm.service_id,
        plan: addForm.plan,
        quota_monthly: Number(addForm.quota_monthly) || 0,
        used_this_month: 0,
        enabled: true,
        notes: addForm.notes || null,
      },
    });
    setAddOpen(false);
    setAddForm({ product: "", service_id: "", plan: "standard", quota_monthly: "10000", notes: "" });
  }

  const productGroups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const key = String(r['product'] ?? "Unknown");
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return Array.from(m.entries());
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product-wise API Control"
        description="Manage API access, quotas and costs per product"
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Mapping
          </Button>
        }
      />

      <Tabs value={active} onValueChange={(v) => setActive(v as SubSectionId)}>
        <TabsList className="flex-wrap">
          {SUB_SECTIONS.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Mappings" value={num(totalMappings)} icon={<Package className="h-4 w-4" />} tone="primary" loading={many.isLoading} />
        <StatCard label="Enabled" value={num(enabledCount)} icon={<Power className="h-4 w-4" />} tone="green" loading={many.isLoading} />
        <StatCard label="Disabled" value={num(disabledCount)} icon={<PowerOff className="h-4 w-4" />} tone="red" loading={many.isLoading} />
        <StatCard label="Total Cost (30d events)" value={usd(totalCost)} icon={<DollarSign className="h-4 w-4" />} tone="cyan" loading={many.isLoading} />
      </div>

      {many.isLoading ? (
        <LoadingBlock rows={6} />
      ) : many.error ? (
        <ErrorState error={many.error} />
      ) : (
        <>
          {active === "product-mapping" ? (
            <GlassCard title="Product → API Mapping" icon={<Package className="h-4 w-4 text-primary" />}>
              {productGroups.length === 0 ? (
                <EmptyState message="No product mappings yet" />
              ) : (
                <div className="space-y-6">
                  {productGroups.map(([product, list]) => (
                    <div key={product} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{product}</h3>
                        <span className="text-xs text-muted-foreground">{list.length} APIs</span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Quota Usage</TableHead>
                            <TableHead>Enabled</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map((row) => {
                            const svc = row['__service'] as Row | undefined;
                            const used = Number(row['used_this_month'] ?? 0);
                            const quota = Number(row['quota_monthly'] ?? 0);
                            const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
                            return (
                              <TableRow key={String(row['id'])}>
                                <TableCell className="font-medium text-foreground">
                                  {svc ? String(svc['name']) : "Unknown Service"}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="capitalize">{String(row['plan'] ?? "—")}</Badge>
                                </TableCell>
                                <TableCell className="min-w-[160px]">
                                  <div className="space-y-1">
                                    <Progress value={pct} className="h-2" />
                                    <p className="text-xs text-muted-foreground">
                                      {num(used)} / {num(quota)}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Switch
                                    checked={Boolean(row['enabled'])}
                                    onCheckedChange={(checked) => toggleEnabled(row, checked)}
                                  />
                                </TableCell>
                                <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                                  {row['notes'] ? String(row['notes']) : "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(row)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 text-status-error"
                                      onClick={() => remove.mutate({ table: "product_apis", id: String(row['id']) })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          ) : null}

          {active === "product-enable" ? (
            <GlassCard title="Bulk Enable" icon={<Power className="h-4 w-4 text-status-success" />}>
              {productGroups.length === 0 ? (
                <EmptyState message="No products found" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {productGroups.map(([product, list]) => {
                    const allEnabled = list.every((r) => r['enabled']);
                    return (
                      <div key={product} className="rounded-lg border border-border/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium text-foreground">{product}</p>
                          <Badge variant="outline">{list.length} APIs</Badge>
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          {list.filter((r) => r['enabled']).length} of {list.length} currently enabled
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          disabled={allEnabled}
                          onClick={() => bulkSetForProduct(product, true)}
                        >
                          <Power className="mr-2 h-4 w-4" />
                          Enable All
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          ) : null}

          {active === "product-disable" ? (
            <GlassCard title="Bulk Disable" icon={<PowerOff className="h-4 w-4 text-status-error" />}>
              {productGroups.length === 0 ? (
                <EmptyState message="No products found" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {productGroups.map(([product, list]) => {
                    const allDisabled = list.every((r) => !r['enabled']);
                    return (
                      <div key={product} className="rounded-lg border border-border/50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-medium text-foreground">{product}</p>
                          <Badge variant="outline">{list.length} APIs</Badge>
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          {list.filter((r) => r['enabled']).length} of {list.length} currently enabled
                        </p>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          disabled={allDisabled}
                          onClick={() => bulkSetForProduct(product, false)}
                        >
                          <PowerOff className="mr-2 h-4 w-4" />
                          Disable All
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          ) : null}

          {active === "product-cost" ? (
            <GlassCard title="Cost Breakdown by Product" icon={<DollarSign className="h-4 w-4 text-neon-cyan" />}>
              {chartData.length === 0 ? (
                <EmptyState message="No usage events recorded yet" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chartData.map((row) => (
                      <TableRow key={row.product}>
                        <TableCell className="font-medium text-foreground">{row.product}</TableCell>
                        <TableCell className="text-right">{num(row.requests)}</TableCell>
                        <TableCell className="text-right">{usd(row.cost)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {totalCost > 0 ? `${((row.cost / totalCost) * 100).toFixed(1)}%` : "0%"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>
          ) : null}

          {active === "product-graph" ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <GlassCard title="Requests by Product" icon={<BarChart3 className="h-4 w-4 text-primary" />}>
                {chartData.length === 0 ? (
                  <EmptyState message="No usage data" />
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="requests" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>
              <GlassCard title="Cost Trend by Product" icon={<BarChart3 className="h-4 w-4 text-neon-cyan" />}>
                {chartData.length === 0 ? (
                  <EmptyState message="No usage data" />
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="product" stroke="hsl(var(--muted-foreground))" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Area type="monotone" dataKey="cost" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.25} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlassCard>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={editState !== null} onOpenChange={(open) => !open && setEditState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Mapping</DialogTitle>
          </DialogHeader>
          {editState ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Input value={editState.plan} onChange={(e) => setEditState({ ...editState, plan: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly Quota</Label>
                <Input
                  type="number"
                  value={editState.quota_monthly}
                  onChange={(e) => setEditState({ ...editState, quota_monthly: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={editState.notes} onChange={(e) => setEditState({ ...editState, notes: e.target.value })} />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={update.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product Mapping</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Product</Label>
              <Input value={addForm.product} onChange={(e) => setAddForm({ ...addForm, product: e.target.value })} placeholder="e.g. CRM System" />
            </div>
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={addForm.service_id} onValueChange={(v) => setAddForm({ ...addForm, service_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {apiServices.map((s) => (
                    <SelectItem key={String(s['id'])} value={String(s['id'])}>
                      {String(s['name'])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Input value={addForm.plan} onChange={(e) => setAddForm({ ...addForm, plan: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Monthly Quota</Label>
              <Input type="number" value={addForm.quota_monthly} onChange={(e) => setAddForm({ ...addForm, quota_monthly: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={insert.isPending || !addForm.product || !addForm.service_id}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
