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
import {
  useAllDeveloperTasks, useCodeSubmissions, useDeliveryOverview, useDeveloperActivity, useDeveloperRegistry,
} from '@/hooks/useDevManagerData';

interface DMDeveloperDashboardProps {
  onNavigate: (screen: DMScreen) => void;
}

type Figure = 'activeDevelopers' | 'activeTasks' | 'pendingReviews' | 'openBugs' | 'atRisk' | 'pendingOnboarding' | 'performanceDrop' | 'quality';

// A card whose value is null has no source: builds, security flags, payment
// holds and compliance are not recorded for developers anywhere yet.
const dashboardCards = [
  { id: 'developer_registry' as DMScreen, label: 'Active Developers', value: 'activeDevelopers' as Figure | null, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'task_management' as DMScreen, label: 'Tasks In Progress', value: 'activeTasks' as Figure | null, icon: ListTodo, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'review_qa' as DMScreen, label: 'Pending Reviews', value: 'pendingReviews' as Figure | null, icon: CheckCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'build_assignment' as DMScreen, label: 'Failed Builds', value: null as Figure | null, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'bug_fix_tracker' as DMScreen, label: 'Open Bugs', value: 'openBugs' as Figure | null, icon: Bug, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'alerts_escalation' as DMScreen, label: 'SLA Risk', value: 'atRisk' as Figure | null, icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'security_access' as DMScreen, label: 'Security Flags', value: null as Figure | null, icon: ShieldAlert, color: 'text-red-600', bgColor: 'bg-red-600/10' },
  { id: 'onboarding_requests' as DMScreen, label: 'Pending Approvals', value: 'pendingOnboarding' as Figure | null, icon: FileCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { id: 'payment_incentive' as DMScreen, label: 'Payment Hold', value: null as Figure | null, icon: Wallet, color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
  { id: 'performance_kpi' as DMScreen, label: 'Performance Drop', value: 'performanceDrop' as Figure | null, icon: TrendingDown, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'compliance_nda' as DMScreen, label: 'Compliance Issues', value: null as Figure | null, icon: Shield, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'review_qa' as DMScreen, label: 'AI Quality Score', value: 'quality' as Figure | null, icon: Brain, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
];

/**
 * The Dev Manager's front page. Its twelve counts and four activity lines were
 * typed in; each count is now read from the developer tables, and a count the
 * platform does not record shows "not tracked".
 */
export const DMDeveloperDashboard: React.FC<DMDeveloperDashboardProps> = ({ onNavigate }) => {
  const overview = useDeliveryOverview();
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const submissions = useCodeSubmissions();
  const activity = useDeveloperActivity(8);
  const quality = (overview.data?.performance ?? []).map((p) => p.qualityScore).filter((n) => n > 0);
  const figures: Record<Figure, number | string | undefined> = {
    activeDevelopers: registry.data?.filter((d) => d.status === 'active').length,
    activeTasks: overview.data?.stats.activeTasks,
    pendingReviews: submissions.data?.filter((s) => s.status === 'submitted').length,
    openBugs: tasks.data?.filter((t) => t.category === 'bug' && t.status !== 'completed').length,
    atRisk: overview.data?.stats.atRisk,
    pendingOnboarding: registry.data?.filter((d) => !d.onboardingCompleted).length,
    performanceDrop: overview.data?.performance.filter((p) => p.trend === 'down').length,
    quality: overview.data ? (quality.length ? `${Math.round(quality.reduce((a, b) => a + b, 0) / quality.length)}%` : '—') : undefined,
  };
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
              {card.value == null ? (
                <div className="text-sm font-medium text-muted-foreground">Not tracked</div>
              ) : (
                <div className="text-2xl font-bold">{figures[card.value] ?? '—'}</div>
              )}
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
            {(activity.isLoading || activity.isError || (activity.data ?? []).length === 0) && (
              <p className="text-sm text-muted-foreground">
                {activity.isLoading ? 'Loading…' : activity.isError ? `Activity could not be read: ${(activity.error as Error).message}` : 'No developer activity recorded yet.'}
              </p>
            )}
            {(activity.data ?? []).map((a) => ({
              dev: a.developer,
              action: a.description || a.type.replace(/_/g, ' '),
              time: new Date(a.createdAt).toLocaleString(),
            })).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
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
