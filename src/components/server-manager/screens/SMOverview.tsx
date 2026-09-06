import { useEffect, useState } from 'react';
import { Server, Activity, AlertTriangle, Wifi, WifiOff, RefreshCw, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServerDashboard } from '@/hooks/useServerRealtime';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '../layout/PageShell';

const SMOverview = () => {
  const { summary, loading, refresh } = useServerDashboard(5000);
  const [recentAlerts, setRecentAlerts] = useState<Array<{
    id: string;
    message: string;
    severity: string;
    created_at: string;
  }>>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchAlerts = async () => {
      try {
        const { data, error } = await supabase
          .from('server_alerts')
          .select('id, message, severity, created_at')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(5);

        if (error) throw error;
        if (cancelled) return;
        setRecentAlerts(data ?? []);
        setAlertsError(null);
        setLastUpdate(new Date());
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Unable to load alerts';
        console.error('[server-manager] alerts fetch failed', error);
        setAlertsError(message);
        toast.error(`Could not load alerts: ${message}`);
      } finally {
        if (!cancelled) setAlertsLoading(false);
      }
    };

    void fetchAlerts();
    if (!isAutoRefresh) return () => { cancelled = true; };
    const interval = setInterval(() => void fetchAlerts(), 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAutoRefresh]);


  const stats = [
    { label: 'Total Servers', value: summary.total_servers.toString(), icon: Server, color: 'text-primary' },
    { label: 'Online', value: summary.online.toString(), icon: Activity, color: 'text-accent-emerald' },
    { label: 'Offline', value: summary.offline.toString(), icon: WifiOff, color: 'text-destructive' },
    { label: 'Warnings', value: summary.warnings.toString(), icon: AlertTriangle, color: 'text-accent-amber' },
    { label: 'Critical Alerts', value: summary.critical_alerts.toString(), icon: AlertTriangle, color: 'text-destructive' },
  ];

  const resourceData = [
    { label: 'CPU', value: summary.avg_cpu, color: 'bg-primary' },
    { label: 'RAM', value: summary.avg_ram, color: 'bg-accent-pink' },
    { label: 'Network In', value: Math.min(100, summary.network_throughput.in / 10), color: 'bg-accent-emerald' },
    { label: 'Network Out', value: Math.min(100, summary.network_throughput.out / 5), color: 'bg-accent-amber' },
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive';
      case 'warning': return 'bg-accent-amber';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Overview"
        subtitle="Real-time infrastructure health across all monitored servers"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoRefresh ? (
                <Wifi className="w-4 h-4 text-accent-emerald animate-pulse" aria-hidden="true" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span>Auto-refresh {isAutoRefresh ? 'ON' : 'OFF'}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Refresh infrastructure data"
              onClick={() => {
                refresh();
                setLastUpdate(new Date());
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant={isAutoRefresh ? 'default' : 'secondary'}
              aria-pressed={isAutoRefresh}
              aria-label={isAutoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              {isAutoRefresh ? 'Pause' : 'Resume'}
            </Button>
          </div>
        }
      />

      {lastUpdate && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Last updated: {lastUpdate.toLocaleTimeString()}
        </p>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{stat.label}</p>
                {loading ? (
                  <Skeleton className="h-8 w-16 mt-1" />
                ) : (
                  <p className={`mt-1 text-xl font-bold ${stat.color}`}>{stat.value}</p>
                )}
              </div>
              <div className="w-10 h-10 bg-surface rounded-lg flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} aria-hidden="true" />
              </div>
            </div>
          </div>
        ))}
      </div>


      {/* Resource Heatmap */}
      <div className="bento-card premium-halo hover-lift enter-soft">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Resource Utilization (Live)</h3>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {resourceData.map((res) => (
            <div key={res.label} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">{res.label}</span>
                <span className={`text-sm font-bold ${
                  res.value > 80 ? 'text-destructive' : res.value > 60 ? 'text-accent-amber' : 'text-accent-emerald'
                }`}>
                  {loading ? '...' : `${Math.round(res.value)}%`}
                </span>
              </div>
              <div className="h-4 bg-surface rounded-full overflow-hidden">
                <div
                  className={`h-full ${res.color} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(100, res.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bento-card premium-halo hover-lift enter-soft">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Recent Alerts</h3>
        {alertsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : alertsError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">Alerts could not be loaded</p>
            <p className="mt-1 text-xs text-muted-foreground">{alertsError}</p>
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">No active alerts</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Every monitored server is within its thresholds. Adjust thresholds in Settings → Monitoring
              to change when alerts are raised.
            </p>
          </div>
        ) : (

          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${getSeverityColor(alert.severity)}`} />
                  <span className="text-sm text-foreground">{alert.message}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {alert.severity}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(alert.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        🔄 Real-time data — Auto-refreshing every 5 seconds
      </p>
    </div>
  );
};

export default SMOverview;
