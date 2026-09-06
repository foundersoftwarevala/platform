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

const submissions = [
  { id: 'SUB-001', task: 'TSK-001', dev: 'DEV-001', files: 12, lines: 450, status: 'pending', time: '10 min ago' },
  { id: 'SUB-002', task: 'TSK-003', dev: 'DEV-003', files: 8, lines: 280, status: 'approved', time: '1 hour ago' },
  { id: 'SUB-003', task: 'TSK-002', dev: 'DEV-002', files: 5, lines: 120, status: 'rejected', time: '2 hours ago' },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending': return <Badge className="bg-amber-500/20 text-amber-500">Pending Review</Badge>;
    case 'approved': return <Badge className="bg-green-500/20 text-green-500">Approved</Badge>;
    case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

export const DMCodeSubmission: React.FC = () => {
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
          <div className="flex items-center gap-6 text-sm">
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
                    {sub.files} files • {sub.lines} lines
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => toast.success(`Submission ${sub.id} submitted`)}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Submit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(`Resubmitting ${sub.id}`)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Resubmit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.warning(`Submission ${sub.id} locked`)}
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
