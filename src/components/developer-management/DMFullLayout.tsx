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

import React, { useState } from 'react';
import {
  LayoutDashboard, Users, UserPlus, Layers, ListTodo, Target, Hammer,
  FileCode, CheckCircle, Bug, TrendingUp, Wallet, Shield, Lock,
  AlertTriangle, FileText, Settings, Code2,
} from 'lucide-react';
import { UnifiedShell, UnifiedNavGroup } from '@/components/unified/UnifiedShell';
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

const GROUPS: UnifiedNavGroup[] = [
  {
    title: 'Overview',
    items: [{ id: 'developer_dashboard', label: 'Developer Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'People & Skills',
    items: [
      { id: 'developer_registry', label: 'Developer Registry', icon: Users },
      { id: 'onboarding_requests', label: 'Onboarding Requests', icon: UserPlus, badge: 3 },
      { id: 'role_skill_mapping', label: 'Role & Skill Mapping', icon: Layers },
    ],
  },
  {
    title: 'Work Pipeline',
    items: [
      { id: 'task_management', label: 'Task Management', icon: ListTodo, badge: 12 },
      { id: 'sprint_milestone', label: 'Sprint / Milestone', icon: Target },
      { id: 'build_assignment', label: 'Build Assignment', icon: Hammer },
      { id: 'code_submission', label: 'Code Submission', icon: FileCode },
      { id: 'review_qa', label: 'Review & QA', icon: CheckCircle },
      { id: 'bug_fix_tracker', label: 'Bug Fix Tracker', icon: Bug },
    ],
  },
  {
    title: 'Performance & Payout',
    items: [
      { id: 'performance_kpi', label: 'Performance KPI', icon: TrendingUp },
      { id: 'payment_incentive', label: 'Payment & Incentive', icon: Wallet },
    ],
  },
  {
    title: 'Governance',
    items: [
      { id: 'compliance_nda', label: 'Compliance & NDA', icon: Shield },
      { id: 'security_access', label: 'Security & Access', icon: Lock },
      { id: 'alerts_escalation', label: 'Alerts & Escalation', icon: AlertTriangle },
      { id: 'audit_logs', label: 'Audit Logs', icon: FileText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const DMFullLayout: React.FC = () => {
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

  const title =
    GROUPS.flatMap((g) => g.items).find((i) => i.id === activeScreen)?.label ??
    'Developer Management';

  return (
    <UnifiedShell
      brandTitle="Developer Mgmt"
      brandSubtitle="Enterprise Mode"
      brandIcon={Code2}
      groups={GROUPS}
      activeId={activeScreen}
      onSelect={(id) => setActiveScreen(id as DMScreen)}
      topbarTitle={title}
    >
      {renderScreen()}
    </UnifiedShell>
  );
};

export default DMFullLayout;
