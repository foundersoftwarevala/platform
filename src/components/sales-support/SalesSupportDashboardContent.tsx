import { cn } from "@/lib/utils";
import {
  Headset, Users, Ticket, Inbox, MessageCircle,
  Clock, AlertCircle, FileText, History, CheckCircle,
  TrendingUp, Eye, Loader2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
export type SalesSupportSection =
  | "overview"
  | "live_tickets"
  | "team_members"
  | "leads_inbox"
  | "customer_chats"
  | "followups"
  | "escalations"
  | "performance_reports"
  | "activity_log";
import {
  useTeamMembers,
  useTickets,
  useLeads,
  useEscalations,
  useCallLogs,
  useChatSessions,
  relativeTime,
  useUpdateRow,
} from "@/hooks/useSalesSupportData";

interface SalesSupportDashboardContentProps {
  activeSection: SalesSupportSection;
}

const SalesSupportDashboardContent = ({ activeSection }: SalesSupportDashboardContentProps) => {
  const { data: teamMembers, isLoading: teamLoading } = useTeamMembers();
  const { data: tickets, isLoading: ticketsLoading } = useTickets();
  const { data: leads, isLoading: leadsLoading } = useLeads();
  const { data: escalations } = useEscalations();
  const { data: calls } = useCallLogs();
  const { data: chatSessions } = useChatSessions();
  const updateTicket = useUpdateRow("support_tickets");

  const handleAction = (action: string, target?: string) => {
    toast.success(`${action}${target ? ` for ${target}` : ""}`);
  };

  const handleResolveTicket = async (id: string, reference: string) => {
    try {
      await updateTicket.mutateAsync({ id, values: { status: "resolved", resolved_at: new Date().toISOString() } });
      toast.success(`Resolved ${reference}`);
    } catch {
      toast.error("Failed to resolve ticket");
    }
  };

  const allMembers = teamMembers ?? [];
  const allTickets = tickets ?? [];
  const allLeads = leads ?? [];
  const allEscalations = escalations ?? [];
  const allCalls = calls ?? [];
  const allChats = chatSessions ?? [];

  const managers = allMembers.filter((m) => m.role_title?.toLowerCase().includes("manager")).length || allMembers.length;
  const online = allMembers.filter((m) => m.status === "online" || m.status === "active").length;
  const away = allMembers.filter((m) => m.status === "away").length;
  const openTickets = allTickets.filter((t) => t.status === "open" || t.status === "pending").length;

  const stats = {
    managers,
    online,
    away,
    tickets: openTickets,
    leads: allLeads.length,
  };

  const leadsByOwner = allLeads.reduce<Record<string, number>>((acc, l) => {
    if (l.assigned_to) acc[l.assigned_to] = (acc[l.assigned_to] ?? 0) + 1;
    return acc;
  }, {});
  const ticketsByOwner = allTickets.reduce<Record<string, number>>((acc, t) => {
    if (t.assigned_to) acc[t.assigned_to] = (acc[t.assigned_to] ?? 0) + 1;
    return acc;
  }, {});
  const wonByOwner = allLeads.reduce<Record<string, number>>((acc, l) => {
    if (l.assigned_to && l.stage === "won") acc[l.assigned_to] = (acc[l.assigned_to] ?? 0) + 1;
    return acc;
  }, {});

  const recentActivity = [
    ...allTickets
      .filter((t) => t.status === "resolved" && t.resolved_at)
      .map((t) => ({ id: `ticket-${t.id}`, action: "Ticket Resolved", target: t.reference, time: t.resolved_at as string })),
    ...allLeads
      .filter((l) => l.stage === "won")
      .map((l) => ({ id: `lead-${l.id}`, action: "Lead Converted", target: l.company, time: l.updated_at })),
    ...allCalls
      .filter((c) => c.status === "completed")
      .map((c) => ({ id: `call-${c.id}`, action: "Call Completed", target: c.caller_name ?? c.id, time: c.started_at })),
    ...allEscalations.map((e) => ({ id: `esc-${e.id}`, action: "Issue Escalated", target: e.reference ?? e.reason, time: e.created_at })),
  ]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6);

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-teal-500/10 to-emerald-500/10 border-teal-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Managers</p>
                <p className="text-2xl font-bold text-teal-400">{stats.managers}</p>
              </div>
              <Users className="w-8 h-8 text-teal-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.online}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Away</p>
                <p className="text-2xl font-bold text-amber-400">{stats.away}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-rose-500/10 border-rose-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Tickets</p>
                <p className="text-2xl font-bold text-rose-400">{stats.tickets}</p>
              </div>
              <Ticket className="w-8 h-8 text-rose-400/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-2xl font-bold text-blue-400">{stats.leads}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team Members */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Team Members
              </h3>
              <Button variant="outline" size="sm" onClick={() => handleAction("View", "All Team")}>
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
            </div>
            <div className="space-y-2">
              {teamLoading && <p className="text-sm text-muted-foreground text-center py-4">Loading team...</p>}
              {!teamLoading && allMembers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No team members yet.</p>
              )}
              {allMembers.slice(0, 6).map((member) => {
                const memberLeads = leadsByOwner[member.id] ?? 0;
                const memberTickets = ticketsByOwner[member.id] ?? 0;
                const won = wonByOwner[member.id] ?? 0;
                const conversion = memberLeads > 0 ? `${Math.round((won / memberLeads) * 100)}%` : "—";
                const status = member.status === "online" || member.status === "active" ? "active" : "away";
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                        <span className="text-teal-400 text-sm font-semibold">
                          {member.full_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.department ?? member.department ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          status === "active"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        )}
                      >
                        {status}
                      </Badge>
                      <span className="text-sm text-cyan-400">{conversion}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                Recent Activity
              </h3>
            </div>
            <div className="space-y-2">
              {recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
              )}
              {recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 bg-background/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.target}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{relativeTime(activity.time)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderLiveTickets = () => {
    const live = allTickets.filter((t) => t.status === "open" || t.status === "pending");
    return (
      <div className="space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Ticket className="w-6 h-6 text-rose-400" />
              <div>
                <h2 className="text-xl font-bold text-foreground">Live Tickets</h2>
                <p className="text-sm text-muted-foreground">Active support tickets</p>
              </div>
            </div>
            <div className="space-y-3">
              {ticketsLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading tickets...</p>}
              {!ticketsLoading && live.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No live tickets right now.</p>
              )}
              {live.map((ticket) => {
                const assignee = allMembers.find((m) => m.id === ticket.assigned_to)?.full_name ?? "Unassigned";
                return (
                  <div
                    key={ticket.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{ticket.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        {ticket.reference} • Assigned: {assignee}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          ticket.priority === "high" || ticket.priority === "urgent"
                            ? "bg-red-500/20 text-red-400"
                            : ticket.priority === "medium"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-muted/40 text-muted-foreground"
                        )}
                      >
                        {ticket.priority}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction("View", ticket.reference)}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          onClick={() => handleResolveTicket(ticket.id, ticket.reference)}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderTeamMembers = () => (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-teal-400" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Team Members</h2>
              <p className="text-sm text-muted-foreground">Manage your team</p>
            </div>
          </div>
          <div className="space-y-3">
            {teamLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading team...</p>}
            {!teamLoading && allMembers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No team members found.</p>
            )}
            {allMembers.map((member) => {
              const memberLeads = leadsByOwner[member.id] ?? 0;
              const memberTickets = ticketsByOwner[member.id] ?? 0;
              const status = member.status === "online" || member.status === "active" ? "active" : "away";
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center">
                      <span className="text-teal-400 font-bold">{member.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {member.department ?? member.department ?? "—"} • {memberTickets} tickets • {memberLeads} leads
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        status === "active"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      )}
                    >
                      {status}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("View", member.full_name)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderLeadsInbox = () => (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Inbox className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Leads Inbox</h2>
              <p className="text-sm text-muted-foreground">Incoming leads</p>
            </div>
          </div>
          <div className="space-y-3">
            {leadsLoading && <p className="text-sm text-muted-foreground text-center py-6">Loading leads...</p>}
            {!leadsLoading && allLeads.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No leads yet.</p>
            )}
            {allLeads.slice(0, 10).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div>
                  <p className="font-semibold text-foreground">{lead.company}</p>
                  <p className="text-sm text-muted-foreground">{lead.contact_name} • {lead.source}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">{lead.stage}</Badge>
                  <Button size="sm" variant="outline" onClick={() => handleAction("View", lead.company)}>View</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderCustomerChats = () => (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <MessageCircle className="w-6 h-6 text-purple-400" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Customer Chats</h2>
              <p className="text-sm text-muted-foreground">Active conversations</p>
            </div>
          </div>
          <div className="space-y-3">
            {allChats.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No active chats.</p>
            )}
            {allChats.slice(0, 10).map((chat) => (
              <div key={chat.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div>
                  <p className="font-semibold text-foreground">{chat.visitor_name}</p>
                  <p className="text-sm text-muted-foreground">{chat.channel} • {chat.status}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleAction("View", chat.visitor_name)}>View</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderFollowups = () => {
    const followups = allLeads.filter((l) => l.stage !== "won" && l.stage !== "lost");
    return (
      <div className="space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-xl font-bold text-foreground">Follow-ups</h2>
                <p className="text-sm text-muted-foreground">Scheduled follow-ups</p>
              </div>
            </div>
            <div className="space-y-3">
              {followups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No follow-ups pending.</p>
              )}
              {followups.slice(0, 10).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                  <div>
                    <p className="font-semibold text-foreground">{lead.company}</p>
                    <p className="text-sm text-muted-foreground">{lead.stage} • {lead.urgency}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleAction("Follow up", lead.company)}>Follow up</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderEscalations = () => (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Escalations</h2>
              <p className="text-sm text-muted-foreground">Escalated issues</p>
            </div>
          </div>
          <div className="space-y-3">
            {allEscalations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No escalations.</p>
            )}
            {allEscalations.map((esc) => (
              <div key={esc.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div>
                  <p className="font-semibold text-foreground">{esc.reason ?? esc.id}</p>
                  <p className="text-sm text-muted-foreground">Level {esc.level} • {esc.status}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleAction("View", esc.reason ?? esc.id)}>View</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPerformanceReports = () => {
    const won = allLeads.filter((l) => l.stage === "won").length;
    const resolved = allTickets.filter((t) => t.status === "resolved").length;
    return (
      <div className="space-y-6">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-indigo-400" />
              <div>
                <h2 className="text-xl font-bold text-foreground">Performance Reports</h2>
                <p className="text-sm text-muted-foreground">Team performance metrics</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-background/50 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{won}</p>
                <p className="text-sm text-muted-foreground">Leads Won</p>
              </div>
              <div className="p-4 bg-background/50 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{resolved}</p>
                <p className="text-sm text-muted-foreground">Tickets Resolved</p>
              </div>
              <div className="p-4 bg-background/50 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{allMembers.length}</p>
                <p className="text-sm text-muted-foreground">Active Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderActivityLog = () => (
    <div className="space-y-6">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <History className="w-6 h-6 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-bold text-foreground">Activity Log</h2>
              <p className="text-sm text-muted-foreground">Recent activity</p>
            </div>
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No activity recorded.</p>
            )}
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border/50">
                <div>
                  <p className="font-semibold text-foreground">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.target}</p>
                </div>
                <span className="text-xs text-muted-foreground">{relativeTime(activity.time)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case "overview":
        return renderOverview();
      case "live_tickets":
        return renderLiveTickets();
      case "team_members":
        return renderTeamMembers();
      case "leads_inbox":
        return renderLeadsInbox();
      case "customer_chats":
        return renderCustomerChats();
      case "followups":
        return renderFollowups();
      case "escalations":
        return renderEscalations();
      case "performance_reports":
        return renderPerformanceReports();
      case "activity_log":
        return renderActivityLog();
      default:
        return renderOverview();
    }
  };

  return (
    <ScrollArea className="flex-1">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Headset className="w-7 h-7 text-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sales & Support</h1>
              <p className="text-muted-foreground">Global Team Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
              RUNNING
            </Badge>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">
              AI ACTIVE
            </Badge>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
              HEALTHY
            </Badge>
          </div>
        </div>

        {renderContent()}
      </div>
    </ScrollArea>
  );
};

export default SalesSupportDashboardContent;
