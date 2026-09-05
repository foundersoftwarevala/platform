import { motion } from "framer-motion";
import { Mail, MailOpen, Reply, UserPlus, Ticket, ArrowUp, Clock, Bot, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailQueue, useTeamMembers, useUpdateRow, relativeTime, memberName } from "@/hooks/useSalesSupportData";

const EmailQueueModule = () => {
  const { data: emailData, isLoading } = useEmailQueue();
  const { data: members } = useTeamMembers();
  const updateEmail = useUpdateRow("email_queue");

  const emails = emailData ?? [];
  const agents = members ?? [];

  const handleAssign = async (emailId: string, agentId: string) => {
    toast.loading("Assigning email...", { id: `assign-${emailId}` });
    try {
      await updateEmail.mutateAsync({ id: emailId, values: { assigned_to: agentId, status: "read" } });
      toast.success(`Assigned to ${memberName(agents, agentId) ?? "agent"}`, { id: `assign-${emailId}` });
    } catch {
      toast.error("Failed to assign", { id: `assign-${emailId}` });
    }
  };

  const handleReply = async (emailId: string) => {
    toast.loading("Marking replied...", { id: `reply-${emailId}` });
    try {
      await updateEmail.mutateAsync({ id: emailId, values: { status: "replied" } });
      toast.success("Reply sent", { id: `reply-${emailId}` });
    } catch {
      toast.error("Failed to reply", { id: `reply-${emailId}` });
    }
  };

  const handleConvertToTicket = (emailId: string) => {
    toast.info("Convert to ticket", { description: "Open the Tickets module to create a ticket from this email." });
  };

  const handleEscalate = async (emailId: string) => {
    toast.loading("Escalating email...", { id: `escalate-${emailId}` });
    try {
      await updateEmail.mutateAsync({ id: emailId, values: { status: "escalated", priority: "urgent" } });
      toast.warning("Email escalated", { id: `escalate-${emailId}` });
    } catch {
      toast.error("Failed to escalate", { id: `escalate-${emailId}` });
    }
  };

  const handleUseAISuggestion = (emailId: string) => {
    toast.info("AI suggestion", { description: "No AI suggestion available for this email yet." });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "high": return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "medium": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    return status === "unread" ? Mail : MailOpen;
  };

  const unreadCount = emails.filter(e => e.status === "unread").length;
  const urgentCount = emails.filter(e => e.priority === "urgent" && e.status !== "replied").length;
  const slaRisk = emails.filter(e => e.status !== "replied" && (Date.now() - new Date(e.received_at).getTime()) / 60000 > 60).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Email Queue</h2>
          <p className="text-muted-foreground">Unified inbox with AI suggestions and SLA tracking</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <Mail className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{emails.length}</div>
            <div className="text-xs text-muted-foreground">Total Emails</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-purple-500/20">
          <CardContent className="p-4 text-center">
            <MailOpen className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-purple-100">{unreadCount}</div>
            <div className="text-xs text-muted-foreground">Unread</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <Tag className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{urgentCount}</div>
            <div className="text-xs text-muted-foreground">Urgent</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{slaRisk}</div>
            <div className="text-xs text-muted-foreground">SLA Risk</div>
          </CardContent>
        </Card>
      </div>

      {/* Emails List */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading && <p className="text-muted-foreground text-sm">Loading emails…</p>}
            {!isLoading && emails.length === 0 && <p className="text-muted-foreground text-sm">No emails in queue.</p>}
            {emails.map((email, index) => {
              const StatusIcon = getStatusIcon(email.status);
              const assignedName = memberName(agents, email.assigned_to);
              return (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors ${email.status === "unread" ? "border-l-4 border-cyan-500" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`w-5 h-5 ${email.status === "unread" ? "text-cyan-400" : "text-muted-foreground"}`} />
                      <span className="font-mono text-cyan-400 text-sm">{email.id.slice(0, 8)}</span>
                      <Badge className={getPriorityColor(email.priority)}>{email.priority}</Badge>
                      {email.category && (
                        <Badge variant="outline" className="text-muted-foreground text-xs">{email.category}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{relativeTime(email.received_at)}</span>
                    </div>
                  </div>

                  <div className="mb-2">
                    <h4 className="font-medium text-foreground">{email.subject}</h4>
                    <p className="text-sm text-muted-foreground">{email.from_name ?? email.from_email} &lt;{email.from_email}&gt; {assignedName && `• Assigned: ${assignedName}`}</p>
                    {email.preview && <p className="text-sm text-muted-foreground truncate">{email.preview}</p>}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Bot className="w-4 h-4 text-purple-400" />
                      <Button size="sm" variant="ghost" onClick={() => handleUseAISuggestion(email.id)} className="text-purple-400 text-xs">
                        AI Suggest
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {!email.assigned_to && (
                        <Select onValueChange={(agent) => handleAssign(email.id, agent)}>
                          <SelectTrigger className="w-32 bg-muted/40 border-border">
                            <SelectValue placeholder="Assign" />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.map(agent => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button size="sm" variant="outline" onClick={() => handleReply(email.id)} className="border-cyan-500/30 text-cyan-300">
                        <Reply className="w-3 h-3 mr-1" />
                        Reply
                      </Button>

                      <Button size="sm" variant="outline" onClick={() => handleConvertToTicket(email.id)} className="border-amber-500/30 text-amber-300">
                        <Ticket className="w-3 h-3 mr-1" />
                        Ticket
                      </Button>

                      {email.status !== "escalated" && (
                        <Button size="sm" variant="outline" onClick={() => handleEscalate(email.id)} className="border-red-500/30 text-red-300">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Escalate
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailQueueModule;
