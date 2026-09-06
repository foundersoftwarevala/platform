import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database, Clock, CheckCircle, XCircle, Play, RefreshCw,
  Calendar, HardDrive, Download, Trash2, Plus,
  AlertTriangle, Shield, History, Server, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '../layout/PageShell';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smMutate } from '@/lib/sm-data';

interface ScheduleRow {
  id: string;
  schedule_name: string;
  frequency: string;
  backup_type: string;
  retention_days: number;
  is_enabled: boolean;
  last_run_at: string | null;
  last_status: string;
  next_run_at: string | null;
  server_id: string | null;
  server_name: string;
}

interface JobRow {
  id: string;
  job_name: string;
  backup_type: string;
  status: string;
  size_gb: number;
  progress: number;
  created_at: string;
  server_name: string;
}

interface RestorePointRow {
  id: string;
  point_name: string;
  point_code: string;
  captured_at: string;
  size_gb: number;
  verified: boolean;
  server_id: string | null;
  server_name: string;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

const SMBackupManager = () => {
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [restorePoints, setRestorePoints] = useState<RestorePointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<RestorePointRow | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sched, jobRows, rp] = await Promise.all([
        smQuery('backup schedules', () =>
          supabase
            .from('server_backup_schedules')
            .select('*, server_instances(server_name)')
            .order('created_at', { ascending: false }),
        ),
        smQuery('backup jobs', () =>
          supabase
            .from('server_backup_jobs')
            .select('*, server_instances(server_name)')
            .order('created_at', { ascending: false })
            .limit(20),
        ),
        smQuery('restore points', () =>
          supabase
            .from('server_restore_points')
            .select('*, server_instances(server_name)')
            .order('captured_at', { ascending: false })
            .limit(20),
        ),
      ]);

      if (sched === null || jobRows === null || rp === null) {
        setLoadError('Could not load backup data. Please retry.');
      }

    setSchedules(
      (sched ?? []).map((s) => ({
        id: s.id,
        schedule_name: s.schedule_name,
        frequency: s.frequency,
        backup_type: s.backup_type,
        retention_days: s.retention_days,
        is_enabled: s.is_enabled,
        last_run_at: s.last_run_at,
        last_status: s.last_status,
        next_run_at: s.next_run_at,
        server_id: s.server_id,
        server_name:
          (s as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Unassigned',
      })),
    );

    setJobs(
      (jobRows ?? []).map((j) => ({
        id: j.id,
        job_name: j.job_name,
        backup_type: j.backup_type,
        status: j.status,
        size_gb: Number(j.size_gb || 0),
        progress: j.progress,
        created_at: j.created_at,
        server_name:
          (j as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Unassigned',
      })),
    );

    setRestorePoints(
      (rp ?? []).map((r) => ({
        id: r.id,
        point_name: r.point_name,
        point_code: r.point_code,
        captured_at: r.captured_at,
        size_gb: Number(r.size_gb || 0),
        verified: r.verified,
        server_id: r.server_id,
        server_name:
          (r as unknown as { server_instances?: { server_name?: string } }).server_instances
            ?.server_name ?? 'Unassigned',
      })),
    );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleSchedule = async (schedule: ScheduleRow) => {
    const ok = await smMutate(
      'update backup schedule',
      () =>
        supabase
          .from('server_backup_schedules')
          .update({ is_enabled: !schedule.is_enabled })
          .eq('id', schedule.id),
      'Backup schedule updated',
    );
    if (ok) void loadData();
  };

  const handleRunBackup = async (schedule: ScheduleRow) => {
    setRunningId(schedule.id);
    const ok = await smMutate(
      'start backup job',
      () =>
        supabase.from('server_backup_jobs').insert({
          job_code: `JOB-${Date.now().toString(36).toUpperCase()}`,
          job_name: schedule.schedule_name,
          backup_type: schedule.backup_type,
          status: 'running',
          progress: 0,
          server_id: schedule.server_id,
          retention_days: schedule.retention_days,
          encryption_enabled: true,
        }),
      `Backup job started for ${schedule.schedule_name}`,
    );
    setRunningId(null);
    if (ok) void loadData();
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    const ok = await smMutate(
      'log restore request',
      () =>
        supabase.from('server_audit_logs').insert({
          action: 'restore_from_backup',
          actor: 'current_user',
          result: 'success',
          risk_level: 'high',
          details: `Restore requested from point ${restoreTarget.point_code} (${restoreTarget.point_name}) for ${restoreTarget.server_name}`,
          server_id: restoreTarget.server_id,
        }),
      `Restore initiated from ${restoreTarget.point_name}`,
    );
    setRestoring(false);
    setRestoreTarget(null);
    if (!ok) return;
  };

  const totalStorageGb = jobs.reduce((a, j) => a + j.size_gb, 0) + restorePoints.reduce((a, r) => a + r.size_gb, 0);
  const successCount = jobs.filter((j) => j.status === 'completed' || j.status === 'success').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup Manager"
        subtitle="Automated backup schedules & restore points"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadData()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button disabled>
              <Plus className="w-4 h-4 mr-2" />
              Create Backup Job
            </Button>
          </div>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/15">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Schedules</p>
              <p className="mt-1 text-xl font-bold">{schedules.length}</p>
            </div>
          </div>
        </div>
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-emerald/10">
              <CheckCircle className="w-5 h-5 text-accent-emerald" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Successful Jobs</p>
              <p className="mt-1 text-xl font-bold text-accent-emerald">{successCount}</p>
            </div>
          </div>
        </div>
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Failed Jobs</p>
              <p className="mt-1 text-xl font-bold text-destructive">{failedCount}</p>
            </div>
          </div>
        </div>
        <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-pink/10">
              <HardDrive className="w-5 h-5 text-accent-pink" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tracked Storage</p>
              <p className="mt-1 text-xl font-bold text-accent-pink">{totalStorageGb.toFixed(1)} GB</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bento-card !p-0">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Scheduled Backups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : schedules.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No backup schedules found.</p>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-3">
                  {schedules.map((s) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`p-4 rounded-xl border ${
                        s.last_status === 'failed' ? 'bg-destructive/10 border-destructive/30' : 'bg-surface/60 border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{s.schedule_name}</h4>
                            <Badge className="text-xs bg-primary/15 text-primary">{s.backup_type}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Server className="w-3 h-3" /> {s.server_name}
                          </p>
                        </div>
                        <Switch checked={s.is_enabled} onCheckedChange={() => void toggleSchedule(s)} />
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div>
                          <span className="text-muted-foreground">Frequency:</span>
                          <p className="capitalize">{s.frequency}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retention:</span>
                          <p>{s.retention_days} days</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Run:</span>
                          <p>{fmtDate(s.last_run_at)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Next Run:</span>
                          <p>{fmtDate(s.next_run_at)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <Badge className={`${
                          s.last_status === 'success' ? 'bg-accent-emerald/10 text-accent-emerald' : 'bg-destructive/10 text-destructive'
                        }`}>
                          {s.last_status === 'success' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                          {s.last_status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleRunBackup(s)}
                          disabled={runningId === s.id}
                        >
                          {runningId === s.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                          Run Now
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="bento-card !p-0">
          <CardHeader>
            <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
              <History className="w-5 h-5 text-accent-emerald" />
              Available Restore Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
            ) : restorePoints.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No restore points found.</p>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {restorePoints.map((point) => (
                    <div key={point.id} className="p-3 rounded-lg bg-surface/60 border border-border hover:border-accent-emerald/30 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${point.verified ? 'bg-accent-emerald/10' : 'bg-accent-amber/10'}`}>
                            {point.verified ? (
                              <Shield className="w-4 h-4 text-accent-emerald" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-accent-amber" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{point.point_name}</span>
                              {point.verified && (
                                <Badge className="bg-accent-emerald/10 text-accent-emerald text-xs">Verified</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>{fmtDate(point.captured_at)}</span>
                              <span>•</span>
                              <span>{point.size_gb.toFixed(1)} GB</span>
                              <span>•</span>
                              <span>{point.server_name}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={() => toast.info('Preparing download link…')}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-accent-emerald hover:text-accent-emerald/80" onClick={() => setRestoreTarget(point)}>
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="mt-4 p-3 rounded-lg bg-accent-amber/10 border border-accent-amber/30">
              <div className="flex items-center gap-2 text-accent-amber text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>Restoring will overwrite current data. Proceed with caution.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> Confirm Restore
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will restore <span className="text-foreground font-medium">{restoreTarget?.server_name}</span> from restore point{' '}
              <span className="text-foreground font-medium">{restoreTarget?.point_name}</span> captured at{' '}
              {restoreTarget ? fmtDate(restoreTarget.captured_at) : ''}. Current data will be overwritten. This action is audited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => void confirmRestore()} disabled={restoring}>
              {restoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SMBackupManager;
