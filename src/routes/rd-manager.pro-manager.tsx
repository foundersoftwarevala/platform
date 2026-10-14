import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/rd-module/ui/sonner";
import {
  PROMobileNav,
  PROSidebar,
  type PROScreen,
} from "@/components/rd-module/pro-manager/PROSidebar";
import { PROTopBar } from "@/components/rd-module/pro-manager/PROTopBar";
import { PRODashboard } from "@/components/rd-module/pro-manager/screens/PRODashboard";
import { PROUserRegistry } from "@/components/rd-module/pro-manager/screens/PROUserRegistry";
import { PROProductOwnership } from "@/components/rd-module/pro-manager/screens/PROProductOwnership";
import { PROLicenseDomain } from "@/components/rd-module/pro-manager/screens/PROLicenseDomain";
import { PROSupportRequests } from "@/components/rd-module/pro-manager/screens/PROSupportRequests";
import { PROIssueBugTracker } from "@/components/rd-module/pro-manager/screens/PROIssueBugTracker";
import { PROPremiumAssist } from "@/components/rd-module/pro-manager/screens/PROPremiumAssist";
import { PROPromiseSLATracker } from "@/components/rd-module/pro-manager/screens/PROPromiseSLATracker";
import { PROUpgradeAddons } from "@/components/rd-module/pro-manager/screens/PROUpgradeAddons";
import { PRORenewalExpiry } from "@/components/rd-module/pro-manager/screens/PRORenewalExpiry";
import { PROUsageLimits } from "@/components/rd-module/pro-manager/screens/PROUsageLimits";
import { PROAIHelpdesk } from "@/components/rd-module/pro-manager/screens/PROAIHelpdesk";
import { PROCommunicationLog } from "@/components/rd-module/pro-manager/screens/PROCommunicationLog";
import { PROAlertsEscalation } from "@/components/rd-module/pro-manager/screens/PROAlertsEscalation";
import { PROSatisfactionRating } from "@/components/rd-module/pro-manager/screens/PROSatisfactionRating";
import { PROCompliancePolicy } from "@/components/rd-module/pro-manager/screens/PROCompliancePolicy";
import { PROAuditLogs } from "@/components/rd-module/pro-manager/screens/PROAuditLogs";
import { PROSettings } from "@/components/rd-module/pro-manager/screens/PROSettings";
import {
  usePMAlerts,
  usePMDecisions,
  usePMEscalations,
  usePMIssues,
  usePMTickets,
  usePMUpgrades,
  usePMUsers,
} from "@/hooks/rd-module/useProManagerData";

const SESSION_MINUTES = 30;

export const Route = createFileRoute("/rd-manager/pro-manager")({
  head: () => ({
    meta: [
      { title: "Pro Manager — Software Vala" },
      {
        name: "description",
        content:
          "Software Vala Pro Manager: premium account governance, SLA promises, escalations, AI helpdesk, compliance and immutable audit trail.",
      },
      { property: "og:title", content: "Pro Manager — Software Vala" },
      {
        property: "og:description",
        content:
          "Premium account governance, SLA tracking, AI helpdesk and audit-grade decision logging.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProManagerDashboard,
});

function ProManagerDashboard() {
  const [activeScreen, setActiveScreen] = useState<PROScreen>("pro_dashboard");
  const [search, setSearch] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(SESSION_MINUTES * 60);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const reset = () => setSecondsLeft(SESSION_MINUTES * 60);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);

  const { data: users } = usePMUsers();
  const { data: tickets } = usePMTickets();
  const { data: issues } = usePMIssues();
  const { data: upgrades } = usePMUpgrades();
  const { data: alerts } = usePMAlerts();
  const { data: escalations } = usePMEscalations();
  const { data: decisions } = usePMDecisions();

  const openTickets = (tickets ?? []).filter(
    (t) => !["resolved", "closed"].includes(t.status),
  ).length;
  const openEscalations = (escalations ?? []).filter((e) => e.status !== "resolved").length;
  const pendingDecisions = (decisions ?? []).filter((d) => d.status === "pending").length;

  const badges = useMemo(
    () => ({
      support_requests: openTickets,
      issue_bug_tracker: (issues ?? []).filter((i) => i.status !== "resolved").length,
      upgrade_addons: (upgrades ?? []).filter((u) => u.status === "pending").length,
      alerts_escalation: (alerts ?? []).filter((a) => !a.acknowledged).length + openEscalations,
    }),
    [openTickets, issues, upgrades, alerts, openEscalations],
  );

  const sessionLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")} session`;

  return (
    <div className="flex min-h-dvh">
      <PROSidebar activeScreen={activeScreen} onScreenChange={setActiveScreen} badges={badges} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PROTopBar
          activeScreen={activeScreen}
          search={search}
          onSearchChange={setSearch}
          mobileNav={
            <PROMobileNav
              activeScreen={activeScreen}
              onScreenChange={setActiveScreen}
              badges={badges}
            />
          }
          sessionLabel={secondsLeft === 0 ? "session expired" : sessionLabel}
          stats={{
            users: users?.length ?? 0,
            tickets: openTickets,
            escalations: openEscalations,
            decisions: pendingDecisions,
          }}
        />
        <main className="flex-1 p-4 sm:p-6">
          <h1 className="sr-only">Software Vala Pro Manager</h1>
          {activeScreen === "pro_dashboard" && <PRODashboard onNavigate={setActiveScreen} />}
          {activeScreen === "pro_user_registry" && <PROUserRegistry search={search} />}
          {activeScreen === "product_ownership" && <PROProductOwnership search={search} />}
          {activeScreen === "license_domain" && <PROLicenseDomain search={search} />}
          {activeScreen === "support_requests" && <PROSupportRequests search={search} />}
          {activeScreen === "issue_bug_tracker" && <PROIssueBugTracker search={search} />}
          {activeScreen === "premium_assist" && <PROPremiumAssist search={search} />}
          {activeScreen === "promise_sla_tracker" && <PROPromiseSLATracker />}
          {activeScreen === "upgrade_addons" && <PROUpgradeAddons search={search} />}
          {activeScreen === "renewal_expiry" && <PRORenewalExpiry search={search} />}
          {activeScreen === "usage_limits" && <PROUsageLimits search={search} />}
          {activeScreen === "ai_helpdesk" && <PROAIHelpdesk search={search} />}
          {activeScreen === "communication_log" && <PROCommunicationLog search={search} />}
          {activeScreen === "alerts_escalation" && <PROAlertsEscalation search={search} />}
          {activeScreen === "satisfaction_rating" && <PROSatisfactionRating search={search} />}
          {activeScreen === "compliance_policy" && <PROCompliancePolicy search={search} />}
          {activeScreen === "audit_logs" && <PROAuditLogs search={search} />}
          {activeScreen === "settings" && <PROSettings />}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
