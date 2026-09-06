/**
 * AUDIT LOGS (READ ONLY) — live enterprise audit trail.
 * Real data from the audit_logs table • searchable • filterable • CSV export
 * No edit • No delete
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Shield, Download, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAuditTrail } from '@/hooks/useDevManagerData';
import { downloadCsv } from '@/lib/export-csv';

const PAGE_SIZE = 25;

const MODULES = [
  { value: 'all', label: 'All modules' },
  { value: 'dev_manager', label: 'Dev Manager' },
  { value: 'escalations', label: 'Escalations' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'auth', label: 'Authentication' },
];

export const DMAuditLogs: React.FC = () => {
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, error, refetch } = useAuditTrail({
    page,
    pageSize: PAGE_SIZE,
    search,
    module,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = () => {
    downloadCsv(
      'audit-logs',
      entries.map((e) => ({ ...e })),
      [
        { key: 'shortId', label: 'Log ID' },
        { key: 'timestamp', label: 'Timestamp (UTC)' },
        { key: 'module', label: 'Module' },
        { key: 'action', label: 'Action' },
        { key: 'actor', label: 'Actor' },
        { key: 'target', label: 'Target' },
        { key: 'meta', label: 'Metadata' },
      ],
    );
  };

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} recorded actions` : 'Complete system activity log'}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            aria-label="Refresh audit logs"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={handleExport} disabled={entries.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </header>

      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center gap-3 py-4">
          <Shield className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-500 font-medium">
            READ ONLY • NO EDIT • NO DELETE
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Activity Log
          </CardTitle>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search actions…"
                aria-label="Search audit actions"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Select
              value={module}
              onValueChange={(value) => {
                setModule(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Filter by module">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">
              Audit trail unavailable. {error instanceof Error ? error.message : ''}
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No audit entries match this filter yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((log) => (
                <li
                  key={log.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border bg-muted/30 p-3"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-4">
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {log.shortId}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {log.action}
                    </Badge>
                    <span className="truncate text-sm">
                      <span className="font-mono">{log.actor}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-mono">{log.target}</span>
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">{log.module}</span>
                  </div>
                  <time
                    className="shrink-0 font-mono text-xs text-muted-foreground"
                    dateTime={log.timestamp}
                  >
                    {log.timestamp.replace('T', ' ').slice(0, 19)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE_SIZE && (
            <nav
              className="mt-4 flex items-center justify-between gap-2"
              aria-label="Audit log pagination"
            >
              <span className="text-xs text-muted-foreground">
                Page {page} of {lastPage}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </nav>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DMAuditLogs;
