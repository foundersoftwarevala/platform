import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Server, List, Globe, CheckCircle2, AlertTriangle, XCircle, Eye,
  RefreshCw, MoreVertical, Search, Loader2,
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
import { smQuery } from '@/lib/sm-data';
import type { Database } from '@/integrations/supabase/types';
import { PageHeader } from '../layout/PageShell';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { getServerHealth } from '@/lib/server-manager/health';
import { loadAgentRows, type AgentHeartbeatRow } from '@/lib/server-manager/agent-data';

type ServerInstance = Database['public']['Tables']['server_instances']['Row'];

const SMRegistry = () => {
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortKey, setSortKey] = useState<'server_name'>('server_name');
  const [detail, setDetail] = useState<ServerInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [agentsByServer, setAgentsByServer] = useState<Map<string, AgentHeartbeatRow>>(new Map());

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await smQuery('server registry', () =>
        supabase.from('server_instances').select('*').order('server_name'),
      );
      if (data === null) {
        setLoadError('Could not load the server registry. Please retry.');
        setServers([]);
        setAgentsByServer(new Map());
        return;
      }
      setServers(data);
      setAgentsByServer(new Map());
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sign in to load agent status.');
      const agents = await loadAgentRows(accessToken);
      setLoadError(null);
      setServers(data);
      setAgentsByServer(new Map(agents.map((agent) => [agent.server_id, agent])));
    } catch (error) {
      console.error('[server-manager] server registry status failed', error);
      setLoadError('Could not load server or agent status. Please retry.');
      setAgentsByServer(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    const sorted = [...list];
    if (sortKey === 'server_name') {
      sorted.sort((a, b) => a.server_name.localeCompare(b.server_name));
    }
    return sorted;
  }, [servers, searchTerm, statusFilter, providerFilter, regionFilter, sortKey]);

  const getLastSeen = (server: ServerInstance) => {
    const agent = agentsByServer.get(server.id);
    return agent?.status === 'connected' ? agent.last_seen : null;
  };
  const healthCountsKnown = servers.every((server) => getServerHealth(getLastSeen(server)) !== 'unknown');
  const statCards = [
    { label: 'Total Servers', value: loading || loadError ? '—' : servers.length, icon: Server, color: 'text-primary' },
    { label: 'Online', value: !loading && !loadError && healthCountsKnown ? servers.filter((s) => getServerHealth(getLastSeen(s)) === 'live').length : '—', icon: CheckCircle2, color: 'text-accent-emerald' },
    { label: 'Warning', value: !loading && !loadError && healthCountsKnown ? servers.filter((s) => getServerHealth(getLastSeen(s)) === 'stale').length : '—', icon: AlertTriangle, color: 'text-accent-amber' },
    { label: 'Offline', value: !loading && !loadError && healthCountsKnown ? servers.filter((s) => getServerHealth(getLastSeen(s)) === 'offline').length : '—', icon: XCircle, color: 'text-destructive' },
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
            All Servers ({loading || loadError ? '—' : filteredServers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
          ) : loadError ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Server registry data is unavailable.</p>
          ) : filteredServers.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No servers match the current filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
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
                      <td className="py-3 px-4 text-foreground capitalize">{server.provider}                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-xs">{server.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-center font-mono text-muted-foreground">—</td>
                      <td className="py-3 px-4 text-center">
                        <ServerHealthBadge lastSeen={getLastSeen(server)} />
                      </td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetail(server)}>
                              <Eye className="w-4 h-4 mr-2" /> View Details
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
                ['SSH Access', 'Not used'],
                ['Status', 'Unknown — agent heartbeat unavailable'],
                ['Health Status', 'Unknown — agent heartbeat unavailable'],
                ['Health Score', '—'],
                ['Server Type', detail.server_type],
                ['Workload', detail.workload],
                ['OS Type', detail.os_type],
                ['Provider', detail.provider],
                ['Region', `${detail.region_name} (${detail.region_code})`],
                ['Plan', detail.plan_name ?? '—'],
                ['Monthly Cost', '—'],
                ['CPU Cores', '—'],
                ['RAM (GB)', '—'],
                ['Storage (GB)', '—'],
                ['CPU Usage', '—'],
                ['RAM Usage', '—'],
                ['Disk Usage', '—'],
                ['Error Rate', '—'],
                ['Response Time', '—'],
                ['Uptime', '—'],
                ['SLA', '—'],
                ['Network In', '—'],
                ['Network Out', '—'],
                ['Auto Scaling', 'Not available in read-only monitoring'],
                ['Min / Max Instances', '—'],
                ['OS Patch Status', 'Unknown — agent data unavailable'],
                ['App Patch Status', 'Unknown — agent data unavailable'],
                ['Last Patch Date', '—'],
                ['Backup Status', 'Unknown — no backup integration'],
                ['Security Risk', 'Unknown — agent data unavailable'],
                ['Last Restart', '—'],
                ['Last Health Check', 'Unknown — agent heartbeat unavailable'],
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
