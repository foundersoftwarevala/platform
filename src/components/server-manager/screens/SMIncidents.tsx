import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle, ArrowUpRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';
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

interface Incident {
  id: string;
  incident_code: string;
  incident_type: string;
  severity: string;
  status: string;
  summary: string;
  opened_at: string;
  resolved_at: string | null;
  server_id: string | null;
  server_name: string;
}

const formatRelative = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

const SMIncidents = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await smQuery('incidents', () =>
        supabase
          .from('server_incidents')
          .select('id, incident_code, incident_type, severity, status, summary, opened_at, resolved_at, server_id, server_instances(server_name)')
          .order('opened_at', { ascending: false }),
      );

      if (data === null) {
        setLoadError('Failed to load incidents.');
        setIncidents([]);
        return;
      }
      setLoadError(null);

      setIncidents(
        (data ?? []).map((i) => ({
          id: i.id,
          incident_code: i.incident_code,
          incident_type: i.incident_type,
          severity: i.severity,
          status: i.status,
          summary: i.summary,
          opened_at: i.opened_at,
          resolved_at: i.resolved_at,
          server_id: i.server_id,
          server_name:
            (i as unknown as { server_instances?: { server_name?: string } }).server_instances
              ?.server_name ?? 'Infrastructure',
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const logAudit = async (action: string, details: string, incident: Incident) => {
    await smMutate('audit log entry', () =>
      supabase.from('server_audit_logs').insert({
        action,
        actor: 'Server Manager',
        details,
        result: 'Success',
        risk_level: incident.severity === 'critical' ? 'high' : 'medium',
        server_id: incident.server_id,
      }),
    );
  };

  const acknowledge = async (incident: Incident) => {
    setBusyId(incident.id);
    const ok = await smMutate(
      'acknowledge incident',
      () =>
        supabase
          .from('server_incidents')
          .update({ status: 'acknowledged' })
          .eq('id', incident.id),
      `${incident.incident_code} acknowledged`,
    );
    if (ok) {
      await logAudit('Incident Acknowledged', `${incident.incident_code} acknowledged`, incident);
      await loadData();
    }
    setBusyId(null);
  };

  const escalate = async (incident: Incident) => {
    setBusyId(incident.id);
    const ok = await smMutate(
      'escalate incident',
      () =>
        supabase
          .from('server_incidents')
          .update({ status: 'in_progress' })
          .eq('id', incident.id),
      `${incident.incident_code} escalated`,
    );
    if (ok) {
      await logAudit('Incident Escalated', `${incident.incident_code} escalated to Super Admin`, incident);
      await loadData();
    }
    setBusyId(null);
  };

  const resolveCritical = async (incident: Incident) => {
    setBusyId(incident.id);
    const ok = await smMutate(
      'resolve incident',
      () =>
        supabase
          .from('server_incidents')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: 'Approved and resolved via Server Manager',
          })
          .eq('id', incident.id),
      `${incident.incident_code} resolved`,
    );
    if (ok) {
      await logAudit('Critical Incident Resolved', `${incident.incident_code} resolved with approval`, incident);
      await loadData();
    }
    setBusyId(null);
    setConfirmId(null);
  };

  const counts = {
    critical: incidents.filter((i) => i.severity === 'critical').length,
    warning: incidents.filter((i) => i.severity === 'warning').length,
    info: incidents.filter((i) => i.severity === 'info').length,
    resolvedToday: incidents.filter(
      (i) => i.status === 'resolved' && i.resolved_at && new Date(i.resolved_at).toDateString() === new Date().toDateString(),
    ).length,
  };

  const confirmIncident = incidents.find((i) => i.id === confirmId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Alerts & Incidents" subtitle="Triage, escalate, and resolve infrastructure incidents" />

      {loadError && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">Critical</p>
            <p className="text-2xl font-bold text-destructive">{counts.critical}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-accent-amber">Warning</p>
            <p className="text-2xl font-bold text-accent-amber">{counts.warning}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-primary">Info</p>
            <p className="text-2xl font-bold text-primary">{counts.info}</p>
          </CardContent>
        </Card>
        <Card className="bento-card premium-halo hover-lift !p-0">
          <CardContent className="p-4">
            <p className="text-sm text-accent-emerald">Resolved Today</p>
            <p className="text-2xl font-bold text-accent-emerald">{counts.resolvedToday}</p>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card className="bento-card overflow-hidden !p-0">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-surface/60">
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Incident ID</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Type</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Severity</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Affected</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left px-6 py-4 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading incidents...
                </td>
              </tr>
            )}
            {!loading && incidents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                  No incidents recorded.
                </td>
              </tr>
            )}
            {!loading &&
              incidents.map((incident, idx) => (
                <tr
                  key={incident.id}
                  className={`border-b border-border/60 hover:bg-surface/60 transition-colors ${idx === incidents.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{incident.incident_code}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(incident.opened_at)}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-foreground">{incident.incident_type}</td>
                  <td className="px-6 py-4">
                    <Badge className={
                       incident.severity === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                       incident.severity === 'warning' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' :
                       'bg-primary/10 text-primary border-primary/30'
                    }>
                      {incident.severity}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{incident.server_name}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={
                       incident.status === 'resolved' ? 'border-accent-emerald/40 text-accent-emerald' :
                       incident.status === 'in_progress' ? 'border-primary/40 text-primary' :
                       'border-border text-muted-foreground'
                    }>
                      {incident.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {incident.status !== 'resolved' && (
                      <div className="flex gap-2">
                        {incident.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={busyId === incident.id}
                            onClick={() => void acknowledge(incident)}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        {incident.status !== 'in_progress' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            disabled={busyId === incident.id}
                            onClick={() => void escalate(incident)}
                          >
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            Escalate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-accent-emerald/40 text-accent-emerald"
                            disabled={busyId === incident.id}
                            onClick={() => {
                              if (incident.severity === 'critical') {
                                setConfirmId(incident.id);
                              } else {
                                void resolveCritical(incident);
                              }
                            }}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Critical incident resolution requires approval
      </p>

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Approve critical incident resolution?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmIncident ? `${confirmIncident.incident_code} is a critical incident. Resolving it requires explicit approval and will be recorded in the audit log.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmIncident && void resolveCritical(confirmIncident)}
            >
              Approve & Resolve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SMIncidents;
