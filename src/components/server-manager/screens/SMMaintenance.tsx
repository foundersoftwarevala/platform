import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { smQuery, smMutate } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface MaintenanceWindow {
  id: string;
  window_code: string;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  server_scope: string;
  impact: string;
  status: string;
}

interface RollingUpdate {
  id: string;
  component: string;
  current_version: string;
  target_version: string;
  servers_count: number;
  progress: number;
  status: string;
}

const formatRange = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toISOString().slice(0, 10);
  const sTime = s.toISOString().slice(11, 16);
  const eTime = e.toISOString().slice(11, 16);
  return `${dateStr} ${sTime} - ${eTime} UTC`;
};

const SMMaintenance = () => {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [updates, setUpdates] = useState<RollingUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    scope: '',
    impact: '',
    start: '',
    end: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [mw, ru] = await Promise.all([
        smQuery('maintenance windows', () =>
          supabase
            .from('server_maintenance_windows')
            .select('id, window_code, title, scheduled_start, scheduled_end, server_scope, impact, status')
            .order('scheduled_start', { ascending: true }),
        ),
        smQuery('rolling updates', () =>
          supabase
            .from('server_rolling_updates')
            .select('id, component, current_version, target_version, servers_count, progress, status')
            .order('created_at', { ascending: true }),
        ),
      ]);
      if (mw === null || ru === null) {
        setLoadError('Could not load maintenance data. Please retry.');
      }
      setWindows(mw ?? []);
      setUpdates(ru ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitWindow = async () => {
    if (!form.title || !form.scope || !form.start || !form.end) {
      toast.error('Please fill in title, scope, start and end');
      return;
    }
    setSaving(true);
    const windowCode = `MW-${Math.floor(1000 + Math.random() * 9000)}`;
    const ok = await smMutate(
      'schedule maintenance window',
      () =>
        supabase.from('server_maintenance_windows').insert({
          window_code: windowCode,
          title: form.title,
          server_scope: form.scope,
          impact: form.impact || 'To be determined',
          scheduled_start: new Date(form.start).toISOString(),
          scheduled_end: new Date(form.end).toISOString(),
          status: 'pending_approval',
          notes: form.notes || null,
        }),
    );

    if (ok) {
      await smMutate(
        'log maintenance audit entry',
        () =>
          supabase.from('server_audit_logs').insert({
            action: 'Maintenance Scheduled',
            actor: 'Server Manager',
            details: `${windowCode} scheduled: ${form.title}`,
            result: 'Pending',
            risk_level: 'medium',
          }),
      );
      toast.success(`${windowCode} scheduled — pending approval`);
      setDialogOpen(false);
      setForm({ title: '', scope: '', impact: '', start: '', end: '', notes: '' });
      await loadData();
    }
    setSaving(false);
  };

  const nextWindow = windows.find((w) => w.status !== 'completed' && w.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Schedule Maintenance
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>Schedule Maintenance Window</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Title</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-muted-foreground">Affected Servers/Scope</Label>
                  <Input value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="e.g. DB-MAIN-01, All Production Servers" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-muted-foreground">Start</Label>
                    <Input type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-muted-foreground">End</Label>
                    <Input type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Impact</Label>
                  <Input value={form.impact} onChange={(e) => setForm({ ...form, impact: e.target.value })} placeholder="e.g. Database unavailable" />
                </div>
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => void submitWindow()} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit for Approval
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button size="sm" variant="outline" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Planned Windows */}
      <Card className="bento-card">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Planned Maintenance Windows</h3>
        <div className="space-y-4">
          {loading && (
            <p className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</p>
          )}
          {!loading && windows.length === 0 && (
            <p className="text-muted-foreground text-sm">No maintenance windows scheduled.</p>
          )}
          {!loading &&
            windows.map((window) => (
              <div key={window.id} className="p-4 border border-border/60 rounded-lg bg-surface/60">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm text-muted-foreground">{window.window_code}</span>
                      <h4 className="font-semibold">{window.title}</h4>
                      <Badge className={
                        window.status === 'scheduled' ? 'bg-primary/10 text-primary border-primary/30' :
                        window.status === 'completed' ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30' :
                        'bg-accent-amber/10 text-accent-amber border-accent-amber/30'
                      }>
                        {window.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Scheduled</p>
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRange(window.scheduled_start, window.scheduled_end)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Affected</p>
                        <p>{window.server_scope}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Impact</p>
                        <p className="text-accent-amber flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {window.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </Card>

      {/* Rolling Updates Plan */}
      <Card className="bento-card">
        <h3 className="text-sm font-semibold tracking-tight mb-4">Rolling Updates Plan</h3>
        <div className="space-y-4">
          {loading && (
            <p className="text-muted-foreground text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</p>
          )}
          {!loading && updates.length === 0 && (
            <p className="text-muted-foreground text-sm">No rolling updates in progress.</p>
          )}
          {!loading &&
            updates.map((update) => (
              <div key={update.id} className="p-4 border border-border/60 rounded-lg bg-surface/60">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{update.component}</h4>
                    <p className="text-sm text-muted-foreground">
                      {update.current_version} → {update.target_version} · {update.servers_count} servers
                    </p>
                  </div>
                  <Badge className={
                    update.progress === 100 ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30' :
                    update.progress === 0 ? 'bg-surface text-muted-foreground border-border' :
                    'bg-primary/10 text-primary border-primary/30'
                  }>
                    {update.progress === 100 ? 'Complete' : update.progress === 0 ? 'Pending' : 'In Progress'}
                  </Badge>
                </div>
                <div className="h-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      update.progress === 100 ? 'bg-accent-emerald' : 'bg-primary'
                    }`}
                    style={{ width: `${update.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">{update.progress}% complete</p>
              </div>
            ))}
        </div>
      </Card>

      {/* Impact Preview */}
      <Card className="bento-card border-accent-amber/30 bg-accent-amber/10">
        <h3 className="text-sm font-semibold tracking-tight text-accent-amber mb-2">Impact Preview</h3>
        <ul className="text-sm text-accent-amber space-y-1">
          {nextWindow ? (
            <li>• Next maintenance: {new Date(nextWindow.scheduled_start).toISOString().slice(0, 10)} — {nextWindow.impact}</li>
          ) : (
            <li>• No upcoming maintenance windows</li>
          )}
          <li>• Affected scope: {nextWindow?.server_scope ?? '—'}</li>
          <li>• Recommended: Schedule non-critical deployments after maintenance</li>
        </ul>
      </Card>

      <p className="text-xs text-muted-foreground">⚠️ Schedule Maintenance requires approval</p>
    </div>
  );
};

export default SMMaintenance;
