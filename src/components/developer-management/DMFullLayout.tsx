/**
 * DEVELOPER MANAGEMENT - FULL LAYOUT
 *
 * The source mounted a role-switch dropdown in this top bar that collected a
 * username, password, licence key and backup key of its own. Software Vala
 * already switches role dashboards from the Control Panel, and a second set of
 * credentials inside a module is not something to carry across, so it is gone.
 * Enterprise Mode • AI-Assisted • Zero-Leak
 * Uses the shared UnifiedShell so the module matches the global UI system.
 */

import React, { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useCodeSubmissions, useDeliveryOverview, useDeveloperRegistry } from '@/hooks/useDevManagerData';
import {
  LayoutDashboard, Users, UserPlus, Layers, ListTodo, Target, Hammer,
  FileCode, CheckCircle, Bug, TrendingUp, Wallet, Shield, Lock,
  AlertTriangle, FileText, Settings, Code2,
} from 'lucide-react';
import { UnifiedShell, UnifiedNavGroup, UnifiedNavItem } from '@/components/unified/UnifiedShell';
import { useTranslation } from '@/lib/i18n/use-translation';
import type { MessageKey } from '@/lib/i18n/messages';
import { DMScreen } from './DMFullSidebar';
import { DMDeveloperDashboard } from './screens/DMDeveloperDashboard';
import { DMDeveloperRegistry } from './screens/DMDeveloperRegistry';
import { DMOnboardingRequests } from './screens/DMOnboardingRequests';
import { DMRoleSkillMapping } from './screens/DMRoleSkillMapping';
import { DMTaskManagement } from './screens/DMTaskManagement';
import { DMSprintMilestone } from './screens/DMSprintMilestone';
import { DMBuildAssignment } from './screens/DMBuildAssignment';
import { DMCodeSubmission } from './screens/DMCodeSubmission';
import { DMReviewQA } from './screens/DMReviewQA';
import { DMBugFixTracker } from './screens/DMBugFixTracker';
import { DMPerformanceKPI } from './screens/DMPerformanceKPI';
import { DMPaymentIncentive } from './screens/DMPaymentIncentive';
import { DMComplianceNDA } from './screens/DMComplianceNDA';
import { DMSecurityAccess } from './screens/DMSecurityAccess';
import { DMAlertsEscalation } from './screens/DMAlertsEscalation';
import { DMAuditLogs } from './screens/DMAuditLogs';
import { DMSettings } from './screens/DMSettings';

// The menu as catalogue keys; its labels are translated where it is drawn.
type NavGroupSource = {
  title: MessageKey;
  items: (Omit<UnifiedNavItem, 'label'> & { label: MessageKey })[];
};

const GROUPS: NavGroupSource[] = [
  {
    title: 'devmanager.nav.group_overview',
    items: [{ id: 'developer_dashboard', label: 'devmanager.nav.developer_dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'devmanager.nav.group_people',
    items: [
      { id: 'developer_registry', label: 'devmanager.nav.developer_registry', icon: Users },
      { id: 'onboarding_requests', label: 'devmanager.nav.onboarding_requests', icon: UserPlus },
      { id: 'role_skill_mapping', label: 'devmanager.nav.role_skill_mapping', icon: Layers },
    ],
  },
  {
    title: 'devmanager.nav.group_pipeline',
    items: [
      { id: 'task_management', label: 'devmanager.nav.task_management', icon: ListTodo },
      { id: 'sprint_milestone', label: 'devmanager.nav.sprint_milestone', icon: Target },
      { id: 'build_assignment', label: 'devmanager.nav.build_assignment', icon: Hammer },
      { id: 'code_submission', label: 'devmanager.nav.code_submission', icon: FileCode },
      { id: 'review_qa', label: 'devmanager.nav.review_qa', icon: CheckCircle },
      { id: 'bug_fix_tracker', label: 'devmanager.nav.bug_fix_tracker', icon: Bug },
    ],
  },
  {
    title: 'devmanager.nav.group_performance',
    items: [
      { id: 'performance_kpi', label: 'devmanager.nav.performance_kpi', icon: TrendingUp },
      { id: 'payment_incentive', label: 'devmanager.nav.payment_incentive', icon: Wallet },
    ],
  },
  {
    title: 'devmanager.nav.group_governance',
    items: [
      { id: 'compliance_nda', label: 'devmanager.nav.compliance_nda', icon: Shield },
      { id: 'security_access', label: 'devmanager.nav.security_access', icon: Lock },
      { id: 'alerts_escalation', label: 'devmanager.nav.alerts_escalation', icon: AlertTriangle },
      { id: 'audit_logs', label: 'devmanager.nav.audit_logs', icon: FileText },
      { id: 'settings', label: 'devmanager.nav.settings', icon: Settings },
    ],
  },
];

export const DMFullLayout: React.FC = () => {
  const { t } = useTranslation();
  const [activeScreen, setActiveScreen] = useState<DMScreen>('developer_dashboard');

  const renderScreen = () => {
    switch (activeScreen) {
      case 'developer_dashboard':
        return <DMDeveloperDashboard onNavigate={setActiveScreen} />;
      case 'developer_registry':
        return <DMDeveloperRegistry />;
      case 'onboarding_requests':
        return <DMOnboardingRequests />;
      case 'role_skill_mapping':
        return <DMRoleSkillMapping />;
      case 'task_management':
        return <DMTaskManagement />;
      case 'sprint_milestone':
        return <DMSprintMilestone />;
      case 'build_assignment':
        return <DMBuildAssignment />;
      case 'code_submission':
        return <DMCodeSubmission />;
      case 'review_qa':
        return <DMReviewQA />;
      case 'bug_fix_tracker':
        return <DMBugFixTracker />;
      case 'performance_kpi':
        return <DMPerformanceKPI />;
      case 'payment_incentive':
        return <DMPaymentIncentive />;
      case 'compliance_nda':
        return <DMComplianceNDA />;
      case 'security_access':
        return <DMSecurityAccess />;
      case 'alerts_escalation':
        return <DMAlertsEscalation />;
      case 'audit_logs':
        return <DMAuditLogs />;
      case 'settings':
        return <DMSettings />;
      default:
        return <DMDeveloperDashboard onNavigate={setActiveScreen} />;
    }
  };

  const titleKey = GROUPS.flatMap((g) => g.items).find((i) => i.id === activeScreen)?.label;
  const title = titleKey ? t(titleKey) : t('devmanager.nav.fallback_title');

  // Two items carried typed-in badges (3 and 12). A badge is now the count the
  // screen itself shows, and none is drawn while it is unknown or zero.
  const overview = useDeliveryOverview();
  const registry = useDeveloperRegistry();
  const submissions = useCodeSubmissions();
  const counts: Partial<Record<DMScreen, number | undefined>> = {
    onboarding_requests: registry.data?.filter((d) => !d.onboardingCompleted && d.status !== 'exited').length,
    task_management: overview.data?.stats.activeTasks,
    review_qa: submissions.data?.filter((s) => s.status === 'submitted').length,
    alerts_escalation: overview.data
      ? overview.data.risks.length +
        overview.data.blocked.length +
        overview.data.escalations.filter((e) => e.status === 'pending' || e.status === 'acknowledged').length
      : undefined,
  };
  // The bell lists what is waiting on a manager here, from the same counts as
  // the sidebar badges; each entry opens its screen.
  const notifications = (
    [
      ['onboarding_requests', 'devmanager.nav.notify_onboarding'],
      ['review_qa', 'devmanager.nav.notify_review'],
      ['alerts_escalation', 'devmanager.nav.notify_alerts'],
    ] as const
  )
    .filter(([id]) => (counts[id] ?? 0) > 0)
    .map(([id, key]) => ({
      id,
      title: t(key, { count: counts[id] ?? 0 }),
      onClick: () => setActiveScreen(id),
    }));
  const navigate = useNavigate();
  const groups = useMemo<UnifiedNavGroup[]>(
    () =>
      GROUPS.map((g) => ({
        title: t(g.title),
        items: g.items.map((source) => {
          const i = { ...source, label: t(source.label) };
          const n = counts[i.id as DMScreen];
          return n ? { ...i, badge: n } : i;
        }),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, counts.onboarding_requests, counts.task_management, counts.review_qa, counts.alerts_escalation],
  );

  return (
    <UnifiedShell
      brandTitle={t('devmanager.nav.brand_title')}
      brandSubtitle={t('devmanager.nav.brand_subtitle')}
      brandIcon={Code2}
      groups={groups}
      activeId={activeScreen}
      onSelect={(id) => setActiveScreen(id as DMScreen)}
      topbarTitle={title}
      onBack={() => void navigate({ to: '/control-panel' })}
      backLabel={t('devmanager.nav.back_label')}
      notifications={notifications}
    >
      {renderScreen()}
    </UnifiedShell>
  );
};

export default DMFullLayout;
