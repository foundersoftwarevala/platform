import { useState, useEffect, useCallback } from 'react';
import { HardDrive, Database, Server, Loader2, Archive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface ServerStorageRow {
  id: string;
  server_name: string;
  provider: string;
  storage_gb: number;
}

const SMBackups = () => {
  const [servers, setServers] = useState<ServerStorageRow[] | null>(null);
  const [backupTotalGb, setBackupTotalGb] = useState<number | null>(null);
  const [restoreTotalGb, setRestoreTotalGb] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [srv, jobs, rp] = await Promise.all([
        smQuery('server storage', () =>
          supabase
            .from('server_instances')
            .select('id, server_name, provider, storage_gb')
            .neq('status', 'decommissioned')
            .order('storage_gb', { ascending: false }),
        ),
        smQuery('backup jobs', () => supabase.from('server_backup_jobs').select('size_gb')),
        smQuery('restore points', () => supabase.from('server_restore_points').select('size_gb')),
      ]);

      if (srv === null || jobs === null || rp === null) {
        setLoadError('Could not load backup and storage data. Please try again.');
        setServers(null);
        setBackupTotalGb(null);
        setRestoreTotalGb(null);
        return;
      }
      setLoadError(null);

      setServers(
        srv.map((s) => ({
          id: s.id,
          server_name: s.server_name,
          provider: s.provider,
          storage_gb: Number(s.storage_gb || 0),
        })),
      );
      setBackupTotalGb(jobs.reduce((a, j) => a + Number(j.size_gb || 0), 0));
      setRestoreTotalGb(rp.reduce((a, r) => a + Number(r.size_gb || 0), 0));
    } catch (err) {
      setLoadError(smErrorMessage(err));
      setServers(null);
      setBackupTotalGb(null);
      setRestoreTotalGb(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalStorage = servers?.reduce((a, s) => a + s.storage_gb, 0) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Storage & Backup Capacity" subtitle="Profiled capacity and recorded backup entries; live disk usage is unavailable" />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/15">
                <HardDrive className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Provisioned Storage</p>
                <p className="mt-1 text-xl font-bold">{totalStorage == null ? '—' : `${totalStorage.toFixed(0)} GB`}</p>
              </div>
            </div>
            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-pink/10">
                <Database className="w-5 h-5 text-accent-pink" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recorded Backup Job Volume</p>
                <p className="mt-1 text-xl font-bold text-accent-pink">{backupTotalGb == null ? '—' : `${backupTotalGb.toFixed(1)} GB`}</p>
              </div>
            </div>
            <div className="bento-card premium-halo hover-lift shimmer-sweep enter-soft !p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent-emerald/10">
                <Archive className="w-5 h-5 text-accent-emerald" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recorded Restore Point Volume</p>
                <p className="mt-1 text-xl font-bold text-accent-emerald">{restoreTotalGb == null ? '—' : `${restoreTotalGb.toFixed(1)} GB`}</p>
              </div>
            </div>
          </div>

          <Card className="bento-card !p-0">
            <CardHeader>
              <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Per-Server Disk Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              {servers === null ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Server storage data unavailable.</p>
              ) : servers.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">No server storage data available.</p>
              ) : (
                <div className="space-y-4">
                  {servers.map((s) => (
                    <div key={s.id} className="p-3 rounded-lg bg-surface/60 border border-border/60">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.server_name}</span>
                          <Badge variant="outline" className="text-xs">{s.provider}</Badge>
                        </div>
                        <span className="text-muted-foreground text-sm font-mono">
                          {s.storage_gb.toFixed(0)} GB profiled · usage unavailable
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default SMBackups;
