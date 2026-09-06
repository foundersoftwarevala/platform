import { useState, useEffect, useCallback } from 'react';
import { Eye, Lock, FileText, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { smQuery, smErrorMessage } from '@/lib/sm-data';
import { PageHeader } from '../layout/PageShell';

interface AuditRow {
  id: string;
  created_at: string;
  action: string;
  actor: string;
  result: string;
  details: string | null;
  risk_level: string;
}

const formatTimestamp = (iso: string) =>
  new Date(iso).toISOString().replace('T', ' ').slice(0, 19);

const SMAudit = () => {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('server_audit_logs')
        .select('id, created_at, action, actor, result, details, risk_level')
        .order('created_at', { ascending: false })
        .limit(200);

      if (riskFilter !== 'all') query = query.eq('risk_level', riskFilter);
      if (resultFilter !== 'all') query = query.eq('result', resultFilter);

      const data = await smQuery('audit logs', () => query);
      if (data === null) {
        setLoadError('Could not load audit logs. Please try again.');
        setLogs([]);
      } else {
        setLoadError(null);
        setLogs(data);
      }
    } catch (err) {
      setLoadError(smErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [riskFilter, resultFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        subtitle="Immutable record of all server actions"
        action={
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="flex items-center gap-1 bg-surface text-muted-foreground">
              <Eye className="w-3 h-3" />
              Read Only
            </Badge>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="w-3 h-3" />
              <span>Immutable logs</span>
            </div>
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

      <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
        <p className="text-sm text-primary flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Audit logs are immutable and cannot be modified or deleted. All server actions are logged permanently.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Result" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Results</SelectItem>
            <SelectItem value="Success">Success</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Denied">Denied</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Escalated">Escalated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Audit Logs Table */}
      <div className="bento-card enter-soft !p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface/60 text-xs uppercase tracking-wider text-muted-foreground">
              <th className="text-left px-6 py-4 font-medium">Time</th>
              <th className="text-left px-6 py-4 font-medium">Action</th>
              <th className="text-left px-6 py-4 font-medium">Actor</th>
              <th className="text-left px-6 py-4 font-medium">Risk</th>
              <th className="text-left px-6 py-4 font-medium">Result</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2 text-primary" /> Loading audit logs...
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No audit records match your filters.
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border/60 hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm whitespace-nowrap">{formatTimestamp(log.created_at)}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-foreground">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.details ?? '—'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-sm">{log.actor}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={
                      log.risk_level === 'critical' ? 'border-destructive/40 text-destructive' :
                      log.risk_level === 'high' ? 'border-accent-amber/40 text-accent-amber' :
                      log.risk_level === 'medium' ? 'border-primary/40 text-primary' :
                      'border-border text-muted-foreground'
                    }>
                      {log.risk_level}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={
                      log.result === 'Success' || log.result === 'Approved' ? 'bg-accent-emerald/10 text-accent-emerald border-accent-emerald/30' :
                      log.result === 'Denied' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                      log.result === 'Pending' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' :
                      'bg-primary/10 text-primary border-primary/30'
                    }>
                      {log.result}
                    </Badge>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">Read-only view — Audit logs cannot be modified or exported</p>
    </div>
  );
};

export default SMAudit;
