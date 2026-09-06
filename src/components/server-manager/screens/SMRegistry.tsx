import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Server, List, Globe, CheckCircle2, AlertTriangle, XCircle, Eye,
  RefreshCw, PowerOff, Scale, Trash2, MoreVertical, Search, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smMutate } from '@/lib/sm-data';
import type { Database } from '@/integrations/supabase/types';
import { PageHeader } from '../layout/PageShell';

type ServerInstance = Database['public']['Tables']['server_instances']['Row'];

const SMRegistry = () => {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'server_name' | 'cpu_usage' | 'ram_usage' | 'monthly_cost'>('server_name');
  const [detail, setDetail] = useState<ServerInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await smQuery('server registry', () =>
        supabase.from('server_instances').select('*').order('server_name'),
      );
      if (data === null) {
        setLoadError('Could not load the server registry. Please retry.');
      }
      setServers(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'running': return <CheckCircle2 className="w-4 h-4 text-accent-emerald" />;
      case 'warning':
      case 'degraded': return <AlertTriangle className="w-4 h-4 text-accent-amber" />;
      case 'offline':
      case 'stopped': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <CheckCircle2 className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (health: string) => {
    const styles: Record<string, string> = {
      healthy: 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30',
      warning: 'bg-accent-amber/10 text-accent-amber border-accent-amber/30',
      critical: 'bg-destructive/10 text-destructive border-destructive/30',
    };
    return styles[health] ?? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30';
  };

  const getUsageColor = (value: number) => {
    if (value >= 90) return 'text-destructive';
    if (value >= 70) return 'text-accent-amber';
    return 'text-accent-emerald';
  };

  const handleAction = async (action: string, server: ServerInstance) => {
    if (action === 'View Details') {
      setDetail(server);
      return;
    }
    if (action === 'Restart') {
      const ok = await smMutate(
        'restart server',
        () =>
          supabase
            .from('server_instances')
            .update({ last_restart: new Date().toISOString(), status: 'online' })
            .eq('id', server.id),
        `Restart initiated for ${server.server_name}`,
      );
      if (ok) void loadData();
      return;
    }
    if (action === 'Shutdown') {
      const ok = await smMutate(
        'shut down server',
        () => supabase.from('server_instances').update({ status: 'offline' }).eq('id', server.id),
        `Shutdown initiated for ${server.server_name}`,
      );
      if (ok) void loadData();
      return;
    }
    if (action === 'Decommission') {
      const ok = await smMutate(
        'decommission server',
        () => supabase.from('server_instances').update({ status: 'decommissioned' }).eq('id', server.id),
        `${server.server_name} decommissioned`,
      );
      if (ok) void loadData();
      return;
    }
    if (action === 'Scale') {
      const ok = await smMutate(
        'update auto-scaling',
        () =>
          supabase
            .from('server_instances')
            .update({ auto_scaling_enabled: !server.auto_scaling_enabled })
            .eq('id', server.id),
        `Auto-scaling ${!server.auto_scaling_enabled ? 'enabled' : 'disabled'} for ${server.server_name}`,
      );
      if (ok) void loadData();
    }
  };

  const providers = useMemo(() => Array.from(new Set(servers.map((s) => s.provider))), [servers]);
  const regions = useMemo(() => Array.from(new Set(servers.map((s) => s.region_code))), [servers]);

  const filteredServers = useMemo(() => {
    const list = servers.filter((server) =>
      (server.server_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.hostname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        server.server_code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (statusFilter === 'all' || server.status === statusFilter) &&
      (providerFilter === 'all' || server.provider === providerFilter) &&
      (regionFilter === 'all' || server.region_code === regionFilter),
    );
    return [...list].sort((a, b) => {
      if (sortKey === 'server_name') return a.server_name.localeCompare(b.server_name);
      return Number(b[sortKey] || 0) - Number(a[sortKey] || 0);
    });
  }, [servers, searchTerm, statusFilter, providerFilter, regionFilter, sortKey]);

  const statCards = [
    { label: 'Total Servers', value: servers.length, icon: Server, color: 'text-primary' },
    { label: 'Online', value: servers.filter((s) => s.status === 'online' || s.status === 'running').length, icon: CheckCircle2, color: 'text-accent-emerald' },
    { label: 'Warning', value: servers.filter((s) => s.status === 'warning' || s.status === 'degraded').length, icon: AlertTriangle, color: 'text-accent-amber' },
    { label: 'Offline', value: servers.filter((s) => s.status === 'offline' || s.status === 'stopped').length, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Server Registry"
        subtitle="Manage all registered servers across regions and providers"
        action={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search servers..."
                className="pl-9 w-56"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Array.from(new Set(servers.map((s) => s.status))).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Providers</SelectItem>
                {providers.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="server_name">Name</SelectItem>
                <SelectItem value="cpu_usage">CPU</SelectItem>
                <SelectItem value="ram_usage">RAM</SelectItem>
                <SelectItem value="monthly_cost">Cost</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface">
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="bento-card !p-0">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2 text-sm font-semibold tracking-tight">
            <List className="w-5 h-5 text-primary" />
            All Servers ({filteredServers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : filteredServers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No servers match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Server</th>
                    <th className="text-left py-3 px-4 font-medium">Region</th>
                    <th className="text-left py-3 px-4 font-medium">Provider</th>
                    <th className="text-center py-3 px-4 font-medium">Status</th>
                    <th className="text-center py-3 px-4 font-medium">CPU</th>
                    <th className="text-center py-3 px-4 font-medium">RAM</th>
                    <th className="text-center py-3 px-4 font-medium">Disk</th>
                    <th className="text-center py-3 px-4 font-medium">Network</th>
                    <th className="text-center py-3 px-4 font-medium">Health</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServers.map((server, index) => (
                    <motion.tr
                      key={server.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      className="border-b border-border/60 hover:bg-surface/60 transition-colors cursor-pointer"
                      onClick={() => setDetail(server)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-primary" />
                          <span className="text-foreground font-medium">{server.server_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                          <span className="text-foreground">{server.region_name}</span>
                          <Badge variant="outline" className="text-xs border-border text-muted-foreground">{server.region_code}</Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground capitalize">{server.provider}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {getStatusIcon(server.status)}
                          <span className="capitalize text-sm">{server.status}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 text-center font-mono ${getUsageColor(server.cpu_usage)}`}>{server.cpu_usage}%</td>
                      <td className={`py-3 px-4 text-center font-mono ${getUsageColor(server.ram_usage)}`}>{server.ram_usage}%</td>
                      <td className={`py-3 px-4 text-center font-mono ${getUsageColor(server.disk_usage)}`}>{server.disk_usage}%</td>
                      <td className="py-3 px-4 text-center text-foreground font-mono">{server.network_in_mbps} Mb/s</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className={getHealthBadge(server.health_status)}>{server.health_status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => void handleAction('View Details', server)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleAction('Restart', server)}>
                              <RefreshCw className="w-4 h-4 mr-2" /> Restart
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleAction('Scale', server)}>
                              <Scale className="w-4 h-4 mr-2" /> Toggle Auto-Scaling
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleAction('Shutdown', server)}>
                              <PowerOff className="w-4 h-4 mr-2" /> Shutdown
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => void handleAction('Decommission', server)}>
                              <Trash2 className="w-4 h-4 mr-2" /> Decommission
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> {detail?.server_name}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Server Code', detail.server_code],
                ['Hostname', detail.hostname ?? '—'],
                ['IP Address', detail.ip_address ?? '—'],
                ['SSH Port', detail.ssh_port],
                ['Status', detail.status],
                ['Health Status', detail.health_status],
                ['Health Score', detail.health_score],
                ['Server Type', detail.server_type],
                ['Workload', detail.workload],
                ['OS Type', detail.os_type],
                ['Provider', detail.provider],
                ['Region', `${detail.region_name} (${detail.region_code})`],
                ['Plan', detail.plan_name ?? '—'],
                ['Monthly Cost', `$${Number(detail.monthly_cost).toFixed(2)}`],
                ['CPU Cores', detail.cpu_cores],
                ['RAM (GB)', detail.ram_gb],
                ['Storage (GB)', detail.storage_gb],
                ['CPU Usage', `${detail.cpu_usage}%`],
                ['RAM Usage', `${detail.ram_usage}%`],
                ['Disk Usage', `${detail.disk_usage}%`],
                ['Error Rate', `${detail.error_rate}%`],
                ['Response Time', `${detail.response_time_ms} ms`],
                ['Uptime', `${detail.uptime_percent}%`],
                ['SLA', `${detail.sla_percent}%`],
                ['Network In', `${detail.network_in_mbps} Mbps`],
                ['Network Out', `${detail.network_out_mbps} Mbps`],
                ['Auto Scaling', detail.auto_scaling_enabled ? 'Enabled' : 'Disabled'],
                ['Min / Max Instances', `${detail.min_instances} / ${detail.max_instances}`],
                ['OS Patch Status', detail.os_patch_status],
                ['App Patch Status', detail.app_patch_status],
                ['Last Patch Date', detail.last_patch_date ?? '—'],
                ['Backup Status', detail.backup_status],
                ['Security Risk', detail.security_risk_level],
                ['Last Restart', detail.last_restart ?? '—'],
                ['Last Health Check', detail.last_health_check ?? '—'],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="text-foreground">{String(value)}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Tags</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {detail.tags?.length ? detail.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-xs border-primary/30 text-primary">{t}</Badge>
                  )) : <span className="text-muted-foreground">—</span>}
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs">Notes</p>
                <p className="text-foreground">{detail.notes ?? '—'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SMRegistry;
