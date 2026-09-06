/**
 * DEVELOPER DASHBOARD - TOP KPI BOXES
 * All boxes clickable → filtered view
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, ListTodo, CheckCircle, XCircle, Bug, Clock,
  ShieldAlert, FileCheck, Wallet, TrendingDown, Shield, Brain
} from 'lucide-react';
import { DMScreen } from '../DMFullSidebar';

interface DMDeveloperDashboardProps {
  onNavigate: (screen: DMScreen) => void;
}

const dashboardCards = [
  { id: 'developer_registry' as DMScreen, label: 'Active Developers', value: 24, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'task_management' as DMScreen, label: 'Tasks In Progress', value: 18, icon: ListTodo, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'review_qa' as DMScreen, label: 'Pending Reviews', value: 5, icon: CheckCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'build_assignment' as DMScreen, label: 'Failed Builds', value: 2, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'bug_fix_tracker' as DMScreen, label: 'Open Bugs', value: 8, icon: Bug, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'alerts_escalation' as DMScreen, label: 'SLA Risk', value: 3, icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'security_access' as DMScreen, label: 'Security Flags', value: 1, icon: ShieldAlert, color: 'text-red-600', bgColor: 'bg-red-600/10' },
  { id: 'onboarding_requests' as DMScreen, label: 'Pending Approvals', value: 4, icon: FileCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { id: 'payment_incentive' as DMScreen, label: 'Payment Hold', value: 2, icon: Wallet, color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
  { id: 'performance_kpi' as DMScreen, label: 'Performance Drop', value: 3, icon: TrendingDown, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'compliance_nda' as DMScreen, label: 'Compliance Issues', value: 1, icon: Shield, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'review_qa' as DMScreen, label: 'AI Quality Score', value: 87, icon: Brain, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
];

export const DMDeveloperDashboard: React.FC<DMDeveloperDashboardProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Developer Dashboard</h1>
        <p className="text-muted-foreground">Internal developer operations overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dashboardCards.map((card, idx) => (
          <Card 
            key={idx}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(card.id)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { dev: 'DEV-001', action: 'Submitted code for review', time: '2 min ago', type: 'code' },
              { dev: 'DEV-005', action: 'Fixed bug BUG-234', time: '10 min ago', type: 'bug' },
              { dev: 'DEV-003', action: 'Completed task TSK-089', time: '25 min ago', type: 'task' },
              { dev: 'DEV-008', action: 'Onboarding approved', time: '1 hour ago', type: 'onboard' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm">{item.dev}</span>
                  <span className="text-sm">{item.action}</span>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DMDeveloperDashboard;
