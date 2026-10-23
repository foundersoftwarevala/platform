import { useEffect, useState } from 'react';
import { Server, Activity, AlertTriangle, Wifi, WifiOff, RefreshCw, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useServerDashboard } from '@/hooks/useServerDashboard';
import { ServerHealthBadge } from '../layout/ServerHealthBadge';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '../layout/PageShell';
import { useTranslation } from '@/lib/i18n/use-translation';

const SMOverview = () => {
  const { t } = useTranslation();
  const { summary, loading, error: summaryError, refresh } = useServerDashboard(5000);
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
        const message = error instanceof Error ? error.message : t('server_manager.overview.alerts_unavailable');
        console.error('[server-manager] alerts fetch failed', error);
        setAlertsError(message);
        toast.error(t('server_manager.overview.load_alerts_failed', { message }));
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
  }, [isAutoRefresh, t]);


  const stats = [
    { label: t('server_manager.overview.total_servers'), value: summary.total_servers?.toString() ?? '—', icon: Server, color: 'text-primary' },
    { label: t('server_manager.overview.online'), value: summary.online?.toString() ?? '—', icon: Activity, color: 'text-muted-foreground' },
    { label: t('server_manager.overview.offline'), value: summary.offline?.toString() ?? '—', icon: WifiOff, color: 'text-muted-foreground' },
    { label: t('server_manager.overview.warnings'), value: summary.warnings?.toString() ?? '—', icon: AlertTriangle, color: 'text-accent-amber' },
    { label: t('server_manager.overview.critical_alerts'), value: summary.critical_alerts?.toString() ?? '—', icon: AlertTriangle, color: 'text-destructive' },
  ];

  const resourceData = [
    { label: t('server_manager.overview.cpu'), value: summary.avg_cpu, rate: null, color: 'bg-primary' },
    { label: t('server_manager.overview.ram'), value: summary.avg_ram, rate: null, color: 'bg-accent-pink' },
    { label: t('server_manager.overview.network_in'), value: null, rate: summary.network_throughput.in, color: 'bg-accent-emerald' },
    { label: t('server_manager.overview.network_out'), value: null, rate: summary.network_throughput.out, color: 'bg-accent-amber' },
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
        title={t('server_manager.overview.title')}
        subtitle={t('server_manager.overview.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <ServerHealthBadge lastSeen={summary.last_seen} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isAutoRefresh ? (
                <Wifi className="w-4 h-4 text-accent-emerald animate-pulse" aria-hidden="true" />
              ) : (
                <WifiOff className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span>{t('server_manager.overview.auto_refresh')} {isAutoRefresh ? t('server_manager.overview.on') : t('server_manager.overview.off')}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label={t('server_manager.overview.refresh_infrastructure')}
              onClick={() => {
                refresh();
                setLastUpdate(new Date());
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              {t('server_manager.overview.refresh')}
            </Button>
            <Button
              size="sm"
              variant={isAutoRefresh ? 'default' : 'secondary'}
              aria-pressed={isAutoRefresh}
              aria-label={isAutoRefresh ? `${t('server_manager.overview.pause')} ${t('server_manager.overview.auto_refresh')}` : `${t('server_manager.overview.resume')} ${t('server_manager.overview.auto_refresh')}`}
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            >
              {isAutoRefresh ? t('server_manager.overview.pause') : t('server_manager.overview.resume')}
            </Button>
          </div>
        }
      />

      {summaryError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('server_manager.overview.health_unknown')}
        </div>
      )}

      {lastUpdate && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('server_manager.overview.last_updated')} {lastUpdate.toLocaleTimeString()}
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
        <h3 className="text-sm font-semibold tracking-tight mb-4">{t('server_manager.overview.resource_utilization')}</h3>
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {resourceData.map((res) => (
            <div key={res.label} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">{res.label}</span>
                <span className={`text-sm font-bold ${
                  res.value === null ? 'text-muted-foreground' : res.value > 80 ? 'text-destructive' : res.value > 60 ? 'text-accent-amber' : 'text-accent-emerald'
                }`}>
                  {loading ? '...' : res.rate !== null
                    ? `${res.rate.toFixed(2)} Mbps`
                    : res.value === null ? '—' : `${Math.round(res.value)}%`}
                </span>
              </div>
              {res.value !== null && (
                <div className="h-4 bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full ${res.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(100, res.value)}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bento-card premium-halo hover-lift enter-soft">
        <h3 className="text-sm font-semibold tracking-tight mb-4">{t('server_manager.overview.recent_alerts')}</h3>
        {alertsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : alertsError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">{t('server_manager.overview.alerts_unavailable')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{alertsError}</p>
          </div>
        ) : recentAlerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">{t('server_manager.overview.no_active_alerts')}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t('server_manager.overview.no_alerts_recorded')}</p>
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
        🔄 {t('server_manager.overview.realtime_refresh_note')}
      </p>
    </div>
  );
};

export default SMOverview;
