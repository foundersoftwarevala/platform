/**
 * REVIEW & QA
 * Pending Review • QA Failed • QA Passed
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useCodeSubmissions, useEscalateTask, useReviewSubmission } from '@/hooks/useDevManagerData';
import { richText, useTranslation } from '@/lib/i18n/use-translation';
import { useDMPrompt } from '../DMPromptDialog';

const STATUS: Record<string, string> = { submitted: 'pending', approved: 'passed', changes_requested: 'failed' };

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };

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

export const DMReviewQA: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const prompt = useDMPrompt();
  const [activeTab, setActiveTab] = useState('all');
  // The review queue is developer_code_submissions. The three reviews here
  // were typed in and every button only showed a message; approving and
  // sending back now decide the submission through review_developer_submission,
  // which moves the task on and logs the decision, and escalating records a
  // real escalation on the task.
  const query = useCodeSubmissions();
  const reviewMutation = useReviewSubmission();
  const reviewPending = reviewMutation.isPending;
  const escalate = useEscalateTask();
  const reviews = (query.data ?? []).map((s) => ({
    id: s.id.slice(0, 8).toUpperCase(),
    uuid: s.id,
    taskId: s.taskId,
    submission: s.commitMessage || s.type || t('devmanager.review.submission_default'),
    dev: s.developer,
    task: s.taskTitle,
    status: STATUS[s.status] ?? s.status,
    reason: s.reviewNotes,
    time: formatDate(s.createdAt, DATE_TIME),
  }));
  const decide = async (id: string, decision: 'approved' | 'changes_requested') => {
    const answer = await prompt.ask({
      title: decision === 'approved' ? t('devmanager.review.approve_prompt') : t('devmanager.review.send_back_prompt'),
      reasonLabel: t('devmanager.prompt.note'),
      minLength: 1,
      confirmLabel: decision === 'approved' ? t('devmanager.common.approve') : t('devmanager.review.send_back'),
    });
    if (!answer) return;
    const notes = answer.reason?.trim();
    if (!notes) { toast.error(t('devmanager.review.note_required')); return; }
    reviewMutation.mutate({ id, decision, notes });
  };
  const escalateTask = async (taskId: string) => {
    const answer = await prompt.ask({
      title: t('devmanager.common.escalate_prompt'),
      reasonLabel: t('devmanager.prompt.reason'),
      minLength: 5,
      confirmLabel: t('devmanager.common.escalate'),
    });
    if (!answer) return;
    const reason = answer.reason?.trim();
    if (!reason || reason.length < 5) { toast.error(t('devmanager.prompt.reason_too_short')); return; }
    escalate.mutate({ taskId, reason });
  };

  const filteredReviews = reviews.filter(rev =>
    activeTab === 'all' || rev.status === activeTab
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.review.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.review.subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">{t('devmanager.common.all')}</TabsTrigger>
          <TabsTrigger value="pending">{t('devmanager.review.tab_pending')}</TabsTrigger>
          <TabsTrigger value="failed">{t('devmanager.review.qa_failed')}</TabsTrigger>
          <TabsTrigger value="passed">{t('devmanager.review.qa_passed')}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {t('devmanager.review.queue')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(query.isLoading || query.isError || filteredReviews.length === 0) && (
                  <p
                    className="text-sm text-muted-foreground"
                    role={query.isError ? 'alert' : 'status'}
                    aria-live={query.isError ? undefined : 'polite'}
                    aria-busy={query.isLoading || undefined}
                  >
                    {query.isLoading
                      ? t('devmanager.review.loading')
                      : query.isError
                        ? t('devmanager.review.load_error', { error: (query.error as Error).message })
                        : t('devmanager.review.empty')}
                  </p>
                )}
                {filteredReviews.map((review) => (
                  <div
                    key={review.id}
                    className={`p-4 rounded-lg border ${
                      review.status === 'failed' ? 'bg-red-500/5 border-red-500/30' :
                      review.status === 'passed' ? 'bg-green-500/5 border-green-500/30' :
                      'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium">{review.id}</span>
                        <Badge className={
                          review.status === 'passed' ? 'bg-green-500/20 text-green-500' :
                          review.status === 'failed' ? 'bg-red-500/20 text-red-500' :
                          'bg-amber-500/20 text-amber-500'
                        }>
                          {review.status === 'passed' ? t('devmanager.review.qa_passed') :
                           review.status === 'failed' ? t('devmanager.review.qa_failed') : t('devmanager.status.pending')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{review.time}</span>
                    </div>
                    <div className="text-sm mb-3">
                      {muteWords(richText(t('devmanager.review.submission_line'), {
                        submission: <span className="font-mono">{review.submission}</span>,
                        task: <span className="font-mono">{review.task}</span>,
                        dev: <span className="font-mono">{review.dev}</span>,
                      }))}
                    </div>
                    {review.status !== 'pending' && review.reason && (
                      <p className={`text-sm mb-3 ${review.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {review.status === 'failed'
                          ? t('devmanager.review.reason_line', { text: review.reason })
                          : t('devmanager.review.note_line', { text: review.reason })}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        disabled={review.status !== 'pending' || reviewPending}
                        onClick={() => void decide(review.uuid, 'approved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {t('devmanager.common.approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={review.status !== 'pending' || reviewPending}
                        onClick={() => void decide(review.uuid, 'changes_requested')}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {t('devmanager.review.send_back')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={escalate.isPending}
                        onClick={() => void escalateTask(review.taskId)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        {t('devmanager.common.escalate')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {prompt.dialog}
    </div>
  );
};

export default DMReviewQA;
