import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  History, Search, PlusCircle, Edit, Trash2,
  RefreshCw, Link2, Eye, Clock, Monitor
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DataStateNotice from './DataStateNotice';

type LogAction = 'add' | 'edit' | 'delete' | 'fix' | 'status_change' | 'url_update';

interface ActivityLog {
  id: string;
  action: LogAction;
  demoTitle: string;
  demoId: string;
  timestamp: string;
  sortKey: number;
  details: string;
  previousValue?: string;
  newValue?: string;
}

const relative = (iso: string | null): string => {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};

const actionFromString = (raw: string): LogAction => {
  const a = raw.toLowerCase();
  if (a.includes('delete') || a.includes('remove')) return 'delete';
  if (a.includes('url')) return 'url_update';
  if (a.includes('status')) return 'status_change';
  if (a.includes('fix') || a.includes('resolve') || a.includes('heal')) return 'fix';
  if (a.includes('create') || a.includes('add') || a.includes('insert')) return 'add';
  return 'edit';
};

const readMeta = (meta: unknown, keys: string[]): string | undefined => {
  if (!meta || typeof meta !== 'object') return undefined;
  const record = meta as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
};

const DemoActivityLogs = () => {
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['demo-manager', 'activity-logs'],
    queryFn: async (): Promise<ActivityLog[]> => {
      const [audit, validations] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('id, action, module, meta_json, timestamp')
          .ilike('module', '%demo%')
          .order('timestamp', { ascending: false })
          .limit(150),
        supabase
          .from('demo_validation_logs')
          .select('id, demo_id, demo_url, status, error_message, validation_type, validated_at, created_at')
          .order('created_at', { ascending: false })
          .limit(150),
      ]);

      // A permission block on the primary audit source must surface, not silently
      // fall back to a partial list.
      if (audit.error && validations.error) throw audit.error;

      const entries: ActivityLog[] = [];

      (audit.data ?? []).forEach((row) => {
        const ts = row.timestamp;
        entries.push({
          id: `audit-${row.id}`,
          action: actionFromString(row.action ?? ''),
          demoTitle:
            readMeta(row.meta_json, ['title', 'demo_title', 'demo_name', 'name']) ?? row.module ?? 'Demo',
          demoId: readMeta(row.meta_json, ['demo_id', 'id']) ?? '—',
          timestamp: relative(ts),
          sortKey: ts ? new Date(ts).getTime() : 0,
          details: `${row.action} · module ${row.module}`,
          previousValue: readMeta(row.meta_json, ['previous', 'old_value', 'from']),
          newValue: readMeta(row.meta_json, ['next', 'new_value', 'to']),
        });
      });

      (validations.data ?? []).forEach((row) => {
        const ts = row.validated_at ?? row.created_at;
        const ok = (row.status ?? '').toLowerCase() === 'success' || (row.status ?? '').toLowerCase() === 'healthy';
        entries.push({
          id: `validation-${row.id}`,
          action: ok ? 'fix' : 'status_change',
          demoTitle: row.demo_url ?? 'Demo URL check',
          demoId: row.demo_id ?? '—',
          timestamp: relative(ts),
          sortKey: ts ? new Date(ts).getTime() : 0,
          details: ok
            ? `${row.validation_type ?? 'validation'} passed`
            : `${row.validation_type ?? 'validation'} failed${row.error_message ? `: ${row.error_message}` : ''}`,
          newValue: row.status ?? undefined,
        });
      });

      return entries.sort((a, b) => b.sortKey - a.sortKey).slice(0, 200);
    },
  });

  const logs = useMemo(() => data ?? [], [data]);

  const getActionIcon = (action: LogAction) => {
    switch (action) {
      case 'add': return <PlusCircle className="w-4 h-4" />;
      case 'edit': return <Edit className="w-4 h-4" />;
      case 'delete': return <Trash2 className="w-4 h-4" />;
      case 'fix': return <RefreshCw className="w-4 h-4" />;
      case 'url_update': return <Link2 className="w-4 h-4" />;
      case 'status_change': return <Eye className="w-4 h-4" />;
    }
  };

  const getActionBadge = (action: LogAction) => {
    switch (action) {
      case 'add':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{getActionIcon(action)} Added</Badge>;
      case 'edit':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">{getActionIcon(action)} Edited</Badge>;
      case 'delete':
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">{getActionIcon(action)} Deleted</Badge>;
      case 'fix':
        return <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30">{getActionIcon(action)} Passed / Fixed</Badge>;
      case 'url_update':
        return <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">{getActionIcon(action)} URL Updated</Badge>;
      case 'status_change':
        return <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30">{getActionIcon(action)} Status Changed</Badge>;
    }
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.demoTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          log.details.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = !filterAction || log.action === filterAction;
    return matchesSearch && matchesFilter;
  });

  const actionFilters = [
    { value: null, label: 'All Actions' },
    { value: 'add', label: 'Added' },
    { value: 'edit', label: 'Edited' },
    { value: 'delete', label: 'Deleted' },
    { value: 'fix', label: 'Fixed' },
    { value: 'url_update', label: 'URL Updates' },
    { value: 'status_change', label: 'Status Changes' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <History className="w-7 h-7 text-cyan-400" />
            Demo Activity Log
          </h1>
          <p className="text-slate-400 mt-1">Track all demo changes - add, edit, delete, and fix actions</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            {logs.length} Total Actions
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search by demo title or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-800/50 border-slate-700"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {actionFilters.map((filter) => (
                <Button
                  key={filter.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterAction(filter.value)}
                  className={`border-slate-600 ${
                    filterAction === filter.value
                      ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <DataStateNotice
        isLoading={isLoading}
        error={error}
        isEmpty={filteredLogs.length === 0}
        hasSession={Boolean(session)}
        resource="demo activity logs"
        loadingLabel="Loading audit trail…"
        emptyIcon={<History className="w-8 h-8 text-slate-400" />}
        emptyTitle={logs.length === 0 ? 'No demo activity recorded yet' : 'No activity found'}
        emptyDescription={
          logs.length === 0
            ? 'Audit entries appear here as soon as demos are created, edited or validated.'
            : 'Try adjusting your search or filter criteria.'
        }
        onRetry={() => refetch()}
      >
        {/* Activity Timeline */}
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-500/50 via-slate-700/50 to-transparent" />

          <div className="space-y-4">
            {filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index, 10) * 0.05 }}
                className="relative pl-14"
              >
                <div className={`absolute left-4 top-4 w-4 h-4 rounded-full border-2 ${
                  log.action === 'add' ? 'bg-emerald-500/20 border-emerald-500' :
                  log.action === 'edit' ? 'bg-blue-500/20 border-blue-500' :
                  log.action === 'delete' ? 'bg-red-500/20 border-red-500' :
                  log.action === 'fix' ? 'bg-orange-500/20 border-orange-500' :
                  'bg-cyan-500/20 border-cyan-500'
                }`} />

                <Card className="bg-slate-900/50 border-slate-700/50 backdrop-blur-xl hover:border-cyan-500/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Monitor className="w-4 h-4 text-slate-500" />
                          <span className="font-semibold text-white break-all">{log.demoTitle}</span>
                          {getActionBadge(log.action)}
                        </div>

                        <p className="text-slate-400 text-sm mb-2">{log.details}</p>

                        {(log.previousValue || log.newValue) && (
                          <div className="flex items-center gap-2 text-xs mt-3 p-2 rounded-lg bg-slate-800/50">
                            {log.previousValue && (
                              <code className="text-red-400 line-through">{log.previousValue}</code>
                            )}
                            {log.previousValue && log.newValue && (
                              <span className="text-slate-500">→</span>
                            )}
                            {log.newValue && (
                              <code className="text-emerald-400">{log.newValue}</code>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
                        <Clock className="w-3 h-3" />
                        {log.timestamp}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </DataStateNotice>
    </div>
  );
};

export default DemoActivityLogs;
