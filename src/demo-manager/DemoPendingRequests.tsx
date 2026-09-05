import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, CheckCircle, XCircle, Clock, User,
  Building, Calendar, MessageSquare, Mail, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import DataStateNotice from './DataStateNotice';

interface PendingRequest {
  id: string;
  requesterName: string;
  company: string;
  email: string;
  phone: string | null;
  category: string;
  requestedAt: string;
  reason: string;
  priority: 'high' | 'normal' | 'low';
}

const relative = (iso: string | null): string => {
  if (!iso) return 'Unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};

const priorityFromAge = (iso: string | null): PendingRequest['priority'] => {
  if (!iso) return 'normal';
  const ageDays = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (ageDays >= 7) return 'high';
  if (ageDays >= 2) return 'normal';
  return 'low';
};

const pendingKey = ['demo-manager', 'pending-requests'] as const;

const DemoPendingRequests = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: pendingKey,
    queryFn: async (): Promise<PendingRequest[]> => {
      const { data: rows, error: queryError } = await supabase
        .from('demo_requests')
        .select('id, client_name, client_email, company_name, phone, interested_category, message, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(200);
      if (queryError) throw queryError;

      return (rows ?? []).map((row) => ({
        id: row.id,
        requesterName: row.client_name,
        company: row.company_name ?? '—',
        email: row.client_email,
        phone: row.phone,
        category: row.interested_category ?? 'Unspecified',
        requestedAt: relative(row.created_at),
        reason: row.message?.trim() || 'No message provided with this request.',
        priority: priorityFromAge(row.created_at),
      }));
    },
  });

  const requests = useMemo(() => data ?? [], [data]);

  const respond = async (id: string, status: 'approved' | 'rejected', notes?: string) => {
    setBusyId(id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error: updateError } = await supabase
        .from('demo_requests')
        .update({
          status,
          responded_at: new Date().toISOString(),
          responded_by: auth.user?.id ?? null,
          ...(notes ? { notes } : {}),
        })
        .eq('id', id);

      if (updateError) throw updateError;
      await queryClient.invalidateQueries({ queryKey: pendingKey });
      await queryClient.invalidateQueries({ queryKey: ['demo-manager', 'demo-requests'] });
      toast.success(
        status === 'approved'
          ? 'Demo request approved and recorded.'
          : 'Demo request rejected and reason saved.',
      );
    } catch (e) {
      toast.error(`Could not update request: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = (id: string) => respond(id, 'approved');

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    await respond(id, 'rejected', rejectReason.trim());
    setSelectedRequest(null);
    setRejectReason('');
  };

  const getPriorityBadge = (priority: PendingRequest['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-500/20 text-red-400 border border-red-500/30">Waiting 7+ days</Badge>;
      case 'normal':
        return <Badge className="bg-blue-500/20 text-blue-400 border border-blue-500/30">Normal</Badge>;
      case 'low':
        return <Badge className="bg-slate-500/20 text-slate-400 border border-slate-500/30">New</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="w-7 h-7 text-cyan-400" />
            Pending Demo Requests
          </h1>
          <p className="text-slate-400 mt-1">Review and approve incoming demo access requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-lg px-4 py-2">
            {requests.length} Pending
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="border-slate-600 text-slate-300">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <DataStateNotice
        isLoading={isLoading}
        error={error}
        isEmpty={requests.length === 0}
        hasSession={Boolean(session)}
        resource="pending demo requests"
        loadingLabel="Loading demo requests…"
        emptyIcon={<CheckCircle className="w-8 h-8 text-emerald-400" />}
        emptyTitle="All Caught Up!"
        emptyDescription="No pending demo requests at the moment."
        onRetry={() => refetch()}
      >
        <div className="grid gap-4">
          {requests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 10) * 0.05 }}
            >
              <Card className={`bg-slate-900/50 backdrop-blur-xl transition-all ${
                request.priority === 'high'
                  ? 'border-red-500/30 hover:border-red-500/50'
                  : 'border-slate-700/50 hover:border-cyan-500/30'
              }`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <h3 className="text-lg font-semibold text-white">{request.category}</h3>
                        {getPriorityBadge(request.priority)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-400">Requester:</span>
                          <span className="text-white">{request.requesterName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-400">Company:</span>
                          <span className="text-white">{request.company}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-400">Email:</span>
                          <span className="text-white break-all">{request.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-500" />
                          <span className="text-slate-400">Requested:</span>
                          <span className="text-white">{request.requestedAt}</span>
                        </div>
                        {request.phone && (
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-400">Phone:</span>
                            <span className="text-white">{request.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-4 h-4 text-slate-500 mt-0.5" />
                          <div>
                            <span className="text-slate-400 text-sm">Message: </span>
                            <span className="text-slate-300 text-sm">{request.reason}</span>
                          </div>
                        </div>
                      </div>

                      {/* Rejection Form */}
                      {selectedRequest === request.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                        >
                          <p className="text-sm text-red-400 mb-2">Reason for rejection:</p>
                          <Textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explain why this request is being rejected..."
                            className="bg-slate-900/50 border-slate-700 mb-3"
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleReject(request.id)}
                              disabled={busyId === request.id}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Confirm Rejection
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => { setSelectedRequest(null); setRejectReason(''); }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Actions */}
                    {selectedRequest !== request.id && (
                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          onClick={() => handleApprove(request.id)}
                          disabled={busyId === request.id}
                          className="bg-emerald-500 hover:bg-emerald-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setSelectedRequest(request.id)}
                          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.open(`mailto:${request.email}`, '_blank')}
                          className="border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Contact
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </DataStateNotice>
    </div>
  );
};

export default DemoPendingRequests;
