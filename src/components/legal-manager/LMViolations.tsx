import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, User, Building, Eye, Send, Shield, Ban } from 'lucide-react';
import { toast } from 'sonner';

import { useLegalViolations, useUpdateViolation } from '@/lib/legal-data';
import { motion } from 'framer-motion';

interface Violation {
  id: string;
  violatorType: 'user' | 'partner' | 'franchise' | 'reseller';
  violatorId: string;
  violationType: string;
  severity: 'warning' | 'serious' | 'critical';
  description: string;
  evidence: string[];
  detectedAt: string;
  status: 'pending' | 'warned' | 'escalated' | 'resolved';
  previousViolations: number;
  rowId?: string;
}


const LMViolations: React.FC = () => {
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const { data: violationRows = [] } = useLegalViolations();
  const updateViolation = useUpdateViolation();

  const violations: Violation[] = violationRows.map((row) => ({
    id: row.ref_code,
    violatorType: row.violator_type as Violation['violatorType'],
    violatorId: row.violator_id,
    violationType: row.violation_type,
    severity: row.severity as Violation['severity'],
    description: row.description,
    evidence: row.evidence ?? [],
    detectedAt: row.detected_at,
    status: row.status as Violation['status'],
    previousViolations: row.previous_violations,
    rowId: row.id,
  }));
  const [actionType, setActionType] = useState<string>('');
  const [actionNote, setActionNote] = useState('');

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'serious': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return 'bg-green-500/20 text-green-400';
      case 'warned': return 'bg-blue-500/20 text-blue-400';
      case 'escalated': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getViolatorIcon = (type: string) => {
    switch (type) {
      case 'user': return <User className="h-4 w-4" />;
      case 'partner':
      case 'franchise':
      case 'reseller':
        return <Building className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const handleTakeAction = () => {
    if (!actionType) {
      toast.error('Please select an action type');
      return;
    }
    if (!actionNote.trim()) {
      toast.error('Action note is required');
      return;
    }

    if (selectedViolation?.rowId) {
      const nextStatus =
        actionType === 'escalate' || actionType === 'recommend_suspension' ? 'escalated' : 'warned';
      updateViolation.mutate({
        id: selectedViolation.rowId,
        status: nextStatus,
        action_notes: actionNote,
      });
    }

    if (actionType === 'recommend_suspension') {
      toast.success('Suspension recommendation sent to Admin. Direct suspension is FORBIDDEN.');
    } else if (actionType === 'escalate') {
      toast.success('Violation escalated to Super Admin');
    } else {
      toast.success('Warning issued');
    }

    setIsActionOpen(false);
    setActionType('');
    setActionNote('');
  };

  return (
    <>
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              User & Partner Violations
            </CardTitle>
            <Badge variant="destructive">{violations.filter(v => v.status === 'pending').length} Pending</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {violations.map((violation, index) => (
              <motion.div
                key={violation.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border ${
                  violation.severity === 'critical' ? 'bg-red-500/5 border-red-500/30' :
                  violation.severity === 'serious' ? 'bg-orange-500/5 border-orange-500/30' :
                  'bg-background/50 border-border/50'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-sm text-muted-foreground">{violation.id}</span>
                      <Badge className={getSeverityColor(violation.severity)}>
                        {violation.severity}
                      </Badge>
                      <Badge className={getStatusColor(violation.status)}>
                        {violation.status}
                      </Badge>
                      {violation.previousViolations > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {violation.previousViolations} prior violations
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {getViolatorIcon(violation.violatorType)}
                      <span className="font-medium">{violation.violatorType}: {violation.violatorId}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm">{violation.violationType}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{violation.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Evidence: {violation.evidence.length} items</span>
                      <span>•</span>
                      <span>Detected: {new Date(violation.detectedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View Evidence
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedViolation(violation);
                        setIsActionOpen(true);
                      }}
                      className="gap-1"
                    >
                      <Send className="h-3 w-3" />
                      Take Action
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-4 p-3 rounded bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-2 text-sm">
              <Ban className="h-4 w-4 text-red-400" />
              <span className="text-red-400 font-medium">Direct suspension is FORBIDDEN.</span>
              <span className="text-muted-foreground">Legal Manager can only warn, recommend, or escalate.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take Action: {selectedViolation?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="p-3 rounded bg-muted/50 text-sm">
              <p className="font-medium">{selectedViolation?.violationType}</p>
              <p className="text-muted-foreground">{selectedViolation?.violatorType}: {selectedViolation?.violatorId}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">Issue Warning</SelectItem>
                  <SelectItem value="recommend_suspension">Recommend Suspension (Admin Only)</SelectItem>
                  <SelectItem value="escalate">Escalate to Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Action Note *</Label>
              <Textarea
                placeholder="Document the action and reasoning..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
              />
            </div>

            {actionType === 'recommend_suspension' && (
              <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/30 text-sm">
                <Shield className="h-4 w-4 text-yellow-400 inline mr-2" />
                Admin confirmation is required to execute suspension. This action will create a recommendation only.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsActionOpen(false)}>Cancel</Button>
              <Button onClick={handleTakeAction}>Submit Action</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LMViolations;
