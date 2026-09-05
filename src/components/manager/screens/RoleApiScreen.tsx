import { useMemo, useState } from "react";
import {
  Shield,
  Users,
  Cpu,
  Gauge,
  Plus,
  Trash2,
  Activity,
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

import {
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
  LoadingBlock,
  ErrorState,
  EmptyState,
  num,
} from "@/components/manager/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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

const ROLES = [
  { id: "role-admin", label: "Admin", role: "admin", icon: Shield, tone: "text-status-error" },
  { id: "role-reseller", label: "Reseller", role: "reseller", icon: Users, tone: "text-neon-cyan" },
  { id: "role-franchise", label: "Franchise", role: "franchise", icon: Users, tone: "text-primary" },
  { id: "role-developer", label: "Developer", role: "developer", icon: Cpu, tone: "text-status-success" },
  { id: "role-user", label: "User", role: "user", icon: Users, tone: "text-muted-foreground" },
] as const;

type RoleTabId = (typeof ROLES)[number]["id"];

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

export default function RoleApiScreen({ view }: { view?: string | undefined }) {
  const initial: RoleTabId = ROLES.some((r) => r.id === view) ? (view as RoleTabId) : "role-admin";
  const [active, setActive] = useState<RoleTabId>(initial);

  const many = useManyRecords([
    { table: "role_api_permissions", orderBy: "role_name", ascending: true, limit: 500 },
    { table: "api_services", orderBy: "name", ascending: true, limit: 500 },
    { table: "usage_events", orderBy: "occurred_at", ascending: false, limit: 2000 },
  ]);

  const [perms, apiServices, usageEvents] = (many.data ?? [[], [], []]) as [Row[], Row[], Row[]];

  const serviceMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const s of apiServices) m.set(String(s['id']), s);
    return m;
  }, [apiServices]);

  const activeRole = ROLES.find((r) => r.id === active) ?? ROLES[0]!;

  const rolePerms = useMemo(
    () =>
      perms
        .filter((p) => String(p['role_name']).toLowerCase() === activeRole.role)
        .map((p) => ({ ...p, __service: serviceMap.get(String(p['service_id'] ?? "")) }) as Row),
    [perms, serviceMap, activeRole],
  );

  const trafficByRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of usageEvents) {
      const key = String(e['source'] ?? "unknown").toLowerCase();
      m.set(key, (m.get(key) ?? 0) + Number(e['requests'] ?? 0));
    }
    return m;
  }, [usageEvents]);

  const chartData = useMemo(
    () =>
      ROLES.map((r) => ({
        role: r.label,
        traffic: trafficByRole.get(r.role) ?? 0,
        services: perms.filter((p) => String(p['role_name']).toLowerCase() === r.role).length,
      })),
    [trafficByRole, perms],
  );

  const update = useUpdateRecord("Permission updated");
  const insert = useInsertRecord("Access granted");
  const remove = useDeleteRecord("Access revoked");

  const [grantOpen, setGrantOpen] = useState(false);
  const [grantServiceId, setGrantServiceId] = useState("");
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const totalRoleServices = rolePerms.length;
  const readable = rolePerms.filter((p) => p['can_read']).length;
  const writable = rolePerms.filter((p) => p['can_write']).length;
  const admins = rolePerms.filter((p) => p['can_admin']).length;
  const roleTraffic = trafficByRole.get(activeRole.role) ?? 0;

  function togglePermission(row: Row, field: "can_read" | "can_write" | "can_admin", value: boolean) {
    update.mutate({ table: "role_api_permissions", id: String(row['id']), values: { [field]: value } });
  }

  function commitRate(row: Row, value: number) {
    update.mutate({ table: "role_api_permissions", id: String(row['id']), values: { rate_limit_per_min: value } });
  }

  function submitGrant() {
    if (!grantServiceId) return;
    insert.mutate({
      table: "role_api_permissions",
      values: {
        role_name: activeRole.role,
        service_id: grantServiceId,
        can_read: true,
        can_write: false,
        can_admin: false,
        rate_limit_per_min: 60,
      },
    });
    setGrantOpen(false);
    setGrantServiceId("");
  }

  const availableServices = useMemo(
    () => apiServices.filter((s) => !rolePerms.some((p) => p['service_id'] === s['id'])),
    [apiServices, rolePerms],
  );

  const RoleIcon = activeRole.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role-wise API Control"
        description="Manage per-role API permissions, rate limits, and traffic"
        actions={
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Grant Access
          </Button>
        }
      />

      <Tabs value={active} onValueChange={(v) => setActive(v as RoleTabId)}>
        <TabsList className="flex-wrap">
          {ROLES.map((r) => (
            <TabsTrigger key={r.id} value={r.id} className="gap-1.5">
              <r.icon className="h-3.5 w-3.5" />
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {many.isLoading ? (
        <LoadingBlock rows={6} />
      ) : many.error ? (
        <ErrorState error={many.error} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Permitted Services" value={num(totalRoleServices)} icon={<RoleIcon className="h-4 w-4" />} tone="primary" />
            <StatCard label="Read Access" value={num(readable)} icon={<Gauge className="h-4 w-4" />} tone="cyan" />
            <StatCard label="Write / Admin" value={`${num(writable)} / ${num(admins)}`} icon={<Shield className="h-4 w-4" />} tone="violet" />
            <StatCard label="Requests (30d)" value={num(roleTraffic)} icon={<Activity className="h-4 w-4" />} tone="green" />
          </div>

          <GlassCard title={`${activeRole.label} — Permission Matrix`} icon={<RoleIcon className={`h-4 w-4 ${activeRole.tone}`} />}>
            {rolePerms.length === 0 ? (
              <EmptyState message={`No services granted to ${activeRole.label} yet`} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Read</TableHead>
                    <TableHead>Write</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="min-w-[220px]">Rate Limit (req/min)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolePerms.map((row) => {
                    const svc = row['__service'] as Row | undefined;
                    const rowId = String(row['id']);
                    const currentRate = Number(row['rate_limit_per_min'] ?? 0);
                    const inputVal = rateInputs[rowId] ?? String(currentRate);
                    return (
                      <TableRow key={rowId}>
                        <TableCell className="font-medium text-foreground">
                          {svc ? String(svc['name']) : "Unknown Service"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{svc ? String(svc['category']) : "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={Boolean(row['can_read'])} onCheckedChange={(v) => togglePermission(row, "can_read", v)} />
                        </TableCell>
                        <TableCell>
                          <Switch checked={Boolean(row['can_write'])} onCheckedChange={(v) => togglePermission(row, "can_write", v)} />
                        </TableCell>
                        <TableCell>
                          <Switch checked={Boolean(row['can_admin'])} onCheckedChange={(v) => togglePermission(row, "can_admin", v)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Slider
                              value={[Number(inputVal) || 0]}
                              max={1000}
                              step={5}
                              className="w-32"
                              onValueChange={([v]) => setRateInputs({ ...rateInputs, [rowId]: String(v ?? 0) })}
                              onValueCommit={([v]) => commitRate(row, v ?? 0)}
                            />
                            <Input
                              type="number"
                              value={inputVal}
                              className="h-8 w-20"
                              onChange={(e) => setRateInputs({ ...rateInputs, [rowId]: e.target.value })}
                              onBlur={() => commitRate(row, Number(inputVal) || 0)}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-status-error"
                            onClick={() => remove.mutate({ table: "role_api_permissions", id: rowId })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </GlassCard>

          <GlassCard title="Traffic by Role" icon={<Activity className="h-4 w-4 text-neon-cyan" />}>
            {chartData.every((d) => d.traffic === 0) ? (
              <EmptyState message="No usage events recorded yet" />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="role" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="traffic" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {chartData.map((d) => (
                <div key={d.role} className="rounded-lg border border-border/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">{d.role}</p>
                  <p className="mt-1 text-lg font-bold text-foreground">{num(d.traffic)}</p>
                  <p className="text-xs text-muted-foreground">{d.services} services</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}

      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Access — {activeRole.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Service</Label>
              <Select value={grantServiceId} onValueChange={setGrantServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      All services already granted
                    </SelectItem>
                  ) : (
                    availableServices.map((s) => (
                      <SelectItem key={String(s['id'])} value={String(s['id'])}>
                        {String(s['name'])}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancel</Button>
            <Button onClick={submitGrant} disabled={insert.isPending || !grantServiceId}>Grant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
