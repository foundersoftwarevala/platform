/**
 * ASSIST MANAGER FULL LAYOUT
 * VALA CONNECT - Complete Layout with Sidebar
 */

import React from 'react';
import { AMFullSidebar, useAMSidebarState } from './AMFullSidebar';
import { AMProvider, useAM } from './am-context';
import { useApprovals, useRequests, useSessions } from '@/lib/assist-manager/hooks';
import { AMAssistDashboard } from './screens/AMAssistDashboard';
import { AMActiveSessions } from './screens/AMActiveSessions';
import { AMCreateAssist } from './screens/AMCreateAssist';
import { AMSessionRequests } from './screens/AMSessionRequests';
import { AMPendingApproval } from './screens/AMPendingApproval';
import { AMLiveAssist } from './screens/AMLiveAssist';
import { AMScreenControl } from './screens/AMScreenControl';
import { AMFileTransfer } from './screens/AMFileTransfer';
import { AMChatVoice } from './screens/AMChatVoice';
import { AMPrivacyControls } from './screens/AMPrivacyControls';
import { AMDeviceAccess } from './screens/AMDeviceAccess';
import { AMSessionLogs } from './screens/AMSessionLogs';
import { AMAIAssistLayer } from './screens/AMAIAssistLayer';
import { AMEmergencyStop } from './screens/AMEmergencyStop';
import { AMSettings } from './screens/AMSettings';
import { Activity, Menu, ShieldCheck } from 'lucide-react';

function AMShell() {
  const { section, setSection } = useAM();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useAMSidebarState();
  const { data: sessions = [] } = useSessions();
  const { data: requests = [] } = useRequests();
  const { data: approvals = [] } = useApprovals();

  const activeCount = sessions.filter((s) => s.status === 'active' || s.status === 'paused').length;
  const counts = {
    active_sessions: activeCount,
    session_requests: requests.filter((r) => r.status === 'pending').length,
    pending_approval: approvals.filter((a) => a.status === 'pending').length,
  };

  const renderContent = () => {
    switch (section) {
      case 'assist_dashboard':
        return <AMAssistDashboard onNavigate={setSection} />;
      case 'active_sessions':
        return <AMActiveSessions />;
      case 'create_assist':
        return <AMCreateAssist />;
      case 'session_requests':
        return <AMSessionRequests />;
      case 'pending_approval':
        return <AMPendingApproval />;
      case 'live_assist':
        return <AMLiveAssist />;
      case 'screen_control':
        return <AMScreenControl />;
      case 'file_transfer':
        return <AMFileTransfer />;
      case 'chat_voice':
        return <AMChatVoice />;
      case 'privacy_controls':
        return <AMPrivacyControls />;
      case 'device_access':
        return <AMDeviceAccess />;
      case 'session_logs':
        return <AMSessionLogs />;
      case 'ai_assist_layer':
        return <AMAIAssistLayer />;
      case 'emergency_stop':
        return <AMEmergencyStop />;
      case 'settings':
        return <AMSettings />;
      default:
        return <AMAssistDashboard onNavigate={setSection} />;
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AMFullSidebar
        activeSection={section}
        onSectionChange={setSection}
        counts={counts}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-semibold tracking-tight text-foreground">
              Software Vala
            </span>
            <span className="hidden text-border sm:inline">/</span>
            <span className="hidden truncate sm:inline">Assist Manager</span>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-success" />
            <span className="tabular-nums text-foreground">{activeCount}</span> live session
            {activeCount === 1 ? '' : 's'}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{renderContent()}</main>
      </div>
    </div>
  );
}

export function AMFullLayout() {
  return (
    <AMProvider>
      <AMShell />
    </AMProvider>
  );
}

export default AMFullLayout;
