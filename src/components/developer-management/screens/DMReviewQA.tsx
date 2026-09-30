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

const STATUS: Record<string, string> = { submitted: 'pending', approved: 'passed', changes_requested: 'failed' };

export const DMReviewQA: React.FC = () => {
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
    submission: s.commitMessage || s.type || 'Submission',
    dev: s.developer,
    task: s.taskTitle,
    status: STATUS[s.status] ?? s.status,
    reason: s.reviewNotes,
    time: new Date(s.createdAt).toLocaleString(),
  }));
  const decide = (id: string, decision: 'approved' | 'changes_requested') => {
    const notes = window.prompt(decision === 'approved' ? 'Review note for the developer:' : 'What needs to change?')?.trim();
    if (!notes) { toast.error('A review note is required.'); return; }
    reviewMutation.mutate({ id, decision, notes });
  };
  const escalateTask = (taskId: string) => {
    const reason = window.prompt('Why is it being escalated? (at least 5 characters)')?.trim();
    if (!reason || reason.length < 5) { toast.error('A reason of at least 5 characters is needed.'); return; }
    escalate.mutate({ taskId, reason });
  };

  const filteredReviews = reviews.filter(rev => 
    activeTab === 'all' || rev.status === activeTab
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review & QA</h1>
        <p className="text-muted-foreground">Code review and quality assurance</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="failed">QA Failed</TabsTrigger>
          <TabsTrigger value="passed">QA Passed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Review Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(query.isLoading || query.isError || filteredReviews.length === 0) && (
                  <p className="text-sm text-muted-foreground">
                    {query.isLoading ? 'Loading reviews…' : query.isError ? `Reviews could not be read: ${(query.error as Error).message}` : 'Nothing here.'}
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
                          {review.status === 'passed' ? 'QA Passed' : 
                           review.status === 'failed' ? 'QA Failed' : 'Pending'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{review.time}</span>
                    </div>
                    <div className="text-sm mb-3">
                      <span className="font-mono">{review.submission}</span>
                      <span className="text-muted-foreground"> • </span>
                      <span className="font-mono">{review.task}</span>
                      <span className="text-muted-foreground"> by </span>
                      <span className="font-mono">{review.dev}</span>
                    </div>
                    {review.status !== 'pending' && review.reason && (
                      <p className={`text-sm mb-3 ${review.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>{review.status === 'failed' ? 'Reason' : 'Note'}: {review.reason}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        disabled={review.status !== 'pending' || reviewPending}
                        onClick={() => decide(review.uuid, 'approved')}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        disabled={review.status !== 'pending' || reviewPending}
                        onClick={() => decide(review.uuid, 'changes_requested')}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Send Back
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        disabled={escalate.isPending}
                        onClick={() => escalateTask(review.taskId)}
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Escalate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DMReviewQA;
