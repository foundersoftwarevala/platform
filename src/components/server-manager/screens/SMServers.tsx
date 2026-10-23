import { useCallback, useEffect, useState } from 'react';
import { useTranslation as useI18nSource } from "@/lib/i18n/use-translation";
import { Server, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { getServerHealth } from '@/lib/server-manager/health';
import { loadAgentRows, type AgentHeartbeatRow } from '@/lib/server-manager/agent-data';

type ServerRow = Database['public']['Tables']['server_instances']['Row'];

const formatRelative = (value: string | null) => {
  if (!value) return 'Unknown';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown';

  const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const SMServers = () => {
    const { t: translateText } = useI18nSource();
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ServerRow | null>(null);
  const [agentsByServer, setAgentsByServer] = useState<Map<string, AgentHeartbeatRow>>(new Map());

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
        setServers(data);
        setAgentsByServer(new Map());
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error('Sign in to load agent status.');
        const agents = await loadAgentRows(accessToken);
        setLoadError(null);
        setAgentsByServer(new Map(agents.map((agent) => [agent.server_id, agent])));
      }
    } catch (err) {
      console.error('[server-manager] server status failed', err);
      setLoadError(smErrorMessage(err));
      setAgentsByServer(new Map());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const lastSeenFor = (server: ServerRow) => {
    const agent = agentsByServer.get(server.id);
    return agent?.status === 'connected' ? agent.last_seen : null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={translateText("server_manager.servers_acca64")}
        subtitle="Registered server profiles; live resource metrics await agent heartbeats"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadServers()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {translateText("server_manager.refresh_56e3ba")}</Button>
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
            {translateText("server_manager.retry_9f5cd8")}</Button>
        </div>
      )}

      <div className="bento-card premium-halo enter-soft overflow-x-auto !p-0">
        <table className="w-full min-w-[900px]">
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
            {!loading && loadError && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Server data is unavailable.</td>
              </tr>
            )}
            {!loading && !loadError && servers.length === 0 && (
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
                <td className="px-6 py-4 text-foreground">{server.region_name ?? 'Unspecified'}</td>
                <td className="px-6 py-4">
                  <ServerHealthBadge lastSeen={lastSeenFor(server)} />
                </td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">—</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">—</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-muted-foreground">—</span>
                </td>
                <td className="px-6 py-4 text-muted-foreground text-sm">
                  {agentsByServer.get(server.id)?.status === 'connected' ? getServerHealth(lastSeenFor(server)) : 'Unknown'}
                </td>
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
                ['Status', <ServerHealthBadge key="s" lastSeen={lastSeenFor(selected)} />],
                ['Health Status', getServerHealth(lastSeenFor(selected))],
                ['Health Score', '—'],
                ['Region', selected.region_name ? `${selected.region_name} (${selected.region_code ?? '—'})` : 'Unspecified'],
                ['Provider', selected.provider ?? 'Unspecified'],
                ['Server Type', selected.server_type],
                ['OS Type', selected.os_type],
                ['Hostname', selected.hostname ?? '—'],
                ['IP Address', selected.ip_address ?? '—'],
                ['SSH Access', 'Not used'],
                ['CPU Cores', '—'],
                ['CPU Usage', '—'],
                ['RAM (GB)', '—'],
                ['RAM Usage', '—'],
                ['Storage (GB)', '—'],
                ['Disk Usage', '—'],
                ['Network In', '—'],
                ['Network Out', '—'],
                ['Response Time', '—'],
                ['Error Rate', '—'],
                ['Uptime', '—'],
                ['SLA', '—'],
                ['Backup Status', 'Unknown — no backup integration'],
                ['OS Patch Status', 'Unknown — agent data unavailable'],
                ['App Patch Status', 'Unknown — agent data unavailable'],
                ['Security Risk', 'Unknown — agent data unavailable'],
                ['Auto Scaling', 'Not used in read-only monitoring'],
                ['Min/Max Instances', '—'],
                ['Plan', selected.plan_name ?? '—'],
                ['Monthly Cost', '—'],
                ['Workload', selected.workload],
                ['Last Health Check', lastSeenFor(selected) ? formatRelative(lastSeenFor(selected)) : 'Unknown — agent heartbeat unavailable'],
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
