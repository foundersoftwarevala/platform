/**
 * Internal Support AI Manager - Main Container
 * Routes between all support modules
 */

import React from "react";
import { motion } from "framer-motion";
import { useSearch } from "@tanstack/react-router";
import { SupportDashboard } from "./sections/SupportDashboard";
import { AutoIssueDetection } from "./sections/AutoIssueDetection";
import { AutoFixEngine } from "./sections/AutoFixEngine";
import { EscalationManager } from "./sections/EscalationManager";
import { AITransparencyLog } from "./sections/AITransparencyLog";
import { SecurityPrivacy } from "./sections/SecurityPrivacy";
import { SupportAISection } from "./types";
import { AIStatusStrip } from "./AIStatusStrip";
import {
  isOpenEscalation,
  isOpenTicket,
  pct,
  useHealing,
  useSupportEscalations,
  useSupportTickets,
} from "./data";
import { useSessionRole } from "@/hooks/use-permissions";

interface InternalSupportAIContainerProps {
  onBack?: () => void;
}

export const InternalSupportAIContainer: React.FC<InternalSupportAIContainerProps> = ({
  onBack,
}) => {
  const { section } = useSearch({ from: "/internal-support-ai" });
  const activeSection = (section ?? "dashboard") as SupportAISection;

  // Status strip figures, from the same live reads the sections use.
  const ticketsQ = useSupportTickets();
  const escalationsQ = useSupportEscalations();
  const healingQ = useHealing();
  const { role: sessionRole } = useSessionRole();

  const openTickets = (ticketsQ.data ?? []).filter(isOpenTicket);
  const slaMinutes = openTickets
    .map((t) => t.sla_minutes_remaining)
    .filter((m): m is number => typeof m === "number");
  const totals = healingQ.data?.totals ?? null;
  const anyLoading = ticketsQ.isLoading || escalationsQ.isLoading || healingQ.isLoading;
  const anyFailed =
    ticketsQ.isError ||
    escalationsQ.isError ||
    healingQ.isError ||
    (healingQ.data?.degraded.length ?? 0) > 0;
  const stripStatus = anyLoading ? null : anyFailed ? "DEGRADED" : "LIVE";

  const renderContent = () => {
    switch (activeSection) {
      case "dashboard":
        return <SupportDashboard activeView={activeSection} />;
      case "auto-detection":
        return <AutoIssueDetection activeView={activeSection} />;
      case "issue-classification":
        return <AutoIssueDetection activeView={activeSection} />;
      case "auto-fix-engine":
        return <AutoFixEngine activeView={activeSection} />;
      case "smart-clarification":
        return <SupportDashboard activeView={activeSection} />;
      case "escalation-manager":
        return <EscalationManager activeView={activeSection} />;
      case "resolution-confirmation":
        return <SupportDashboard activeView={activeSection} />;
      case "knowledge-intelligence":
        return <SupportDashboard activeView={activeSection} />;
      case "ai-transparency-log":
        return <AITransparencyLog activeView={activeSection} />;
      case "security-privacy":
        return <SecurityPrivacy activeView={activeSection} />;
      default:
        return <SupportDashboard activeView="dashboard" />;
    }
  };

  return (
    <div
      className="flex min-h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
    >
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}

        {/* Content */}
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto px-4 py-6 sm:px-6">
          <AIStatusStrip
            systemStatus={stripStatus}
            pendingIssues={ticketsQ.data ? openTickets.length : null}
            autoFixSuccessRate={totals ? pct(totals.autoRecovered, totals.incidents) : null}
            escalationQueue={
              escalationsQ.data ? escalationsQ.data.filter(isOpenEscalation).length : null
            }
            nearestSlaMinutes={slaMinutes.length ? Math.min(...slaMinutes) : null}
            userRole={sessionRole}
          />
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>

      {/* Anti-Screenshot Overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          background:
            "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.001) 10px, rgba(0,0,0,0.001) 20px)",
        }}
      />
    </div>
  );
};

export default InternalSupportAIContainer;
