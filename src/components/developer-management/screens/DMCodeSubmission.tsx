/**
 * CODE SUBMISSION
 * No raw download • No external repo • Internal commit only
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileCode, Upload, RefreshCw, Lock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCodeSubmissions } from '@/hooks/useDevManagerData';
import { richText, useTranslation, type Translate } from '@/lib/i18n/use-translation';

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };

// review_status in developer_code_submissions, in this screen's words.
const STATUS: Record<string, string> = { submitted: 'pending', approved: 'approved', changes_requested: 'rejected' };

const getStatusBadge = (status: string, t: Translate) => {
  switch (status) {
    case 'pending': return <Badge className="bg-amber-500/20 text-amber-500">{t('devmanager.code.status_pending')}</Badge>;
    case 'approved': return <Badge className="bg-green-500/20 text-green-500">{t('devmanager.code.status_approved')}</Badge>;
    case 'rejected': return <Badge variant="destructive">{t('devmanager.code.status_rejected')}</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

/**
 * The words of a sentence built with richText(), in the muted colour they had
 * as separate spans; the data placed in it (elements) keeps its own markup.
 */
const muteWords = (nodes: React.ReactNode[]) =>
  nodes.map((node, index) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return node;
    const words = node.props.children;
    if (typeof words !== 'string') return node;
    return words ? <span key={index} className="text-muted-foreground">{words}</span> : null;
  });

/**
 * Code submissions, from developer_code_submissions. The three here were typed
 * in. A developer submits and resubmits from their own dashboard, against their
 * task, so those buttons say so; the review decision is taken in Review & QA.
 */
export const DMCodeSubmission: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const query = useCodeSubmissions();
  const submissions = (query.data ?? []).map((s) => ({
    id: s.id.slice(0, 8).toUpperCase(),
    task: s.taskTitle,
    dev: s.developer,
    files: s.files,
    status: STATUS[s.status] ?? s.status,
    time: formatDate(s.createdAt, DATE_TIME),
    message: s.commitMessage,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.code.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.code.subtitle')}</p>
      </div>

      {/* Rules */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            {t('devmanager.code.rules')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>• {t('devmanager.code.rule_no_download')}</span>
            <span>• {t('devmanager.code.rule_no_external')}</span>
            <span>• {t('devmanager.code.rule_internal')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            {t('devmanager.code.recent')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(query.isLoading || query.isError || submissions.length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={query.isError ? 'alert' : 'status'}
                aria-live={query.isError ? undefined : 'polite'}
                aria-busy={query.isLoading || undefined}
              >
                {query.isLoading
                  ? t('devmanager.code.loading')
                  : query.isError
                    ? t('devmanager.code.load_error', { error: (query.error as Error).message })
                    : t('devmanager.code.empty')}
              </p>
            )}
            {submissions.map((sub) => (
              <div
                key={sub.id}
                className={`p-4 rounded-lg border ${
                  sub.status === 'rejected' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{sub.id}</span>
                    {getStatusBadge(sub.status, t)}
                  </div>
                  <span className="text-xs text-muted-foreground">{sub.time}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm">
                    {muteWords(richText(t('devmanager.code.task_by'), {
                      task: <span className="font-mono">{sub.task}</span>,
                      dev: <span className="font-mono">{sub.dev}</span>,
                    }))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {sub.message
                      ? t('devmanager.code.files_message', { count: sub.files, message: sub.message })
                      : t('devmanager.code.files', { count: sub.files })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => toast.info(t('devmanager.code.submit_info'))}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {t('devmanager.code.submit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(sub.status === 'rejected' ? t('devmanager.code.resubmit_info_rejected') : t('devmanager.code.resubmit_info'))}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {t('devmanager.code.resubmit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info(sub.status === 'pending' ? t('devmanager.code.lock_info_pending') : t('devmanager.code.lock_info_decided'))}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    {t('devmanager.code.lock')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMCodeSubmission;
