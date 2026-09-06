/**
 * DEVELOPER MANAGEMENT - FULL SIDEBAR
 * Internal Human Developers Only
 * NO AI • NO VALA AI • Enterprise Mode
 */

import React from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Layers,
  ListTodo,
  Target,
  Hammer,
  FileCode,
  CheckCircle,
  Bug,
  TrendingUp,
  Wallet,
  Shield,
  Lock,
  AlertTriangle,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export type DMScreen =
  | 'developer_dashboard'
  | 'developer_registry'
  | 'onboarding_requests'
  | 'role_skill_mapping'
  | 'task_management'
  | 'sprint_milestone'
  | 'build_assignment'
  | 'code_submission'
  | 'review_qa'
  | 'bug_fix_tracker'
  | 'performance_kpi'
  | 'payment_incentive'
  | 'compliance_nda'
  | 'security_access'
  | 'alerts_escalation'
  | 'audit_logs'
  | 'settings';

interface SidebarItem {
  id: DMScreen;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const sidebarItems: SidebarItem[] = [
  { id: 'developer_dashboard', label: 'Developer Dashboard', icon: LayoutDashboard },
  { id: 'developer_registry', label: 'Developer Registry', icon: Users },
  { id: 'onboarding_requests', label: 'Onboarding Requests', icon: UserPlus, badge: 3 },
  { id: 'role_skill_mapping', label: 'Role & Skill Mapping', icon: Layers },
  { id: 'task_management', label: 'Task Management', icon: ListTodo, badge: 12 },
  { id: 'sprint_milestone', label: 'Sprint / Milestone', icon: Target },
  { id: 'build_assignment', label: 'Build Assignment', icon: Hammer },
  { id: 'code_submission', label: 'Code Submission', icon: FileCode },
  { id: 'review_qa', label: 'Review & QA', icon: CheckCircle, badge: 5 },
  { id: 'bug_fix_tracker', label: 'Bug & Fix Tracker', icon: Bug, badge: 8 },
  { id: 'performance_kpi', label: 'Performance & KPI', icon: TrendingUp },
  { id: 'payment_incentive', label: 'Payment & Incentive', icon: Wallet },
  { id: 'compliance_nda', label: 'Compliance & NDA', icon: Shield },
  { id: 'security_access', label: 'Security & Access', icon: Lock },
  { id: 'alerts_escalation', label: 'Alerts & Escalation', icon: AlertTriangle, badge: 2 },
  { id: 'audit_logs', label: 'Audit Logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface DMFullSidebarProps {
  activeScreen: DMScreen;
  onScreenChange: (screen: DMScreen) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const DMFullSidebar: React.FC<DMFullSidebarProps> = ({
  activeScreen,
  onScreenChange,
  collapsed = false,
  onToggleCollapse
}) => {
  return (
    <div className={cn(
      "h-full bg-card border-r border-border flex flex-col transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm text-foreground">Developer Management</span>
          </div>
        )}
        {collapsed && <Users className="h-5 w-5 text-primary mx-auto" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sidebarItems.map((item) => (
            <Button
              key={item.id}
              variant={activeScreen === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-3 h-10",
                collapsed && "justify-center px-2"
              )}
              onClick={() => onScreenChange(item.id)}
            >
              <item.icon className="h-4 w-4 shrink-0 text-foreground" />
              {!collapsed && (
                <>
                  <span className="text-sm truncate text-foreground">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!collapsed && (
          <div className="text-xs text-muted-foreground text-center">
            INTERNAL DEVELOPERS ONLY
          </div>
        )}
      </div>
    </div>
  );
};

export default DMFullSidebar;
