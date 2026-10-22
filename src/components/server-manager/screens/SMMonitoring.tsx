import { useState, useEffect, useCallback } from 'react';
import {
  Activity, Cpu, HardDrive, Network, Clock,
  Pause, Play
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { smQuery } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { useServerTelemetry } from '@/hooks/useServerTelemetry';
import { TelemetryTrend } from '../layout/TelemetryTrend';

interface Anomaly {
  id: string;
  server: string;
  metric: string;
  value: string;
  time: string;
  severity: string;
}

const SMMonitoring = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('1h');
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);
  const rangeMs = timeRange === '15m' ? 15 * 60_000
    : timeRange === '6h' ? 6 * 60 * 60_000
      : timeRange === '24h' ? 24 * 60 * 60_000
        : 60 * 60_000;
  const telemetry = useServerTelemetry(rangeMs, autoRefresh ? 5_000 : null);
  const liveServers = telemetry.servers.filter((server) => server.health === 'live' && server.latest);
  const allServersLive = telemetry.servers.length > 0 && liveServers.length === telemetry.servers.length;
  const latestValues = {
    cpu: allServersLive ? liveServers.reduce((sum, server) => sum + server.latest!.cpu_usage, 0) / liveServers.length : null,
    ram: allServersLive ? liveServers.reduce((sum, server) => sum + server.latest!.ram_usage, 0) / liveServers.length : null,
    disk: allServersLive ? liveServers.reduce((sum, server) => sum + server.latest!.disk_usage, 0) / liveServers.length : null,
    networkIn: allServersLive ? liveServers.reduce((sum, server) => sum + server.latest!.network_in_mbps, 0) : null,
    networkOut: allServersLive ? liveServers.reduce((sum, server) => sum + server.latest!.network_out_mbps, 0) : null,
  };
  const newestMetricAt = allServersLive ? liveServers
    .map((server) => server.latest?.recorded_at)
    .filter((value): value is string => value !== undefined)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null : null;
  const overallLastSeen = telemetry.servers.length > 0 &&
    telemetry.servers.every((server) => server.lastSeen !== null)
    ? telemetry.servers.map((server) => server.lastSeen!).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
    : null;

  const loadData = useCallback(async () => {
    const alerts = await smQuery('active alerts', () =>
        supabase
          .from('server_alerts')
          .select('id, message, severity, created_at, alert_type, server_instances(server_name)')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(6),
    );

    if (alerts === null) {
      setLoadError('Failed to load monitoring data.');
      setAnomalies(null);
      return;
    }
    setLoadError(null);

    setAnomalies(
      (alerts ?? []).map((a) => ({
        id: a.id,
        server:
          (a as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Infrastructure',
        metric: a.alert_type.replace(/_/g, ' '),
        value: a.message,
        time: new Date(a.created_at).toLocaleString(),
        severity: a.severity,
      })),
    );
  }, []);

  useEffect(() => {
    void loadData();
    if (!autoRefresh) return undefined;
    const interval = setInterval(() => {
      void loadData();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);


  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      <PageHeader
        title="Live Monitoring"
        subtitle="Live metrics are shown only from fresh, authenticated agent telemetry"
        action={
          <div className="flex items-center gap-3">
            <ServerHealthBadge lastSeen={overallLastSeen} />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">Last 15m</SelectItem>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="6h">Last 6h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className={autoRefresh ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground'}
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
            </Button>
          </div>
        }
      />

      {telemetry.error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Agent telemetry is unavailable. Metrics are not shown as healthy.
        </div>
      )}

      {newestMetricAt && (
        <p className="text-xs text-muted-foreground">
          Source: Agent · Last updated: {new Date(newestMetricAt).toLocaleString()}
        </p>
      )}

      {/* Current Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">CPU Usage</span>
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2 text-muted-foreground">{latestValues.cpu === null ? '—' : `${latestValues.cpu.toFixed(1)}%`}</p>
          <p className="text-xs text-muted-foreground">{latestValues.cpu === null ? 'Waiting for fresh agent data' : 'Source: Agent'}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent-pink" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">RAM Usage</span>
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2 text-muted-foreground">{latestValues.ram === null ? '—' : `${latestValues.ram.toFixed(1)}%`}</p>
          <p className="text-xs text-muted-foreground">{latestValues.ram === null ? 'Waiting for fresh agent data' : 'Source: Agent'}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent-amber" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Disk I/O</span>
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2 text-muted-foreground">{latestValues.disk === null ? '—' : `${latestValues.disk.toFixed(1)}%`}</p>
          <p className="text-xs text-muted-foreground">{latestValues.disk === null ? 'Waiting for fresh agent data' : 'Source: Agent'}</p>
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-5 h-5 text-accent-emerald" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Network I/O</span>
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-lg font-bold text-muted-foreground">{latestValues.networkIn === null ? '—' : `${latestValues.networkIn.toFixed(2)} Mbps`}</p>
              <p className="text-xs text-muted-foreground">Inbound</p>
            </div>
            <div>
              <p className="text-lg font-bold text-muted-foreground">{latestValues.networkOut === null ? '—' : `${latestValues.networkOut.toFixed(2)} Mbps`}</p>
              <p className="text-xs text-muted-foreground">Outbound</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bento-card enter-soft">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Cpu className="w-5 h-5 text-primary" />
            CPU Usage Over Time
          </div>
          <TelemetryTrend
            samples={liveServers.flatMap((server) => server.history)}
            metric="cpu_usage"
            label="CPU"
          />
          <p className="mt-2 text-xs text-muted-foreground">{timeRange} window</p>
        </div>

        <div className="bento-card enter-soft">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <HardDrive className="w-5 h-5 text-accent-pink" />
            RAM Usage Over Time
          </div>
          <TelemetryTrend
            samples={liveServers.flatMap((server) => server.history)}
            metric="ram_usage"
            label="RAM"
          />
          <p className="mt-2 text-xs text-muted-foreground">{timeRange} window</p>
        </div>
      </div>

      {/* Anomaly Highlights */}
      <div className="bento-card enter-soft border-accent-amber/30">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Activity className="w-5 h-5 text-accent-amber" />
          Recorded Alerts
        </div>
        <div className="space-y-3">
          {anomalies === null ? (
            <p className="text-sm text-muted-foreground">Recorded alert data unavailable.</p>
          ) : anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded alerts.</p>
          ) : anomalies.map((anomaly) => (
            <div key={anomaly.id} className="flex items-center justify-between p-3 rounded-xl bg-surface/60 border border-border">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${anomaly.severity === 'warning' ? 'bg-accent-amber' : 'bg-primary'}`} />
                <div>
                  <p className="font-medium">{anomaly.server}</p>
                  <p className="text-muted-foreground text-sm">{anomaly.metric}: {anomaly.value}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Clock className="w-3 h-3" />
                {anomaly.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SMMonitoring;
