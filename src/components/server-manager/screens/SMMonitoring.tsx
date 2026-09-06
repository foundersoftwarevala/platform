import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Cpu, HardDrive, Network, Clock,
  Pause, Play, TrendingUp, TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

const RANGE_MINUTES: Record<string, number> = { '15m': 15, '1h': 60, '6h': 360, '24h': 1440 };

const formatRelative = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

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
  const [cpuData, setCpuData] = useState<number[]>([]);
  const [ramData, setRamData] = useState<number[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState({
    cpu: { value: 0, trend: 'up', change: '0%' },
    ram: { value: 0, trend: 'up', change: '0%' },
    disk: { value: 0, trend: 'up', change: '0%' },
    network: { in: 0, out: 0 },
  });

  const loadData = useCallback(async () => {
    const minutes = RANGE_MINUTES[timeRange] ?? 60;
    const since = new Date(Date.now() - minutes * 60_000).toISOString();

    const [servers, history, alerts] = await Promise.all([
      smQuery('server metrics', () =>
        supabase
          .from('server_instances')
          .select('cpu_usage, ram_usage, disk_usage, network_in_mbps, network_out_mbps')
          .neq('status', 'decommissioned'),
      ),
      smQuery('metrics history', () =>
        supabase
          .from('server_metrics_history')
          .select('cpu_usage, ram_usage, recorded_at')
          .gte('recorded_at', since)
          .order('recorded_at', { ascending: true }),
      ),
      smQuery('active alerts', () =>
        supabase
          .from('server_alerts')
          .select('id, message, severity, created_at, alert_type, server_instances(server_name)')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(6),
      ),
    ]);

    if (servers === null || history === null || alerts === null) {
      setLoadError('Failed to load monitoring data.');
      return;
    }
    setLoadError(null);

    const rows = servers ?? [];
    const avg = (fn: (r: (typeof rows)[number]) => number) =>
      rows.length ? rows.reduce((acc, r) => acc + Number(fn(r) || 0), 0) / rows.length : 0;

    // Bucket history into 20 points for the sparkline charts.
    const points = history ?? [];
    const bucketCount = 20;
    const bucketed = (key: 'cpu_usage' | 'ram_usage') => {
      if (!points.length) return [] as number[];
      const size = Math.ceil(points.length / bucketCount);
      const out: number[] = [];
      for (let i = 0; i < points.length; i += size) {
        const slice = points.slice(i, i + size);
        out.push(
          Math.round(slice.reduce((a, p) => a + Number(p[key] || 0), 0) / slice.length),
        );
      }
      return out.slice(-bucketCount);
    };

    const cpuSeries = bucketed('cpu_usage');
    const ramSeries = bucketed('ram_usage');
    setCpuData(cpuSeries);
    setRamData(ramSeries);

    const trendOf = (series: number[]) => {
      if (series.length < 2) return { trend: 'up', change: '0%' };
      const first = series[0] ?? 0;
      const last = series[series.length - 1] ?? 0;
      const delta = Math.round(last - first);
      return { trend: delta >= 0 ? 'up' : 'down', change: `${delta >= 0 ? '+' : ''}${delta}%` };
    };

    const cpuTrend = trendOf(cpuSeries);
    const ramTrend = trendOf(ramSeries);

    setCurrentMetrics({
      cpu: { value: Math.round(avg((r) => Number(r.cpu_usage))), ...cpuTrend },
      ram: { value: Math.round(avg((r) => Number(r.ram_usage))), ...ramTrend },
      disk: { value: Math.round(avg((r) => Number(r.disk_usage))), trend: 'up', change: '' },
      network: {
        in: Math.round(rows.reduce((a, r) => a + Number(r.network_in_mbps || 0), 0)),
        out: Math.round(rows.reduce((a, r) => a + Number(r.network_out_mbps || 0), 0)),
      },
    });

    setAnomalies(
      (alerts ?? []).map((a) => ({
        id: a.id,
        server:
          (a as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Infrastructure',
        metric: a.alert_type.replace(/_/g, ' '),
        value: a.message,
        time: formatRelative(a.created_at),
        severity: a.severity,
      })),
    );
  }, [timeRange]);

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
        subtitle="Real-time infrastructure metrics and performance"
        action={
          <div className="flex items-center gap-3">
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

      {/* Current Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">CPU Usage</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-accent-emerald">
              {currentMetrics.cpu.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {currentMetrics.cpu.change}
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2">{currentMetrics.cpu.value}%</p>
          <Progress value={currentMetrics.cpu.value} className="h-2" />
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent-pink" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">RAM Usage</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-accent-amber">
              {currentMetrics.ram.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {currentMetrics.ram.change}
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2">{currentMetrics.ram.value}%</p>
          <Progress value={currentMetrics.ram.value} className="h-2" />
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent-amber" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Disk I/O</span>
            </div>
          </div>
          <p className="mt-1 text-xl font-bold mb-2">{currentMetrics.disk.value}%</p>
          <Progress value={currentMetrics.disk.value} className="h-2" />
        </div>

        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-5 h-5 text-accent-emerald" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Network I/O</span>
          </div>
          <div className="flex justify-between">
            <div>
              <p className="text-lg font-bold text-accent-emerald">{currentMetrics.network.in} Mb/s</p>
              <p className="text-xs text-muted-foreground">Inbound</p>
            </div>
            <div>
              <p className="text-lg font-bold text-primary">{currentMetrics.network.out} Mb/s</p>
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
          <div className="h-48 flex items-end gap-1">
            {cpuData.map((value, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${value}%` }}
                transition={{ duration: 0.5, delay: i * 0.02 }}
                className="flex-1 bg-gradient-to-t from-primary/50 to-primary-glow/30 rounded-t"
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>-{timeRange}</span>
            <span>Now</span>
          </div>
        </div>

        <div className="bento-card enter-soft">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
            <HardDrive className="w-5 h-5 text-accent-pink" />
            RAM Usage Over Time
          </div>
          <div className="h-48 flex items-end gap-1">
            {ramData.map((value, i) => (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${value}%` }}
                transition={{ duration: 0.5, delay: i * 0.02 }}
                className="flex-1 bg-gradient-to-t from-accent-pink/50 to-accent-pink/30 rounded-t"
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>-{timeRange}</span>
            <span>Now</span>
          </div>
        </div>
      </div>

      {/* Anomaly Highlights */}
      <div className="bento-card enter-soft border-accent-amber/30">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Activity className="w-5 h-5 text-accent-amber" />
          Anomaly Detection
        </div>
        <div className="space-y-3">
          {anomalies.map((anomaly) => (
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
