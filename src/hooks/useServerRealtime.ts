import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ServerMetrics {
  server_id: string;
  server_name: string;
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  network_in: number;
  network_out: number;
  health_score: number;
  status: string;
  last_updated: string;
}

export interface ServerAlert {
  id: string;
  server_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
}

interface ServerInstanceRow {
  id: string;
  server_name: string;
  cpu_usage: number;
  ram_usage: number;
  disk_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
  health_score: number;
  status: string;
  updated_at: string;
}

const toMetrics = (row: ServerInstanceRow): ServerMetrics => ({
  server_id: row.id,
  server_name: row.server_name,
  cpu_percent: Number(row.cpu_usage ?? 0),
  ram_percent: Number(row.ram_usage ?? 0),
  disk_percent: Number(row.disk_usage ?? 0),
  network_in: Number(row.network_in_mbps ?? 0),
  network_out: Number(row.network_out_mbps ?? 0),
  health_score: Number(row.health_score ?? 0),
  status: row.status,
  last_updated: row.updated_at,
});

const METRIC_COLUMNS =
  'id, server_name, cpu_usage, ram_usage, disk_usage, network_in_mbps, network_out_mbps, health_score, status, updated_at';

interface UseServerRealtimeReturn {
  metrics: Record<string, ServerMetrics>;
  alerts: ServerAlert[];
  isConnected: boolean;
  lastUpdate: Date | null;
  refreshMetrics: () => Promise<void>;
  startAutoRefresh: (intervalMs?: number) => void;
  stopAutoRefresh: () => void;
}

export function useServerRealtime(): UseServerRealtimeReturn {
  const [metrics, setMetrics] = useState<Record<string, ServerMetrics>>({});
  const [alerts, setAlerts] = useState<ServerAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshMetrics = useCallback(async () => {
    try {
      const { data: serverRows } = await supabase
        .from('server_instances')
        .select(METRIC_COLUMNS)
        .neq('status', 'decommissioned');

      if (serverRows) {
        const metricsMap: Record<string, ServerMetrics> = {};
        for (const row of serverRows as ServerInstanceRow[]) {
          metricsMap[row.id] = toMetrics(row);
        }
        setMetrics(metricsMap);
      }

      const { data: alertsData } = await supabase
        .from('server_alerts')
        .select('id, server_id, alert_type, severity, message, is_resolved, created_at')
        .eq('is_resolved', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (alertsData) setAlerts(alertsData as ServerAlert[]);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[ServerRealtime] Refresh error:', error);
    }
  }, []);

  useEffect(() => {
    let metricsChannel: RealtimeChannel | undefined;
    let alertsChannel: RealtimeChannel | undefined;

    metricsChannel = supabase
      .channel('server-metrics-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_instances' },
        (payload) => {
          const row = payload.new as ServerInstanceRow | undefined;
          if (row?.id) {
            setMetrics((prev) => ({ ...prev, [row.id]: toMetrics(row) }));
            setLastUpdate(new Date());
          }
        },
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    alertsChannel = supabase
      .channel('server-alerts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'server_alerts' },
        (payload) => {
          const row = payload.new as ServerAlert | undefined;
          if (row) setAlerts((prev) => [row, ...prev.slice(0, 49)]);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'server_alerts' },
        (payload) => {
          const updated = payload.new as ServerAlert | undefined;
          if (!updated) return;
          setAlerts((prev) =>
            updated.is_resolved
              ? prev.filter((a) => a.id !== updated.id)
              : prev.map((a) => (a.id === updated.id ? updated : a)),
          );
        },
      )
      .subscribe();

    void refreshMetrics();

    return () => {
      if (metricsChannel) supabase.removeChannel(metricsChannel);
      if (alertsChannel) supabase.removeChannel(alertsChannel);
    };
  }, [refreshMetrics]);

  const startAutoRefresh = useCallback(
    (intervalMs = 5000) => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = setInterval(() => {
        void refreshMetrics();
      }, intervalMs);
    },
    [refreshMetrics],
  );

  const stopAutoRefresh = useCallback(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, []);

  return { metrics, alerts, isConnected, lastUpdate, refreshMetrics, startAutoRefresh, stopAutoRefresh };
}

export function useServerDashboard(autoRefreshMs = 5000) {
  const [summary, setSummary] = useState({
    total_servers: 0,
    online: 0,
    offline: 0,
    warnings: 0,
    critical_alerts: 0,
    avg_cpu: 0,
    avg_ram: 0,
    network_throughput: { in: 0, out: 0 },
  });
  const [loading, setLoading] = useState(true);

  const fetchSummary = useCallback(async () => {
    try {
      const { data: servers } = await supabase
        .from('server_instances')
        .select(METRIC_COLUMNS)
        .neq('status', 'decommissioned');

      const { data: alerts } = await supabase
        .from('server_alerts')
        .select('severity')
        .eq('is_resolved', false);

      const rows = (servers ?? []) as ServerInstanceRow[];
      const total = rows.length;
      const online = rows.filter((s) => s.status === 'active').length;
      const offline = rows.filter((s) => s.status === 'offline' || s.status === 'stopped').length;
      const warnings = alerts?.filter((a) => a.severity === 'warning').length ?? 0;
      const critical = alerts?.filter((a) => a.severity === 'critical').length ?? 0;

      const avgCpu = total ? rows.reduce((acc, m) => acc + Number(m.cpu_usage || 0), 0) / total : 0;
      const avgRam = total ? rows.reduce((acc, m) => acc + Number(m.ram_usage || 0), 0) / total : 0;
      const netIn = rows.reduce((acc, m) => acc + Number(m.network_in_mbps || 0), 0);
      const netOut = rows.reduce((acc, m) => acc + Number(m.network_out_mbps || 0), 0);

      setSummary({
        total_servers: total,
        online,
        offline,
        warnings,
        critical_alerts: critical,
        avg_cpu: Math.round(avgCpu * 100) / 100,
        avg_ram: Math.round(avgRam * 100) / 100,
        network_throughput: { in: Math.round(netIn), out: Math.round(netOut) },
      });
    } catch (error) {
      console.error('[Dashboard] Fetch error:', error);
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

  return { summary, loading, refresh: fetchSummary };
}

export default useServerRealtime;
