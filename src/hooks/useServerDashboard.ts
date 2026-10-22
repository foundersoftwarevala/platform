import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getServerHealth, type ServerHealth } from '@/lib/server-manager/health';
import { loadAgentMetrics, loadAgentRows } from '@/lib/server-manager/agent-data';

export interface ServerDashboardSummary {
  total_servers: number | null;
  online: number | null;
  offline: number | null;
  warnings: number | null;
  critical_alerts: number | null;
  avg_cpu: number | null;
  avg_ram: number | null;
  network_throughput: { in: number | null; out: number | null };
  health: ServerHealth;
  last_seen: string | null;
}

const unknownSummary: ServerDashboardSummary = {
  total_servers: null,
  online: null,
  offline: null,
  warnings: null,
  critical_alerts: null,
  avg_cpu: null,
  avg_ram: null,
  network_throughput: { in: null, out: null },
  health: 'unknown',
  last_seen: null,
};

export function useServerDashboard(autoRefreshMs = 5000) {
  const [summary, setSummary] = useState<ServerDashboardSummary>(unknownSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sign in to load server status.');

      const [serversResult, alertsResult, agentRows, metricRows] = await Promise.all([
        supabase
          .from('server_instances')
          .select('id')
          .neq('status', 'decommissioned'),
        supabase.from('server_alerts').select('severity').eq('is_resolved', false),
        loadAgentRows(accessToken),
        loadAgentMetrics(accessToken, new Date(Date.now() - 90_000)),
      ]);

      if (serversResult.error) throw serversResult.error;
      if (alertsResult.error) throw alertsResult.error;

      const servers = serversResult.data ?? [];
      const serverCount = servers.length;
      const alerts = alertsResult.data;
      const agentsByServer = new Map(agentRows.map((agent) => [agent.server_id, agent]));
      const metricsByServer = new Map(metricRows.map((metric) => [metric.server_id, metric]));
      const serverHealth = servers.map((server) =>
        agentsByServer.get(server.id)?.status === 'connected'
          ? getServerHealth(agentsByServer.get(server.id)?.last_seen)
          : 'unknown',
      );
      const healthKnown = serverCount > 0 && serverHealth.every((value) => value !== 'unknown');
      const health: ServerHealth = !healthKnown
        ? 'unknown'
        : serverHealth.includes('offline')
          ? 'offline'
          : serverHealth.includes('stale')
            ? 'stale'
            : 'live';
      const connectedLastSeen = servers
        .map((server) => agentsByServer.get(server.id)?.last_seen)
        .filter((value): value is string => typeof value === 'string');
      const lastSeenValues = healthKnown
        ? connectedLastSeen.map((value) => Date.parse(value))
        : [];
      const lastSeen = lastSeenValues.length > 0
        ? new Date(Math.min(...lastSeenValues)).toISOString()
        : null;
      const telemetryCurrent = health === 'live' && servers.every((server) => {
        const metric = metricsByServer.get(server.id);
        return metric !== undefined && getServerHealth(metric.recorded_at) === 'live';
      });
      const cpuValues = telemetryCurrent ? servers.map((server) => metricsByServer.get(server.id)!.cpu_usage) : [];
      const ramValues = telemetryCurrent ? servers.map((server) => metricsByServer.get(server.id)!.ram_usage) : [];
      const networkInValues = telemetryCurrent ? servers.map((server) => metricsByServer.get(server.id)!.network_in_mbps) : [];
      const networkOutValues = telemetryCurrent ? servers.map((server) => metricsByServer.get(server.id)!.network_out_mbps) : [];
      const average = (values: Array<number | null>) =>
        values.length > 0 && values.every((value): value is number => value !== null)
          ? values.reduce((sum, value) => sum + value, 0) / values.length
          : null;

      setSummary({
        total_servers: serverCount,
        online: healthKnown ? serverHealth.filter((value) => value === 'live').length : null,
        offline: healthKnown ? serverHealth.filter((value) => value === 'offline').length : null,
        warnings: alerts.filter((alert) => alert.severity === 'warning').length,
        critical_alerts: alerts.filter((alert) => alert.severity === 'critical').length,
        avg_cpu: average(cpuValues),
        avg_ram: average(ramValues),
        network_throughput: {
          in: average(networkInValues),
          out: average(networkOutValues),
        },
        health,
        last_seen: lastSeen,
      });
      setError(null);
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
      setSummary(unknownSummary);
      setError(error instanceof Error ? error.message : 'Unable to load server status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary();
    const interval = setInterval(() => {
      void fetchSummary();
    }, autoRefreshMs);
    return () => clearInterval(interval);
  }, [fetchSummary, autoRefreshMs]);

  return { summary, loading, error, refresh: fetchSummary };
}
