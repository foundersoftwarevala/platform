import { useState } from 'react';
import { useSearch } from '@tanstack/react-router';
import { useNavigate } from '@/lib/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, Inbox, AlertCircle, MessageCircle, 
  ArrowUpRight, BookOpen, BarChart3, Heart, FileText, Settings, LogOut, Lock,
  ArrowLeft, KeyRound, Hash, Users, Clock, Zap, MessageSquare, Shield, Activity,
  Calendar, Brain, Target, Layers, CheckSquare, Database
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import SupportMetrics from '@/components/support/SupportMetrics';
import TicketInbox from '@/components/support/TicketInbox';
import PriorityQueue from '@/components/support/PriorityQueue';
import SolutionWiki from '@/components/support/SolutionWiki';
import PerformancePanel from '@/components/support/PerformancePanel';
import SupportNotifications from '@/components/support/SupportNotifications';
import AITroubleshooter from '@/components/support/AITroubleshooter';
import TokenSystem from '@/components/support/TokenSystem';
import OmniChannelInbox from '@/components/support/OmniChannelInbox';
import Customer360Panel from '@/components/support/Customer360Panel';
import SLAManagement from '@/components/support/SLAManagement';
import AIFeaturesPanel from '@/components/support/AIFeaturesPanel';
import ShiftAvailability from '@/components/support/ShiftAvailability';
import FraudDetection from '@/components/support/FraudDetection';
import SupportAnalytics from '@/components/support/SupportAnalytics';
import CannedResponses from '@/components/support/CannedResponses';
import TokenCommandCenter from '@/components/support/TokenCommandCenter';
import QualityAudit from '@/components/support/QualityAudit';
import ApprovalWorkflow from '@/components/support/ApprovalWorkflow';
import SystemLogs from '@/components/support/SystemLogs';

const SupportDashboard = () => {
  const { section } = useSearch({ from: '/support' });
  const activeSection = section ?? 'dashboard';
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showCustomer360, setShowCustomer360] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth');
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <SupportMetrics />;
      case 'command':
        return <TokenCommandCenter />;
      case 'inbox':
        return <TicketInbox />;
      case 'tokens':
        return <TokenSystem />;
      case 'priority':
      case 'escalation':
        return <PriorityQueue />;
      case 'omnichannel':
        return <OmniChannelInbox />;
      case 'sla':
        return <SLAManagement />;
      case 'approvals':
        return <ApprovalWorkflow />;
      case 'canned':
        return <CannedResponses />;
      case 'wiki':
        return <SolutionWiki />;
      case 'ai':
        return <AIFeaturesPanel />;
      case 'shifts':
        return <ShiftAvailability />;
      case 'fraud':
        return <FraudDetection />;
      case 'quality':
        return <QualityAudit />;
      case 'analytics':
        return <SupportAnalytics />;
      case 'logs':
        return <SystemLogs />;
      case 'activity':
        return <PerformancePanel />;
      default:
        return <SupportMetrics />;
    }
  };

  return (
    <div className="min-h-full w-full">
      {/* Calm Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.06),transparent_50%)]" />
        
        {/* Subtle Grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]">
          <defs>
            <pattern id="support-grid" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-teal-400" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#support-grid)" />
        </svg>

        {/* Soft Floating Orbs */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-64 h-64 rounded-full blur-3xl"
            style={{
              left: `${20 + (i * 15) % 80}%`,
              top: `${10 + (i * 20) % 70}%`,
              background: i % 2 === 0 
                ? 'radial-gradient(circle, rgba(20,184,166,0.04), transparent)' 
                : 'radial-gradient(circle, rgba(56,189,248,0.03), transparent)',
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 8 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>


      <div className="flex">
        {/* Main Content */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setShowAIPanel(true)}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-2 text-xs font-medium text-foreground transition-colors hover:bg-primary/25"
            >
              <Brain className="h-3.5 w-3.5" />
              AI Troubleshooter
            </button>
            <button
              onClick={() => setShowCustomer360(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Users className="h-3.5 w-3.5" />
              Customer 360
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <Activity className="h-3.5 w-3.5" />
              Alerts
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Panels */}
      <AnimatePresence>
        {showNotifications && (
          <SupportNotifications onClose={() => setShowNotifications(false)} />
        )}
        {showAIPanel && (
          <AITroubleshooter isOpen={showAIPanel} onClose={() => setShowAIPanel(false)} />
        )}
        <Customer360Panel 
          isOpen={showCustomer360} 
          onClose={() => setShowCustomer360(false)} 
        />
      </AnimatePresence>
    </div>
  );
};

export default SupportDashboard;
