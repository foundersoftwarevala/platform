import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, 
  UserX, Trash2, Shield, RotateCcw, ArrowUpRight, Eye, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useGlobalActions } from '@/hooks/useGlobalActions';

interface ApprovalRequest {
  id: string;
  type: 'refund' | 'suspension' | 'deletion' | 'priority_override' | 'sla_reset';
  ticketId: string;
  customerId: string;
  customerName: string;
  requestedBy: string;
  requestedByRole: string;
  amount?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  createdAt: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

const ApprovalWorkflow = () => {
  const { executeAction } = useGlobalActions();
  const [rejectReason, setRejectReason] = useState<string>('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const [requests] = useState<ApprovalRequest[]>([
    { id: '1', type: 'refund', ticketId: 'TKT-1234', customerId: 'USR-5678', customerName: 'John Smith', requestedBy: 'Agent Sarah', requestedByRole: 'L1 Support', amount: 149.99, reason: 'Product defect - customer unsatisfied', status: 'pending', createdAt: '15 min ago', priority: 'high' },
    { id: '2', type: 'suspension', ticketId: 'TKT-1189', customerId: 'USR-9012', customerName: 'Bad Actor Inc', requestedBy: 'Agent Mike', requestedByRole: 'L2 Support', reason: 'Repeated abuse of support system', status: 'pending', createdAt: '1 hour ago', priority: 'critical' },
    { id: '3', type: 'deletion', ticketId: 'TKT-1201', customerId: 'USR-3456', customerName: 'Jane Doe', requestedBy: 'Agent Emily', requestedByRole: 'L1 Support', reason: 'GDPR data deletion request', status: 'pending', createdAt: '2 hours ago', priority: 'medium' },
    { id: '4', type: 'priority_override', ticketId: 'TKT-2001', customerId: 'USR-7890', customerName: 'Enterprise Corp', requestedBy: 'Agent John', requestedByRole: 'L2 Support', reason: 'VIP customer - escalated priority needed', status: 'escalated', createdAt: '30 min ago', priority: 'high' },
    { id: '5', type: 'sla_reset', ticketId: 'TKT-2015', customerId: 'USR-1234', customerName: 'TechStart Ltd', requestedBy: 'Agent Lisa', requestedByRole: 'L1 Support', reason: 'System outage caused delay - not agent fault', status: 'approved', createdAt: '3 hours ago', priority: 'low' },
    { id: '6', type: 'refund', ticketId: 'TKT-2023', customerId: 'USR-4567', customerName: 'Global Finance', requestedBy: 'Agent David', requestedByRole: 'L2 Support', amount: 599.00, reason: 'Double charge - billing error', status: 'rejected', createdAt: '1 day ago', priority: 'high' },
  ]);

  const handleApprove = useCallback(async (requestId: string, type: string) => {
    await executeAction({
      actionId: `approve_${requestId}`,
      actionType: 'approve',
      entityType: 'action',
      entityId: requestId,
      metadata: { type, decision: 'approved' },
      successMessage: `${type.replace('_', ' ')} approved`,
    });
    toast.success('Request approved and logged');
  }, [executeAction]);

  const handleReject = useCallback(async (requestId: string, type: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    await executeAction({
      actionId: `reject_${requestId}`,
      actionType: 'reject',
      entityType: 'action',
      entityId: requestId,
      metadata: { type, decision: 'rejected', reason: rejectReason },
      successMessage: `${type.replace('_', ' ')} rejected`,
    });
    setRejectReason('');
    setSelectedRequest(null);
  }, [executeAction, rejectReason]);

  const handleEscalate = useCallback(async (requestId: string, type: string) => {
    await executeAction({
      actionId: `escalate_${requestId}`,
      actionType: 'escalate',
      entityType: 'action',
      entityId: requestId,
      metadata: { type, escalatedTo: 'Admin' },
      successMessage: 'Request escalated to Admin',
    });
  }, [executeAction]);

  const handleViewDetails = useCallback(async (requestId: string, ticketId: string) => {
    await executeAction({
      actionId: `view_approval_${requestId}`,
      actionType: 'read',
      entityType: 'ticket',
      entityId: ticketId,
      successMessage: 'Opening ticket details',
    });
  }, [executeAction]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'refund': return DollarSign;
      case 'suspension': return UserX;
      case 'deletion': return Trash2;
      case 'priority_override': return ArrowUpRight;
      case 'sla_reset': return RotateCcw;
      default: return Shield;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'refund': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'suspension': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'deletion': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'priority_override': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'sla_reset': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-muted/40 text-muted-foreground border-border';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-yellow-500/20 text-yellow-400"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved': return <Badge className="bg-emerald-500/20 text-emerald-400"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected': return <Badge className="bg-red-500/20 text-red-400"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'escalated': return <Badge className="bg-purple-500/20 text-purple-400"><ArrowUpRight className="w-3 h-3 mr-1" />Escalated</Badge>;
      default: return <Badge className="bg-muted/40 text-muted-foreground">Unknown</Badge>;
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const escalatedRequests = requests.filter(r => r.status === 'escalated');
  const completedRequests = requests.filter(r => r.status === 'approved' || r.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-6 h-6 text-teal-400" />
            Approval Workflow
          </h2>
          <p className="text-muted-foreground text-sm">Critical action approvals requiring supervisor authorization</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-yellow-500/20 text-yellow-400 text-lg px-4 py-1">
            {pendingRequests.length} Pending
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-400 text-lg px-4 py-1">
            {escalatedRequests.length} Escalated
          </Badge>
        </div>
      </div>

      {/* Pending Approvals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 backdrop-blur-xl border border-yellow-500/20 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-foreground">Pending Approvals</h3>
        </div>

        <div className="space-y-4">
          {pendingRequests.map((request) => {
            const TypeIcon = getTypeIcon(request.type);
            return (
              <motion.div
                key={request.id}
                whileHover={{ x: 4 }}
                className={`p-4 rounded-xl border ${getTypeColor(request.type)} bg-opacity-30`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getTypeColor(request.type)}`}>
                      <TypeIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground capitalize">{request.type.replace('_', ' ')}</span>
                        <span className="font-mono text-sm text-teal-400">{request.ticketId}</span>
                        {request.priority === 'critical' && (
                          <Badge className="bg-red-500/20 text-red-400 animate-pulse">CRITICAL</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{request.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Customer: {request.customerName}</span>
                        <span>Requested by: {request.requestedBy} ({request.requestedByRole})</span>
                        <span>{request.createdAt}</span>
                        {request.amount && (
                          <span className="text-emerald-400 font-semibold">${request.amount.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleViewDetails(request.id, request.ticketId)}
                        variant="ghost" 
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleApprove(request.id, request.type)}
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => setSelectedRequest(selectedRequest === request.id ? null : request.id)}
                        className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleEscalate(request.id, request.type)}
                        variant="ghost" 
                        className="text-purple-400 hover:bg-purple-500/10"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    </div>
                    {selectedRequest === request.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="w-full mt-2"
                      >
                        <Textarea
                          placeholder="Rejection reason (required)..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="bg-card/60 border-border text-sm mb-2"
                          rows={2}
                        />
                        <Button 
                          size="sm"
                          onClick={() => handleReject(request.id, request.type)}
                          className="w-full bg-red-500/20 text-red-400 border border-red-500/30"
                        >
                          Confirm Rejection
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {pendingRequests.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-400" />
              <p>No pending approvals</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Escalated */}
      {escalatedRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <ArrowUpRight className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-foreground">Escalated to Admin</h3>
          </div>
          <div className="space-y-3">
            {escalatedRequests.map((request) => {
              const TypeIcon = getTypeIcon(request.type);
              return (
                <div key={request.id} className="p-4 rounded-xl bg-card/60 border border-purple-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TypeIcon className="w-5 h-5 text-purple-400" />
                    <div>
                      <span className="font-medium text-foreground capitalize">{request.type.replace('_', ' ')}</span>
                      <span className="text-muted-foreground ml-2">{request.ticketId}</span>
                      <p className="text-xs text-muted-foreground">{request.reason}</p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Completed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card/60 backdrop-blur-xl border border-teal-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <h3 className="text-lg font-semibold text-foreground">Recent Decisions</h3>
        </div>
        <div className="space-y-2">
          {completedRequests.map((request) => {
            const TypeIcon = getTypeIcon(request.type);
            return (
              <div key={request.id} className="p-3 rounded-xl bg-card/60 border border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TypeIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground capitalize">{request.type.replace('_', ' ')}</span>
                  <span className="text-xs text-muted-foreground">{request.ticketId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{request.createdAt}</span>
                  {getStatusBadge(request.status)}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default ApprovalWorkflow;
