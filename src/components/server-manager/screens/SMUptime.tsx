import { useCallback, useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type ServiceRow = Database['public']['Tables']['server_services']['Row'];
type BreachRow = Database['public']['Tables']['server_sla_breaches']['Row'];

const SMUptime = () => {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [breaches, setBreaches] = useState<BreachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [svc, brc] = await Promise.all([
        smQuery('services', () =>
          supabase.from('server_services').select('*').order('service_name', { ascending: true }),
        ),
        smQuery('SLA breaches', () =>
          supabase
            .from('server_sla_breaches')
            .select('*')
            .order('breach_date', { ascending: false })
            .limit(10),
        ),
      ]);
      if (svc === null || brc === null) {
        setLoadError('Could not load uptime data. Please try again.');
      } else {
        setLoadError(null);
      }
      setServices(svc ?? []);
      setBreaches(brc ?? []);
    } catch (err) {
      setLoadError(smErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const avgUptime = services.length
    ? services.reduce((a, s) => a + Number(s.uptime_percent), 0) / services.length
    : 0;
  const minSla = services.length
    ? Math.min(...services.map((s) => Number(s.sla_percent)))
    : 0;
  const breachingServices = services.filter((s) => Number(s.uptime_percent) < Number(s.sla_percent));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Uptime & SLA"
        subtitle="Service availability against agreed SLA targets"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
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
            onClick={() => void loadData()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Uptime Charts */}
      <div className="bento-card premium-halo enter-soft">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Service Uptime</h3>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading uptime data…</p>
        ) : services.length === 0 ? (
          <p className="text-muted-foreground text-sm">No services found</p>
        ) : (
          <div className="space-y-4">
            {services.map((item) => {
              const uptime = Number(item.uptime_percent);
              const sla = Number(item.sla_percent);
              const isBreach = uptime < sla;
              return (
                <div key={item.id} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium text-foreground truncate">{item.service_name}</div>
                  <div className="flex-1">
                    <div className="h-6 bg-surface rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full ${isBreach ? 'bg-destructive' : 'bg-accent-emerald'}`}
                        style={{ width: `${Math.min(100, uptime)}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-muted-foreground"
                        style={{ left: `${Math.min(100, sla)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <span className={`text-sm font-bold ${isBreach ? 'text-destructive' : 'text-accent-emerald'}`}>
                      {uptime}%
                    </span>
                  </div>
                  <div className="w-16 text-right text-xs text-muted-foreground">
                    SLA: {sla}%
                  </div>
                  {isBreach && <AlertTriangle className="w-4 h-4 text-destructive" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SLA Thresholds */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Lowest SLA Target</span>
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{minSla ? `${minSla}%` : '—'}</p>
          <p className={`text-xs mt-1 ${breachingServices.length === 0 ? 'text-accent-emerald' : 'text-destructive'}`}>
            {breachingServices.length === 0 ? 'All services meeting' : `${breachingServices.length} service(s) breaching`}
          </p>
        </div>
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-accent-emerald" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg Uptime</span>
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{avgUptime ? `${avgUptime.toFixed(2)}%` : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">Across {services.length} services</p>
        </div>
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-destructive" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">SLA Breaches</span>
          </div>
          <p className="mt-1 text-xl font-bold text-foreground">{breaches.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Recorded history</p>
        </div>
      </div>

      {/* Breach History */}
      <div className="bento-card premium-halo enter-soft">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Breach History</h3>
        {breaches.length === 0 ? (
          <p className="text-muted-foreground text-sm">No SLA breaches recorded</p>
        ) : (
          <div className="space-y-3">
            {breaches.map((breach) => (
              <div key={breach.id} className="flex items-center gap-4 p-3 bg-surface rounded-lg border border-border">
                <div className="w-28 text-sm text-muted-foreground">{new Date(breach.breach_date).toLocaleDateString()}</div>
                <div className="w-32 font-medium text-foreground truncate">{breach.service_name}</div>
                <div className="w-24 text-sm text-destructive">{breach.duration_minutes} min</div>
                <div className="flex-1 text-sm text-muted-foreground">{breach.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Read-only view — No actions available</p>
    </div>
  );
};

export default SMUptime;
