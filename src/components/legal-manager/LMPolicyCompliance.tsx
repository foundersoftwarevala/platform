import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FileText, CheckCircle, AlertCircle, Clock, Edit, History } from 'lucide-react';
import { toast } from 'sonner';

import { useLegalPolicies, useUpdatePolicy } from '@/lib/legal-data';
import { motion } from 'framer-motion';

interface PolicyDocument {
  id: string;
  name: string;
  type: 'terms' | 'privacy' | 'refund' | 'aup';
  status: 'draft' | 'pending_approval' | 'published';
  version: string;
  lastUpdated: string;
  updatedBy: string;
  complianceScore: number;
  content: string;
  rowId?: string;
}


const LMPolicyCompliance: React.FC = () => {
  const { data: policyRows = [] } = useLegalPolicies();
  const updatePolicy = useUpdatePolicy();

  const policies: PolicyDocument[] = policyRows.map((row) => ({
    id: row.ref_code,
    name: row.name,
    type: row.policy_type as PolicyDocument['type'],
    status: row.status as PolicyDocument['status'],
    version: row.version,
    lastUpdated: row.last_updated,
    updatedBy: row.updated_by,
    complianceScore: row.compliance_score,
    content: row.content ?? '',
    rowId: row.id,
  }));

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyDocument | null>(null);
  const [draftContent, setDraftContent] = useState('');

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'published':
        return { color: 'bg-green-500/20 text-green-400', icon: CheckCircle };
      case 'pending_approval':
        return { color: 'bg-yellow-500/20 text-yellow-400', icon: Clock };
      default:
        return { color: 'bg-blue-500/20 text-blue-400', icon: Edit };
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 95) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const handleSaveDraft = () => {
    if (!draftContent.trim()) {
      toast.error('Draft content cannot be empty');
      return;
    }

    if (!selectedPolicy?.rowId) return;
    updatePolicy.mutate(
      { id: selectedPolicy.rowId, status: 'draft', content: draftContent },
      {
        onSuccess: () => {
          toast.success('Draft saved. Awaiting Admin approval for publishing.');
          setIsEditOpen(false);
          setDraftContent('');
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const handleSubmitForApproval = () => {
    if (!selectedPolicy?.rowId) return;
    updatePolicy.mutate(
      { id: selectedPolicy.rowId, status: 'pending_approval', content: draftContent || selectedPolicy.content },
      {
        onSuccess: () => {
          toast.success('Policy submitted to Admin for approval');
          setIsEditOpen(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <>
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Policy Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {policies.map((policy, index) => {
              const StatusIcon = getStatusConfig(policy.status).icon;
              
              return (
                <motion.div
                  key={policy.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium">{policy.name}</span>
                        <Badge className={getStatusConfig(policy.status).color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {policy.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs font-mono">
                          v{policy.version}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Updated: {policy.lastUpdated}</span>
                        <span>By: {policy.updatedBy}</span>
                        <span className={`font-medium ${getComplianceColor(policy.complianceScore)}`}>
                          Compliance: {policy.complianceScore}%
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="gap-1"
                      >
                        <History className="h-3 w-3" />
                        History
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => {
                          setSelectedPolicy(policy);
                          setDraftContent(policy.content);
                          setIsEditOpen(true);
                        }}
                        className="gap-1"
                      >
                        <Edit className="h-3 w-3" />
                        Edit Draft
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Admin publishes final policies. Legal Manager manages drafts only.
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Policy Draft: {selectedPolicy?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 rounded bg-muted/50 text-sm">
              <p>Current Version: <span className="font-mono">{selectedPolicy?.version}</span></p>
              <p className="text-muted-foreground">New version will be created upon save</p>
            </div>
            
            <div className="space-y-2">
              <Label>Policy Content (Draft)</Label>
              <Textarea
                placeholder="Enter policy content..."
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={10}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={updatePolicy.isPending}>Save Draft</Button>
              <Button onClick={handleSubmitForApproval} disabled={updatePolicy.isPending}>Submit for Approval</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LMPolicyCompliance;
