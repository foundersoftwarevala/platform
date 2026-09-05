import { useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Send, User, Bot, Clock, CheckCircle, UserPlus, ArrowUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChatSessions, useTeamMembers, useUpdateRow, useInsertRow, relativeTime, memberName } from "@/hooks/useSalesSupportData";

const LiveChatModule = () => {
  const { data: sessionsData, isLoading } = useChatSessions();
  const { data: members } = useTeamMembers();
  const updateSession = useUpdateRow("chat_sessions");
  const insertMessage = useInsertRow("chat_messages");
  const [messageText, setMessageText] = useState("");

  const chats = sessionsData ?? [];
  const agents = members ?? [];

  const handleAcceptChat = async (chatId: string, agentId: string) => {
    toast.loading("Accepting chat...", { id: `accept-${chatId}` });
    try {
      await updateSession.mutateAsync({ id: chatId, values: { agent_id: agentId, status: "active" } });
      toast.success(`Chat accepted by ${memberName(agents, agentId) ?? "agent"}`, { id: `accept-${chatId}` });
    } catch {
      toast.error("Failed to accept chat", { id: `accept-${chatId}` });
    }
  };

  const handleTransfer = async (chatId: string, agentId: string) => {
    toast.loading("Transferring chat...", { id: `transfer-${chatId}` });
    try {
      await updateSession.mutateAsync({ id: chatId, values: { agent_id: agentId, status: "transferred" } });
      toast.success(`Transferred to ${memberName(agents, agentId) ?? "agent"}`, { id: `transfer-${chatId}` });
    } catch {
      toast.error("Failed to transfer chat", { id: `transfer-${chatId}` });
    }
  };

  const handleResolve = async (chatId: string) => {
    toast.loading("Closing chat...", { id: `resolve-${chatId}` });
    try {
      await updateSession.mutateAsync({ id: chatId, values: { status: "resolved", ended_at: new Date().toISOString() } });
      toast.success("Chat resolved", { id: `resolve-${chatId}` });
    } catch {
      toast.error("Failed to resolve chat", { id: `resolve-${chatId}` });
    }
  };

  const handleEscalate = async (chatId: string) => {
    toast.loading("Escalating chat...", { id: `escalate-${chatId}` });
    try {
      await insertMessage.mutateAsync({ session_id: chatId, sender_type: "system", body: "Chat escalated to supervisor" });
      toast.warning("Chat escalated to supervisor", { id: `escalate-${chatId}` });
    } catch {
      toast.error("Failed to escalate chat", { id: `escalate-${chatId}` });
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "bg-emerald-500/20 text-emerald-300";
      case "negative": return "bg-red-500/20 text-red-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-amber-500/20 text-amber-300";
      case "active": return "bg-emerald-500/20 text-emerald-300";
      case "resolved": return "bg-muted/40 text-muted-foreground";
      case "transferred": return "bg-blue-500/20 text-blue-300";
      default: return "bg-muted/40 text-muted-foreground";
    }
  };

  const waitingCount = chats.filter(c => c.status === "waiting").length;
  const activeCount = chats.filter(c => c.status === "active").length;
  const negativeCount = chats.filter(c => c.sentiment === "negative" && c.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Live Chat</h2>
          <p className="text-muted-foreground">Real-time chat sessions with sentiment analysis</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <MessageCircle className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-cyan-100">{chats.length}</div>
            <div className="text-xs text-muted-foreground">Total Chats</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-amber-500/20">
          <CardContent className="p-4 text-center">
            <Clock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-amber-100">{waitingCount}</div>
            <div className="text-xs text-muted-foreground">Waiting</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-emerald-100">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="bg-card/60 border-red-500/20">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-2xl font-bold text-red-100">{negativeCount}</div>
            <div className="text-xs text-muted-foreground">Negative Sentiment</div>
          </CardContent>
        </Card>
      </div>

      {/* Chats List */}
      <Card className="bg-card/60 border-cyan-500/20">
        <CardHeader>
          <CardTitle className="text-cyan-100">Active Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {isLoading && <p className="text-muted-foreground text-sm">Loading chats…</p>}
            {!isLoading && chats.length === 0 && <p className="text-muted-foreground text-sm">No chat sessions.</p>}
            {chats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`p-4 bg-card/60 rounded-lg hover:bg-card/60 transition-colors ${chat.status === "waiting" ? "border-l-4 border-amber-500" : ""} ${chat.sentiment === "negative" ? "border-l-4 border-red-500" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-cyan-500/20 text-cyan-300">{chat.visitor_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cyan-400 text-sm">{chat.id.slice(0, 8)}</span>
                        <span className="font-medium text-foreground">{chat.visitor_name}</span>
                        <Badge className={getStatusColor(chat.status)}>{chat.status}</Badge>
                        <Badge className={getSentimentColor(chat.sentiment)}>{chat.sentiment}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{chat.visitor_email ?? "-"} • Started {relativeTime(chat.started_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div />
                  <div className="flex items-center gap-2">
                    {chat.status === "waiting" && (
                      <Select onValueChange={(agent) => handleAcceptChat(chat.id, agent)}>
                        <SelectTrigger className="w-32 bg-muted/40 border-border">
                          <SelectValue placeholder="Accept" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map(agent => (
                            <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {chat.status === "active" && (
                      <>
                        <Select onValueChange={(agent) => handleTransfer(chat.id, agent)}>
                          <SelectTrigger className="w-32 bg-muted/40 border-border">
                            <SelectValue placeholder="Transfer" />
                          </SelectTrigger>
                          <SelectContent>
                            {agents.filter(a => a.id !== chat.agent_id).map(agent => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button size="sm" variant="outline" onClick={() => handleEscalate(chat.id)} className="border-red-500/30 text-red-300">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          Escalate
                        </Button>

                        <Button size="sm" onClick={() => handleResolve(chat.id)} className="bg-emerald-500 hover:bg-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveChatModule;
