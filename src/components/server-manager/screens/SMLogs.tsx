import { useState, useEffect, useCallback } from 'react';
import { Lock, Filter, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface LogRow {
  id: string;
  logged_at: string;
  level: string;
  message: string;
  service_name: string | null;
  server_name: string;
}

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'];

const formatTimestamp = (iso: string) =>
  new Date(iso).toISOString().replace('T', ' ').slice(0, 19);

const SMLogs = () => {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('server_logs')
        .select('id, logged_at, level, message, service_name, server_instances(server_name)')
        .order('logged_at', { ascending: false })
        .limit(100);

      if (level !== 'all') {
        query = query.eq('level', level);
      }
      if (search.trim()) {
        query = query.ilike('message', `%${search.trim()}%`);
      }

      const data = await smQuery('logs', () => query);
      if (data === null) {
        setLoadError('Could not load logs. Please try again.');
        setLogs([]);
      } else {
        setLoadError(null);
        setLogs(
          data.map((l) => ({
            id: l.id,
            logged_at: l.logged_at,
            level: l.level,
            message: l.message,
            service_name: l.service_name,
            server_name:
              (l as unknown as { server_instances?: { server_name?: string } }).server_instances
                ?.server_name ?? 'Infrastructure',
          })),
        );
      }
    } catch (err) {
      setLoadError(smErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, level]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 300);
    return () => clearTimeout(timer);
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs"
        subtitle="Live infrastructure and service logs"
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>No export · No copy</span>
          </div>
        }
      />

      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 h-9"
          />
        </div>
        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <Badge
              key={l}
              variant="outline"
              onClick={() => setLevel(l)}
              className={`cursor-pointer capitalize ${
                level === l
                  ? l === 'error'
                    ? 'bg-destructive/20 text-destructive border-destructive/40'
                    : l === 'warn'
                    ? 'bg-accent-amber/20 text-accent-amber border-accent-amber/40'
                    : l === 'info'
                    ? 'bg-primary/20 text-primary border-primary/40'
                    : 'bg-surface text-foreground border-border'
                  : 'text-muted-foreground border-border hover:bg-surface'
              }`}
            >
              {l}
            </Badge>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bento-card enter-soft !p-0 overflow-hidden">
        <table
          className="w-full select-none"
          onCopy={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <thead>
            <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-4 font-medium">Timestamp</th>
              <th className="text-left px-6 py-4 font-medium">Server/Service</th>
              <th className="text-left px-6 py-4 font-medium">Level</th>
              <th className="text-left px-6 py-4 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-primary" /> Loading logs...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                  No logs match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/60 hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-6 py-3 text-muted-foreground font-mono text-sm whitespace-nowrap">{formatTimestamp(log.logged_at)}</td>
                  <td className="px-6 py-3">
                    <div>
                      <p className="font-medium text-foreground text-sm">{log.server_name}</p>
                      <p className="text-xs text-muted-foreground">{log.service_name ?? '—'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <Badge className={
                      log.level === 'error' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      log.level === 'warn' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' :
                      log.level === 'debug' ? 'bg-surface text-muted-foreground border-border' :
                      'bg-primary/10 text-primary border-primary/30'
                    }>
                      {log.level}
                    </Badge>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-sm max-w-md truncate">{log.message}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-accent-amber/30 bg-accent-amber/10 p-3">
        <p className="text-xs text-accent-amber">
          ❌ <strong>Export disabled</strong> · ❌ <strong>Copy disabled</strong> — Logs are view-only for security compliance
        </p>
      </div>
    </div>
  );
};

export default SMLogs;
