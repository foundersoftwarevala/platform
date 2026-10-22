import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getServerHealth, type ServerHealth } from '@/lib/server-manager/health';
import {
  loadAgentMetrics,
  loadAgentRows,
  type AgentMetricRow,
} from '@/lib/server-manager/agent-data';

export interface ServerTelemetry {
  id: string;
  name: string;
  cpuCores: number | null;
  ramGb: number | null;
  storageGb: number | null;
  health: ServerHealth;
  lastSeen: string | null;
  latest: AgentMetricRow | null;
  history: AgentMetricRow[];
}

export function useServerTelemetry(
  rangeMs = 6 * 60 * 60 * 1000,
  refreshMs: number | null = 15_000,
) {
  const [servers, setServers] = useState<ServerTelemetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sign in to load server telemetry.');

      const [serverResult, agents, metrics] = await Promise.all([
        supabase
          .from('server_instances')
          .select('id, server_name, cpu_cores, ram_gb, storage_gb')
          .neq('status', 'decommissioned')
          .order('server_name', { ascending: true }),
        loadAgentRows(accessToken),
        loadAgentMetrics(accessToken, new Date(Date.now() - rangeMs)),
      ]);
      if (serverResult.error) throw serverResult.error;

      const agentByServer = new Map(agents.map((agent) => [agent.server_id, agent]));
      const metricsByServer = new Map<string, AgentMetricRow[]>();
      for (const metric of metrics) {
        const history = metricsByServer.get(metric.server_id) ?? [];
        history.push(metric);
        metricsByServer.set(metric.server_id, history);
      }

      setServers((serverResult.data ?? []).map((server) => {
        const agent = agentByServer.get(server.id);
        const lastSeen = agent?.status === 'connected' ? agent.last_seen : null;
        const history = metricsByServer.get(server.id) ?? [];
        const newestMetric = history[0] ?? null;
        return {
          id: server.id,
          name: server.server_name,
          cpuCores: typeof server.cpu_cores === 'number' ? server.cpu_cores : null,
          ramGb: typeof server.ram_gb === 'number' ? server.ram_gb : null,
          storageGb: typeof server.storage_gb === 'number' ? server.storage_gb : null,
          health: getServerHealth(lastSeen),
          lastSeen,
          latest: newestMetric && getServerHealth(newestMetric.recorded_at) === 'live'
            ? newestMetric
            : null,
          history,
        };
      }));
      setError(null);
    } catch (cause) {
      console.error('[server-manager] telemetry fetch failed', cause);
      setServers([]);
      setError(cause instanceof Error ? cause.message : 'Unable to load agent telemetry.');
    } finally {
      setLoading(false);
    }
  }, [rangeMs]);

  useEffect(() => {
    void refresh();
    if (refreshMs === null || refreshMs <= 0) return undefined;
    const interval = setInterval(() => void refresh(), refreshMs);
    return () => clearInterval(interval);
  }, [refresh, refreshMs]);

  return { servers, loading, error, refresh };
}
