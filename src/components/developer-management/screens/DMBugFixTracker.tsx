/**
 * BUG & FIX TRACKER
 * Bug ID • Severity • Linked Task • Fix Status
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug, UserPlus, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const bugs = [
  { id: 'BUG-001', severity: 'critical', task: 'TSK-004', description: 'Payment gateway timeout', assignee: 'DEV-002', status: 'in_progress' },
  { id: 'BUG-002', severity: 'high', task: 'TSK-001', description: 'Auth token expiry issue', assignee: 'DEV-001', status: 'open' },
  { id: 'BUG-003', severity: 'medium', task: 'TSK-003', description: 'Dashboard loading slow', assignee: null, status: 'open' },
  { id: 'BUG-004', severity: 'low', task: 'TSK-002', description: 'UI alignment issue', assignee: 'DEV-005', status: 'fixed' },
  { id: 'BUG-005', severity: 'high', task: 'TSK-005', description: 'Data sync failure', assignee: 'DEV-003', status: 'verified' },
];

const getSeverityBadge = (severity: string) => {
  switch (severity) {
    case 'critical': return <Badge variant="destructive">Critical</Badge>;
    case 'high': return <Badge className="bg-red-500/20 text-red-500">High</Badge>;
    case 'medium': return <Badge className="bg-amber-500/20 text-amber-500">Medium</Badge>;
    case 'low': return <Badge variant="secondary">Low</Badge>;
    default: return <Badge>{severity}</Badge>;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'open': return <Badge className="bg-blue-500/20 text-blue-500">Open</Badge>;
    case 'in_progress': return <Badge className="bg-amber-500/20 text-amber-500">In Progress</Badge>;
    case 'fixed': return <Badge className="bg-green-500/20 text-green-500">Fixed</Badge>;
    case 'verified': return <Badge className="bg-emerald-500/20 text-emerald-500">Verified</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

export const DMBugFixTracker: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bug & Fix Tracker</h1>
        <p className="text-muted-foreground">Track bugs and their resolution status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Bug List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bugs.map((bug) => (
              <div 
                key={bug.id}
                className={`p-4 rounded-lg border ${
                  bug.severity === 'critical' ? 'bg-red-500/5 border-red-500/30' : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-medium">{bug.id}</span>
                    {getSeverityBadge(bug.severity)}
                    {getStatusBadge(bug.status)}
                  </div>
                  {bug.assignee && (
                    <span className="font-mono text-sm">{bug.assignee}</span>
                  )}
                </div>
                <div className="mb-3">
                  <p className="text-sm">{bug.description}</p>
                  <p className="text-xs text-muted-foreground">Linked Task: {bug.task}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.success(`Bug ${bug.id} assigned`)}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Assign Fix
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.info(`Bug ${bug.id} verified`)}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Verify Fix
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toast.success(`Bug ${bug.id} closed`)}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Close Bug
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

export default DMBugFixTracker;
