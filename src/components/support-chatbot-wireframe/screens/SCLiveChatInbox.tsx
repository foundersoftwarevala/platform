/**
 * SCREEN 3: LIVE CHAT INBOX
 */
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Send, User, Globe, Smartphone, Clock, MessageSquare, Bot, MoreHorizontal, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  useChatSessions, useChatMessages, useInsertRow, useUpdateRow, relativeTime,
} from '@/hooks/useSalesSupportData';

export const SCLiveChatInbox: React.FC = () => {
  const { data: sessions, isLoading } = useChatSessions();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const insertMessage = useInsertRow('chat_messages');
  const updateSession = useUpdateRow('chat_sessions');

  const allSessions = sessions ?? [];
  const activeId = selectedConversation ?? allSessions[0]?.id ?? null;
  const { data: messages } = useChatMessages(activeId);
  const selected = allSessions.find((s) => s.id === activeId) ?? null;

  const filtered = useMemo(
    () => allSessions.filter((c) => c.visitor_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [allSessions, searchQuery],
  );

  const handleSend = async () => {
    if (!message.trim() || !activeId) return;
    try {
      await insertMessage.mutateAsync({ session_id: activeId, sender_type: 'agent', sender_name: 'Agent', body: message });
      setMessage('');
    } catch {
      toast.error('Failed to send message');
    }
  };

  const handleTakeOver = async () => {
    if (!selected) return;
    try {
      await updateSession.mutateAsync({ id: selected.id, values: { handled_by: 'human', status: 'active' } });
      toast.success('Chat taken over');
    } catch {
      toast.error('Failed to take over chat');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Live Chats</h1>
        <p className="text-sm text-muted-foreground mt-1">Active conversations</p>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Left Panel - Conversation List */}
        <Card className="col-span-3 flex flex-col">
          <CardHeader className="p-3 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-9 h-9"
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {isLoading && <p className="p-3 text-sm text-muted-foreground">Loading chats...</p>}
              {!isLoading && filtered.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No conversations found.</p>
              )}
              {filtered.map((conv) => (
                <motion.div
                  key={conv.id}
                  whileHover={{ x: 2 }}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    activeId === conv.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{conv.visitor_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">{conv.visitor_name}</p>
                        <span className="text-xs text-muted-foreground">{relativeTime(conv.started_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.status}</p>
                    </div>
                    {conv.unread_count > 0 && (
                      <Badge className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Center Panel - Chat Window */}
        <Card className="col-span-6 flex flex-col">
          <CardHeader className="p-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{selected?.visitor_name.charAt(0) ?? '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selected?.visitor_name ?? 'Select a chat'}</p>
                  <p className="text-xs text-muted-foreground">{selected?.status ?? '—'}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Phone className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleTakeOver}>
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {(messages ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
              )}
              {(messages ?? []).map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender_type === 'visitor' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[70%] ${msg.sender_type !== 'visitor' ? 'order-2' : ''}`}>
                    <div className={`flex items-end gap-2 ${msg.sender_type !== 'visitor' ? 'flex-row-reverse' : ''}`}>
                      {msg.sender_type === 'bot' && (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3 text-emerald-600" />
                        </div>
                      )}
                      <div className={`rounded-lg px-3 py-2 ${
                        msg.sender_type !== 'visitor'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        <p className="text-sm whitespace-pre-line">{msg.body}</p>
                      </div>
                    </div>
                    <p className={`text-[10px] text-muted-foreground mt-1 ${msg.sender_type !== 'visitor' ? 'text-right' : ''}`}>
                      {relativeTime(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={!activeId}
              />
              <Button onClick={handleSend} disabled={!activeId}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Panel - User Context */}
        <Card className="col-span-3">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">User Context</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-4">
            {!selected ? (
              <p className="text-sm text-muted-foreground text-center py-8">Select a chat to view details.</p>
            ) : (
              <>
                <div className="text-center pb-4 border-b">
                  <Avatar className="h-16 w-16 mx-auto">
                    <AvatarFallback className="text-lg">{selected.visitor_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="font-semibold mt-2">{selected.visitor_name}</p>
                  <p className="text-xs text-muted-foreground">Started {relativeTime(selected.started_at)}</p>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: Globe, label: 'Channel', value: selected.channel },
                    { icon: MessageSquare, label: 'Language', value: selected.language },
                    { icon: Smartphone, label: 'Handled By', value: selected.handled_by },
                    { icon: Bot, label: 'Sentiment', value: selected.sentiment },
                    { icon: Clock, label: 'Unread', value: String(selected.unread_count) },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-medium">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 space-y-2">
                  <Button variant="outline" className="w-full gap-2" size="sm" disabled={!selected.visitor_email}>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </Button>
                  <Button variant="outline" className="w-full gap-2" size="sm">
                    <Clock className="w-4 h-4" />
                    View History
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
