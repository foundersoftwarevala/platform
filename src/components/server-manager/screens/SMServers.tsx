import { useCallback, useEffect, useState } from 'react';
import { Server, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type ServerRow = Database['public']['Tables']['server_instances']['Row'];

const formatRelative = (iso: string | null) => {
  if (!iso) return 'never';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30';
    case 'warning':
      return 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30';
    case 'maintenance':
      return 'bg-primary/10 text-primary border border-primary/30';
    case 'offline':
    case 'stopped':
      return 'bg-destructive/10 text-destructive border border-destructive/30';
    default:
      return 'bg-surface text-muted-foreground border border-border';
  }
};

const SMServers = () => {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServerRow | null>(null);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smQuery('servers', () =>
        supabase.from('server_instances').select('*').order('server_name', { ascending: true }),
      );
      if (data === null) {
        setLoadError('Could not load servers. Please try again.');
        setServers([]);
      } else {
        setLoadError(null);
        setServers(data);
      }
    } catch (err) {
      setLoadError(smErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servers"
        subtitle="All registered server instances and their live resource metrics"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadServers()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadServers()}
          >
            Retry
          </Button>
        </div>
      )}

      <div className="bento-card premium-halo enter-soft overflow-hidden !p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-4 font-medium">Server ID</th>
              <th className="text-left px-6 py-4 font-medium">Region</th>
              <th className="text-left px-6 py-4 font-medium">Status</th>
              <th className="text-left px-6 py-4 font-medium">CPU</th>
              <th className="text-left px-6 py-4 font-medium">RAM</th>
              <th className="text-left px-6 py-4 font-medium">Disk</th>
              <th className="text-left px-6 py-4 font-medium">Last Check</th>
              <th className="text-left px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading servers…</td>
              </tr>
            )}
            {!loading && servers.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No servers found</td>
              </tr>
            )}
            {!loading && servers.map((server) => (
              <tr
                key={server.id}
                className="border-b border-border/60 hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{server.server_code}</p>
                      <p className="text-xs text-muted-foreground">{server.server_name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-foreground">{server.region_name}</td>
                <td className="px-6 py-4">
                  <Badge className={statusBadgeClass(server.status)}>{server.status}</Badge>
                </td>
                <td className="px-6 py-4">
                  <span className={Number(server.cpu_usage) > 80 ? 'text-destructive font-medium' : 'text-foreground'}>
                    {Math.round(Number(server.cpu_usage))}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={Number(server.ram_usage) > 80 ? 'text-destructive font-medium' : 'text-foreground'}>
                    {Math.round(Number(server.ram_usage))}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={Number(server.disk_usage) > 80 ? 'text-accent-amber font-medium' : 'text-foreground'}>
                    {Math.round(Number(server.disk_usage))}%
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground text-sm">{formatRelative(server.last_health_check)}</td>
                <td className="px-6 py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelected(server)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              {selected?.server_name} ({selected?.server_code})
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                ['Status', <Badge key="s" className={statusBadgeClass(selected.status)}>{selected.status}</Badge>],
                ['Health Status', selected.health_status],
                ['Health Score', `${selected.health_score}`],
                ['Region', `${selected.region_name} (${selected.region_code})`],
                ['Provider', selected.provider],
                ['Server Type', selected.server_type],
                ['OS Type', selected.os_type],
                ['Hostname', selected.hostname ?? '—'],
                ['IP Address', selected.ip_address ?? '—'],
                ['SSH Port', selected.ssh_port],
                ['CPU Cores', selected.cpu_cores],
                ['CPU Usage', `${Math.round(Number(selected.cpu_usage))}%`],
                ['RAM (GB)', selected.ram_gb],
                ['RAM Usage', `${Math.round(Number(selected.ram_usage))}%`],
                ['Storage (GB)', selected.storage_gb],
                ['Disk Usage', `${Math.round(Number(selected.disk_usage))}%`],
                ['Network In', `${selected.network_in_mbps} Mbps`],
                ['Network Out', `${selected.network_out_mbps} Mbps`],
                ['Response Time', `${selected.response_time_ms} ms`],
                ['Error Rate', `${selected.error_rate}%`],
                ['Uptime', `${selected.uptime_percent}%`],
                ['SLA', `${selected.sla_percent}%`],
                ['Backup Status', selected.backup_status],
                ['OS Patch Status', selected.os_patch_status],
                ['App Patch Status', selected.app_patch_status],
                ['Security Risk', selected.security_risk_level],
                ['Auto Scaling', selected.auto_scaling_enabled ? 'Enabled' : 'Disabled'],
                ['Min/Max Instances', `${selected.min_instances} / ${selected.max_instances}`],
                ['Plan', selected.plan_name ?? '—'],
                ['Monthly Cost', `$${selected.monthly_cost}`],
                ['Workload', selected.workload],
                ['Last Health Check', formatRelative(selected.last_health_check)],
                ['Last Restart', formatRelative(selected.last_restart)],
                ['Last Patch Date', formatRelative(selected.last_patch_date)],
                ['Tags', selected.tags?.length ? selected.tags.join(', ') : '—'],
              ].map(([label, value], i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-muted-foreground text-xs">{label as string}</span>
                  <span className="text-foreground">{value as React.ReactNode}</span>
                </div>
              ))}
              {selected.notes && (
                <div className="col-span-2 flex flex-col mt-2 pt-2 border-t border-border">
                  <span className="text-muted-foreground text-xs">Notes</span>
                  <span className="text-foreground">{selected.notes}</span>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SMServers;
