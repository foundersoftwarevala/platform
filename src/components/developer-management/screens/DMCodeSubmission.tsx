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

// review_status in developer_code_submissions, in this screen's words.
const STATUS: Record<string, string> = { submitted: 'pending', approved: 'approved', changes_requested: 'rejected' };

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending': return <Badge className="bg-amber-500/20 text-amber-500">Pending Review</Badge>;
    case 'approved': return <Badge className="bg-green-500/20 text-green-500">Approved</Badge>;
    case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

/**
 * Code submissions, from developer_code_submissions. The three here were typed
 * in. A developer submits and resubmits from their own dashboard, against their
 * task, so those buttons say so; the review decision is taken in Review & QA.
 */
export const DMCodeSubmission: React.FC = () => {
  const query = useCodeSubmissions();
  const submissions = (query.data ?? []).map((s) => ({
    id: s.id.slice(0, 8).toUpperCase(),
    task: s.taskTitle,
    dev: s.developer,
    files: s.files,
    status: STATUS[s.status] ?? s.status,
    time: new Date(s.createdAt).toLocaleString(),
    message: s.commitMessage,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Code Submission</h1>
        <p className="text-muted-foreground">Internal code commit management</p>
      </div>

      {/* Rules */}
      <Card className="bg-amber-500/5 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            Submission Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span>• No raw download</span>
            <span>• No external repo link</span>
            <span>• Internal commit only</span>
          </div>
        </CardContent>
      </Card>

      {/* Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Recent Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(query.isLoading || query.isError || submissions.length === 0) && (
              <p className="text-sm text-muted-foreground">
                {query.isLoading ? 'Loading submissions…' : query.isError ? `Submissions could not be read: ${(query.error as Error).message}` : 'No code has been submitted yet.'}
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
                    {getStatusBadge(sub.status)}
                  </div>
                  <span className="text-xs text-muted-foreground">{sub.time}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Task: </span>
                    <span className="font-mono">{sub.task}</span>
                    <span className="text-muted-foreground"> by </span>
                    <span className="font-mono">{sub.dev}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {sub.files} files{sub.message ? ` • ${sub.message}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => toast.info('Code is submitted by the developer, from their own dashboard, against their task.')}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Submit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(sub.status === 'rejected' ? 'The developer resubmits after the requested changes, from their own dashboard.' : 'Only a submission sent back for changes is resubmitted.')}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resubmit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(sub.status === 'pending' ? 'A submission cannot be edited once made; it is decided in Review & QA.' : 'This submission is already decided and cannot change.')}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Lock
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
