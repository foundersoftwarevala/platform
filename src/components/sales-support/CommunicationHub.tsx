import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MessageCircle, Shield, Globe, Send, User, Clock, FileText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useEmailQueue,
  useCallLogs,
  useChatSessions,
  useChatMessages,
  useCannedResponses,
  relativeTime,
} from "@/hooks/useSalesSupportData";

type UnifiedConversation = {
  id: string;
  source: "chat" | "email" | "call";
  client: string;
  company: string;
  lastMessage: string;
  time: string;
  timestamp: number;
  unread: number;
  status: string;
};

const CommunicationHub = () => {
  const [message, setMessage] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: emails = [] } = useEmailQueue();
  const { data: calls = [] } = useCallLogs();
  const { data: chats = [] } = useChatSessions();
  const { data: cannedResponses = [] } = useCannedResponses();

  const conversations: UnifiedConversation[] = useMemo(() => {
    const chatItems: UnifiedConversation[] = chats.map((c) => ({
      id: c.id,
      source: "chat",
      client: c.visitor_name,
      company: c.channel,
      lastMessage: c.sentiment ? `Sentiment: ${c.sentiment}` : "Active chat",
      time: relativeTime(c.started_at),
      timestamp: new Date(c.started_at).getTime(),
      unread: c.unread_count ?? 0,
      status: c.status,
    }));
    const emailItems: UnifiedConversation[] = emails.map((e) => ({
      id: e.id,
      source: "email",
      client: e.from_name || e.from_email,
      company: e.category,
      lastMessage: e.preview || e.subject,
      time: relativeTime(e.received_at),
      timestamp: new Date(e.received_at).getTime(),
      unread: e.status === "unread" ? 1 : 0,
      status: e.status,
    }));
    const callItems: UnifiedConversation[] = calls.map((c) => ({
      id: c.id,
      source: "call",
      client: c.caller_name,
      company: c.direction,
      lastMessage: c.notes || `${c.direction} call`,
      time: relativeTime(c.started_at),
      timestamp: new Date(c.started_at).getTime(),
      unread: 0,
      status: c.status,
    }));
    return [...chatItems, ...emailItems, ...callItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, emails, calls]);

  const activeId = selectedId ?? conversations[0]?.id ?? null;
  const active = conversations.find((c) => c.id === activeId) ?? null;

  const { data: chatMessages = [] } = useChatMessages(active?.source === "chat" ? active.id : null);

  const positiveChats = chats.filter((c) => c.sentiment === "positive").length;
  const conversionLikelihood = chats.length > 0 ? Math.round((positiveChats / chats.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-cyan-100">Communication Hub</h2>
          <p className="text-muted-foreground">Masked client chat with auto-translation</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Shield className="w-3 h-3 mr-1" />
            Identity Protected
          </Badge>
          <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30">
            <Globe className="w-3 h-3 mr-1" />
            Auto-Translate ON
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="bg-card/60 border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-cyan-100 text-lg">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="p-2 space-y-2">
                {conversations.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3">No conversations yet.</p>
                )}
                {conversations.map((conv) => (
                  <motion.div
                    key={conv.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedId(conv.id)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      conv.id === activeId
                        ? "bg-cyan-500/20 border border-cyan-500/30"
                        : "bg-card/60 hover:bg-card/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                          <User className="w-4 h-4 text-cyan-400" />
                        </div>
                        <span className="font-medium text-cyan-100 text-sm">{conv.client}</span>
                      </div>
                      {conv.unread > 0 && (
                        <span className="w-5 h-5 bg-cyan-500 rounded-full text-[10px] text-foreground flex items-center justify-center">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{conv.time}</span>
                      <Badge className={conv.status === "active" ? "bg-emerald-500/20 text-emerald-300 text-xs" : "bg-amber-500/20 text-amber-300 text-xs"}>
                        {conv.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 bg-card/60 border-cyan-500/20 flex flex-col">
          <CardHeader className="border-b border-cyan-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-foreground" />
                </div>
                <div>
                  <CardTitle className="text-cyan-100">{active?.client ?? "No conversation selected"}</CardTitle>
                  <p className="text-xs text-muted-foreground">{active ? `${active.company} • ${active.status}` : ""}</p>
                </div>
              </div>
              {active && (
                <Badge className="bg-muted/40 text-muted-foreground">
                  <Clock className="w-3 h-3 mr-1" />
                  {active.time}
                </Badge>
              )}
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4 h-[350px]">
            <div className="space-y-4">
              {active?.source === "chat" ? (
                chatMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet in this session.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender_type === "visitor" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[70%] ${msg.sender_type === "visitor" ? "bg-card/60 border-border" : "bg-cyan-500/20 border-cyan-500/30"} border rounded-lg p-3`}>
                        <p className={`text-sm ${msg.sender_type === "visitor" ? "text-foreground" : "text-cyan-100"}`}>{msg.body}</p>
                        <span className="text-xs text-muted-foreground mt-1 block">{relativeTime(msg.created_at)}</span>
                      </div>
                    </motion.div>
                  ))
                )
              ) : active ? (
                <div className="bg-card/60 border border-border rounded-lg p-3">
                  <p className="text-sm text-foreground">{active.lastMessage}</p>
                  <span className="text-xs text-muted-foreground mt-1 block">{active.time}</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a conversation to view details.</p>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t border-cyan-500/20">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="bg-card/60 border-border text-foreground placeholder:text-muted-foreground"
              />
              <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-foreground">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyan-100 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-400" />
                Canned Replies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cannedResponses.length === 0 && (
                <p className="text-xs text-muted-foreground">No canned responses configured.</p>
              )}
              {cannedResponses.slice(0, 4).map((reply) => (
                <Button
                  key={reply.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-left text-xs text-muted-foreground hover:text-cyan-300 hover:bg-cyan-500/10 h-auto py-2"
                  onClick={() => setMessage(reply.body)}
                >
                  {reply.body.substring(0, 40)}...
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-cyan-100 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                AI Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start text-xs border-cyan-500/30 text-cyan-300">
                  Suggest integration demo
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs border-cyan-500/30 text-cyan-300">
                  Send pricing sheet
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start text-xs border-cyan-500/30 text-cyan-300">
                  Schedule follow-up call
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-900/30 to-cyan-900/30 border-emerald-500/30">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-300">{conversionLikelihood}%</div>
              <div className="text-xs text-muted-foreground">Likely to Convert</div>
              <div className="text-xs text-emerald-400 mt-1">
                {conversionLikelihood >= 60 ? "High Priority Lead" : "Needs Nurturing"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CommunicationHub;
