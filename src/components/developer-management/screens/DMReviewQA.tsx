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

const reviews = [
  { id: 'REV-001', submission: 'SUB-001', dev: 'DEV-001', task: 'TSK-001', status: 'pending', time: '30 min ago' },
  { id: 'REV-002', submission: 'SUB-002', dev: 'DEV-003', task: 'TSK-003', status: 'passed', time: '2 hours ago' },
  { id: 'REV-003', submission: 'SUB-003', dev: 'DEV-002', task: 'TSK-002', status: 'failed', reason: 'Missing tests', time: '3 hours ago' },
];

export const DMReviewQA: React.FC = () => {
  const [activeTab, setActiveTab] = useState('all');

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
        <TabsList>
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
                    {review.status === 'failed' && review.reason && (
                      <p className="text-sm text-red-500 mb-3">Reason: {review.reason}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => toast.success(`Review ${review.id} approved`)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => toast.warning(`Review ${review.id} sent back`)}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Send Back
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => toast.error(`Review ${review.id} escalated`)}
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
