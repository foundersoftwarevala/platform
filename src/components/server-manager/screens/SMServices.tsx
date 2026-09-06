import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

type ServiceRow = Database['public']['Tables']['server_services']['Row'] & {
  server_instances: { server_name: string } | null;
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'running':
      return 'bg-accent-emerald/10 text-accent-emerald border border-accent-emerald/30';
    case 'warning':
      return 'bg-accent-amber/10 text-accent-amber border border-accent-amber/30';
    default:
      return 'bg-destructive/10 text-destructive border border-destructive/30';
  }
};

const SMServices = () => {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restartTarget, setRestartTarget] = useState<ServiceRow | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [healthTarget, setHealthTarget] = useState<ServiceRow | null>(null);

  const loadServices = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await smQuery('services', () =>
        supabase
          .from('server_services')
          .select('*, server_instances(server_name)')
          .order('service_name', { ascending: true }),
      );
      if (data === null) setLoadError('Could not load services. Please try again.');
      setServices((data ?? []) as unknown as ServiceRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const handleRestart = async () => {
    if (!restartTarget) return;
    setRestarting(true);
    try {
      const ok = await smMutate(
        `Restart ${restartTarget.service_name}`,
        async () => {
          const { error: updateError } = await supabase
            .from('server_services')
            .update({ status: 'running', updated_at: new Date().toISOString() })
            .eq('id', restartTarget.id);
          if (updateError) return { data: null, error: updateError };

          const { error: logError } = await supabase.from('server_audit_logs').insert({
            action: `Restarted service "${restartTarget.service_name}"`,
            actor: 'admin',
            result: 'success',
            risk_level: 'low',
            server_id: restartTarget.server_id,
            details: `Service ${restartTarget.service_name} restarted on ${restartTarget.server_instances?.server_name ?? 'unknown server'}`,
          });
          return { data: null, error: logError };
        },
        `${restartTarget.service_name} restarted successfully`,
      );
      if (ok) {
        setRestartTarget(null);
        await loadServices();
      }
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="space-y-6">
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadServices()}>
            Retry
          </Button>
        </div>
      )}

      <PageHeader
        title="Services"
        subtitle="Managed services running across the fleet"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadServices()}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="bento-card premium-halo enter-soft overflow-hidden !p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-4 font-medium">Service Name</th>
              <th className="text-left px-6 py-4 font-medium">Server</th>
              <th className="text-left px-6 py-4 font-medium">Status</th>
              <th className="text-left px-6 py-4 font-medium">Port</th>
              <th className="text-left px-6 py-4 font-medium">Restart Policy</th>
              <th className="text-left px-6 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading services…</td>
              </tr>
            )}
            {!loading && services.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No services found</td>
              </tr>
            )}
            {!loading && services.map((service) => (
              <tr
                key={service.id}
                className="border-b border-border/60 hover:bg-white/[0.03] transition-colors"
              >
                <td className="px-6 py-4 font-medium text-foreground">{service.service_name}</td>
                <td className="px-6 py-4 text-foreground">{service.server_instances?.server_name ?? '—'}</td>
                <td className="px-6 py-4">
                  <Badge className={statusBadgeClass(service.status)}>{service.status}</Badge>
                </td>
                <td className="px-6 py-4 text-foreground font-mono text-sm">{service.port ?? '—'}</td>
                <td className="px-6 py-4 text-muted-foreground text-sm">{service.restart_policy}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => setRestartTarget(service)}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Restart
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setHealthTarget(service)}
                    >
                      <Activity className="w-3 h-3 mr-1" />
                      Health
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">⚠️ Restart actions require approval</p>

      <AlertDialog open={!!restartTarget} onOpenChange={(open) => !open && setRestartTarget(null)}>
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Restart {restartTarget?.service_name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will set the service status back to "running" and log the action to the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={restarting}
              onClick={(e) => {
                e.preventDefault();
                void handleRestart();
              }}
            >
              {restarting ? 'Restarting…' : 'Confirm Restart'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!healthTarget} onOpenChange={(open) => !open && setHealthTarget(null)}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {healthTarget?.service_name} Health
            </DialogTitle>
          </DialogHeader>
          {healthTarget && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">CPU Usage</span>
                  <span className="text-foreground font-medium">{healthTarget.cpu_percent}%</span>
                </div>
                <Progress value={Number(healthTarget.cpu_percent)} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-muted-foreground text-xs mb-1">Memory</p>
                  <p className="text-foreground font-bold">{healthTarget.memory_mb} MB</p>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-muted-foreground text-xs mb-1">Uptime</p>
                  <p className="text-accent-emerald font-bold">{healthTarget.uptime_percent}%</p>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-muted-foreground text-xs mb-1">SLA Target</p>
                  <p className="text-primary font-bold">{healthTarget.sla_percent}%</p>
                </div>
                <div className="p-3 rounded-lg bg-surface border border-border">
                  <p className="text-muted-foreground text-xs mb-1">Version</p>
                  <p className="text-foreground font-bold">{healthTarget.version ?? '—'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SMServices;
