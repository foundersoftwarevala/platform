import {
  AlertTriangle,
  ArrowUp,
  ArrowUpCircle,
  Bot,
  CalendarClock,
  Handshake,
  Headphones,
  Key,
  Shield,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import {
  usePMAssistSessions,
  usePMCompliance,
  usePMConversations,
  usePMDecisions,
  usePMEscalations,
  usePMLicenses,
  usePMPromises,
  usePMRenewals,
  usePMSatisfaction,
  usePMTickets,
  usePMUpgrades,
  usePMUsers,
} from "@/hooks/rd-module/useProManagerData";
import { PMEmpty, PMPanel, PMSection, PMStat, StatusBadge, formatDate } from "../pm-ui";
import { PMSystemHealth } from "../PMSystemHealth";
import { PMPromiseSLABoard } from "../PMPromiseSLABoard";
import { PMEscalationsQueue } from "../PMEscalationsQueue";
import { PMQualityAlerts } from "../PMQualityAlerts";
import { PMManagerSnapshot } from "../PMManagerSnapshot";
import { PMDecisionsPending } from "../PMDecisionsPending";
import { PMReportsAudit } from "../PMReportsAudit";
import type { PROScreen } from "../PROSidebar";

export const PRODashboard = ({ onNavigate }: { onNavigate: (screen: PROScreen) => void }) => {
  const { data: users } = usePMUsers();
  const { data: tickets } = usePMTickets();
  const { data: promises } = usePMPromises();
  const { data: upgrades } = usePMUpgrades();
  const { data: renewals } = usePMRenewals();
  const { data: licenses } = usePMLicenses();
  const { data: assist } = usePMAssistSessions();
  const { data: conversations } = usePMConversations();
  const { data: escalations } = usePMEscalations();
  const { data: satisfaction } = usePMSatisfaction();
  const { data: compliance } = usePMCompliance();
  const { data: decisions } = usePMDecisions();

  const conv = conversations ?? [];
  const resolvedConv = conv.filter((c) => c.status === "resolved").length;
  const aiSuccess = conv.length ? `${Math.round((resolvedConv / conv.length) * 100)}%` : "—";

  const cards = [
    {
      id: "pro_user_registry" as PROScreen,
      label: "Active Pro users",
      value: (users ?? []).filter((u) => u.status === "active").length,
      icon: Users,
      tone: "brand" as const,
    },
    {
      id: "support_requests" as PROScreen,
      label: "Open support tickets",
      value: (tickets ?? []).filter((t) => !["resolved", "closed"].includes(t.status)).length,
      icon: Headphones,
      tone: "warning" as const,
    },
    {
      id: "promise_sla_tracker" as PROScreen,
      label: "SLA at risk",
      value: (promises ?? []).filter((p) => ["near_breach", "breached"].includes(p.status)).length,
      icon: AlertTriangle,
      tone: "danger" as const,
    },
    {
      id: "upgrade_addons" as PROScreen,
      label: "Pending upgrades",
      value: (upgrades ?? []).filter((u) => u.status === "pending").length,
      icon: ArrowUpCircle,
      tone: "success" as const,
    },
    {
      id: "renewal_expiry" as PROScreen,
      label: "Renewals due",
      value: (renewals ?? []).filter((r) => ["due", "upcoming", "grace"].includes(r.status)).length,
      icon: CalendarClock,
      tone: "info" as const,
    },
    {
      id: "license_domain" as PROScreen,
      label: "License issues",
      value: (licenses ?? []).filter((l) => l.domain_status !== "verified").length,
      icon: Key,
      tone: "warning" as const,
    },
    {
      id: "premium_assist" as PROScreen,
      label: "Assist sessions running",
      value: (assist ?? []).filter((a) => a.status === "active").length,
      icon: Handshake,
      tone: "info" as const,
    },
    {
      id: "ai_helpdesk" as PROScreen,
      label: "AI auto-resolve rate",
      value: aiSuccess,
      icon: Bot,
      tone: "success" as const,
    },
    {
      id: "alerts_escalation" as PROScreen,
      label: "Escalated issues",
      value: (escalations ?? []).filter((e) => e.status !== "resolved").length,
      icon: ArrowUp,
      tone: "danger" as const,
    },
    {
      id: "renewal_expiry" as PROScreen,
      label: "Payment hold",
      value: (renewals ?? []).filter((r) => r.status === "suspended").length,
      icon: Wallet,
      tone: "warning" as const,
    },
    {
      id: "satisfaction_rating" as PROScreen,
      label: "Low satisfaction",
      value: (satisfaction ?? []).filter((s) => s.csat <= 3).length,
      icon: Star,
      tone: "danger" as const,
    },
    {
      id: "compliance_policy" as PROScreen,
      label: "Compliance flags",
      value: (compliance ?? []).filter((c) => c.legal_flag || c.violations > 0).length,
      icon: Shield,
      tone: "info" as const,
    },
  ];

  const activity = [
    ...(tickets ?? []).slice(0, 4).map((t) => ({
      id: t.code,
      user: t.user_code,
      action: "Support ticket",
      status: t.status,
      at: t.opened_at,
    })),
    ...(upgrades ?? []).slice(0, 3).map((u) => ({
      id: u.code,
      user: u.user_code,
      action: "Upgrade request",
      status: u.status,
      at: u.created_at,
    })),
    ...(decisions ?? []).slice(0, 3).map((d) => ({
      id: d.code,
      user: d.requested_by,
      action: "Decision request",
      status: d.status,
      at: d.requested_at,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return (
    <PMSection
      title="Pro Dashboard"
      description="Premium account governance overview across every Pro Manager surface."
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <PMStat
            key={`${card.id}-${card.label}`}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone}
            onClick={() => onNavigate(card.id)}
          />
        ))}
      </div>

      <PMPanel
        title="Recent Pro activity"
        description="Latest tickets, upgrade requests and decision requests"
      >
        {activity.length === 0 ? (
          <PMEmpty message="No recent activity recorded." />
        ) : (
          <ul className="space-y-2">
            {activity.map((item, index) => (
              <li
                key={`${item.id}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-brand">{item.id}</span>
                  <span className="text-foreground">{item.user}</span>
                  <span className="text-xs text-muted-foreground">{item.action}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={item.status} />
                  <span className="text-xs text-muted-foreground">{formatDate(item.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PMPanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <PMSystemHealth />
        <PMManagerSnapshot />
      </div>
      <PMPromiseSLABoard />
      <div className="grid gap-4 xl:grid-cols-2">
        <PMEscalationsQueue />
        <PMQualityAlerts />
      </div>
      <PMDecisionsPending />
      <PMReportsAudit />
    </PMSection>
  );
};
