import { motion, useReducedMotion } from "framer-motion";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Ticket, Phone, TrendingUp } from "lucide-react";
import { useLeads, useTickets, useEscalations, useCallLogs } from "@/hooks/useSalesSupportData";

// Import all SSM modules
import {
  SupportTeamModule,
  SalesTeamModule,
  SupportTicketsModule,
  SalesLeadsModule,
  CRMCustomersModule,
  CallCenterModule,
  EmailQueueModule,
  LiveChatModule,
  EscalationsModule,
  SLAComplianceModule,
  AIInsightsModule,
  SSMSettingsModule,
} from "@/components/sales-support/modules";
import SalesPerformanceDashboard from "@/components/sales-support/SalesPerformanceDashboard";
import LeadInbox from "@/components/sales-support/LeadInbox";

const SalesSupportDashboard = () => {
  const navigate = useNavigate();
  const { section } = useSearch({ from: "/" });
  const activeSection = section ?? "overview";
  const reduceMotion = useReducedMotion();

  // Live KPI data
  const { data: leads } = useLeads();
  const { data: tickets } = useTickets();
  const { data: escalations } = useEscalations();
  const { data: calls } = useCallLogs();

  const ticketsWaiting = (tickets ?? []).filter((t) => t.status === "open" || t.status === "pending").length;
  const slaBreachRisk = (tickets ?? []).filter((t) => t.sla_breached || t.sla_minutes_remaining <= 30).length
    + (escalations ?? []).filter((e) => e.status !== "resolved" && e.level >= 2).length;
  const missedCalls = (calls ?? []).filter((c) => c.status === "missed").length;
  const hotLeads = (leads ?? []).filter(
    (l) => l.urgency === "hot" && l.stage !== "won" && l.stage !== "lost",
  ).length;

  // KPI cards deep-link to the filtered view via the URL
  const setSection = (next: string) => {
    navigate({ to: "/", search: { section: next } });
  };

  const kpis = [
    { id: "support-tickets", label: "Tickets Waiting", value: ticketsWaiting, icon: Ticket, tone: "cyan" },
    { id: "escalations", label: "SLA Breach Risk", value: slaBreachRisk, icon: AlertTriangle, tone: "red" },
    { id: "call-center", label: "Missed Calls", value: missedCalls, icon: Phone, tone: "amber" },
    { id: "sales-leads", label: "Hot Sales Leads", value: hotLeads, icon: TrendingUp, tone: "purple" },
  ] as const;

  const toneClasses: Record<string, { border: string; chip: string; icon: string; value: string }> = {
    cyan: { border: "border-cyan-500/20", chip: "bg-cyan-500/20", icon: "text-cyan-400", value: "text-cyan-100" },
    red: { border: "border-red-500/20", chip: "bg-red-500/20", icon: "text-red-400", value: "text-red-100" },
    amber: { border: "border-amber-500/20", chip: "bg-amber-500/20", icon: "text-amber-400", value: "text-amber-100" },
    purple: { border: "border-purple-500/20", chip: "bg-purple-500/20", icon: "text-purple-400", value: "text-purple-100" },
  };

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {kpis.map((kpi) => {
                const tone = toneClasses[kpi.tone]!;
                const Icon = kpi.icon;
                return (
                  <button
                    key={kpi.id}
                    type="button"
                    onClick={() => setSection(kpi.id)}
                    aria-label={`${kpi.label}: ${kpi.value}. Open ${kpi.label} view`}
                    className="text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <Card className={`bg-card/60 ${tone.border} hover:bg-card/60 transition-colors h-full`}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg ${tone.chip} flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 ${tone.icon}`} aria-hidden="true" />
                          </div>
                          <div>
                            <div className={`text-2xl font-bold ${tone.value}`}>{kpi.value}</div>
                            <div className="text-xs text-muted-foreground">{kpi.label}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-6">
              <LeadInbox />
            </div>
          </div>
        );
      case "support-team": return <SupportTeamModule />;
      case "sales-team": return <SalesTeamModule />;
      case "support-tickets": return <SupportTicketsModule />;
      case "sales-leads": return <SalesLeadsModule />;
      case "crm": return <CRMCustomersModule />;
      case "call-center": return <CallCenterModule />;
      case "email-queue": return <EmailQueueModule />;
      case "live-chat": return <LiveChatModule />;
      case "escalations": return <EscalationsModule />;
      case "sla-compliance": return <SLAComplianceModule />;
      case "performance": return <SalesPerformanceDashboard />;
      case "reports": return <SalesPerformanceDashboard />;
      case "support-activity": return <SupportTicketsModule />;
      case "sales-activity": return <SalesLeadsModule />;
      case "ai-insights": return <AIInsightsModule />;
      case "settings": return <SSMSettingsModule />;
      default: return <LeadInbox />;
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.5 }}
      className="flex min-h-full w-full"
    >
      <div className="flex-1 flex flex-col min-w-0">
        <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto px-4 py-6 sm:px-6">
          <motion.div
            key={activeSection}
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.4 }}
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>
    </motion.div>
  );
};

export default SalesSupportDashboard;
