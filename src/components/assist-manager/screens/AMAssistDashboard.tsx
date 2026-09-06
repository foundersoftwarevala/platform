/**
 * ASSIST DASHBOARD
 * Live status cards, recent sessions and agent presence — all from the backend.
 */

import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle,
  Clock,
  MonitorPlay,
  Radio,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAgents, useApprovals, useRequests, useSessions } from "@/lib/assist-manager/hooks";
import {
  ACCESS_MODE_LABEL,
  CodeChip,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  StatusPill,
  formatDuration,
  titleCase,
} from "../am-ui";
import { useAM } from "../am-context";
import type { AMSection } from "../AMFullSidebar";

interface AMAssistDashboardProps {
  onNavigate: (section: AMSection) => void;
}

export function AMAssistDashboard({ onNavigate }: AMAssistDashboardProps) {
  const { openSession } = useAM();
  const { data: sessions = [], isLoading } = useSessions();
  const { data: requests = [] } = useRequests();
  const { data: approvals = [] } = useApprovals();
  const { data: agents = [], isLoading: agentsLoading } = useAgents();

  const cards = [
    {
      section: "active_sessions" as AMSection,
      label: "Live Sessions",
      value: sessions.filter((s) => s.status === "active" || s.status === "paused").length,
      icon: Radio,
      tone: "text-success bg-success/10 border-success/25",
    },
    {
      section: "session_requests" as AMSection,
      label: "Pending Requests",
      value: requests.filter((r) => r.status === "pending").length,
      icon: Clock,
      tone: "text-warning bg-warning/10 border-warning/25",
    },
    {
      section: "pending_approval" as AMSection,
      label: "Approved Sessions",
      value: approvals.filter((a) => a.status === "approved").length,
      icon: CheckCircle,
      tone: "text-info bg-info/10 border-info/25",
    },
    {
      section: "active_sessions" as AMSection,
      label: "Blocked Sessions",
      value: sessions.filter((s) => s.status === "blocked").length,
      icon: XCircle,
      tone: "text-destructive bg-destructive/10 border-destructive/25",
    },
    {
      section: "ai_assist_layer" as AMSection,
      label: "AI Assisted",
      value: sessions.filter((s) => s.ai_involved).length,
      icon: Brain,
      tone: "text-primary bg-primary/10 border-primary/25",
    },
    {
      section: "emergency_stop" as AMSection,
      label: "Security Alerts",
      value: sessions.filter((s) => s.risk_level === "high" || s.status === "terminated").length,
      icon: AlertTriangle,
      tone: "text-destructive bg-destructive/10 border-destructive/25",
    },
  ];

  const recent = sessions.slice(0, 6);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Assist Dashboard"
          subtitle="VALA Connect — remote session management"
          actions={
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-success" />
              System Online
            </span>
          }
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.label}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate(card.section)}
                onKeyDown={(e) => e.key === "Enter" && onNavigate(card.section)}
                className="cursor-pointer transition-colors hover:border-primary"
              >
                <CardContent className="p-4">
                  <span
                    className={cn(
                      "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg border",
                      card.tone,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorPlay className="h-5 w-5 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingBlock />
            ) : recent.length === 0 ? (
              <EmptyState title="No sessions yet" description="Create an assist to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Session</th>
                      <th className="px-4 py-3 font-medium">User</th>
                      <th className="px-4 py-3 font-medium">Agent</th>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Mode</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => openSession(s.id)}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="px-4 py-3">
                          <CodeChip>{s.session_code}</CodeChip>
                        </td>
                        <td className="code-chip px-4 py-3 text-xs">{s.end_user?.user_code ?? "—"}</td>
                        <td className="code-chip px-4 py-3 text-xs">{s.agent?.agent_code ?? "—"}</td>
                        <td className="px-4 py-3">{titleCase(s.assist_type)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {ACCESS_MODE_LABEL[s.access_mode] ?? titleCase(s.access_mode)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={s.status} />
                        </td>
                        <td className="code-chip px-4 py-3 text-xs">
                          {formatDuration(s.started_at, s.ended_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <LoadingBlock rows={2} />
            ) : agents.length === 0 ? (
              <EmptyState title="No agents" description="No assist agents are registered." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{agent.display_name}</p>
                      <p className="code-chip text-xs text-muted-foreground">{agent.agent_code}</p>
                    </div>
                    <span
                      className={cn(
                        "ml-auto h-2 w-2 shrink-0 rounded-full",
                        agent.status === "available"
                          ? "bg-success"
                          : agent.status === "in_session"
                            ? "bg-warning"
                            : "bg-muted-foreground",
                      )}
                      title={titleCase(agent.status)}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMAssistDashboard;
