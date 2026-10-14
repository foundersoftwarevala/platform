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
import { useTranslation } from '@/lib/i18n/use-translation';
import type { MessageKey } from '@/lib/i18n/messages';

interface DMDeveloperDashboardProps {
  onNavigate: (screen: DMScreen) => void;
}

type Figure = 'activeDevelopers' | 'activeTasks' | 'pendingReviews' | 'openBugs' | 'atRisk' | 'pendingOnboarding' | 'performanceDrop' | 'quality';

const DATE_TIME: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'medium' };

// A card whose value is null has no source: builds, security flags, payment
// holds and compliance are not recorded for developers anywhere yet.
const dashboardCards = [
  { id: 'developer_registry' as DMScreen, label: 'devmanager.dashboard.active_developers' as MessageKey, value: 'activeDevelopers' as Figure | null, icon: Users, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'task_management' as DMScreen, label: 'devmanager.dashboard.tasks_in_progress' as MessageKey, value: 'activeTasks' as Figure | null, icon: ListTodo, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'review_qa' as DMScreen, label: 'devmanager.dashboard.pending_reviews' as MessageKey, value: 'pendingReviews' as Figure | null, icon: CheckCircle, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'build_assignment' as DMScreen, label: 'devmanager.dashboard.failed_builds' as MessageKey, value: null as Figure | null, icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'bug_fix_tracker' as DMScreen, label: 'devmanager.dashboard.open_bugs' as MessageKey, value: 'openBugs' as Figure | null, icon: Bug, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'alerts_escalation' as DMScreen, label: 'devmanager.dashboard.sla_risk' as MessageKey, value: 'atRisk' as Figure | null, icon: Clock, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'security_access' as DMScreen, label: 'devmanager.dashboard.security_flags' as MessageKey, value: null as Figure | null, icon: ShieldAlert, color: 'text-red-600', bgColor: 'bg-red-600/10' },
  { id: 'onboarding_requests' as DMScreen, label: 'devmanager.dashboard.pending_approvals' as MessageKey, value: 'pendingOnboarding' as Figure | null, icon: FileCheck, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { id: 'payment_incentive' as DMScreen, label: 'devmanager.dashboard.payment_hold' as MessageKey, value: null as Figure | null, icon: Wallet, color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
  { id: 'performance_kpi' as DMScreen, label: 'devmanager.dashboard.performance_drop' as MessageKey, value: 'performanceDrop' as Figure | null, icon: TrendingDown, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'compliance_nda' as DMScreen, label: 'devmanager.dashboard.compliance_issues' as MessageKey, value: null as Figure | null, icon: Shield, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'review_qa' as DMScreen, label: 'devmanager.dashboard.ai_quality_score' as MessageKey, value: 'quality' as Figure | null, icon: Brain, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
];

/**
 * The Dev Manager's front page. Its twelve counts and four activity lines were
 * typed in; each count is now read from the developer tables, and a count the
 * platform does not record shows "not tracked".
 */
export const DMDeveloperDashboard: React.FC<DMDeveloperDashboardProps> = ({ onNavigate }) => {
  const { t, formatDate, formatNumber } = useTranslation();
  const overview = useDeliveryOverview();
  const registry = useDeveloperRegistry();
  const tasks = useAllDeveloperTasks();
  const submissions = useCodeSubmissions();
  const activity = useDeveloperActivity(8);
  const quality = (overview.data?.performance ?? []).map((p) => p.qualityScore).filter((n) => n > 0);
  const count = (n: number | undefined) => (n == null ? undefined : formatNumber(n));
  const figures: Record<Figure, number | string | undefined> = {
    activeDevelopers: count(registry.data?.filter((d) => d.status === 'active').length),
    activeTasks: count(overview.data?.stats.activeTasks),
    pendingReviews: count(submissions.data?.filter((s) => s.status === 'submitted').length),
    openBugs: count(tasks.data?.filter((t) => t.category === 'bug' && t.status !== 'completed').length),
    atRisk: count(overview.data?.stats.atRisk),
    pendingOnboarding: count(registry.data?.filter((d) => !d.onboardingCompleted).length),
    performanceDrop: count(overview.data?.performance.filter((p) => p.trend === 'down').length),
    quality: overview.data ? (quality.length ? `${formatNumber(Math.round(quality.reduce((a, b) => a + b, 0) / quality.length))}%` : '—') : undefined,
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('devmanager.dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('devmanager.dashboard.subtitle')}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {dashboardCards.map((card, idx) => {
          const label = t(card.label);
          const value = card.value == null ? t('devmanager.common.not_tracked') : String(figures[card.value] ?? '—');
          return (
            <Card
              key={idx}
              className="cursor-pointer hover:shadow-md transition-shadow"
              role="button"
              tabIndex={0}
              aria-label={t('devmanager.dashboard.card_label', { label, value })}
              onClick={() => onNavigate(card.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onNavigate(card.id);
                }
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {card.value == null ? (
                  <div className="text-sm font-medium text-muted-foreground">{value}</div>
                ) : (
                  <div className="text-2xl font-bold">{value}</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('devmanager.dashboard.recent_activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(activity.isLoading || activity.isError || (activity.data ?? []).length === 0) && (
              <p
                className="text-sm text-muted-foreground"
                role={activity.isError ? 'alert' : 'status'}
                aria-live={activity.isError ? undefined : 'polite'}
                aria-busy={activity.isLoading || undefined}
              >
                {activity.isLoading
                  ? t('devmanager.common.loading')
                  : activity.isError
                    ? t('devmanager.dashboard.activity_error', { error: (activity.error as Error).message })
                    : t('devmanager.dashboard.activity_empty')}
              </p>
            )}
            {(activity.data ?? []).map((a) => ({
              dev: a.developer,
              action: a.description || a.type.replace(/_/g, ' '),
              time: formatDate(a.createdAt, DATE_TIME),
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
