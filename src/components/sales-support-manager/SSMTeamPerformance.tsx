import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  MessageSquare,
  Eye,
  Shield
} from 'lucide-react';
import { useTeamMembers, useTickets, useLeads } from '@/hooks/useSalesSupportData';

export const SSMTeamPerformance: React.FC = () => {
  const { data: members, isLoading } = useTeamMembers();
  const { data: tickets } = useTickets();
  const { data: leads } = useLeads();

  const allMembers = members ?? [];
  const salesTeam = allMembers.filter(m => m.department === 'sales');
  const supportTeam = allMembers.filter(m => m.department === 'support');

  const activeTicketsFor = (id: string) => (tickets ?? []).filter(t => t.assigned_to === id && t.status !== 'resolved').length;
  const activeLeadsFor = (id: string) => (leads ?? []).filter(l => l.assigned_to === id && l.stage !== 'won' && l.stage !== 'lost').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'busy':
      case 'away':
        return 'bg-yellow-500';
      default:
        return 'bg-muted/40';
    }
  };

  const renderTeamCard = (member: (typeof allMembers)[number]) => {
    const isSales = member.department === 'sales';
    const activeItems = isSales ? activeLeadsFor(member.id) : activeTicketsFor(member.id);
    const conversionRate = member.leads_handled > 0 ? Math.round((member.achieved_amount / (member.target_amount || 1)) * 100) : 0;

    return (
      <motion.div
        key={member.id}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="border border-border rounded-lg p-4 bg-background"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${getStatusColor(member.status)}`} />
            </div>
            <div>
              <span className="font-mono text-sm text-primary">{member.full_name}</span>
              <p className="text-xs text-muted-foreground capitalize">{member.role_title}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {activeItems} active
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/30 rounded p-2">
            <CheckCircle className="h-3 w-3 mx-auto mb-1 text-green-500" />
            <span className="text-lg font-bold text-foreground">{isSales ? member.leads_handled : member.tickets_handled}</span>
            <p className="text-xs text-muted-foreground">Handled</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            <Clock className="h-3 w-3 mx-auto mb-1 text-blue-500" />
            <span className="text-lg font-bold text-foreground">{member.avg_response_minutes}m</span>
            <p className="text-xs text-muted-foreground">Avg Time</p>
          </div>
          <div className="bg-muted/30 rounded p-2">
            {isSales ? (
              <>
                <Target className="h-3 w-3 mx-auto mb-1 text-purple-500" />
                <span className="text-lg font-bold text-foreground">{conversionRate}%</span>
                <p className="text-xs text-muted-foreground">Target Achieved</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-3 w-3 mx-auto mb-1 text-yellow-500" />
                <span className="text-lg font-bold text-foreground">{member.csat}</span>
                <p className="text-xs text-muted-foreground">CSAT</p>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  // Calculate totals
  const totalSalesActive = salesTeam.reduce((sum, m) => sum + activeLeadsFor(m.id), 0);
  const totalSupportActive = supportTeam.reduce((sum, m) => sum + activeTicketsFor(m.id), 0);
  const avgSalesConversion = salesTeam.length > 0
    ? Math.round(salesTeam.reduce((sum, m) => sum + (m.target_amount > 0 ? (m.achieved_amount / m.target_amount) * 100 : 0), 0) / salesTeam.length)
    : 0;
  const avgSupportCSAT = supportTeam.length > 0
    ? Math.round((supportTeam.reduce((sum, m) => sum + Number(m.csat || 0), 0) / supportTeam.length) * 10) / 10
    : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <TrendingUp className="h-5 w-5 text-primary" />
            Team Performance Snapshot
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-muted">
              <Eye className="h-3 w-3 mr-1" />
              Read-Only
            </Badge>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
              <Shield className="h-3 w-3 mr-1" />
              Edit BLOCKED
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading team performance...</div>
        ) : (
        <>
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <span className="text-2xl font-bold text-blue-500">{salesTeam.length}</span>
            <p className="text-xs text-muted-foreground">Sales Execs</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <span className="text-2xl font-bold text-green-500">{supportTeam.length}</span>
            <p className="text-xs text-muted-foreground">Support Agents</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3 text-center">
            <span className="text-2xl font-bold text-purple-500">{avgSalesConversion}%</span>
            <p className="text-xs text-muted-foreground">Avg Target Achieved</p>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
            <span className="text-2xl font-bold text-yellow-500">{avgSupportCSAT}</span>
            <p className="text-xs text-muted-foreground">Avg CSAT</p>
          </div>
        </div>

        {/* Sales Team */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Sales Executives
            </h4>
            <Badge variant="outline">{totalSalesActive} active leads</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {salesTeam.map(renderTeamCard)}
          </div>
        </div>

        {/* Support Team */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Support Agents
            </h4>
            <Badge variant="outline">{totalSupportActive} active tickets</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {supportTeam.map(renderTeamCard)}
          </div>
        </div>
        </>
        )}

        <div className="mt-4 p-3 bg-muted/30 border border-border rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Sales ≠ Support - teams are separate. 
            Performance metrics are calculated automatically and cannot be manually edited.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
