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
import { useAuditTrail, useAuditTrailExport } from '@/hooks/useDevManagerData';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/export-csv';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { MessageKey } from '@/lib/i18n/messages';

const PAGE_SIZE = 25;

const MODULES: { value: string; label: MessageKey }[] = [
  { value: 'all', label: 'devmanager.audit.module_all' },
  { value: 'dev_manager', label: 'devmanager.audit.module_dev_manager' },
  { value: 'escalations', label: 'devmanager.audit.module_escalations' },
  { value: 'tasks', label: 'devmanager.audit.module_tasks' },
  { value: 'auth', label: 'devmanager.audit.module_auth' },
];

// The trail is recorded in UTC, and is shown in UTC as it always was.
const TIMESTAMP: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' };

export const DMAuditLogs: React.FC = () => {
  const { t, formatDate, formatNumber } = useTranslation();
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const exportTrail = useAuditTrailExport();

  const { data, isLoading, isFetching, error, refetch } = useAuditTrail({
    page,
    pageSize: PAGE_SIZE,
    search,
    module,
  });

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The whole filtered trail, not only the 25 rows on screen.
  const handleExport = async () => {
    setExporting(true);
    let rows: typeof entries;
    try {
      rows = await exportTrail({ search, module });
    } catch (e) {
      toast.error(t('devmanager.audit.export_failed'), { description: e instanceof Error ? e.message : undefined });
      return;
    } finally {
      setExporting(false);
    }
    downloadCsv(
      'audit-logs',
      rows.map((e) => ({ ...e })),
      [
        { key: 'shortId', label: t('devmanager.audit.csv_log_id') },
        { key: 'timestamp', label: t('devmanager.audit.csv_timestamp') },
        { key: 'module', label: t('devmanager.audit.csv_module') },
        { key: 'action', label: t('devmanager.audit.csv_action') },
        { key: 'actor', label: t('devmanager.audit.csv_actor') },
        { key: 'target', label: t('devmanager.audit.csv_target') },
        { key: 'meta', label: t('devmanager.audit.csv_metadata') },
      ],
    );
  };

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{t('devmanager.audit.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? t('devmanager.audit.recorded_actions', { count: total })
              : t('devmanager.audit.subtitle')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            aria-label={t('devmanager.audit.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" onClick={() => void handleExport()} disabled={entries.length === 0 || exporting}>
            <Download className="mr-2 h-4 w-4" />
            {t('devmanager.audit.export_csv')}
          </Button>
        </div>
      </header>

      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center gap-3 py-4">
          <Shield className="h-5 w-5 text-amber-500 shrink-0" />
          <span className="text-sm text-amber-500 font-medium">
            {t('devmanager.audit.read_only')}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('devmanager.audit.activity_log')}
          </CardTitle>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('devmanager.audit.search_placeholder')}
                aria-label={t('devmanager.audit.search_label')}
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
              <SelectTrigger aria-label={t('devmanager.audit.filter_module')}>
                <SelectValue placeholder={t('devmanager.audit.module_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {MODULES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div
              className="space-y-2"
              aria-busy="true"
              role="status"
              aria-live="polite"
              aria-label={t('devmanager.audit.loading')}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive" role="alert">
              {t('devmanager.audit.unavailable', { error: error instanceof Error ? error.message : '' })}
            </p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground" role="status" aria-live="polite">
              {t('devmanager.audit.empty')}
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
                    {formatDate(log.timestamp, TIMESTAMP)}
                  </time>
                </li>
              ))}
            </ul>
          )}

          {total > PAGE_SIZE && (
            <nav
              className="mt-4 flex items-center justify-between gap-2"
              aria-label={t('devmanager.audit.pagination')}
            >
              <span className="text-xs text-muted-foreground">
                {t('devmanager.audit.page_of', { page: formatNumber(page), last: formatNumber(lastPage) })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t('devmanager.audit.previous_page')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= lastPage}
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  aria-label={t('devmanager.audit.next_page')}
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
