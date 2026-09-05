import { useMemo, useState } from "react";
import {
  Building2,
  Clock,
  DollarSign,
  Download,
  FileText,
  Package,
  PieChart as PieChartIcon,
  Plug,
  Plus,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useInsertRecord, useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
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

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function n(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

const SUBSECTIONS = [
  "billing-api",
  "billing-product",
  "billing-role",
  "billing-daily",
  "billing-monthly",
  "billing-invoice",
  "billing-allocation",
];

export default function BillingScreen({ view }: { view?: string | undefined }) {
  const tab = view && SUBSECTIONS.includes(view) ? view : "billing-api";
  const [activeTab, setActiveTab] = useState(tab);

  const many = useManyRecords([
    { table: "billing_plans", orderBy: "created_at", ascending: false, limit: 100 },
    { table: "invoices", orderBy: "issued_at", ascending: false, limit: 200 },
    { table: "usage_daily", orderBy: "day", ascending: true, limit: 1000 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 1000 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 200 },
    { table: "product_apis", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "role_api_permissions", orderBy: "created_at", ascending: false, limit: 200 },
  ]);

  if (many.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing Engine" description="Complete billing breakdown by API, product, and role" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (many.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing Engine" description="Complete billing breakdown by API, product, and role" />
        <ErrorState error={many.error} />
      </div>
    );
  }

  const [plans, invoices, usageDaily, usageEvents, services, productApis, rolePerms] = many.data ?? [
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  ];

  return (
    <BillingContent
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      plans={plans ?? []}
      invoices={invoices ?? []}
      usageDaily={usageDaily ?? []}
      usageEvents={usageEvents ?? []}
      services={services ?? []}
      productApis={productApis ?? []}
      rolePerms={rolePerms ?? []}
    />
  );
}

function BillingContent({
  activeTab,
  setActiveTab,
  plans,
  invoices,
  usageDaily,
  usageEvents,
  services,
  productApis,
  rolePerms,
}: {
  activeTab: string;
  setActiveTab: (v: string) => void;
  plans: Row[];
  invoices: Row[];
  usageDaily: Row[];
  usageEvents: Row[];
  services: Row[];
  productApis: Row[];
  rolePerms: Row[];
}) {
  const serviceById = useMemo(() => new Map(services.map((s) => [s['id'], s])), [services]);

  const totalCostToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return usageDaily.filter((u) => String(u['day']).slice(0, 10) === today).reduce((s, u) => s + n(u, "cost_usd"), 0);
  }, [usageDaily]);

  const totalCostWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    return usageDaily
      .filter((u) => new Date(String(u['day'])).getTime() >= cutoff)
      .reduce((s, u) => s + n(u, "cost_usd"), 0);
  }, [usageDaily]);

  const totalCostMonth = useMemo(() => {
    const now = new Date();
    return usageDaily
      .filter((u) => {
        const d = new Date(String(u['day']));
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, u) => s + n(u, "cost_usd"), 0);
  }, [usageDaily]);

  const pendingInvoices = invoices.filter((i) => i['status'] !== "paid").length;

  const apiBilling = useMemo(() => {
    const map = new Map<string, { name: string; requests: number; cost: number }>();
    for (const u of usageDaily) {
      const svc = serviceById.get(u['service_id']) as Row | undefined;
      const key = (u['service_id'] as string) ?? "unknown";
      const name = svc ? String(svc['name']) : "Unknown Service";
      const existing = map.get(key) ?? { name, requests: 0, cost: 0 };
      existing.requests += n(u, "requests");
      existing.cost += n(u, "cost_usd");
      map.set(key, existing);
    }
    const rows = [...map.values()].sort((a, b) => b.cost - a.cost);
    const total = rows.reduce((s, r) => s + r.cost, 0) || 1;
    return rows.map((r) => ({ ...r, percentage: Math.round((r.cost / total) * 100) }));
  }, [usageDaily, serviceById]);

  const productBilling = useMemo(() => {
    const map = new Map<string, { name: string; cost: number; requests: number; apis: Set<string> }>();
    for (const e of usageEvents) {
      const key = String(e['product'] ?? "Unassigned");
      const existing = map.get(key) ?? { name: key, cost: 0, requests: 0, apis: new Set<string>() };
      existing.cost += n(e, "cost_usd");
      existing.requests += n(e, "requests");
      if (e['service_id']) existing.apis.add(String(e['service_id']));
      map.set(key, existing);
    }
    const rows = [...map.values()].sort((a, b) => b.cost - a.cost);
    const total = rows.reduce((s, r) => s + r.cost, 0) || 1;
    return rows.map((r) => ({
      name: r.name,
      cost: r.cost,
      requests: r.requests,
      apis: r.apis.size,
      percentage: Math.round((r.cost / total) * 100),
    }));
  }, [usageEvents]);

  const roleBilling = useMemo(() => {
    // Distribute each service's total cost proportionally across roles that
    // have access to it, weighted by their configured per-minute rate limit.
    const serviceCost = new Map<string, number>();
    for (const u of usageDaily) {
      const key = String(u['service_id'] ?? "");
      serviceCost.set(key, (serviceCost.get(key) ?? 0) + n(u, "cost_usd"));
    }
    const permsByService = new Map<string, Row[]>();
    for (const p of rolePerms) {
      const key = String(p['service_id'] ?? "");
      const arr = permsByService.get(key) ?? [];
      arr.push(p);
      permsByService.set(key, arr);
    }
    const roleMap = new Map<string, { name: string; cost: number; services: Set<string> }>();
    for (const [serviceId, cost] of serviceCost.entries()) {
      const perms = permsByService.get(serviceId) ?? [];
      const totalWeight = perms.reduce((s, p) => s + Math.max(1, n(p, "rate_limit_per_min")), 0) || 1;
      for (const p of perms) {
        const weight = Math.max(1, n(p, "rate_limit_per_min"));
        const share = cost * (weight / totalWeight);
        const roleName = String(p['role_name']);
        const existing = roleMap.get(roleName) ?? { name: roleName, cost: 0, services: new Set<string>() };
        existing.cost += share;
        existing.services.add(serviceId);
        roleMap.set(roleName, existing);
      }
    }
    const rows = [...roleMap.values()].sort((a, b) => b.cost - a.cost);
    const total = rows.reduce((s, r) => s + r.cost, 0) || 1;
    return rows.map((r) => ({
      name: r.name,
      cost: r.cost,
      services: r.services.size,
      percentage: Math.round((r.cost / total) * 100),
    }));
  }, [usageDaily, rolePerms]);

  const dailySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of usageDaily) {
      const key = String(u['day']).slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + n(u, "cost_usd"));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([d, cost]) => ({ date: day(d), cost }));
  }, [usageDaily]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of usageDaily) {
      const d = new Date(String(u['day']));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + n(u, "cost_usd"));
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, cost]) => ({ month, cost }));
  }, [usageDaily]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing Engine"
        description="Complete billing breakdown by API, product, and role"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadRows(
                "billing-api.csv",
                apiBilling.map((r) => ({ api: r.name, requests: r.requests, cost_usd: r.cost.toFixed(2) })),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Billing" value={usd(totalCostToday)} icon={<Clock className="h-4 w-4" />} tone="cyan" />
        <StatCard label="This Week" value={usd(totalCostWeek)} icon={<Clock className="h-4 w-4" />} tone="violet" />
        <StatCard label="This Month" value={usd(totalCostMonth)} icon={<Clock className="h-4 w-4" />} tone="green" />
        <StatCard label="Pending Invoices" value={pendingInvoices} icon={<FileText className="h-4 w-4" />} tone="amber" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="billing-api">Per API</TabsTrigger>
          <TabsTrigger value="billing-product">Per Product</TabsTrigger>
          <TabsTrigger value="billing-role">Per Role</TabsTrigger>
          <TabsTrigger value="billing-daily">Daily</TabsTrigger>
          <TabsTrigger value="billing-monthly">Monthly</TabsTrigger>
          <TabsTrigger value="billing-invoice">Invoices & Plans</TabsTrigger>
          <TabsTrigger value="billing-allocation">Allocation</TabsTrigger>
        </TabsList>

        <TabsContent value="billing-api">
          <GlassCard title="Per API Billing" icon={<Plug className="h-4 w-4 text-primary" />}>
            {apiBilling.length === 0 ? (
              <EmptyState message="No usage data yet" />
            ) : (
              <BreakdownList
                rows={apiBilling.map((r) => ({ name: r.name, cost: r.cost, percentage: r.percentage, sub: `${r.requests.toLocaleString("en-US")} requests` }))}
              />
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="billing-product">
          <GlassCard title="Per Product Billing" icon={<Package className="h-4 w-4 text-primary" />}>
            {productBilling.length === 0 ? (
              <EmptyState message="No product usage events yet" />
            ) : (
              <BreakdownList
                rows={productBilling.map((r) => ({
                  name: r.name,
                  cost: r.cost,
                  percentage: r.percentage,
                  sub: `${r.apis} APIs · ${r.requests.toLocaleString("en-US")} requests`,
                }))}
              />
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="billing-role">
          <GlassCard title="Per Role Billing" icon={<Users className="h-4 w-4 text-primary" />}>
            {roleBilling.length === 0 ? (
              <EmptyState message="No role permissions configured yet" />
            ) : (
              <>
                <BreakdownList
                  rows={roleBilling.map((r) => ({
                    name: r.name,
                    cost: r.cost,
                    percentage: r.percentage,
                    sub: `${r.services} services accessible`,
                  }))}
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  Estimated by distributing each service's cost across roles proportional to their configured rate
                  limits in Role API Permissions.
                </p>
              </>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="billing-daily">
          <GlassCard title="Daily Cost Summary" icon={<TrendingUp className="h-4 w-4 text-primary" />}>
            {dailySummary.length === 0 ? (
              <EmptyState message="No daily usage recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={dailySummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => usd(v)}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="billing-monthly">
          <GlassCard title="Monthly Cost Summary" icon={<TrendingUp className="h-4 w-4 text-primary" />}>
            {monthlySummary.length === 0 ? (
              <EmptyState message="No monthly usage recorded yet" />
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <LineChart data={monthlySummary}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RTooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    formatter={(v: number) => usd(v)}
                  />
                  <Line type="monotone" dataKey="cost" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="billing-invoice" className="space-y-6">
          <InvoicesPanel invoices={invoices} usageDaily={usageDaily} plans={plans} />
          <PlansPanel plans={plans} />
        </TabsContent>

        <TabsContent value="billing-allocation">
          <AllocationPanel productBilling={productBilling} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BreakdownList({
  rows,
}: {
  rows: Array<{ name: string; cost: number; percentage: number; sub: string }>;
}) {
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.name} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{r.name}</p>
            <p className="text-sm font-bold text-foreground">{usd(r.cost)}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, r.percentage)}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{r.percentage}%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{r.sub}</p>
        </div>
      ))}
    </div>
  );
}

function InvoicesPanel({ invoices, usageDaily, plans }: { invoices: Row[]; usageDaily: Row[]; plans: Row[] }) {
  const update = useUpdateRecord("Invoice updated");
  const insert = useInsertRecord("Invoice generated");
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [providerId, setProviderId] = useState<string>("none");

  const generateInvoice = () => {
    if (!periodStart || !periodEnd) return;
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    const amount = usageDaily
      .filter((u) => {
        const t = new Date(String(u['day'])).getTime();
        return t >= start && t <= end;
      })
      .reduce((s, u) => s + n(u, "cost_usd"), 0);
    const tax = amount * 0.18;
    insert.mutate({
      table: "invoices",
      values: {
        invoice_number: `INV-${Date.now()}`,
        provider_id: providerId === "none" ? null : providerId,
        period_start: periodStart,
        period_end: periodEnd,
        issued_at: new Date().toISOString(),
        due_at: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
        amount_usd: Number(amount.toFixed(2)),
        tax_usd: Number(tax.toFixed(2)),
        status: "pending",
      },
    });
    setOpen(false);
    setPeriodStart("");
    setPeriodEnd("");
  };

  return (
    <GlassCard
      title="Invoices"
      icon={<Receipt className="h-4 w-4 text-primary" />}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadRows("invoices.csv", invoices)}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Generate Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="period-start">Period Start</Label>
                  <Input id="period-start" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="period-end">Period End</Label>
                  <Input id="period-end" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Provider (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p['id'] as string} value={String(p['provider_id'] ?? p['id'])}>
                          {String(p['name'])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={generateInvoice} disabled={!periodStart || !periodEnd}>
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {invoices.length === 0 ? (
        <EmptyState message="No invoices yet" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv['id'] as string}>
                  <TableCell className="text-sm font-medium">{String(inv['invoice_number'])}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {day(inv['period_start'] as string | null)} – {day(inv['period_end'] as string | null)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{when(inv['issued_at'] as string | null)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{usd(n(inv, "amount_usd"))}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{usd(n(inv, "tax_usd"))}</TableCell>
                  <TableCell>
                    <StatusBadge value={inv['status'] as string} />
                  </TableCell>
                  <TableCell className="text-right">
                    {inv['status'] !== "paid" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => update.mutate({ table: "invoices", id: inv['id'] as string, values: { status: "paid", paid_at: new Date().toISOString() } })}
                      >
                        Mark Paid
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Paid {day(inv['paid_at'] as string | null)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </GlassCard>
  );
}

function PlansPanel({ plans }: { plans: Row[] }) {
  const update = useUpdateRecord("Plan updated");
  const [editing, setEditing] = useState<Record<string, { fee: string; included: string; overage: string }>>({});

  const startEdit = (p: Row) => {
    setEditing((prev) => ({
      ...prev,
      [p['id'] as string]: {
        fee: String(n(p, "monthly_fee")),
        included: String(n(p, "included_requests")),
        overage: String(n(p, "overage_per_1k")),
      },
    }));
  };

  const save = (id: string) => {
    const values = editing[id];
    if (!values) return;
    update.mutate({
      table: "billing_plans",
      id,
      values: {
        monthly_fee: Number(values.fee) || 0,
        included_requests: Number(values.included) || 0,
        overage_per_1k: Number(values.overage) || 0,
      },
    });
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <GlassCard title="Billing Plans" icon={<DollarSign className="h-4 w-4 text-primary" />}>
      {plans.length === 0 ? (
        <EmptyState message="No billing plans configured" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Monthly Fee</TableHead>
                <TableHead className="text-right">Included Requests</TableHead>
                <TableHead className="text-right">Overage / 1k</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => {
                const id = p['id'] as string;
                const edit = editing[id];
                return (
                  <TableRow key={id}>
                    <TableCell className="text-sm font-medium">{String(p['name'])}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">{String(p['billing_cycle'])}</TableCell>
                    <TableCell className="text-right">
                      {edit ? (
                        <Input
                          className="ml-auto h-8 w-24"
                          value={edit.fee}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [id]: { ...edit, fee: e.target.value } }))}
                        />
                      ) : (
                        <span className="text-sm">{usd(n(p, "monthly_fee"))}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {edit ? (
                        <Input
                          className="ml-auto h-8 w-24"
                          value={edit.included}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [id]: { ...edit, included: e.target.value } }))}
                        />
                      ) : (
                        <span className="text-sm">{n(p, "included_requests").toLocaleString("en-US")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {edit ? (
                        <Input
                          className="ml-auto h-8 w-24"
                          value={edit.overage}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [id]: { ...edit, overage: e.target.value } }))}
                        />
                      ) : (
                        <span className="text-sm">{usd(n(p, "overage_per_1k"))}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={p['status'] as string} />
                    </TableCell>
                    <TableCell className="text-right">
                      {edit ? (
                        <Button size="sm" onClick={() => save(id)}>
                          Save
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                          Edit
                        </Button>
                      )}
                    </TableCell>
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

function AllocationPanel({ productBilling }: { productBilling: Array<{ name: string; cost: number; percentage: number }> }) {
  const chartData = productBilling.map((p) => ({ name: p.name, value: Number(p.cost.toFixed(2)) }));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <GlassCard title="Spend Allocation by Product/Team" icon={<PieChartIcon className="h-4 w-4 text-primary" />}>
        {chartData.length === 0 ? (
          <EmptyState message="No spend data yet" />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <RTooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: number) => usd(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </GlassCard>
      <GlassCard title="Allocation Breakdown" icon={<Building2 className="h-4 w-4 text-primary" />}>
        {productBilling.length === 0 ? (
          <EmptyState message="No spend data yet" />
        ) : (
          <div className="space-y-2">
            {productBilling.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-sm text-foreground">{p.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{p.percentage}%</Badge>
                  <span className="text-sm font-semibold text-foreground">{usd(p.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
